const fs = require('fs');
const file = 'server.js';
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

// 1) Inserir funcao syncAgendaFromDealStage antes da rota de stage
const anchor1 = "app.patch('/api/crm/deals/:id/stage', auth, async (req, res) => {";
const helperFn = "const AGENDA_EVENT_STATUS_BY_STAGE_SKEY = { agendamento: 'scheduled', comparecimento: 'attended', 'nao-compareceu': 'no_show', cancelou: 'cancelled' };\n" +
"async function syncAgendaFromDealStage(pool, dealId, stageSkey) {\n" +
"  try {\n" +
"    const targetStatus = AGENDA_EVENT_STATUS_BY_STAGE_SKEY[stageSkey];\n" +
"    if (!targetStatus || !dealId) return;\n" +
"    const [[event]] = await pool.query('SELECT id, status FROM calendar_events WHERE deal_id = ? ORDER BY id DESC LIMIT 1', [dealId]);\n" +
"    if (!event || event.status === targetStatus) return;\n" +
"    await pool.query('UPDATE calendar_events SET status = ? WHERE id = ?', [targetStatus, event.id]);\n" +
"    console.log('[dealsync] syncAgendaFromDealStage: deal ' + dealId + ' -> evento ' + event.id + ' status ' + targetStatus);\n" +
"  } catch (e) {\n" +
"    console.error('syncAgendaFromDealStage error', e);\n" +
"  }\n" +
"}\n\n";
content = replaceOnce(content, anchor1, helperFn + anchor1, 'insercao da funcao syncAgendaFromDealStage');

// 2) Adicionar skey ao SELECT de stage na rota unica de mudanca de estagio
const anchor2 = "const [[stage]] = await conn.query('SELECT id, label, pipeline_id FROM stages WHERE id = ?', [stageId])";
const new2 = "const [[stage]] = await conn.query('SELECT id, label, pipeline_id, skey FROM stages WHERE id = ?', [stageId])";
content = replaceOnce(content, anchor2, new2, 'select skey rota unica');

// 3) Chamar sync apos o UPDATE deals na rota unica
const anchor3 = "await conn.query('UPDATE deals SET stage_id = ?, pipeline_id = ?, stage_entered_at = NOW() WHERE id = ?', [stageId, stage.pipeline_id, dealId])";
const new3 = anchor3 + "\n    if (stage.pipeline_id === 1) { await syncAgendaFromDealStage(pool, dealId, stage.skey); }";
content = replaceOnce(content, anchor3, new3, 'chamada sync rota unica');

// 4) Adicionar skey aos SELECTs de stage no applyBulkDealChange
const anchor4 = "const [[st]] = await conn.query('SELECT id, label, pipeline_id FROM stages WHERE pipeline_id = ? AND active = 1 ORDER BY sort LIMIT 1', [pl.id])";
const new4 = "const [[st]] = await conn.query('SELECT id, label, pipeline_id, skey FROM stages WHERE pipeline_id = ? AND active = 1 ORDER BY sort LIMIT 1', [pl.id])";
content = replaceOnce(content, anchor4, new4, 'select skey bulk pipeline');

const anchor5 = "const [[st]] = await conn.query('SELECT id, label, pipeline_id FROM stages WHERE id = ? AND active = 1', [value])";
const new5 = "const [[st]] = await conn.query('SELECT id, label, pipeline_id, skey FROM stages WHERE id = ? AND active = 1', [value])";
content = replaceOnce(content, anchor5, new5, 'select skey bulk stage');

// 5) Chamar sync apos o INSERT INTO activities no loop de mudanca de estagio em massa
const anchor6 = "await conn.query('INSERT INTO activities (deal_id, patient_id, user_id, type, content) VALUES (?, ?, ?, ?, ?)', [d.id, d.patient_id, reqUser.id, 'stage_change', lbl])";
const new6 = anchor6 + "\n      if (newStage.pipeline_id === 1) { await syncAgendaFromDealStage(pool, d.id, newStage.skey); }";
content = replaceOnce(content, anchor6, new6, 'chamada sync bulk');

fs.writeFileSync(file, content, 'utf8');
console.log('Patch aplicado com sucesso em', file);
