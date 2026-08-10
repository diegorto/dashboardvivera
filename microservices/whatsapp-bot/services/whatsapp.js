// Conexao com o WhatsApp via QR Code, usando Baileys (sem headless browser).
// Escaneamento e sempre manual, feito pelo Diego na tela /whatsapp do CRM.
const path = require('path')
const QRCode = require('qrcode')
const pool = require('../db')
const crm = require('./crm')
const redis = require('../lib/redis')
// ---- Trava de concorrencia por conversa ----
// Bug real: mensagens do mesmo lead chegando quase juntas podiam ser processadas em
// paralelo, e as duas rodadas liam ai_enabled=1 antes de qualquer uma delas gravar o
// handoff - resultado: a IA continuava respondendo (inclusive inventando nome de
// atendente) mesmo depois de ja ter avisado que ia transferir. Esta fila garante que
// mensagens da MESMA conversa sejam processadas uma de cada vez, em ordem.
const conversationLocks = new Map()
function withConversationLock(key, fn) {
  const prev = conversationLocks.get(key) || Promise.resolve()
  const next = prev.then(fn, fn).finally(() => {
    if (conversationLocks.get(key) === next) conversationLocks.delete(key)
  })
  conversationLocks.set(key, next)
  return next
}

const ai = require('./ai')
const pendingAudioTimers = new Map()

let sock = null
let latestQrDataUrl = null
let connectionStatus = 'disconnected'
let reconnectAttempts = 0
let baileys = null

// Versao fixa (fallback) do protocolo WhatsApp Web, usada quando
// fetchLatestBaileysVersion() falhar ou quando a versao dinamica for rejeitada
// pelo WhatsApp (erro 405 no handshake - incidente de 2026-07-28). O Baileys tem
// um bug conhecido: o catch desse fetch nao define fallback, deixando waVersion
// undefined (ver github.com/WhiskeySockets/Baileys issues #2370 #2485 #1427).
// Atualizar este array manualmente se o erro 405 voltar a ocorrer de forma
// persistente. Capturada em 2026-07-29 via fetchLatestBaileysVersion() (isLatest=true).
const FALLBACK_WA_VERSION = [2, 3000, 1043857760]
let lastCloseWasVersionRejected = false

async function upsertSessionRow(patch) {
  const [rows] = await pool.query("SELECT id FROM whatsapp_sessions WHERE session_name = 'default'")
  if (!rows.length) {
    await pool.query('INSERT INTO whatsapp_sessions (session_name, status) VALUES (?, ?)', ['default', patch.status || 'disconnected'])
  }
  const fields = []
  const values = []
  for (const k of Object.keys(patch)) { fields.push(`${k} = ?`); values.push(patch[k]) }
  if (fields.length) {
    await pool.query(`UPDATE whatsapp_sessions SET ${fields.join(', ')} WHERE session_name = 'default'`, values)
  }
}

async function ensureConversation(phone, name, jid, connectionId) {
  const normalized = crm.normalizePhone(phone)
  const [rows] = await pool.query('SELECT * FROM whatsapp_conversations WHERE phone = ? AND connection_id <=> ?', [normalized, connectionId || null])
  if (rows.length) {
    if (jid && rows[0].wa_jid !== jid) await pool.query('UPDATE whatsapp_conversations SET wa_jid = ? WHERE id = ?', [jid, rows[0].id])
    return rows[0]
  }
  try {
    const [r] = await pool.query(
      'INSERT INTO whatsapp_conversations (phone, wa_jid, contact_name, ai_enabled, status, last_message_at, connection_id) VALUES (?, ?, ?, 1, "open", NOW(), ?)',
      [normalized, jid || null, name || null, connectionId || null]
    )
    const [[conv]] = await pool.query('SELECT * FROM whatsapp_conversations WHERE id = ?', [r.insertId])
    return conv
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      // Corrida entre handlers concorrentes (ex.: texto e audio quase simultaneos) ou
      // conversa ja existente pra esse phone amarrada a outro connection_id (uq_phone
      // e unique key so na coluna phone). Recupera a conversa existente em vez de deixar
      // o erro subir e a mensagem morrer silenciosamente (bug corrigido em 2026-08-05,
      // causa raiz identificada pelo Diego: erro sistematico "erro ao processar audio da
      // conexao 5: Duplicate entry ... for key 'uq_phone'" engolido em sessionManager.js).
      const [existingRows] = await pool.query('SELECT * FROM whatsapp_conversations WHERE phone = ? ORDER BY id DESC LIMIT 1', [normalized])
      if (existingRows.length) {
        if (jid && existingRows[0].wa_jid !== jid) await pool.query('UPDATE whatsapp_conversations SET wa_jid = ? WHERE id = ?', [jid, existingRows[0].id])
        return existingRows[0]
      }
    }
    throw e
  }
}

async function saveMessage(conversationId, direction, content, sentBy, waMessageId, messageType, mediaUrl) {
  await pool.query(
    'INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_by, wa_message_id, message_type, media_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [conversationId, direction, content, sentBy || 'lead', waMessageId || null, messageType || 'text', mediaUrl || null]
  )
  await pool.query('UPDATE whatsapp_conversations SET last_message_at = NOW() WHERE id = ?', [conversationId])
}

// Mensagem outbound detectada via messages.upsert com key.fromMe=true: cobre o
// caso de uma SDR responder direto pelo app do WhatsApp (nao pela interface do
// CRM). Se a mensagem ja foi salva no momento do envio (CRM/IA), o proprio
// wa_message_id ja existe na tabela e aqui so confirmamos e saimos; senao,
// gravamos como resposta humana para o badge de "aguardando resposta" ser
// recalculado corretamente.
async function handleOutgoingFromDevice(fromJid, m, connCtx) {
  const waMessageId = m.key && m.key.id
  if (waMessageId) {
    const [existingRows] = await pool.query('SELECT id FROM whatsapp_messages WHERE wa_message_id = ? LIMIT 1', [waMessageId])
    if (existingRows.length) return
  }
  const phone = fromJid.split('@')[0]
  if (!fromJid || fromJid.endsWith('@broadcast') || fromJid.endsWith('@newsletter') || !/\d/.test(phone)) {
    console.log('[whatsapp] mensagem ignorada - JID nao suportado (status/broadcast/lid invalido): ' + fromJid)
    return
  }
  const conv = await ensureConversation(phone, '', fromJid, connCtx && connCtx.connectionId)
  let messageType = 'text'
  let content = m.message.conversation || (m.message.extendedTextMessage && m.message.extendedTextMessage.text)
  if (!content) {
    if (m.message.audioMessage) { messageType = 'audio'; content = '[Audio]' }
    else if (m.message.imageMessage) { messageType = 'image'; content = m.message.imageMessage.caption || '[Imagem]' }
    else if (m.message.videoMessage) { messageType = 'video'; content = m.message.videoMessage.caption || '[Video]' }
    else if (m.message.documentMessage || m.message.documentWithCaptionMessage) { messageType = 'document'; content = '[Documento]' }
    else if (m.message.stickerMessage) { messageType = 'sticker'; content = '[Figurinha]' }
    else { content = '[Mensagem]' }
  }
  const [recentRows] = await pool.query(
    "SELECT id FROM whatsapp_messages WHERE conversation_id = ? AND direction = 'out' AND content = ? AND created_at >= (NOW() - INTERVAL 20 SECOND) ORDER BY id DESC LIMIT 1",
    [conv.id, content]
  )
  if (recentRows.length) return
  let mediaUrl = null
  if (messageType === 'audio') {
    try {
      const fsx = require('fs')
      const { downloadMediaMessage } = require('@whiskeysockets/baileys')
      const buffer = await downloadMediaMessage(m, 'buffer', {})
      const dir = path.join(__dirname, '..', 'assets', 'outgoing_device_audio')
      fsx.mkdirSync(dir, { recursive: true })
      const filename = 'outdev_' + Date.now() + '_' + phone + '.ogg'
      fsx.writeFileSync(path.join(dir, filename), buffer)
      mediaUrl = 'assets/outgoing_device_audio/' + filename
      try {
        const transcript = await ai.transcribeAudio(buffer)
        content = (transcript && transcript.trim()) ? transcript : 'Transcricao indisponivel'
      } catch (e) {
        console.error('[whatsapp] erro ao transcrever audio enviado do dispositivo:', e.message)
        content = 'Transcricao indisponivel'
      }
    } catch (e) {
      console.error('[whatsapp] erro ao baixar audio enviado do dispositivo:', e.message)
    }
  }
  await saveMessage(conv.id, 'out', content, 'human', waMessageId, messageType, mediaUrl)
}

// ---- Fluxo de boas-vindas (audio de pre-qualificacao + inicio da sequencia de resgate) ----
// Extraido do gatilho automatico (classifyOpeningIntent === treatment) para ser reutilizavel
// tambem pelo disparo manual via CRM (cadenceEngine.manualTriggerWelcomeFlow). NAO altera
// o comportamento do gatilho automatico - mesma logica, so parametrizada.
async function triggerWelcomeFlow({ fromJid, convId, dealId, pushName, connCtx, chatbotEnabled }) {
  try {
    // [2026-08-07] Reconstruido a pedido do Diego: o passo-gatilho (antes sempre
    // audio via sendAudio) agora e dirigido por config (seq_trigger_type +
    // seq_trigger_content), igual aos steps 1-4. Usa o mesmo mecanismo confiavel
    // (sendText/sendImage/sendVideo) que ja funciona nos fluxos de cadencia D+1 a
    // D+15 - nao usa mais sendAudio() diretamente aqui. Timing/logica preservados:
    // este passo continua disparando IMEDIATAMENTE e sincrono (t=0), antes de
    // agendar os steps 1-4 via scheduler.scheduleSequence (que roda em paralelo,
    // com delays cumulativos configurados em seq_stepN_delay_min).
    const seqCfg = await ai.getConfig()
    const triggerType = seqCfg.seq_trigger_type || 'text'
    const triggerContent = seqCfg.seq_trigger_content || seqCfg.seq_trigger_audio_path || ''
    if (triggerContent) {
      try {
        const path = require('path')
        const activeSock = connCtx && connCtx.sock
        if (triggerType === 'audio') {
          await sendAudio(fromJid, path.join(__dirname, '..', triggerContent), activeSock)
        } else if (triggerType === 'image') {
          await sendImage(fromJid, path.join(__dirname, '..', triggerContent), '', activeSock)
        } else if (triggerType === 'video') {
          await sendVideo(fromJid, path.join(__dirname, '..', triggerContent), {}, activeSock)
        } else {
          const text = String(triggerContent).split('{nome}').join(pushName || 'Oi')
          await sendText(fromJid, text, activeSock)
        }
        await saveMessage(convId, 'out', '[fluxo inicial - gatilho ' + triggerType + ']', 'ai')
        if (dealId) {
          try {
            await pool.query('UPDATE deals SET stage_id = ? WHERE id = ? AND pipeline_id = (SELECT pipeline_id FROM stages WHERE id = ?)', [8, dealId, 8])
            console.log('[whatsapp] deal ' + dealId + ' movido para Contato Realizado (stage 8) apos envio do gatilho (' + triggerType + ')')
          } catch (e) {
            console.error('[whatsapp] erro ao mover deal para Contato Realizado:', e.message)
          }
        }
      } catch (e) {
        console.error('[whatsapp] erro ao enviar gatilho do fluxo inicial (' + triggerType + '):', e.message)
        try {
          const fallbackText = 'Oi' + (pushName ? ' ' + pushName : '') + '! Aqui e o Dr. Diego. O que chamou sua atencao no que voce viu, e o que mais oje quando voce se olha no espelho?'
          await sendText(fromJid, fallbackText, connCtx && connCtx.sock)
          await saveMessage(convId, 'out', fallbackText, 'ai')
        } catch (e2) {
          console.error('[whatsapp] fallback de texto do gatilho tambem falhou:', e2.message)
        }
      }
    } else {
      console.warn('[whatsapp] seq_trigger_content nao configurado, pulando gatilho inicial')
    }
    if (chatbotEnabled) await require('./scheduler').scheduleSequence(convId, pushName)
  } catch (e) {
    console.error('[whatsapp] erro ao disparar fluxo de boas-vindas:', e.message)
  }
}
async function handleIncomingText(fromJid, text, pushName, connCtx) {
  const phone = fromJid.split('@')[0]
  if (!fromJid || fromJid.endsWith('@broadcast') || fromJid.endsWith('@newsletter') || !/\d/.test(phone)) {
    console.log('[whatsapp] mensagem ignorada - JID nao suportado (status/broadcast/lid invalido): ' + fromJid)
    return
  }
  let aiBlockedByAllowlist = false
  try {
    const allowlist = require('./allowlist')
    if (await allowlist.isRestrictedMode() && !(await allowlist.isAllowlisted(phone))) {
      aiBlockedByAllowlist = true
      console.log('[whatsapp] allowlist ativo: resposta de IA bloqueada para ' + phone + ' (conversa/lead seguem sendo registrados normalmente)')
    }
  } catch (e) { console.error('[whatsapp] erro checando allowlist:', e.message) }
  const conv = await ensureConversation(phone, pushName, fromJid, connCtx && connCtx.connectionId)

    if (conv && conv.cadence_enabled) {
      try {
        await pool.query('UPDATE whatsapp_conversations SET cadence_enabled = 0 WHERE id = ?', [conv.id])
        if (conv.deal_id) {
          const [dealRows] = await pool.query('SELECT sdr_user_id FROM deals WHERE id = ?', [conv.deal_id])
          const dealRow = dealRows && dealRows[0]
          if (dealRow && dealRow.sdr_user_id) {
            await pool.query(
              'INSERT INTO owner_notifications (owner_user_id, deal_id, type, message, created_at) VALUES (?, ?, ?, ?, NOW())',
              [dealRow.sdr_user_id, conv.deal_id, 'lead_respondeu', 'Lead respondeu durante a cadencia automatica - cadencia pausada, atendimento manual necessario.']
            )
          }
        }
      } catch (e) {
        console.error('[whatsapp] erro ao pausar cadencia por resposta do lead:', e.message)
      }
    }
// ---- Modo treinador (equipe do piloto corrigindo a Vivi via emoji de lagosta) ----
// Roda ANTES de qualquer outra logica (CRM, allowlist de leads, IA) porque isso nao
// e mensagem de lead - e a equipe interna editando o comportamento do bot. So numeros
// ja cadastrados em ai_chatbot_allowlist podem acionar. Implementado 2026-08-05.
try {
} catch (e) { console.error('[whatsapp] erro no modo treinador:', e.message) }
  const myConnFlags = await require('./connectionsStore').getFlags(connCtx && connCtx.connectionId).catch(() => ({ ai_enabled: true, chatbot_enabled: true }))
  try {
    const [dupAudioCheck] = await pool.query(
      "SELECT id FROM whatsapp_messages WHERE conversation_id = ? AND direction = 'in' AND message_type = 'audio' AND created_at >= (NOW() - INTERVAL 8 SECOND) ORDER BY id DESC LIMIT 1",
      [conv.id]
    )
    if (dupAudioCheck && dupAudioCheck.length) {
      console.log('[whatsapp] texto ignorado (provavel transcricao nativa do WhatsApp duplicando audio recem-recebido) - conversa ' + conv.id)
      return
    }
  } catch (e) { console.error('[whatsapp] erro ao checar duplicidade audio/texto:', e.message) }
  await saveMessage(conv.id, 'in', text, 'lead')
  // ARQUITETURA (2026-08-06): a partir daqui, QUALQUER mensagem recebida (texto digitado ou
  // transcricao de audio) ja esta gravada incondicionalmente na memoria/contexto da IA,
  // ANTES de qualquer verificacao de negocio (allowlist, handoff humano, quiz/deteccao de
  // intencao, etc). Nenhum branch abaixo pode mais 'esquecer' de salvar a mensagem no
  // contexto, porque isso ja aconteceu aqui, no unico ponto de entrada. Ver tambem: o
  // pushMemory('user', ...) que existia dentro de ai.generateReply foi removido para nao
  // duplicar esta gravacao.
  try {
    const cfgMemEntry = await ai.getConfig().catch(() => null)
    if (cfgMemEntry) await ai.pushMemory(conv.id, 'user', text, parseInt(cfgMemEntry.redis_ttl_seconds || '86400')).catch(() => {})
  } catch (e) { console.error('[whatsapp] erro ao salvar mensagem incondicionalmente na memoria:', e.message) }
  if (pendingAudioTimers.has(conv.id)) { clearTimeout(pendingAudioTimers.get(conv.id)); pendingAudioTimers.delete(conv.id) }
  try { await require('./scheduler').cancelPending(conv.id) } catch (e) { console.error('[scheduler] erro ao cancelar sequencia:', e.message) }

  // Garante paciente + deal no CRM, replicando a mesma logica de atribuicao de SDR do Tintim.
  // 'patient' precisa ficar visivel depois do try/catch (usado la embaixo em ai.generateReply) -
  // por isso e declarado fora do bloco (bug corrigido em 2026-08-01: estava com 'let' dentro do
  // try, causando ReferenceError 'patient is not defined' sempre que o fluxo chegava ali).
  let patient = null
  try {
    const isAnonymousOrGroupJid = fromJid.endsWith('@lid') || fromJid.endsWith('@g.us')
    patient = await crm.findPatientByPhone(phone)
    if (!patient) {
      if (isAnonymousOrGroupJid) {
        console.log('[whatsapp] CRM sync bloqueado para ' + phone + ': jid anonimo/grupo (' + fromJid + '), nao cria patient/deal')
      } else {
        console.log('[whatsapp] CRM sync bloqueado: telefone ' + phone + ' sem patient existente - bot NUNCA cria patient novo (regra permanente: so via webhook Tintim lead.create confirmado ou cadastro manual por SDR)')
      }
    }
    if (patient) {
    let deal = await crm.findOpenDealByPatient(patient.id).catch(() => null)
    if (!deal) {
      const lastDeal = await crm.findMostRecentDealByPatient(patient.id).catch(() => null)
      if (lastDeal) {
        deal = await crm.reopenDeal(lastDeal.id, patient.id)
      } else {
        console.log('[whatsapp] CRM sync bloqueado: patient ' + patient.id + ' sem deal existente - bot NUNCA cria deal novo (regra permanente: so via webhook Tintim lead.create confirmado ou criacao manual por SDR)')
      }
    }
      if (deal && (conv.patient_id !== patient.id || conv.deal_id !== deal.id)) {
      await pool.query('UPDATE whatsapp_conversations SET patient_id = ?, deal_id = ? WHERE id = ?', [patient.id, deal.id, conv.id])
    }
    }
  } catch (e) {
    console.error('[whatsapp] erro ao vincular lead ao CRM:', e.message)
  }

  const [[freshConv]] = await pool.query('SELECT * FROM whatsapp_conversations WHERE id = ?', [conv.id])
  const aiCfg = await ai.getConfig()
  const aiConversationDisabled = (aiCfg.ai_globally_enabled === 'false') || (myConnFlags && myConnFlags.ai_enabled === false) || !freshConv.ai_enabled
  // NOTA (2026-08-06, pedido do Diego): fluxo de boas-vindas desacoplado deste gate - dispara mesmo com IA conversacional desativada (testes). Resto da IA (nome, respostas, handoff) fica muda quando aiConversationDisabled = true.

  if (aiBlockedByAllowlist) {
    console.log('[whatsapp] allowlist ativo: lead fora do piloto (bloqueando fluxos automaticos e enviando cortesia unica) - ' + phone)
    try {
      // [2026-08-05 Diego] REVERTIDO PARA SILENCIO TOTAL: NAO enviar nenhuma mensagem
      // visivel ao lead fora do allowlist (a cortesia revelava "fase piloto" e passava
      // impressao ruim pra leads reais vindos de anuncio). So o alerta interno roda.
      await pool.query(
        'INSERT INTO owner_notifications (owner_user_id, deal_id, type, message) VALUES (NULL, NULL, ?, ?)',
        ['allowlist_blocked', 'Lead fora do allowlist (piloto) tentou contato: ' + phone + (pushName ? ' - ' + pushName : '')]
      )
    } catch (e) {
      console.error('[whatsapp][ALERTA_CRITICO] falha ao processar cortesia/alerta de allowlist. conversationId=' + conv.id + ' erro=' + e.message)
    }
    return
  }

      if (!aiConversationDisabled) {
  // ---- Confirmacao de nome via pushName do WhatsApp (2026-08-01) ----
    // Pergunta UMA vez, logo no inicio, se ainda nao confirmado. Depois disso a IA
    // so recebe o nome ja resolvido - nunca pergunta "qual seu nome" por conta propria.
    try {
      if (patient && pushName && pushName.trim() && !patient.name_confirmed_at) {
        const nameConfirmKey = 'nameConfirmStage:' + conv.id
        const stage = await redis.get(nameConfirmKey)
        const selfIntroMatch = text.match(/(?:me chamo|meu nome (?:e|é)|sou (?:a|o)|aqui (?:e|é) (?:a|o))\s+([A-ZÀ-Ý][\wà-ÿÀ-Ý'-]{1,30})/i)
        function cleanName(raw) {
          let n = (raw || '').split('\n')[0].trim()
          n = n.replace(/[."!?,;:]+$/g, '').trim()
          if (n.length > 40) n = n.slice(0, 40).trim()
          n = n.split(/\s+/)[0] || n
          return n
        }
        function looksLikeValidHumanName(raw) {
          const s = (raw || '').trim()
          if (!s) return false
          if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'-]+(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ'-]+){0,3}$/.test(s)) return false
          const NAO_SAO_NOMES = ['amor', 'vendas', 'promocao', 'promocoes', 'promoção', 'promoções', 'loja', 'grupo', 'empresa', 'contato', 'atendimento', 'suporte', 'admin', 'whatsapp', 'business', 'comercial', 'financeiro', 'cliente', 'secretaria', 'secretária', 'recepcao', 'recepção', 'marketing', 'oi', 'ola', 'olá']
          const palavras = s.toLowerCase().split(/\s+/)
          if (palavras.some(p => NAO_SAO_NOMES.includes(p))) return false
          return true
        }
        async function confirmName(finalName) {
          const clean = cleanName(finalName) || pushName
          await pool.query('UPDATE patients SET name = ?, name_confirmed_at = NOW() WHERE id = ?', [clean, patient.id])
          patient.name = clean
          await redis.del(nameConfirmKey)
          console.log('[whatsapp] nome confirmado para patient ' + patient.id + ': ' + clean)
        }
        if (!stage) {
          if (selfIntroMatch) {
            await confirmName(selfIntroMatch[1])
          } else if (looksLikeValidHumanName(pushName)) {
            await confirmName(pushName)
          } else {
            const q = 'Vi que seu nome aqui no WhatsApp esta como "' + pushName + '". E assim que voce prefere que eu te chame?'
            await sendText(fromJid, q, connCtx && connCtx.sock)
            await saveMessage(conv.id, 'out', q, 'ai')
            await redis.set(nameConfirmKey, 'awaiting_yesno', 'EX', 172800)
            return
          }
        } else if (stage === 'awaiting_yesno') {
          const isYes = /^\s*(sim|isso mesmo|exato|e isso|é isso|isso ai|isso aí|pode|correto|isso)\b/i.test(text)
          const isNo = /^\s*n(a|ã)o\b/i.test(text)
          if (isYes) {
            await confirmName(pushName)
          } else if (isNo) {
            const remainder = text.replace(/^\s*n(a|ã)o\b[,.]?\s*/i, '').trim()
            if (remainder && remainder.length >= 2 && remainder.length <= 40 && !/\?/.test(remainder)) {
              await confirmName(remainder)
            } else {
              const q2 = 'Sem problemas! Como voce prefere ser chamada?'
              await sendText(fromJid, q2, connCtx && connCtx.sock)
              await saveMessage(conv.id, 'out', q2, 'ai')
              await redis.set(nameConfirmKey, 'awaiting_customname', 'EX', 172800)
              return
            }
          } else {
            const candidate = cleanName(text)
            if (candidate && candidate.length >= 2 && candidate.length <= 40 && !/\?/.test(candidate)) {
              await confirmName(candidate)
            } else {
              await confirmName(pushName)
            }
          }
        } else if (stage === 'awaiting_customname') {
          await confirmName(text)
        }
      }
    } catch (e) {
      console.error('[whatsapp] erro no fluxo de confirmacao de nome:', e.message)
    }

    }

  let treatmentTriggered = false
  let genericInterestTriggered = false
  try {
    const [[inCountRow]] = await pool.query("SELECT COUNT(*) AS c FROM whatsapp_messages WHERE conversation_id=? AND direction='in'", [conv.id])
    const isFirstContact = inCountRow && inCountRow.c === 1
    if (isFirstContact) {
      const [[flowRow]] = await pool.query("SELECT is_active FROM chatbot_flows WHERE trigger_keyword = 'fluxo_inicial_quiz' LIMIT 1")
      const quizEnabled = !!(flowRow && flowRow.is_active)
      if (quizEnabled) {
        const intent = await ai.classifyOpeningIntent(text)
        if (intent && intent.category === 'treatment') {
          const timer = setTimeout(() => {
      pendingAudioTimers.delete(conv.id)
      triggerWelcomeFlow({
        fromJid,
        convId: conv.id,
        dealId: (typeof deal !== 'undefined' && deal) ? deal.id : null,
        pushName,
        connCtx,
        chatbotEnabled: !myConnFlags || myConnFlags.chatbot_enabled !== false
      })
    }, 5000)
    pendingAudioTimers.set(conv.id, timer)
    treatmentTriggered = true
        } else if (intent && intent.category === 'generic_interest') {
          try {
            const reply = 'Ola, eu sou a assistente e vou te encaminhar para a atendente especializada no seu interesse. Poderia me mandar por escrito ou por audio a sua duvida? Assim ja vou adiantando o assunto para ser mais rapida pra voce 😊'
            await sendText(fromJid, reply, connCtx && connCtx.sock)
            await saveMessage(conv.id, 'out', reply, 'ai')
            genericInterestTriggered = true
          } catch (e) {
            console.error('[whatsapp] erro ao enviar resposta de interesse generico:', e.message)
          }
        }
      }
    }
  } catch (e) {
    console.error('[whatsapp] erro na deteccao de tratamento:', e.message)
  }
  if (treatmentTriggered || genericInterestTriggered) return // mensagem ja salva na memoria incondicionalmente no inicio da funcao
  if (aiConversationDisabled) return // IA conversacional desativada - fluxo de boas-vindas ja tratado acima, resto fica em silencio
  const { chunks, needsHandoff, qualification, summary, crmSummary } = await ai.generateReply(conv.id, text, (patient && patient.name) ? patient.name : pushName)

  // Deteccao simples de interesse em procedimento corporal (fora do escopo atual,
  // que e so facial). Registra uma nota rastreavel no deal/paciente para que alguem
  // consiga avisar essas pessoas quando o servico corporal for lancado (ver system_prompt
  // na tela "Configuracao IA" / "Orientacao do Robo" para o roteiro completo que a IA segue).
  const BODY_PROCEDURE_REGEX = /harmonizac[aá]o\s*(gl[uú]tea|de\s*bumbum|de\s*barriga|corporal)|gl[uú]teo|bumbum|ultraformer\s*mpt|flacidez\s*(de\s*)?(bra[cç]o|colo|seio)|lipedema|abdome/i
  if (BODY_PROCEDURE_REGEX.test(text)) {
    await crm.logActivity(
      freshConv.deal_id,
      freshConv.patient_id,
      `Lead perguntou sobre procedimento corporal (mensagem: "${text.slice(0, 200)}"). Hoje so fazemos harmonizacao facial (Dr. Diego). Checar na conversa se a pessoa topou ser avisada quando o servico corporal (harmonizacao glutea, Ultraformer MPT, flacidez de bracos/colo/seios) estiver disponivel.`,
      'note'
    ).catch(() => {})
  }

  
    if (needsHandoff) {
      // [2026-08-01 Diego] REMOVIDO: nao trava mais a IA no momento do aviso de handoff. ai_enabled so vira 0 quando a SDR manda mensagem manual real (ver sendManualMessage). Alerta de handoff e envio do aviso continuam normalmente.
      try {
        await pool.query(
          'INSERT INTO handoff_alerts (conversation_id, deal_id, patient_id, phone, lead_name, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [conv.id, freshConv.deal_id, freshConv.patient_id, phone, pushName || null]
        )
      } catch (e) {
        console.error('[whatsapp][ALERTA_CRITICO] falha ao GRAVAR handoff_alerts (aviso foi enviado mas NAO persistido, risco de reanunciar) conversationId=' + conv.id + ' err=' + e.message)
      }
    }
for (const chunk of chunks) {
    await sendText(fromJid, chunk, connCtx && connCtx.sock)
    await saveMessage(conv.id, 'out', chunk, 'ai')
  }
  if (needsHandoff) {
    // [2026-08-01 Diego] REMOVIDO: nao trava mais a IA no momento do aviso de handoff. ai_enabled so vira 0 quando a SDR manda mensagem manual real (ver sendManualMessage). Alerta de handoff e envio do aviso continuam normalmente.
    if (qualification) {
      await crm.updateQualification(freshConv.deal_id, freshConv.patient_id, qualification, crmSummary)
    }
    await crm.logActivity(freshConv.deal_id, freshConv.patient_id, summary || 'Bot WhatsApp (Vive) identificou necessidade de atendimento humano e pausou a IA nesta conversa.', 'system')
  }
}

async function handleIncomingAudio(m) {
  const fromJid = m.key.remoteJid
  const phone = fromJid.split('@')[0]
  if (!fromJid || fromJid.endsWith('@broadcast') || fromJid.endsWith('@newsletter') || !/\d/.test(phone)) {
    console.log('[whatsapp] mensagem ignorada - JID nao suportado (status/broadcast/lid invalido): ' + fromJid)
    return
  }
  const pushName = m.pushName || null
  const { downloadMediaMessage } = require('@whiskeysockets/baileys')
  const fsx = require('fs')
  const buffer = await downloadMediaMessage(m, 'buffer', {})
  const dir = path.join(__dirname, '..', 'assets', 'incoming_audio')
  fsx.mkdirSync(dir, { recursive: true })
  const filename = 'in_' + Date.now() + '_' + phone + '.ogg'
  fsx.writeFileSync(path.join(dir, filename), buffer)
  const conv = await ensureConversation(phone, pushName, fromJid)
  const [audioInsertResult] = await pool.query("INSERT INTO whatsapp_messages (conversation_id, direction, message_type, media_url, sent_by) VALUES (?, 'in', 'audio', ?, 'lead')", [conv.id, 'assets/incoming_audio/' + filename])
  console.log('[whatsapp] audio recebido salvo em assets/incoming_audio/' + filename)
  try {
    await withConversationLock(fromJid, async () => {
      const transcript = await ai.transcribeAudio(buffer)
      if (transcript) {
        console.log('[whatsapp] audio transcrito: ' + transcript)
        await handleIncomingText(fromJid, transcript, pushName)
        try { await pool.query('UPDATE whatsapp_messages SET content = ? WHERE id = ?', [transcript, audioInsertResult.insertId]) } catch (e) { console.error('[whatsapp] erro ao salvar transcricao no audio:', e.message) }
      } else {
        console.log('[whatsapp] audio nao pode ser transcrito (sem texto reconhecido)')
        try { await pool.query('UPDATE whatsapp_messages SET content = ? WHERE id = ?', ['Transcricao indisponivel', audioInsertResult.insertId]) } catch (e) { console.error('[whatsapp] erro ao salvar fallback de transcricao:', e.message) }
      }
    })
  } catch (e) {
    console.error('[whatsapp] erro ao transcrever/processar audio:', e.message)
  }
}

async function handleIncomingVideo(m) {
  const fromJid = m.key.remoteJid
  const phone = fromJid.split('@')[0]
  if (!fromJid || fromJid.endsWith('@broadcast') || fromJid.endsWith('@newsletter') || !/\d/.test(phone)) {
    console.log('[whatsapp] mensagem ignorada - JID nao suportado (status/broadcast/lid invalido): ' + fromJid)
    return
  }
  const pushName = m.pushName || null
  const { downloadMediaMessage } = require('@whiskeysockets/baileys')
  const fsx = require('fs')
  const buffer = await downloadMediaMessage(m, 'buffer', {})
  const dir = path.join(__dirname, '..', 'assets', 'incoming_video')
  fsx.mkdirSync(dir, { recursive: true })
  const filename = 'in_' + Date.now() + '_' + phone + '.mp4'
  fsx.writeFileSync(path.join(dir, filename), buffer)
  const conv = await ensureConversation(phone, pushName, fromJid)
  await pool.query("INSERT INTO whatsapp_messages (conversation_id, direction, message_type, media_url, sent_by) VALUES (?, 'in', 'video', ?, 'lead')", [conv.id, 'assets/incoming_video/' + filename])
  console.log('[whatsapp] video recebido salvo em assets/incoming_video/' + filename)
}

async function handleIncomingDocument(m) {
  const fromJid = m.key.remoteJid
  const phone = fromJid.split('@')[0]
  if (!fromJid || fromJid.endsWith('@broadcast') || fromJid.endsWith('@newsletter') || !/\d/.test(phone)) {
    console.log('[whatsapp] mensagem ignorada - JID nao suportado (status/broadcast/lid invalido): ' + fromJid)
    return
  }
  const pushName = m.pushName || null
  const { downloadMediaMessage } = require('@whiskeysockets/baileys')
  const fsx = require('fs')
  const buffer = await downloadMediaMessage(m, 'buffer', {})
  const dir = path.join(__dirname, '..', 'assets', 'incoming_documents')
  fsx.mkdirSync(dir, { recursive: true })
  const docMsg = m.message?.documentMessage || m.message?.documentWithCaptionMessage?.message?.documentMessage
  const originalName = (docMsg && docMsg.fileName) ? docMsg.fileName : 'documento'
  const ext = originalName.includes('.') ? originalName.split('.').pop() : 'bin'
  const filename = 'in_' + Date.now() + '_' + phone + '.' + ext
  fsx.writeFileSync(path.join(dir, filename), buffer)
  const conv = await ensureConversation(phone, pushName, fromJid)
  await pool.query("INSERT INTO whatsapp_messages (conversation_id, direction, message_type, media_url, sent_by) VALUES (?, 'in', 'document', ?, 'lead')", [conv.id, 'assets/incoming_documents/' + filename])
  console.log('[whatsapp] documento recebido (' + originalName + ') salvo em assets/incoming_documents/' + filename)
}

async function handleIncomingImage(m) {
  const fromJid = m.key.remoteJid
  const phone = fromJid.split('@')[0]
  if (!fromJid || fromJid.endsWith('@broadcast') || fromJid.endsWith('@newsletter') || !/\d/.test(phone)) {
    console.log('[whatsapp] mensagem ignorada - JID nao suportado (status/broadcast/lid invalido): ' + fromJid)
    return
  }
  const pushName = m.pushName || null
  const { downloadMediaMessage } = require('@whiskeysockets/baileys')
  const fsx = require('fs')
  const buffer = await downloadMediaMessage(m, 'buffer', {})
  const dir = path.join(__dirname, '..', 'assets', 'incoming_images')
  fsx.mkdirSync(dir, { recursive: true })
  const filename = 'in_' + Date.now() + '_' + phone + '.jpg'
  fsx.writeFileSync(path.join(dir, filename), buffer)
  const conv = await ensureConversation(phone, pushName, fromJid)
  await pool.query("INSERT INTO whatsapp_messages (conversation_id, direction, message_type, media_url, sent_by) VALUES (?, 'in', 'image', ?, 'lead')", [conv.id, 'assets/incoming_images/' + filename])
  console.log('[whatsapp] imagem recebida salva em assets/incoming_images/' + filename)
}

async function simulateHumanTyping(activeSock, jid, text) {
  try {
    const len = (text || '').length
    const base = 500 + Math.random() * 700
    const perChar = 28 + Math.random() * 30
    let delay = base + len * perChar
    if (len > 50 && Math.random() < 0.45) delay += 350 + Math.random() * 700
    if (Math.random() < 0.2) delay += 200 + Math.random() * 500
    delay = Math.min(Math.max(delay, 900), 6500)
    await activeSock.sendPresenceUpdate('composing', jid)
    await new Promise((r) => setTimeout(r, delay))
    await activeSock.sendPresenceUpdate('paused', jid)
  } catch (e) {
    // presenca eh cosmetica, nunca deve bloquear o envio da mensagem
  }
}

async function sendText(jid, text, sockOverride) {
  try {

  if (!sockOverride && !sock) throw new Error('WhatsApp nao conectado')
  const activeSock = sockOverride || sock
  console.log('[whatsapp][DIAG] sendText: socket ws.readyState=' + (activeSock.ws && activeSock.ws.readyState) + ' jid=' + jid + ' usingOverride=' + !!sockOverride)
  await simulateHumanTyping(activeSock, jid, text)
  const sendResult = await activeSock.sendMessage(jid, { text })
    realSendConsecutiveFailures = 0
  console.log('[whatsapp][DIAG] sendText: sendMessage retornou -> ' + JSON.stringify({ id: sendResult && sendResult.key && sendResult.key.id, status: sendResult && sendResult.status, hasMessage: !!(sendResult && sendResult.message) }))
  return sendResult

  } catch (e) {
    realSendConsecutiveFailures++
    console.warn('[whatsapp][WATCHDOG][BAND-AID] falha real de envio (sendText), contador=' + realSendConsecutiveFailures + ': ' + e.message)
    throw e
  }
}

async function sendAudio(jid, filePath, sockOverride) {
  const activeSock = sockOverride || sock
  const fsx = require('fs')
  const maxAttempts = 2
  const ackTimeoutMs = 20000
  let lastErr = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let targetId = null
    try {
      const buffer = fsx.readFileSync(filePath)
      const sent = await activeSock.sendMessage(jid, { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true })
      targetId = sent && sent.key && sent.key.id
      if (!targetId) {
        lastErr = new Error('Envio nao retornou ID de mensagem (tentativa ' + attempt + ')')
        console.error('[whatsapp] ' + lastErr.message)
      } else {
        const acked = await new Promise((resolve) => {
          let done = false
          const handler = (updates) => {
            for (const u of updates) {
              if (u.key && u.key.id === targetId) {
                done = true
                activeSock.ev.off('messages.update', handler)
                resolve(true)
              }
            }
          }
          activeSock.ev.on('messages.update', handler)
          setTimeout(() => {
            if (!done) { activeSock.ev.off('messages.update', handler); resolve(false) }
          }, ackTimeoutMs)
        })
        if (acked) return targetId
        lastErr = new Error('Audio enviado mas sem confirmacao de entrega do WhatsApp (tentativa ' + attempt + ')')
        console.error('[whatsapp] audio sem ACK na tentativa ' + attempt + ' - id ' + targetId + (attempt < maxAttempts ? ' - tentando novamente' : ''))
      }
    } catch (e) {
      lastErr = e
      console.error('[whatsapp] tentativa ' + attempt + ' de envio de audio falhou: ' + e.message)
    }
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 2000))
  }
  throw lastErr || new Error('Falha ao enviar audio apos ' + maxAttempts + ' tentativas (sem confirmacao de entrega do WhatsApp). Tente novamente.')
}
async function sendImage(jid, filePath, caption, sockOverride) {
  const fsx = require('fs')
  await (sockOverride || sock).sendMessage(jid, { image: fsx.readFileSync(filePath), caption: caption || undefined })
}

async function sendVideo(jid, filePath, opts, sockOverride) {
  const fsx = require('fs')
  const asNote = !!(opts && opts.ptv === true)
  await (sockOverride || sock).sendMessage(jid, { video: fsx.readFileSync(filePath), mimetype: 'video/mp4', ptv: asNote })
}

async function checkOnWhatsApp(number, sockOverride) {
  const digits = String(number).replace(/\D/g, '')
  const activeSock = sockOverride || sock
  if (!activeSock) throw new Error('WhatsApp nao conectado')
  const results = await activeSock.onWhatsApp(digits)
  return results
}

async function sendDocument(jid, filePath, fileName, mimetype, sockOverride) {
  const fsx = require('fs')
  await (sockOverride || sock).sendMessage(jid, { document: { url: filePath }, fileName: fileName || 'arquivo', mimetype: mimetype || 'application/octet-stream' })
}

async function sendAudioWithAck(jid, filePath, timeoutMs) {
  const fsx = require('fs')
  const sent = await sock.sendMessage(jid, { audio: fsx.readFileSync(filePath), mimetype: 'audio/ogg; codecs=opus', ptt: true })
  const targetId = sent.key.id
  return new Promise((resolve) => {
    let done = false
    const handler = (updates) => {
      for (const u of updates) {
        if (u.key && u.key.id === targetId) {
          done = true
          sock.ev.off('messages.update', handler)
          resolve({ acked: true, update: u })
        }
      }
    }
    sock.ev.on('messages.update', handler)
    setTimeout(() => {
      if (!done) {
        sock.ev.off('messages.update', handler)
        resolve({ acked: false, messageId: targetId })
      }
    }, timeoutMs || 15000)
  })
}

async function sendManualMedia(conversationId, filePath, mediaType, opts) {
  opts = opts || {}
  const [[conv]] = await pool.query('SELECT * FROM whatsapp_conversations WHERE id = ?', [conversationId])
  if (!conv) throw new Error('conversa nao encontrada')
  const jid = conv.wa_jid || (String(conv.phone || '').replace('+', '')) + '@s.whatsapp.net'
  let effectiveConnectionId = conv.connection_id
  let sockOverride = getSocketForConnection(effectiveConnectionId)
  if (conv.connection_id && !sockOverride) {
  const fallbackId = getActiveConnectionId()
  if (fallbackId) {
  console.warn('[whatsapp] conexao ' + conv.connection_id + ' da conversa ' + conversationId + ' nao encontrada; usando conexao ativa ' + fallbackId + ' como fallback')
  effectiveConnectionId = fallbackId
  sockOverride = getSocketForConnection(effectiveConnectionId)
  } else {
  console.warn('[whatsapp] conexao ' + conv.connection_id + ' da conversa ' + conversationId + ' nao encontrada e nenhuma conexao alternativa ativa (sessionManager pode estar desativado); usando conexao padrao (legado) como fallback')
  effectiveConnectionId = null
  }
  }
  const connAgeMs = effectiveConnectionId ? getConnectionAgeMs(effectiveConnectionId) : null
  const MIN_STABLE_MS = 20000
  if (effectiveConnectionId && sockOverride && connAgeMs !== null && connAgeMs < MIN_STABLE_MS) {
  throw new Error('Conexao WhatsApp (conexao ' + effectiveConnectionId + ') reconectou ha pouco (' + Math.round(connAgeMs/1000) + 's). Aguarde alguns segundos e tente novamente para evitar midia corrompida.')
  }
  let sentAudioMsgId = null
  if (mediaType === 'image') await sendImage(jid, filePath, opts.caption || '', sockOverride)
  else if (mediaType === 'video') await sendVideo(jid, filePath, { caption: opts.caption || '' }, sockOverride)
  else if (mediaType === 'audio') sentAudioMsgId = await sendAudio(jid, filePath, sockOverride)
  else await sendDocument(jid, filePath, opts.fileName || 'arquivo', opts.mimetype || 'application/octet-stream', sockOverride)
  let audioTranscript = null
  if (mediaType === 'audio') {
    try {
      const fsx = require('fs')
      const buffer = fsx.readFileSync(filePath)
      audioTranscript = await ai.transcribeAudio(buffer)
      if (audioTranscript) console.log('[whatsapp] audio manual transcrito: ' + audioTranscript)
    } catch (e) {
      console.error('[whatsapp] erro ao transcrever audio manual:', e.message)
    }
  }
  const relMediaUrl = String(filePath).replace(/^.*[\\\/]assets[\\\/]/, 'assets/').replace(/\\/g, '/')
  try {
    await pool.query(
      "INSERT INTO whatsapp_messages (conversation_id, direction, message_type, media_url, sent_by, content) VALUES (?, 'out', ?, ?, 'human', ?)",
      [conversationId, mediaType, relMediaUrl, opts.caption || audioTranscript || ('\uD83D\uDCCE ' + (opts.fileName || 'anexo'))]
    )
  } catch (e) {
    console.error('[whatsapp] erro ao salvar mensagem de anexo manual:', e.message)
  }
  if (mediaType === 'audio' && sentAudioMsgId) {
    try {
      await pool.query('UPDATE whatsapp_messages SET wa_message_id = ? WHERE conversation_id = ? AND direction = ? ORDER BY id DESC LIMIT 1', [sentAudioMsgId, conversationId, 'out'])
    } catch (e) {
      console.error('[whatsapp] erro ao salvar wa_message_id do audio:', e.message)
    }
  }
  await pool.query('UPDATE whatsapp_conversations SET ai_enabled = 0 WHERE id = ?', [conversationId])
  try {
    await pool.query('UPDATE handoff_alerts SET resolved_at = NOW() WHERE conversation_id = ? AND resolved_at IS NULL', [conversationId])
  } catch (e) {
    console.error('[whatsapp] erro ao resolver alerta de handoff:', e.message)
  }
  return true
}

function computeAltBrPhoneVariant(digitsOnly) {
  if (!digitsOnly || !digitsOnly.startsWith('55')) return null
  const rest = digitsOnly.slice(2)
  if (rest.length === 11 && rest[2] === '9') {
    return '55' + rest.slice(0, 2) + rest.slice(3)
  }
  if (rest.length === 10) {
    return '55' + rest.slice(0, 2) + '9' + rest.slice(2)
  }
  return null
}

async function resolveAndCacheJid(conv, sockOverrideForCheck) {
  if (conv.wa_jid) return conv.wa_jid
  const digitsOnly = String(conv.phone || '').replace(/\D/g, '')
  const altPhone = computeAltBrPhoneVariant(digitsOnly)
  const candidates = [digitsOnly]
  if (altPhone && altPhone !== digitsOnly) candidates.push(altPhone)
  for (const candidate of candidates) {
    try {
      const results = await checkOnWhatsApp(candidate, sockOverrideForCheck)
      if (results && results[0] && results[0].jid) {
        const jid = results[0].jid
        try {
          await pool.query('UPDATE whatsapp_conversations SET wa_jid = ?, resolved_at = NOW() WHERE id = ?', [jid, conv.id])
        } catch (e) {
          console.error('[whatsapp][jid-resolver] erro ao salvar wa_jid para conversationId=' + conv.id + ':', e.message)
        }
        return jid
      }
    } catch (e) {
      console.error('[whatsapp][jid-resolver] erro ao checar onWhatsApp para candidate ' + candidate + ':', e.message)
    }
  }
  return null
}


async function sendManualMessage(conversationId, text) {
  const [[conv]] = await pool.query('SELECT * FROM whatsapp_conversations WHERE id = ?', [conversationId])
  if (!conv) throw new Error('conversa nao encontrada')
  let sockOverride = getSocketForConnection(conv.connection_id)
  const jid = await resolveAndCacheJid(conv, sockOverride)
  if (!jid) {
    throw new Error('Numero de WhatsApp nao encontrado (nem variante salva nem alternativa com/sem 9) para conversationId=' + conversationId + ' phone=' + conv.phone)
  }
  if (conv.connection_id && !sockOverride) {
  const fallbackId = getActiveConnectionId()
  if (fallbackId) {
  console.warn('[whatsapp] conexao ' + conv.connection_id + ' da conversa ' + conversationId + ' nao encontrada; usando conexao ativa ' + fallbackId + ' como fallback')
  sockOverride = getSocketForConnection(fallbackId)
  }
  }
  await sendText(jid, text, sockOverride)
  await saveMessage(conversationId, 'out', text, 'human')
  await pool.query('UPDATE whatsapp_conversations SET ai_enabled = 0 WHERE id = ?', [conversationId])
    try {
      await pool.query('UPDATE handoff_alerts SET resolved_at = NOW() WHERE conversation_id = ? AND resolved_at IS NULL', [conversationId])
    } catch (e) {
      console.error('[whatsapp] erro ao resolver alerta de handoff:', e.message)
    }

  return true
}

async function startSocket() {
  if (!baileys) baileys = require('@whiskeysockets/baileys')
  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys
  const authDir = path.join(__dirname, '..', 'auth_session')
  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  let waVersion
  try {
    if (lastCloseWasVersionRejected) {
      waVersion = FALLBACK_WA_VERSION
      console.log('[whatsapp] ultima conexao rejeitada (405), usando versao fallback fixa', waVersion)
    } else {
      const v = await fetchLatestBaileysVersion()
      waVersion = v.version
      console.log('[whatsapp] usando versao WA Web', waVersion, 'isLatest =', v.isLatest)
    }
  } catch (e) {
    waVersion = FALLBACK_WA_VERSION
    console.error('[whatsapp] falha ao buscar versao mais recente, usando fallback fixo:', e.message, waVersion)
  }

  sock = makeWASocket({ auth: state, version: waVersion, printQRInTerminal: false, syncFullHistory: false, browser: ['Vivera Orofacial', 'Chrome', '120.0.0'] })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    if (qr) {
      latestQrDataUrl = await QRCode.toDataURL(qr)
      connectionStatus = 'qr_pending'
      await upsertSessionRow({ status: 'qr_pending', qr_code: latestQrDataUrl })
    }
    if (connection === 'open') {
      reconnectAttempts = 0
      lastCloseWasVersionRejected = false
      connectionStatus = 'connected'
      latestQrDataUrl = null
      const phoneNumber = sock?.user?.id ? sock.user.id.split(':')[0] : null
      await upsertSessionRow({ status: 'connected', qr_code: null, phone_number: phoneNumber, connected_at: new Date(), last_seen: new Date() })
      console.log('[whatsapp] conectado com sucesso, numero:', phoneNumber)
    }
    if (connection === 'close') {
      connectionStatus = 'disconnected'
      await upsertSessionRow({ status: 'disconnected' })
      const code = lastDisconnect?.error?.output?.statusCode
      const loggedOut = code === (DisconnectReason ? DisconnectReason.loggedOut : 401)
      lastCloseWasVersionRejected = code === 405
      if (lastCloseWasVersionRejected) {
        console.log('[whatsapp] erro 405 detectado (rejeicao de versao pelo WhatsApp), proxima tentativa usara versao fallback fixa')
      }
      console.log('[whatsapp] conexao fechada. loggedOut =', loggedOut, 'code =', code)
      if (!loggedOut) {
        if (code === 408) {
          // QR expirou sem ninguem escanear - comportamento esperado, nao e falha.
          // Usa delay curto e fixo (nao conta pro backoff exponencial) pra nao deixar
          // a renovacao do QR lenta quando ninguem esta escaneando ainda.
          console.log('[whatsapp] QR expirou (408), gerando novo QR em 3s')
          setTimeout(() => startSocket().catch(e => console.error('[whatsapp] erro ao reconectar', e.message)), 3000)
        } else {
          reconnectAttempts++
          const backoffDelay = Math.min(3000 * Math.pow(2, reconnectAttempts - 1), 120000)
          console.log(`[whatsapp] reconectando em ${backoffDelay}ms (tentativa ${reconnectAttempts})`)
          setTimeout(() => startSocket().catch(e => console.error('[whatsapp] erro ao reconectar', e.message)), backoffDelay)
        }
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const m of messages) {
      if (m.key.fromMe) continue
      try {
        if (m.key.remoteJid && m.key.remoteJid.endsWith('@lid')) {
          let realJid = m.key.remoteJidAlt
          if (!realJid && sock.signalRepository && sock.signalRepository.lidMapping) {
            try { const pn = await sock.signalRepository.lidMapping.getPNForLID(m.key.remoteJid); if (pn) realJid = pn.includes('@') ? pn : (pn + '@s.whatsapp.net') } catch (e2) { console.warn('[whatsapp] getPNForLID falhou para ' + m.key.remoteJid + ':', e2.message) }
          }
          if (realJid) { console.log('[whatsapp] LID resolvido: ' + m.key.remoteJid + ' -> ' + realJid); m.key.remoteJid = realJid }
          else { console.warn('[whatsapp] LID NAO resolvido (sem mapeamento ainda): ' + m.key.remoteJid) }
        }
      } catch (e) { console.error('[whatsapp] erro resolvendo LID:', e.message) }
      if (m.message?.audioMessage) {
        try { await handleIncomingAudio(m) } catch (e) { console.error('[whatsapp] erro ao processar audio:', e.message) }
        continue
      }
    if (m.message?.videoMessage) {
      try { await handleIncomingVideo(m) } catch (e) { console.error('[whatsapp] erro ao processar video:', e.message) }
      continue
    }
    if (m.message?.documentMessage || m.message?.documentWithCaptionMessage) {
      try { await handleIncomingDocument(m) } catch (e) { console.error('[whatsapp] erro ao processar documento:', e.message) }
      continue
    }
    if (m.message?.imageMessage) {
      try { await handleIncomingImage(m) } catch (e) { console.error('[whatsapp] erro ao processar imagem:', e.message) }
      continue
    }
      const text = m.message?.conversation || m.message?.extendedTextMessage?.text
      if (!text) continue
      const pushName = m.pushName || null
      try { await withConversationLock(m.key.remoteJid, () => handleIncomingText(m.key.remoteJid, text, pushName)) }
      catch (e) { console.error('[whatsapp] erro ao processar mensagem:', e.message) }
    }
  })

  return sock
}

function getStatus() { return { status: connectionStatus, qr: latestQrDataUrl } }

let _sessionManager = null
function registerSessionManager(sm) { _sessionManager = sm }
function getSocketForConnection(connectionId) { if (!connectionId) return undefined; return _sessionManager ? _sessionManager.getSocket(connectionId) : undefined }
function getConnectionAgeMs(connectionId) { if (!connectionId) return null; return _sessionManager ? _sessionManager.getConnectionAgeMs(connectionId) : null }
function getActiveConnectionId() { return _sessionManager && _sessionManager.getActiveConnectionId ? _sessionManager.getActiveConnectionId() : null }

async function forceReconnectConnection(connectionId) {
  if (!connectionId || !_sessionManager || !_sessionManager.forceReconnect) return false
  try { return await _sessionManager.forceReconnect(connectionId) } catch (e) { console.error('[whatsapp] erro ao forcar reconexao da conexao ' + connectionId + ':', e.message); return false }
}


// ===== BAND-AID 2026-08-07 (Diego): watchdog de saude da conexao =====
// Isso e um paliativo, NAO a causa raiz. Causa raiz ainda em investigacao
// (Baileys rc13, socket fica em estado fantasma: connectionStatus='connected'
// mas envios reais falham com "Connection Closed" e o evento close nunca
// dispara pra reconectar sozinho). Esse watchdog faz uma sondagem leve
// (sendPresenceUpdate) periodicamente; se falhar 2x seguidas com status
// 'connected', forca o encerramento do socket antigo e reconexao.
let watchdogConsecutiveFailures = 0
let realSendConsecutiveFailures = 0 // contador de falhas reais de envio (sendText), usado pelo watchdog
function startConnectionWatchdog() {
  setInterval(async () => {
    try {
      console.log('[whatsapp][WATCHDOG][DIAG] tick status=' + connectionStatus + ' failures=' + realSendConsecutiveFailures)
      if (realSendConsecutiveFailures < 2) return
      console.warn('[whatsapp][WATCHDOG][BAND-AID] ' + realSendConsecutiveFailures + '+ falhas reais de envio (sendText) consecutivas com status=connected. Forcando fechar e reconectar o socket.')
      realSendConsecutiveFailures = 0
      const oldSock = sock
      try {
        if (oldSock && typeof oldSock.end === 'function') oldSock.end(new Error('watchdog forced restart'))
      } catch (e2) {
        console.error('[whatsapp][WATCHDOG][BAND-AID] erro ao encerrar socket antigo:', e2.message)
      }
      setTimeout(() => {
        if (connectionStatus !== 'connecting' && connectionStatus !== 'connected') {
          console.warn('[whatsapp][WATCHDOG][BAND-AID] close nao disparou reconexao sozinho, chamando startSocket() diretamente')
          startSocket().catch(e3 => console.error('[whatsapp][WATCHDOG][BAND-AID] erro no restart manual:', e3.message))
        }
      }, 15000)
    } catch (e) {
      console.error('[whatsapp][WATCHDOG][BAND-AID] erro no ciclo do watchdog:', e.message)
    }
  }, 60000)
  console.log('[whatsapp][WATCHDOG][BAND-AID] watchdog de saude da conexao ativado (checagem a cada 60s, baseado em falhas reais de envio)')
}
startConnectionWatchdog()
// ===== FIM BAND-AID =====

module.exports = { startSocket, getStatus, sendText, sendAudio, sendVideo, sendImage, sendDocument, ensureConversation, triggerWelcomeFlow, saveMessage, sendManualMessage, sendManualMedia, checkOnWhatsApp, sendAudioWithAck, handleIncomingText, handleOutgoingFromDevice, registerSessionManager, getSocketForConnection, forceReconnectConnection, withConversationLock, handleIncomingAudio, handleIncomingVideo, handleIncomingDocument, handleIncomingImage }
