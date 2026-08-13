require('dotenv').config()
const path = require('path')
const express = require('express')
const ai = require('./services/ai')
const wa = require('./services/whatsapp')
const apiRoutes = require('./routes/api')
const scheduler = require('./services/scheduler')
const monthlyFlow = require('./services/monthlyFlow')
const cadenceEngine = require('./services/cadenceEngine')
const fluxoInicial = require('./services/fluxoInicial')

const app = express()
app.use(express.json({ limit: '2mb' }))

app.get('/health', (req, res) => res.json({ ok: true, service: 'vivera-whatsapp-bot' }))

app.use('/assets/monthly', express.static(path.join(__dirname, 'assets/monthly')))
app.use('/api', apiRoutes)

const PORT = process.env.PORT || 3010

async function main() {
  await ai.seedDefaultConfig()
  app.listen(PORT, '127.0.0.1', () => console.log(`[whatsapp-bot] rodando na porta ${PORT} (127.0.0.1)`))
// FIX 2026-08-05: crm-proxy agora roda em container Docker e acessa via host.docker.internal -> 172.17.0.1.
// O bind original só em 127.0.0.1 rejeitava essas conexões (ECONNREFUSED). Escutando tambem no gateway
// docker (sem expor 0.0.0.0/publico) para restaurar o acesso do crm-proxy.
app.listen(PORT, '172.17.0.1', () => console.log(`[whatsapp-bot] rodando na porta ${PORT} (172.17.0.1 - docker bridge)`))
  scheduler.start()
  monthlyFlow.start()
cadenceEngine.start()
// PAUSADO A PEDIDO DO DIEGO 2026-08-12 - NAO enviar fluxo inicial pra quem ja tem cadastro (pessoa/deal); reativar so apos fix
// PAUSADO A PEDIDO DO DIEGO 2026-08-13 - fluxoInicial resetou deals antigos de volta pra Entrada de novo (mesmo bug de antes). Investigar causa raiz antes de reativar.
// fluxoInicial.start()
try { require('./services/connectionWatchdog').startConnectionWatchdog() } catch (e) { console.error('[server] erro ao iniciar watchdog de conexao:', e.message) }
  wa.startSocket().catch(e => console.error('[whatsapp-bot] erro ao iniciar socket WhatsApp:', e.message))
  // DESATIVADO 2026-08-07: sessionManager.startAll() cria um segundo socket Baileys independente (auth_sessions/conn_*) para o MESMO numero que o whatsapp.js legado usa (auth_session/), brigando pela mesma sessao do WhatsApp e causando Connection Closed em loop. So reativar apos sessionManager ser integrado como unico dono da conexao real.
// require('./services/sessionManager').startAll().catch(e => console.error('[whatsapp-bot] erro ao iniciar sessionManager:', e.message))
}

main().catch(e => { console.error('[whatsapp-bot] erro fatal ao iniciar:', e); process.exit(1) })

process.on('unhandledRejection', (e) => console.error('[whatsapp-bot] unhandledRejection:', e))
