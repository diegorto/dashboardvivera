require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Credenciais: em producao vem de config.json (incluido so no deploy,
// nunca commitado no git); em dev local vem do .env
let deployConfig = {};
try { deployConfig = require('./config.json'); } catch (e) { /* nao existe em dev local, tudo bem */ }

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_TOKEN || deployConfig.PIPEDRIVE_TOKEN;
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN || deployConfig.FB_ACCESS_TOKEN;
const FB_AD_ACCOUNT_IDS = (process.env.FB_AD_ACCOUNT_IDS || deployConfig.FB_AD_ACCOUNT_IDS || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);
const TINTIM_ACCOUNT_CODE = process.env.TINTIM_ACCOUNT_CODE || deployConfig.TINTIM_ACCOUNT_CODE;
const TINTIM_ACCOUNT_TOKEN = process.env.TINTIM_ACCOUNT_TOKEN || deployConfig.TINTIM_ACCOUNT_TOKEN;

// IDs reais dos campos customizados no Deal do Pipedrive (confirmados via API)
const FIELD_CAMPANHA = 'b70cf4c34cd06cb3917b79f3ebe1e64d28666f4b';
const FIELD_CONJUNTO = '182132e7acfbec43315140ab18362f0e16ada0c4';
const FIELD_PALAVRA_CHAVE = 'c9ee045e6537eb296d268102e99829b0dbda1b5b'; // = "criativo"
const FIELD_PLATAFORMA = '0051c071b9be4c9103f8a91ef538dcc3d43e6e9a';
const FIELD_ORIGEM = 'fd9cfb07956d6227f9e50b9be8b20ab176d17ce7';
const FIELD_PROCEDIMENTO = 'f7a27fd84e08c5d880f1534646eb07307eb20944';
const FIELD_TELEFONE = '82a1694b1017b48cf7ed15e0085843b4f3f97d5d';

// Dominio da conta Pipedrive (confirmado via /users/me), usado pra montar links diretos
// pro deal - ex: https://viveraorofacialavanada.pipedrive.com/deal/1234
const PIPEDRIVE_COMPANY_DOMAIN = 'viveraorofacialavanada';
function pipedriveDealUrl(dealId) {
  return `https://${PIPEDRIVE_COMPANY_DOMAIN}.pipedrive.com/deal/${dealId}`;
}

// Pipeline "Inbound" = id 1 (onde entram os leads de trafego pago)
const INBOUND_PIPELINE_ID = 1;
// Pipeline "Recepção" = id 2 (fechamentos feitos pela recepção/clinica, sem atribuicao de
// marketing - pacientes que ja conhecem a clinica, indicacao, retorno etc.)
const RECEPCAO_PIPELINE_ID = 2;

// Etiquetas (label) que identificam a medica responsavel (Closer) - confirmado via API
const DOCTOR_LABELS = { '65': 'Dra Kissya', '67': 'Dra Jéssica', '98': 'Dr. Diego' };

// Etiquetas (label) que indicam motivo de perda/objecao - confirmado via API (dealFields).
const OBJECTION_LABELS = {
  '80': 'Não Responde', '94': 'Nunca Respondeu', '106': 'Não qualificado',
  '107': 'Objeção financeira', '108': 'Objeção de distância', '109': 'Parou de responder (valor consulta)',
  '112': 'Desqualificada', '115': 'Não tem interesse no momento'
};

// Opcoes do campo "Procedimento" (set) - confirmado via API
const PROCEDIMENTO_OPTIONS = {
  '37': 'Método Evolution', '38': 'Toxina botulínica', '39': 'Ácido Hialurônico',
  '40': 'Bioestimuladores de colágeno', '41': 'Fios APTOS', '42': 'Ultraformer MPT',
  '43': 'Exojet', '44': 'Protocolo Evolution Full Face',
  '45': 'Implantes Dentários Sem Cortes (Cirurgia Guiada)',
  '46': 'Lentes de Contato Dental Biomiméticas', '47': 'Invisalign - Alinhadores Transparentes',
  '68': 'Não identificado'
};

// Ordem das etapas do funil no Pipedrive (stage_id -> posicao). Deals "ganhos" (won)
// sao tratados como tendo alcancado no minimo a etapa de Comparecimento (rank 4),
// mesmo que o stage_id atual nao reflita isso.
const STAGE_RANK = {
  1: 0,                          // Entrada
  2: 1, 25: 1, 20: 1, 21: 1, 22: 1, 23: 1, 24: 1, // Contato Realizado + D+1..D+5
  3: 2,                          // Qualificado
  4: 3, 13: 3,                   // Agendamento Realizado / Nao Compareceu-reagendar
  5: 4, 6: 4, 7: 4                // Comparecimento + Follow Up 1/2
};

const FUNNEL_STAGES = [
  { key: 'leads', label: 'Leads', rank: 0 },
  { key: 'qualificados', label: 'Qualificados', rank: 2 },
  { key: 'agendados', label: 'Agendados', rank: 3 },
  { key: 'compareceram', label: 'Compareceram', rank: 4 },
  { key: 'compraram', label: 'Compraram', rank: 5 } // tratado a parte (status === won)
];

// Nomes reais das etapas no Pipedrive (stage_id -> nome), confirmado via API.
const STAGE_NAMES = {
  1: 'Entrada', 2: 'Contato Realizado', 25: 'Dia seguinte',
  20: 'D+1', 21: 'D+2', 22: 'D+3', 23: 'D+4', 24: 'D+5',
  3: 'Qualificado', 4: 'Agendamento Realizado', 13: 'Não Compareceu - reagendar',
  5: 'Comparecimento', 6: 'Follow Up 1', 7: 'Follow Up 2'
};

function stageName(deal) {
  return STAGE_NAMES[deal.stageId] || (deal.status === 'won' ? 'Ganho' : `Etapa ${deal.stageId}`);
}

function fmtDate(d) { return d.toISOString().slice(0, 10); }

function defaultDateRange() {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  return { since: fmtDate(since), until: fmtDate(until) };
}

// Janela fixa dos ultimos N meses a partir de hoje - usada em coisas como "Oportunidades
// Paradas" que devem ficar sempre visiveis, independente de qual periodo o usuario tem
// selecionado no filtro geral do dashboard.
function lastNMonthsRange(n) {
  const until = new Date();
  const since = new Date();
  since.setMonth(since.getMonth() - n);
  return { since: fmtDate(since), until: fmtDate(until) };
}

// Periodo anterior de mesma duracao, imediatamente anterior a "since".
function previousRange(since, until) {
  const s = new Date(since + 'T00:00:00');
  const u = new Date(until + 'T00:00:00');
  const days = Math.max(1, Math.round((u - s) / 86400000) + 1);
  const prevUntil = new Date(s);
  prevUntil.setDate(prevUntil.getDate() - 1);
  const prevSince = new Date(prevUntil);
  prevSince.setDate(prevSince.getDate() - (days - 1));
  return { since: fmtDate(prevSince), until: fmtDate(prevUntil) };
}

function joinKey(campanha, conjunto, anuncio) {
  return `${campanha}|||${conjunto}|||${anuncio}`;
}

function deltaPct(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function rankOf(deal) {
  const r = STAGE_RANK[deal.stageId];
  return r === undefined ? 0 : r;
}

function closerNames(deal) {
  const ids = (deal.labelRaw || '').split(',').filter(Boolean);
  return ids.map(id => DOCTOR_LABELS[id]).filter(Boolean);
}

function procedimentoNames(deal) {
  const ids = (deal.procedimentoRaw || '').split(',').filter(Boolean);
  return ids.map(id => PROCEDIMENTO_OPTIONS[id]).filter(Boolean);
}

function objectionNames(deal) {
  const ids = (deal.labelRaw || '').split(',').filter(Boolean);
  return ids.map(id => OBJECTION_LABELS[id]).filter(Boolean);
}

// Busca ads (nivel anuncio individual) da Meta, com spend/leads/impressoes/cliques no periodo.
async function getMetaAds(since, until) {
  const ads = [];
  const timeRangeParam = JSON.stringify({ since, until });
  const fields = `id,name,status,effective_status,campaign_id,campaign{name},adset_id,adset{name},preview_shareable_link,` +
    `creative{thumbnail_url,object_story_spec},insights.time_range(${timeRangeParam}){spend,actions,impressions,clicks}`;

  for (const accountId of FB_AD_ACCOUNT_IDS) {
    let url = `https://graph.facebook.com/v18.0/act_${accountId}/ads`;
    let params = { access_token: FB_ACCESS_TOKEN, fields, limit: 200 };
    let page = 0;
    const MAX_PAGES = 10;

    try {
      while (url && page < MAX_PAGES) {
        const response = await axios.get(url, { params });
        const data = response.data.data || [];

        data.forEach(ad => {
          const insight = ad.insights && ad.insights.data && ad.insights.data[0];
          if (!insight) return;
          const spend = parseFloat(insight.spend || 0);
          if (spend <= 0) return;

          let leads = 0;
          let mensagens = 0;
          if (insight.actions) {
            insight.actions.forEach(a => {
              if (a.action_type === 'lead') leads += parseInt(a.value) || 0;
              // "Conversas por mensagem iniciadas" (anuncios Clique-para-WhatsApp/Messenger).
              // O nome da action varia por janela de atribuicao (_1d/_7d/_28d); pega o maior valor
              // encontrado entre as variantes, ja que representam o mesmo evento, nao somam.
              if (a.action_type && a.action_type.startsWith('onsite_conversion.messaging_conversation_started')) {
                mensagens = Math.max(mensagens, parseInt(a.value) || 0);
              }
            });
          }

          const impressions = parseInt(insight.impressions || 0);
          const clicks = parseInt(insight.clicks || 0);

          ads.push({
            accountId,
            campaignId: ad.campaign_id,
            campaignName: ad.campaign ? ad.campaign.name : '(sem campanha)',
            adsetId: ad.adset_id,
            adsetName: ad.adset ? ad.adset.name : '(sem conjunto)',
            adId: ad.id,
            adName: ad.name,
            status: ad.effective_status || ad.status,
            spend, leads, mensagens, impressions, clicks,
            thumbnailUrl: ad.creative ? ad.creative.thumbnail_url : null,
            // preview_shareable_link e um campo direto do Ad (nao um edge separado - essa era
            // a confusao da tentativa anterior). Abre a previa real sem exigir login. Cai pro
            // deep link do Ads Manager quando a Meta nao devolve (ex: anuncio muito antigo).
            adUrl: ad.preview_shareable_link || `https://www.facebook.com/adsmanager/manage/ads?act=${accountId}&selected_ad_ids=${ad.id}`
          });
        });

        if (response.data.paging && response.data.paging.next) {
          url = response.data.paging.next;
          params = undefined;
        } else {
          url = null;
        }
        page++;
      }
    } catch (error) {
      console.error(`Erro ao buscar ads da conta ${accountId}:`, JSON.stringify(error.response?.data?.error || error.message));
    }
  }

  return ads;
}

// Telefone do Pipedrive -> formato que o Tintim espera (DDI+DDD+numero, so digitos).
// Numeros brasileiros de 10-11 digitos (sem DDI) recebem o prefixo 55.
function normalizePhoneForTintim(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return '55' + digits;
  return digits;
}

// Busca um lead no Tintim pelo telefone. Retorna null se nao encontrado/erro/nao configurado.
async function fetchTintimLead(phoneRaw) {
  const phone = normalizePhoneForTintim(phoneRaw);
  if (!phone || !TINTIM_ACCOUNT_CODE || !TINTIM_ACCOUNT_TOKEN) return null;
  try {
    const url = `https://s.tintim.app/api/v1/${TINTIM_ACCOUNT_CODE}/lead/${phone}`;
    const response = await axios.get(url, { params: { token: TINTIM_ACCOUNT_TOKEN }, timeout: 10000 });
    return response.data || null;
  } catch (error) {
    if (error.response && error.response.status === 404) return null;
    console.error(`Erro ao buscar lead ${phone} no Tintim:`, error.response?.data || error.message);
    return null;
  }
}

// Busca varios telefones no Tintim em paralelo limitado (evita sobrecarregar a API deles
// nem travar a requisicao por muito tempo quando ha muitos leads sem origem).
async function fetchTintimLeadsBatch(phones, concurrency = 5) {
  const results = new Map();
  let index = 0;
  async function worker() {
    while (index < phones.length) {
      const i = index++;
      const phone = phones[i];
      results.set(phone, await fetchTintimLead(phone));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, phones.length) }, worker));
  return results;
}

// Tenta inferir a Origem (Instagram/Facebook) a partir da convencao de nomenclatura
// da propria conta ("[IG]"/"[FB]" no nome da campanha/conjunto) - o Tintim nao expoe
// essa informacao diretamente. E so uma sugestao, sempre exibida antes de confirmar.
function inferOrigemFromNaming(...strings) {
  const joined = strings.filter(Boolean).join(' ').toLowerCase();
  if (joined.includes('[ig]') || joined.includes('instagram')) return 'Instagram';
  if (joined.includes('[fb]') || joined.includes('facebook')) return 'Facebook';
  return null;
}

// Converte o objeto retornado pelo Tintim numa sugestao de preenchimento pros campos
// do Pipedrive (Campanha/Conjunto/Palavra-chave/Plataforma batem 1:1 com o payload do
// Tintim, confirmado com dado real; Origem e so uma sugestao heuristica).
function tintimToSuggestion(tintimLead) {
  if (!tintimLead) return { found: false };
  const ad = tintimLead.ad || {};
  const hasAdData = !!(ad.campaign_name || ad.adset_name || ad.ad_name);
  if (!hasAdData) return { found: true, hasAdData: false, source: tintimLead.source || null };
  return {
    found: true,
    hasAdData: true,
    plataforma: tintimLead.source || null,
    campanha: ad.campaign_name || null,
    conjunto: ad.adset_name || null,
    palavraChave: ad.ad_name || null,
    origemSugerida: inferOrigemFromNaming(ad.campaign_name, ad.adset_name),
    adAccountName: ad.ad_account_name || null,
    statusName: (tintimLead.status && tintimLead.status.name) || null
  };
}

// Todos os deals de TODOS os pipelines, SEM filtro de data (usado como base; filtros de
// periodo/pipeline sao aplicados em memoria depois). Uma unica passada pela API do Pipedrive,
// reaproveitada tanto pro pipeline Inbound (marketing) quanto pro Recepcao (fechamentos locais).
async function fetchAllDeals() {
  const deals = [];
  let start = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await axios.get('https://api.pipedrive.com/v1/deals', {
        params: { api_token: PIPEDRIVE_TOKEN, limit: 500, start }
      });

      if (response.data.success && response.data.data) {
        response.data.data.forEach(deal => {
          let email = '';
          let personPhone = '';
          if (deal.person_id && typeof deal.person_id === 'object') {
            if (Array.isArray(deal.person_id.email)) {
              const primaryEmail = deal.person_id.email.find(e => e.primary) || deal.person_id.email[0];
              email = primaryEmail ? primaryEmail.value : '';
            }
            if (Array.isArray(deal.person_id.phone)) {
              const primaryPhone = deal.person_id.phone.find(p => p.primary) || deal.person_id.phone[0];
              personPhone = primaryPhone ? primaryPhone.value : '';
            }
          }
          // O campo customizado "Telefone" do negocio costuma ficar vazio (ninguem preenche
          // manualmente); usa o telefone cadastrado na Pessoa vinculada como alternativa.
          // Remove aspa simples que o Pipedrive as vezes prefixa pra forcar texto.
          const telefone = (deal[FIELD_TELEFONE] || personPhone || '').replace(/^'/, '');

          deals.push({
            id: deal.id,
            pipelineId: deal.pipeline_id,
            title: deal.title,
            status: deal.status,
            stageId: deal.stage_id,
            addDate: (deal.add_time || '').slice(0, 10),
            wonDate: deal.won_time ? deal.won_time.slice(0, 10) : null,
            value: deal.value || 0,
            campanha: deal[FIELD_CAMPANHA] || '',
            conjunto: deal[FIELD_CONJUNTO] || '',
            palavraChave: deal[FIELD_PALAVRA_CHAVE] || '',
            plataforma: deal[FIELD_PLATAFORMA] || '',
            origem: deal[FIELD_ORIGEM] || '',
            labelRaw: deal.label || '',
            procedimentoRaw: deal[FIELD_PROCEDIMENTO] || '',
            telefone,
            ownerName: deal.user_id ? deal.user_id.name : '',
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
  } catch (error) {
    console.error('Erro ao buscar deals Pipedrive:', error.response?.data?.error || error.message);
  }

  return deals;
}

// Historico real de mudancas do deal (Pipedrive guarda isso, mas so devolve por deal - sem
// endpoint em lote). Usado pra montar o funil "real" (chegou a etapa X em algum momento),
// em vez da aproximacao pela posicao atual.
async function fetchDealFlow(dealId) {
  try {
    const response = await axios.get(`https://api.pipedrive.com/v1/deals/${dealId}/flow`, {
      params: { api_token: PIPEDRIVE_TOKEN, limit: 200 }, timeout: 10000
    });
    return (response.data && response.data.data) || [];
  } catch (error) {
    return [];
  }
}

async function fetchDealFlowsBatch(dealIds, concurrency = 15) {
  const results = new Map();
  let index = 0;
  async function worker() {
    while (index < dealIds.length) {
      const i = index++;
      const id = dealIds[i];
      results.set(id, await fetchDealFlow(id));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, dealIds.length) }, worker));
  return results;
}

// Maior rank de funil que o deal alcancou em algum momento, olhando todo stage_id que ja
// passou pelo campo (historico real), nao so a posicao atual.
function maxRankFromFlow(deal, flowEvents) {
  const stageIds = new Set([deal.stageId]);
  flowEvents.forEach(e => {
    if (e.object === 'dealChange' && e.data && e.data.field_key === 'stage_id') {
      if (e.data.old_value) stageIds.add(parseInt(e.data.old_value));
      if (e.data.new_value) stageIds.add(parseInt(e.data.new_value));
    }
  });
  let maxRank = 0;
  stageIds.forEach(sid => {
    const r = STAGE_RANK[sid];
    if (r !== undefined && r > maxRank) maxRank = r;
  });
  return maxRank;
}

function inRange(deal, since, until) {
  if (!deal.addDate) return false;
  if (since && deal.addDate < since) return false;
  if (until && deal.addDate > until) return false;
  return true;
}

// Meta-atribuido = deal com Campanha preenchida (veio de trafego pago rastreado).
function isMetaAttributed(deal) {
  return !!deal.campanha;
}

function buildCreatives(ads, deals) {
  const map = {};

  ads.forEach(ad => {
    const key = joinKey(ad.campaignName, ad.adsetName, ad.adName);
    if (!map[key]) {
      map[key] = {
        campanha: ad.campaignName, conjunto: ad.adsetName, anuncio: ad.adName,
        investimento: 0, impressoes: 0, cliques: 0, mensagensMeta: 0,
        leads: 0, qualificados: 0, agendados: 0, compareceram: 0, compras: 0, perdidos: 0,
        receita: 0, thumbnailUrl: ad.thumbnailUrl, adUrl: ad.adUrl, adStatus: ad.status,
        adId: ad.adId, dealDates: [], objectionCounts: {}
      };
    }
    map[key].investimento += ad.spend;
    map[key].impressoes += ad.impressions;
    map[key].cliques += ad.clicks;
    map[key].mensagensMeta += ad.mensagens;
    if (!map[key].thumbnailUrl && ad.thumbnailUrl) map[key].thumbnailUrl = ad.thumbnailUrl;
  });

  deals.forEach(deal => {
    const campanha = deal.campanha || 'sem_campanha';
    const conjunto = deal.conjunto || 'sem_conjunto';
    const anuncio = deal.palavraChave || 'sem_palavra_chave';
    const key = joinKey(campanha, conjunto, anuncio);
    if (!map[key]) {
      map[key] = {
        campanha, conjunto, anuncio,
        investimento: 0, impressoes: 0, cliques: 0, mensagensMeta: 0,
        leads: 0, qualificados: 0, agendados: 0, compareceram: 0, compras: 0, perdidos: 0,
        receita: 0, thumbnailUrl: null, adUrl: null, adStatus: null, adId: null, dealDates: [], objectionCounts: {}
      };
    }
    const r = map[key];
    const rank = rankOf(deal);
    r.leads++;
    if (rank >= 2 || deal.status === 'won') r.qualificados++;
    if (rank >= 3 || deal.status === 'won') r.agendados++;
    if (rank >= 4 || deal.status === 'won') r.compareceram++;
    if (deal.status === 'won') { r.compras++; r.receita += deal.value; r.dealDates.push({ date: deal.wonDate || deal.addDate, value: deal.value }); }
    if (deal.status === 'lost') {
      r.perdidos++;
      objectionNames(deal).forEach(tag => { r.objectionCounts[tag] = (r.objectionCounts[tag] || 0) + 1; });
    }
  });

  return Object.values(map).map(r => {
    const roas = r.investimento > 0 ? r.receita / r.investimento : 0;
    const receitaPorLead = r.leads > 0 ? r.receita / r.leads : 0;
    const receitaPorAgendamento = r.agendados > 0 ? r.receita / r.agendados : 0;
    const ctr = r.impressoes > 0 ? (r.cliques / r.impressoes) * 100 : 0;
    const cpc = r.cliques > 0 ? r.investimento / r.cliques : 0;

    // tendencia: divide as vendas em 2 metades cronologicas e compara receita
    const sortedDates = r.dealDates.map(d => d.date).filter(Boolean).sort();
    const trend = buildTrendBuckets(r.dealDates);
    const firstHalf = trend.slice(0, 2).reduce((s, v) => s + v, 0);
    const secondHalf = trend.slice(2).reduce((s, v) => s + v, 0);
    const trendDirection = secondHalf > firstHalf ? 'up' : secondHalf < firstHalf ? 'down' : 'flat';

    let status = 'observar';
    if (r.receita >= 1 && roas < 1.0 && r.investimento >= 500) status = 'desligar';
    else if (roas >= 2.0 && r.compras >= 3 && trendDirection !== 'down') status = 'escalar';

    const objecoes = Object.entries(r.objectionCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      campanha: r.campanha, conjunto: r.conjunto, anuncio: r.anuncio,
      investimento: round2(r.investimento), leads: r.leads, mensagensMeta: r.mensagensMeta,
      qualificados: r.qualificados, agendados: r.agendados, compareceram: r.compareceram, compras: r.compras,
      perdidos: r.perdidos, objecoes,
      receita: round2(r.receita), roas: round2(roas),
      receitaPorLead: round2(receitaPorLead), receitaPorAgendamento: round2(receitaPorAgendamento),
      ctr: round2(ctr), cpc: round2(cpc), impressoes: r.impressoes, cliques: r.cliques,
      trend, trendDirection, status,
      thumbnailUrl: r.thumbnailUrl, adUrl: r.adUrl, adStatus: r.adStatus, adId: r.adId
    };
  }).sort((a, b) => b.receita - a.receita);
}

function buildTrendBuckets(dealDates) {
  const withDates = dealDates.filter(d => d.date).sort((a, b) => a.date.localeCompare(b.date));
  if (withDates.length === 0) return [0, 0, 0, 0];
  const bucketSize = Math.ceil(withDates.length / 4) || 1;
  const buckets = [0, 0, 0, 0];
  withDates.forEach((d, i) => {
    const b = Math.min(3, Math.floor(i / bucketSize));
    buckets[b] += d.value;
  });
  return buckets.map(round2);
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function metric(curVal, prevVal) {
  return { current: round2(curVal), previous: round2(prevVal), deltaPct: deltaPct(curVal, prevVal) === null ? null : round2(deltaPct(curVal, prevVal)) };
}

function buildKpis(currentAds, currentDeals, previousAds, previousDeals) {
  function totals(ads, deals) {
    const attributed = deals.filter(isMetaAttributed);
    const won = attributed.filter(d => d.status === 'won');
    const receita = won.reduce((s, d) => s + d.value, 0);
    const compras = won.length;
    const investimento = ads.reduce((s, a) => s + a.spend, 0);
    const temposFechamento = won
      .filter(d => d.wonDate && d.addDate)
      .map(d => (new Date(d.wonDate) - new Date(d.addDate)) / 86400000);
    const tempoMedioFechamento = temposFechamento.length > 0
      ? temposFechamento.reduce((s, t) => s + t, 0) / temposFechamento.length
      : 0;
    return { receita, compras, investimento, tempoMedioFechamento };
  }
  const cur = totals(currentAds, currentDeals);
  const prev = totals(previousAds, previousDeals);

  const curTicket = cur.compras > 0 ? cur.receita / cur.compras : 0;
  const prevTicket = prev.compras > 0 ? prev.receita / prev.compras : 0;
  const curRoas = cur.investimento > 0 ? cur.receita / cur.investimento : 0;
  const prevRoas = prev.investimento > 0 ? prev.receita / prev.investimento : 0;
  const curCac = cur.compras > 0 ? cur.investimento / cur.compras : 0;
  const prevCac = prev.compras > 0 ? prev.investimento / prev.compras : 0;

  return {
    receita: metric(cur.receita, prev.receita),
    compras: metric(cur.compras, prev.compras),
    ticketMedio: metric(curTicket, prevTicket),
    investimento: metric(cur.investimento, prev.investimento),
    roas: metric(curRoas, prevRoas),
    cac: metric(curCac, prevCac),
    tempoMedioFechamento: metric(cur.tempoMedioFechamento, prev.tempoMedioFechamento)
  };
}

// rankFn decide o "rank" de progresso de cada deal no funil. Por padrao usa rankOf() (posicao
// ATUAL do deal, aproximada). O /api/funil-real passa uma versao baseada no historico real de
// mudanca de etapa (Pipedrive /deals/{id}/flow), que conta "chegou a etapa X em algum momento"
// em vez de "esta na etapa X agora" - mais fiel, mas exige 1 chamada de API por deal.
function buildFunnel(deals, rankFn = rankOf) {
  const counts = { leads: 0, qualificados: 0, agendados: 0, compareceram: 0, compraram: 0 };
  const topCreativesByStage = { leads: {}, qualificados: {}, agendados: {}, compareceram: {}, compraram: {} };
  // Pra cada anuncio, conta qual combinacao campanha/conjunto aparece mais - usado so pra
  // exibir a origem ao lado do nome do criativo no drill-down do funil.
  const anuncioOriginCounts = {};

  deals.forEach(deal => {
    const rank = rankFn(deal);
    const anuncio = deal.palavraChave || 'sem_palavra_chave';
    const bump = (stageKey) => { topCreativesByStage[stageKey][anuncio] = (topCreativesByStage[stageKey][anuncio] || 0) + 1; };

    const originKey = joinKey(deal.campanha || 'sem_campanha', deal.conjunto || 'sem_conjunto', '');
    if (!anuncioOriginCounts[anuncio]) anuncioOriginCounts[anuncio] = {};
    anuncioOriginCounts[anuncio][originKey] = (anuncioOriginCounts[anuncio][originKey] || 0) + 1;

    counts.leads++; bump('leads');
    if (rank >= 2 || deal.status === 'won') { counts.qualificados++; bump('qualificados'); }
    if (rank >= 3 || deal.status === 'won') { counts.agendados++; bump('agendados'); }
    if (rank >= 4 || deal.status === 'won') { counts.compareceram++; bump('compareceram'); }
    if (deal.status === 'won') { counts.compraram++; bump('compraram'); }
  });

  function originOf(anuncio) {
    const counts = anuncioOriginCounts[anuncio];
    if (!counts) return { campanha: '', conjunto: '' };
    const [bestKey] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const [campanha, conjunto] = bestKey.split('|||');
    return { campanha, conjunto };
  }

  // Perdidos "considerados nesta etapa" = negocios com status lost que ja tinham alcancado
  // no minimo o rank dessa etapa antes de morrer - mesmo criterio cumulativo usado pros
  // contadores principais (rank >= X), entao a barra de perdidos sempre cabe dentro da
  // barra total da etapa.
  const stageMinRank = { leads: 0, qualificados: 2, agendados: 3, compareceram: 4, compraram: null };
  const lostDeals = deals.filter(d => d.status === 'lost');

  function perdidosNaEtapa(minRank) {
    if (minRank === null) return { count: 0, objecoes: [] };
    const lostHere = lostDeals.filter(d => rankFn(d) >= minRank);
    const tagCounts = {};
    lostHere.forEach(d => { objectionNames(d).forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; }); });
    const objecoes = Object.entries(tagCounts).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 5);
    return { count: lostHere.length, objecoes };
  }

  const stageOrder = ['leads', 'qualificados', 'agendados', 'compareceram', 'compraram'];
  const labels = { leads: 'Leads', qualificados: 'Qualificados', agendados: 'Agendados', compareceram: 'Compareceram', compraram: 'Compraram' };
  const stages = stageOrder.map((key, i) => {
    const count = counts[key];
    const pctFromStart = counts.leads > 0 ? (count / counts.leads) * 100 : 0;
    const prevKey = i > 0 ? stageOrder[i - 1] : null;
    const pctLossFromPrev = prevKey && counts[prevKey] > 0 ? ((counts[prevKey] - count) / counts[prevKey]) * -100 : null;
    const perdidos = perdidosNaEtapa(stageMinRank[key]);
    return {
      key, label: labels[key], count, pctFromStart: round2(pctFromStart),
      pctLossFromPrev: pctLossFromPrev === null ? null : round2(pctLossFromPrev),
      perdidos: perdidos.count, objecoes: perdidos.objecoes
    };
  });

  const top5 = {};
  stageOrder.forEach(key => {
    top5[key] = Object.entries(topCreativesByStage[key])
      .map(([anuncio, count]) => ({ anuncio, count, pct: counts[key] > 0 ? round2((count / counts[key]) * 100) : 0, ...originOf(anuncio) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });

  return { stages, topCreativesByStage: top5, insights: buildFunnelInsights(stages) };
}

// Conclusoes automaticas sobre a evolucao do funil no periodo - gargalo, etapa com mais
// perda, principal motivo de perda e taxa de conversao geral.
function buildFunnelInsights(stages) {
  const insights = [];
  const leadsStage = stages.find(s => s.key === 'leads');
  const compraramStage = stages.find(s => s.key === 'compraram');

  const bottleneck = stages.slice(1).reduce((worst, s) => (s.pctLossFromPrev !== null && s.pctLossFromPrev < (worst?.pctLossFromPrev ?? 1)) ? s : worst, null);
  if (bottleneck) {
    const idx = stages.findIndex(s => s.key === bottleneck.key);
    const prevLabel = stages[idx - 1]?.label;
    insights.push({ id: 'funil-gargalo', severity: 'critical', text: `Maior gargalo do funil: ${prevLabel} → ${bottleneck.label} (perda de ${Math.abs(bottleneck.pctLossFromPrev).toFixed(0)}%).` });
  }

  const stagesWithLoss = stages.filter(s => s.key !== 'compraram' && s.perdidos > 0);
  if (stagesWithLoss.length > 0) {
    const worstLoss = [...stagesWithLoss].sort((a, b) => b.perdidos - a.perdidos)[0];
    const pctOfStage = worstLoss.count > 0 ? (worstLoss.perdidos / worstLoss.count) * 100 : 0;
    insights.push({ id: 'funil-mais-perdidos', severity: 'critical', text: `"${worstLoss.label}" é a etapa com mais negócios perdidos: ${worstLoss.perdidos} de ${worstLoss.count} que chegaram lá (${pctOfStage.toFixed(0)}%).` });
  }

  if (leadsStage && leadsStage.objecoes.length > 0) {
    const top = leadsStage.objecoes[0];
    insights.push({ id: 'funil-motivo-perda', severity: 'neutral', text: `Principal motivo de perda registrado: "${top.tag}" (${top.count} casos).` });
  }

  if (leadsStage && leadsStage.count > 0 && compraramStage) {
    const convPct = (compraramStage.count / leadsStage.count) * 100;
    insights.push({ id: 'funil-conversao', severity: convPct >= 5 ? 'good' : 'neutral', text: `${convPct.toFixed(1)}% dos leads do período viraram venda (${compraramStage.count} de ${leadsStage.count}).` });
  }

  return insights;
}

function buildPipelineAging(allOpenDeals) {
  const buckets = [
    { label: '0-3 dias', min: 0, max: 3 },
    { label: '4-7 dias', min: 4, max: 7 },
    { label: '8-14 dias', min: 8, max: 14 },
    { label: '15-21 dias', min: 15, max: 21 },
    { label: '22-30 dias', min: 22, max: 30 },
    { label: '30+ dias', min: 31, max: Infinity }
  ].map(b => ({ ...b, count: 0, potentialValue: 0, deals: [] }));

  const today = new Date();
  const stuckByCreative = {};
  const campaignDays = {};

  allOpenDeals.forEach(deal => {
    if (!deal.addDate) return;
    const added = new Date(deal.addDate + 'T00:00:00');
    const days = Math.floor((today - added) / 86400000);
    const bucket = buckets.find(b => days >= b.min && days <= b.max) || buckets[buckets.length - 1];
    bucket.count++;
    bucket.potentialValue += deal.value || 0;
    if (bucket.deals.length < 500) {
      bucket.deals.push({
        id: deal.id,
        title: deal.personName || deal.title || 'Sem nome',
        days,
        anuncio: deal.palavraChave || 'sem_palavra_chave',
        campanha: deal.campanha || 'sem_campanha',
        etapa: stageName(deal),
        responsavel: deal.ownerName || 'Sem responsável',
        dataEntrada: deal.addDate
      });
    }

    const anuncio = deal.palavraChave || 'sem_palavra_chave';
    stuckByCreative[anuncio] = (stuckByCreative[anuncio] || 0) + (days >= 15 ? 1 : 0);

    const campanha = deal.campanha || 'sem_campanha';
    if (!campaignDays[campanha]) campaignDays[campanha] = { total: 0, count: 0 };
    campaignDays[campanha].total += days;
    campaignDays[campanha].count++;
  });

  const stuckCreatives = Object.entries(stuckByCreative)
    .filter(([, c]) => c > 0)
    .map(([anuncio, count]) => ({ anuncio, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const slowestCampaigns = Object.entries(campaignDays)
    .map(([campanha, v]) => ({ campanha, avgDays: round2(v.total / v.count), count: v.count }))
    .sort((a, b) => b.avgDays - a.avgDays)
    .slice(0, 8);

  return {
    buckets: buckets.map(b => ({ label: b.label, count: b.count, potentialValue: round2(b.potentialValue), deals: b.deals })),
    stuckCreatives, slowestCampaigns
  };
}

function buildPatients(deals) {
  return deals.filter(d => d.status === 'won').map(deal => {
    let tempoAteFechar = null;
    if (deal.wonDate && deal.addDate) {
      tempoAteFechar = Math.round((new Date(deal.wonDate) - new Date(deal.addDate)) / 86400000);
    }
    const closers = closerNames(deal);
    return {
      id: deal.id,
      nome: deal.personName || deal.title || 'Sem nome',
      telefone: deal.telefone || '',
      criativo: deal.palavraChave || 'sem_palavra_chave',
      campanha: deal.campanha || 'sem_campanha',
      conjunto: deal.conjunto || 'sem_conjunto',
      closer: closers.length > 0 ? closers.join(', ') : null,
      sdr: deal.ownerName || '',
      procedimento: procedimentoNames(deal).join(', ') || '—',
      valor: round2(deal.value),
      dataLead: deal.addDate,
      dataVenda: deal.wonDate,
      status: deal.status,
      tempoAteFechar,
      pipedriveUrl: pipedriveDealUrl(deal.id)
    };
  }).sort((a, b) => (b.dataVenda || '').localeCompare(a.dataVenda || ''));
}

// Fechamentos do pipeline Recepcao (pacientes fechados pela clinica sem atribuicao de
// marketing - indicacao, retorno, ja e paciente etc). Mostrado numa aba separada, nunca
// misturado com os criativos/funil/campanhas do marketing.
function buildFechamentosRecepcao(deals) {
  return deals.filter(d => d.status === 'won').map(deal => {
    const closers = closerNames(deal);
    return {
      id: deal.id,
      nome: deal.personName || deal.title || 'Sem nome',
      telefone: deal.telefone || '',
      procedimento: procedimentoNames(deal).join(', ') || '—',
      closer: closers.length > 0 ? closers.join(', ') : null,
      responsavel: deal.ownerName || '',
      valor: round2(deal.value),
      dataFechamento: deal.wonDate,
      pipedriveUrl: pipedriveDealUrl(deal.id)
    };
  }).sort((a, b) => (b.dataFechamento || '').localeCompare(a.dataFechamento || ''));
}

function buildRecepcaoKpis(currentDeals, previousDeals) {
  function totals(deals) {
    const won = deals.filter(d => d.status === 'won');
    return { receita: won.reduce((s, d) => s + d.value, 0), compras: won.length };
  }
  const cur = totals(currentDeals);
  const prev = totals(previousDeals);
  const curTicket = cur.compras > 0 ? cur.receita / cur.compras : 0;
  const prevTicket = prev.compras > 0 ? prev.receita / prev.compras : 0;
  return {
    receita: metric(cur.receita, prev.receita),
    compras: metric(cur.compras, prev.compras),
    ticketMedio: metric(curTicket, prevTicket)
  };
}

// Leads sem Palavra-chave (criativo) preenchida no Pipedrive - sem isso e impossivel
// saber qual anuncio do Meta gerou o lead, entao ele fica de fora de toda a atribuicao
// (Campanhas, Funil por criativo, etc). Independente de status (aberto/ganho/perdido).
function buildLeadsSemOrigem(deals) {
  return deals.filter(d => !d.palavraChave).map(deal => ({
    id: deal.id,
    nome: deal.personName || deal.title || 'Sem nome',
    campanha: deal.campanha || null,
    conjunto: deal.conjunto || null,
    etapa: stageName(deal),
    responsavel: deal.ownerName || 'Sem responsável',
    dataEntrada: deal.addDate,
    status: deal.status
  })).sort((a, b) => (b.dataEntrada || '').localeCompare(a.dataEntrada || ''));
}

function buildGovernance(deals) {
  const won = deals.filter(d => d.status === 'won');
  const semResponsavel = won.filter(d => closerNames(d).length === 0);
  return {
    totalVendas: won.length,
    comResponsavel: won.length - semResponsavel.length,
    semResponsavel: {
      count: semResponsavel.length,
      value: round2(semResponsavel.reduce((s, d) => s + d.value, 0)),
      deals: semResponsavel.slice(0, 100).map(d => ({ id: d.id, title: d.personName || d.title, value: round2(d.value), data: d.wonDate }))
    }
  };
}

// Valor de um deal parado = valor real cadastrado no Pipedrive, sem estimativa nenhuma.
// Negocios sem valor definido entram na lista/contagem normalmente (pra nao esconder que
// estao parados), mas nao entram na soma em R$ - contados a parte em "semOrcamento".
function buildRevenueAtRisk(deals, ticketMedio = 0) {
  function group(filtered) {
    const items = filtered.map(d => ({
      id: d.id,
      title: d.personName || d.title,
      status: d.status,
      value: round2(d.value || 0),
      telefone: d.telefone || '',
      campanha: d.campanha || 'sem_campanha',
      criativo: d.palavraChave || 'sem_palavra_chave',
      pipedriveUrl: pipedriveDealUrl(d.id)
    }));
    const comValor = items.filter(d => d.value > 0);
    const semValor = items.filter(d => d.value === 0);
    const valorComEstimativa = comValor.reduce((s, d) => s + d.value, 0) + (semValor.length * ticketMedio);
    return {
      count: items.length,
      value: round2(valorComEstimativa),
      semOrcamento: semValor.length,
      deals: items.slice(0, 100)
    };
  }

  const qualificadosSemAgendamento = group(deals.filter(d => d.status === 'open' && rankOf(d) === 2));
  const agendadosFaltaram = group(deals.filter(d => d.stageId === 13)); // "Nao Compareceu - reagendar"
  const propostasSemFechamento = group(deals.filter(d => d.status === 'open' && rankOf(d) >= 4));

  const total = round2(qualificadosSemAgendamento.value + agendadosFaltaram.value + propostasSemFechamento.value);
  return { qualificadosSemAgendamento, agendadosFaltaram, propostasSemFechamento, total };
}

function buildInsights(creatives, funnel, governance, pipeline) {
  const insights = [];

  if (governance.semResponsavel.count > 0) {
    insights.push({
      id: 'gov-sem-responsavel',
      severity: 'critical',
      text: `⚠ ${governance.semResponsavel.count} vendas (${formatBRL(governance.semResponsavel.value)}) sem etiqueta de responsável — corrija antes da próxima reunião.`
    });
  }

  const withSales = creatives.filter(c => c.compras >= 3);
  if (withSales.length > 0) {
    const best = [...withSales].sort((a, b) => b.receitaPorLead - a.receitaPorLead)[0];
    insights.push({ id: 'melhor-receita-lead', severity: 'good', text: `"${best.anuncio}" gera ${formatBRL(best.receitaPorLead)} por lead — o melhor da conta no período.` });

    const bestRoas = [...withSales].sort((a, b) => b.roas - a.roas)[0];
    insights.push({ id: 'melhor-roas', severity: 'good', text: `"${bestRoas.conjunto}" tem o maior ROAS do período: ${bestRoas.roas.toFixed(2)}x.` });
  }

  const manyLeadsFewSales = creatives.filter(c => c.leads >= 10 && c.compras === 0);
  if (manyLeadsFewSales.length > 0) {
    const worst = [...manyLeadsFewSales].sort((a, b) => b.leads - a.leads)[0];
    insights.push({ id: 'muitos-leads-poucas-vendas', severity: 'critical', text: `"${worst.anuncio}" gerou ${worst.leads} leads e nenhuma venda no período — considerar pausar.` });
  }

  const bottleneck = funnel.stages.slice(1).reduce((worst, s) => (s.pctLossFromPrev !== null && s.pctLossFromPrev < (worst?.pctLossFromPrev ?? 1)) ? s : worst, null);
  if (bottleneck) {
    const idx = funnel.stages.findIndex(s => s.key === bottleneck.key);
    const prevLabel = funnel.stages[idx - 1]?.label;
    insights.push({ id: 'gargalo', severity: 'neutral', text: `Gargalo atual: ${prevLabel} → ${bottleneck.label} (perda de ${Math.abs(bottleneck.pctLossFromPrev).toFixed(0)}%).` });
  }

  const stuck = pipeline.buckets.filter(b => b.label === '22-30 dias' || b.label === '30+ dias').reduce((s, b) => s + b.count, 0);
  const stuckValue = pipeline.buckets.filter(b => b.label === '22-30 dias' || b.label === '30+ dias').reduce((s, b) => s + b.potentialValue, 0);
  if (stuck > 0) {
    insights.push({ id: 'pipeline-parado', severity: 'critical', text: `${stuck} leads parados há mais de 21 dias no pipeline.` });
  }

  const toDisable = creatives.filter(c => c.status === 'desligar');
  toDisable.slice(0, 3).forEach(c => {
    insights.push({ id: `desligar-${c.anuncio}`, severity: 'critical', text: `"${c.anuncio}" está com ROAS ${c.roas.toFixed(2)}x e investimento de ${formatBRL(c.investimento)} — candidato a pausa.` });
  });

  return insights;
}

function formatBRL(v) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Endpoint principal do Vivera Insights: um unico payload com tudo que as 6 paginas precisam.
app.get('/api/dashboard', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = { since: req.query.since || defaults.since, until: req.query.until || defaults.until };
    const prevRange = previousRange(range.since, range.until);

    const [currentAds, previousAds, allDeals] = await Promise.all([
      getMetaAds(range.since, range.until),
      getMetaAds(prevRange.since, prevRange.until),
      fetchAllDeals()
    ]);

    const inboundDealsAll = allDeals.filter(d => d.pipelineId === INBOUND_PIPELINE_ID);
    const recepcaoDealsAll = allDeals.filter(d => d.pipelineId === RECEPCAO_PIPELINE_ID);

    const deals = inboundDealsAll.filter(d => inRange(d, range.since, range.until));
    const previousDeals = inboundDealsAll.filter(d => inRange(d, prevRange.since, prevRange.until));
    const openDealsAllTime = inboundDealsAll.filter(d => d.status === 'open');

    const recepcaoDeals = recepcaoDealsAll.filter(d => inRange(d, range.since, range.until));
    const previousRecepcaoDeals = recepcaoDealsAll.filter(d => inRange(d, prevRange.since, prevRange.until));

    const kpis = buildKpis(currentAds, deals, previousAds, previousDeals);
    const creatives = buildCreatives(currentAds, deals);
    const funnel = buildFunnel(deals);
    const pipeline = buildPipelineAging(openDealsAllTime);
    const patients = buildPatients(deals);
    const governance = buildGovernance(deals);
    const insights = buildInsights(creatives, funnel, governance, pipeline);
    const leadsSemOrigem = buildLeadsSemOrigem(deals);

    // "Oportunidades Paradas" usa uma janela fixa de 3 meses, independente do filtro de
    // data selecionado - negocio parado importa mesmo que o usuario esteja olhando "Mes atual".
    const revenueAtRiskRange = lastNMonthsRange(3);
    const dealsForRisk = inboundDealsAll.filter(d => inRange(d, revenueAtRiskRange.since, revenueAtRiskRange.until));

    // Calcula ticket medio dos ultimos 3 meses pra estimar negocjos sem orcamento
    const dealsClosedIn3Months = inboundDealsAll.filter(d => inRange(d, revenueAtRiskRange.since, revenueAtRiskRange.until) && d.status === 'won');
    const totalReceitaIn3M = dealsClosedIn3Months.reduce((s, d) => s + (d.value || 0), 0);
    const ticketMedio3M = dealsClosedIn3Months.length > 0 ? totalReceitaIn3M / dealsClosedIn3Months.length : 0;

    const revenueAtRisk = buildRevenueAtRisk(dealsForRisk, ticketMedio3M);

    const recepcaoKpis = buildRecepcaoKpis(recepcaoDeals, previousRecepcaoDeals);
    const fechamentosRecepcao = buildFechamentosRecepcao(recepcaoDeals);
    // Faturamento total da empresa = marketing (Inbound, atribuido a Meta Ads) + Recepcao.
    // So esse numero soma os dois "motores" - todo o resto do dashboard fica separado
    // de proposito, pra nao diluir o que e especificamente resultado do marketing.
    const faturamentoTotal = metric(
      kpis.receita.current + recepcaoKpis.receita.current,
      kpis.receita.previous + recepcaoKpis.receita.previous
    );

    res.json({
      success: true,
      range, previousRange: prevRange,
      kpis, creatives, funnel, pipeline, patients, governance, revenueAtRisk, insights, leadsSemOrigem,
      revenueAtRiskRange,
      ticketMedio3M: round2(ticketMedio3M),
      recepcao: { kpis: recepcaoKpis, fechamentos: fechamentosRecepcao },
      faturamentoTotal,
      meta: {
        adsAccounts: FB_AD_ACCOUNT_IDS.length,
        totalAdsComGasto: currentAds.length,
        totalDealsNoPeriodo: deals.length
      }
    });
  } catch (error) {
    console.error('Erro no /api/dashboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Funil "real": usa o historico de mudanca de etapa de cada deal (Pipedrive /deals/{id}/flow)
// em vez da posicao atual. Mais fiel (bate com o que o proprio Insights do Pipedrive mostra),
// mas exige 1 chamada de API por deal do periodo - roda sob demanda, nao no dashboard principal.
app.get('/api/funil-real', async (req, res) => {
  try {
    const defaults = defaultDateRange();
    const range = { since: req.query.since || defaults.since, until: req.query.until || defaults.until };

    const allDeals = await fetchAllDeals();
    const inboundDealsAll = allDeals.filter(d => d.pipelineId === INBOUND_PIPELINE_ID);
    const deals = inboundDealsAll.filter(d => inRange(d, range.since, range.until));

    const flows = await fetchDealFlowsBatch(deals.map(d => d.id));
    const rankFn = deal => maxRankFromFlow(deal, flows.get(deal.id) || []);
    const funnel = buildFunnel(deals, rankFn);

    res.json({ success: true, range, funnel, dealsAnalisados: deals.length });
  } catch (error) {
    console.error('Erro no /api/funil-real:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Auditoria: cruza os leads sem Palavra-chave (sem origem) com o Tintim, pra ver se o
// tracker deles capturou a origem que o Pipedrive perdeu. So roda sob demanda (o usuario
// clica pra abrir a pagina), nao em todo carregamento do dashboard.
app.get('/api/tintim-audit', async (req, res) => {
  try {
    if (!TINTIM_ACCOUNT_CODE || !TINTIM_ACCOUNT_TOKEN) {
      return res.status(400).json({ success: false, error: 'Tintim nao configurado (faltam TINTIM_ACCOUNT_CODE / TINTIM_ACCOUNT_TOKEN nas variaveis de ambiente).' });
    }

    const allDeals = await fetchAllDeals();
    const inboundDeals = allDeals.filter(d => d.pipelineId === INBOUND_PIPELINE_ID);
    const semOrigem = inboundDeals.filter(d => !d.palavraChave);
    const comTelefone = semOrigem.filter(d => normalizePhoneForTintim(d.telefone));

    const uniquePhones = [...new Set(comTelefone.map(d => normalizePhoneForTintim(d.telefone)))];
    const tintimResults = await fetchTintimLeadsBatch(uniquePhones, 5);

    const items = semOrigem.map(deal => {
      const phone = normalizePhoneForTintim(deal.telefone);
      const suggestion = phone ? tintimToSuggestion(tintimResults.get(phone)) : { found: false, noPhone: true };
      return {
        dealId: deal.id,
        nome: deal.personName || deal.title || 'Sem nome',
        telefone: deal.telefone || '',
        etapa: stageName(deal),
        responsavel: deal.ownerName || 'Sem responsável',
        dataEntrada: deal.addDate,
        status: deal.status,
        tintim: suggestion
      };
    }).sort((a, b) => (b.dataEntrada || '').localeCompare(a.dataEntrada || ''));

    res.json({ success: true, items, checked: uniquePhones.length });
  } catch (error) {
    console.error('Erro no /api/tintim-audit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Escreve de volta no Pipedrive os campos de origem sugeridos pelo Tintim - so executa
// quando o usuario confirma explicitamente na tela (nunca automatico).
app.post('/api/tintim-audit/apply', async (req, res) => {
  try {
    const { dealId, campanha, conjunto, palavraChave, plataforma, origem } = req.body || {};
    if (!dealId || !palavraChave) {
      return res.status(400).json({ success: false, error: 'dealId e palavraChave sao obrigatorios.' });
    }

    const fields = {};
    if (campanha) fields[FIELD_CAMPANHA] = campanha;
    if (conjunto) fields[FIELD_CONJUNTO] = conjunto;
    if (palavraChave) fields[FIELD_PALAVRA_CHAVE] = palavraChave;
    if (plataforma) fields[FIELD_PLATAFORMA] = plataforma;
    if (origem) fields[FIELD_ORIGEM] = origem;

    await axios.put(`https://api.pipedrive.com/v1/deals/${dealId}`, fields, {
      params: { api_token: PIPEDRIVE_TOKEN }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar deal no Pipedrive via Tintim:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: (error.response && error.response.data && error.response.data.error) || error.message });
  }
});

// Servir o frontend React buildado (web/dist). Fallback pra SPA em qualquer rota nao-API.
const WEB_DIST = path.join(__dirname, 'web', 'dist');
if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(WEB_DIST, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Build do frontend nao encontrado (web/dist). Rode "npm run build" em web/.');
  });
}

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
Servidor rodando em http://localhost:${PORT}
API: http://localhost:${PORT}/api/dashboard

Configuracoes:
   - Meta Accounts: ${FB_AD_ACCOUNT_IDS.length}
   - Pipedrive Token: ${PIPEDRIVE_TOKEN ? PIPEDRIVE_TOKEN.substring(0, 10) + '...' : 'NAO CONFIGURADO'}
   - Pipeline Inbound ID: ${INBOUND_PIPELINE_ID}
   - Frontend buildado: ${fs.existsSync(WEB_DIST) ? 'sim' : 'NAO - rode npm run build em web/'}
    `);
  });
}

module.exports = app;
