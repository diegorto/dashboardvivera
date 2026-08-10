const pool = require('../db')
const path = require('path')
const fs = require('fs')

let schedPollInFlight = false

async function cancelPending(conversationId) {
  await pool.query(
    "UPDATE scheduled_messages SET status='cancelled' WHERE conversation_id=? AND status='pending'",
    [conversationId]
  )
}

async function getSeqConfig() {
  const [rows] = await pool.query("SELECT config_key, config_value FROM chatbot_ai_config WHERE config_key LIKE 'seq_%'")
  const cfg = {}
  for (const r of rows) cfg[r.config_key] = r.config_value
  return cfg
}

async function scheduleSequence(conversationId, leadName) {
  leadName = require('./nameUtils').getFirstName(leadName)
  const cfg = await getSeqConfig()
  let ownerName = ''
  try {
    const [[convRowForOwner]] = await pool.query('SELECT deal_id FROM whatsapp_conversations WHERE id = ?', [conversationId])
    if (convRowForOwner && convRowForOwner.deal_id) {
      const [[dealRowForOwner]] = await pool.query('SELECT owner_name FROM deals WHERE id = ?', [convRowForOwner.deal_id])
      if (dealRowForOwner) ownerName = dealRowForOwner.owner_name || ''
    }
  } catch (e) {
    console.error('[scheduler] erro ao buscar owner do deal para variavel {owner}:', e.message)
  }
  let cumulativeMinutes = 0
  for (const step of [1, 2, 3, 4]) {
    const type = cfg['seq_step' + step + '_type'] || 'text'
    const delay = parseInt(cfg['seq_step' + step + '_delay_min'] || '0', 10)
    let content = cfg['seq_step' + step + '_content'] || ''
    cumulativeMinutes += delay
    if (type === 'text') content = content.split('{nome}').join(leadName || 'Oi').split('{owner}').join(ownerName || 'nossa equipe')
    const bubbleParts = (type === 'text' && content.includes('|||'))
      ? content.split('|||').map(p => p.trim()).filter(Boolean)
      : [content]
    for (let bi = 0; bi < bubbleParts.length; bi++) {
      await pool.query(
        'INSERT INTO scheduled_messages (conversation_id, sequence_step, message_type, content, fire_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))',
        [conversationId, step, type, bubbleParts[bi], cumulativeMinutes * 60 + bi * 3]
      )
    }
  }
}

async function runTick() {
  if (schedPollInFlight) { console.warn('[scheduler] tick anterior ainda em andamento, pulando'); return }
  schedPollInFlight = true
  try {
    const [rows] = await pool.query(
      "SELECT sm.*, wc.phone, wc.contact_name AS lead_name, wc.connection_id FROM scheduled_messages sm JOIN whatsapp_conversations wc ON wc.id = sm.conversation_id WHERE sm.status='pending' AND sm.fire_at <= NOW() ORDER BY sm.fire_at ASC LIMIT 20"
    )
    if (!rows.length) return
    const wa = require('./whatsapp')

async function resolveJid(phone) {
  if (!phone) return null
  if (phone.includes('@')) return phone
  try {
    const results = await wa.checkOnWhatsApp(phone)
    if (results && results[0] && results[0].jid) return results[0].jid
  } catch (e) {
    console.warn('[scheduler] falha ao resolver onWhatsApp para ' + phone + ': ' + e.message)
  }
  return phone.replace(/\D/g, '') + '@s.whatsapp.net'
}
    for (const row of rows) {
      try {
      { const allowlist = require('./allowlist'); if (await allowlist.isRestrictedMode() && !(await allowlist.isAllowlisted(row.phone))) { continue } }
        if (row.step === 4) {
          const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' }).formatToParts(new Date())
          const getPart = (t) => parseInt(parts.find(p => p.type === t).value, 10)
          const hourBR = getPart('hour') % 24
          if (hourBR < 8 || hourBR >= 22) {
            let y = getPart('year'), mo = getPart('month'), d = getPart('day')
            if (hourBR >= 22) { const nd = new Date(Date.UTC(y, mo - 1, d + 1)); y = nd.getUTCFullYear(); mo = nd.getUTCMonth() + 1; d = nd.getUTCDate() }
            const nextFireUtc = new Date(Date.UTC(y, mo - 1, d, 11, 0, 0))
            await pool.query('UPDATE scheduled_messages SET fire_at=? WHERE id=?', [nextFireUtc, row.id])
            console.log('[scheduler] step4 fora da janela 8h-22h (BRT), adiado para ' + nextFireUtc.toISOString())
            continue
          }
        }
        const audioPath = row.message_type === 'audio' ? path.join(__dirname, '..', row.content || '') : null
        if (!row.content || (row.message_type === 'audio' && !fs.existsSync(audioPath))) {
          console.warn('[scheduler] step ' + row.sequence_step + ' da conversa ' + row.conversation_id + ' sem conteudo/arquivo configurado, pulando')
          await pool.query("UPDATE scheduled_messages SET status='cancelled' WHERE id=?", [row.id])
          continue
        }
        const jid = await resolveJid(row.phone)
      const connFlags = await require('./connectionsStore').getFlags(row.connection_id).catch(() => ({ chatbot_enabled: true }))
      if (connFlags.chatbot_enabled === false) continue
      const flowConn = await require('./connectionsStore').getFlowConnection('fluxo_inicial_quiz').catch(() => null)
      const sockOverride = flowConn ? wa.getSocketForConnection(flowConn.id) : undefined
        if (row.message_type === 'audio') {
      await wa.sendAudio(jid, audioPath, sockOverride)
    } else if (row.message_type === 'image') {
      const imgPath = require('path').join(__dirname, '..', row.content || '')
      await wa.sendImage(jid, imgPath, '', sockOverride)
    } else if (row.message_type === 'video') {
      const vidPath = require('path').join(__dirname, '..', row.content || '')
      await wa.sendVideo(jid, vidPath, {}, sockOverride)
    } else {
      await wa.sendText(jid, row.content, sockOverride)
    }
        await pool.query("UPDATE scheduled_messages SET status='sent', sent_at=NOW() WHERE id=?", [row.id])
      } catch (e) {
        console.error('[scheduler] erro ao enviar step ' + row.sequence_step + ' conv ' + row.conversation_id + ':', e.message)
      }
    }
  } catch (e) {
    console.error('[scheduler] erro no tick:', e.message)
  } finally {
    schedPollInFlight = false
  }
}

function start() {
  const INTERVAL_MS = 45000
  setInterval(runTick, INTERVAL_MS)
  console.log('[scheduler] poller iniciado, intervalo ' + INTERVAL_MS + ' ms')
}

module.exports = { start, cancelPending, scheduleSequence, runTick }
