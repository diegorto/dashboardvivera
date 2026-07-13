require('dotenv').config()
const express = require('express')
const axios = require('axios')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

const TINTIM_ACCOUNT_CODE = process.env.TINTIM_ACCOUNT_CODE
const TINTIM_ACCOUNT_TOKEN = process.env.TINTIM_ACCOUNT_TOKEN

// In-memory cache
let cache = {
  audit: null,
  timestamp: 0
}

const CACHE_TTL = 3600000 // 1 hour

async function getTintimAudit() {
  try {
    if (!TINTIM_ACCOUNT_CODE || !TINTIM_ACCOUNT_TOKEN) {
      console.warn('Tintim credentials not configured')
      return { audit: {}, error: 'Tintim credentials not configured' }
    }

    // TODO: Implement actual Tintim API call
    // This is a placeholder for the Tintim audit endpoint
    const auditData = {
      totalCalls: 0,
      totalDuration: 0,
      averageDuration: 0,
      successRate: 0,
      failureCount: 0
    }

    return { audit: auditData }
  } catch (error) {
    console.error('Error fetching Tintim audit:', error.message)
    return { audit: {}, error: error.message }
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'up',
    service: 'tintim-server',
    port: process.env.PORT || 3003,
    configured: !!TINTIM_ACCOUNT_CODE && !!TINTIM_ACCOUNT_TOKEN
  })
})

// Get audit endpoint
app.get('/api/audit', async (req, res) => {
  try {
    const now = Date.now()

    // Check cache
    if (cache.audit && now - cache.timestamp < CACHE_TTL) {
      console.log('Returning cached audit data')
      return res.json(cache.audit)
    }

    const data = await getTintimAudit()

    // Update cache
    cache.audit = data
    cache.timestamp = now

    res.json(data)
  } catch (error) {
    console.error('Error in /api/audit:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Validate phone endpoint
app.post('/api/validate-phone', (req, res) => {
  try {
    const { phone } = req.body

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' })
    }

    // TODO: Implement actual phone validation via Tintim API
    res.json({
      phone,
      valid: true,
      validated: false,
      note: 'Tintim phone validation pending implementation'
    })
  } catch (error) {
    console.error('Error in /api/validate-phone:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Report endpoint
app.get('/api/report', (req, res) => {
  res.json({
    totalValidated: 0,
    successRate: 0,
    failureRate: 0,
    note: 'Tintim report pending implementation'
  })
})

const PORT = process.env.PORT || 3003
app.listen(PORT, () => {
  console.log(`Tintim Server running on port ${PORT}`)
  console.log(`Account Code configured: ${!!TINTIM_ACCOUNT_CODE}`)
  console.log(`Account Token configured: ${!!TINTIM_ACCOUNT_TOKEN}`)
})
