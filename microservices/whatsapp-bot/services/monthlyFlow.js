const pool = require('../db')
const wa = require('./whatsapp')
const path = require('path')

const INBOUND_PIPELINE_ID = 1
const D5_STAGE_SKEY = 'd5'
const DAYS_STUCK_BEFORE_ENROLL = 15
const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6h

let pollInFlight = false

function currentMonthKey() {
  const d = new Date()
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0')
}

async function isFlowActive() {
  const [[row]] = await pool.query("SELECT is_active FROM chatbot_flows WHERE trigger_keyword = 'fluxo_mensal' LIMIT 1")
  return !!(row && row.is_active)
}

async function getD5StageId() {
  const [[row]] = await pool.query('SELECT id FROM stages WHERE pipeline_id = ? AND skey = ? LIMIT 1', [INBOUND_PIPELINE_ID, D5_STAGE_SKEY])
  return row ? row.id : null
}

async function enrollEligibleDeals(stageId) {
  const [rows] = await pool.query(
    `SELECT d.id FROM deals d
     LEFT JOIN chatbot_monthly_flow_enrollment e ON e.deal_id = d.id
     WHERE d.pipeline_id = ? AND d.stage_id = ? AND d.status = 'open'
       AND d.stage_entered_at IS NOT NULL
       AND d.stage_entered_at <= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND e.id IS NULL`,
    [INBOUND_PIPELINE_ID, stageId, DAYS_STUCK_BEFORE_ENROLL]
  )
  for (const r of rows) {
    await pool.query(
      "INSERT INTO chatbot_monthly_flow_enrollment (deal_id, entered_at, status) VALUES (?, NOW(), 'active')",
      [r.id]
    )
    console.log('[monthlyFlow] deal ' + r.id + ' matriculado no Fluxo Mensal')
  }
}

async function exitDealsNoLongerEligible(stageId) {
  await pool.query(
    `UPDATE chatbot_monthly_flow_enrollment e
     JOIN deals d ON d.id = e.deal_id
     SET e.status = 'exited'
     WHERE e.status = 'active' AND (d.stage_id != ? OR d.status != 'open')`,
    [stageId]
  )
}

async function getMonthBlocks(monthKey) {
  const [rows] = await pool.query(
    'SELECT * FROM chatbot_monthly_message_blocks WHERE month_key = ? ORDER BY block_order ASC, id ASC',
    [monthKey]
  )
  return rows
}

async function getDealPhone(dealId) {
  const [[row]] = await pool.query(
    'SELECT p.phone FROM deals d JOIN patients p ON p.id = d.patient_id WHERE d.id = ?',
    [dealId]
  )
  return row ? row.phone : null
}

async function resolveJid(phone) {
  if (!phone) return null
  if (phone.includes('@')) return phone
  try {
    const results = await wa.checkOnWhatsApp(phone)
    if (results && results[0] && results[0].jid) return results[0].jid
  } catch (e) {
    console.warn('[monthlyFlow] falha ao resolver onWhatsApp para ' + phone + ': ' + e.message)
  }
  return phone.replace(/\D/g, '') + '@s.whatsapp.net'
}

async function sendBlocksToDeal(dealId, blocks) {
  const phone = await getDealPhone(dealId)
  const jid = await resolveJid(phone)
  if (!jid) {
    console.warn('[monthlyFlow] deal ' + dealId + ' sem telefone, pulando envio')
    return false
  }
    const flowConnMonthly = await require('./connectionsStore').getFlowConnection('fluxo_mensal').catch(() => null)
    const sockOverride = flowConnMonthly ? wa.getSocketForConnection(flowConnMonthly.id) : undefined
  for (const b of blocks) {
    if (b.block_type === 'text') {
      if (!b.text_content) continue
      await wa.sendText(jid, b.text_content, sockOverride)
    } else if (b.block_type === 'audio') {
      if (!b.media_path) continue
      await wa.sendAudio(jid, path.join(__dirname, '..', b.media_path), sockOverride)
    } else if (b.block_type === 'video') {
      if (!b.media_path) continue
      await wa.sendVideo(jid, path.join(__dirname, '..', b.media_path))
    }
  }
  return true
}

async function sendMonthlyMessages() {
  const monthKey = currentMonthKey()
  const blocks = await getMonthBlocks(monthKey)
  if (!blocks.length) {
    console.log('[monthlyFlow] nenhum bloco configurado para ' + monthKey + ', nada a enviar')
    return
  }
  const [enrollments] = await pool.query(
    "SELECT id, deal_id FROM chatbot_monthly_flow_enrollment WHERE status = 'active' AND (last_sent_month IS NULL OR last_sent_month != ?)",
    [monthKey]
  )
  for (const en of enrollments) {
    try {
      const ok = await sendBlocksToDeal(en.deal_id, blocks)
      if (ok) {
        await pool.query(
          "UPDATE chatbot_monthly_flow_enrollment SET last_sent_month = ?, last_sent_at = NOW() WHERE id = ?",
          [monthKey, en.id]
        )
        console.log('[monthlyFlow] mensagem de ' + monthKey + ' enviada para deal ' + en.deal_id)
      }
    } catch (e) {
      console.error('[monthlyFlow] erro ao enviar para deal ' + en.deal_id + ':', e.message)
    }
  }
}

async function runTick() {
  if (pollInFlight) return
  pollInFlight = true
  try {
    if (!(await isFlowActive())) return
    const stageId = await getD5StageId()
    if (!stageId) {
      console.warn('[monthlyFlow] estagio d5 nao encontrado no pipeline Inbound')
      return
    }
  // DESATIVADO (conflita com cadenceEngine.js handoff) - //    await enrollEligibleDeals(stageId)
    await exitDealsNoLongerEligible(stageId)
    await sendMonthlyMessages()
  } catch (e) {
    console.error('[monthlyFlow] erro no runTick:', e.message)
  } finally {
    pollInFlight = false
  }
}

function start() {
  setInterval(runTick, POLL_INTERVAL_MS)
  console.log('[monthlyFlow] poller iniciado (intervalo ' + POLL_INTERVAL_MS + 'ms)')
}

module.exports = { start, runTick, currentMonthKey, isFlowActive, getD5StageId, enrollEligibleDeals, exitDealsNoLongerEligible, sendMonthlyMessages }
