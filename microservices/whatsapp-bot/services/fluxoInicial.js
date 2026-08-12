// Fluxo Inicial: quando um lead novo do Tintim entra no funil Inbound (pipeline_id=1,
// stage "Entrada" stage_id=1), manda mensagem de saudacao (10s depois de detectado) e o
// audio de abertura pre-gravado (45s depois da mensagem de texto). Idempotente via
// marcador em activities (type='fluxo_inicial_enviado'). Criado a pedido do Diego 2026-08-11.

const pool = require('../db')
const wa = require('./whatsapp')
const path = require('path')
const pushService = require('./pushService')

const POLL_INTERVAL_MS = 5 * 1000
const LOOKBACK_MINUTES = 30
const PIPELINE_ID = 1 // Inbound
const STAGE_ID = 1 // Entrada
const CONTATO_REALIZADO_STAGE_ID = 8 // Contato Realizado
const TEXT_DELAY_MS = 10 * 1000
const AUDIO_DELAY_AFTER_TEXT_MS = 45 * 1000
const FOLLOWUP_DELAY_MS = 5 * 60 * 1000
const SECOND_FOLLOWUP_DELAY_MS = 30 * 60 * 1000
const ACTIVITY_TYPE = 'fluxo_inicial_enviado'
const AUDIO_CATEGORY = 'Abertura'
const AUDIO_POSITION = 2

function saudacaoBrasilia() {
  const brMs = Date.now() - 3 * 60 * 60 * 1000
  const brDate = new Date(brMs)
  const minutesOfDay = brDate.getUTCHours() * 60 + brDate.getUTCMinutes()
  if (minutesOfDay >= 6 * 60 && minutesOfDay <= 12 * 60) return 'Bom dia'
  if (minutesOfDay > 12 * 60 && minutesOfDay <= 18 * 60 + 30) return 'Boa tarde'
  return 'Boa noite'
}

function firstName(fullName) {
  if (!fullName) return ''
  return String(fullName).trim().split(/\s+/)[0]
}

async function markSent(dealId) {
  await pool.query(
    'INSERT INTO activities (deal_id, type, content, created_at) VALUES (?, ?, ?, NOW())',
    [dealId, ACTIVITY_TYPE, 'fluxo inicial disparado automaticamente']
  )
}

async function alreadySent(dealId) {
  const [rows] = await pool.query(
    'SELECT id FROM activities WHERE deal_id = ? AND type = ? LIMIT 1',
    [dealId, ACTIVITY_TYPE]
  )
  return rows.length > 0
}

async function getAberturaAudio() {
  const [rows] = await pool.query(
    'SELECT id, content, file_name, mimetype FROM media_library WHERE category = ? AND position = ? LIMIT 1',
    [AUDIO_CATEGORY, AUDIO_POSITION]
  )
  return rows[0] || null
}

async function checkAndSendFollowup(conversationId, dealId, patientName) {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM whatsapp_messages WHERE conversation_id = ? AND direction = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND) LIMIT 1',
      [conversationId, 'in', Math.floor(FOLLOWUP_DELAY_MS / 1000)]
    )
    if (rows.length > 0) { await notifyLeadResponded(conversationId, dealId); return }
    const nome = firstName(patientName)
    const texto1 = nome + '? Ainda estou aqui, mas logo terei que deixar o telefone aqui.'
    const texto2 = 'Se puder responder eu consigo retornar ainda 😉'
    await wa.sendManualMessage(conversationId, texto1)
    await new Promise(r => setTimeout(r, 1500))
    await wa.sendManualMessage(conversationId, texto2)
    console.log('[fluxoInicial] followup enviado deal=' + dealId + ' conversation=' + conversationId)
    setTimeout(() => { checkAndSendSecondFollowup(conversationId, dealId, patientName).catch(() => {}) }, SECOND_FOLLOWUP_DELAY_MS)
  } catch (e) {
    console.error('[fluxoInicial] erro ao enviar followup deal=' + dealId + ':', e.message)
  }
}

async function checkAndSendSecondFollowup(conversationId, dealId, patientName) {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM whatsapp_messages WHERE conversation_id = ? AND direction = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND) LIMIT 1',
      [conversationId, 'in', Math.floor(SECOND_FOLLOWUP_DELAY_MS / 1000)]
    )
    if (rows.length > 0) { await notifyLeadResponded(conversationId, dealId); return }
    const t1 = 'Bom, vou avisar a minha consultora que voce entrou em contato querendo mais informacoes.'
    const t2 = 'Como voce nao respondeu, acredito que esteja meio na correria agora ne? Em breve ela vai te ligar.'
    const t3 = 'tem algum horario melhor pra falar contigo?'
    await wa.sendManualMessage(conversationId, t1)
    await new Promise(r => setTimeout(r, 1500))
    await wa.sendManualMessage(conversationId, t2)
    await new Promise(r => setTimeout(r, 1500))
    await wa.sendManualMessage(conversationId, t3)
    console.log('[fluxoInicial] segundo followup enviado deal=' + dealId + ' conversation=' + conversationId)
  } catch (e) {
    console.error('[fluxoInicial] erro ao enviar segundo followup deal=' + dealId + ':', e.message)
  }
}

async function notifyLeadResponded(conversationId, dealId) {
  try {
    const [[conv]] = await pool.query('SELECT patient_id, phone, contact_name FROM whatsapp_conversations WHERE id = ?', [conversationId])
    await pool.query(
      'INSERT INTO handoff_alerts (conversation_id, deal_id, patient_id, phone, lead_name, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [conversationId, dealId, conv ? conv.patient_id : null, conv ? conv.phone : null, (conv && conv.contact_name) || null]
    )
    console.log('[fluxoInicial] lead respondeu durante o fluxo, alerta de atendimento criado conversation=' + conversationId)
    if (dealId) {
      const [[deal]] = await pool.query('SELECT owner_name FROM deals WHERE id = ?', [dealId])
      if (deal && deal.owner_name) {
        const leadName = (conv && conv.contact_name) || 'Lead'
        pushService.sendPushToUserByName(deal.owner_name, {
          title: 'Lead respondeu: ' + leadName,
          body: 'O lead respondeu durante o fluxo automatico e aguarda atendimento.',
          url: '/whatsapp.html?conv=' + conversationId
        }).catch(() => {})
      }
    }
  } catch (e) {
    console.error('[fluxoInicial] erro ao criar handoff_alert deal=' + dealId + ':', e.message)
  }
}

async function sendGreetingAndAudio({ dealId, conversationId, patientName }) {
  try {
    const saudacao = saudacaoBrasilia()
    const nome = firstName(patientName)
    const texto1 = saudacao + ' ' + nome + ', tudo bem? 😊'
    const texto2 = 'Aqui é o Dr. Diego... peraí que vou te mandar um áudio sobre sua pergunta'
    await wa.sendManualMessage(conversationId, texto1)
    if (dealId) {
      try {
        await pool.query("INSERT INTO activities (deal_id, type, content, created_at) VALUES (?, ?, ?, NOW())", [dealId, ACTIVITY_TYPE, 'envio automatico do fluxo inicial'])
        await pool.query('UPDATE deals SET stage_id = ?, stage_entered_at = NOW() WHERE id = ?', [CONTATO_REALIZADO_STAGE_ID, dealId])
        await pool.query("INSERT INTO activities (deal_id, type, content, created_at) VALUES (?, ?, ?, NOW())", [dealId, ACTIVITY_TYPE, 'mudanca automatica para deal stage contato realizado'])
      } catch (e) {
        console.error('[fluxoInicial] erro ao mover deal para Contato Realizado deal=' + dealId + ':', e.message)
      }
    }
    await new Promise(r => setTimeout(r, 1500))
    await wa.sendManualMessage(conversationId, texto2)
    wa.sendRecordingPresence(conversationId, Math.max(AUDIO_DELAY_AFTER_TEXT_MS - 1500, 1000)).catch(() => {})
    console.log('[fluxoInicial] texto enviado deal=' + dealId + ' conversation=' + conversationId)
  } catch (e) {
    console.error('[fluxoInicial] erro ao enviar texto deal=' + dealId + ':', e.message)
  }

  setTimeout(async () => {
    try {
      const [respRows] = await pool.query(
        'SELECT id FROM whatsapp_messages WHERE conversation_id = ? AND direction = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND) LIMIT 1',
        [conversationId, 'in', Math.floor(AUDIO_DELAY_AFTER_TEXT_MS / 1000)]
      )
      if (respRows.length > 0) {
        await notifyLeadResponded(conversationId, dealId)
        return
      }
      const audio = await getAberturaAudio()
      if (!audio || !audio.content) {
        console.error('[fluxoInicial] audio de abertura nao encontrado (categoria=' + AUDIO_CATEGORY + ' posicao=' + AUDIO_POSITION + '), pulando envio deal=' + dealId)
        return
      }
      const fullPath = path.join(__dirname, '..', audio.content)
      await wa.sendManualMedia(conversationId, fullPath, 'audio', {
        fileName: audio.file_name || 'audio.ogg'
      })
      await pool.query('UPDATE media_library SET usage_count = usage_count + 1 WHERE id = ?', [audio.id])
      console.log('[fluxoInicial] audio enviado deal=' + dealId + ' conversation=' + conversationId)
      setTimeout(() => { checkAndSendFollowup(conversationId, dealId, patientName).catch(() => {}) }, FOLLOWUP_DELAY_MS)
    } catch (e) {
      console.error('[fluxoInicial] erro ao enviar audio deal=' + dealId + ':', e.message)
    }
  }, AUDIO_DELAY_AFTER_TEXT_MS)
}

async function processNewLeads() {
  try {
    const [rows] = await pool.query(
      'SELECT d.id AS deal_id, d.patient_id, wc.id AS conversation_id, p.name AS patient_name ' +
      'FROM deals d ' +
      'JOIN patients p ON p.id = d.patient_id ' +
      'JOIN whatsapp_conversations wc ON wc.deal_id = d.id ' +
      'WHERE d.pipeline_id = ? AND d.stage_id = ? ' +
      'AND d.stage_entered_at >= (NOW() - INTERVAL ? MINUTE) ' +
      " AND NOT EXISTS (SELECT 1 FROM deals d2 WHERE d2.patient_id = d.patient_id AND d2.id <> d.id) " +
      " AND p.created_at >= (d.stage_entered_at - INTERVAL 5 MINUTE) " +
      'ORDER BY d.stage_entered_at ASC LIMIT 20',
      [PIPELINE_ID, STAGE_ID, LOOKBACK_MINUTES]
    )
    for (const row of rows) {
      const already = await alreadySent(row.deal_id)
      if (already) continue
      await markSent(row.deal_id)
      console.log('[fluxoInicial] novo lead detectado deal=' + row.deal_id + ' conversation=' + row.conversation_id + ', agendando envio')
      setTimeout(() => {
        sendGreetingAndAudio({ dealId: row.deal_id, conversationId: row.conversation_id, patientName: row.patient_name })
      }, TEXT_DELAY_MS)
    }
  } catch (e) {
    console.error('[fluxoInicial] erro no polling:', e.message)
  }
}

let intervalHandle = null
function start() {
  if (intervalHandle) return
  intervalHandle = setInterval(processNewLeads, POLL_INTERVAL_MS)
  console.log('[fluxoInicial] iniciado, poll a cada', POLL_INTERVAL_MS, 'ms')
}

// Disparo manual/teste: envia a sequencia direto pra uma conversa, sem esperar lead novo.
async function testTrigger(conversationId, patientName) {
  await sendGreetingAndAudio({ dealId: null, conversationId, patientName: patientName || 'Diego' })
}

module.exports = { start, testTrigger, saudacaoBrasilia, firstName }
