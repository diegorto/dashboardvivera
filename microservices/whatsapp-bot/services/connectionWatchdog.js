// Watchdog em processo (camada RAPIDA/primaria) para as conexoes WhatsApp.
// Roda dentro do proprio bot (nao e um script cron separado), verificando a
// cada CHECK_INTERVAL_MS se alguma linha de whatsapp_connections esta com
// status != 'connected' ha mais de STALE_THRESHOLD_MS - e, se sim, chama
// forceReconnectConnection automaticamente, com cooldown pra nao insistir
// sem parar.
//
// Por que usar o campo `status` e nao `last_seen`: `last_seen` (em
// services/connectionsStore.js) so e escrito no momento em que a conexao
// abre, nao e atualizado continuamente - entao nao serve como "esta viva
// agora?". Ja `status` e mantido em tempo real pelos handlers de
// connection.update em services/sessionManager.js (abre -> 'connected',
// fecha -> 'disconnected'), entao reflete o estado real com atraso minimo.
//
// Limitacao conhecida (registrada, nao resolvida ainda): se o socket travar
// de forma "silenciosa" sem disparar um evento connection.update de fechamento
// (ex.: rede engasgada sem RST), o status no banco pode continuar 'connected'
// mesmo sem a conexao responder de verdade. Cobrir esse caso exigiria rastrear
// erros de envio repetidos nas funcoes sendText/sendAudio/etc, o que ainda nao
// foi implementado - fica como proximo passo se esse cenario voltar a acontecer.
//
// Alerta ao Diego se a reconexao automatica falhar: PENDENTE. Aguardando ele
// confirmar o numero/QR do segundo WhatsApp que sera usado so como canal de
// saida de alerta (isolado do CRM, sem gravar em whatsapp_connections/
// whatsapp_conversations). Ver alertDiegoStub() abaixo.

const pool = require('../db')

const CHECK_INTERVAL_MS = 60 * 1000 // verifica a cada 1 min
const STALE_THRESHOLD_MS = 3 * 60 * 1000 // reconecta se parado ha mais de 3 min
const RECONNECT_COOLDOWN_MS = 2 * 60 * 1000 // nao insiste antes de 2 min entre tentativas pra mesma conexao
const FAILURE_ALERT_THRESHOLD = 3 // apos N tentativas seguidas falhas, considera alerta

const firstBadSeenAt = new Map() // connectionId -> timestamp em que percebeu status != connected
const lastReconnectAttempt = new Map() // connectionId -> timestamp da ultima tentativa
const consecutiveFailures = new Map() // connectionId -> contagem de falhas seguidas

function alertDiegoStub(connectionId, label, failureCount) {
  // TODO (pendente numero/QR do Diego): plugar aqui o envio real via a conexao
  // Baileys separada e minima, so de saida, isolada do CRM.
  console.error(`[watchdog] ALERTA (canal pendente de configuracao): conexao ${connectionId} (${label}) nao reconectou apos ${failureCount} tentativas automaticas.`)
}

async function checkOnce() {
  const wa = require('./whatsapp')
  const now = Date.now()
  let rows
  try {
    const result = await pool.query('SELECT id, label, status FROM whatsapp_connections')
    rows = result[0]
  } catch (e) {
    console.error('[watchdog] erro ao consultar whatsapp_connections:', e.message)
    return
  }

  for (const row of rows) {
    const label = row.label || ('conexao ' + row.id)

    if (row.status === 'connected') {
      firstBadSeenAt.delete(row.id)
      consecutiveFailures.delete(row.id)
      continue
    }

    if (!firstBadSeenAt.has(row.id)) firstBadSeenAt.set(row.id, now)
    const badForMs = now - firstBadSeenAt.get(row.id)
    if (badForMs < STALE_THRESHOLD_MS) continue

    const lastAttempt = lastReconnectAttempt.get(row.id) || 0
    if (now - lastAttempt < RECONNECT_COOLDOWN_MS) continue

    lastReconnectAttempt.set(row.id, now)
    console.log(`[watchdog] conexao ${row.id} (${label}) com status "${row.status}" ha ${Math.round(badForMs / 60000)} min. Forcando reconexao...`)
    let ok = false
    try {
      ok = await wa.forceReconnectConnection(row.id)
    } catch (e) {
      console.error('[watchdog] erro ao forcar reconexao:', e.message)
    }
    console.log(`[watchdog] reconexao forcada da conexao ${row.id}: ${ok ? 'OK' : 'FALHOU'}`)

    if (!ok) {
      const failures = (consecutiveFailures.get(row.id) || 0) + 1
      consecutiveFailures.set(row.id, failures)
      if (failures >= FAILURE_ALERT_THRESHOLD) {
        alertDiegoStub(row.id, label, failures)
      }
    } else {
      consecutiveFailures.delete(row.id)
    }
  }
}

let intervalHandle = null

function startConnectionWatchdog() {
  if (intervalHandle) return
  intervalHandle = setInterval(() => {
    checkOnce().catch(e => console.error('[watchdog] erro no ciclo de verificacao:', e.message))
  }, CHECK_INTERVAL_MS)
  console.log(`[watchdog] monitoramento de conexao iniciado (intervalo=${CHECK_INTERVAL_MS / 1000}s, limiar=${STALE_THRESHOLD_MS / 60000}min)`)
}

module.exports = { startConnectionWatchdog, checkOnce }
