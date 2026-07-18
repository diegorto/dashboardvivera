// ARQUITETURA DEFINITIVA do Google Ads no dashboard:
// le metricas de um cache local (data/google_ads_cache.json) alimentado de hora em hora pelo
// Google Ads Script 'Vivera Dashboard Sync' (roda dentro da propria conta, POST /api/webhooks/google-ads).
// Sem developer token / Basic access. Mesma interface dos services anteriores (troca por 1 linha no server.js).
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'data', 'google_ads_cache.json');

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[googleAdsCache] Erro ao ler cache:', e.message);
  }
  return { updatedAt: null, customerId: null, campaigns: [] };
}

async function testConnection() {
  const cache = loadCache();
  return !!cache.updatedAt;
}

async function listCustomers() {
  const cache = loadCache();
  if (!cache.customerId) return [];
  return [{ id: cache.customerId, customer_id: cache.customerId }];
}

async function getCampaigns(customerId) {
  const cache = loadCache();
  return cache.campaigns || [];
}

async function getMetrics(customerId, dateRange = 'LAST_30_DAYS') {
  const cache = loadCache();
  return cache.campaigns || [];
}

async function getConversions(customerId, dateRange = 'LAST_30_DAYS') {
  const cache = loadCache();
  return (cache.campaigns || [])
    .filter(c => (c.conversions || 0) > 0)
    .map(c => ({
      campaign_id: c.campaign_id,
      campaign_name: c.campaign_name,
      conversions: c.conversions,
      conversions_value: c.conversions_value
    }));
}

module.exports = {
  testConnection,
  listCustomers,
  getCampaigns,
  getMetrics,
  getConversions
};
