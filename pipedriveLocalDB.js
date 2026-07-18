const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DB_DIR = path.join(__dirname, 'data', 'pipedrive-db');
const DEALS_FILE = path.join(DB_DIR, 'deals.json');
const STAGES_FILE = path.join(DB_DIR, 'stages.json');
const PIPELINES_FILE = path.join(DB_DIR, 'pipelines.json');
const META_FILE = path.join(DB_DIR, 'meta.json');

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
}

function loadJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    console.log(`[pipedrive-db] Falha ao ler ${file}:`, e.message);
  }
  return fallback;
}

function saveJSON(file, data) {
  try {
    ensureDir();
    fs.writeFileSync(file, JSON.stringify(data));
  } catch (e) {
    console.log(`[pipedrive-db] Falha ao salvar ${file}:`, e.message);
  }
}

let _deals = loadJSON(DEALS_FILE, []);
let _stages = loadJSON(STAGES_FILE, []);
let _pipelines = loadJSON(PIPELINES_FILE, []);
let _meta = loadJSON(META_FILE, { lastSyncAt: null, lastSyncStatus: 'never', lastError: null, dealCount: 0, stageCount: 0, pipelineCount: 0 });

console.log(`[pipedrive-db] Carregado do disco: ${_deals.length} deals, ${_stages.length} stages, ${_pipelines.length} pipelines`);

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_TOKEN;
const BASE = 'https://api.pipedrive.com/v1';
const MAX_API_CALLS_PER_SYNC = 200; // trava de seguranca: nunca mais de 200 chamadas de API do Pipedrive numa mesma rodada de sync

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchAllDeals(callCounter) {
  const all = [];
  let start = 0;
  const limit = 500;
  while (true) {
    if (callCounter.count >= MAX_API_CALLS_PER_SYNC) {
      console.warn(`[pipedrive-db] Limite de ${MAX_API_CALLS_PER_SYNC} chamadas de API atingido durante fetchAllDeals - parando paginacao com ${all.length} deals carregados (sync parcial)`);
      callCounter.limitReached = true;
      break;
    }
    callCounter.count++;
    const resp = await axios.get(`${BASE}/deals`, {
      params: { api_token: PIPEDRIVE_TOKEN, status: 'all_not_deleted', start, limit, sort: 'update_time DESC' }
    });
    if (resp.fromCache) {
      throw new Error('Resposta de deals veio do cache de fallback (429) - abortando sync para nao sobrescrever dados bons com dados potencialmente incompletos');
    }
    if (!resp.data || resp.data.success !== true) {
      throw new Error('Resposta invalida do Pipedrive ao buscar deals');
    }
    const batch = resp.data.data || [];
    all.push(...batch);
    const pagination = resp.data.additional_data && resp.data.additional_data.pagination;
    if (!pagination || !pagination.more_items_in_collection) break;
    start = pagination.next_start;
    await sleep(350);
  }
  return all;
}

async function fetchStages(callCounter) {
  if (callCounter.count >= MAX_API_CALLS_PER_SYNC) {
    console.warn(`[pipedrive-db] Limite de ${MAX_API_CALLS_PER_SYNC} chamadas de API atingido - pulando fetchStages, mantendo cache anterior`);
    callCounter.limitReached = true;
    return null;
  }
  callCounter.count++;
  const resp = await axios.get(`${BASE}/stages`, { params: { api_token: PIPEDRIVE_TOKEN } });
  if (resp.fromCache) throw new Error('stages veio do cache de fallback (429)');
  if (!resp.data || resp.data.success !== true) throw new Error('Resposta invalida do Pipedrive ao buscar stages');
  return resp.data.data || [];
}

async function fetchPipelines(callCounter) {
  if (callCounter.count >= MAX_API_CALLS_PER_SYNC) {
    console.warn(`[pipedrive-db] Limite de ${MAX_API_CALLS_PER_SYNC} chamadas de API atingido - pulando fetchPipelines, mantendo cache anterior`);
    callCounter.limitReached = true;
    return null;
  }
  callCounter.count++;
  const resp = await axios.get(`${BASE}/pipelines`, { params: { api_token: PIPEDRIVE_TOKEN } });
  if (resp.fromCache) throw new Error('pipelines veio do cache de fallback (429)');
  if (!resp.data || resp.data.success !== true) throw new Error('Resposta invalida do Pipedrive ao buscar pipelines');
  return resp.data.data || [];
}

let _syncing = false;
async function syncNow() {
  if (_syncing) {
    console.log('[pipedrive-db] Sync ja em andamento, ignorando chamada duplicada');
    return { skipped: true };
  }
  if (!PIPEDRIVE_TOKEN) {
    console.log('[pipedrive-db] PIPEDRIVE_TOKEN ausente, sync cancelado');
    return { success: false, error: 'PIPEDRIVE_TOKEN ausente' };
  }
  _syncing = true;
  const startedAt = Date.now();
  const callCounter = { count: 0, limitReached: false };
  try {
    console.log('[pipedrive-db] Iniciando sincronizacao com Pipedrive...');
    const pipelines = await fetchPipelines(callCounter);
    await sleep(300);
    const stages = await fetchStages(callCounter);
    await sleep(300);
    const deals = await fetchAllDeals(callCounter);

    _deals = deals;
    _stages = (stages !== null) ? stages : _stages;
    _pipelines = (pipelines !== null) ? pipelines : _pipelines;
    _meta = {
      lastSyncAt: Date.now(),
      lastSyncStatus: callCounter.limitReached ? 'partial-call-limit-200' : 'success',
      lastError: null,
      dealCount: _deals.length,
      stageCount: _stages.length,
      pipelineCount: _pipelines.length,
      apiCallsUsed: callCounter.count,
      durationMs: Date.now() - startedAt
    };

    saveJSON(DEALS_FILE, _deals);
    saveJSON(STAGES_FILE, _stages);
    saveJSON(PIPELINES_FILE, _pipelines);
    saveJSON(META_FILE, _meta);

    console.log(`[pipedrive-db] Sync concluido (${_meta.lastSyncStatus}): ${_deals.length} deals, ${_stages.length} stages, ${_pipelines.length} pipelines, ${callCounter.count} chamadas de API usadas em ${_meta.durationMs}ms`);
    return { success: true, meta: _meta };
  } catch (e) {
    _meta = { ..._meta, lastSyncStatus: 'error', lastError: e.message, lastAttemptAt: Date.now() };
    saveJSON(META_FILE, _meta);
    console.log('[pipedrive-db] Sync falhou:', e.message);
    return { success: false, error: e.message };
  } finally {
    _syncing = false;
  }
}

// ---- Atualizacao incremental via webhook (evita full re-sync a cada evento) ----
function upsertDeal(deal) {
  if (!deal || deal.id == null) return;
  const idx = _deals.findIndex(d => String(d.id) === String(deal.id));
  if (idx >= 0) _deals[idx] = deal; else _deals.push(deal);
  saveJSON(DEALS_FILE, _deals);
  _meta.lastWebhookUpdateAt = Date.now();
  _meta.dealCount = _deals.length;
  saveJSON(META_FILE, _meta);
}
function removeDeal(id) {
  if (id == null) return;
  const idx = _deals.findIndex(d => String(d.id) === String(id));
  if (idx >= 0) {
    _deals.splice(idx, 1);
    saveJSON(DEALS_FILE, _deals);
    _meta.lastWebhookUpdateAt = Date.now();
    _meta.dealCount = _deals.length;
    saveJSON(META_FILE, _meta);
  }
}
function upsertStage(stage) {
  if (!stage || stage.id == null) return;
  const idx = _stages.findIndex(s => String(s.id) === String(stage.id));
  if (idx >= 0) _stages[idx] = stage; else _stages.push(stage);
  saveJSON(STAGES_FILE, _stages);
}
function upsertPipeline(pipeline) {
  if (!pipeline || pipeline.id == null) return;
  const idx = _pipelines.findIndex(p => String(p.id) === String(pipeline.id));
  if (idx >= 0) _pipelines[idx] = pipeline; else _pipelines.push(pipeline);
  saveJSON(PIPELINES_FILE, _pipelines);
}
function getDeals() { return _deals; }
function getStages() { return _stages; }
function getPipelines() { return _pipelines; }
function getMeta() { return _meta; }
function isEmpty() { return _deals.length === 0; }

function startScheduledSync(intervalMinutes = 30) {
  const delayMs = 20000 + Math.floor(Math.random() * 10000);
  setTimeout(() => { syncNow(); }, delayMs);
  setInterval(() => { syncNow(); }, intervalMinutes * 60 * 1000);
  console.log(`[pipedrive-db] Sync agendado a cada ${intervalMinutes} min (primeira em ~${Math.round(delayMs/1000)}s)`);
}

module.exports = { syncNow, getDeals, getStages, getPipelines, getMeta, isEmpty, startScheduledSync, upsertDeal, removeDeal, upsertStage, upsertPipeline };
