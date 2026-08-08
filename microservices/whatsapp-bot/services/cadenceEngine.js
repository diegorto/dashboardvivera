// Motor de automacao da Cadencia de reengajamento.
// D+1 -> D+2 -> D+3 -> D+4 -> D+5 -> (15 dias) -> D+15/Despedida -> (30 dias) -> handoff Fluxo Mensal (RMKT).
// Gated por chatbot_flows.trigger_keyword = 'fluxo_cadencia_inbound' (is_active).
// Continua DESLIGADO ate o Diego mandar ligar explicitamente.

const pool = require('../db')
const wa = require('./whatsapp')
const path = require('path')

const TRIGGER_KEYWORD = 'fluxo_cadencia_inbound'
const POLL_INTERVAL_MS = 60 * 1000 // 1 min (era 15min; quase-tempo-real via trigger stage_history)
const CADENCE_BURST_MAX = 15 // regra permanente Diego 2026-08-07: nunca mais que 15 msgs de cadencia em qualquer janela de 5min
const CADENCE_BURST_WINDOW_MINUTES = 5

const STEP_STAGE_ID = { d1: 3, d2: 4, d3: 5, d4: 6, d5: 7 }
const STEP_PIPELINE_ID = { d1: 1, d2: 1, d3: 1, d4: 1, d5: 1, d15_despedida: 5 }
const STEP_ORDER = ['d1', 'd2', 'd3', 'd4', 'd5', 'd15_despedida', 'handoff_done']
const STEP_GAP_DAYS = { d2: 1, d3: 1, d4: 1, d5: 1, d15_despedida: 15, handoff_done: 30 }

const RMKT_INTERESSE_STAGE_ID = 25
const RMKT_PIPELINE_ID = 5
const MIN_HOUR = 8
const MAX_HOUR = 20
const BUDGET_MIN_HOUR_BRT = 8
const BUDGET_MAX_HOUR_BRT = 22

async function isEngineActive() {
  const [[row]] = await pool.query('SELECT is_active FROM chatbot_flows WHERE trigger_keyword = ? LIMIT 1', [TRIGGER_KEYWORD])
  return !!(row && row.is_active)
}

async function getCfg(key) {
  const [[row]] = await pool.query('SELECT config_value FROM chatbot_ai_config WHERE config_key = ?', [key])
  return row ? row.config_value : null
}

async function setCfg(key, value) {
  await pool.query(
    'INSERT INTO chatbot_ai_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)',
    [key, value]
  )
}

async function getBRTNowParts() {
  const [[row]] = await pool.query(
    "SELECT DATE_FORMAT(CONVERT_TZ(NOW(),'+00:00','-03:00'), '%Y-%m-%d') d, " +
    "HOUR(CONVERT_TZ(NOW(),'+00:00','-03:00')) h, " +
    "MINUTE(CONVERT_TZ(NOW(),'+00:00','-03:00')) mi"
  )
  return row
}

async function getDailyBudgetCfg() {
  const maxSendsDay = parseInt(await getCfg('cadence_max_sends_per_day')) || 200
  const maxEnrollsDay = parseInt(await getCfg('cadence_max_enrolls_per_day')) || 150
  const minGapSec = parseInt(await getCfg('cadence_min_gap_between_leads_seconds')) || 90
  return { maxSendsDay, maxEnrollsDay, minGapSec }
}

function ticksRestantesNaJanela(h, mi) {
  if (h >= BUDGET_MAX_HOUR_BRT) return 1
  const minutosRestantes = (BUDGET_MAX_HOUR_BRT - h) * 60 - mi
  return Math.max(1, Math.ceil(minutosRestantes / (POLL_INTERVAL_MS / 60000)))
}

async function getSendBudgetForThisTick() {
  const { h, mi } = await getBRTNowParts()
  if (h < BUDGET_MIN_HOUR_BRT || h >= BUDGET_MAX_HOUR_BRT) {
    return { budget: 0, reason: 'fora da janela ' + BUDGET_MIN_HOUR_BRT + 'h-' + BUDGET_MAX_HOUR_BRT + 'h BRT' }
  }
  const { maxSendsDay } = await getDailyBudgetCfg()
  const [[row]] = await pool.query(
    "SELECT COUNT(*) c FROM chatbot_cadence_enrollment WHERE last_sent_at IS NOT NULL AND " +
    "DATE(CONVERT_TZ(last_sent_at,'+00:00','-03:00')) = DATE(CONVERT_TZ(NOW(),'+00:00','-03:00'))"
  )
  const enviadosHoje = row.c
  const restanteHoje = Math.max(0, maxSendsDay - enviadosHoje)
  if (restanteHoje === 0) return { budget: 0, reason: 'orcamento diario de envios esgotado (' + maxSendsDay + '/dia)' }
  const ticks = ticksRestantesNaJanela(h, mi)
  const perTickCfg = parseInt(await getCfg('cadence_max_sends_per_tick')) || 10
  const budget = Math.min(perTickCfg, Math.ceil(restanteHoje / ticks))
  return { budget, reason: null, enviadosHoje, restanteHoje, ticks }
}

async function getEnrollBudgetForThisTick() {
  const { h, mi } = await getBRTNowParts()
  if (h < BUDGET_MIN_HOUR_BRT || h >= BUDGET_MAX_HOUR_BRT) {
    return { budget: 0, reason: 'fora da janela ' + BUDGET_MIN_HOUR_BRT + 'h-' + BUDGET_MAX_HOUR_BRT + 'h BRT' }
  }
  const { maxEnrollsDay } = await getDailyBudgetCfg()
  const [[row]] = await pool.query(
    "SELECT COUNT(*) c FROM chatbot_cadence_enrollment WHERE " +
    "DATE(CONVERT_TZ(created_at,'+00:00','-03:00')) = DATE(CONVERT_TZ(NOW(),'+00:00','-03:00'))"
  )
  const matriculadosHoje = row.c
  const restanteHoje = Math.max(0, maxEnrollsDay - matriculadosHoje)
  if (restanteHoje === 0) return { budget: 0, reason: 'orcamento diario de matriculas esgotado (' + maxEnrollsDay + '/dia)' }
  const ticks = ticksRestantesNaJanela(h, mi)
  const perTickCfg = parseInt(await getCfg('cadence_max_enrolls_per_tick')) || 20
  const budget = Math.min(perTickCfg, Math.ceil(restanteHoje / ticks))
  return { budget, reason: null, matriculadosHoje, restanteHoje, ticks }
}

async function getDealAndPatient(dealId) {
  const [[row]] = await pool.query(
    'SELECT d.id, d.stage_id, d.pipeline_id, d.owner_name, d.tags, d.first_contact_time, ' +
    'd.sdr_user_id, d.professional_id, p.name AS patient_name, p.phone AS patient_phone ' +
    'FROM deals d LEFT JOIN patients p ON p.id = d.patient_id WHERE d.id = ?',
    [dealId]
  )
  return row || null
}

async function resolveJid(phone, sockOverride) {
  if (!phone) return null
  if (phone.includes('@')) return phone
  try {
    const results = await wa.checkOnWhatsApp(phone, sockOverride)
    if (results && results[0] && results[0].jid) return results[0].jid
  } catch (e) {
    console.warn('[cadenceEngine] falha ao resolver onWhatsApp para ' + phone + ': ' + e.message)
  }
  return phone.replace(/\D/g, '') + '@s.whatsapp.net'
}

async function getCadenceSocket() {
  try {
    const flowConn = await require('./connectionsStore').getFlowConnection(TRIGGER_KEYWORD)
    return flowConn ? wa.getSocketForConnection(flowConn.id) : undefined
  } catch (e) {
    console.warn('[cadenceEngine] falha ao resolver conexao do fluxo, usando socket legado:', e.message)
    return undefined
  }
}

function applyPlaceholders(text, deal) {
  const nome = (deal.patient_name && deal.patient_name !== '.') ? deal.patient_name.split(' ')[0] : ''
  const owner = deal.owner_name || ''
  return String(text || '').split('{nome}').join(nome).split('{owner}').join(owner)
}

async function sendTextBubbles(rawContent, deal, jid) {
  if (!rawContent) return false
  const sockOverride = await getCadenceSocket()
  const parts = rawContent.includes('|||') ? rawContent.split('|||').map(p => p.trim()).filter(Boolean) : [rawContent]
  for (const part of parts) {
    await wa.sendText(jid, applyPlaceholders(part, deal), sockOverride)
    await new Promise(r => setTimeout(r, 900))
  }
  return true
}

// ---- horario: evita repetir sempre a mesma hora quando o lead nao responde ----

async function getGlobalBestResponseHourBRT() {
  const cached = await getCfg('cadence_best_response_hour_global')
  const cachedAt = await getCfg('cadence_best_response_hour_calculated_at')
  const oneDayMs = 24 * 60 * 60 * 1000
  if (cached != null && cachedAt && (Date.now() - new Date(cachedAt).getTime()) < oneDayMs) {
    return parseInt(cached, 10)
  }
  const [rows] = await pool.query(
    "SELECT HOUR(CONVERT_TZ(created_at, '+00:00','-03:00')) h, COUNT(*) c " +
    "FROM whatsapp_messages WHERE direction='in' GROUP BY h ORDER BY c DESC LIMIT 1"
  )
  const hour = (rows && rows[0]) ? rows[0].h : 11
  await setCfg('cadence_best_response_hour_global', String(hour))
  await setCfg('cadence_best_response_hour_calculated_at', new Date().toISOString())
  return hour
}

async function pickNextHourBRT(deal, lastAttemptHour) {
  const candidates = []
  if (deal.first_contact_time) {
    const d = new Date(deal.first_contact_time)
    const hourBRT = (d.getUTCHours() + 21) % 24 // UTC -> BRT (UTC-3)
    candidates.push(hourBRT)
  }
  candidates.push(await getGlobalBestResponseHourBRT())
  for (const h of candidates) {
    const clamped = Math.min(Math.max(h, MIN_HOUR), MAX_HOUR)
    if (lastAttemptHour == null || clamped !== lastAttemptHour) return clamped
  }
  let h = (lastAttemptHour != null ? lastAttemptHour : MIN_HOUR) + 3
  if (h > MAX_HOUR) h = MIN_HOUR
  return h
}

function fireAtFromDayAndHourBRT(baseDate, dayOffset, hourBRT) {
  const d = new Date(baseDate)
  d.setUTCDate(d.getUTCDate() + dayOffset)
  const hourUTC = (hourBRT + 3) % 24
  d.setUTCHours(hourUTC, 0, 0, 0)
  return d
}

// ---- enrollment automatico a partir do estagio atual do deal ----


const D5_STAGE_ID = 7
const DESPEDIDA_DELAY_DAYS = 15

async function checkAndSendDespedida(sockOverride) {
  try {
    const [rows] = await pool.query(
      "SELECT d.id AS deal_id, d.stage_tag, wc.id AS conv_id, wc.wa_jid, wc.phone " +
      "FROM deals d JOIN whatsapp_conversations wc ON wc.deal_id = d.id " +
      "WHERE d.stage_id = ? AND d.stage_entered_at <= (NOW() - INTERVAL ? DAY) AND wc.cadence_enabled = 1 " +
      "AND NOT EXISTS (SELECT 1 FROM whatsapp_messages wm WHERE wm.conversation_id = wc.id AND wm.direction = 'in' AND wm.created_at > d.stage_entered_at)",
      [D5_STAGE_ID, DESPEDIDA_DELAY_DAYS]
    )
    for (const row of rows) {
      const tag = row.stage_tag || ''
      if ((',' + tag + ',').indexOf(',d15_despedida,') !== -1) continue
      const jid = row.wa_jid || await resolveJid(row.phone, sockOverride)
      if (!jid) continue
      try {
        await sendStepContentResilient('d15_despedida', { id: row.deal_id, patient_phone: row.phone }, jid)
        const newTag = tag ? (tag + ',d15_despedida') : 'd15_despedida'
        await pool.query('UPDATE deals SET stage_tag = ? WHERE id = ?', [newTag, row.deal_id])
      } catch (e) {
        console.error('[cadenceEngine] erro ao enviar despedida D+15 deal_id=' + row.deal_id + ':', e.message)
      }
    }
  } catch (e) {
    console.error('[cadenceEngine] erro em checkAndSendDespedida:', e.message)
  }
}

async function autoEnrollNewDeals() {
  const stageIds = Object.values(STEP_STAGE_ID)
  const placeholders = stageIds.map(() => '?').join(',')
  const [deals] = await pool.query(
    'SELECT id, stage_id, stage_entered_at FROM deals WHERE stage_id IN (' + placeholders + ') ' +
    'AND id NOT IN (SELECT deal_id FROM chatbot_cadence_enrollment) ' +
        'AND id IN (SELECT deal_id FROM whatsapp_conversations WHERE cadence_enabled = 1)',
    stageIds
  )
  const enrollBudget = await getEnrollBudgetForThisTick()
  let enrollsUsedThisTick = 0
  if (enrollBudget.budget === 0) console.log('[cadenceEngine] auto-enroll pausado: ' + (enrollBudget.reason || 'sem orcamento'))
  for (const deal of deals) {
    const step = Object.keys(STEP_STAGE_ID).find(k => STEP_STAGE_ID[k] === deal.stage_id)
    if (!step) continue
    if (enrollsUsedThisTick >= enrollBudget.budget) break
    const stepStart = deal.stage_entered_at || new Date()
    await pool.query(
      "INSERT INTO chatbot_cadence_enrollment (deal_id, status, current_step, step_started_at, next_fire_at) " +
      "VALUES (?, 'active', ?, ?, ?)",
      [deal.id, step, stepStart, stepStart]
    )
    console.log('[cadenceEngine] auto-enroll deal ' + deal.id + ' no passo ' + step)
    enrollsUsedThisTick++
  }
}

// ---- deteccao de resposta do lead durante a cadencia ----

async function notifyOwner(dealId, type, message) {
  const deal = await getDealAndPatient(dealId)
  const ownerUserId = deal ? (deal.sdr_user_id || deal.professional_id) : null
  if (!ownerUserId) return
  await pool.query(
    'INSERT INTO owner_notifications (owner_user_id, deal_id, type, message) VALUES (?,?,?,?)',
    [ownerUserId, dealId, type, message]
  )
}

async function detectResponses() {
  const [rows] = await pool.query(
    "SELECT id, deal_id, last_sent_at FROM chatbot_cadence_enrollment " +
    "WHERE status = 'active' AND last_sent_at IS NOT NULL AND lead_responded_since_last_send = 0"
  )
  for (const en of rows) {
    const [[msg]] = await pool.query(
      'SELECT wm.id FROM whatsapp_messages wm JOIN whatsapp_conversations wc ON wc.id = wm.conversation_id ' +
      "WHERE wc.deal_id = ? AND wm.direction = 'in' AND wm.created_at > ? LIMIT 1",
      [en.deal_id, en.last_sent_at]
    )
    if (msg) {
      await pool.query(
        "UPDATE chatbot_cadence_enrollment SET status='exited', exit_reason='lead_respondeu', " +
        "lead_responded_since_last_send=1, responded_at=NOW() WHERE id=?",
        [en.id]
      )
      await notifyOwner(en.deal_id, 'lead_respondeu_cadencia', 'Lead respondeu durante a cadencia automatica (reengajamento).')
      console.log('[cadenceEngine] deal ' + en.deal_id + ' respondeu, saiu da cadencia automatica')
    }
  }
}

// ---- envio de conteudo por etapa ----

async function sendImages(cfgKey, jid, sockOverride) {
  const raw = await getCfg(cfgKey)
  if (!raw) return
  for (const rel of raw.split(',').map(s => s.trim()).filter(Boolean)) {
    await wa.sendImage(jid, path.join(__dirname, '..', rel), undefined, sockOverride)
  }
}

async function sendStepContent(step, deal, jid) {
  const sockOverride = await getCadenceSocket()
  if (step === 'd1') {
    await sendTextBubbles(await getCfg('cadencia_draft_d1_content'), deal, jid)
    await sendImages('cadencia_draft_d1_image_paths', jid, sockOverride)
  } else if (step === 'd2') {
    await sendTextBubbles(await getCfg('cadencia_draft_d2_content'), deal, jid)
    const audioPath = await getCfg('cadencia_draft_d2_audio_path')
    if (audioPath) await wa.sendAudio(jid, path.join(__dirname, '..', audioPath), sockOverride)
  } else if (step === 'd3') {
    await sendTextBubbles(await getCfg('cadencia_draft_d3_content'), deal, jid)
    const videoPath = await getCfg('cadencia_draft_d3_video_path')
    if (videoPath) await wa.sendVideo(jid, path.join(__dirname, '..', videoPath), undefined, sockOverride)
  } else if (step === 'd4') {
    await sendTextBubbles(await getCfg('cadencia_draft_d4_content'), deal, jid)
    await sendImages('cadencia_draft_d4_image_paths', jid, sockOverride)
  } else if (step === 'd5') {
    await sendTextBubbles(await getCfg('cadencia_draft_d5_content'), deal, jid)
    const videoPath = await getCfg('cadencia_draft_d5_video_path')
    if (videoPath) await wa.sendVideo(jid, path.join(__dirname, '..', videoPath), undefined, sockOverride)
    await sendTextBubbles(await getCfg('cadencia_draft_d5_cta_content'), deal, jid)
  } else if (step === 'd15_despedida') {
    await sendTextBubbles(await getCfg('cadencia_draft_d15_content'), deal, jid)
    const videoPath = await getCfg('cadencia_draft_d15_video_path')
    if (videoPath) await wa.sendVideo(jid, path.join(__dirname, '..', videoPath), undefined, sockOverride)
  }
}

async function sendStepContentResilient(step, deal, jid) {
  try {
    await sendStepContent(step, deal, jid)
  } catch (e) {
    if (e && /connection closed/i.test(e.message || '')) {
      try {
        const flowConn = await require('./connectionsStore').getFlowConnection(TRIGGER_KEYWORD)
        if (flowConn) {
          console.warn('[cadenceEngine] Connection Closed detectado no envio, forcando reconexao imediata da conexao ' + flowConn.id)
          await wa.forceReconnectConnection(flowConn.id)
        }
      } catch (e2) {
        console.error('[cadenceEngine] erro ao forcar reconexao apos falha de envio:', e2.message)
      }
    }
    throw e
  }
}

// ---- avanco de etapa / handoff ----

async function addTag(dealId, tag) {
  const [[row]] = await pool.query('SELECT tags FROM deals WHERE id=?', [dealId])
  let tags = []
  try { tags = JSON.parse((row && row.tags) || '[]') } catch (e) { tags = [] }
  if (!Array.isArray(tags)) tags = []
  if (!tags.includes(tag)) tags.push(tag)
  await pool.query('UPDATE deals SET tags=? WHERE id=?', [JSON.stringify(tags), dealId])
}

async function handoffToMonthly(enrollment) {
  await pool.query(
    "UPDATE chatbot_cadence_enrollment SET status='completed', current_step='handoff_done', exit_reason='handoff_mensal' WHERE id=?",
    [enrollment.id]
  )
  const [[existing]] = await pool.query('SELECT id FROM chatbot_monthly_flow_enrollment WHERE deal_id=?', [enrollment.deal_id])
  if (existing) {
    await pool.query("UPDATE chatbot_monthly_flow_enrollment SET status='active', entered_at=NOW() WHERE id=?", [existing.id])
  } else {
    await pool.query(
      "INSERT INTO chatbot_monthly_flow_enrollment (deal_id, entered_at, status) VALUES (?, NOW(), 'active')",
      [enrollment.deal_id]
    )
  }
  await pool.query(
    "UPDATE deals SET stage_id=?, pipeline_id=?, stage_entered_at=NOW(), stage_tag=NULL WHERE id=?",
    [RMKT_INTERESSE_STAGE_ID, RMKT_PIPELINE_ID, enrollment.deal_id]
  )
  await addTag(enrollment.deal_id, 'Lead reengajado')
  console.log('[cadenceEngine] handoff deal ' + enrollment.deal_id + ' para Fluxo Mensal')
}

async function advanceStepAndReschedule(enrollment, deal, lastAttemptHour) {
  const idx = STEP_ORDER.indexOf(enrollment.current_step)
  const nextStep = STEP_ORDER[idx + 1]
  if (!nextStep) return
  if (nextStep === 'handoff_done') {
    await handoffToMonthly(enrollment)
    return
  }
  const gapDays = STEP_GAP_DAYS[nextStep]
  const hourBRT = await pickNextHourBRT(deal, lastAttemptHour)
  const nextFireAt = fireAtFromDayAndHourBRT(new Date(), gapDays, hourBRT)
  await pool.query(
    "UPDATE chatbot_cadence_enrollment SET current_step=?, step_started_at=NOW(), next_fire_at=?, " +
    "lead_responded_since_last_send=0 WHERE id=?",
    [nextStep, nextFireAt, enrollment.id]
  )
  const stageId = STEP_STAGE_ID[nextStep]
  const pipelineId = STEP_PIPELINE_ID[nextStep]
  if (stageId) {
    await pool.query('UPDATE deals SET stage_id=?, pipeline_id=?, stage_entered_at=NOW() WHERE id=?', [stageId, pipelineId, enrollment.deal_id])
  }
  if (nextStep === 'd15_despedida') {
    await pool.query("UPDATE deals SET stage_tag='reengajamento_auto' WHERE id=?", [enrollment.deal_id])
  }
}

// ---- loop principal ----

let pollInFlight = false

async function processDueEnrollments() {
  const [rows] = await pool.query("SELECT * FROM chatbot_cadence_enrollment WHERE status='active' AND next_fire_at <= NOW()")
  const sendBudget = await getSendBudgetForThisTick()
  const { minGapSec } = await getDailyBudgetCfg()
  let sendsUsedThisTick = 0
    const [[cadenceBurstRow]] = await pool.query("SELECT COUNT(*) c FROM chatbot_cadence_enrollment WHERE last_sent_at >= NOW() - INTERVAL " + CADENCE_BURST_WINDOW_MINUTES + " MINUTE")
    let burstUsedThisTick = cadenceBurstRow ? Number(cadenceBurstRow.c) : 0
    if (burstUsedThisTick >= CADENCE_BURST_MAX) console.log('[cadenceEngine][RATE_LIMIT] limite de ' + CADENCE_BURST_MAX + ' msgs/' + CADENCE_BURST_WINDOW_MINUTES + 'min ja atingido (' + burstUsedThisTick + '), aguardando proximo ciclo')
  let lastSendAt = 0
  if (sendBudget.budget === 0) console.log('[cadenceEngine] envios de cadencia pausados: ' + (sendBudget.reason || 'sem orcamento'))
  for (const en of rows) {
    try {
      if (sendsUsedThisTick >= sendBudget.budget || burstUsedThisTick >= CADENCE_BURST_MAX) break
      const deal = await getDealAndPatient(en.deal_id)
      if (!deal) continue
      { const allowlist = require('./allowlist'); if (await allowlist.isRestrictedMode() && !(await allowlist.isAllowlisted(deal.patient_phone))) { continue } }
      const jid = await resolveJid(deal.patient_phone, await getCadenceSocket())
      if (!jid) { console.warn('[cadenceEngine] sem telefone para deal ' + en.deal_id); continue }

      const nowTsGap = Date.now()
      if (lastSendAt && (nowTsGap - lastSendAt) < minGapSec * 1000) {
        await new Promise(r => setTimeout(r, minGapSec * 1000 - (nowTsGap - lastSendAt)))
      }
      await sendStepContentResilient(en.current_step, deal, jid)
      sendsUsedThisTick++
      burstUsedThisTick++
      lastSendAt = Date.now()

      const nowHourBRT = new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCHours()
      await pool.query(
        'UPDATE chatbot_cadence_enrollment SET last_sent_at=NOW(), last_message_step=?, last_attempt_hour=?, ' +
        'retry_count_current_step = retry_count_current_step + 1 WHERE id=?',
        [en.current_step, nowHourBRT, en.id]
      )
      await advanceStepAndReschedule(en, deal, nowHourBRT)
    } catch (e) {
      console.error('[cadenceEngine] erro processando enrollment ' + en.id + ': ' + e.message)
    }
  }
}

async function runTick() {
  if (pollInFlight) return
  pollInFlight = true
  try {
    if (!(await isEngineActive())) return
    await autoEnrollNewDeals()
    await checkAndSendDespedida()
    await detectResponses()
    await processDueEnrollments()
  } catch (e) {
    console.error('[cadenceEngine] erro no runTick: ' + e.message)
  } finally {
    pollInFlight = false
  }
}

function start() {
  setInterval(runTick, POLL_INTERVAL_MS)
  console.log('[cadenceEngine] poller iniciado (intervalo ' + (POLL_INTERVAL_MS / 60000) + ' min) - gated por is_active de "' + TRIGGER_KEYWORD + '"')
}

module.exports = {
  start,
  runTick,
  isEngineActive,
  autoEnrollNewDeals,
  detectResponses,
  processDueEnrollments,
  handoffToMonthly
}

// ==== DISPARO MANUAL DE CADENCIA (adicionado - botao no CRM) ====
const STEP_LABELS = {
  d1: 'D+1 (dia seguinte)',
  d2: 'D+2',
  d3: 'D+3',
  d4: 'D+4',
  d5: 'D+5',
  d15_despedida: 'D+15 (despedida)'
}

async function getStepContentPreview(step) {
  const cfgMap = {
    d1: 'cadencia_draft_d1_content',
    d2: 'cadencia_draft_d2_content',
    d3: 'cadencia_draft_d3_content',
    d4: 'cadencia_draft_d4_content',
    d5: 'cadencia_draft_d5_content',
    d15_despedida: 'cadencia_draft_d15_content'
  }
  const key = cfgMap[step]
  if (!key) return null
  return await getCfg(key)
}

// ---- Disparo manual do Fluxo Inicial (boas-vindas/quiz) pelo mesmo botao "Disparar agora" ----
// Reaproveita getDealAndPatient (acima) e triggerWelcomeFlow (services/whatsapp.js), aplicando
// a mesma restricao de allowlist/piloto que ja vale para o fluxo automatico.
async function manualTriggerWelcomeFlow(dealId, actorName) {
  const deal = await getDealAndPatient(dealId)
  if (!deal) return { ok: false, error: 'deal_nao_encontrado' }
  if (!deal.patient_phone) return { ok: false, error: 'sem_telefone' }
  const allowlist = require('./allowlist')
  if (await allowlist.isRestrictedMode() && !(await allowlist.isAllowlisted(deal.patient_phone))) {
    return { ok: false, error: 'lead_fora_do_piloto' }
  }
  const [[flowRow]] = await pool.query(
    "SELECT connection_id FROM chatbot_flows WHERE trigger_keyword = 'fluxo_inicial_quiz' AND is_active = 1 LIMIT 1"
  )
  if (!flowRow) return { ok: false, error: 'fluxo_inicial_desativado' }
  const phone = deal.patient_phone.replace(/\D/g, '')
  const fromJid = phone + '@s.whatsapp.net'
  const conv = await wa.ensureConversation(phone, deal.patient_name, fromJid, flowRow.connection_id)
  const sockOverride = wa.getSocketForConnection(flowRow.connection_id)
  let chatbotEnabled = true
  try {
    const connFlags = await require('./connectionsStore').getFlags(flowRow.connection_id)
    chatbotEnabled = !connFlags || connFlags.chatbot_enabled !== false
  } catch (e) {}
  await wa.triggerWelcomeFlow({
    fromJid,
    convId: conv.id,
    dealId,
    pushName: deal.patient_name,
    connCtx: { sock: sockOverride, connectionId: flowRow.connection_id },
    chatbotEnabled
  })
  try {
    const [[dealRow]] = await pool.query('SELECT patient_id FROM deals WHERE id=?', [dealId])
    const patientId = dealRow ? dealRow.patient_id : null
    await require('./crm').logActivity(
      dealId, patientId,
      'Disparo manual do Fluxo Inicial (quiz + audio Dr. Diego) via WhatsApp (via CRM, por ' + (actorName || 'usuario desconhecido') + ')',
      'cadence_manual'
    )
  } catch (e) {}
  return { ok: true, step: 'fluxo_inicial', dealId }
}
async function listCadenceStepsForDeal(dealId) {
  const deal = await getDealAndPatient(dealId)
  const [[enrollment]] = await pool.query(
    'SELECT id, status, current_step, last_sent_at, next_fire_at FROM chatbot_cadence_enrollment WHERE deal_id=? ORDER BY id DESC LIMIT 1',
    [dealId]
  )
  const steps = []
  steps.push({ step: 'fluxo_inicial', label: 'Fluxo Inicial (Quiz + Audio Dr. Diego)', preview: 'Envia o audio de pre-qualificacao do Dr. Diego e inicia a sequencia de resgate.' })
  for (const step of STEP_ORDER) {
    if (step === 'handoff_done') continue
    const content = await getStepContentPreview(step)
    steps.push({ step, label: STEP_LABELS[step] || step, preview: content || null })
  }
  return { deal, enrollment: enrollment || null, steps }
}

async function manualSendStep(dealId, step, actorName) {
  if (step === 'fluxo_inicial') return await manualTriggerWelcomeFlow(dealId, actorName)
  if (!STEP_ORDER.includes(step) || step === 'handoff_done') {
    return { ok: false, error: 'step_invalido', detail: 'Etapa invalida.' }
  }
  const deal = await getDealAndPatient(dealId)
  if (!deal) return { ok: false, error: 'deal_nao_encontrado', detail: 'Deal nao encontrado.' }
  if (!deal.patient_phone) return { ok: false, error: 'lead_sem_telefone', detail: 'Este lead nao tem telefone cadastrado.' }

  const { maxSendsDay, minGapSec } = await getDailyBudgetCfg()
  const [[sentTodayRow]] = await pool.query(
    "SELECT COUNT(*) c FROM chatbot_cadence_enrollment WHERE last_sent_at IS NOT NULL AND " +
    "DATE(CONVERT_TZ(last_sent_at,'+00:00','-03:00')) = DATE(CONVERT_TZ(NOW(),'+00:00','-03:00'))"
  )
  if (sentTodayRow.c >= maxSendsDay) {
    return { ok: false, error: 'orcamento_diario_esgotado', detail: 'Limite diario de ' + maxSendsDay + ' envios da cadencia ja foi atingido hoje (' + sentTodayRow.c + ').' }
  }

  const [[lastRow]] = await pool.query('SELECT MAX(last_sent_at) lastSentAt FROM chatbot_cadence_enrollment')
  if (lastRow && lastRow.lastSentAt) {
    const elapsedSec = (Date.now() - new Date(lastRow.lastSentAt).getTime()) / 1000
    if (elapsedSec < minGapSec) {
      const wait = Math.ceil(minGapSec - elapsedSec)
      return { ok: false, error: 'aguarde_intervalo', detail: 'Aguarde ' + wait + 's antes do proximo disparo (intervalo minimo entre envios da cadencia).', waitSeconds: wait }
    }
  }

  const sockOverride = await getCadenceSocket()
  const jid = await resolveJid(deal.patient_phone, sockOverride)
  if (!jid) return { ok: false, error: 'whatsapp_nao_encontrado', detail: 'Numero do lead nao encontrado no WhatsApp.' }

  await sendStepContentResilient(step, deal, jid)

  const { h: nowHourBRT } = await getBRTNowParts()

  const [[existing]] = await pool.query(
    'SELECT id, current_step FROM chatbot_cadence_enrollment WHERE deal_id=? ORDER BY id DESC LIMIT 1',
    [dealId]
  )

  let enrollment
  if (existing) {
    await pool.query(
      "UPDATE chatbot_cadence_enrollment SET status='active', current_step=?, last_sent_at=NOW(), last_message_step=?, last_attempt_hour=?, retry_count_current_step=0 WHERE id=?",
      [step, step, nowHourBRT, existing.id]
    )
    enrollment = { id: existing.id, current_step: step }
  } else {
    const [ins] = await pool.query(
      "INSERT INTO chatbot_cadence_enrollment (deal_id, status, current_step, step_started_at, next_fire_at, last_sent_at, last_message_step, last_attempt_hour) VALUES (?, 'active', ?, NOW(), NOW(), NOW(), ?, ?)",
      [dealId, step, step, nowHourBRT]
    )
    enrollment = { id: ins.insertId, current_step: step }
  }

  try {
    await advanceStepAndReschedule(enrollment, deal, nowHourBRT)
  } catch (e) {
    console.error('[cadenceEngine] manualSendStep: erro ao reagendar proxima etapa:', e.message)
  }

  try {
    const [[dealRow]] = await pool.query('SELECT patient_id FROM deals WHERE id=?', [dealId])
    const patientId = dealRow ? dealRow.patient_id : null
    await require('./crm').logActivity(
      dealId, patientId,
      'Disparo manual da etapa "' + step + '" da cadencia de WhatsApp (via CRM, por ' + (actorName || 'usuario desconhecido') + ')',
      'cadence_manual'
    )
  } catch (e) {
    console.error('[cadenceEngine] manualSendStep: falha ao registrar activity:', e.message)
  }

  return { ok: true, step, dealId }
}

module.exports.manualSendStep = manualSendStep
module.exports.listCadenceStepsForDeal = listCadenceStepsForDeal
module.exports.getDealAndPatient = getDealAndPatient
module.exports.manualTriggerWelcomeFlow = manualTriggerWelcomeFlow
