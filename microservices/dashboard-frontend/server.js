require('dotenv').config()
const express = require('express')
const axios = require('axios')
const cors = require('cors')

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

app.get('/api/tintim/audit', async (req, res) => {
  const data = await callService('tintim', '/api/audit')
  res.json(data)
})

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
})
