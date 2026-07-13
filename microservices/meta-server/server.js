require('dotenv').config()
const express = require('express')
const axios = require('axios')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN
const FB_AD_ACCOUNT_IDS = process.env.FB_AD_ACCOUNT_IDS ? process.env.FB_AD_ACCOUNT_IDS.split(',') : []

// In-memory cache
let cache = {
  ads: null,
  spend: null,
  timestamp: 0
}

const CACHE_TTL = 3600000 // 1 hour

async function getMetaAds(since, until) {
  try {
    if (!FB_ACCESS_TOKEN || FB_AD_ACCOUNT_IDS.length === 0) {
      console.warn('Meta credentials not configured')
      return { ads: [], error: 'Meta credentials not configured' }
    }

    const allAds = []
    const insights = {
      totalSpend: 0,
      totalLeads: 0,
      cpl: 0,
      cpc: 0,
      ctr: 0,
      impressions: 0,
      clicks: 0,
      actions: 0
    }

    // Iterate through each ad account
    for (const accountId of FB_AD_ACCOUNT_IDS) {
      try {
        const cleanAccountId = accountId.replace(/^act_/, '')
        const fields = 'id,name,status,effective_status,campaign_id,campaign{name},adset_id,adset{name},creative{thumbnail_url,object_story_spec}'
        const timeRangeParam = JSON.stringify({ since, until })

        const url = `https://graph.facebook.com/v18.0/act_${cleanAccountId}/ads`
        const params = {
          access_token: FB_ACCESS_TOKEN,
          fields: `${fields},insights.time_range(${timeRangeParam}){spend,actions,impressions,clicks}`,
          limit: 200
        }

        const response = await axios.get(url, { params, timeout: 10000 })

        if (response.data.data) {
          response.data.data.forEach(ad => {
            const insight = ad.insights && ad.insights.data && ad.insights.data[0]
            if (!insight) return

            const spend = parseFloat(insight.spend || 0)
            insights.totalSpend += spend
            insights.clicks += parseInt(insight.clicks || 0)
            insights.impressions += parseInt(insight.impressions || 0)

            if (insight.actions && Array.isArray(insight.actions)) {
              insight.actions.forEach(action => {
                if (action.action_type === 'lead') {
                  insights.totalLeads += parseInt(action.value || 0)
                }
              })
            }

            allAds.push(ad)
          })
        }
      } catch (error) {
        console.error(`Error fetching data for account ${accountId}:`, error.message)
      }
    }

    // Calculate metrics
    if (insights.impressions > 0 && insights.clicks > 0) {
      insights.ctr = ((insights.clicks / insights.impressions) * 100).toFixed(2)
      insights.cpc = (insights.totalSpend / insights.clicks).toFixed(2)
    }
    if (insights.totalLeads > 0) {
      insights.cpl = (insights.totalSpend / insights.totalLeads).toFixed(2)
    }

    return {
      ads: allAds,
      ...insights
    }
  } catch (error) {
    console.error('Error fetching Meta ads:', error.message)
    return { ads: [], error: error.message }
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'up',
    service: 'meta-server',
    port: process.env.PORT || 3001,
    configured: !!FB_ACCESS_TOKEN && FB_AD_ACCOUNT_IDS.length > 0
  })
})

// Get ads endpoint
app.get('/api/ads', async (req, res) => {
  try {
    const { since, until } = req.query

    if (!since || !until) {
      return res.status(400).json({ error: 'Parameters since and until are required' })
    }

    const cacheKey = `${since}-${until}`
    const now = Date.now()

    // Check cache
    if (cache.ads && cache.ads.key === cacheKey && now - cache.timestamp < CACHE_TTL) {
      console.log('Returning cached ads data')
      return res.json(cache.ads.data)
    }

    const data = await getMetaAds(since, until)

    // Update cache
    cache.ads = { key: cacheKey, data }
    cache.timestamp = now

    res.json(data)
  } catch (error) {
    console.error('Error in /api/ads:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Get spend endpoint
app.get('/api/spend', async (req, res) => {
  try {
    const { since, until } = req.query

    if (!since || !until) {
      return res.status(400).json({ error: 'Parameters since and until are required' })
    }

    const data = await getMetaAds(since, until)

    res.json({
      totalSpend: data.totalSpend || 0,
      totalLeads: data.totalLeads || 0,
      cpl: data.cpl || 0,
      cpc: data.cpc || 0,
      ctr: data.ctr || 0
    })
  } catch (error) {
    console.error('Error in /api/spend:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Get insights endpoint
app.get('/api/insights', async (req, res) => {
  try {
    const { since, until } = req.query

    if (!since || !until) {
      return res.status(400).json({ error: 'Parameters since and until are required' })
    }

    const data = await getMetaAds(since, until)

    res.json({
      cpl: data.cpl,
      cpc: data.cpc,
      ctr: data.ctr,
      impressions: data.impressions,
      clicks: data.clicks,
      spend: data.totalSpend
    })
  } catch (error) {
    console.error('Error in /api/insights:', error.message)
    res.status(500).json({ error: error.message })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Meta Server running on port ${PORT}`)
  console.log(`Access Token configured: ${!!FB_ACCESS_TOKEN}`)
  console.log(`Ad Account IDs: ${FB_AD_ACCOUNT_IDS.join(', ')}`)
})
