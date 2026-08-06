const pool = require('../db')
const metaAdsService = require('../metaAdsService')

async function run() {
  const [rows] = await pool.query(
    "SELECT id, criativo FROM deals WHERE criativo REGEXP '^[0-9]{10,}$' AND (ad_name IS NULL OR ad_name = '')"
  )
  console.log('BACKFILL: encontrados ' + rows.length + ' deals com criativo numerico e ad_name vazio')
  if (rows.length === 0) return { total: 0, updated: 0, resolved: 0, fallback: 0, errors: 0 }

  const ids = Array.from(new Set(rows.map(r => String(r.criativo))))
  let nameMap = {}
  try {
    nameMap = await metaAdsService.resolveAdNames(ids)
  } catch (e) {
    console.error('BACKFILL: erro ao resolver nomes em lote', e.message)
  }

  let updated = 0, resolved = 0, fallback = 0, errors = 0
  for (const row of rows) {
    const idStr = String(row.criativo)
    const name = nameMap && nameMap[idStr]
    const finalName = name || ('Anuncio ' + idStr + ' (nao encontrado no Meta)')
    if (name) resolved++; else fallback++
    try {
      await pool.query('UPDATE deals SET ad_name = ? WHERE id = ?', [finalName, row.id])
      updated++
      console.log('BACKFILL: deal ' + row.id + ' -> ' + finalName)
    } catch (e) {
      errors++
      console.error('BACKFILL: erro deal ' + row.id, e.message)
    }
  }
  return { total: rows.length, updated, resolved, fallback, errors }
}

module.exports = { run }
if (require.main === module) {
  run().then(r => { console.log('BACKFILL_RESULT', JSON.stringify(r)); process.exit(0) }).catch(e => { console.error(e); process.exit(1) })
}
