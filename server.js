require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Credenciais (carregadas do .env, nao ficam hardcoded no codigo)
const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_TOKEN;
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const FB_AD_ACCOUNT_IDS = (process.env.FB_AD_ACCOUNT_IDS || '')
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
  const fields = `id,name,status,effective_status,campaign_id,campaign{name},adset_id,adset{name},insights.time_range(${timeRangeParam}){spend,actions}`;

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

    const [ads, deals] = await Promise.all([
      getMetaAds(range.since, range.until),
      getPipedriveDeals(range.since, range.until)
    ]);

    // Agregações básicas
    const totalSpend = ads.reduce((sum, ad) => sum + ad.spend, 0);
    const totalLeads = ads.reduce((sum, ad) => sum + ad.leads, 0);
    const totalRevenue = deals.reduce((sum, deal) => sum + deal.value, 0);
    const totalDealsWon = deals.filter(d => d.status === 'won').length;

    // KPIs calculados
    const kpis = {
      revenue: {
        value: totalRevenue,
        change: 12.5, // TODO: calcular vs período anterior
        sub: 'vs. mês anterior'
      },
      goal: {
        value: totalRevenue * 1.15, // META = receita + 15% (ajustar conforme necessário)
        change: null
      },
      goalPct: {
        value: ((totalRevenue / (totalRevenue * 1.15)) * 100).toFixed(1),
        change: 3.2
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
        value: 42, // TODO: buscar da agenda real
        sub: 'agendadas'
      },
      appointmentsTomorrow: {
        value: 38, // TODO: buscar da agenda real
        sub: 'agendadas'
      },
      attendance: {
        value: 91.2, // TODO: calcular de dados reais
        change: 2.3
      },
      noShow: {
        value: 4, // TODO: calcular de dados reais
        change: 0.5
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
    // TODO: Integrar com sistema de agenda real (se existir)
    // Por enquanto retorna dados mock estruturados
    res.json({
      success: true,
      data: {
        today: { scheduled: 42, attended: 38, noShow: 4 },
        tomorrow: { scheduled: 38, attended: 0, noShow: 0 }
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

// Servir o dashboard HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard-api.html'));
});

// Painel Vivera Orofacial - Corrida das SDRs
app.get('/sdr', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard-sdr.html'));
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
