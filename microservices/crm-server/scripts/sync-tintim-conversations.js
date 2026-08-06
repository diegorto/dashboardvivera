// scripts/sync-tintim-conversations.js
// Varredura periodica: busca cada deal aberto na API da Tintim (por telefone)
// e grava total_messages / last_interaction_at / status em tintim_leads_raw.
// Usado pelo alerta de "conversas paradas" (deal.js -> stalled-conversations).
//
// Roda automatico via cron do server.js (na VPS), ou manual:
//   node scripts/sync-tintim-conversations.js
require('dotenv').config()
const axios = require('axios')
const pool = require('../db')

const ACCOUNT_CODE = process.env.TINTIM_ACCOUNT_CODE
const ACCOUNT_TOKEN = process.env.TINTIM_ACCOUNT_TOKEN
const BASE = 'https://s.tintim.app/api/v1'
const DELAY_MS = 350 // espaca as chamadas pra nao estourar rate limit da Tintim

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function normalizePhone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (!digits) return null
  // Tintim espera formato 55DDDNUMERO sem '+'
  return digits.startsWith('55') ? digits : ('55' + digits)
}

async function fetchLead(phoneDigits) {
  const url = `${BASE}/${ACCOUNT_CODE}/lead/${phoneDigits}`
  const { data } = await axios.get(url, { params: { token: ACCOUNT_TOKEN }, timeout: 15000 })
  return data
}

async function run() {
  if (!ACCOUNT_CODE || !ACCOUNT_TOKEN) {
    console.log('[tintim-sync] TINTIM_ACCOUNT_CODE/TOKEN nao configurados - varredura pulada.')
    return { skipped: true }
  }

  const [deals] = await pool.query(
    `SELECT d.id AS deal_id, d.pipedrive_id, p.phone
     FROM deals d
     JOIN patients p ON p.id = d.patient_id
     WHERE d.status = 'open' AND p.phone IS NOT NULL AND p.phone <> ''`
  )

  let updated = 0, notFound = 0, errors = 0

  for (const deal of deals) {
    const phoneDigits = normalizePhone(deal.phone)
    if (!phoneDigits) continue
    try {
      const lead = await fetchLead(phoneDigits)
      if (!lead || lead.error || !lead.phone) { notFound++; await sleep(DELAY_MS); continue }

      const totalMessages = lead.total_messages != null ? lead.total_messages : null
      const lastInteraction = lead.last_interaction_at ? new Date(lead.last_interaction_at) : null
      const statusId = lead.status && lead.status.id != null ? String(lead.status.id) : null
      const statusName = lead.status && lead.status.name ? lead.status.name : null
      const leadUpdatedAt = lastInteraction || (lead.updated ? new Date(lead.updated) : null)

      await pool.query(
        `INSERT INTO tintim_leads_raw
           (crm_deal_id, phone_e164, phone, name, status_id, status_name, total_messages,
            lead_created_at, lead_updated_at, pipedrive_deal_id, raw_payload, received_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           phone_e164 = VALUES(phone_e164),
           name = VALUES(name),
           status_id = VALUES(status_id),
           status_name = VALUES(status_name),
           total_messages = VALUES(total_messages),
           lead_updated_at = VALUES(lead_updated_at),
           pipedrive_deal_id = VALUES(pipedrive_deal_id),
           raw_payload = VALUES(raw_payload),
           updated_at = NOW()`,
        [
          deal.deal_id, phoneDigits, phoneDigits, lead.name || null, statusId, statusName, totalMessages,
          lead.created ? new Date(lead.created) : null, leadUpdatedAt, deal.pipedrive_id || null,
          JSON.stringify(lead)
        ]
      )
      updated++
    } catch (e) {
      errors++
      console.error('[tintim-sync] erro no deal', deal.deal_id, e.response ? e.response.status : e.message)
    }
    await sleep(DELAY_MS)
  }

  const result = { totalDeals: deals.length, updated, notFound, errors }
  console.log('[tintim-sync] concluido:', JSON.stringify(result))
  return result
}

module.exports = { run }

if (require.main === module) {
  run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
}
