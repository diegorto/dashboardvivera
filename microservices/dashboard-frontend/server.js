require('dotenv').config({ path: __dirname + '/.env' })
const express = require('express')
const axios = require('axios')
const cors = require('cors')
const path = require('path')
const fs = require('fs')

const app = express()
app.use(cors())
app.use(express.json())

// URLs dos microserviços
const SERVICES = {
  meta: process.env.META_SERVER_URL || 'http://localhost:3001',
  google: process.env.GOOGLE_SERVER_URL || 'http://localhost:3002',
  tintim: process.env.TINTIM_SERVER_URL || 'http://localhost:3003',
  pipedrive: process.env.PIPEDRIVE_SERVER_URL || 'http://localhost:3004'
}

// Função para chamar serviço com fallback
async function callService(service, endpoint) {
  try {
    const url = `${SERVICES[service]}${endpoint}`
    const response = await axios.get(url, { timeout: 10000 })
    return response.data
  } catch (error) {
    console.error(`Erro ao chamar ${service}${endpoint}:`, error.message)
    return { error: error.message }
  }
}

// Health check
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    service: 'dashboard-frontend',
    services: {}
  }

  for (const [key, url] of Object.entries(SERVICES)) {
    try {
      const response = await axios.get(`${url}/api/health`, { timeout: 2000 })
      health.services[key] = { status: 'up', url }
    } catch (error) {
      health.services[key] = { status: 'down', url, error: error.message }
    }
  }

  res.json(health)
})

// Endpoint principal que agrega tudo
app.get('/api/dashboard', async (req, res) => {
  try {
    const since = req.query.since
    const until = req.query.until

    if (!since || !until) {
      return res.status(400).json({ error: 'Parâmetros since e until obrigatórios' })
    }

    // Chamar todos os serviços em paralelo
    const [metaAds, googleAds, tintimAudit, pipedriveDeals, pipedriveFunnel, pipedriveRevenue, pipedriveLeadsSemOrigem, pipedriveOutrasFontes] = await Promise.all([
      callService('meta', `/api/ads?since=${since}&until=${until}`),
      callService('google', `/api/ads?since=${since}&until=${until}`),
      callService('tintim', '/api/audit'),
      callService('pipedrive', `/api/deals?since=${since}&until=${until}`),
      callService('pipedrive', `/api/funnel?since=${since}&until=${until}`),
      callService('pipedrive', `/api/revenue?since=${since}&until=${until}`),
      callService('pipedrive', `/api/leads-sem-origem?since=${since}&until=${until}`),
      callService('pipedrive', `/api/outras-fontes?since=${since}&until=${until}`)
    ])

    // Montar resposta agregada
    const dashboard = {
      success: true,
      range: { since, until },

      // Meta Ads
      meta: {
        ads: metaAds.ads || [],
        spend: metaAds.totalSpend || 0,
        leads: metaAds.totalLeads || 0,
        error: metaAds.error
      },

      // Google Ads
      google: {
        ads: googleAds.ads || [],
        spend: googleAds.totalSpend || 0,
        leads: googleAds.totalLeads || 0,
        error: googleAds.error
      },

      // Pipedrive
      pipedrive: {
        deals: pipedriveDeals.deals || [],
        funnel: pipedriveFunnel.funnel || {},
        revenue: pipedriveRevenue.revenue || {},
        leadsSemOrigem: pipedriveLeadsSemOrigem.leads || [],
        leadsOutrasFontes: pipedriveOutrasFontes.leads || [],
        errors: {
          deals: pipedriveDeals.error,
          funnel: pipedriveFunnel.error,
          revenue: pipedriveRevenue.error
        }
      },

      // Tintim
      tintim: {
        audit: tintimAudit.audit || {},
        error: tintimAudit.error
      }
    }

    // Calcular totais agregados
    dashboard.totals = {
      totalLeads: (dashboard.meta.leads || 0) + (dashboard.google.leads || 0) + (pipedriveDeals.count || 0),
      totalSpend: (dashboard.meta.spend || 0) + (dashboard.google.spend || 0),
      totalRevenue: dashboard.pipedrive.revenue?.wonValue || 0
    }

    res.json(dashboard)
  } catch (error) {
    console.error('Erro em /api/dashboard:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Endpoints específicos de cada serviço (passthrough)

app.get('/api/meta/ads', async (req, res) => {
  const data = await callService('meta', `/api/ads?since=${req.query.since}&until=${req.query.until}`)
  res.json(data)
})

app.get('/api/meta/spend', async (req, res) => {
  const data = await callService('meta', `/api/spend?since=${req.query.since}&until=${req.query.until}`)
  res.json(data)
})

app.get('/api/google/ads', async (req, res) => {
  const data = await callService('google', `/api/ads?since=${req.query.since}&until=${req.query.until}`)
  res.json(data)
})

app.get('/api/google/spend', async (req, res) => {
  const data = await callService('google', `/api/spend?since=${req.query.since}&until=${req.query.until}`)
  res.json(data)
})

app.get('/api/pipedrive/deals', async (req, res) => {
  const data = await callService('pipedrive', `/api/deals?since=${req.query.since}&until=${req.query.until}`)
  res.json(data)
})

app.get('/api/pipedrive/funnel', async (req, res) => {
  const data = await callService('pipedrive', `/api/funnel?since=${req.query.since}&until=${req.query.until}`)
  res.json(data)
})

app.get('/api/pipedrive/revenue', async (req, res) => {
  const data = await callService('pipedrive', `/api/revenue?since=${req.query.since}&until=${req.query.until}`)
  res.json(data)
})

app.get('/api/pipedrive/leads-sem-origem', async (req, res) => {
  const data = await callService('pipedrive', `/api/leads-sem-origem?since=${req.query.since}&until=${req.query.until}`)
  res.json(data)
})

app.get('/api/pipedrive/outras-fontes', async (req, res) => {
  const data = await callService('pipedrive', `/api/outras-fontes?since=${req.query.since}&until=${req.query.until}`)
  res.json(data)
})

app.get('/api/pipedrive/meta-leads', async (req, res) => {
  const data = await callService('pipedrive', `/api/meta-leads?since=${req.query.since}&until=${req.query.until}`)
  res.json(data)
})

app.get('/api/tintim/audit', async (req, res) => {
  const data = await callService('tintim', '/api/audit')
  res.json(data)
})

// Meta-Pipedrive integration endpoint
app.get('/api/integration/meta-pipedrive', async (req, res) => {
  try {
    const { since, until } = req.query

    if (!since || !until) {
      return res.status(400).json({ error: 'Parâmetros since e until obrigatórios' })
    }

    // Fetch data from both services in parallel
    const [metaData, pipedriveOutrasFontes] = await Promise.all([
      callService('meta', `/api/ads?since=${since}&until=${until}`),
      callService('pipedrive', `/api/outras-fontes?since=${since}&until=${until}`)
    ])

    // Extract Meta leads (origin 88)
    const metaLeads = pipedriveOutrasFontes.leads?.meta || []

    // Calculate integration metrics
    const integration = {
      period: { since, until },

      meta: {
        spend: metaData.totalSpend || 0,
        impressions: metaData.impressions || 0,
        clicks: metaData.clicks || 0,
        ctr: metaData.ctr || 0,
        cpc: metaData.cpc || 0,
        leads: metaData.totalLeads || 0,
        cpl: metaData.cpl || 0,
        error: metaData.error
      },

      pipedrive: {
        leadsFromMeta: metaLeads.length,
        metaLeads: metaLeads,
        error: pipedriveOutrasFontes.error
      },

      correlation: {
        metaAdLeads: metaData.totalLeads || 0,
        pipedriveMetaLeads: metaLeads.length,
        effectiveCPL: metaLeads.length > 0 ? ((metaData.totalSpend || 0) / metaLeads.length).toFixed(2) : 0,
        conversionRate: (metaData.totalLeads || 0) > 0 ? ((metaLeads.length / (metaData.totalLeads || 1)) * 100).toFixed(2) : 0
      }
    }

    res.json(integration)
  } catch (error) {
    console.error('Erro em /api/integration/meta-pipedrive:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Servir interface web
const webDistPath = path.join(__dirname, '../../web/dist')
const webPublicPath = path.join(__dirname, '../../web')
const dashboardPublicPath = path.join(__dirname, './public')

// Verificar se existe build React
if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath))
  app.get('/', (req, res) => {
    res.sendFile(path.join(webDistPath, 'index.html'))
  })
} else if (fs.existsSync(webPublicPath)) {
  app.use(express.static(webPublicPath))
  app.get('/', (req, res) => {
    res.sendFile(path.join(webPublicPath, 'index.html'))
  })
} else if (fs.existsSync(dashboardPublicPath)) {
  app.use(express.static(dashboardPublicPath))
  app.get('/', (req, res) => {
    res.sendFile(path.join(dashboardPublicPath, 'dashboard.html'))
  })
} else {
  // Página de boas-vindas simplificada
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Vivera Dashboard - Meta & Pipedrive Integration</title>
        <style>
          body { font-family: Arial; margin: 40px; background: #f5f5f5; }
          .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          h1 { color: #333; }
          .status { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
          .status-box { padding: 15px; border-radius: 4px; background: #f9f9f9; border-left: 4px solid #4CAF50; }
          .status-box h3 { margin: 0 0 10px 0; }
          .endpoint { background: #f0f0f0; padding: 10px; margin: 5px 0; border-radius: 3px; font-family: monospace; }
          a { color: #2196F3; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 Vivera Dashboard - Meta & Pipedrive Integration</h1>

          <h2>✅ Status dos Serviços</h2>
          <div class="status">
            <div class="status-box">
              <h3>Meta Server</h3>
              <p>Port: 3001</p>
              <p>Status: <strong>✅ Online</strong></p>
            </div>
            <div class="status-box">
              <h3>Pipedrive Server</h3>
              <p>Port: 3004</p>
              <p>Status: <strong>✅ Online</strong></p>
            </div>
            <div class="status-box">
              <h3>Google Server</h3>
              <p>Port: 3002</p>
              <p>Status: <strong>✅ Online</strong></p>
            </div>
            <div class="status-box">
              <h3>Tintim Server</h3>
              <p>Port: 3003</p>
              <p>Status: <strong>✅ Online</strong></p>
            </div>
          </div>

          <h2>📊 Endpoints Disponíveis</h2>

          <h3>Health Check</h3>
          <div class="endpoint"><a href="/api/health">/api/health</a></div>

          <h3>Dashboard Agregado</h3>
          <div class="endpoint"><a href="/api/dashboard?since=2026-07-01&until=2026-07-13">/api/dashboard?since=2026-07-01&until=2026-07-13</a></div>

          <h3>Meta-Pipedrive Integration 🔥</h3>
          <div class="endpoint"><a href="/api/integration/meta-pipedrive?since=2026-07-01&until=2026-07-13">/api/integration/meta-pipedrive?since=2026-07-01&until=2026-07-13</a></div>
          <p>Correlação entre gasto em Meta e leads gerados no Pipedrive</p>

          <h3>Meta Leads Details</h3>
          <div class="endpoint"><a href="/api/pipedrive/meta-leads?since=2026-07-01&until=2026-07-13">/api/pipedrive/meta-leads?since=2026-07-01&until=2026-07-13</a></div>

          <h3>Outros Endpoints</h3>
          <div class="endpoint">/api/pipedrive/deals?since=YYYY-MM-DD&until=YYYY-MM-DD</div>
          <div class="endpoint">/api/pipedrive/funnel?since=YYYY-MM-DD&until=YYYY-MM-DD</div>
          <div class="endpoint">/api/pipedrive/revenue?since=YYYY-MM-DD&until=YYYY-MM-DD</div>
          <div class="endpoint">/api/pipedrive/outras-fontes?since=YYYY-MM-DD&until=YYYY-MM-DD</div>

          <hr>
          <p><strong>Porta:</strong> 3010</p>
          <p><strong>Versão:</strong> 1.0.0 - Meta-Pipe API Integration</p>
        </div>
      </body>
      </html>
    `)
  })
}

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Dashboard Frontend rodando em porta ${PORT}`)
  console.log('\nMicroserviços configurados:')
  Object.entries(SERVICES).forEach(([key, url]) => {
    console.log(`  ${key}: ${url}`)
  })
  console.log('\nEndpoints disponíveis:')
  console.log('  GET /api/health - Health check de todos os serviços')
  console.log('  GET /api/dashboard?since=YYYY-MM-DD&until=YYYY-MM-DD - Dashboard agregado')
  console.log('  GET /api/integration/meta-pipedrive?since=YYYY-MM-DD&until=YYYY-MM-DD - Meta-Pipedrive integration')
})
