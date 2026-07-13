require('dotenv').config()
const express = require('express')
const axios = require('axios')
const cors = require('cors')
const fs = require('fs')
const path = require('path')

const app = express()
app.use(cors())
app.use(express.json())

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_TOKEN
const PIPEDRIVE_COMPANY_DOMAIN = process.env.PIPEDRIVE_COMPANY_DOMAIN

// Field IDs for custom fields
const FIELD_IDS = {
  origem: '8f6c0d628186f9c3', // Lead origin
  campanha: 'fddf8c3ce41ddbe3b', // Campaign
  plataforma: 'f4acd3c88186f85f3', // Platform
  telefone: 'b16e85fb48bcd8aa2', // Phone
  procedimento: 'fbad34a3f748339c2' // Procedure
}

// Pipeline IDs
const PIPELINE_IDS = {
  inbound: 1,
  recepcao: 2,
  agendado: 5
}

// In-memory cache
let cache = {
  deals: null,
  timestamp: 0
}

const CACHE_TTL = 3600000 // 1 hour
const CACHE_FILE = path.join(__dirname, 'data', 'deals-cache.json')

function ensureCacheDir() {
  const dir = path.dirname(CACHE_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function readCacheFile() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error reading cache file:', error.message)
  }
  return null
}

function writeCacheFile(data) {
  try {
    ensureCacheDir()
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error writing cache file:', error.message)
  }
}

async function fetchAllDeals() {
  try {
    if (!PIPEDRIVE_TOKEN || !PIPEDRIVE_COMPANY_DOMAIN) {
      console.warn('Pipedrive credentials not configured')
      return []
    }

    const baseUrl = `https://${PIPEDRIVE_COMPANY_DOMAIN}.pipedrive.com/v1/deals`
    const deals = []
    let start = 0
    const limit = 500

    console.log('Fetching deals from Pipedrive...')

    while (true) {
      try {
        const response = await axios.get(baseUrl, {
          params: {
            api_token: PIPEDRIVE_TOKEN,
            start,
            limit,
            status: 'all'
          },
          timeout: 10000
        })

        if (response.data.success && response.data.data) {
          deals.push(...response.data.data)
          console.log(`Fetched ${response.data.data.length} deals (total: ${deals.length})`)

          if (!response.data.additional_data || !response.data.additional_data.pagination || !response.data.additional_data.pagination.more_items_in_collection) {
            break
          }

          start = response.data.additional_data.pagination.next_start
        } else {
          break
        }
      } catch (error) {
        console.error('Error fetching deals batch:', error.message)
        break
      }
    }

    console.log(`Total deals fetched: ${deals.length}`)
    return deals
  } catch (error) {
    console.error('Error in fetchAllDeals:', error.message)
    return []
  }
}

function classifyLeadSource(deal) {
  try {
    const origem = deal[FIELD_IDS.origem]

    if (origem === 87) return 'indicacao'
    if (origem === 88) return 'meta'

    // Fallback to text-based classification
    const title = deal.title ? deal.title.toLowerCase() : ''
    const person_name = deal.person_id?.name ? deal.person_id.name.toLowerCase() : ''

    if (title.includes('instagram') || title.includes('meta') || person_name.includes('instagram')) {
      return 'meta'
    }
    if (title.includes('indicação') || title.includes('indicacao')) {
      return 'indicacao'
    }

    return 'outra'
  } catch (error) {
    console.error('Error classifying lead source:', error.message)
    return 'outra'
  }
}

function inRange(deal, since, until) {
  try {
    if (!deal.add_time) return false

    const dealDate = new Date(deal.add_time).toISOString().split('T')[0]
    return dealDate >= since && dealDate <= until
  } catch (error) {
    console.error('Error checking date range:', error.message)
    return false
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'up',
    service: 'pipedrive-server',
    port: process.env.PORT || 3004,
    configured: !!PIPEDRIVE_TOKEN && !!PIPEDRIVE_COMPANY_DOMAIN
  })
})

// Get deals endpoint
app.get('/api/deals', async (req, res) => {
  try {
    const { since, until } = req.query

    if (!since || !until) {
      return res.status(400).json({ error: 'Parameters since and until are required' })
    }

    const now = Date.now()
    let deals = []

    // Check memory cache first
    if (cache.deals && now - cache.timestamp < CACHE_TTL) {
      console.log('Using memory cache for deals')
      deals = cache.deals
    } else {
      // Check file cache
      const fileCached = readCacheFile()
      if (fileCached && fileCached.timestamp && now - fileCached.timestamp < CACHE_TTL) {
        console.log('Using file cache for deals')
        deals = fileCached.deals
        cache.deals = deals
        cache.timestamp = fileCached.timestamp
      } else {
        // Fetch from API
        deals = await fetchAllDeals()
        if (deals.length > 0) {
          cache.deals = deals
          cache.timestamp = now
          writeCacheFile({ deals, timestamp: now })
        }
      }
    }

    // Filter by date range
    const filtered = deals.filter(deal => inRange(deal, since, until))

    res.json({
      deals: filtered,
      count: filtered.length
    })
  } catch (error) {
    console.error('Error in /api/deals:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Get funnel endpoint
app.get('/api/funnel', async (req, res) => {
  try {
    const { since, until } = req.query

    if (!since || !until) {
      return res.status(400).json({ error: 'Parameters since and until are required' })
    }

    const now = Date.now()
    let deals = cache.deals

    if (!deals || now - cache.timestamp >= CACHE_TTL) {
      deals = await fetchAllDeals()
      cache.deals = deals
      cache.timestamp = now
    }

    const filtered = deals.filter(deal => inRange(deal, since, until))

    const funnel = {
      total: 0,
      inbound: 0,
      recepcao: 0,
      agendado: 0
    }

    filtered.forEach(deal => {
      funnel.total++
      if (deal.pipeline_id === PIPELINE_IDS.inbound) funnel.inbound++
      if (deal.pipeline_id === PIPELINE_IDS.recepcao) funnel.recepcao++
      if (deal.pipeline_id === PIPELINE_IDS.agendado) funnel.agendado++
    })

    res.json({ funnel })
  } catch (error) {
    console.error('Error in /api/funnel:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Get pipeline endpoint
app.get('/api/pipeline', async (req, res) => {
  try {
    const { since, until, pipelineId } = req.query

    if (!since || !until) {
      return res.status(400).json({ error: 'Parameters since and until are required' })
    }

    const now = Date.now()
    let deals = cache.deals

    if (!deals || now - cache.timestamp >= CACHE_TTL) {
      deals = await fetchAllDeals()
      cache.deals = deals
      cache.timestamp = now
    }

    let filtered = deals.filter(deal => inRange(deal, since, until))

    if (pipelineId) {
      filtered = filtered.filter(deal => deal.pipeline_id === parseInt(pipelineId))
    }

    res.json({
      deals: filtered,
      count: filtered.length,
      pipelineId: pipelineId || 'all'
    })
  } catch (error) {
    console.error('Error in /api/pipeline:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Get revenue endpoint
app.get('/api/revenue', async (req, res) => {
  try {
    const { since, until } = req.query

    if (!since || !until) {
      return res.status(400).json({ error: 'Parameters since and until are required' })
    }

    const now = Date.now()
    let deals = cache.deals

    if (!deals || now - cache.timestamp >= CACHE_TTL) {
      deals = await fetchAllDeals()
      cache.deals = deals
      cache.timestamp = now
    }

    const filtered = deals.filter(deal => inRange(deal, since, until))

    let total = 0
    let won = 0
    let wonValue = 0

    filtered.forEach(deal => {
      const value = deal.value || 0
      total += value
      if (deal.status === 'won') {
        won++
        wonValue += value
      }
    })

    res.json({
      revenue: {
        total,
        won,
        wonValue,
        averageValue: filtered.length > 0 ? (total / filtered.length).toFixed(2) : 0
      }
    })
  } catch (error) {
    console.error('Error in /api/revenue:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Get leads by origin endpoint (sem origem = leads-sem-origem)
app.get('/api/leads-sem-origem', async (req, res) => {
  try {
    const { since, until } = req.query

    if (!since || !until) {
      return res.status(400).json({ error: 'Parameters since and until are required' })
    }

    const now = Date.now()
    let deals = cache.deals

    if (!deals || now - cache.timestamp >= CACHE_TTL) {
      deals = await fetchAllDeals()
      cache.deals = deals
      cache.timestamp = now
    }

    // Get ALL deals in range (not just pipeline 1) for lead classification
    const allDealsInRange = deals.filter(deal => inRange(deal, since, until))

    // Filter deals where origem is not 87 (indicacao) and not 88 (meta)
    const leadsSemOrigem = allDealsInRange.filter(deal => {
      const origem = deal[FIELD_IDS.origem]
      return origem !== 87 && origem !== 88
    })

    res.json({
      leads: leadsSemOrigem,
      count: leadsSemOrigem.length
    })
  } catch (error) {
    console.error('Error in /api/leads-sem-origem:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Get leads by other sources endpoint
app.get('/api/outras-fontes', async (req, res) => {
  try {
    const { since, until } = req.query

    if (!since || !until) {
      return res.status(400).json({ error: 'Parameters since and until are required' })
    }

    const now = Date.now()
    let deals = cache.deals

    if (!deals || now - cache.timestamp >= CACHE_TTL) {
      deals = await fetchAllDeals()
      cache.deals = deals
      cache.timestamp = now
    }

    // Get ALL deals in range for classification
    const allDealsInRange = deals.filter(deal => inRange(deal, since, until))

    // Classify leads by source
    const leadsBySource = {}

    allDealsInRange.forEach(deal => {
      const source = classifyLeadSource(deal)
      if (!leadsBySource[source]) {
        leadsBySource[source] = []
      }
      leadsBySource[source].push(deal)
    })

    res.json({
      leads: leadsBySource,
      count: allDealsInRange.length,
      sources: Object.keys(leadsBySource).reduce((acc, key) => {
        acc[key] = leadsBySource[key].length
        return acc
      }, {})
    })
  } catch (error) {
    console.error('Error in /api/outras-fontes:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Get Meta leads with metrics endpoint
app.get('/api/meta-leads', async (req, res) => {
  try {
    const { since, until } = req.query

    if (!since || !until) {
      return res.status(400).json({ error: 'Parameters since and until are required' })
    }

    const now = Date.now()
    let deals = cache.deals

    if (!deals || now - cache.timestamp >= CACHE_TTL) {
      deals = await fetchAllDeals()
      cache.deals = deals
      cache.timestamp = now
    }

    // Get all deals from Meta source (origin 88)
    const allDealsInRange = deals.filter(deal => inRange(deal, since, until))
    const metaLeads = allDealsInRange.filter(deal => deal[FIELD_IDS.origem] === 88)

    // Calculate metrics
    const metrics = {
      totalMetaLeads: metaLeads.length,
      byPipeline: {
        inbound: 0,
        recepcao: 0,
        agendado: 0,
        other: 0
      },
      byStatus: {
        open: 0,
        won: 0,
        lost: 0
      },
      revenue: {
        total: 0,
        won: 0,
        wonCount: 0
      }
    }

    metaLeads.forEach(deal => {
      // Count by pipeline
      if (deal.pipeline_id === PIPELINE_IDS.inbound) metrics.byPipeline.inbound++
      else if (deal.pipeline_id === PIPELINE_IDS.recepcao) metrics.byPipeline.recepcao++
      else if (deal.pipeline_id === PIPELINE_IDS.agendado) metrics.byPipeline.agendado++
      else metrics.byPipeline.other++

      // Count by status
      if (deal.status === 'open') metrics.byStatus.open++
      else if (deal.status === 'won') metrics.byStatus.won++
      else if (deal.status === 'lost') metrics.byStatus.lost++

      // Calculate revenue
      const value = deal.value || 0
      metrics.revenue.total += value
      if (deal.status === 'won') {
        metrics.revenue.won += value
        metrics.revenue.wonCount++
      }
    })

    metrics.revenue.averageValue = metaLeads.length > 0 ? (metrics.revenue.total / metaLeads.length).toFixed(2) : 0

    res.json({
      leads: metaLeads,
      metrics,
      count: metaLeads.length
    })
  } catch (error) {
    console.error('Error in /api/meta-leads:', error.message)
    res.status(500).json({ error: error.message })
  }
})

const PORT = process.env.PORT || 3004
app.listen(PORT, () => {
  console.log(`Pipedrive Server running on port ${PORT}`)
  console.log(`Token configured: ${!!PIPEDRIVE_TOKEN}`)
  console.log(`Company domain: ${PIPEDRIVE_COMPANY_DOMAIN}`)
  console.log('\nEndpoints available:')
  console.log('  GET /api/health - Health check')
  console.log('  GET /api/deals?since=YYYY-MM-DD&until=YYYY-MM-DD - Get deals')
  console.log('  GET /api/funnel?since=YYYY-MM-DD&until=YYYY-MM-DD - Get funnel data')
  console.log('  GET /api/pipeline?since=YYYY-MM-DD&until=YYYY-MM-DD - Get pipeline data')
  console.log('  GET /api/revenue?since=YYYY-MM-DD&until=YYYY-MM-DD - Get revenue')
  console.log('  GET /api/leads-sem-origem?since=YYYY-MM-DD&until=YYYY-MM-DD - Leads without origin')
  console.log('  GET /api/outras-fontes?since=YYYY-MM-DD&until=YYYY-MM-DD - Leads by source')
  console.log('  GET /api/meta-leads?since=YYYY-MM-DD&until=YYYY-MM-DD - Meta leads with metrics')
})
