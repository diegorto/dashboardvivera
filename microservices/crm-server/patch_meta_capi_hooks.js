// patch_meta_capi_hooks.js
// Liga o metaConversionsService aos fluxos de won/lost do PATCH /api/crm/deals/:id.
// Rodar uma vez: node patch_meta_capi_hooks.js
const fs = require('fs')
const file = 'server.js'
let src = fs.readFileSync(file, 'utf8')

if (src.indexOf('metaConversionsService') !== -1) {
  console.log('Ja aplicado (marcador metaConversionsService encontrado). Abortando para nao duplicar.')
  process.exit(0)
}

const requireMarker = "const metaAdsService = require('./metaAdsService')"
if (src.indexOf(requireMarker) === -1) { console.error('Marcador de require nao encontrado'); process.exit(1) }
src = src.replace(requireMarker, requireMarker + "\nconst metaConversionsService = require('./metaConversionsService')")

const wonMarker = "syncSaleToTintim(dealId).catch(function(e){ console.error('[tintim-sale]', e.message) })"
if (src.indexOf(wonMarker) === -1) { console.error('Marcador won nao encontrado'); process.exit(1) }
src = src.replace(wonMarker, wonMarker + "\n              metaConversionsService.handleDealWon(dealId).catch(function(e){ console.error('[meta-capi]', e.message) })")

const lostMarker = 'UPDATE deals SET status = "lost", lost_date = NOW(), loss_reason = ? WHERE id = ?'
if (src.indexOf(lostMarker) === -1) { console.error('Marcador lost nao encontrado'); process.exit(1) }
const lostFull = "await conn.query('" + lostMarker + "', [lossReason || null, dealId])"
if (src.indexOf(lostFull) === -1) { console.error('Marcador lost (linha completa) nao encontrado'); process.exit(1) }
src = src.replace(lostFull, lostFull + "\n            metaConversionsService.handleDealLost(dealId).catch(function(e){ console.error('[meta-capi]', e.message) })")

fs.writeFileSync(file, src)
console.log('OK - hooks inseridos')
