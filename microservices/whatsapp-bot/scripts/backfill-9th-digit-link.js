// scripts/backfill-9th-digit-link.js
//
// Correcao retroativa (pedido do Diego, 2026-08-13): conversas do WhatsApp que
// ficaram sem patient_id/deal_id porque o telefone foi salvo sem o 9o digito
// (ex: whatsapp_conversations.phone = +554796751810 enquanto patients.phone =
// +5547996751810 para a mesma pessoa). A comparacao em tempo real ja foi
// corrigida (services/crm.js: phoneDigitVariants + findPatientByPhone, commit
// 6923a54), mas os registros antigos, criados antes dessa correcao, continuam
// sem vinculo. Este script reprocessa esses registros usando a MESMA funcao
// de producao (findPatientByPhone), sem duplicar logica.
//
// Idempotente: so atualiza linhas com patient_id ainda NULL, e faz UPDATE
// condicionado a "AND patient_id IS NULL" para evitar corrida com o bot
// vinculando a mesma conversa em paralelo.
//
// Uso: node scripts/backfill-9th-digit-link.js
// Fazer backup da tabela whatsapp_conversations antes de rodar em producao.

require('dotenv').config()
const pool = require('../db')
const crm = require('../services/crm')

async function main() {
  const [rows] = await pool.query(
    'SELECT id, phone FROM whatsapp_conversations WHERE patient_id IS NULL'
  )
  console.log(`[backfill] ${rows.length} conversas sem patient_id encontradas.`)

  let linked = 0
  let linkedWithDeal = 0
  let skipped = 0

  for (const row of rows) {
    let patient = null
    try {
      patient = await crm.findPatientByPhone(row.phone)
    } catch (e) {
      console.error(`[backfill] erro ao buscar patient para conversa ${row.id} (${row.phone}):`, e.message)
      continue
    }
    if (!patient) {
      skipped++
      continue
    }
    const deal = await crm.findOpenDealByPatient(patient.id).catch(() => null)
    await pool.query(
      'UPDATE whatsapp_conversations SET patient_id = ?, deal_id = ? WHERE id = ? AND patient_id IS NULL',
      [patient.id, deal ? deal.id : null, row.id]
    )
    linked++
    if (deal) linkedWithDeal++
    console.log(`[backfill] conversa ${row.id} (${row.phone}) -> patient ${patient.id}${deal ? ', deal ' + deal.id : ' (sem deal aberto)'}`)
  }

  console.log(`[backfill] concluido. ${linked} conversas vinculadas a um patient (${linkedWithDeal} tambem ganharam deal_id). ${skipped} permaneceram sem match.`)
  await pool.end()
}

main().catch((e) => {
  console.error('[backfill] erro fatal:', e)
  process.exit(1)
})
