// Healthcheck externo (cron, roda a cada 5 min) para o bot WhatsApp Vivera.
// Detecta se a conexao ativa (tabela whatsapp_connections) ficou sem atualizar
// por mais de DISCONNECT_THRESHOLD_MS seguidos, grava estado em logs/.health-state.json
// e alerta (por enquanto so em log local) em logs/whatsapp-health-alerts.log.
//
// CORRIGIDO EM 2026-08-06: antes este script consultava a tabela legada
// whatsapp_sessions (session_name='default'), que ficou orfa desde a troca de
// numero em 2026-07-31 e nunca mais foi atualizada - por isso ele vinha alertando
// "desconectado" continuamente ha dias mesmo com o bot funcionando normalmente.
// Agora consulta whatsapp_connections, a tabela realmente usada em producao.
//
// Este script e a camada EXTERNA/lenta de seguranca. A camada primaria e o
// watchdog em processo (services/connectionWatchdog.js), que roda a cada 1 min
// dentro do proprio bot e tenta reconectar sozinho via forceReconnectConnection.
// Este cron so deve disparar alerta se mesmo assim a conexao continuar parada -
// ou seja, se o watchdog em processo tambem falhou (ou o processo inteiro caiu).
//
// Diego ainda nao definiu canal de notificacao ativo (WhatsApp de outro numero
// confirmado, pendente de numero/QR) - por enquanto o alerta so fica registrado
// neste log. Quando o canal estiver pronto, plugar o envio aqui em appendAlert().
const fs = require('fs')
const path = require('path')
const pool = require('../db')

const STATE_FILE = path.join(__dirname, '..', 'logs', '.health-state.json')
const ALERT_LOG = path.join(__dirname, '..', 'logs', 'whatsapp-health-alerts.log')
const DISCONNECT_THRESHOLD_MS = 5 * 60 * 1000 // 5 min (camada externa/lenta; a camada rapida e o watchdog em processo, com limiar de 3 min)
const REALERT_INTERVAL_MS = 60 * 60 * 1000 // reenviar alerta no maximo 1x por hora por conexao, pra nao floodar

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  } catch (e) {
    return {}
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function appendAlert(msg) {
  fs.mkdirSync(path.dirname(ALERT_LOG), { recursive: true })
  fs.appendFileSync(ALERT_LOG, `[ALERT ${new Date().toISOString()}] ${msg}\n`)
  // TODO (pendente confirmacao do Diego): quando o canal de alerta via WhatsApp de
  // outro numero estiver pronto, disparar o envio real aqui.
}

async function main() {
  const allState = loadState()
  const now = Date.now()

  const [rows] = await pool.query('SELECT id, label, status, last_seen FROM whatsapp_connections')

  for (const row of rows) {
    const key = 'conn_' + row.id
    const state = allState[key] || { lastConnectedAt: null, alertedSince: null }
    const lastSeenMs = row.last_seen ? new Date(row.last_seen).getTime() : 0
    const label = row.label || ('conexao ' + row.id)

    // NOTA: last_seen so e atualizado no momento em que a conexao abre (ver
    // services/connectionsStore.js), nao e um heartbeat continuo. Por isso o
    // criterio de saude usa APENAS o campo status (mantido em tempo real pelos
    // handlers de connection.update em sessionManager.js), nao a idade de last_seen -
    // senao qualquer conexao estavel e de longa duracao seria marcada como parada.
    if (row.status === 'connected') {
      state.lastConnectedAt = now
      state.alertedSince = null
    } else {
      if (!state.lastConnectedAt) state.lastConnectedAt = lastSeenMs || now
      const downMs = now - state.lastConnectedAt
      if (downMs > DISCONNECT_THRESHOLD_MS) {
        const shouldAlert = !state.alertedSince || (now - state.alertedSince) > REALERT_INTERVAL_MS
        if (shouldAlert) {
          appendAlert(`Bot WhatsApp Vivera - ${label} (id ${row.id}) parado ha ${Math.round(downMs / 60000)} min. Watchdog em processo pode ja ter tentado reconectar sem sucesso.`)
          state.alertedSince = now
        }
      }
    }
    allState[key] = state
  }

  saveState(allState)
  process.exit(0)
}

main().catch(e => {
  console.error('[healthcheck] erro:', e.message)
  process.exit(1)
})
