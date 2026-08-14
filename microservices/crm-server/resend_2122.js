const pool = require('/root/dashboardvivera-prod/microservices/crm-server/db')
const { evaluateEligibility } = require('/root/dashboardvivera-prod/microservices/crm-server/metaConversionsService')
const crypto = require('crypto')
const axios = require('axios')
const GRAPH_VERSION = 'v21.0'
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN
const FB_PIXEL_ID = process.env.FB_PIXEL_ID
function sha256(v){ return crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex') }
async function main(){
  const [rows] = await pool.query("SELECT d.id, d.status, d.value, d.won_date, d.procedure_name, d.pipeline_id, p.phone, p.email FROM deals d JOIN patients p ON p.id=d.patient_id WHERE d.id=2122")
  const row = rows[0]
  console.log('deal atual:', JSON.stringify(row))
  const elig = evaluateEligibility(row)
  console.log('elegibilidade:', JSON.stringify(elig))
  if (!elig.eligible) { console.log('NAO ELEGIVEL, abortando'); process.exit(1) }
  const eventTime = Math.floor(elig.eventTime.getTime()/1000)
  const eventId = crypto.createHash('sha256').update('2122:Purchase:' + elig.eventTime.toISOString().slice(0,19)).digest('hex').slice(0,32)
  const userData = {}
  if (elig.phone) userData.ph = [sha256(elig.phone)]
  if (elig.email) userData.em = [sha256(elig.email)]
  const payload = { data: [{ event_name: 'Purchase', event_time: eventTime, event_id: eventId, action_source: 'physical_store', user_data: userData, custom_data: { currency: 'BRL', value: elig.value, order_id: '2122' } }] }
  try {
    const url = 'https://graph.facebook.com/' + GRAPH_VERSION + '/' + FB_PIXEL_ID + '/events'
    const resp = await axios.post(url, payload, { params: { access_token: FB_ACCESS_TOKEN } })
    console.log('SUCESSO', resp.status, JSON.stringify(resp.data))
    await pool.query('INSERT INTO meta_capi_events_log (deal_id, event_name, event_id, status, http_status, response_body, skip_reason, created_at) VALUES (?,?,?,?,?,?,?,NOW())', [2122,'Purchase',eventId,'sent',resp.status,JSON.stringify(resp.data).slice(0,4000),'reenvio_apos_correcao_valor_backfill'])
  } catch(e) {
    const respData = e.response ? e.response.data : { message: e.message }
    console.error('ERRO', JSON.stringify(respData))
    await pool.query('INSERT INTO meta_capi_events_log (deal_id, event_name, event_id, status, http_status, response_body, skip_reason, created_at) VALUES (?,?,?,?,?,?,?,NOW())', [2122,'Purchase',eventId,'skipped',e.response?e.response.status:null,JSON.stringify(respData).slice(0,4000),'erro_reenvio_apos_correcao'])
  }
  process.exit(0)
}
main().catch(function(e){ console.error('ERRO FATAL', e); process.exit(1) })
