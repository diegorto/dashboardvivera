// Conexao direta com a Graph API do Meta (Facebook/Instagram Ads).
// Sem Pipeboard - usa FB_ACCESS_TOKEN e FB_AD_ACCOUNT_IDS do .env.
const axios = require('axios');

const GRAPH_VERSION = 'v21.0';
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const FB_AD_ACCOUNT_IDS = (process.env.FB_AD_ACCOUNT_IDS || '').split(',').map(function(s){return s.trim();}).filter(Boolean);

async function testConnection() {
  if (!FB_ACCESS_TOKEN || !FB_AD_ACCOUNT_IDS.length) return false;
  try {
    const acct = FB_AD_ACCOUNT_IDS[0].indexOf('act_') === 0 ? FB_AD_ACCOUNT_IDS[0] : ('act_' + FB_AD_ACCOUNT_IDS[0]);
    const resp = await axios.get('https://graph.facebook.com/' + GRAPH_VERSION + '/' + acct, {
      params: { fields: 'name', access_token: FB_ACCESS_TOKEN },
      timeout: 10000
    });
    return !!(resp.data && resp.data.id);
  } catch (e) {
    console.error('[metaAdsService] testConnection erro', e.response ? JSON.stringify(e.response.data) : e.message);
    return false;
  }
}

async function getInsights(dateFrom, dateTo) {
  const all = [];
  if (!FB_ACCESS_TOKEN || !FB_AD_ACCOUNT_IDS.length) return all;
  for (const accId of FB_AD_ACCOUNT_IDS) {
    const acct = accId.indexOf('act_') === 0 ? accId : ('act_' + accId);
    try {
      const url = 'https://graph.facebook.com/' + GRAPH_VERSION + '/' + acct + '/insights';
      const resp = await axios.get(url, {
        params: {
          level: 'campaign',
          fields: 'campaign_id,campaign_name,spend,impressions,clicks,cpc,cpm,ctr',
          time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
          limit: 200,
          access_token: FB_ACCESS_TOKEN
        },
        timeout: 20000
      });
      const rows = (resp.data && resp.data.data) || [];
      rows.forEach(function(r) {
        all.push({
          account_id: accId,
          campaign_id: r.campaign_id,
          campaign_name: r.campaign_name,
          spend: parseFloat(r.spend || 0),
          impressions: parseInt(r.impressions || 0, 10),
          clicks: parseInt(r.clicks || 0, 10),
          cpc: r.cpc ? parseFloat(r.cpc) : null,
          ctr: r.ctr ? parseFloat(r.ctr) : null
        });
      });
    } catch (e) {
      console.error('[metaAdsService] getInsights erro conta ' + accId, e.response ? JSON.stringify(e.response.data) : e.message);
    }
  }
  return all;
}


// Cache simples em memoria para nomes de anuncios resolvidos via Graph API (ttl 6h)
const adNameCache = new Map();
const AD_NAME_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function resolveAdNames(ids) {
  const result = {};
  const now = Date.now();
  const toFetch = [];
  for (const id of ids) {
    const cached = adNameCache.get(id);
    if (cached && (now - cached.ts) < AD_NAME_CACHE_TTL_MS) { result[id] = cached.name; }
    else { toFetch.push(id); }
  }
  if (!FB_ACCESS_TOKEN || !toFetch.length) return result;
  await Promise.all(toFetch.map(async function(id) {
    try {
      const resp = await axios.get('https://graph.facebook.com/' + GRAPH_VERSION + '/' + id, {
        params: { fields: 'name,effective_status', access_token: FB_ACCESS_TOKEN },
        timeout: 8000
      });
      const name = resp.data && resp.data.name ? resp.data.name : null;
      if (name) { adNameCache.set(id, { name: name, ts: now }); result[id] = name; }
    } catch (e) {
      console.error('[metaAdsService] resolveAdNames erro id ' + id, e.response ? JSON.stringify(e.response.data) : e.message);
    }
  }));
  return result;
}

var campaignStatusCache = { ts: 0, map: {}, anyFailure: false };
var CAMPAIGN_STATUS_TTL_MS = 5 * 60 * 1000;
async function getCampaignStatuses() {
  var now = Date.now();
  if (campaignStatusCache.ts && (now - campaignStatusCache.ts) < CAMPAIGN_STATUS_TTL_MS) {
    return campaignStatusCache;
  }
  var map = {};
  var anyFailure = false;
  if (!FB_ACCESS_TOKEN || !FB_AD_ACCOUNT_IDS.length) {
    campaignStatusCache = { ts: now, map: map, anyFailure: true };
    return campaignStatusCache;
  }
  for (var i = 0; i < FB_AD_ACCOUNT_IDS.length; i++) {
    var accId = FB_AD_ACCOUNT_IDS[i];
    var acct = accId.indexOf('act_') === 0 ? accId : ('act_' + accId);
    try {
      var url = 'https://graph.facebook.com/' + GRAPH_VERSION + '/' + acct + '/campaigns';
      var params = { fields: 'name,effective_status', limit: 500, access_token: FB_ACCESS_TOKEN };
      var pageCount = 0;
      while (url && pageCount < 20) {
        var resp = await axios.get(url, params ? { params: params, timeout: 20000 } : { timeout: 20000 });
        var rows = (resp.data && resp.data.data) || [];
        rows.forEach(function(r) {
          if (r.name) map[String(r.name).trim().toLowerCase()] = r.effective_status || null;
        });
        var next = resp.data && resp.data.paging && resp.data.paging.next;
        url = next || null;
        params = null;
        pageCount++;
      }
    } catch (e) {
      anyFailure = true;
      console.error('[metaAdsService] getCampaignStatuses erro conta ' + acct, e.response ? JSON.stringify(e.response.data) : e.message);
    }
  }
  campaignStatusCache = { ts: now, map: map, anyFailure: anyFailure };
  return campaignStatusCache;
}

module.exports = { testConnection, getInsights, resolveAdNames, getCampaignStatuses };
