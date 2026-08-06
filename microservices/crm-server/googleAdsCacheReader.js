// Le o cache local do Google Ads que o Command Center ja mantem (alimentado hora em hora
// por um Google Ads Script rodando na propria conta - sem developer token disponivel ainda).
// Assim que houver developer token + oauth client, trocar por chamada direta a Google Ads API.
const fs = require('fs');

const CACHE_FILE = '/root/dashboardvivera-prod/data/google_ads_cache.json';
const DAILY_CACHE_FILE = '/root/dashboardvivera-prod/data/google_ads_daily_cache.json';

function getCampaigns() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const c = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      return { updatedAt: c.updatedAt || null, customerId: c.customerId || null, campaigns: c.campaigns || [] };
    }
  } catch (e) {
    console.error('[googleAdsCacheReader] erro ao ler cache', e.message);
  }
  return { updatedAt: null, customerId: null, campaigns: [] };
}

// Le o cache diario (segmentado por data) e soma cada campanha dentro do intervalo [from, to] (YYYY-MM-DD, inclusive).
// Isso permite que o range de datas do dashboard funcione de verdade para investimento/impressoes/cliques/conversoes do Google Ads.
function getCampaignsForRange(from, to) {
  try {
    if (!fs.existsSync(DAILY_CACHE_FILE)) {
      // fallback: sem dados diarios ainda, usa o snapshot antigo (nao filtra por data)
      return getCampaigns();
    }
    const c = JSON.parse(fs.readFileSync(DAILY_CACHE_FILE, 'utf8'));
    const daily = c.daily || [];
    const byCampaign = {};
    for (const r of daily) {
      if (from && r.date < from) continue;
      if (to && r.date > to) continue;
      if (!byCampaign[r.campaign_id]) {
        byCampaign[r.campaign_id] = {
          campaign_id: r.campaign_id,
          campaign_name: r.campaign_name,
          status: r.status,
          impressions: 0,
          clicks: 0,
          cost: 0,
          conversions: 0,
          conversions_value: 0
        };
      }
      const acc = byCampaign[r.campaign_id];
      acc.impressions += Number(r.impressions || 0);
      acc.clicks += Number(r.clicks || 0);
      acc.cost += Number(r.cost || 0);
      acc.conversions += Number(r.conversions || 0);
      acc.conversions_value += Number(r.conversions_value || 0);
      acc.status = r.status || acc.status;
    }
    const campaigns = Object.keys(byCampaign).map(function(k) { return byCampaign[k]; });
    return { updatedAt: c.updatedAt || null, customerId: c.customerId || null, campaigns: campaigns };
  } catch (e) {
    console.error('[googleAdsCacheReader] erro ao ler cache diario', e.message);
    return getCampaigns();
  }
}

module.exports = { getCampaigns, getCampaignsForRange };
