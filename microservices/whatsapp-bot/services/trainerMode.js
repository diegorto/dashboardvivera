// Modo treinador via WhatsApp: numeros ja cadastrados em ai_chatbot_allowlist podem
// corrigir o comportamento da Vivi mandando o emoji de lagosta seguido da correcao.
// A IA rascunha uma proposta de edicao pontual (before -> after) no system_prompt e
// pede confirmacao (1/2) antes de aplicar. Nao cria allowlist propria - reusa a
// ai_chatbot_allowlist que ja existe (piloto).
//
// REESCRITO em 2026-08-05 (2a vez) apos bug real em producao: o teste ao vivo do
// Diego (lagosta sozinho, "Entendeu o que?", "Entao voce esta no modo treinador?", audio
// de 41s, pedido explicito de correcao do Exojet) mostrou ZERO das 6 interacoes
// sendo tratadas pelo modo treinador - tudo caiu no atendimento normal da IA
// (ai.generateReply), que ate hallucinou uma resposta de "quero melhorar minha
// capacidade de entender contextos" e confirmou falsamente "Claro!" estar no modo
// treinador. Causa raiz encontrada nos logs de producao: a versao anterior guardava
// o estado "pendente" APENAS no Redis (getPending() chamando redis.get() sem
// try/catch nenhum, nem em getPending() nem em maybeHandle()). O log de erro real
// mostrou "[whatsapp] erro no modo treinador: Connection Closed" - uma excecao do
// Redis (ou do socket) escapando de maybeHandle() inteiro. Quando isso acontece,
// trainerHandled fica undefined em whatsapp.js e o fluxo cai, sem querer, pro
// atendimento normal de IA (exatamente o sintoma relatado).
//
// FIX: o estado do modo treinador agora mora em colunas de whatsapp_conversations
// (training_mode_active, training_mode_stage, training_mode_proposal_id,
// training_mode_updated_at) - a MESMA linha `conv` que ja e carregada via SELECT *
// em ensureConversation() antes de maybeHandle() ser chamado. Ou seja: a checagem
// "essa conversa esta em modo treinador?" e feita em memoria, com ZERO chamadas de
// I/O, e portanto NUNCA pode lancar uma excecao antes mesmo de decidir se a
// mensagem pertence ao modo treinador. Isso elimina essa classe inteira de bug por
// design. ai.generateReply NUNCA e chamado quando training_mode_active = 1, porque
// maybeHandle() sempre retorna true nesse caso e handleIncomingText() retorna cedo.
const pool = require('../db')
const ai = require('./ai')
const allowlist = require('./allowlist')

const LOBSTER = '\u{1F99E}' // emoji de lagosta (gatilho do modo treinador)
const TIMEOUT_MINUTES = 30 // depois disso o estado pendente expira e volta pro atendimento normal

function isTrigger(text) {
  return typeof text === 'string' && text.trim().startsWith(LOBSTER)
}

function extractCorrection(text) {
  const trimmed = text.trim()
  return trimmed.slice(LOBSTER.length).trim()
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toFlexibleRegex(needle) {
  const escaped = escapeRegExp(needle).replace(/\s+/g, '\\s+')
  return new RegExp(escaped, 'g')
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0
  const re = toFlexibleRegex(needle)
  const matches = haystack.match(re)
  return matches ? matches.length : 0
}

function findExactMatch(haystack, needle) {
  if (!needle) return null
  const re = toFlexibleRegex(needle)
  const m = re.exec(haystack)
  return m ? m[0] : null
}

// Deteccao simples e deterministica de pergunta meta sobre o proprio estado
// ("voce esta no modo treinador?"). Isso e respondido com base no valor REAL da
// flag (o fato de handleAwaitingCorrection/handleAwaitingConfirmation so serem
// chamados quando training_mode_active=1 ja garante isso), nunca improvisado pela
// IA generica.
function isMetaModeQuestion(text) {
  const t = (text || '').toLowerCase()
  return /modo\s+treinador/.test(t) && /[?]|esta(\s+ativo)?$|está(\s+ativo)?$|voce ta|você tá/.test(t.trim())
}

async function setState(conversationId, patch) {
  const fields = []
  const values = []
  for (const k of Object.keys(patch)) { fields.push(k + ' = ?'); values.push(patch[k]) }
  fields.push('training_mode_updated_at = NOW()')
  values.push(conversationId)
  await pool.query('UPDATE whatsapp_conversations SET ' + fields.join(', ') + ' WHERE id = ?', values)
}

async function clearState(conversationId) {
  await pool.query(
    'UPDATE whatsapp_conversations SET training_mode_active = 0, training_mode_stage = NULL, training_mode_proposal_id = NULL, training_mode_updated_at = NOW() WHERE id = ?',
    [conversationId]
  )
}

function isTimedOut(conv) {
  if (!conv.training_mode_updated_at) return false
  const updated = new Date(conv.training_mode_updated_at).getTime()
  if (Number.isNaN(updated)) return false
  return (Date.now() - updated) > TIMEOUT_MINUTES * 60 * 1000
}

// Envia uma mensagem via WhatsApp sem deixar falha de socket (ex: "Connection Closed"
// durante uma reconexao do Baileys) escapar e derrubar o fluxo do modo treinador.
async function safeSend(sendFn, jid, msg) {
  try {
    await sendFn(jid, msg)
  } catch (e) {
    console.error('[trainerMode] erro ao enviar mensagem via WhatsApp:', e.message)
  }
}

// Tenta gerar uma proposta com "before" que bata exatamente 1x no prompt atual.
// Faz ate 2 tentativas, passando feedback pro modelo se a primeira nao bater certo.
async function draftWithVerification(currentPrompt, correctionText) {
  let lastReason = null
  for (let attempt = 0; attempt < 2; attempt++) {
    let proposal
    try {
      proposal = await ai.draftTrainerProposal(currentPrompt, correctionText, lastReason)
    } catch (e) {
      console.error('[trainerMode] erro ao chamar draftTrainerProposal:', e.message)
      return null
    }
    if (!proposal || !proposal.before) {
      lastReason = 'o campo "before" veio vazio (a instrucao pode estar ambigua ou sem trecho correspondente no prompt)'
      continue
    }
    const occurrences = countOccurrences(currentPrompt, proposal.before)
    if (occurrences === 1) return proposal
    lastReason = occurrences === 0
      ? 'o texto retornado em "before" nao foi encontrado literalmente (verbatim) no prompt atual'
      : ('o texto retornado em "before" ocorre ' + occurrences + ' vezes no prompt atual (precisa ocorrer exatamente 1 vez)')
  }
  return null
}

// Rascunha a proposta de mudanca a partir de um texto de correcao ja extraido (seja de
// uma mensagem "lagosta + correcao" direta, seja de uma correcao mandada em resposta ao
// pedido de "manda a correcao", seja de um audio transcrito). Usado por todos os fluxos
// de entrada. Chama SOMENTE ai.draftTrainerProposal (chamada estreita, especializada em
// editar o prompt) - nunca ai.generateReply (o chat generico).
async function proposeChange(conv, phone, correction, sendFn, jid) {
  let cfg
  let currentPrompt
  try {
    cfg = await ai.getConfig()
    currentPrompt = cfg.system_prompt || ''
  } catch (e) {
    console.error('[trainerMode] erro ao carregar system_prompt:', e.message)
    await safeSend(sendFn, jid, 'Modo treinador: deu erro ao carregar o prompt atual (' + e.message + '). Tenta de novo em instantes.')
    return
  }

  const proposal = await draftWithVerification(currentPrompt, correction)

  if (!proposal) {
    try { await setState(conv.id, { training_mode_active: 1, training_mode_stage: 'awaiting_correction', training_mode_proposal_id: null }) } catch (e) { console.error('[trainerMode] erro ao atualizar estado:', e.message) }
    await safeSend(sendFn, jid, 'Modo treinador: nao consegui identificar uma mudanca especifica no prompt a partir disso - pode descrever de outro jeito o que voce quer mudar?')
    return
  }

  let proposalId
  try {
    const [result] = await pool.query(
      'INSERT INTO prompt_proposals (diff, evidencia, status, phone, conversation_id, before_text, after_text, rationale) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['- ' + proposal.before + '\n+ ' + proposal.after, correction, 'pendente', phone, conv.id, proposal.before, proposal.after, proposal.rationale || '']
    )
    proposalId = result.insertId
  } catch (e) {
    console.error('[trainerMode] erro ao salvar proposta:', e.message)
    await safeSend(sendFn, jid, 'Modo treinador: deu erro ao salvar a proposta (' + e.message + '). Tenta de novo em instantes.')
    return
  }

  try {
    await setState(conv.id, { training_mode_active: 1, training_mode_stage: 'awaiting_confirmation', training_mode_proposal_id: proposalId })
  } catch (e) {
    console.error('[trainerMode] erro ao atualizar estado apos criar proposta:', e.message)
  }

  const msg = [
    'Modo treinador - proposta de mudanca no prompt da Vivi:',
    '',
    'ANTES:',
    proposal.before,
    '',
    'DEPOIS:',
    proposal.after,
    '',
    'Motivo: ' + (proposal.rationale || '(sem motivo informado)'),
    '',
    'Responde 1 pra aplicar ou 2 pra cancelar.'
  ].join('\n')
  await safeSend(sendFn, jid, msg)
}

// Mensagem que acionou o gatilho (comeca com o emoji de lagosta), vinda de numero
// autorizado, sem modo treinador ja ativo nessa conversa.
async function handleTriggerMessage(conv, phone, text, sendFn, jid) {
  const correction = extractCorrection(text)

  if (!correction) {
    // Lagosta sozinho (ou so espacos depois): ativa o estado e responde com um
    // template FIXO, deterministico - nunca gerado por LLM, entao nunca pode
    // "confirmar" o estado errado.
    try {
      await setState(conv.id, { training_mode_active: 1, training_mode_stage: 'awaiting_correction', training_mode_proposal_id: null })
    } catch (e) {
      console.error('[trainerMode] erro ao ativar modo treinador:', e.message)
    }
    await safeSend(sendFn, jid, LOBSTER + ' Modo treinador ativado. Me conta o que voce quer ajustar (pode ser por texto ou audio).')
    return
  }

  try {
    await setState(conv.id, { training_mode_active: 1, training_mode_stage: 'awaiting_correction', training_mode_proposal_id: null })
  } catch (e) {
    console.error('[trainerMode] erro ao ativar modo treinador:', e.message)
  }
  await proposeChange(conv, phone, correction, sendFn, jid)
}

// Conversa ja esta em modo treinador, esperando o texto (ou audio ja transcrito)
// da correcao. Aceita tanto texto puro quanto uma nova mensagem que comeca com o
// emoji. Meta-perguntas sobre o proprio estado sao respondidas de forma
// deterministica, sem consumir a correcao esperada.
async function handleAwaitingCorrection(conv, phone, text, sendFn, jid) {
  if (isMetaModeQuestion(text)) {
    await safeSend(sendFn, jid, 'Sim, voce esta no modo treinador ' + LOBSTER + '. Pode mandar a correcao que voce quer ensinar pra Vivi (texto ou audio).')
    return
  }

  const correction = isTrigger(text) ? extractCorrection(text) : (text || '').trim()

  if (!correction) {
    await safeSend(sendFn, jid, 'Modo treinador: ainda estou esperando a correcao. Manda o texto (ou audio) explicando o que a Vivi deveria fazer diferente.')
    return
  }

  await proposeChange(conv, phone, correction, sendFn, jid)
}

// Conversa em modo treinador com uma proposta pendente de confirmacao (1/2).
async function handleAwaitingConfirmation(conv, phone, text, sendFn, jid) {
  if (isMetaModeQuestion(text)) {
    await safeSend(sendFn, jid, 'Sim, voce esta no modo treinador ' + LOBSTER + ', com uma proposta esperando confirmacao. Responde 1 pra aplicar ou 2 pra cancelar.')
    return
  }

  const trimmed = (text || '').trim()
  const proposalId = conv.training_mode_proposal_id

  let row
  try {
    const [[r]] = await pool.query('SELECT * FROM prompt_proposals WHERE id = ?', [proposalId])
    row = r
  } catch (e) {
    console.error('[trainerMode] erro ao buscar proposta pendente:', e.message)
    try { await clearState(conv.id) } catch (e2) { console.error('[trainerMode] erro ao limpar estado:', e2.message) }
    await safeSend(sendFn, jid, 'Modo treinador: deu erro ao consultar a proposta pendente, cancelei por seguranca. Manda o emoji de lagosta de novo se quiser tentar de novo.')
    return
  }

  if (!row || row.status !== 'pendente') {
    try { await clearState(conv.id) } catch (e) { console.error('[trainerMode] erro ao limpar estado:', e.message) }
    await safeSend(sendFn, jid, 'Modo treinador: essa proposta ja nao esta mais pendente. Manda o emoji de lagosta de novo se quiser propor outra mudanca.')
    return
  }

  if (trimmed === '1') {
    try {
      const cfg = await ai.getConfig()
      const currentPrompt = cfg.system_prompt || ''
      const occurrences = countOccurrences(currentPrompt, row.before_text)
      if (occurrences !== 1) {
        await pool.query('UPDATE prompt_proposals SET status = ?, decided_at = NOW() WHERE id = ?', ['rejeitada', proposalId])
        await clearState(conv.id)
        await safeSend(sendFn, jid, 'Modo treinador: o prompt mudou desde que essa proposta foi criada (o trecho "antes" nao bate mais exatamente com o texto atual), entao cancelei essa proposta por seguranca. Manda o emoji de lagosta de novo com a correcao pra eu gerar uma proposta atualizada.')
        return
      }

      const actualBefore = findExactMatch(currentPrompt, row.before_text) || row.before_text
      const newPrompt = currentPrompt.replace(actualBefore, row.after_text)
      const [updateResult] = await pool.query(
        'UPDATE chatbot_ai_config SET config_value = ? WHERE config_key = ?',
        [newPrompt, 'system_prompt']
      )

      if (!updateResult.affectedRows) {
        await safeSend(sendFn, jid, 'Modo treinador: falha ao salvar a mudanca (nenhuma linha afetada no banco). Nada foi alterado. Avisa o Diego.')
        return
      }

      let versionConfirmed = false
      try {
        const [[versionRow]] = await pool.query(
          'SELECT * FROM chatbot_config_versions WHERE config_key = ? ORDER BY id DESC LIMIT 1',
          ['system_prompt']
        )
        versionConfirmed = !!(versionRow && versionRow.new_value === newPrompt)
      } catch (e) {
        console.error('[trainerMode] erro ao conferir versionamento:', e.message)
      }

      await pool.query('UPDATE prompt_proposals SET status = ?, decided_at = NOW() WHERE id = ?', ['aprovada', proposalId])
      await clearState(conv.id)

      await safeSend(sendFn, jid, [
        'Modo treinador: mudanca aplicada com sucesso' + (versionConfirmed ? ' (registrada no historico de versoes).' : ' (aviso: nao consegui confirmar o registro no historico de versoes, mas a mudanca foi salva).'),
        '',
        'ANTES: ' + row.before_text,
        'DEPOIS: ' + row.after_text
      ].join('\n'))
    } catch (e) {
      console.error('[trainerMode] erro ao aplicar proposta:', e.message)
      await safeSend(sendFn, jid, 'Modo treinador: deu erro ao aplicar a mudanca, nada foi confirmado como salvo - avisa o Diego. Erro: ' + e.message)
    }
    return
  }

  if (trimmed === '2') {
    try {
      await pool.query('UPDATE prompt_proposals SET status = ?, decided_at = NOW() WHERE id = ?', ['rejeitada', proposalId])
    } catch (e) {
      console.error('[trainerMode] erro ao marcar proposta como rejeitada:', e.message)
    }
    await clearState(conv.id)
    await safeSend(sendFn, jid, 'Modo treinador: proposta cancelada, nada foi alterado.')
    return
  }

  await safeSend(sendFn, jid, 'Modo treinador: responde 1 pra aplicar ou 2 pra cancelar a proposta pendente.')
}

// Ponto de entrada unico, chamado no inicio de handleIncomingText em whatsapp.js -
// ANTES de qualquer chamada a ai.generateReply (o chat generico). A checagem
// primaria (conv.training_mode_active) usa dados que ja vieram no SELECT * de
// ensureConversation, entao roda em memoria, sem I/O, e nunca pode lancar excecao
// antes de decidir se a mensagem pertence ao modo treinador.
async function maybeHandle(conv, phone, text, sendFn, jid) {
  if (conv && conv.training_mode_active) {
    if (isTimedOut(conv)) {
      try { await clearState(conv.id) } catch (e) { console.error('[trainerMode] erro ao limpar estado expirado:', e.message) }
      // cai para a checagem de gatilho normal abaixo (trata como conversa nova)
    } else {
      try {
        if (conv.training_mode_stage === 'awaiting_confirmation') {
          await handleAwaitingConfirmation(conv, phone, text, sendFn, jid)
        } else {
          await handleAwaitingCorrection(conv, phone, text, sendFn, jid)
        }
      } catch (e) {
        console.error('[trainerMode] erro processando resposta em modo treinador:', e.message)
      }
      return true
    }
  }

  if (!isTrigger(text)) return false

  let authorized = false
  try {
    authorized = await allowlist.isAllowlisted(phone)
  } catch (e) {
    console.error('[trainerMode] erro checando allowlist:', e.message)
    return false
  }
  if (!authorized) return false

  // A partir daqui a mensagem PERTENCE ao modo treinador: mesmo que algo falhe
  // (envio via WhatsApp, DB, chamada a IA), maybeHandle sempre retorna true pra
  // garantir que nunca caia pro atendimento normal de lead por baixo.
  try {
    await handleTriggerMessage(conv, phone, text, sendFn, jid)
  } catch (e) {
    console.error('[trainerMode] erro no gatilho do modo treinador:', e.message)
  }
  return true
}

module.exports = { maybeHandle, isTrigger, extractCorrection, countOccurrences, findExactMatch, isMetaModeQuestion, LOBSTER }
