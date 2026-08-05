// Healthcheck do bot WhatsApp (Vivera), independente de qualquer sessao de IA/dispatch.
// Roda via cron a cada 5 minutos DIRETO no VPS (nao depende do Claude estar ativo).
// Consulta o status salvo em whatsapp_sessions e, se ficar diferente de "connected"
// por mais de 15 minutos seguidos, grava um alerta bem visivel em
// logs/whatsapp-health-alerts.log. Por enquanto e so log (sem webhook/email -
// Diego ainda nao definiu canal de notificacao externo).
const fs = require('fs')
const path = require('path')
const pool = require('../db')

const STATE_FILE = path.join(__dirname, '..', 'logs', '.health-state.json')
const ALERT_LOG = path.join(__dirname, '..', 'logs', 'whatsapp-health-alerts.log')
const DISCONNECT_THRESHOLD_MS = 15 * 60 * 1000
const REALERT_INTERVAL_MS = 60 * 60 * 1000

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  } catch (e) {
    return { lastConnectedAt: null, alertedSince: null }
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
  fs.writeFileSync(STATE_FILE, JSON.stringify(state))
}

function appendAlert(msg) {
  fs.mkdirSync(path.dirname(ALERT_LOG), { recursive: true })
  fs.appendFileSync(ALERT_LOG, `[ALERT ${new Date().toISOString()}] ${msg}\n`)
}

async function main() {
  const state = loadState()
  const now = Date.now()

  const [rows] = await pool.query(
    "SELECT status, updated_at FROM whatsapp_sessions WHERE session_name = 'default' LIMIT 1"
  )
  const status = rows[0] ? rows[0].status : 'sem_registro'

  if (status === 'connected') {
    state.lastConnectedAt = now
    state.alertedSince = null
  } else {
    if (!state.lastConnectedAt) state.lastConnectedAt = now
    const downMs = now - state.lastConnectedAt
    if (downMs > DISCONNECT_THRESHOLD_MS) {
      const minutes = Math.round(downMs / 60000)
      if (!state.alertedSince) {
        appendAlert(`Bot WhatsApp Vivera com status "${status}" ha ${minutes} min (> 15min). Verifique pm2 (vivera-whatsapp-bot) e os logs.`)
        state.alertedSince = now
      } else if (now - state.alertedSince > REALERT_INTERVAL_MS) {
        appendAlert(`Bot WhatsApp Vivera AINDA com status "${status}" ha ${minutes} min. Segue desconectado (alerta repetido).`)
        state.alertedSince = now
      }
    }
  }

  saveState(state)
  process.exit(0)
}

main().catch(e => {
  appendAlert(`Healthcheck falhou ao rodar: ${e.message}`)
  process.exit(1)
})
