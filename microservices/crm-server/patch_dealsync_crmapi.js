const fs = require('fs');
const file = 'crm-ui-api.js';
const backup = file + '.bak_dealsync_' + Date.now();
let content = fs.readFileSync(file, 'utf8');
fs.copyFileSync(file, backup);
console.log('Backup criado:', backup);

function replaceOnce(str, oldStr, newStr, label) {
  const count = str.split(oldStr).length - 1;
  if (count !== 1) {
    throw new Error('Anchor "' + label + '" encontrada ' + count + ' vezes (esperado 1)');
  }
  return str.replace(oldStr, newStr);
}

// 1) Inserir helpers logo apos ALLOWED_LIKELIHOOD
const anchor1 = "const ALLOWED_LIKELIHOOD = new Set(['quente', 'morno', 'frio']);";
const helperFn = anchor1 + "\n\n" +
"const DEAL_STAGE_SKEY_BY_EVENT_STATUS = { scheduled: 'agendamento', attended: 'comparecimento', no_show: 'nao-compareceu', cancelled: 'cancelou' };\n" +
"const AGENDA_STAGE_ID_CACHE = {};\n" +
"async function resolveInboundStageBySkey(skey) {\n" +
"  if (AGENDA_STAGE_ID_CACHE[skey]) return AGENDA_STAGE_ID_CACHE[skey];\n" +
"  const [[row]] = await pool.query('SELECT id, pipeline_id FROM stages WHERE skey = ? AND pipeline_id = 1 LIMIT 1', [skey]);\n" +
"  if (row) AGENDA_STAGE_ID_CACHE[skey] = row;\n" +
"  return row || null;\n" +
"}\n" +
"async function syncDealStageFromAgenda(dealId, eventStatus) {\n" +
"  try {\n" +
"    if (!dealId) return;\n" +
"    const targetSkey = DEAL_STAGE_SKEY_BY_EVENT_STATUS[eventStatus];\n" +
"    if (!targetSkey) return;\n" +
"    const stage = await resolveInboundStageBySkey(targetSkey);\n" +
"    if (!stage) return;\n" +
"    const [[deal]] = await pool.query('SELECT id, stage_id FROM deals WHERE id = ?', [dealId]);\n" +
"    if (!deal || deal.stage_id === stage.id) return;\n" +
"    await pool.query('UPDATE deals SET stage_id = ?, pipeline_id = ?, stage_entered_at = NOW() WHERE id = ?', [stage.id, stage.pipeline_id, dealId]);\n" +
"    try {\n" +
"      await pool.query('INSERT INTO stage_history (deal_id, from_stage_id, to_stage_id, changed_by_user_id) VALUES (?, ?, ?, NULL)', [dealId, deal.stage_id, stage.id]);\n" +
"    } catch (e2) { console.error('stage_history insert (agenda sync) error', e2); }\n" +
"    console.log('[dealsync] syncDealStageFromAgenda: deal ' + dealId + ' -> stage ' + stage.id + ' (' + targetSkey + ')');\n" +
"  } catch (e) {\n" +
"    console.error('syncDealStageFromAgenda error', e);\n" +
"  }\n" +
"}";
content = replaceOnce(content, anchor1, helperFn, 'insercao dos helpers de sync');

// 2) Chamar sync no POST apos buscar a linha recem-criada
const anchor2 = "const [[row]] = await pool.query('SELECT * FROM calendar_events WHERE id = ?', [result.insertId]);";
const new2 = anchor2 + "\n    await syncDealStageFromAgenda(row.deal_id, row.status);";
content = replaceOnce(content, anchor2, new2, 'chamada sync no POST');

// 3) Chamar sync no PATCH apos buscar a linha atualizada, somente se status mudou
const anchor3 = "const [[row]] = await pool.query('SELECT * FROM calendar_events WHERE id = ?', [id]);";
const new3 = anchor3 + "\n    if (status !== existing.status) { await syncDealStageFromAgenda(row.deal_id, status); }";
content = replaceOnce(content, anchor3, new3, 'chamada sync no PATCH');

fs.writeFileSync(file, content, 'utf8');
console.log('Patch aplicado com sucesso em', file);
