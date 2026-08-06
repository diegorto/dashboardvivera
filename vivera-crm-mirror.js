'use strict';

/**
 * Espelha (mirror) para o banco `vivera_crm` os dados JA buscados do Pipedrive
 * pelo `pipedriveLocalDB` (mesmo array de deals que alimenta o dashboard).
 *
 * IMPORTANTE:
 * - Este modulo NAO faz nenhuma chamada a API do Pipedrive. Ele so le o cache em
 *   memoria (pipedriveLocalDB.getDeals()/getPipelines()/getStages()), por isso
 *   chamar mirrorToVCRM() nao consome nada do orcamento diario de 200 chamadas.
 * - Deve ser chamado a partir do job noturno ja existente em server.js
 *   (runNightlySyncIfWindow), logo depois de pipedriveLocalDB.syncNow() ter sucesso.
 * - Qualquer erro aqui fica isolado (try/catch) e nunca derruba o job noturno
 *   principal nem afeta o dashboard.
 */

const mysql = require('mysql2/promise');

// Mesmos IDs de campos customizados "Trafego Pago" usados no dashboard (server.js)
const FIELD_CAMPANHA = 'b70cf4c34cd06cb3917b79f3ebe1e64d28666f4b';
const FIELD_CONJUNTO = '182132e7acfbec43315140ab18362f0e16ada0c4';
const FIELD_PALAVRA_CHAVE = 'c9ee045e6537eb296d268102e99829b0dbda1b5b';
const FIELD_PLATAFORMA = '0051c071b9be4c9103f8a91ef538dcc3d43e6e9a';
const FIELD_ORIGEM = 'fd9cfb07956d6227f9e50b9be8b20ab176d17ce7';

// Mesmo mapeamento usado no dashboard para o campo Origem (opcao -> texto)
const ORIGEM_LABELS = {
  '86': 'Indicacao (dentro da clinica)',
  '87': 'Indicacao de paciente',
  '88': 'Instagram',
  '89': 'Facebook',
  '90': 'Google',
  '91': 'Organico',
  '92': 'Campanhas sazonais',
  '93': 'Ja e paciente',
  '96': 'Origem nao Identificada',
  '114': 'Indicacao - Estimulo da CRC',
};

let _pool = null;
function getPool() {
  if (_pool) return _pool;
  _pool = mysql.createPool({
    host: process.env.CRM_DB_HOST || '127.0.0.1',
    port: parseInt(process.env.CRM_DB_PORT || '3306', 10),
    user: process.env.CRM_DB_USER || 'crm',
    password: process.env.CRM_DB_PASSWORD || 'crmdev123',
    database: process.env.CRM_DB_NAME || 'vivera_crm',
    waitForConnections: true,
    connectionLimit: 5,
    namedPlaceholders: true,
    timezone: 'Z',
  });
  return _pool;
}

function normName(s) {
  if (!s) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function firstContactValue(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const primary = arr.find((x) => x && x.primary && x.value);
  const val = (primary && primary.value) || (arr[0] && arr[0].value) || null;
  if (!val) return null;
  const s = String(val).trim();
  return s || null;
}

function toMysqlDateTime(v) {
  if (!v) return null;
  return v; // Pipedrive ja retorna 'YYYY-MM-DD HH:MM:SS'
}

function nowDateTime() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// Resolve pipeline/stage locais a partir dos dados ja cacheados do Pipedrive
// (pipelines.json / stages.json), casando por nome normalizado. Faz backfill
// (uma unica vez) da coluna pipedrive_id em pipelines/stages para acelerar
// as proximas execucoes - sem nenhuma chamada nova ao Pipedrive.
async function buildPipelineStageMaps(conn, pdPipelines, pdStages) {
  const [crmPipelines] = await conn.execute('SELECT id, name, pipedrive_id FROM pipelines');
  const [crmStages] = await conn.execute('SELECT id, pipeline_id, label, pipedrive_id FROM stages');

  const pipelineByPdId = new Map();
  const pipelineByName = new Map();
  crmPipelines.forEach((p) => {
    if (p.pipedrive_id) pipelineByPdId.set(p.pipedrive_id, p.id);
    pipelineByName.set(normName(p.name), p.id);
  });

  const pipelineBackfill = [];
  (pdPipelines || []).forEach((pp) => {
    if (!pipelineByPdId.has(pp.id)) {
      const crmId = pipelineByName.get(normName(pp.name));
      if (crmId) {
        pipelineByPdId.set(pp.id, crmId);
        pipelineBackfill.push([crmId, pp.id]);
      }
    }
  });

  const stageByPdId = new Map();
  const stageByPipelineAndName = new Map();
  crmStages.forEach((s) => {
    if (s.pipedrive_id) stageByPdId.set(s.pipedrive_id, s.id);
    stageByPipelineAndName.set(s.pipeline_id + '|' + normName(s.label), s.id);
  });

  const stageBackfill = [];
  (pdStages || []).forEach((ps) => {
    if (stageByPdId.has(ps.id)) return;
    const crmPipelineId = pipelineByPdId.get(ps.pipeline_id);
    if (!crmPipelineId) return;
    const crmStageId = stageByPipelineAndName.get(crmPipelineId + '|' + normName(ps.name));
    if (crmStageId) {
      stageByPdId.set(ps.id, crmStageId);
      stageBackfill.push([crmStageId, ps.id]);
    }
  });

  for (const [crmId, pdId] of pipelineBackfill) {
    await conn.execute(
      'UPDATE pipelines SET pipedrive_id = :pdId WHERE id = :crmId AND pipedrive_id IS NULL',
      { pdId, crmId }
    );
  }
  for (const [crmId, pdId] of stageBackfill) {
    await conn.execute(
      'UPDATE stages SET pipedrive_id = :pdId WHERE id = :crmId AND pipedrive_id IS NULL',
      { pdId, crmId }
    );
  }

  return { pipelineByPdId, stageByPdId };
}

async function upsertPatient(conn, person) {
  if (!person || !person.value) return null;
  const pdPersonId = person.value;
  const name = (person.name && String(person.name).trim()) || 'Sem nome';
  const phone = firstContactValue(person.phone);
  const email = firstContactValue(person.email);

  const [rows] = await conn.execute(
    'SELECT id FROM patients WHERE pipedrive_person_id = :pdPersonId LIMIT 1',
    { pdPersonId }
  );

  if (rows.length) {
    const id = rows[0].id;
    await conn.execute(
      `UPDATE patients SET name = :name,
         phone = COALESCE(:phone, phone),
         email = COALESCE(:email, email)
       WHERE id = :id`,
      { name, phone, email, id }
    );
    return id;
  }

  const [res] = await conn.execute(
    `INSERT INTO patients (name, phone, email, pipedrive_person_id, created_at, updated_at)
     VALUES (:name, :phone, :email, :pdPersonId, NOW(), NOW())`,
    { name, phone, email, pdPersonId }
  );
  return res.insertId;
}

async function upsertDeal(conn, deal, patientId, pipelineId, stageId) {
  const pdId = deal.id;
  const title = (deal.title && String(deal.title).trim()) || 'Sem titulo';
  const value = Number(deal.value) || 0;
  let status = 'open';
  if (deal.status === 'won') status = 'won';
  else if (deal.status === 'lost') status = 'lost';

  const origemCode = deal[FIELD_ORIGEM] != null ? String(deal[FIELD_ORIGEM]) : null;
  const origem = origemCode ? ORIGEM_LABELS[origemCode] || null : null;
  const campanha = deal[FIELD_CAMPANHA] || null;
  const conjunto = deal[FIELD_CONJUNTO] || null;
  const palavraChave = deal[FIELD_PALAVRA_CHAVE] || null;
  const plataforma = deal[FIELD_PLATAFORMA] || null;

  const addDate = toMysqlDateTime(deal.add_time) || nowDateTime();
  const wonDate = toMysqlDateTime(deal.won_time);
  const lostDate = toMysqlDateTime(deal.lost_time);
  const ownerName = deal.owner_name || null;
  const lossReason = deal.lost_reason || null;

  const [rows] = await conn.execute('SELECT id FROM deals WHERE pipedrive_id = :pdId LIMIT 1', { pdId });

  const params = {
    patientId, pipelineId, stageId, title, value, status,
    origem, plataforma, campanha, conjunto, palavraChave,
    ownerName, addDate, wonDate, lostDate, lossReason, pdId,
  };

  if (rows.length) {
    await conn.execute(
      `UPDATE deals SET
         patient_id = :patientId,
         pipeline_id = :pipelineId,
         stage_id = :stageId,
         title = :title,
         value = :value,
         status = :status,
         origem = COALESCE(:origem, origem),
         plataforma = COALESCE(:plataforma, plataforma),
         campanha = COALESCE(:campanha, campanha),
         conjunto = COALESCE(:conjunto, conjunto),
         palavra_chave = COALESCE(:palavraChave, palavra_chave),
         owner_name = COALESCE(:ownerName, owner_name),
         won_date = COALESCE(:wonDate, won_date),
         lost_date = COALESCE(:lostDate, lost_date),
         loss_reason = COALESCE(:lossReason, loss_reason),
         sync_status = 'imported',
         sync_checked_at = NOW()
       WHERE pipedrive_id = :pdId`,
      params
    );
    return 'updated';
  }

  await conn.execute(
    `INSERT INTO deals
       (patient_id, pipeline_id, stage_id, title, value, status,
        origem, plataforma, campanha, conjunto, palavra_chave,
        owner_name, add_date, won_date, lost_date, loss_reason,
        pipedrive_id, sync_status, sync_checked_at, created_at, updated_at)
     VALUES
       (:patientId, :pipelineId, :stageId, :title, :value, :status,
        :origem, :plataforma, :campanha, :conjunto, :palavraChave,
        :ownerName, :addDate, :wonDate, :lostDate, :lossReason,
        :pdId, 'imported', NOW(), NOW(), NOW())`,
    params
  );
  return 'created';
}

/**
 * @param {object} pipedriveLocalDB - o modulo pipedriveLocalDB.js ja carregado
 *   (server.js passa `require('./pipedriveLocalDB')`), usado apenas para ler
 *   os dados ja fetchados (getDeals/getPipelines/getStages) - zero chamadas de API.
 */
async function mirrorToVCRM(pipedriveLocalDB) {
  const startedAt = Date.now();
  const stats = { total: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
  let conn;
  try {
    const pool = getPool();
    conn = await pool.getConnection();

    const deals = (pipedriveLocalDB.getDeals && pipedriveLocalDB.getDeals()) || [];
    const pdPipelines = (pipedriveLocalDB.getPipelines && pipedriveLocalDB.getPipelines()) || [];
    const pdStages = (pipedriveLocalDB.getStages && pipedriveLocalDB.getStages()) || [];
    stats.total = deals.length;

    if (!deals.length) {
      console.log('[vivera-crm-mirror] Nenhum deal em pipedriveLocalDB - nada a espelhar.');
      return stats;
    }

    const { pipelineByPdId, stageByPdId } = await buildPipelineStageMaps(conn, pdPipelines, pdStages);

    for (const deal of deals) {
      try {
        const pipelineId = pipelineByPdId.get(deal.pipeline_id);
        const stageId = stageByPdId.get(deal.stage_id);
        if (!pipelineId || !stageId) {
          stats.skipped++;
          continue;
        }
        const patientId = await upsertPatient(conn, deal.person_id);
        if (!patientId) {
          stats.skipped++;
          continue;
        }
        const result = await upsertDeal(conn, deal, patientId, pipelineId, stageId);
        if (result === 'created') stats.created++;
        else stats.updated++;
      } catch (e) {
        stats.errors++;
        console.error(`[vivera-crm-mirror] Erro no deal ${deal && deal.id}:`, e.message);
      }
    }

    const ms = Date.now() - startedAt;
    console.log(
      `[vivera-crm-mirror] Concluido em ${ms}ms - total=${stats.total} criados=${stats.created} ` +
      `atualizados=${stats.updated} pulados=${stats.skipped} erros=${stats.errors}`
    );
    return stats;
  } catch (e) {
    console.error('[vivera-crm-mirror] Falha geral ao espelhar para vivera_crm:', e.message);
    stats.errors++;
    return stats;
  } finally {
    if (conn) conn.release();
  }
}

module.exports = { mirrorToVCRM };
