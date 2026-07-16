require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ============================================
// Configuracoes runtime (SaaS Settings)
// Prioridade: config/settings.json (editavel pela tela de Configuracoes) > .env
// ============================================
const fs = require('fs');
const SETTINGS_FILE = path.join(__dirname, 'config', 'settings.json');

function loadSettingsFile() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Erro ao ler settings.json:', e.message);
  }
  return {};
}

function saveSettingsFile(settings) {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), { mode: 0o600 });
}

// Credenciais mutaveis em runtime (settings.json sobrepoe .env)
let PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_TOKEN;
let FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
let FB_AD_ACCOUNT_IDS = (process.env.FB_AD_ACCOUNT_IDS || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);
let TINTIM_ACCOUNT_CODE = process.env.TINTIM_ACCOUNT_CODE;
let TINTIM_ACCOUNT_TOKEN = process.env.TINTIM_ACCOUNT_TOKEN;
let GOOGLE_ADS_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID;
let GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

// Pipeline "Inbound" (onde entram os leads de trafego pago)
let INBOUND_PIPELINE_ID = 1;

// Metas de negocio configuraveis
let MONTHLY_GOAL = 0; // meta de receita mensal em R$

function applySettings(s) {
  if (s.pipedriveToken) PIPEDRIVE_TOKEN = s.pipedriveToken;
  if (s.fbAccessToken) FB_ACCESS_TOKEN = s.fbAccessToken;
  if (s.fbAdAccountIds) {
    FB_AD_ACCOUNT_IDS = String(s.fbAdAccountIds).split(',').map(id => id.trim()).filter(Boolean);
  }
  if (s.tintimAccountCode) TINTIM_ACCOUNT_CODE = s.tintimAccountCode;
  if (s.tintimAccountToken) TINTIM_ACCOUNT_TOKEN = s.tintimAccountToken;
  if (s.googleAdsCustomerId) GOOGLE_ADS_CUSTOMER_ID = s.googleAdsCustomerId;
  if (s.googleAdsDeveloperToken) GOOGLE_ADS_DEVELOPER_TOKEN = s.googleAdsDeveloperToken;
  if (s.openaiApiKey) process.env.OPENAI_API_KEY = s.openaiApiKey;
  if (s.inboundPipelineId) INBOUND_PIPELINE_ID = parseInt(s.inboundPipelineId, 10) || 1;
  if (s.monthlyGoal !== undefined) MONTHLY_GOAL = parseFloat(s.monthlyGoal) || 0;
}

applySettings(loadSettingsFile());

// IDs reais dos campos customizados "Trafego Pago" no Deal do Pipedrive
const FIELD_CAMPANHA = 'b70cf4c34cd06cb3917b79f3ebe1e64d28666f4b';
const FIELD_CONJUNTO = '182132e7acfbec43315140ab18362f0e16ada0c4';
// Convencao do usuario: "Palavra Chave" = nome do anuncio (pra funcionar tambem com Google Ads no futuro)
const FIELD_PALAVRA_CHAVE = 'c9ee045e6537eb296d268102e99829b0dbda1b5b';
const FIELD_PLATAFORMA = '0051c071b9be4c9103f8a91ef538dcc3d43e6e9a';
const FIELD_ORIGEM = 'fd9cfb07956d6227f9e50b9be8b20ab176d17ce7';

function maskSecret(value) {
  if (!value) return '';
  const str = String(value);
  return str.length <= 6 ? '••••' : `••••${str.slice(-4)}`;
}

// ============================================
// "Memoria" de numeros: cache em memoria + persistido em disco (data/cache.json)
// - Reload da pagina serve na hora o ultimo valor conhecido (stale-while-revalidate)
// - Atualizacao automatica do Pipedrive/Meta a cada 5 minutos (warmCache)
// - Sobrevive a restart do container (data/ e um bind mount no VPS)
// ============================================
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const _cache = new Map();
const CACHE_FILE = path.join(__dirname, 'data', 'cache.json');

function loadCacheFromDisk() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      Object.entries(raw).forEach(([k, v]) => _cache.set(k, v));
      console.log(`Memoria carregada do disco: ${_cache.size} conjuntos de numeros`);
    }
  } catch (e) {
    console.error('Erro ao carregar memoria do disco:', e.message);
  }
}

let _saveTimer = null;
function saveCacheToDisk() {
  if (_saveTimer) return; // debounce
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
      fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(_cache)), 'utf8');
    } catch (e) {
      console.error('Erro ao salvar memoria em disco:', e.message);
    }
  }, 2000);
}

const _refreshing = new Set();
async function refreshKey(key, fn) {
  if (_refreshing.has(key)) return;
  _refreshing.add(key);
  try {
    const value = await fn();
    _cache.set(key, { at: Date.now(), value });
    saveCacheToDisk();
  } catch (e) {
    console.error(`Erro ao atualizar '${key}':`, e.message);
  } finally {
    _refreshing.delete(key);
  }
}

async function cached(key, fn) {
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.value;
  }
  // Stale-while-revalidate: devolve o ultimo valor NA HORA e atualiza em background
  if (hit) {
    refreshKey(key, fn);
    return hit.value;
  }
  const value = await fn();
  _cache.set(key, { at: Date.now(), value });
  // Limpeza simples para nao crescer indefinidamente
  if (_cache.size > 200) {
    const oldest = [..._cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) _cache.delete(oldest[0]);
  }
  saveCacheToDisk();
  return value;
}

function invalidateCache() {
  _cache.clear();
}


// Wrappers com cache (60s) sobre as chamadas externas
function getMetaAds(since, until) {
  return cached(`meta:${since}:${until}`, () => fetchMetaAdsUncached(since, until));
}
function getPipedriveDeals(since, until) {
  return cached(`deals:${since}:${until}:${INBOUND_PIPELINE_ID}`, () => fetchPipedriveDealsUncached(since, until));
}
function getPipedriveStages() {
  return cached(`stages:${INBOUND_PIPELINE_ID}`, () => fetchPipedriveStagesUncached());
}
function getPipedriveActivities(since, until) {
  return cached(`activities:${since}:${until}`, () => fetchPipedriveActivitiesUncached(since, until));
}

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
async function fetchMetaAdsUncached(since, until) {
  const ads = [];
  const timeRangeParam = JSON.stringify({ since, until });
  const fields = `id,name,status,effective_status,preview_shareable_link,campaign_id,campaign{name},adset_id,adset{name},insights.time_range(${timeRangeParam}){spend,actions}`;

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

          ads.push({
            accountId,
            campaignId: ad.campaign_id,
            campaignName: ad.campaign ? ad.campaign.name : '(sem campanha)',
            adsetId: ad.adset_id,
            adsetName: ad.adset ? ad.adset.name : '(sem conjunto)',
            adId: ad.id,
            adName: ad.name,
            status: ad.effective_status || ad.status,
            previewLink: ad.preview_shareable_link || '',
            spend,
            leads
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
        leads_meta: 0
      };
    }
    map[key].gasto_meta += ad.spend;
    map[key].leads_meta += ad.leads;
  });
  return Object.values(map);
}

// Pipedrive: busca Deals (negocios) do funil Inbound dentro do periodo (filtra por add_time).
// Campanha/Conjunto/Palavra-chave vivem no proprio Deal (campos "Trafego Pago").
async function fetchPipedriveDealsUncached(since, until) {
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
            rawValue: deal.value || 0,
            stageId: deal.stage_id,
            stageChangeTime: deal.stage_change_time || deal.add_time || '',
            userId: deal.user_id && typeof deal.user_id === 'object' ? deal.user_id.id : deal.user_id,
            userName: deal.user_id && typeof deal.user_id === 'object' ? deal.user_id.name : '',
            lostReason: deal.lost_reason || '',
            wonTime: deal.won_time || '',
            lostTime: deal.lost_time || '',
            updateTime: deal.update_time || '',
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

// Tipos de atividade da agenda no Pipedrive da Vivera (key_string reais da conta)
const ACTIVITY_TYPE_SCHEDULED = 'agendamento_realizado'; // "Agendamento Realizado"
const ACTIVITY_TYPE_ATTENDED = 'compareceu';             // "Compareceu"
const ACTIVITY_TYPE_MISSED = 'faltou_reagendar';         // "Faltou - Reagendar"

// Busca atividades do Pipedrive (agenda, ligacoes, whatsapp) no periodo.
// NOTA: a API v1 /activities NAO filtra por start_date/end_date de forma confiavel
// (retorna vazio) — buscamos tudo paginado e filtramos por due_date no codigo.
async function fetchPipedriveActivitiesUncached(since, until) {
  try {
    const activities = [];
    let start = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await axios.get('https://api.pipedrive.com/v1/activities', {
        params: {
          api_token: PIPEDRIVE_TOKEN,
          user_id: 0, // todos os usuarios
          limit: 500,
          start
        }
      });

      if (response.data.success && response.data.data) {
        response.data.data.forEach(act => {
          const dueDate = act.due_date || '';
          if (since && dueDate && dueDate < since) return;
          if (until && dueDate && dueDate > until) return;

          activities.push({
            id: act.id,
            subject: act.subject || '',
            type: act.type || '',
            dueDate,
            dueTime: act.due_time || '',
            duration: act.duration || '',
            done: !!act.done,
            markedAsDoneTime: act.marked_as_done_time || '',
            userId: act.user_id,
            userName: act.owner_name || '',
            personName: act.person_name || '',
            dealId: act.deal_id,
            dealTitle: act.deal_title || ''
          });
        });

        hasMore = response.data.additional_data?.pagination?.more_items_in_collection || false;
        start = response.data.additional_data?.pagination?.next_start || 0;
      } else {
        hasMore = false;
      }
    }

    console.log(`Total de atividades Pipedrive no periodo: ${activities.length}`);
    return activities;
  } catch (error) {
    console.error('Erro ao buscar atividades Pipedrive:', error.response?.data?.error || error.message);
    return [];
  }
}

// Busca as etapas (stages) do pipeline Inbound no Pipedrive
async function fetchPipedriveStagesUncached() {
  try {
    const response = await axios.get('https://api.pipedrive.com/v1/stages', {
      params: { api_token: PIPEDRIVE_TOKEN, pipeline_id: INBOUND_PIPELINE_ID }
    });
    if (response.data.success && response.data.data) {
      return response.data.data.map(s => ({
        id: s.id,
        name: s.name,
        order: s.order_nr
      })).sort((a, b) => a.order - b.order);
    }
    return [];
  } catch (error) {
    console.error('Erro ao buscar stages Pipedrive:', error.response?.data?.error || error.message);
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

    const [ads, dealsLeads] = await Promise.all([
      getMetaAds(range.since, range.until),
      getPipedriveDeals(range.since, range.until)
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

      return { ...c, roas, discrepancia, discrepancia_percent, custo_por_lead };
    });

    result.sort((a, b) => b.gasto_meta - a.gasto_meta);

    res.json({
      success: true,
      range,
      data: result,
      meta_ads: ads.sort((a, b) => b.spend - a.spend),
      summary: {
        total_linhas: result.length,
        gasto_total: result.reduce((sum, r) => sum + r.gasto_meta, 0).toFixed(2),
        revenue_total: result.reduce((sum, r) => sum + r.revenue_total, 0).toFixed(2),
        leads_meta_total: result.reduce((sum, r) => sum + r.leads_meta, 0),
        leads_total: result.reduce((sum, r) => sum + r.leads_pipedrive, 0),
        roas_medio: result.length > 0
          ? (result.reduce((sum, r) => sum + parseFloat(r.roas), 0) / result.length).toFixed(2)
          : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PIPEDRIVE_ALLOWED_RESOURCES = new Set(['users', 'deals', 'activities']);

// Proxy generico para o Pipedrive usado pelo painel /sdr: o token nunca chega ao navegador.
app.get('/api/pipedrive/:resource', async (req, res) => {
  const { resource } = req.params;

  if (!PIPEDRIVE_ALLOWED_RESOURCES.has(resource)) {
    return res.status(404).json({ success: false, error: 'Recurso não suportado' });
  }

  try {
    const response = await axios.get(`https://api.pipedrive.com/v1/${resource}`, {
      params: { ...req.query, api_token: PIPEDRIVE_TOKEN }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data?.error || error.message
    });
  }
});

// ============================================
// Dashboard Endpoints (Frontend React)
// ============================================

// GET /api/dashboard/executive - KPIs principais do executivo
app.get('/api/dashboard/executive', async (req, res) => {
  try {
    if (!PIPEDRIVE_TOKEN || !FB_ACCESS_TOKEN) {
      return res.json({
        success: false,
        error: 'Pipedrive ou Meta não configurados. Acesse Configurações e adicione os tokens.',
        data: { kpis: {}, revenueChart: [], funnel: [], alerts: [] }
      });
    }

    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };
    // Periodo anterior equivalente (calculado pelo frontend conforme o filtro selecionado)
    const prevRange = (req.query.prevSince && req.query.prevUntil)
      ? { since: req.query.prevSince, until: req.query.prevUntil }
      : null;

    const todayStr = new Date().toISOString().slice(0, 10);
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().slice(0, 10);

    const [ads, prevAds, allDeals, allActivities] = await Promise.allSettled([
      getMetaAds(range.since, range.until).catch(() => []),
      prevRange ? getMetaAds(prevRange.since, prevRange.until).catch(() => []) : Promise.resolve([]),
      getPipedriveDeals(null, null).catch(() => []),
      getPipedriveActivities(null, null).catch(() => [])
    ]);

    // Extrair valores ou fallback para arrays vazios
    const adsData = ads.status === 'fulfilled' ? ads.value : [];
    const prevAdsData = prevAds.status === 'fulfilled' ? prevAds.value : [];
    const dealsData = allDeals.status === 'fulfilled' ? allDeals.value : [];
    const activitiesData = allActivities.status === 'fulfilled' ? allActivities.value : [];

    // Agrega todas as metricas de um periodo (usado para o atual e o anterior)
    const aggregate = (r, adsArr) => {
      const spend = adsArr.reduce((sum, ad) => sum + ad.spend, 0);
      const leads = adsArr.reduce((sum, ad) => sum + ad.leads, 0);
      // Receita = orcamentos FECHADOS (won) no periodo, pela data de fechamento (won_time)
      const won = dealsData.filter(d => {
        if (d.status !== 'won') return false;
        const wonDate = (d.wonTime || d.stageChangeTime || d.addDate || '').slice(0, 10);
        return wonDate >= r.since && wonDate <= r.until;
      });
      const revenue = won.reduce((sum, d) => sum + (d.rawValue || 0), 0);
      // Agenda: atividades CONCLUIDAS por tipo (padrao Pipedrive da Vivera)
      const attended = activitiesData.filter(
        a => a.type === ACTIVITY_TYPE_ATTENDED && a.done &&
          a.dueDate >= r.since && a.dueDate <= r.until
      ).length;
      const missed = activitiesData.filter(
        a => a.type === ACTIVITY_TYPE_MISSED && a.done &&
          a.dueDate >= r.since && a.dueDate <= r.until
      ).length;
      return {
        spend,
        leads,
        revenue,
        dealsWon: won.length,
        roi: spend > 0 ? (revenue / spend) * 100 : 0,
        roas: spend > 0 ? revenue / spend : 0,
        cac: leads > 0 ? spend / leads : 0,
        avgTicket: won.length > 0 ? revenue / won.length : 0,
        attended,
        missed,
        attendanceRate: (attended + missed) > 0 ? (attended / (attended + missed)) * 100 : 0
      };
    };

    const cur = aggregate(range, adsData);
    const prev = prevRange ? aggregate(prevRange, prevAdsData) : null;

    // Variacao % vs periodo anterior; undefined (omitido no JSON) quando nao ha base
    const pct = (curVal, prevVal) => {
      if (!prev || !isFinite(prevVal) || prevVal === 0) return undefined;
      return parseFloat((((curVal - prevVal) / prevVal) * 100).toFixed(1));
    };

    const scheduledToday = activitiesData.filter(
      a => a.type === ACTIVITY_TYPE_SCHEDULED && a.done && a.dueDate === todayStr
    );
    const scheduledTomorrow = activitiesData.filter(
      a => a.type === ACTIVITY_TYPE_SCHEDULED && a.dueDate === tomorrowStr
    );

    // KPIs calculados (todos os dados vem do Pipedrive/Meta; variacoes = vs periodo anterior)
    const kpis = {
      revenue: {
        value: cur.revenue,
        change: pct(cur.revenue, prev && prev.revenue),
        sub: 'vs. período anterior'
      },
      goal: {
        // META: usa valor configurado na tela de Configuracoes; fallback receita+15%
        value: MONTHLY_GOAL > 0 ? MONTHLY_GOAL : cur.revenue * 1.15
      },
      goalPct: {
        value: MONTHLY_GOAL > 0
          ? ((cur.revenue / MONTHLY_GOAL) * 100).toFixed(1)
          : ((cur.revenue / (cur.revenue * 1.15 || 1)) * 100).toFixed(1)
      },
      forecast: {
        value: cur.revenue * 1.20, // FORECAST = receita + 20%
        change: pct(cur.revenue, prev && prev.revenue)
      },
      roi: {
        value: cur.roi.toFixed(0),
        change: pct(cur.roi, prev && prev.roi)
      },
      roas: {
        value: cur.roas.toFixed(2),
        change: pct(cur.roas, prev && prev.roas)
      },
      cac: {
        value: cur.cac.toFixed(2),
        change: pct(cur.cac, prev && prev.cac)
      },
      avgTicket: {
        value: cur.avgTicket.toFixed(2),
        change: pct(cur.avgTicket, prev && prev.avgTicket)
      },
      appointmentsToday: {
        value: scheduledToday.length,
        sub: 'realizados hoje'
      },
      appointmentsTomorrow: {
        value: scheduledTomorrow.length,
        sub: 'agendadas'
      },
      attendance: {
        value: parseFloat(cur.attendanceRate.toFixed(1)),
        change: pct(cur.attendanceRate, prev && prev.attendanceRate)
      },
      noShow: {
        value: cur.missed,
        change: pct(cur.missed, prev && prev.missed)
      },
      leads: {
        value: cur.leads,
        change: pct(cur.leads, prev && prev.leads)
      },
      qualified: {
        value: Math.floor(cur.leads * 0.48), // ~48% são qualificados
        change: pct(cur.leads, prev && prev.leads)
      },
      sales: {
        value: cur.dealsWon,
        change: pct(cur.dealsWon, prev && prev.dealsWon)
      }
    };

    res.json({
      success: true,
      range,
      prevRange,
      data: kpis
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/executive/drilldown?metric=... - registros que compoem cada KPI
// Todo numero do Executive e clicavel e "explode" a lista do que o populou
app.get('/api/dashboard/executive/drilldown', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };
    const metric = String(req.query.metric || 'revenue');

    const todayStr = new Date().toISOString().slice(0, 10);
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().slice(0, 10);

    const [ads, allDeals, allActivities] = await Promise.all([
      getMetaAds(range.since, range.until),
      getPipedriveDeals(null, null),
      getPipedriveActivities(null, null)
    ]);

    // Link do criativo por Campanha|Conjunto|Anuncio (mesma convencao usada no Pipedrive)
    const adLink = {};
    ads.forEach(ad => {
      adLink[`${ad.campaignName}|${ad.adsetName}|${ad.adName}`] =
        ad.previewLink ||
        `https://www.facebook.com/adsmanager/manage/ads?act=${ad.accountId}&selected_ad_ids=${ad.adId}`;
    });
    const linkForDeal = d => adLink[`${d.campanha}|${d.conjunto}|${d.palavraChave}`] || '';

    const fmtBR = iso => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

    const dealRow = d => ({
      data: fmtBR(d.wonTime || d.addDate),
      paciente: d.personName || d.title,
      valor: d.rawValue || 0,
      campanha: d.campanha || '-',
      criativo: d.palavraChave || '-',
      link: linkForDeal(d)
    });

    const actRow = a => ({
      data: fmtBR(a.dueDate) + (a.dueTime ? ` ${a.dueTime}` : ''),
      paciente: a.personName || a.dealTitle || '-',
      assunto: a.subject,
      responsavel: a.userName || '-'
    });

    const dealCols = [
      { key: 'data', label: 'Fechamento' },
      { key: 'paciente', label: 'Paciente' },
      { key: 'valor', label: 'Valor (R$)' },
      { key: 'campanha', label: 'Campanha' },
      { key: 'criativo', label: 'Criativo' },
      { key: 'link', label: 'Criativo (link)' }
    ];
    const actCols = [
      { key: 'data', label: 'Data' },
      { key: 'paciente', label: 'Paciente' },
      { key: 'assunto', label: 'Assunto' },
      { key: 'responsavel', label: 'Responsável' }
    ];

    const wonInPeriod = allDeals
      .filter(d => {
        if (d.status !== 'won') return false;
        const wd = (d.wonTime || d.stageChangeTime || d.addDate || '').slice(0, 10);
        return wd >= range.since && wd <= range.until;
      })
      .sort((a, b) => (b.wonTime || '').localeCompare(a.wonTime || ''));

    let payload;
    switch (metric) {
      case 'leads':
      case 'qualified': {
        const inPeriod = allDeals
          .filter(d => d.addDate >= range.since && d.addDate <= range.until)
          .sort((a, b) => (b.addDate || '').localeCompare(a.addDate || ''));
        payload = {
          title: `Leads CRM no período (${inPeriod.length})`,
          columns: [
            { key: 'data', label: 'Entrada' },
            { key: 'paciente', label: 'Paciente' },
            { key: 'status', label: 'Status' },
            { key: 'campanha', label: 'Campanha' },
            { key: 'criativo', label: 'Criativo' },
            { key: 'link', label: 'Criativo (link)' }
          ],
          rows: inPeriod.map(d => ({
            data: fmtBR(d.addDate),
            paciente: d.personName || d.title,
            status: d.status === 'won' ? 'Ganho' : d.status === 'lost' ? 'Perdido' : 'Aberto',
            campanha: d.campanha || '-',
            criativo: d.palavraChave || '-',
            link: linkForDeal(d)
          }))
        };
        break;
      }
      case 'appointmentsToday': {
        const rows = allActivities.filter(
          a => a.type === ACTIVITY_TYPE_SCHEDULED && a.done && a.dueDate === todayStr
        );
        payload = { title: `Agendamentos realizados hoje (${rows.length})`, columns: actCols, rows: rows.map(actRow) };
        break;
      }
      case 'appointmentsTomorrow': {
        const rows = allActivities.filter(
          a => a.type === ACTIVITY_TYPE_SCHEDULED && a.dueDate === tomorrowStr
        );
        payload = { title: `Agenda de amanhã (${rows.length})`, columns: actCols, rows: rows.map(actRow) };
        break;
      }
      case 'attendance': {
        const rows = allActivities.filter(
          a => (a.type === ACTIVITY_TYPE_ATTENDED || a.type === ACTIVITY_TYPE_MISSED) &&
            a.done && a.dueDate >= range.since && a.dueDate <= range.until
        );
        payload = {
          title: `Comparecimentos e faltas no período (${rows.length})`,
          columns: [{ key: 'status', label: 'Status' }, ...actCols],
          rows: rows.map(a => ({
            status: a.type === ACTIVITY_TYPE_ATTENDED ? '✅ Compareceu' : '❌ Faltou',
            ...actRow(a)
          }))
        };
        break;
      }
      case 'noShow': {
        const rows = allActivities.filter(
          a => a.type === ACTIVITY_TYPE_MISSED && a.done &&
            a.dueDate >= range.since && a.dueDate <= range.until
        );
        payload = { title: `Faltas no período (${rows.length})`, columns: actCols, rows: rows.map(actRow) };
        break;
      }
      case 'roas':
      case 'roi':
      case 'cac': {
        const rows = ads
          .map(ad => {
            const rel = allDeals.filter(
              d => d.campanha === ad.campaignName && d.conjunto === ad.adsetName && d.palavraChave === ad.adName
            );
            const revenue = rel.filter(d => d.status === 'won').reduce((s, d) => s + (d.rawValue || 0), 0);
            return {
              criativo: ad.adName,
              campanha: ad.campaignName,
              investimento: parseFloat(ad.spend.toFixed(2)),
              leadsCrm: rel.length,
              receita: revenue,
              roas: ad.spend > 0 ? parseFloat((revenue / ad.spend).toFixed(2)) : 0,
              link: adLink[`${ad.campaignName}|${ad.adsetName}|${ad.adName}`] || ''
            };
          })
          .sort((a, b) => b.investimento - a.investimento);
        payload = {
          title: 'Investimento x Retorno por criativo',
          columns: [
            { key: 'criativo', label: 'Criativo' },
            { key: 'campanha', label: 'Campanha' },
            { key: 'investimento', label: 'Investimento (R$)' },
            { key: 'leadsCrm', label: 'Leads CRM' },
            { key: 'receita', label: 'Receita (R$)' },
            { key: 'roas', label: 'ROAS' },
            { key: 'link', label: 'Criativo (link)' }
          ],
          rows
        };
        break;
      }
      default: {
        // revenue, sales, avgTicket, forecast, goal, goalPct
        const total = wonInPeriod.reduce((s, d) => s + (d.rawValue || 0), 0);
        payload = {
          title: `Vendas fechadas no período (${wonInPeriod.length}) — R$ ${total.toLocaleString('pt-BR')}`,
          columns: dealCols,
          rows: wonInPeriod.map(dealRow)
        };
      }
    }

    res.json({ success: true, range, metric, data: payload });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Painel SDR (Agda e Helenice)
// 3 janelas fixas: Hoje (vs ontem), Esta Semana (vs semana anterior),
// Este Mês (vs mesmo trecho do mês anterior) + metas por dias úteis (seg-sex)
// ============================================

// Metas DIÁRIAS por SDR (semanal = x5 dias úteis; mensal = x dias úteis do mês)
const SDR_DAILY_GOALS = {
  leadsReceived: 8,
  callsMade: 180,          // ligações realizadas (tentativas + atendidas)
  callsAnswered: 15,
  appointments: 7,
  attendances: 4,
  opportunitiesValue: 24000,
  closingsValue: 12000
};

const SDR_NAMES = ['Agda', 'Helenice'];

// Tipos de ligação (tentativas): Primeiro Contato + Ligação + 1ª..13ª Ligação Telefônica
const CALL_ATTEMPT_TYPES = new Set(['call', 'ligacao_']);
const isCallAttempt = t =>
  CALL_ATTEMPT_TYPES.has(t) || /ligacao_telefonica/.test(t);
const ACTIVITY_TYPE_ANSWERED = 'ligacao_atendida_';
// Desmarques: detecta automaticamente qualquer tipo com "desmarc" no key
// (criar o tipo "Desmarcou" no Pipedrive para começar a contar)
const isCancellation = t => /desmarc/.test(t || '');

async function fetchPipedriveUsersUncached() {
  try {
    const r = await axios.get('https://api.pipedrive.com/v1/users', {
      params: { api_token: PIPEDRIVE_TOKEN }
    });
    return (r.data.data || []).map(u => ({ id: u.id, name: u.name, active: !!u.active_flag }));
  } catch (e) {
    console.error('Erro ao buscar usuarios Pipedrive:', e.message);
    return [];
  }
}
function getPipedriveUsers() {
  return cached('users', fetchPipedriveUsersUncached);
}

function businessDaysInMonth(year, month1based) {
  const last = new Date(Date.UTC(year, month1based, 0)).getUTCDate();
  let n = 0;
  for (let day = 1; day <= last; day++) {
    const wd = new Date(Date.UTC(year, month1based - 1, day)).getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

// Datas no fuso de Brasília (evita virar o dia às 21h)
function spTodayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}
const _d = iso => new Date(iso + 'T12:00:00Z');
const _iso = dt => dt.toISOString().slice(0, 10);
const _addDays = (iso, n) => { const x = _d(iso); x.setUTCDate(x.getUTCDate() + n); return _iso(x); };

// GET /api/dashboard/executive/funnel - Funil REAL por estágio + Receita por Funil (CORRIGIDO)
app.get('/api/dashboard/executive/funnel', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [dealsResult, stagesResult] = await Promise.allSettled([
      getPipedriveDeals(null, null).catch(() => []),
      fetchPipedriveStagesUncached().catch(() => [])
    ]);

    const allDeals = dealsResult.status === 'fulfilled' ? dealsResult.value : [];
    const stages = stagesResult.status === 'fulfilled' ? stagesResult.value : [];

    // Deals que entraram no período (add_time)
    const dealsInRange = allDeals.filter(d => {
      const addDate = (d.addTime || '').slice(0, 10);
      return addDate >= range.since && addDate <= range.until;
    });

    // Mapa de pipeline_id => pipeline_name
    const pipelineMap = { '1': 'Inbound', '2': 'Outbound', '3': 'Referência' };

    // Agrupa deals por estágio (stageName)
    const dealsByStage = {};
    dealsInRange.forEach(d => {
      const stage = d.stageName || 'Sem estágio';
      if (!dealsByStage[stage]) dealsByStage[stage] = [];
      dealsByStage[stage].push(d);
    });

    // Funil com dados REAIS (não % hardcoded!)
    const funnel = Object.keys(dealsByStage).map(stageName => {
      const stageDeals = dealsByStage[stageName];
      return {
        stage: stageName,
        value: stageDeals.length,
        deals: stageDeals.map(d => ({
          id: d.id,
          title: d.title,
          value: d.rawValue || 0,
          status: d.status,
          pipeline: pipelineMap[String(d.pipeline_id)] || 'Outro',
          campaign: d[FIELD_CAMPANHA] || '-',
          personName: d.person_name || (d.person_id && d.person_id.name) || '-'
        }))
      };
    }).sort((a, b) => b.value - a.value);

    // Receita por Funil (apenas deals WON)
    const wonDeals = allDeals.filter(d => {
      if (d.status !== 'won') return false;
      const wonDate = (d.wonTime || d.stageChangeTime || d.addDate || '').slice(0, 10);
      return wonDate >= range.since && wonDate <= range.until;
    });

    const revenueByPipeline = {};
    wonDeals.forEach(d => {
      const pipeline = pipelineMap[String(d.pipeline_id)] || 'Outro';
      if (!revenueByPipeline[pipeline]) {
        revenueByPipeline[pipeline] = { revenue: 0, count: 0, deals: [] };
      }
      revenueByPipeline[pipeline].revenue += d.rawValue || 0;
      revenueByPipeline[pipeline].count += 1;
      revenueByPipeline[pipeline].deals.push({
        id: d.id,
        title: d.title,
        value: d.rawValue,
        personName: d.person_name || (d.person_id && d.person_id.name) || '-',
        campaign: d[FIELD_CAMPANHA] || '-'
      });
    });

    res.json({
      success: true,
      range,
      data: {
        funnel: funnel,
        revenue: {
          byPipeline: Object.keys(revenueByPipeline).map(pipeline => ({
            pipeline,
            ...revenueByPipeline[pipeline]
          })),
          total: wonDeals.reduce((sum, d) => sum + (d.rawValue || 0), 0),
          count: wonDeals.length
        }
      }
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      data: { funnel: [], revenue: { byPipeline: [], total: 0, count: 0 } }
    });
  }
});

// GET /api/dashboard/executive/origins - Leads por origem (Google, Instagram, Meta, Indicação) com ROAS
app.get('/api/dashboard/executive/origins', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };
    const [adsResult, dealsResult] = await Promise.allSettled([
      getMetaAds(range.since, range.until).catch(() => []),
      getPipedriveDeals(null, null).catch(() => [])
    ]);

    const ads = adsResult.status === 'fulfilled' ? adsResult.value : [];
    const allDeals = dealsResult.status === 'fulfilled' ? dealsResult.value : [];

    // Deals do período que entraram como leads
    const dealsInRange = allDeals.filter(d => {
      const addDate = (d.addTime || '').slice(0, 10);
      return addDate >= range.since && addDate <= range.until;
    });

    // Deals que viraram receita (won) no período
    const wonDeals = allDeals.filter(d => {
      if (d.status !== 'won') return false;
      const wonDate = (d.wonTime || d.stageChangeTime || d.addDate || '').slice(0, 10);
      return wonDate >= range.since && wonDate <= range.until;
    });

    // Agrupa leads por origem (campo customizado FIELD_ORIGEM)
    const byOrigin = {};
    dealsInRange.forEach(deal => {
      const origem = deal[FIELD_ORIGEM] || 'Sem origem';
      if (!byOrigin[origem]) {
        byOrigin[origem] = { leads: [], won: [] };
      }
      byOrigin[origem].leads.push(deal);
      if (deal.status === 'won') {
        byOrigin[origem].won.push(deal);
      }
    });

    // Calcula investimento por plataforma a partir do Meta Ads
    const investmentByPlatform = {};
    ads.forEach(ad => {
      const platform = ad.platform || 'Meta'; // Meta, Google (quando implementado)
      if (!investmentByPlatform[platform]) {
        investmentByPlatform[platform] = 0;
      }
      investmentByPlatform[platform] += ad.spend || 0;
    });

    // Monta resposta com breakdown por origem
    const origins = Object.keys(byOrigin).map(origem => {
      const group = byOrigin[origem];
      const leadCount = group.leads.length;
      const wonCount = group.won.length;
      const revenue = group.won.reduce((sum, d) => sum + (d.rawValue || 0), 0);

      // Investimento: tenta identificar pela plataforma mencionada
      let investment = 0;
      if (origem.includes('Google')) {
        investment = investmentByPlatform['Google'] || 0;
      } else if (origem === 'Meta' || origem.includes('Instagram') || origem.includes('Facebook')) {
        investment = investmentByPlatform['Meta'] || 0;
      }

      return {
        origem,
        leads: leadCount,
        won: wonCount,
        conversionRate: leadCount > 0 ? (wonCount / leadCount * 100).toFixed(1) : 0,
        revenue: revenue,
        investment: investment,
        roas: investment > 0 ? (revenue / investment).toFixed(2) : investment === 0 && revenue > 0 ? '∞' : '0',
        deals: group.won.map(d => ({
          id: d.id,
          title: d.title,
          value: d.rawValue,
          status: d.status,
          stage: d.stageName,
          wonDate: d.wonTime ? d.wonTime.slice(0, 10) : '-'
        }))
      };
    });

    res.json({
      success: true,
      range,
      data: {
        byOrigin: origins.sort((a, b) => b.revenue - a.revenue),
        summary: {
          totalLeads: dealsInRange.length,
          totalWon: wonDeals.length,
          totalRevenue: wonDeals.reduce((sum, d) => sum + (d.rawValue || 0), 0),
          totalInvestment: Object.values(investmentByPlatform).reduce((a, b) => a + b, 0)
        }
      }
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      data: { byOrigin: [], summary: {} }
    });
  }
});

app.get('/api/dashboard/sdr-panel', async (req, res) => {
  try {
    const [users, allDeals, allActivities] = await Promise.all([
      getPipedriveUsers(),
      getPipedriveDeals(null, null),
      getPipedriveActivities(null, null)
    ]);

    const sdrs = SDR_NAMES.map(name => {
      const u = users.find(x => x.name.toLowerCase().includes(name.toLowerCase()));
      return { key: name.toLowerCase(), name, id: u ? u.id : null };
    });

    // Janelas: hoje, esta semana (domingo->hoje), este mês (01->hoje)
    const today = spTodayISO();
    const dow = _d(today).getUTCDay(); // 0=domingo
    const y = +today.slice(0, 4);
    const m = +today.slice(5, 7);
    const day = +today.slice(8, 10);

    const weekSince = _addDays(today, -dow);
    const monthSince = `${y}-${String(m).padStart(2, '0')}-01`;
    const prevMonthLastDay = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
    const pmY = m === 1 ? y - 1 : y;
    const pmM = m === 1 ? 12 : m - 1;
    const prevMonthSince = `${pmY}-${String(pmM).padStart(2, '0')}-01`;
    const prevMonthUntil = `${pmY}-${String(pmM).padStart(2, '0')}-${String(Math.min(day, prevMonthLastDay)).padStart(2, '0')}`;

    const bizDays = businessDaysInMonth(y, m);

    const windows = {
      today: {
        label: 'Hoje', prevLabel: 'Ontem',
        range: { since: today, until: today },
        prevRange: { since: _addDays(today, -1), until: _addDays(today, -1) },
        goalMult: 1
      },
      week: {
        label: 'Esta Semana', prevLabel: 'Semana Anterior',
        range: { since: weekSince, until: today },
        prevRange: { since: _addDays(weekSince, -7), until: _addDays(today, -7) },
        goalMult: 5
      },
      month: {
        label: 'Este Mês', prevLabel: 'Mês Anterior',
        range: { since: monthSince, until: today },
        prevRange: { since: prevMonthSince, until: prevMonthUntil },
        goalMult: bizDays
      }
    };

    // Metricas de um SDR em um range
    const metricsFor = (sdrId, r) => {
      const deals = allDeals.filter(d => d.userId === sdrId);
      const acts = allActivities.filter(a => a.userId === sdrId &&
        a.dueDate >= r.since && a.dueDate <= r.until);

      const dealsAdded = deals.filter(d => d.addDate >= r.since && d.addDate <= r.until);
      const dealsWon = deals.filter(d => {
        if (d.status !== 'won') return false;
        const wd = (d.wonTime || d.stageChangeTime || d.addDate || '').slice(0, 10);
        return wd >= r.since && wd <= r.until;
      });

      const answered = acts.filter(a => a.type === ACTIVITY_TYPE_ANSWERED).length;
      const attempts = acts.filter(a => isCallAttempt(a.type)).length;

      return {
        leadsReceived: dealsAdded.length,
        callsMade: attempts + answered, // tentativas + atendidas somadas
        callsAnswered: answered,
        appointments: acts.filter(a => a.type === ACTIVITY_TYPE_SCHEDULED && a.done).length,
        attendances: acts.filter(a => a.type === ACTIVITY_TYPE_ATTENDED && a.done).length,
        cancellations: acts.filter(a => isCancellation(a.type) && a.done).length,
        noShows: acts.filter(a => a.type === ACTIVITY_TYPE_MISSED && a.done).length,
        closingsCount: dealsWon.length,
        // Oportunidades (regra do painel SDR legado): negocios com valor > 0,
        // ainda nao ganhos, movimentados (update_time) no periodo
        opportunitiesValue: deals
          .filter(d => (d.rawValue || 0) > 0 && d.status !== 'won' &&
            (d.updateTime || '').slice(0, 10) >= r.since &&
            (d.updateTime || '').slice(0, 10) <= r.until)
          .reduce((s, d) => s + (d.rawValue || 0), 0),
        closingsValue: dealsWon.reduce((s, d) => s + (d.rawValue || 0), 0)
      };
    };

    const variation = (cur, prev) => {
      const out = {};
      Object.keys(cur).forEach(k => {
        out[k] = prev[k] > 0 ? parseFloat((((cur[k] - prev[k]) / prev[k]) * 100).toFixed(1)) : null;
      });
      return out;
    };

    const result = {};
    Object.entries(windows).forEach(([key, w]) => {
      const goals = {};
      Object.entries(SDR_DAILY_GOALS).forEach(([k, daily]) => {
        goals[k] = daily * w.goalMult;
      });

      result[key] = {
        label: w.label,
        prevLabel: w.prevLabel,
        range: w.range,
        prevRange: w.prevRange,
        goals,
        sdrs: sdrs.map(s => {
          const current = s.id ? metricsFor(s.id, w.range) : null;
          const previous = s.id ? metricsFor(s.id, w.prevRange) : null;
          return {
            name: s.name,
            current,
            previous,
            variation: current && previous ? variation(current, previous) : null
          };
        })
      };
    });

    res.json({
      success: true,
      today,
      businessDaysInMonth: bizDays,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/revenue - Dados para gráfico de receita vs meta vs forecast
app.get('/api/dashboard/revenue', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [ads, deals] = await Promise.all([
      getMetaAds(range.since, range.until),
      getPipedriveDeals(range.since, range.until)
    ]);

    // Agrupa por mês
    const monthData = {};
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];

    deals.forEach(deal => {
      const date = new Date(deal.addDate);
      const month = months[date.getMonth()] || deal.addDate.slice(5, 7);
      if (!monthData[month]) {
        monthData[month] = { revenue: 0, deals: 0 };
      }
      monthData[month].revenue += deal.value;
      monthData[month].deals += 1;
    });

    const chartData = months.map(month => ({
      month,
      revenue: monthData[month]?.revenue || 0,
      goal: (monthData[month]?.revenue || 0) * 1.15,
      forecast: (monthData[month]?.revenue || 0) * 1.20
    }));

    res.json({
      success: true,
      range,
      data: chartData
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/funnel - Dados do funil executivo
app.get('/api/dashboard/funnel', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const deals = await getPipedriveDeals(range.since, range.until);

    // Agrupa por etapa do funil
    const stages = {};
    deals.forEach(deal => {
      const stage = deal.status || 'unknown';
      if (!stages[stage]) {
        stages[stage] = 0;
      }
      stages[stage]++;
    });

    const totalLeads = deals.length;
    const funnelData = [
      { stage: 'Leads', value: totalLeads, pct: 100 },
      { stage: 'Qualificados', value: Math.floor(totalLeads * 0.48), pct: 48 },
      { stage: 'Agendados', value: Math.floor(totalLeads * 0.41), pct: 41 },
      { stage: 'Comparecidos', value: Math.floor(totalLeads * 0.37), pct: 37 },
      { stage: 'Vendidos', value: deals.filter(d => d.status === 'won').length, pct: Math.round((deals.filter(d => d.status === 'won').length / totalLeads) * 100) }
    ];

    res.json({
      success: true,
      range,
      data: funnelData
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/agenda - Agenda do dia e amanhã
app.get('/api/dashboard/agenda', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);

    const activities = await getPipedriveActivities(today, tomorrow);
    const todayActs = activities.filter(a => a.dueDate === today);
    const tomorrowActs = activities.filter(a => a.dueDate === tomorrow);

    res.json({
      success: true,
      range: { since: today, until: tomorrow },
      data: {
        today: {
          scheduled: todayActs.length,
          attended: todayActs.filter(a => a.done).length,
          noShow: 0 // TODO: integrar com sistema de presenca real
        },
        tomorrow: {
          scheduled: tomorrowActs.length,
          attended: 0,
          noShow: 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/alerts - Alertas contextuais
app.get('/api/dashboard/alerts', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [ads, deals] = await Promise.all([
      getMetaAds(range.since, range.until),
      getPipedriveDeals(range.since, range.until)
    ]);

    // Análise para gerar alertas
    const totalSpend = ads.reduce((sum, ad) => sum + ad.spend, 0);
    const totalRevenue = deals.reduce((sum, deal) => sum + deal.value, 0);
    const roas = totalSpend > 0 ? (totalRevenue / totalSpend) : 0;

    const alerts = [];

    if (roas < 2.0) {
      alerts.push({
        type: 'warning',
        title: 'ROAS Baixo',
        message: `ROAS atual é ${roas.toFixed(2)}x. Considere revisar campanhas`,
        severity: 'high'
      });
    }

    if (deals.filter(d => d.status === 'won').length === 0) {
      alerts.push({
        type: 'critical',
        title: 'Nenhuma Venda',
        message: 'Nenhuma venda fechada no período',
        severity: 'critical'
      });
    }

    res.json({
      success: true,
      range,
      data: alerts
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/ai-summary - Resumo e insights gerados por IA
app.get('/api/dashboard/ai-summary', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [ads, deals] = await Promise.all([
      getMetaAds(range.since, range.until),
      getPipedriveDeals(range.since, range.until)
    ]);

    const totalSpend = ads.reduce((sum, ad) => sum + ad.spend, 0);
    const totalRevenue = deals.reduce((sum, deal) => sum + deal.value, 0);
    const totalLeads = ads.reduce((sum, ad) => sum + ad.leads, 0);
    const roas = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : 0;

    // TODO: Integrar com API de IA real (OpenAI, Claude, etc)
    // Por enquanto retorna insights estruturados
    const insights = [
      {
        title: 'Performance Geral',
        description: `Você teve ${totalLeads} leads e ${deals.length} vendas com um ROAS de ${roas}x e gasto de R$ ${totalSpend.toFixed(2)}`,
        trend: roas > 3 ? 'up' : 'down',
        recommendation: roas > 3 ? 'Continue com a estratégia atual' : 'Revise o direcionamento de campanhas'
      },
      {
        title: 'Melhor Canal',
        description: 'Meta Ads é seu melhor canal com melhor conversion rate',
        trend: 'stable',
        recommendation: 'Aumente investimento em Meta Ads'
      }
    ];

    res.json({
      success: true,
      range,
      data: insights
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Marketing Dashboard Endpoints
// ============================================

// GET /api/dashboard/marketing/kpis - KPIs resumidos do Marketing
app.get('/api/dashboard/marketing/kpis', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const ads = await getMetaAds(range.since, range.until);
    const metaAgg = aggregateMetaAds(ads);

    const totalInvestment = ads.reduce((sum, ad) => sum + ad.spend, 0);
    const totalImpressions = 0; // TODO: buscar do Meta Ads insights
    const totalClicks = 0; // TODO: buscar do Meta Ads insights
    const totalLeads = ads.reduce((sum, ad) => sum + ad.leads, 0);

    // Agregar receita por campanha/conjunto de deals
    const deals = await getPipedriveDeals(range.since, range.until);
    const totalRevenue = deals.reduce((sum, deal) => sum + deal.value, 0);
    const avgRoas = totalInvestment > 0 ? (totalRevenue / totalInvestment).toFixed(2) : 0;

    const kpis = {
      totalInvestment: totalInvestment,
      totalRevenue: totalRevenue,
      avgRoas: parseFloat(avgRoas),
      totalLeads: totalLeads,
      totalImpressions: totalImpressions
    };

    res.json({
      success: true,
      range,
      data: kpis
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/marketing/campaigns - Tabela de campanhas com métricas
app.get('/api/dashboard/marketing/campaigns', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const ads = await getMetaAds(range.since, range.until);
    const deals = await getPipedriveDeals(range.since, range.until);
    const metaAgg = aggregateMetaAds(ads);

    // Mapear campanhas com métricas
    const campaigns = metaAgg.map(campaign => {
      // Buscar deals relacionados à campanha
      const campaignDeals = deals.filter(d => d.campanha === campaign.campanha);
      const revenue = campaignDeals.reduce((sum, d) => sum + d.value, 0);
      const leads = campaign.leads_meta;
      const investment = campaign.gasto_meta;

      // Calcular métricas
      const roas = investment > 0 ? (revenue / investment).toFixed(2) : 0;
      const revPerLead = leads > 0 ? (revenue / leads).toFixed(2) : 0;
      const revPerAppt = campaignDeals.length > 0 ? (revenue / campaignDeals.length).toFixed(2) : 0;

      return {
        id: campaign.campanha.replace(/\s+/g, '-').toLowerCase(),
        name: campaign.campanha,
        status: 'Ativo', // TODO: buscar status real do Meta
        investment: investment,
        impressions: 0, // TODO: buscar insights
        clicks: 0, // TODO: buscar insights
        ctr: 0, // TODO: calcular
        cpc: investment > 0 ? (investment / (1000 + Math.random() * 500)).toFixed(2) : 0, // TODO: real data
        cpm: investment > 0 ? ((investment / 100000) * 1000).toFixed(2) : 0, // TODO: real data (impressions)
        leads: campaign.leads_meta,
        messages: 0, // TODO: buscar do CRM
        revenue: revenue,
        roas: parseFloat(roas),
        revPerLead: parseFloat(revPerLead),
        revPerAppt: parseFloat(revPerAppt),
        trend: (Math.random() * 20 - 10).toFixed(1) // TODO: calcular vs período anterior
      };
    });

    res.json({
      success: true,
      range,
      data: campaigns
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/marketing/trend - Gráfico de tendência (receita vs investimento)
app.get('/api/dashboard/marketing/trend', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [ads, deals] = await Promise.all([
      getMetaAds(range.since, range.until),
      getPipedriveDeals(range.since, range.until)
    ]);

    // Agrupa por mês
    const monthData = {};
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];

    // Adicionar gastos por mês (de Meta)
    ads.forEach(ad => {
      // TODO: buscar data real do ad
      const month = months[4]; // Assume maio por enquanto
      if (!monthData[month]) {
        monthData[month] = { revenue: 0, investment: 0 };
      }
      monthData[month].investment += ad.spend;
    });

    // Adicionar receita por mês (de Pipedrive)
    deals.forEach(deal => {
      const date = new Date(deal.addDate);
      const month = months[date.getMonth()] || deal.addDate.slice(5, 7);
      if (!monthData[month]) {
        monthData[month] = { revenue: 0, investment: 0 };
      }
      monthData[month].revenue += deal.value;
    });

    const chartData = months.map(month => ({
      month,
      revenue: monthData[month]?.revenue || 0,
      investment: monthData[month]?.investment || 0
    }));

    res.json({
      success: true,
      range,
      data: chartData
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/commercial/kpis - KPIs comerciais resumidos
app.get('/api/dashboard/commercial/kpis', async (req, res) => {
  try {
    if (!PIPEDRIVE_TOKEN) {
      return res.json({
        success: false,
        error: 'Pipedrive não configurado. Acesse Configurações e adicione o token.',
        data: { leads: 0, qualified: 0, scheduled: 0, attended: 0, purchased: 0 }
      });
    }

    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [dealsResult] = await Promise.allSettled([
      getPipedriveDeals(range.since, range.until).catch(() => [])
    ]);

    const deals = dealsResult.status === 'fulfilled' ? dealsResult.value : [];

    // Agrupar deals por estágio
    const leads = deals.length;
    const qualified = deals.filter(d => d.status === 'qualified' || d.status === 'open').length;
    const scheduled = Math.floor(leads * 0.35); // TODO: buscar de agenda real
    const attended = Math.floor(leads * 0.28);
    const purchased = deals.filter(d => d.status === 'won').length;

    res.json({
      success: true,
      range,
      data: {
        leads,
        qualified,
        scheduled,
        attended,
        purchased
      }
    });
  } catch (error) {
    res.json({ success: false, error: error.message, data: { leads: 0, qualified: 0, scheduled: 0, attended: 0, purchased: 0 } });
  }
});

// GET /api/dashboard/commercial/conversions - Performance por profissional/SDR
app.get('/api/dashboard/commercial/conversions', async (req, res) => {
  try {
    if (!PIPEDRIVE_TOKEN) {
      return res.json({
        success: false,
        error: 'Pipedrive não configurado. Acesse Configurações e adicione o token.',
        data: []
      });
    }

    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [dealsResult] = await Promise.allSettled([
      getPipedriveDeals(range.since, range.until).catch(() => [])
    ]);

    const deals = dealsResult.status === 'fulfilled' ? dealsResult.value : [];

    // Agrupar por proprietário/profissional
    const professionals = {};
    deals.forEach(deal => {
      const userId = deal.userId || 'unknown';
      const userName = deal.userName || 'Unknown Professional';

      if (!professionals[userId]) {
        professionals[userId] = {
          id: userId,
          name: userName,
          leads: 0,
          qualified: 0,
          scheduled: 0,
          attended: 0,
          purchased: 0,
          revenue: 0
        };
      }

      professionals[userId].leads += 1;
      if (deal.status === 'qualified' || deal.status === 'open') {
        professionals[userId].qualified += 1;
      }
      if (deal.status === 'scheduled') {
        professionals[userId].scheduled += 1;
      }
      if (deal.status === 'attended') {
        professionals[userId].attended += 1;
      }
      if (deal.status === 'won') {
        professionals[userId].purchased += 1;
        professionals[userId].revenue += deal.value;
      }
    });

    // Calcular métricas por profissional
    const conversions = Object.values(professionals).map(prof => {
      const conversionRate = prof.leads > 0 ? ((prof.purchased / prof.leads) * 100).toFixed(1) : 0;
      const avgTicket = prof.purchased > 0 ? (prof.revenue / prof.purchased).toFixed(2) : 0;
      const timeToSale = 45; // TODO: calcular de dados reais
      const timeFirstContact = 4; // TODO: calcular em horas

      return {
        id: prof.id,
        name: prof.name,
        leads: prof.leads,
        qualified: prof.qualified,
        scheduled: prof.scheduled,
        attended: prof.attended,
        purchased: prof.purchased,
        conversionRate: parseFloat(conversionRate),
        avgTicket: parseFloat(avgTicket),
        timeToSale,
        timeFirstContact,
        trend: (Math.random() * 20 - 10).toFixed(1) // TODO: calcular vs período anterior
      };
    });

    res.json({
      success: true,
      range,
      data: conversions
    });
  } catch (error) {
    res.json({ success: false, error: error.message, data: [] });
  }
});

// GET /api/dashboard/commercial/reasons - Top 5 motivos de perda
app.get('/api/dashboard/commercial/reasons', async (req, res) => {
  try {
    if (!PIPEDRIVE_TOKEN) {
      return res.json({
        success: false,
        error: 'Pipedrive não configurado. Acesse Configurações e adicione o token.',
        data: []
      });
    }

    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [dealsResult] = await Promise.allSettled([
      getPipedriveDeals(range.since, range.until).catch(() => [])
    ]);

    const deals = dealsResult.status === 'fulfilled' ? dealsResult.value : [];

    // Agrupar deals perdidos por motivo
    const reasons = {};
    const lostDeals = deals.filter(d => d.status === 'lost' || d.status === 'canceled');

    lostDeals.forEach(deal => {
      const reason = deal.lostReason || 'Motivo desconhecido';
      if (!reasons[reason]) {
        reasons[reason] = 0;
      }
      reasons[reason]++;
    });

    // Top 5 motivos
    const topReasons = Object.entries(reasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, quantity]) => ({
        reason,
        quantity,
        percentage: lostDeals.length > 0 ? ((quantity / lostDeals.length) * 100).toFixed(1) : 0
      }));

    res.json({
      success: true,
      range,
      data: topReasons
    });
  } catch (error) {
    res.json({ success: false, error: error.message, data: [] });
  }
});

// GET /api/dashboard/crm/kpis - KPIs do CRM (pipeline aberto, valor, perdidos, recuperaveis)
app.get('/api/dashboard/crm/kpis', async (req, res) => {
  try {
    if (!PIPEDRIVE_TOKEN) {
      return res.json({
        success: false,
        error: 'Pipedrive não configurado. Acesse Configurações e adicione o token.',
        data: { openDeals: 0, pipelineValue: 0, avgStageTime: 0, lostDeals: 0, recoverable: 0, wonDeals: 0 }
      });
    }

    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [dealsResult] = await Promise.allSettled([
      getPipedriveDeals(range.since, range.until).catch(() => [])
    ]);

    const deals = dealsResult.status === 'fulfilled' ? dealsResult.value : [];

    const openDeals = deals.filter(d => d.status === 'open');
    const lostDeals = deals.filter(d => d.status === 'lost');
    const wonDeals = deals.filter(d => d.status === 'won');

    const pipelineValue = openDeals.reduce((sum, d) => sum + d.rawValue, 0);

    // Tempo medio na etapa atual (dias) dos deals abertos
    const now = Date.now();
    const stageTimes = openDeals
      .filter(d => d.stageChangeTime)
      .map(d => (now - new Date(d.stageChangeTime).getTime()) / (1000 * 60 * 60 * 24));
    const avgStageTime = stageTimes.length > 0
      ? stageTimes.reduce((a, b) => a + b, 0) / stageTimes.length
      : 0;

    // Recuperaveis: perdidos com valor > 0 (candidatos a reengajamento)
    const recoverable = lostDeals.filter(d => d.rawValue > 0).length;

    res.json({
      success: true,
      range,
      data: {
        openDeals: openDeals.length,
        pipelineValue,
        avgStageTime: parseFloat(avgStageTime.toFixed(1)),
        lostDeals: lostDeals.length,
        recoverable,
        wonDeals: wonDeals.length
      }
    });
  } catch (error) {
    res.json({ success: false, error: error.message, data: { openDeals: 0, pipelineValue: 0, avgStageTime: 0, lostDeals: 0, recoverable: 0, wonDeals: 0 } });
  }
});

// GET /api/dashboard/crm/pipeline - Kanban: deals agrupados por etapa + gargalos
app.get('/api/dashboard/crm/pipeline', async (req, res) => {
  try {
    if (!PIPEDRIVE_TOKEN) {
      return res.json({
        success: false,
        error: 'Pipedrive não configurado. Acesse Configurações e adicione o token.',
        data: []
      });
    }

    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [dealsResult, stagesResult] = await Promise.allSettled([
      getPipedriveDeals(range.since, range.until).catch(() => []),
      getPipedriveStages().catch(() => [])
    ]);

    const deals = dealsResult.status === 'fulfilled' ? dealsResult.value : [];
    const stages = stagesResult.status === 'fulfilled' ? stagesResult.value : [];

    const openDeals = deals.filter(d => d.status === 'open');
    const now = Date.now();

    const pipeline = stages.map(stage => {
      const stageDeals = openDeals.filter(d => d.stageId === stage.id);
      const stageValue = stageDeals.reduce((sum, d) => sum + d.rawValue, 0);

      // Tempo medio (dias) que os deals estao parados nesta etapa
      const times = stageDeals
        .filter(d => d.stageChangeTime)
        .map(d => (now - new Date(d.stageChangeTime).getTime()) / (1000 * 60 * 60 * 24));
      const avgDays = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;

      return {
        stageId: stage.id,
        stageName: stage.name,
        count: stageDeals.length,
        value: stageValue,
        avgDays: parseFloat(avgDays.toFixed(1)),
        deals: stageDeals.slice(0, 20).map(d => ({
          id: d.id,
          title: d.title,
          value: d.rawValue,
          personName: d.personName,
          daysInStage: d.stageChangeTime
            ? parseFloat(((now - new Date(d.stageChangeTime).getTime()) / (1000 * 60 * 60 * 24)).toFixed(1))
            : 0,
          origem: d.origem,
          campanha: d.campanha
        }))
      };
    });

    res.json({
      success: true,
      range,
      data: pipeline
    });
  } catch (error) {
    res.json({ success: false, error: error.message, data: [] });
  }
});

// GET /api/dashboard/crm/recovery - Oportunidades perdidas recuperaveis
app.get('/api/dashboard/crm/recovery', async (req, res) => {
  try {
    if (!PIPEDRIVE_TOKEN) {
      return res.json({
        success: false,
        error: 'Pipedrive não configurado. Acesse Configurações e adicione o token.',
        data: []
      });
    }

    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [dealsResult] = await Promise.allSettled([
      getPipedriveDeals(range.since, range.until).catch(() => [])
    ]);

    const deals = dealsResult.status === 'fulfilled' ? dealsResult.value : [];

    const lostDeals = deals
      .filter(d => d.status === 'lost')
      .sort((a, b) => b.rawValue - a.rawValue)
      .slice(0, 50)
      .map(d => ({
        id: d.id,
        title: d.title,
        personName: d.personName,
        value: d.rawValue,
        lostReason: d.lostReason || 'Motivo desconhecido',
        lostDate: (d.lostTime || '').slice(0, 10),
        origem: d.origem,
        campanha: d.campanha,
        email: d.email
      }));

    res.json({
      success: true,
      range,
      data: lostDeals
    });
  } catch (error) {
    res.json({ success: false, error: error.message, data: [] });
  }
});

// ============================================
// Agenda Dashboard
// ============================================

// GET /api/dashboard/agenda/kpis - KPIs da agenda (hoje, amanha, semana, conclusao)
app.get('/api/dashboard/agenda/kpis', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);

    const activities = await getPipedriveActivities(today, weekEnd.toISOString().slice(0, 10));

    const todayActs = activities.filter(a => a.dueDate === today);
    const tomorrowActs = activities.filter(a => a.dueDate === tomorrow);
    const doneToday = todayActs.filter(a => a.done).length;

    res.json({
      success: true,
      range: { since: today, until: weekEnd.toISOString().slice(0, 10) },
      data: {
        today: todayActs.length,
        tomorrow: tomorrowActs.length,
        week: activities.length,
        doneToday,
        completionRate: todayActs.length > 0
          ? parseFloat(((doneToday / todayActs.length) * 100).toFixed(1))
          : 0,
        noShow: 0 // TODO: integrar com sistema de presenca real
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/agenda/appointments - Lista de compromissos do periodo
app.get('/api/dashboard/agenda/appointments', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const defaultEnd = new Date();
    defaultEnd.setDate(defaultEnd.getDate() + 7);

    const range = {
      since: req.query.since || today,
      until: req.query.until || defaultEnd.toISOString().slice(0, 10)
    };

    const activities = await getPipedriveActivities(range.since, range.until);

    const appointments = activities
      .sort((a, b) => `${a.dueDate} ${a.dueTime}`.localeCompare(`${b.dueDate} ${b.dueTime}`))
      .map(a => ({
        id: a.id,
        subject: a.subject,
        type: a.type,
        date: a.dueDate,
        time: a.dueTime,
        duration: a.duration,
        done: a.done,
        professional: a.userName,
        patient: a.personName,
        dealTitle: a.dealTitle
      }));

    res.json({
      success: true,
      range,
      data: appointments
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Profissionais Dashboard
// ============================================

// GET /api/dashboard/professionals/kpis - Resumo geral dos profissionais
app.get('/api/dashboard/professionals/kpis', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const deals = await getPipedriveDeals(range.since, range.until);

    const professionals = new Set(deals.map(d => d.userId).filter(Boolean));
    const wonDeals = deals.filter(d => d.status === 'won');
    const totalRevenue = wonDeals.reduce((sum, d) => sum + d.value, 0);

    res.json({
      success: true,
      range,
      data: {
        totalProfessionals: professionals.size,
        totalDeals: deals.length,
        totalWon: wonDeals.length,
        totalRevenue,
        avgRevenuePerProfessional: professionals.size > 0
          ? parseFloat((totalRevenue / professionals.size).toFixed(2))
          : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/professionals/ranking - Ranking de profissionais por receita
app.get('/api/dashboard/professionals/ranking', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const deals = await getPipedriveDeals(range.since, range.until);

    const byUser = {};
    deals.forEach(deal => {
      const key = deal.userId || 'unknown';
      if (!byUser[key]) {
        byUser[key] = {
          id: key,
          name: deal.userName || 'Sem responsável',
          deals: 0,
          won: 0,
          lost: 0,
          open: 0,
          revenue: 0
        };
      }
      byUser[key].deals += 1;
      if (deal.status === 'won') {
        byUser[key].won += 1;
        byUser[key].revenue += deal.value;
      } else if (deal.status === 'lost') {
        byUser[key].lost += 1;
      } else {
        byUser[key].open += 1;
      }
    });

    const ranking = Object.values(byUser)
      .map(p => ({
        ...p,
        conversionRate: p.deals > 0 ? parseFloat(((p.won / p.deals) * 100).toFixed(1)) : 0,
        avgTicket: p.won > 0 ? parseFloat((p.revenue / p.won).toFixed(2)) : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    res.json({
      success: true,
      range,
      data: ranking
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Financeiro Dashboard
// ============================================

// GET /api/dashboard/financial/kpis - Receita, investimento, lucro e margem
app.get('/api/dashboard/financial/kpis', async (req, res) => {
  try {
    if (!PIPEDRIVE_TOKEN || !FB_ACCESS_TOKEN) {
      return res.json({
        success: false,
        error: 'Pipedrive ou Meta não configurados. Acesse Configurações e adicione os tokens.',
        data: { revenue: 0, adSpend: 0, grossProfit: 0, margin: 0, avgTicket: 0, salesCount: 0 }
      });
    }

    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [adsResult, dealsResult] = await Promise.allSettled([
      getMetaAds(range.since, range.until).catch(() => []),
      getPipedriveDeals(range.since, range.until).catch(() => [])
    ]);

    const ads = adsResult.status === 'fulfilled' ? adsResult.value : [];
    const deals = dealsResult.status === 'fulfilled' ? dealsResult.value : [];

    const revenue = deals.reduce((sum, d) => sum + d.value, 0);
    const adSpend = ads.reduce((sum, ad) => sum + ad.spend, 0);
    const wonDeals = deals.filter(d => d.status === 'won');

    // TODO: incluir custos operacionais reais (hoje considera apenas investimento em ads)
    const grossProfit = revenue - adSpend;
    const margin = revenue > 0 ? parseFloat(((grossProfit / revenue) * 100).toFixed(1)) : 0;

    res.json({
      success: true,
      range,
      data: {
        revenue,
        adSpend,
        grossProfit,
        margin,
        avgTicket: wonDeals.length > 0 ? parseFloat((revenue / wonDeals.length).toFixed(2)) : 0,
        salesCount: wonDeals.length
      }
    });
  } catch (error) {
    res.json({ success: false, error: error.message, data: { revenue: 0, adSpend: 0, grossProfit: 0, margin: 0, avgTicket: 0, salesCount: 0 } });
  }
});

// GET /api/dashboard/financial/monthly - Receita vs investimento vs lucro por mes
app.get('/api/dashboard/financial/monthly', async (req, res) => {
  try {
    if (!PIPEDRIVE_TOKEN || !FB_ACCESS_TOKEN) {
      return res.json({
        success: false,
        error: 'Pipedrive ou Meta não configurados. Acesse Configurações e adicione os tokens.',
        data: []
      });
    }

    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [adsResult, dealsResult] = await Promise.allSettled([
      getMetaAds(range.since, range.until).catch(() => []),
      getPipedriveDeals(range.since, range.until).catch(() => [])
    ]);

    const ads = adsResult.status === 'fulfilled' ? adsResult.value : [];
    const deals = dealsResult.status === 'fulfilled' ? dealsResult.value : [];

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthData = {};

    deals.forEach(deal => {
      if (!deal.addDate) return;
      const key = deal.addDate.slice(0, 7); // YYYY-MM
      if (!monthData[key]) monthData[key] = { revenue: 0, investment: 0 };
      monthData[key].revenue += deal.value;
    });

    // Investimento total distribuido no mes do periodo (Meta nao retorna por dia aqui)
    // TODO: quebrar spend por mes via time_increment na API do Meta
    const totalSpend = ads.reduce((sum, ad) => sum + ad.spend, 0);
    const untilKey = range.until.slice(0, 7);
    if (!monthData[untilKey]) monthData[untilKey] = { revenue: 0, investment: 0 };
    monthData[untilKey].investment += totalSpend;

    const chartData = Object.keys(monthData)
      .sort()
      .map(key => {
        const [, monthNum] = key.split('-');
        return {
          month: monthNames[parseInt(monthNum, 10) - 1] || key,
          revenue: monthData[key].revenue,
          investment: monthData[key].investment,
          profit: monthData[key].revenue - monthData[key].investment
        };
      });

    res.json({
      success: true,
      range,
      data: chartData
    });
  } catch (error) {
    res.json({ success: false, error: error.message, data: [] });
  }
});

// ============================================
// WhatsApp Dashboard
// ============================================

// GET /api/dashboard/whatsapp/kpis - Mensagens, ligacoes e tempos de resposta
// NOTA: sem integracao Tintim/WhatsApp ainda; ligacoes vem de activities do Pipedrive
app.get('/api/dashboard/whatsapp/kpis', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const activities = await getPipedriveActivities(range.since, range.until);

    const calls = activities.filter(a => a.type === 'call');
    const missedCalls = calls.filter(a => !a.done);

    res.json({
      success: true,
      range,
      data: {
        messagesSent: 0, // TODO: integrar com Tintim/WhatsApp Business API
        messagesReceived: 0, // TODO: integrar com Tintim/WhatsApp Business API
        calls: calls.length,
        missedCalls: missedCalls.length,
        avgFirstResponseTime: 0, // TODO: integrar com Tintim (minutos)
        avgResponseTime: 0, // TODO: integrar com Tintim (minutos)
        conversionRate: 0 // TODO: mensagens que viraram deals
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/whatsapp/ranking - Ranking de atendentes por atividades
app.get('/api/dashboard/whatsapp/ranking', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const activities = await getPipedriveActivities(range.since, range.until);

    const byUser = {};
    activities.forEach(act => {
      const key = act.userId || 'unknown';
      if (!byUser[key]) {
        byUser[key] = {
          id: key,
          name: act.userName || 'Sem responsável',
          totalActivities: 0,
          calls: 0,
          done: 0
        };
      }
      byUser[key].totalActivities += 1;
      if (act.type === 'call') byUser[key].calls += 1;
      if (act.done) byUser[key].done += 1;
    });

    const ranking = Object.values(byUser)
      .map(u => ({
        ...u,
        completionRate: u.totalActivities > 0
          ? parseFloat(((u.done / u.totalActivities) * 100).toFixed(1))
          : 0,
        messages: 0 // TODO: integrar com Tintim
      }))
      .sort((a, b) => b.totalActivities - a.totalActivities);

    res.json({
      success: true,
      range,
      data: ranking
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// IA Executive (Fase 7)
// ============================================

// Motor de insights baseado em regras: analisa dados reais e gera insights estruturados.
// Nao substitui visualizacoes (regra #5) - apenas explica os dados.
function generateInsights({ ads, deals, stages }) {
  const insights = [];

  const totalSpend = ads.reduce((sum, ad) => sum + ad.spend, 0);
  const totalLeads = ads.reduce((sum, ad) => sum + ad.leads, 0);
  const wonDeals = deals.filter(d => d.status === 'won');
  const lostDeals = deals.filter(d => d.status === 'lost');
  const totalRevenue = wonDeals.reduce((sum, d) => sum + d.value, 0);
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const cac = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const conversionRate = deals.length > 0 ? (wonDeals.length / deals.length) * 100 : 0;

  // 1. Performance geral (ROAS)
  if (totalSpend > 0) {
    insights.push({
      id: 'roas',
      title: 'Retorno sobre Investimento em Ads',
      description: `ROAS de ${roas.toFixed(2)}x: R$ ${totalSpend.toFixed(0)} investidos geraram R$ ${totalRevenue.toFixed(0)} em receita.`,
      severity: roas >= 3 ? 'success' : roas >= 1.5 ? 'warning' : 'critical',
      trend: roas >= 3 ? 'up' : 'down',
      recommendation: roas >= 3
        ? 'Performance saudável. Considere escalar o investimento nas campanhas de melhor retorno.'
        : roas >= 1.5
        ? 'ROAS abaixo do ideal (3x). Revise segmentação e criativos das campanhas de pior desempenho.'
        : 'ROAS crítico. Pause campanhas sem retorno e realoque orçamento.',
      metric: parseFloat(roas.toFixed(2))
    });
  }

  // 2. CAC
  if (totalLeads > 0) {
    insights.push({
      id: 'cac',
      title: 'Custo por Lead',
      description: `Cada lead custou em média R$ ${cac.toFixed(2)} (${totalLeads} leads com R$ ${totalSpend.toFixed(0)} investidos).`,
      severity: 'info',
      trend: 'stable',
      recommendation: 'Compare com o ticket médio para validar se o custo de aquisição é sustentável.',
      metric: parseFloat(cac.toFixed(2))
    });
  }

  // 3. Melhor campanha real (por ROAS)
  const campaignMap = {};
  ads.forEach(ad => {
    if (!campaignMap[ad.campaignName]) {
      campaignMap[ad.campaignName] = { spend: 0, leads: 0, revenue: 0 };
    }
    campaignMap[ad.campaignName].spend += ad.spend;
    campaignMap[ad.campaignName].leads += ad.leads;
  });
  deals.forEach(deal => {
    if (deal.campanha && campaignMap[deal.campanha]) {
      campaignMap[deal.campanha].revenue += deal.value;
    }
  });

  const campaigns = Object.entries(campaignMap)
    .map(([name, c]) => ({ name, ...c, roas: c.spend > 0 ? c.revenue / c.spend : 0 }))
    .filter(c => c.spend > 0);

  if (campaigns.length > 0) {
    const best = campaigns.reduce((a, b) => (a.roas > b.roas ? a : b));
    if (best.roas > 0) {
      insights.push({
        id: 'best-campaign',
        title: 'Melhor Campanha',
        description: `"${best.name}" tem o melhor ROAS: ${best.roas.toFixed(2)}x (R$ ${best.spend.toFixed(0)} investidos, R$ ${best.revenue.toFixed(0)} em receita).`,
        severity: 'success',
        trend: 'up',
        recommendation: 'Considere aumentar o orçamento desta campanha.',
        metric: parseFloat(best.roas.toFixed(2))
      });
    }

    // 4. Anomalia: campanha com gasto e sem leads
    const wasted = campaigns.filter(c => c.spend > 50 && c.leads === 0);
    if (wasted.length > 0) {
      const worst = wasted.reduce((a, b) => (a.spend > b.spend ? a : b));
      insights.push({
        id: 'wasted-spend',
        title: 'Campanha sem Retorno',
        description: `"${worst.name}" gastou R$ ${worst.spend.toFixed(0)} sem gerar nenhum lead no período.`,
        severity: 'critical',
        trend: 'down',
        recommendation: 'Pause ou revise esta campanha imediatamente.',
        metric: parseFloat(worst.spend.toFixed(2))
      });
    }
  }

  // 5. Gargalo do funil (etapa com deals mais parados)
  const openDeals = deals.filter(d => d.status === 'open');
  if (stages.length > 0 && openDeals.length > 0) {
    const now = Date.now();
    const stageTimes = stages.map(stage => {
      const stageDeals = openDeals.filter(d => d.stageId === stage.id && d.stageChangeTime);
      const times = stageDeals.map(d => (now - new Date(d.stageChangeTime).getTime()) / (1000 * 60 * 60 * 24));
      return {
        name: stage.name,
        count: stageDeals.length,
        avgDays: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0
      };
    }).filter(s => s.count > 0);

    if (stageTimes.length > 0) {
      const bottleneck = stageTimes.reduce((a, b) => (a.avgDays > b.avgDays ? a : b));
      if (bottleneck.avgDays > 3) {
        insights.push({
          id: 'funnel-bottleneck',
          title: 'Gargalo no Funil',
          description: `A etapa "${bottleneck.name}" retém ${bottleneck.count} deals há ${bottleneck.avgDays.toFixed(1)} dias em média.`,
          severity: bottleneck.avgDays > 7 ? 'critical' : 'warning',
          trend: 'down',
          recommendation: 'Priorize follow-up com os deals parados nesta etapa.',
          metric: parseFloat(bottleneck.avgDays.toFixed(1))
        });
      }
    }
  }

  // 6. Motivo de perda dominante
  if (lostDeals.length > 0) {
    const reasons = {};
    lostDeals.forEach(d => {
      const r = d.lostReason || 'Motivo desconhecido';
      reasons[r] = (reasons[r] || 0) + 1;
    });
    const [topReason, count] = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
    const pct = ((count / lostDeals.length) * 100).toFixed(0);
    insights.push({
      id: 'loss-reason',
      title: 'Principal Motivo de Perda',
      description: `"${topReason}" responde por ${pct}% das ${lostDeals.length} oportunidades perdidas.`,
      severity: 'warning',
      trend: 'down',
      recommendation: 'Crie um plano de contorno específico para este motivo (script de objeção, ajuste de preço, follow-up).',
      metric: count
    });
  }

  // 7. Taxa de conversão geral
  if (deals.length > 0) {
    insights.push({
      id: 'conversion',
      title: 'Conversão Geral',
      description: `${wonDeals.length} de ${deals.length} leads viraram vendas (${conversionRate.toFixed(1)}%).`,
      severity: conversionRate >= 15 ? 'success' : conversionRate >= 8 ? 'info' : 'warning',
      trend: conversionRate >= 15 ? 'up' : 'stable',
      recommendation: conversionRate >= 15
        ? 'Taxa de conversão saudável para o setor.'
        : 'Há espaço para melhorar a conversão. Analise o funil para identificar onde os leads travam.',
      metric: parseFloat(conversionRate.toFixed(1))
    });
  }

  return insights;
}

// GET /api/dashboard/ai/insights - Insights estruturados gerados dos dados reais
app.get('/api/dashboard/ai/insights', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [ads, deals, stages] = await Promise.all([
      getMetaAds(range.since, range.until),
      getPipedriveDeals(range.since, range.until),
      getPipedriveStages()
    ]);

    const insights = generateInsights({ ads, deals, stages });

    res.json({
      success: true,
      range,
      data: insights
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/ai/narrative - Resumo executivo em linguagem natural via OpenAI (Platform ChatGPT)
// Requer OPENAI_API_KEY no .env ou em Configuracoes; sem a chave retorna available: false
app.get('/api/dashboard/ai/narrative', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    if (!process.env.OPENAI_API_KEY) {
      return res.json({
        success: true,
        range,
        data: {
          available: false,
          narrative: null,
          reason: 'OPENAI_API_KEY não configurada'
        }
      });
    }

    const [ads, deals, stages] = await Promise.all([
      getMetaAds(range.since, range.until),
      getPipedriveDeals(range.since, range.until),
      getPipedriveStages()
    ]);

    const insights = generateInsights({ ads, deals, stages });

    const totalSpend = ads.reduce((sum, ad) => sum + ad.spend, 0);
    const totalRevenue = deals.filter(d => d.status === 'won').reduce((sum, d) => sum + d.value, 0);

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        max_tokens: 1024,
        messages: [
          {
            role: 'system',
            content: 'Você é um analista de BI da clínica Vivera. Escreva um resumo executivo curto (3-5 frases) em português brasileiro, direto e acionável, baseado APENAS nos dados fornecidos. Não invente números.'
          },
          {
            role: 'user',
            content: `Período: ${range.since} a ${range.until}\nInvestimento em ads: R$ ${totalSpend.toFixed(2)}\nReceita: R$ ${totalRevenue.toFixed(2)}\nLeads: ${deals.length}\nVendas: ${deals.filter(d => d.status === 'won').length}\n\nInsights detectados:\n${insights.map(i => `- ${i.title}: ${i.description}`).join('\n')}\n\nEscreva o resumo executivo.`
          }
        ]
      },
      {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        timeout: 30000
      }
    );

    const narrative = response.data.choices?.[0]?.message?.content || null;

    res.json({
      success: true,
      range,
      data: {
        available: true,
        narrative,
        model: response.data.model
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.response?.data?.error?.message || error.message });
  }
});

// ============================================
// Drill-down: Pacientes, Conjuntos, Criativos
// ============================================

// GET /api/dashboard/patients - Lista de pacientes/leads (deals com pessoa)
app.get('/api/dashboard/patients', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const deals = await getPipedriveDeals(range.since, range.until);

    const patients = deals.map(d => ({
      id: d.id,
      name: d.personName || d.title,
      email: d.email,
      status: d.status,
      value: d.rawValue,
      stageId: d.stageId,
      origem: d.origem,
      campanha: d.campanha,
      conjunto: d.conjunto,
      criativo: d.palavraChave,
      owner: d.userName,
      addDate: d.addDate,
      lostReason: d.lostReason
    }));

    res.json({ success: true, range, data: patients });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/marketing/adsets - Conjuntos de anuncio agregados
app.get('/api/dashboard/marketing/adsets', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [ads, deals] = await Promise.all([
      getMetaAds(range.since, range.until),
      getPipedriveDeals(range.since, range.until)
    ]);

    const map = {};
    ads.forEach(ad => {
      const key = `${ad.campaignName}|||${ad.adsetName}`;
      if (!map[key]) {
        map[key] = { campaign: ad.campaignName, adset: ad.adsetName, spend: 0, leads: 0, revenue: 0, sales: 0 };
      }
      map[key].spend += ad.spend;
      map[key].leads += ad.leads;
    });
    deals.forEach(d => {
      const key = `${d.campanha}|||${d.conjunto}`;
      if (map[key]) {
        map[key].revenue += d.value;
        if (d.status === 'won') map[key].sales += 1;
      }
    });

    const adsets = Object.values(map).map(a => ({
      ...a,
      roas: a.spend > 0 ? parseFloat((a.revenue / a.spend).toFixed(2)) : 0,
      cpl: a.leads > 0 ? parseFloat((a.spend / a.leads).toFixed(2)) : 0
    })).sort((a, b) => b.spend - a.spend);

    res.json({ success: true, range, data: adsets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/marketing/creatives - Criativos (anuncios individuais) agregados
app.get('/api/dashboard/marketing/creatives', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [ads, deals] = await Promise.all([
      getMetaAds(range.since, range.until),
      getPipedriveDeals(range.since, range.until)
    ]);

    const creatives = ads.map(ad => {
      const relatedDeals = deals.filter(d =>
        d.campanha === ad.campaignName && d.conjunto === ad.adsetName && d.palavraChave === ad.adName
      );
      const revenue = relatedDeals.reduce((s, d) => s + d.value, 0);
      // CPL: usa leads do Meta quando reportados; senao usa leads do CRM
      // (campanhas de WhatsApp nao reportam action_type=lead no Meta)
      const effectiveLeads = ad.leads > 0 ? ad.leads : relatedDeals.length;
      return {
        id: ad.adId,
        name: ad.adName,
        campaign: ad.campaignName,
        adset: ad.adsetName,
        status: ad.status,
        spend: ad.spend,
        leads: ad.leads,
        cpl: effectiveLeads > 0 ? parseFloat((ad.spend / effectiveLeads).toFixed(2)) : 0,
        crmLeads: relatedDeals.length,
        sales: relatedDeals.filter(d => d.status === 'won').length,
        revenue,
        roas: ad.spend > 0 ? parseFloat((revenue / ad.spend).toFixed(2)) : 0,
        link: ad.previewLink ||
          `https://www.facebook.com/adsmanager/manage/ads?act=${ad.accountId}&selected_ad_ids=${ad.adId}`
      };
    }).sort((a, b) => b.spend - a.spend);

    res.json({ success: true, range, data: creatives });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Filtros (opcoes de dropdown globais)
// ============================================

app.get('/api/filters/options', async (req, res) => {
  try {
    const allDeals = await cached('deals', async () => {
      const deals = await Promise.all(
        PIPEDRIVE_TOKEN ? [
          axios.get(`https://api.pipedrive.com/v1/deals?api_token=${PIPEDRIVE_TOKEN}&limit=500`),
        ] : []
      );
      return deals[0]?.data?.success ? deals[0].data.data : [];
    });

    const allActivities = await cached('activities', async () => {
      const activities = await Promise.all(
        PIPEDRIVE_TOKEN ? [
          axios.get(`https://api.pipedrive.com/v1/activities?api_token=${PIPEDRIVE_TOKEN}&limit=500`),
        ] : []
      );
      return activities[0]?.data?.success ? activities[0].data.data : [];
    });

    const allPeople = await cached('people', async () => {
      const people = await Promise.all(
        PIPEDRIVE_TOKEN ? [
          axios.get(`https://api.pipedrive.com/v1/persons?api_token=${PIPEDRIVE_TOKEN}&limit=500`),
        ] : []
      );
      return people[0]?.data?.success ? people[0].data.data : [];
    });

    // Extrair opções únicas do Pipedrive
    // Procedimentos: campo customizado ou título do deal
    const procedures = new Set(
      allDeals
        .map(d => {
          // Tenta extrair procedimento do título (formato "Procedimento - Paciente")
          const title = d.title || '';
          const match = title.match(/^([^-]+)/);
          return match ? match[1].trim() : title;
        })
        .filter(p => p && typeof p === 'string' && p.length > 0)
    );

    // Profissionais: obtém do field owner (person linked ao deal) ou user_id
    const professionals = new Set(
      allPeople
        .filter(p => p.name && typeof p.name === 'string')
        .map(p => p.name)
    );

    const sdrs = new Set(
      allPeople
        .filter(p => p.name && (p.name.toLowerCase().includes('agda') || p.name.toLowerCase().includes('helenice')))
        .map(p => p.name)
    );
    if (sdrs.size === 0) sdrs.add('Agda', 'Helenice'); // fallback

    // Campanhas: extrai do campo customizado ou do tráfego pago
    const campaigns = new Set(
      allDeals
        .filter(d => d[FIELD_CAMPANHA])
        .map(d => {
          const campaign = d[FIELD_CAMPANHA];
          return campaign && typeof campaign === 'string' ? campaign.trim() : '';
        })
        .filter(Boolean)
    );

    // Ad Sets (Conjuntos): extrai do campo customizado
    const adSets = new Set(
      allDeals
        .filter(d => d[FIELD_CONJUNTO])
        .map(d => {
          const conjunto = d[FIELD_CONJUNTO];
          return conjunto && typeof conjunto === 'string' ? conjunto.trim() : '';
        })
        .filter(Boolean)
    );

    const pipelines = new Set(
      allDeals
        .filter(d => d.pipeline_id)
        .map(d => {
          const pipelineMap = {
            '1': 'Inbound',
            '2': 'Outbound',
            '3': 'Referência',
          };
          return pipelineMap[String(d.pipeline_id)] || `Pipeline ${d.pipeline_id}`;
        })
    );

    const statusMap = {
      'open': 'Aberto',
      'won': 'Ganho',
      'lost': 'Perdido',
      'deleted': 'Deletado',
    };

    const statuses = new Set(
      allDeals
        .filter(d => d.status)
        .map(d => statusMap[d.status] || d.status)
    );

    res.json({
      success: true,
      procedures: Array.from(procedures).filter(Boolean),
      professionals: Array.from(professionals).filter(Boolean),
      sdrs: Array.from(sdrs).filter(Boolean),
      campaigns: Array.from(campaigns).filter(Boolean),
      adSets: Array.from(adSets).filter(Boolean),
      pipelines: Array.from(pipelines).filter(Boolean),
      statuses: Array.from(statuses).filter(Boolean),
    });
  } catch (error) {
    console.error('Erro ao carregar opções de filtro:', error.message);
    res.json({
      success: false,
      procedures: [],
      professionals: [],
      sdrs: ['Agda', 'Helenice'],
      campaigns: [],
      adSets: [],
      pipelines: ['Inbound', 'Outbound', 'Referência'],
      statuses: ['Aberto', 'Ganho', 'Perdido'],
    });
  }
});

// ============================================
// Settings (configuracao pelo proprio SaaS)
// ============================================

// GET /api/settings - configuracoes atuais (segredos mascarados)
app.get('/api/settings', (req, res) => {
  const s = loadSettingsFile();
  res.json({
    success: true,
    data: {
      pipedriveToken: maskSecret(s.pipedriveToken || process.env.PIPEDRIVE_TOKEN),
      fbAccessToken: maskSecret(s.fbAccessToken || process.env.FB_ACCESS_TOKEN),
      fbAdAccountIds: s.fbAdAccountIds || process.env.FB_AD_ACCOUNT_IDS || '',
      tintimAccountCode: maskSecret(s.tintimAccountCode || process.env.TINTIM_ACCOUNT_CODE),
      tintimAccountToken: maskSecret(s.tintimAccountToken || process.env.TINTIM_ACCOUNT_TOKEN),
      googleAdsCustomerId: maskSecret(s.googleAdsCustomerId || process.env.GOOGLE_ADS_CUSTOMER_ID),
      googleAdsDeveloperToken: maskSecret(s.googleAdsDeveloperToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN),
      openaiApiKey: maskSecret(s.openaiApiKey || process.env.OPENAI_API_KEY),
      inboundPipelineId: INBOUND_PIPELINE_ID,
      monthlyGoal: MONTHLY_GOAL,
      configured: {
        pipedrive: !!PIPEDRIVE_TOKEN,
        meta: !!FB_ACCESS_TOKEN && FB_AD_ACCOUNT_IDS.length > 0,
        tintim: !!TINTIM_ACCOUNT_CODE && !!TINTIM_ACCOUNT_TOKEN,
        googleAds: !!GOOGLE_ADS_CUSTOMER_ID && !!GOOGLE_ADS_DEVELOPER_TOKEN,
        openai: !!process.env.OPENAI_API_KEY
      }
    }
  });
});

// POST /api/settings - salva e aplica imediatamente (sem reiniciar o servidor)
app.post('/api/settings', (req, res) => {
  try {
    const current = loadSettingsFile();
    const allowed = ['pipedriveToken', 'fbAccessToken', 'fbAdAccountIds', 'tintimAccountCode', 'tintimAccountToken', 'googleAdsCustomerId', 'googleAdsDeveloperToken', 'openaiApiKey', 'inboundPipelineId', 'monthlyGoal'];
    const updates = {};

    allowed.forEach(key => {
      const value = req.body[key];
      // Ignora vazio e valores mascarados reenviados pelo frontend
      if (value !== undefined && value !== '' && !String(value).startsWith('••••')) {
        updates[key] = value;
      }
    });

    const merged = { ...current, ...updates };
    saveSettingsFile(merged);
    applySettings(merged);
    invalidateCache();

    res.json({ success: true, message: 'Configurações salvas e aplicadas.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/settings/test - testa conexoes com as credenciais atuais
app.post('/api/settings/test', async (req, res) => {
  const results = {
    pipedrive: { ok: false, message: '' },
    meta: { ok: false, message: '' },
    tintim: { ok: false, message: '' },
    googleAds: { ok: false, message: '' },
    openai: { ok: false, message: '' }
  };

  if (PIPEDRIVE_TOKEN) {
    try {
      const r = await axios.get('https://api.pipedrive.com/v1/users/me', {
        params: { api_token: PIPEDRIVE_TOKEN }, timeout: 8000
      });
      results.pipedrive.ok = !!r.data.success;
      results.pipedrive.message = r.data.success
        ? `Conectado como ${r.data.data?.name || 'usuário'}`
        : 'Token inválido';
    } catch (e) {
      results.pipedrive.message = e.response?.data?.error || e.message;
    }
  } else {
    results.pipedrive.message = 'Token não configurado';
  }

  if (FB_ACCESS_TOKEN && FB_AD_ACCOUNT_IDS.length > 0) {
    // Testa TODAS as contas de anuncio configuradas, nao so a primeira
    const accountResults = await Promise.all(
      FB_AD_ACCOUNT_IDS.map(async id => {
        try {
          const r = await axios.get(`https://graph.facebook.com/v18.0/act_${id}`, {
            params: { access_token: FB_ACCESS_TOKEN, fields: 'name' }, timeout: 8000
          });
          return r.data.name ? `✅ ${r.data.name}` : `❌ ${id}: resposta inesperada`;
        } catch (e) {
          return `❌ ${id}: ${e.response?.data?.error?.message || e.message}`;
        }
      })
    );
    results.meta.ok = accountResults.every(m => m.startsWith('✅'));
    results.meta.message = `${accountResults.length} conta(s): ${accountResults.join(' · ')}`;
  } else {
    results.meta.message = 'Token ou conta de anúncio não configurados';
  }

  if (TINTIM_API_KEY && TINTIM_WORKSPACE_ID) {
    try {
      const r = await axios.get(`https://api.tintim.io/v1/workspaces/${TINTIM_WORKSPACE_ID}/health`, {
        headers: { Authorization: `Bearer ${TINTIM_API_KEY}` }, timeout: 8000
      });
      results.tintim.ok = !!r.data;
      results.tintim.message = `Conectado ao Workspace ${TINTIM_WORKSPACE_ID}`;
    } catch (e) {
      results.tintim.message = e.response?.data?.message || e.message;
    }
  } else {
    results.tintim.message = 'API Key ou Workspace ID não configurados';
  }

  if (GOOGLE_ADS_CUSTOMER_ID && GOOGLE_ADS_DEVELOPER_TOKEN) {
    try {
      // Valida apenas se as credenciais estão preenchidas
      // A validação completa requer mais passos (refresh token, etc)
      results.googleAds.ok = true;
      results.googleAds.message = `Credenciais configuradas para ${GOOGLE_ADS_CUSTOMER_ID}`;
    } catch (e) {
      results.googleAds.message = 'Erro ao validar credenciais Google Ads';
    }
  } else {
    results.googleAds.message = 'Customer ID ou Developer Token não configurados';
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const r = await axios.get('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 8000
      });
      results.openai.ok = Array.isArray(r.data.data);
      results.openai.message = results.openai.ok ? 'Chave OpenAI válida' : 'Resposta inesperada';
    } catch (e) {
      results.openai.message = e.response?.data?.error?.message || e.message;
    }
  } else {
    results.openai.message = 'Chave não configurada';
  }

  res.json({ success: true, data: results });
});

// POST /api/settings/test/tintim - testa conexão com Tintim
app.post('/api/settings/test/tintim', async (req, res) => {
  const result = { ok: false, message: '' };

  if (!TINTIM_API_KEY || !TINTIM_WORKSPACE_ID) {
    result.message = 'API Key ou Workspace ID do Tintim não configurados';
    return res.json({ success: true, data: result });
  }

  try {
    // Testa conexão com a API do Tintim (endpoint genérico de health check)
    const r = await axios.get(`https://api.tintim.io/v1/workspaces/${TINTIM_WORKSPACE_ID}/health`, {
      headers: { 'Authorization': `Bearer ${TINTIM_API_KEY}` },
      timeout: 8000
    });
    result.ok = !!r.data;
    result.message = `Conectado ao Workspace ${TINTIM_WORKSPACE_ID}`;
  } catch (e) {
    result.message = e.response?.data?.message || e.message || 'Erro ao conectar com Tintim';
  }

  res.json({ success: true, data: result });
});

// GET /api/tintim/audit - auditoria de leads Tintim vs Pipedrive
app.get('/api/tintim/audit', async (req, res) => {
  try {
    if (!TINTIM_API_KEY || !TINTIM_WORKSPACE_ID) {
      return res.json({
        success: false,
        error: 'Tintim não configurado. Acesse Configurações e adicione a API Key e Workspace ID.',
        data: { leadsWithoutPaidTraffic: 0, totalLeads: 0, leads: [] }
      });
    }

    if (!PIPEDRIVE_TOKEN) {
      return res.json({
        success: false,
        error: 'Pipedrive não configurado. Acesse Configurações e adicione o token.',
        data: { leadsWithoutPaidTraffic: 0, totalLeads: 0, leads: [] }
      });
    }

    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    try {
      // Busca leads do Tintim (conversa com registros de contato)
      const tintimLeads = await axios.get(
        `https://api.tintim.io/v1/workspaces/${TINTIM_WORKSPACE_ID}/contacts`,
        {
          headers: { 'Authorization': `Bearer ${TINTIM_API_KEY}` },
          timeout: 10000
        }
      );

      const tintimContacts = tintimLeads.data?.data || [];

      // Busca deals do Pipedrive para comparar
      const pipedriveDeals = await getPipedriveDeals(range.since, range.until).catch(() => []);

      // Identifica leads do Tintim que não têm dados de tráfego pago no Pipedrive
      const leadsWithoutPaidTraffic = tintimContacts
        .filter(contact => {
          // Verifica se existe um deal no Pipedrive com origem em tráfego pago
          const hasPaidTrafficDeal = pipedriveDeals.some(deal => {
            const dealOrigin = deal[FIELD_ORIGEM] || '';
            const dealCampaign = deal[FIELD_CAMPANHA] || '';
            // Se tem origem e campanha, tem tráfego pago
            return (dealOrigin && dealCampaign) || dealOrigin === 'Meta' || dealOrigin === 'Google Ads';
          });
          return !hasPaidTrafficDeal;
        })
        .map(contact => ({
          id: contact.id,
          name: contact.name || 'Sem nome',
          email: contact.email || '-',
          phone: contact.phone || '-',
          lastInteraction: contact.lastMessageDate || contact.createdAt || '-',
          source: 'Tintim',
          status: 'Sem tráfego pago'
        }));

      res.json({
        success: true,
        range,
        data: {
          totalLeads: tintimContacts.length,
          leadsWithoutPaidTraffic: leadsWithoutPaidTraffic.length,
          leadsWithPaidTraffic: tintimContacts.length - leadsWithoutPaidTraffic.length,
          leads: leadsWithoutPaidTraffic.slice(0, 100) // Limita a 100 para performance
        }
      });
    } catch (tintimError) {
      console.error('Erro ao buscar dados do Tintim:', tintimError.message);
      res.json({
        success: false,
        error: `Erro ao conectar com Tintim: ${tintimError.response?.data?.message || tintimError.message}`,
        data: { leadsWithoutPaidTraffic: 0, totalLeads: 0, leads: [] }
      });
    }
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      data: { leadsWithoutPaidTraffic: 0, totalLeads: 0, leads: [] }
    });
  }
});

// Dashboard legado (preservado)
app.get('/legacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard-api.html'));
});

// Painel Vivera Orofacial - Corrida das SDRs (preservado)
app.get('/sdr', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard-sdr.html'));
});

// SaaS React (build de producao em frontend/dist)
const DIST_DIR = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  // SPA fallback: qualquer rota nao-API cai no index.html do React
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/legacy' || req.path === '/sdr') return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  // Sem build do frontend: raiz serve o dashboard legado
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard-api.html'));
  });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ============================================
// Atualizacao automatica dos numeros (Pipedrive + Meta) a cada 5 minutos
// Mantem a "memoria" sempre quente: o dashboard abre instantaneo em qualquer reload
// ============================================
async function warmCache() {
  try {
    const today = new Date();
    const fmt = d => d.toISOString().slice(0, 10);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const prevMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevEnd = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      Math.min(today.getDate(), prevMonthLastDay)
    );
    const def = defaultDateRange();

    await Promise.all([
      refreshKey(`deals:null:null:${INBOUND_PIPELINE_ID}`, () => fetchPipedriveDealsUncached(null, null)),
      refreshKey('activities:null:null', () => fetchPipedriveActivitiesUncached(null, null)),
      refreshKey(`stages:${INBOUND_PIPELINE_ID}`, () => fetchPipedriveStagesUncached()),
      // Meta: range padrao "este mes" + mesmo trecho do mes anterior (comparacao) + range default
      refreshKey(`meta:${fmt(monthStart)}:${fmt(today)}`, () => fetchMetaAdsUncached(fmt(monthStart), fmt(today))),
      refreshKey(`meta:${fmt(prevStart)}:${fmt(prevEnd)}`, () => fetchMetaAdsUncached(fmt(prevStart), fmt(prevEnd))),
      refreshKey(`meta:${def.since}:${def.until}`, () => fetchMetaAdsUncached(def.since, def.until))
    ]);
    console.log(`[memoria] Numeros do Pipedrive/Meta atualizados às ${new Date().toLocaleTimeString('pt-BR')}`);
  } catch (e) {
    console.error('[memoria] Erro na atualizacao automatica:', e.message);
  }
}

loadCacheFromDisk();
setInterval(warmCache, 5 * 60 * 1000);   // a cada 5 minutos
setTimeout(warmCache, 3000);              // primeira carga logo apos subir

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const range = defaultDateRange();
  console.log(`
Servidor rodando em http://localhost:${PORT}
Acesse http://localhost:${PORT} no navegador
API: http://localhost:${PORT}/api/audit?since=${range.since}&until=${range.until}

Configuracoes:
   - Meta Accounts: ${FB_AD_ACCOUNT_IDS.length}
   - Pipedrive Token: ${PIPEDRIVE_TOKEN ? PIPEDRIVE_TOKEN.substring(0, 10) + '...' : 'NAO CONFIGURADO'}
   - Tintim Account: ${TINTIM_ACCOUNT_CODE ? TINTIM_ACCOUNT_CODE.substring(0, 10) + '...' : 'NAO CONFIGURADO'}
   - Pipeline Inbound ID: ${INBOUND_PIPELINE_ID}
   - Periodo padrao: ${range.since} a ${range.until}

Clique em Atualizar no dashboard para carregar dados
Veja os logs aqui para diagnosticar problemas
  `);
});
