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
  if (s.anthropicApiKey) process.env.ANTHROPIC_API_KEY = s.anthropicApiKey;
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
// Cache em memoria para chamadas externas (Meta/Pipedrive)
// Evita refazer as mesmas chamadas a cada carregamento de tela
// ============================================
const CACHE_TTL_MS = 60 * 1000; // 60s
const _cache = new Map();

async function cached(key, fn) {
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.value;
  }
  const value = await fn();
  _cache.set(key, { at: Date.now(), value });
  // Limpeza simples para nao crescer indefinidamente
  if (_cache.size > 200) {
    const oldest = [..._cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) _cache.delete(oldest[0]);
  }
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
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const todayStr = new Date().toISOString().slice(0, 10);
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().slice(0, 10);

    const [ads, allDeals, allActivities] = await Promise.all([
      getMetaAds(range.since, range.until),
      getPipedriveDeals(null, null),      // todos os deals; filtramos por won_time abaixo
      getPipedriveActivities(null, null)  // todas as atividades; filtramos por tipo/data abaixo
    ]);

    // Agregações básicas
    const totalSpend = ads.reduce((sum, ad) => sum + ad.spend, 0);
    const totalLeads = ads.reduce((sum, ad) => sum + ad.leads, 0);

    // Receita = orcamentos FECHADOS (won) no periodo, pela data de fechamento (won_time)
    const wonInPeriod = allDeals.filter(d => {
      if (d.status !== 'won') return false;
      const wonDate = (d.wonTime || d.stageChangeTime || d.addDate || '').slice(0, 10);
      return wonDate >= range.since && wonDate <= range.until;
    });
    const totalRevenue = wonInPeriod.reduce((sum, d) => sum + (d.rawValue || 0), 0);
    const totalDealsWon = wonInPeriod.length;

    // Agenda real: atividades CONCLUIDAS por tipo (padrao Pipedrive da Vivera)
    // - "Agendamento Realizado" concluida = agendamento feito no dia
    // - "Compareceu" concluida = paciente compareceu
    // - "Faltou - Reagendar" concluida = falta (no-show)
    const scheduledToday = allActivities.filter(
      a => a.type === ACTIVITY_TYPE_SCHEDULED && a.done && a.dueDate === todayStr
    );
    const scheduledTomorrow = allActivities.filter(
      a => a.type === ACTIVITY_TYPE_SCHEDULED && a.dueDate === tomorrowStr
    );
    const attendedInPeriod = allActivities.filter(
      a => a.type === ACTIVITY_TYPE_ATTENDED && a.done &&
        a.dueDate >= range.since && a.dueDate <= range.until
    );
    const missedInPeriod = allActivities.filter(
      a => a.type === ACTIVITY_TYPE_MISSED && a.done &&
        a.dueDate >= range.since && a.dueDate <= range.until
    );
    const attendanceTotal = attendedInPeriod.length + missedInPeriod.length;
    const attendanceRate = attendanceTotal > 0
      ? (attendedInPeriod.length / attendanceTotal) * 100
      : 0;

    // KPIs calculados
    const kpis = {
      revenue: {
        value: totalRevenue,
        change: 12.5, // TODO: calcular vs período anterior
        sub: 'vs. mês anterior'
      },
      goal: {
        // META: usa valor configurado na tela de Configuracoes; fallback receita+15%
        value: MONTHLY_GOAL > 0 ? MONTHLY_GOAL : totalRevenue * 1.15,
        change: null
      },
      goalPct: {
        value: MONTHLY_GOAL > 0
          ? ((totalRevenue / MONTHLY_GOAL) * 100).toFixed(1)
          : ((totalRevenue / (totalRevenue * 1.15 || 1)) * 100).toFixed(1),
        change: null
      },
      forecast: {
        value: totalRevenue * 1.20, // FORECAST = receita + 20%
        change: 5.8
      },
      profit: {
        value: totalRevenue * 0.35, // LUCRO = 35% da receita (ajustar conforme margem real)
        change: 8.3
      },
      margin: {
        value: 37.2, // Margem percentual
        change: 2.1
      },
      roi: {
        value: totalSpend > 0 ? ((totalRevenue / totalSpend) * 100).toFixed(0) : 0,
        change: 18.5
      },
      roas: {
        value: totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : 0,
        change: 12.3
      },
      cac: {
        value: totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : 0,
        change: -5.2
      },
      avgTicket: {
        value: totalDealsWon > 0 ? (totalRevenue / totalDealsWon).toFixed(2) : 0,
        change: 6.8
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
        value: parseFloat(attendanceRate.toFixed(1)),
        change: null
      },
      noShow: {
        value: missedInPeriod.length,
        change: null
      },
      leads: {
        value: totalLeads,
        change: 15.2
      },
      qualified: {
        value: Math.floor(totalLeads * 0.48), // ~48% são qualificados
        change: 11.8
      },
      sales: {
        value: totalDealsWon,
        change: 9.4
      }
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
        cpm: investment > 0 ? ((investment / (totalImpressions || 100000)) * 1000).toFixed(2) : 0, // TODO: real data
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
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const deals = await getPipedriveDeals(range.since, range.until);

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
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/commercial/conversions - Performance por profissional/SDR
app.get('/api/dashboard/commercial/conversions', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const deals = await getPipedriveDeals(range.since, range.until);

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
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/commercial/reasons - Top 5 motivos de perda
app.get('/api/dashboard/commercial/reasons', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const deals = await getPipedriveDeals(range.since, range.until);

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
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/crm/kpis - KPIs do CRM (pipeline aberto, valor, perdidos, recuperaveis)
app.get('/api/dashboard/crm/kpis', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const deals = await getPipedriveDeals(range.since, range.until);

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
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/crm/pipeline - Kanban: deals agrupados por etapa + gargalos
app.get('/api/dashboard/crm/pipeline', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [deals, stages] = await Promise.all([
      getPipedriveDeals(range.since, range.until),
      getPipedriveStages()
    ]);

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
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/crm/recovery - Oportunidades perdidas recuperaveis
app.get('/api/dashboard/crm/recovery', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const deals = await getPipedriveDeals(range.since, range.until);

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
    res.status(500).json({ success: false, error: error.message });
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
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    const [ads, deals] = await Promise.all([
      getMetaAds(range.since, range.until),
      getPipedriveDeals(range.since, range.until)
    ]);

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
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/financial/monthly - Receita vs investimento vs lucro por mes
app.get('/api/dashboard/financial/monthly', async (req, res) => {
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
    res.status(500).json({ success: false, error: error.message });
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

// GET /api/dashboard/ai/narrative - Resumo executivo em linguagem natural via Claude
// Requer ANTHROPIC_API_KEY no .env; sem a chave retorna available: false
app.get('/api/dashboard/ai/narrative', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = {
      since: req.query.since || defaults.since,
      until: req.query.until || defaults.until
    };

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({
        success: true,
        range,
        data: {
          available: false,
          narrative: null,
          reason: 'ANTHROPIC_API_KEY não configurada'
        }
      });
    }

    const [ads, deals, stages] = await Promise.all([
      getMetaAds(range.since, range.until),
      getPipedriveDeals(range.since, range.until),
      getPipedriveStages()
    ]);

    const insights = generateInsights({ ads, deals, stages });

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic();

    const totalSpend = ads.reduce((sum, ad) => sum + ad.spend, 0);
    const totalRevenue = deals.filter(d => d.status === 'won').reduce((sum, d) => sum + d.value, 0);

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: 'Você é um analista de BI da clínica Vivera. Escreva um resumo executivo curto (3-5 frases) em português brasileiro, direto e acionável, baseado APENAS nos dados fornecidos. Não invente números.',
      messages: [{
        role: 'user',
        content: `Período: ${range.since} a ${range.until}\nInvestimento em ads: R$ ${totalSpend.toFixed(2)}\nReceita: R$ ${totalRevenue.toFixed(2)}\nLeads: ${deals.length}\nVendas: ${deals.filter(d => d.status === 'won').length}\n\nInsights detectados:\n${insights.map(i => `- ${i.title}: ${i.description}`).join('\n')}\n\nEscreva o resumo executivo.`
      }]
    });

    const textBlock = response.content.find(b => b.type === 'text');

    res.json({
      success: true,
      range,
      data: {
        available: true,
        narrative: textBlock ? textBlock.text : null,
        model: response.model
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
      anthropicApiKey: maskSecret(s.anthropicApiKey || process.env.ANTHROPIC_API_KEY),
      inboundPipelineId: INBOUND_PIPELINE_ID,
      monthlyGoal: MONTHLY_GOAL,
      configured: {
        pipedrive: !!PIPEDRIVE_TOKEN,
        meta: !!FB_ACCESS_TOKEN && FB_AD_ACCOUNT_IDS.length > 0,
        anthropic: !!process.env.ANTHROPIC_API_KEY
      }
    }
  });
});

// POST /api/settings - salva e aplica imediatamente (sem reiniciar o servidor)
app.post('/api/settings', (req, res) => {
  try {
    const current = loadSettingsFile();
    const allowed = ['pipedriveToken', 'fbAccessToken', 'fbAdAccountIds', 'anthropicApiKey', 'inboundPipelineId', 'monthlyGoal'];
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
  const results = { pipedrive: { ok: false, message: '' }, meta: { ok: false, message: '' } };

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
    try {
      const r = await axios.get(`https://graph.facebook.com/v18.0/act_${FB_AD_ACCOUNT_IDS[0]}`, {
        params: { access_token: FB_ACCESS_TOKEN, fields: 'name' }, timeout: 8000
      });
      results.meta.ok = !!r.data.name;
      results.meta.message = r.data.name ? `Conta: ${r.data.name}` : 'Resposta inesperada';
    } catch (e) {
      results.meta.message = e.response?.data?.error?.message || e.message;
    }
  } else {
    results.meta.message = 'Token ou conta de anúncio não configurados';
  }

  res.json({ success: true, data: results });
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
   - Pipeline Inbound ID: ${INBOUND_PIPELINE_ID}
   - Periodo padrao: ${range.since} a ${range.until}

Clique em Atualizar no dashboard para carregar dados
Veja os logs aqui para diagnosticar problemas
  `);
});
