require('dotenv').config()
const pool = require('../db')

function extract(b) {
  const campanha = b.campanha || b.campaign || b.campaign_name || (b.ad && b.ad.campaign_name) || null
  const conjunto = b.conjunto || b.adset || b.adset_name || (b.ad && b.ad.adset_name) || null
  const criativo = b.criativo || b.keyword || (b.ad && b.ad.ad_name) || null
  const plataforma = b.plataforma || b.platform || b.source_platform || (b.ad && b.ad.ad_account_name) || null
  const utmSource = b.utm_source || null
  const utmMedium = b.utm_medium || null
  const utmCampaign = b.utm_campaign || null
  const utmContent = b.utm_content || null
  const utmTerm = b.utm_term || null
  const ctwaClid = b.ctwa_clid || (b.ad && b.ad.ctwa_clid) || null
  const adAccountName = (b.ad && b.ad.ad_account_name) || null
  const sourceRaw = b.source || null
  return { campanha, conjunto, criativo, plataforma, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, ctwaClid, adAccountName, sourceRaw }
}

async function run() {
  const [rows] = await pool.query('SELECT crm_deal_id, raw_payload FROM tintim_leads_raw WHERE crm_deal_id IS NOT NULL AND raw_payload IS NOT NULL')
  let updated = 0, errors = 0
  for (const row of rows) {
    try {
      const b = typeof row.raw_payload === 'string' ? JSON.parse(row.raw_payload) : row.raw_payload
      const f = extract(b)
      const [r] = await pool.query(
        `UPDATE deals SET campanha = COALESCE(campanha, ?), conjunto = COALESCE(conjunto, ?), criativo = COALESCE(criativo, ?), plataforma = COALESCE(plataforma, ?), utm_source = COALESCE(utm_source, ?), utm_medium = COALESCE(utm_medium, ?), utm_campaign = COALESCE(utm_campaign, ?), utm_content = COALESCE(utm_content, ?), utm_term = COALESCE(utm_term, ?), ctwa_clid = COALESCE(ctwa_clid, ?), ad_account_name = COALESCE(ad_account_name, ?), tintim_source_raw = COALESCE(tintim_source_raw, ?)
         WHERE id = ?`,
        [f.campanha, f.conjunto, f.criativo, f.plataforma, f.utmSource, f.utmMedium, f.utmCampaign, f.utmContent, f.utmTerm, f.ctwaClid, f.adAccountName, f.sourceRaw, row.crm_deal_id])
      if (r.changedRows > 0) updated++
    } catch (e) { errors++; console.error('erro deal', row.crm_deal_id, e.message) }
  }
  return { total: rows.length, updated, errors }
}

module.exports = { run }
if (require.main === module) {
  run().then(r => { console.log('BACKFILL_RESULT', JSON.stringify(r)); process.exit(0) }).catch(e => { console.error(e); process.exit(1) })
}
