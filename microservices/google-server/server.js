require('dotenv').config()
const express = require('express')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

const GOOGLE_ADS_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID
const GOOGLE_ADS_API_KEY = process.env.GOOGLE_ADS_API_KEY

// In-memory cache
let cache = {
  ads: null,
  spend: null,
  timestamp: 0
}

const CACHE_TTL = 3600000 // 1 hour

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'up',
    service: 'google-server',
    port: process.env.PORT || 3002,
    configured: !!GOOGLE_ADS_CUSTOMER_ID && !!GOOGLE_ADS_API_KEY,
    note: 'Google Ads API integration pending implementation'
  })
})

// Get ads endpoint
app.get('/api/ads', (req, res) => {
  res.json({
    ads: [],
    note: 'TODO: Implement Google Ads API integration'
  })
})

// Get spend endpoint
app.get('/api/spend', (req, res) => {
  res.json({
    totalSpend: 0,
    totalLeads: 0,
    cpl: 0,
    cpc: 0,
    ctr: 0,
    note: 'TODO: Implement Google Ads API integration'
  })
})

// Get insights endpoint
app.get('/api/insights', (req, res) => {
  res.json({
    cpl: 0,
    cpc: 0,
    ctr: 0,
    impressions: 0,
    clicks: 0,
    spend: 0,
    note: 'TODO: Implement Google Ads API integration'
  })
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log(`Google Server running on port ${PORT}`)
  console.log(`Customer ID configured: ${!!GOOGLE_ADS_CUSTOMER_ID}`)
  console.log(`API Key configured: ${!!GOOGLE_ADS_API_KEY}`)
  console.log('Note: Google Ads API integration pending implementation')
})
