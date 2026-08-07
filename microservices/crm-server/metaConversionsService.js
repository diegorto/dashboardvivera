// metaConversionsService.js
// Envia sinais de conversao (won -> Purchase; lost/desqualificado do pipeline Inbound ->
// evento customizado DealDisqualified) para a Meta Conversions API (CAPI), com hashing
// SHA-256 de PII, event_id estavel para deduplicacao e log de auditoria em meta_capi_events_log.
//
// So dispara para deals que mudam de status a partir da ativacao deste servico (sem backfill).
//
// Variaveis de ambiente:
//   FB_ACCESS_TOKEN    (ja existe no .env - usado hoje em metaAdsService.js; confirmado em
//                       2026-08-07 que tem o escopo ads_management, necessario para CAPI)
//   FB_PIXEL_ID        (AINDA NAO EXISTE - criar Pixel/Dataset no Meta Events Manager)
//   FB_TEST_EVENT_CODE (opcional - Events Manager > Test Events, so para validar antes de producao)

const crypto = require('crypto')
const axios = require('axios')
const pool = require('./db')

const GRAPH_VERSION = 'v21.0'
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN
const FB_PIXEL_ID = process.env.FB_PIXEL_ID
const FB_TEST_EVENT_CODE = process.env.FB_TEST_EVENT_CODE || null
const INBOUND_PIPELINE_ID = 1 // pipeline "Inbound" - mesmo id usado no rodizio de SDR
const CRM_BASE_URL = 'https://crm.viveraorofacial.com.br'

function sha256(value) {
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex')
}

function normalizePhone(rawPhone) {
  if (!rawPhone) return null
  let digits = String(rawPhone).replace(/\D/g, '')
  if (!digits) return null
  if (digits.length <= 11) digits = '55' + digits
  if (digits.length < 12 || digits.length > 13) return null
  return digits
}

function normalizeEmail(rawEmail) {
  if (!rawEmail) return null
  const email = String(rawEmail).trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

function evaluateEligibility(row) {
  const phone = normalizePhone(row.phone)
  const email = normalizeEmail(row.email)
  if (!phone && !email) return { eligible: false, reason: 'sem_contato_valido' }

  if (row.status === 'won') {
    if (!row.won_date) return { eligible: false, reason: 'sem_won_date' }
    if (!row.procedure_name || !String(row.procedure_name).trim()) return { eligible: false, reason: 'sem_procedimento' }
    if (!(Number(row.value) > 0)) return { eligible: false, reason: 'valor_invalido' }
    return { eligible: true, phone: phone, email: email, eventTime: new Date(row.won_date), value: Number(row.value) }
  }

  if (row.status === 'lost') {
    if (Number(row.pipeline_id) !== INBOUND_PIPELINE_ID) return { eligible: false, reason: 'fora_do_pipeline_inbound' }
    if (!row.lost_date) return { eligible: false, reason: 'sem_lost_date' }
    if (row.duplicate_alert) return { eligible: false, reason: 'duplicate_alert_ativo' }
    const hasValidReasonId = row.loss_reason_id !== null && row.loss_reason_id !== undefined
    const reasonText = String(row.loss_reason || '').trim()
    const outroComDescricao = /^outro/i.test(reasonText) && reasonText.length > 8
    if (!hasValidReasonId && !outroComDescricao) return { eligible: false, reason: 'motivo_perda_ambiguo' }
    return { eligible: true, phone: phone, email: email, eventTime: new Date(row.lost_date), value: 0 }
  }

  return { eligible: false, reason: 'status_nao_terminal_' + row.status }
}

function buildEventId(dealId, eventName, eventTime) {
  const raw = dealId + ':' + eventName + ':' + eventTime.toISOString().slice(0, 19)
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

async function logEvent(entry) {
  await pool.query(
    'INSERT INTO meta_capi_events_log (deal_id, event_name, event_id, status, http_status, response_body, skip_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
    [entry.dealId, entry.eventName, entry.eventId || null, entry.statusLabel, entry.httpStatus || null, entry.responseBody ? JSON.stringify(entry.responseBody).slice(0, 4000) : null, entry.skipReason || null]
  ).catch(function (e) { console.error('[metaConversionsService] falha ao gravar log', e.message) })
}

async function sendToMeta(eventName, dealId, eligibility) {
  if (!FB_ACCESS_TOKEN || !FB_PIXEL_ID) {
    await logEvent({ dealId: dealId, eventName: eventName, statusLabel: 'skipped', skipReason: 'credenciais_meta_ausentes_FB_PIXEL_ID' })
    return
  }

  const eventId = buildEventId(dealId, eventName, eligibility.eventTime)
  const userData = {}
  if (eligibility.phone) userData.ph = [sha256(eligibility.phone)]
  if (eligibility.email) userData.em = [sha256(eligibility.email)]

  const payload = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(eligibility.eventTime.getTime() / 1000),
      event_id: eventId,
      action_source: 'system_generated',
      event_source_url: CRM_BASE_URL + '/deals/' + dealId,
      user_data: userData,
      custom_data: {
        currency: 'BRL',
        value: eligibility.value || 0
      }
    }]
  }
  if (FB_TEST_EVENT_CODE) payload.test_event_code = FB_TEST_EVENT_CODE

  try {
    const url = 'https://graph.facebook.com/' + GRAPH_VERSION + '/' + FB_PIXEL_ID + '/events'
    const resp = await axios.post(url, payload, { params: { access_token: FB_ACCESS_TOKEN } })
    await logEvent({ dealId: dealId, eventName: eventName, eventId: eventId, statusLabel: 'sent', httpStatus: resp.status, responseBody: resp.data })
  } catch (e) {
    console.error('[metaConversionsService] falha ao enviar evento', eventName, 'deal', dealId, e.response ? JSON.stringify(e.response.data) : e.message)
    await logEvent({ dealId: dealId, eventName: eventName, eventId: eventId, statusLabel: 'error', httpStatus: e.response ? e.response.status : null, responseBody: e.response ? e.response.data : { message: e.message } })
  }
}

async function handleDealWon(dealId) {
  try {
    const result = await pool.query(
      'SELECT d.id, d.status, d.value, d.won_date, d.procedure_name, d.pipeline_id, p.phone, p.email FROM deals d JOIN patients p ON p.id = d.patient_id WHERE d.id = ?',
      [dealId]
    )
    const row = result[0][0]
    if (!row) return
    const eligibility = evaluateEligibility(row)
    if (!eligibility.eligible) {
      await logEvent({ dealId: dealId, eventName: 'Purchase', statusLabel: 'skipped', skipReason: eligibility.reason })
      return
    }
    await sendToMeta('Purchase', dealId, eligibility)
  } catch (e) {
    console.error('[metaConversionsService] handleDealWon erro deal', dealId, e.message)
  }
}

async function handleDealLost(dealId) {
  try {
    const result = await pool.query(
      'SELECT d.id, d.status, d.pipeline_id, d.lost_date, d.loss_reason, d.loss_reason_id, d.duplicate_alert, p.phone, p.email FROM deals d JOIN patients p ON p.id = d.patient_id WHERE d.id = ?',
      [dealId]
    )
    const row = result[0][0]
    if (!row) return
    const eligibility = evaluateEligibility(row)
    if (!eligibility.eligible) {
      await logEvent({ dealId: dealId, eventName: 'DealDisqualified', statusLabel: 'skipped', skipReason: eligibility.reason })
      return
    }
    await sendToMeta('DealDisqualified', dealId, eligibility)
  } catch (e) {
    console.error('[metaConversionsService] handleDealLost erro deal', dealId, e.message)
  }
}

module.exports = { handleDealWon: handleDealWon, handleDealLost: handleDealLost, evaluateEligibility: evaluateEligibility, normalizePhone: normalizePhone, normalizeEmail: normalizeEmail }
