require('dotenv').config()
const crypto = require('crypto')
const axios = require('axios')
const pool = require('./db')
const { evaluateEligibility } = require('./metaConversionsService')

const GRAPH_VERSION = 'v21.0'
const FB_PIXEL_ID = process.env.FB_PIXEL_ID
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN
const DRY_RUN = process.argv.includes('--dry-run')
const LIMIT = (() => { const a = process.argv.find(x => x.startsWith('--limit=')); return a ? Number(a.split('=')[1]) : null })()

function buildEventId(dealId, eventName, eventTime) {
  const raw = dealId + ':' + eventName + ':' + eventTime.toISOString().slice(0, 19)
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

async function logEvent(entry) {
  await pool.query(
    'INSERT INTO meta_capi_events_log (deal_id, event_name, event_id, status, http_status, response_body, skip_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
    [entry.dealId, entry.eventName, entry.eventId || null, entry.statusLabel, entry.httpStatus || null, entry.responseBody ? JSON.stringify(entry.responseBody).slice(0, 4000) : null, entry.skipReason || null]
  ).catch(function (e) { console.error('[backfill] falha ao gravar log', e.message) })
}

async function main() {
  const [rows] = await pool.query(
    `SELECT d.id, d.status, d.value, d.won_date, d.procedure_name, d.pipeline_id, d.origem, d.plataforma,
            p.phone, p.email
     FROM deals d LEFT JOIN patients p ON p.id = d.patient_id
     WHERE d.status = 'won'
       AND NOT EXISTS (SELECT 1 FROM meta_capi_events_log l WHERE l.deal_id = d.id AND l.event_name = 'Purchase')
     ORDER BY d.won_date DESC`
  )
  console.log('Total deals Won nunca avaliados pelo Meta CAPI:', rows.length)

  const WINDOW_MS = 62 * 24 * 60 * 60 * 1000
  const now = Date.now()
  let sent = 0, failed = 0, foraDaJanela = 0, inelegivel = 0, googleSent = 0, googleTotal = 0
  const toProcess = LIMIT ? rows.slice(0, LIMIT) : rows

  for (const row of toProcess) {
    const isGoogle = /google/i.test(row.origem || '') || /google/i.test(row.plataforma || '')
    if (isGoogle) googleTotal++
    const wonDate = new Date(row.won_date)
    const dentroDaJanela = (now - wonDate.getTime()) <= WINDOW_MS

    if (!dentroDaJanela) {
      foraDaJanela++
      await logEvent({ dealId: row.id, eventName: 'Purchase', statusLabel: 'skipped', skipReason: 'fora_da_janela_62dias_backfill' })
      continue
    }

    const elig = evaluateEligibility(row)
    if (!elig.eligible) {
      inelegivel++
      await logEvent({ dealId: row.id, eventName: 'Purchase', statusLabel: 'skipped', skipReason: elig.reason + '_backfill' })
      continue
    }

    const eventId = buildEventId(row.id, 'Purchase', elig.eventTime)
    const userData = {}
    if (elig.phone) userData.ph = [crypto.createHash('sha256').update(elig.phone).digest('hex')]
    if (elig.email) userData.em = [crypto.createHash('sha256').update(elig.email).digest('hex')]
    const payload = {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(elig.eventTime.getTime() / 1000),
        event_id: eventId,
        action_source: 'physical_store',
        user_data: userData,
        custom_data: { currency: 'BRL', value: elig.value || 0, order_id: String(row.id) }
      }]
    }

    console.log((DRY_RUN ? '[DRY] ' : '[SEND] ') + 'deal', row.id, 'origem=', row.origem, 'plataforma=', row.plataforma, 'won_date=', row.won_date, 'value=', elig.value)

    if (DRY_RUN) { sent++; if (isGoogle) googleSent++; continue }

    try {
      const url = 'https://graph.facebook.com/' + GRAPH_VERSION + '/' + FB_PIXEL_ID + '/events'
      const resp = await axios.post(url, payload, { params: { access_token: FB_ACCESS_TOKEN } })
      await logEvent({ dealId: row.id, eventName: 'Purchase', eventId, statusLabel: 'sent', httpStatus: resp.status, responseBody: resp.data })
      sent++
      if (isGoogle) googleSent++
    } catch (e) {
      failed++
      const respData = e.response ? e.response.data : { message: e.message }
      await logEvent({ dealId: row.id, eventName: 'Purchase', eventId, statusLabel: 'error', httpStatus: e.response ? e.response.status : null, responseBody: respData })
      console.error('[ERRO] deal', row.id, JSON.stringify(respData))
    }
    await new Promise(r => setTimeout(r, 250))
  }

  console.log('--- RESUMO ---')
  console.log('processados:', toProcess.length)
  console.log('enviados com sucesso:', sent)
  console.log('falharam no envio:', failed)
  console.log('fora da janela de 62 dias:', foraDaJanela)
  console.log('inelegiveis (dados incompletos):', inelegivel)
  console.log('Google - total encontrados:', googleTotal, '| Google - enviados:', googleSent)
  process.exit(0)
}

main().catch(function (e) { console.error('ERRO FATAL', e); process.exit(1) })
