require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

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

// Servir o dashboard HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard-api.html'));
});

// Painel Vivera Orofacial - Corrida das SDRs
app.get('/sdr', (req, res) => {
  const sdrPath = path.join(__dirname, 'dashboard-sdr.html');
  if (fs.existsSync(sdrPath)) {
    let html = fs.readFileSync(sdrPath, 'utf-8');
    // Injetar o token como variável window
    html = html.replace(
      'const API_TOKEN = window.PIPEDRIVE_API_TOKEN || \'\';',
      `const API_TOKEN = '${PIPEDRIVE_TOKEN}';`
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } else {
    res.status(404).send('Dashboard não encontrado');
  }
});

// Dashboard de WhatsApp Analytics
app.get('/dashboard/whatsapp', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard-whatsapp.html'));
});

// API: WhatsApp Stats (KPIs básicos)
app.get('/api/whatsapp/stats', async (req, res) => {
  try {
    // TODO: Buscar dados do banco MySQL do monitor de WhatsApp
    // Por enquanto, retorna dados mock para testes
    res.json({
      total_calls: 245,
      answered_calls: 156,
      answer_rate: 63.7,
      avg_duration: 287,
      period: req.query.range || '30days'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: WhatsApp Calls (Últimas chamadas)
app.get('/api/whatsapp/calls', async (req, res) => {
  try {
    // TODO: Buscar dados do banco MySQL do monitor de WhatsApp
    res.json([
      {
        id: 1,
        client_name: 'João Silva',
        phone_number: '48991234567',
        timestamp: new Date().toISOString(),
        duration: 342,
        sdr_name: 'helenice',
        status: 'completed'
      },
      {
        id: 2,
        client_name: 'Maria Santos',
        phone_number: '48991234568',
        timestamp: new Date(Date.now() - 900000).toISOString(),
        duration: 495,
        sdr_name: 'agda',
        status: 'completed'
      }
    ]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Lead Timing (Tempo até primeira mensagem/ligação)
app.get('/api/whatsapp/lead-timing', async (req, res) => {
  try {
    // TODO: Buscar dados do banco MySQL
    res.json({
      message_timing: {
        average: 8.4,
        median: 5,
        p95: 45,
        distribution: [
          { label: '0-5 min', count: 120 },
          { label: '5-15 min', count: 180 },
          { label: '15-60 min', count: 140 },
          { label: '>60 min', count: 60 }
        ]
      },
      call_timing: {
        average: 18.7,
        median: 12,
        p95: 120,
        distribution: [
          { label: '0-15 min', count: 85 },
          { label: '15-30 min', count: 120 },
          { label: '30-60 min', count: 95 },
          { label: '>60 min', count: 80 }
        ]
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Patterns (Padrões e análise)
app.get('/api/whatsapp/patterns', async (req, res) => {
  try {
    // TODO: Buscar dados do banco MySQL
    res.json({
      hourly_patterns: [
        { hour: 9, rate: 71.2, attempts: 32 },
        { hour: 10, rate: 68.1, attempts: 28 },
        { hour: 11, rate: 65.5, attempts: 25 },
        { hour: 12, rate: 62.0, attempts: 20 },
        { hour: 13, rate: 58.3, attempts: 24 },
        { hour: 14, rate: 72.3, attempts: 35 },
        { hour: 15, rate: 75.5, attempts: 40 },
        { hour: 16, rate: 73.2, attempts: 38 },
        { hour: 17, rate: 70.1, attempts: 32 },
        { hour: 18, rate: 65.0, attempts: 28 }
      ],
      message_previa_impact: {
        with_message_rate: 72.5,
        with_message_count: 120,
        without_message_rate: 51.2,
        without_message_count: 125
      },
      insights: [
        'Saudação é 2x mais efetiva que Follow-up',
        'Melhor horário: 14h-17h (72.3% de atendimento)',
        'Mensagem prévia melhora 21.3% de atendimento'
      ]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Message Types (Efetividade por tipo)
app.get('/api/whatsapp/message-types', async (req, res) => {
  try {
    // TODO: Buscar dados do banco MySQL
    res.json({
      types: [
        {
          type: 'Saudação',
          sent: 245,
          responses: 198,
          response_rate: 80.8,
          avg_response_time: 0.5
        },
        {
          type: 'Proposta',
          sent: 156,
          responses: 89,
          response_rate: 57.1,
          avg_response_time: 2.3
        },
        {
          type: 'Follow-up',
          sent: 203,
          responses: 76,
          response_rate: 37.4,
          avg_response_time: 4.1
        }
      ]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Script Compliance (Análise de aderência ao script via N8N)
app.get('/api/whatsapp/script-compliance', async (req, res) => {
  try {
    // TODO: Integrar com N8N para análise de script
    res.json({
      daily_compliance: 82.5,
      by_sdr: [
        { sdr: 'helenice', compliance: 85.2, conversations: 42 },
        { sdr: 'agda', compliance: 79.8, conversations: 38 }
      ],
      compliance_trend: [
        { date: '2026-07-06', rate: 75.2 },
        { date: '2026-07-07', rate: 78.5 },
        { date: '2026-07-08', rate: 80.1 },
        { date: '2026-07-09', rate: 81.3 },
        { date: '2026-07-10', rate: 82.5 }
      ],
      issues: [
        { type: 'missing_greeting', count: 5, severity: 'high' },
        { type: 'skipped_qualification', count: 8, severity: 'medium' },
        { type: 'rushed_closing', count: 3, severity: 'low' }
      ]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
