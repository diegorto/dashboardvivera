const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'public', 'dashboard.html');
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP = FILE + '.bak_insightrefazer_' + ts;

const src = fs.readFileSync(FILE, 'utf8');
fs.writeFileSync(BACKUP, src);
console.log('Backup written to', BACKUP);

const lines = src.split('\n');

function assertLine(idx, mustInclude, label) {
  const line = lines[idx];
  if (line === undefined || line.indexOf(mustInclude) === -1) {
    throw new Error('Assertion failed for ' + label + ' at line ' + (idx + 1) + '. Got: ' + JSON.stringify(line));
  }
}

assertLine(744, "var metaHtml = metaBits.length", 'metaHtml decl (745)');
assertLine(745, "el.innerHTML = '<div class=\"card\" style=\"padding:20px;\">'", 'innerHTML open (746)');
assertLine(746, 'Leitura estrat', 'header title (747)');
assertLine(747, 'bodyHtml + metaHtml', 'body concat (748)');
assertLine(748, "'</div>';", 'card close (749)');

const replacement = [
"var cacheHtml = '<div style=\"margin-top:4px;font-size:11px;color:var(--ink-400);\">' + (resp.cached ? 'Analise em cache' + (resp.generatedAt ? ' - gerada em ' + new Date(resp.generatedAt).toLocaleString('pt-BR') : '') : 'Analise gerada agora' + (resp.forced ? ' (refeita manualmente)' : '')) + '</div>';",
"el.innerHTML = '<div class=\"card\" style=\"padding:20px;\">' +",
"'<div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;\"><div style=\"font-weight:600;\">Leitura estratégica (IA)</div><button class=\"btn\" style=\"padding:4px 10px;\" onclick=\"openSdrInsightRefazerModal()\">Refazer</button></div>' +",
"bodyHtml + metaHtml + cacheHtml +",
"'</div>' +",
"'<div class=\"modal-overlay\" id=\"sdrInsightRefazerOverlay\" style=\"display:none;\">' +",
"'<div class=\"modal-box\" style=\"width:420px;max-width:92vw;\">' +",
"'<div style=\"font-weight:600;margin-bottom:12px;\">Refazer análise</div>' +",
"'<p style=\"margin:0 0 16px;color:var(--ink-700);\">Tem certeza que é necessário refazer? Isso irá consumir tokens pagos.</p>' +",
"'<div style=\"display:flex;justify-content:flex-end;gap:8px;\">' +",
"'<button class=\"btn\" onclick=\"closeSdrInsightRefazerModal()\">Não, melhor cancelar</button>' +",
"'<button class=\"btn btn-danger\" onclick=\"confirmSdrInsightRefazer()\">Sim, tenho certeza</button>' +",
"'</div>' +",
"'</div>' +",
"'</div>';"
];

const newLines = [].concat(lines.slice(0, 745), replacement, lines.slice(749));
let out = newLines.join('\n');

const anchor = 'async function loadProfessionals() {';
const parts = out.split(anchor);
if (parts.length !== 2) {
  throw new Error('Anchor for loadProfessionals not unique or not found, count=' + (parts.length - 1));
}

const jsBlock = [
"function openSdrInsightRefazerModal(){",
"  var ov = document.getElementById('sdrInsightRefazerOverlay');",
"  if (ov) ov.style.display = 'flex';",
"}",
"function closeSdrInsightRefazerModal(){",
"  var ov = document.getElementById('sdrInsightRefazerOverlay');",
"  if (ov) ov.style.display = 'none';",
"}",
"async function confirmSdrInsightRefazer(){",
"  closeSdrInsightRefazerModal();",
"  var el = document.getElementById('sdrAiInsight');",
"  if (el) el.innerHTML = '<div class=\"card\" style=\"padding:16px;\"><p class=\"muted\">Refazendo análise (consumindo tokens)...</p></div>';",
"  try {",
"    var selVal = document.getElementById('rangeSel').value;",
"    var r = rangeDates(selVal);",
"    var qs = 'from=' + r.from + '&to=' + r.to;",
"    await api('/api/crm/ui/dashboard/sdrs/ai-insight/refazer?' + qs, { method: 'POST' });",
"  } catch (e) {",
"    console.error('confirmSdrInsightRefazer error', e);",
"  }",
"  loadSdrAiInsight();",
"}",
anchor
].join('\n');

out = parts[0] + jsBlock + parts[1];

fs.writeFileSync(FILE, out);
console.log('Patched', FILE, '- old lines', lines.length);
