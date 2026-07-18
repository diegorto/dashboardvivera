// Integracao direta com a Google Ads API (substitui o relay Pipeboard).
// Le client_id/client_secret/refresh_token/developer_token/customer_id de data/settings.json
// (com fallback para variaveis de ambiente), sempre na hora da chamada.
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');
const GOOGLE_ADS_API_VERSION = 'v23'; // v17 foi desativado pelo Google; v23 e a mais recente estavel em jul/2026

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[googleAdsDirect] Erro ao ler settings.json:', e.message);
  }
  return {};
}

function getConfig() {
  const s = loadSettings();
  return {
    clientId: s.googleAdsClientId || process.env.GOOGLE_ADS_OAUTH_CLIENT_ID || '',
    clientSecret: s.googleAdsClientSecret || process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET || '',
    refreshToken: s.googleAdsRefreshToken || process.env.GOOGLE_ADS_REFRESH_TOKEN || '',
    developerToken: s.googleAdsDeveloperToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
    customerId: s.googleAdsCustomerId || process.env.GOOGLE_ADS_CUSTOMER_ID || '',
    loginCustomerId: s.googleAdsLoginCustomerId || s.googleAdsCustomerId || process.env.GOOGLE_ADS_CUSTOMER_ID || ''
  };
}

let _accessTokenCache = { token: null, expiresAt: 0 };

async function getAccessToken() {
  const cfg = getConfig();
  if (!cfg.refreshToken) {
    throw new Error('Google Ads: refresh_token ausente. Autorize em /auth/google/start');
  }
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error('Google Ads: OAuth client_id/client_secret ausentes em data/settings.json');
  }
  const now = Date.now();
  if (_accessTokenCache.token && _accessTokenCache.expiresAt > now + 30000) {
    return _accessTokenCache.token;
  }
  const resp = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: cfg.refreshToken,
    grant_type: 'refresh_token'
  }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  _accessTokenCache = {
    token: resp.data.access_token,
    expiresAt: now + (resp.data.expires_in || 3600) * 1000
  };
  return _accessTokenCache.token;
}

async function gadsRequest(customerId, method, urlSuffix, data) {
  const cfg = getConfig();
  const accessToken = await getAccessToken();
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': cfg.developerToken,
    'Content-Type': 'application/json'
  };
  if (cfg.loginCustomerId) headers['login-customer-id'] = String(cfg.loginCustomerId).replace(/-/g, '');
  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${String(customerId).replace(/-/g, '')}${urlSuffix}`;
  const resp = await axios({ method, url, headers, data });
  return resp.data;
}

async function listCustomers() {
  const cfg = getConfig();
  const accessToken = await getAccessToken();
  const resp = await axios.get(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': cfg.developerToken
    }
  });
  const names = (resp.data && resp.data.resourceNames) || [];
  return names.map(n => ({ id: n.split('/')[1], customer_id: n.split('/')[1] }));
}

async function testConnection() {
  try {
    await listCustomers();
    return true;
  } catch (e) {
    console.error('[googleAdsDirect] testConnection falhou:', (e.response && e.response.data) || e.message);
    return false;
  }
}

function mapDateRange(dateRange) {
  const allowed = ['LAST_7_DAYS', 'LAST_14_DAYS', 'LAST_30_DAYS', 'LAST_BUSINESS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'TODAY', 'YESTERDAY'];
  return allowed.includes(dateRange) ? dateRange : 'LAST_30_DAYS';
}

async function runQuery(customerId, query) {
  const data = await gadsRequest(customerId, 'post', '/googleAds:search', { query });
  return data.results || [];
}

async function getCampaigns(customerId) {
  const query = `SELECT campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date DURING LAST_30_DAYS`;
  const rows = await runQuery(customerId, query);
  return rows.map(r => ({
    campaign_id: r.campaign && r.campaign.id,
    campaign_name: r.campaign && r.campaign.name,
    status: r.campaign && r.campaign.status,
    impressions: Number((r.metrics && r.metrics.impressions) || 0),
    clicks: Number((r.metrics && r.metrics.clicks) || 0),
    cost: Number((r.metrics && r.metrics.costMicros) || 0) / 1e6,
    conversions: Number((r.metrics && r.metrics.conversions) || 0),
    conversions_value: Number((r.metrics && r.metrics.conversionsValue) || 0)
  }));
}

async function getMetrics(customerId, dateRange = 'LAST_30_DAYS') {
  const gaqlRange = mapDateRange(dateRange);
  const query = `SELECT campaign.id, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.ctr, metrics.average_cpc FROM campaign WHERE segments.date DURING ${gaqlRange}`;
  const rows = await runQuery(customerId, query);
  return rows.map(r => ({
    campaign_id: r.campaign && r.campaign.id,
    campaign_name: r.campaign && r.campaign.name,
    impressions: Number((r.metrics && r.metrics.impressions) || 0),
    clicks: Number((r.metrics && r.metrics.clicks) || 0),
    cost: Number((r.metrics && r.metrics.costMicros) || 0) / 1e6,
    conversions: Number((r.metrics && r.metrics.conversions) || 0),
    conversions_value: Number((r.metrics && r.metrics.conversionsValue) || 0),
    ctr: Number((r.metrics && r.metrics.ctr) || 0),
    average_cpc: Number((r.metrics && r.metrics.averageCpc) || 0) / 1e6
  }));
}

async function getConversions(customerId, dateRange = 'LAST_30_DAYS') {
  const campaigns = await getMetrics(customerId, dateRange);
  return campaigns
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
