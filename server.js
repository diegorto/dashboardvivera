require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Credenciais: em producao (Vercel) vem de config.json (incluido so no deploy,
// nunca commitado no git); em dev local vem do .env
let deployConfig = {};
try { deployConfig = require('./config.json'); } catch (e) { /* nao existe em dev local, tudo bem */ }

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_TOKEN || deployConfig.PIPEDRIVE_TOKEN;
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN || deployConfig.FB_ACCESS_TOKEN;
const FB_AD_ACCOUNT_IDS = (process.env.FB_AD_ACCOUNT_IDS || deployConfig.FB_AD_ACCOUNT_IDS || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

// IDs reais dos campos customizados "Trafego Pago" no Deal do Pipedrive
const FIELD_CAMPANHA = 'b70cf4c34cd06cb3917b79f3ebe1e64d28666f4b';
const FIELD_CONJUNTO = '182132e7acfbec43315140ab18362f0e16ada0c4';
// Convencao do usuario: "Palavra Chave" = nome do anuncio (pra funcionar tambem com Google Ads no futuro)
const FIELD_PALAVRA_CHAVE = 'c9ee045e6537eb296d268102e99829b0dbda1b5b';
const FIELD_PLATAFORMA = '0051c071b9be4c9103f8a91ef538dcc3d43e6e9a';
const FIELD_ORIGEM = 'fd9cfb07956d6227f9e50b9be8b20ab176d17ce7';

// Pipeline "Inbound" = id 1 (onde entram os leads de trafego pago)
const INBOUND_PIPELINE_ID = 1;

function defaultDateRange() {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const fmt = d => d.toISOString().slice(0, 10);
  return { since: fmt(since), until: fmt(until) };
}

function joinKey(campanha, conjunto, anuncio) {
  return `${campanha}|||${conjunto}|||${anuncio}`;
}

// Busca ads (nivel anuncio individual) da Meta, com spend/leads no periodo escolhido.
// "leads" aqui = o que o proprio Meta Ads Manager reporta como acao do tipo "lead"
// (o "leads_meta" da tabela de audit) - o que o gerenciador diz que aconteceu.
// Depois comparamos com o Pipedrive, que confirma se realmente aconteceu.
async function getMetaAds(since, until) {
  const ads = [];
  const timeRangeParam = JSON.stringify({ since, until });
  const fields = `id,name,status,effective_status,campaign_id,campaign{name},adset_id,adset{name},insights.time_range(${timeRangeParam}){spend,actions,impressions,clicks}`;

  for (const accountId of FB_AD_ACCOUNT_IDS) {
    console.log(`\nBuscando ads Meta - Account: ${accountId} (${since} a ${until})`);
    let url = `https://graph.facebook.com/v18.0/act_${accountId}/ads`;
    let params = { access_token: FB_ACCESS_TOKEN, fields, limit: 200 };
    let page = 0;
    const MAX_PAGES = 10;

    try {
      while (url && page < MAX_PAGES) {
        const response = await axios.get(url, { params });
        const data = response.data.data || [];
        let comAtividade = 0;

        data.forEach(ad => {
          const insight = ad.insights && ad.insights.data && ad.insights.data[0];
          if (!insight) return; // sem atividade no periodo

          const spend = parseFloat(insight.spend || 0);
          if (spend <= 0) return;

          let leads = 0;
          if (insight.actions) {
            const leadAction = insight.actions.find(a => a.action_type === 'lead');
            leads = leadAction ? parseInt(leadAction.value) : 0;
          }

          const impressions = parseInt(insight.impressions || 0);
          const clicks = parseInt(insight.clicks || 0);
          const ctr = impressions > 0 ? (clicks / impressions * 100) : 0;
          const cpc = clicks > 0 ? (spend / clicks) : 0;
          const cpm = impressions > 0 ? (spend / impressions * 1000) : 0;

          ads.push({
            accountId,
            campaignId: ad.campaign_id,
            campaignName: ad.campaign ? ad.campaign.name : '(sem campanha)',
            adsetId: ad.adset_id,
            adsetName: ad.adset ? ad.adset.name : '(sem conjunto)',
            adId: ad.id,
            adName: ad.name,
            status: ad.effective_status || ad.status,
            spend,
            leads,
            impressions,
            clicks,
            ctr,
            cpc,
            cpm
          });
          comAtividade++;
        });

        console.log(`  pagina ${page + 1}: ${data.length} ads retornados, ${comAtividade} com gasto > 0 no periodo`);

        if (response.data.paging && response.data.paging.next) {
          url = response.data.paging.next;
          params = undefined; // a URL "next" ja vem com todos os params necessarios
        } else {
          url = null;
        }
        page++;
      }
    } catch (error) {
      console.error(`Erro ao buscar ads da conta ${accountId}:`, JSON.stringify(error.response?.data?.error || error.message));
    }
  }

  console.log(`\nTotal de ads com atividade no periodo: ${ads.length}\n`);
  return ads;
}

// Agrupa os ads em Campanha + Conjunto + Anuncio (nome do anuncio = "palavra chave"
// por convencao do usuario, pra bater com o Pipedrive e futuramente com Google Ads).
function aggregateMetaAds(ads) {
  const map = {};
  ads.forEach(ad => {
    const key = joinKey(ad.campaignName, ad.adsetName, ad.adName);
    if (!map[key]) {
      map[key] = {
        campanha: ad.campaignName,
        conjunto: ad.adsetName,
        anuncio: ad.adName,
        gasto_meta: 0,
        leads_meta: 0,
        impressoes_meta: 0,
        cliques_meta: 0
      };
    }
    map[key].gasto_meta += ad.spend;
    map[key].leads_meta += ad.leads;
    map[key].impressoes_meta += ad.impressions;
    map[key].cliques_meta += ad.clicks;
  });
  return Object.values(map);
}

// Serie diaria de gasto/leads no nivel de conta (nao por anuncio), pra montar o
// grafico de tendencia sem multiplicar o numero de chamadas por anuncio x dia.
async function getMetaDailySeries(since, until) {
  const daily = {};
  const timeRangeParam = JSON.stringify({ since, until });

  for (const accountId of FB_AD_ACCOUNT_IDS) {
    try {
      let url = `https://graph.facebook.com/v18.0/act_${accountId}/insights`;
      let params = {
        access_token: FB_ACCESS_TOKEN,
        time_range: timeRangeParam,
        time_increment: 1,
        fields: 'spend,actions',
        limit: 500
      };

      while (url) {
        const response = await axios.get(url, { params });
        const data = response.data.data || [];

        data.forEach(row => {
          const date = row.date_start;
          if (!daily[date]) daily[date] = { date, gasto_meta: 0, leads_meta: 0 };
          daily[date].gasto_meta += parseFloat(row.spend || 0);
          const leadAction = (row.actions || []).find(a => a.action_type === 'lead');
          daily[date].leads_meta += leadAction ? parseInt(leadAction.value) : 0;
        });

        if (response.data.paging && response.data.paging.next) {
          url = response.data.paging.next;
          params = undefined;
        } else {
          url = null;
        }
      }
    } catch (error) {
      console.error(`Erro ao buscar serie diaria da conta ${accountId}:`, JSON.stringify(error.response?.data?.error || error.message));
    }
  }

  return daily;
}

// Preenche todos os dias do intervalo (mesmo sem atividade) pra grafico continuo.
function buildDailySeries(since, until, metaDaily, deals) {
  const pipedriveDaily = {};
  deals.forEach(deal => {
    if (!deal.addDate) return;
    if (!pipedriveDaily[deal.addDate]) pipedriveDaily[deal.addDate] = { leads_pipedrive: 0, revenue_total: 0 };
    pipedriveDaily[deal.addDate].leads_pipedrive++;
    pipedriveDaily[deal.addDate].revenue_total += deal.value;
  });

  const series = [];
  const cursor = new Date(since + 'T00:00:00');
  const end = new Date(until + 'T00:00:00');
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    const meta = metaDaily[date] || { gasto_meta: 0, leads_meta: 0 };
    const pd = pipedriveDaily[date] || { leads_pipedrive: 0, revenue_total: 0 };
    series.push({
      date,
      gasto_meta: meta.gasto_meta,
      leads_meta: meta.leads_meta,
      leads_pipedrive: pd.leads_pipedrive,
      revenue_total: pd.revenue_total
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return series;
}

// Funil de status dos deals no Pipedrive (open/won/lost) + taxa de conversao.
function buildFunnel(deals) {
  const counts = { open: 0, won: 0, lost: 0 };
  deals.forEach(deal => {
    const status = deal.status || 'open';
    counts[status] = (counts[status] || 0) + 1;
  });
  const total = deals.length;
  const conversion = total > 0 ? ((counts.won || 0) / total * 100).toFixed(1) : '0.0';
  return { counts, total, conversion };
}

// Pipedrive: busca Deals (negocios) do funil Inbound dentro do periodo (filtra por add_time).
// Campanha/Conjunto/Palavra-chave vivem no proprio Deal (campos "Trafego Pago").
async function getPipedriveDeals(since, until) {
  try {
    const deals = [];
    let start = 0;
    let hasMore = true;

    while (hasMore) {
      const url = 'https://api.pipedrive.com/v1/deals';

      const response = await axios.get(url, {
        params: { api_token: PIPEDRIVE_TOKEN, limit: 500, start }
      });

      if (response.data.success && response.data.data) {
        response.data.data.forEach(deal => {
          if (INBOUND_PIPELINE_ID && deal.pipeline_id !== INBOUND_PIPELINE_ID) return;

          const addDate = (deal.add_time || '').slice(0, 10);
          if (since && addDate && addDate < since) return;
          if (until && addDate && addDate > until) return;

          let email = '';
          if (deal.person_id && typeof deal.person_id === 'object' && Array.isArray(deal.person_id.email)) {
            const primaryEmail = deal.person_id.email.find(e => e.primary) || deal.person_id.email[0];
            email = primaryEmail ? primaryEmail.value : '';
          }

          deals.push({
            id: deal.id,
            title: deal.title,
            status: deal.status,
            addDate,
            value: deal.status === 'won' ? (deal.value || 0) : 0,
            campanha: deal[FIELD_CAMPANHA] || '',
            conjunto: deal[FIELD_CONJUNTO] || '',
            palavraChave: deal[FIELD_PALAVRA_CHAVE] || '',
            plataforma: deal[FIELD_PLATAFORMA] || '',
            origem: deal[FIELD_ORIGEM] || '',
            personName: deal.person_name || (deal.person_id && deal.person_id.name) || '',
            email
          });
        });

        hasMore = response.data.additional_data?.pagination?.more_items_in_collection || false;
        start = response.data.additional_data?.pagination?.next_start || 0;
      } else {
        hasMore = false;
      }
    }

    console.log(`Total de deals no funil Inbound dentro do periodo: ${deals.length}`);
    return deals;
  } catch (error) {
    console.error('Erro ao buscar deals Pipedrive:', error.response?.data?.error || error.message);
    return [];
  }
}

// Endpoint: Audit completo (aceita ?since=YYYY-MM-DD&until=YYYY-MM-DD)
app.get('/api/audit', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [ads, dealsLeads, metaDaily] = await Promise.all([
      getMetaAds(range.since, range.until),
      getPipedriveDeals(range.since, range.until),
      getMetaDailySeries(range.since, range.until)
    ]);

    const metaAgg = aggregateMetaAds(ads);

    // auditByKey = tabela de cruzamento, agrupada por Campanha + Conjunto + Anuncio/Palavra-chave
    const auditByKey = {};
    metaAgg.forEach(c => {
      const key = joinKey(c.campanha, c.conjunto, c.anuncio);
      auditByKey[key] = {
        campanha: c.campanha,
        conjunto: c.conjunto,
        anuncio: c.anuncio,
        gasto_meta: c.gasto_meta,
        leads_meta: c.leads_meta,
        impressoes_meta: c.impressoes_meta,
        cliques_meta: c.cliques_meta,
        leads_pipedrive: 0,
        revenue_total: 0,
        leads_details: []
      };
    });

    dealsLeads.forEach(deal => {
      const campanha = deal.campanha || 'sem_campanha';
      const conjunto = deal.conjunto || 'sem_conjunto';
      const anuncio = deal.palavraChave || 'sem_palavra_chave';
      const key = joinKey(campanha, conjunto, anuncio);
      if (!auditByKey[key]) {
        auditByKey[key] = {
          campanha,
          conjunto,
          anuncio,
          gasto_meta: 0,
          leads_meta: 0,
          impressoes_meta: 0,
          cliques_meta: 0,
          leads_pipedrive: 0,
          revenue_total: 0,
          leads_details: []
        };
      }
      auditByKey[key].leads_pipedrive++;
      auditByKey[key].revenue_total += deal.value;
      auditByKey[key].leads_details.push({
        nome: deal.personName,
        email: deal.email,
        anuncio,
        conjunto,
        status: deal.status,
        data: deal.addDate,
        revenue: deal.value
      });
    });

    const result = Object.values(auditByKey).map(c => {
      const roas = c.gasto_meta > 0 ? (c.revenue_total / c.gasto_meta).toFixed(2) : 0;
      const discrepancia = c.leads_meta - c.leads_pipedrive;
      const discrepancia_percent = c.leads_meta > 0
        ? ((discrepancia / c.leads_meta) * 100).toFixed(1)
        : 0;
      const custo_por_lead = c.leads_pipedrive > 0
        ? (c.gasto_meta / c.leads_pipedrive).toFixed(2)
        : 0;
      const ctr_meta = c.impressoes_meta > 0 ? (c.cliques_meta / c.impressoes_meta * 100).toFixed(2) : '0.00';
      const cpc_meta = c.cliques_meta > 0 ? (c.gasto_meta / c.cliques_meta).toFixed(2) : '0.00';
      const cpm_meta = c.impressoes_meta > 0 ? (c.gasto_meta / c.impressoes_meta * 1000).toFixed(2) : '0.00';

      return { ...c, roas, discrepancia, discrepancia_percent, custo_por_lead, ctr_meta, cpc_meta, cpm_meta };
    });

    result.sort((a, b) => b.gasto_meta - a.gasto_meta);

    const daily = buildDailySeries(range.since, range.until, metaDaily, dealsLeads);
    const funnel = buildFunnel(dealsLeads);

    res.json({
      success: true,
      range,
      data: result,
      meta_ads: ads.sort((a, b) => b.spend - a.spend),
      daily,
      funnel,
      summary: {
        total_linhas: result.length,
        gasto_total: result.reduce((sum, r) => sum + r.gasto_meta, 0).toFixed(2),
        revenue_total: result.reduce((sum, r) => sum + r.revenue_total, 0).toFixed(2),
        leads_meta_total: result.reduce((sum, r) => sum + r.leads_meta, 0),
        leads_total: result.reduce((sum, r) => sum + r.leads_pipedrive, 0),
        impressoes_total: result.reduce((sum, r) => sum + r.impressoes_meta, 0),
        cliques_total: result.reduce((sum, r) => sum + r.cliques_meta, 0),
        roas_medio: result.length > 0
          ? (result.reduce((sum, r) => sum + parseFloat(r.roas), 0) / result.length).toFixed(2)
          : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Servir o dashboard HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard-api.html'));
});

const PORT = process.env.PORT || 3000;

// Em producao na Vercel o modulo e importado pelo runtime serverless, nao roda diretamente
if (require.main === module) {
  app.listen(PORT, () => {
    const range = defaultDateRange();
    console.log(`
Servidor rodando em http://localhost:${PORT}
Acesse http://localhost:${PORT} no navegador
API: http://localhost:${PORT}/api/audit?since=${range.since}&until=${range.until}

Configuracoes:
   - Meta Accounts: ${FB_AD_ACCOUNT_IDS.length}
   - Pipedrive Token: ${PIPEDRIVE_TOKEN ? PIPEDRIVE_TOKEN.substring(0, 10) + '...' : 'NAO CONFIGURADO'}
   - Pipeline Inbound ID: ${INBOUND_PIPELINE_ID}
   - Periodo padrao: ${range.since} a ${range.until}

Clique em Atualizar no dashboard para carregar dados
Veja os logs aqui para diagnosticar problemas
    `);
  });
}

module.exports = app;
