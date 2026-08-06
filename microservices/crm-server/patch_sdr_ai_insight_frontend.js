const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'public', 'dashboard.html');
const backup = file + '.bak_aiinsight_' + Date.now();
let src = fs.readFileSync(file, 'utf8');
fs.writeFileSync(backup, src);

const anchorA = '<div id="sdrHourCharts" style="margin-top:24px"></div>';
const countA = src.split(anchorA).length - 1;
if (countA !== 1) { console.error('ANCHOR_A_COUNT_' + countA); process.exit(1); }
src = src.replace(anchorA, anchorA + '<div id="sdrAiInsight" style="margin-top:24px"></div>');

const anchorB = "loadSdrHourCharts(d.rows.map(function(x){ return x.name; }));";
const countB = src.split(anchorB).length - 1;
if (countB !== 1) { console.error('ANCHOR_B_COUNT_' + countB); process.exit(1); }
src = src.replace(anchorB, anchorB + "\n  loadSdrAiInsight();");

const anchorC = 'async function loadProfessionals() {';
const countC = src.split(anchorC).length - 1;
if (countC !== 1) { console.error('ANCHOR_C_COUNT_' + countC); process.exit(1); }

const newFuncs = [
  "async function loadSdrAiInsight(){",
  "  var el = document.getElementById('sdrAiInsight');",
  "  if (!el) return;",
  "  el.innerHTML = '<div class=\"card\" style=\"padding:16px;\"><p class=\"muted\">Gerando análise estratégica com IA...</p></div>';",
  "  try {",
  "    var selVal = document.getElementById('rangeSel').value;",
  "    var r = rangeDates(selVal);",
  "    var qs = 'from=' + r.from + '&to=' + r.to;",
  "    var resp = await api('/api/crm/ui/dashboard/sdrs/ai-insight?' + qs);",
  "    if (!resp || resp.success === false) {",
  "      el.innerHTML = '<div class=\"card\" style=\"padding:16px;\"><p class=\"muted\">Não foi possível gerar a análise agora.</p></div>';",
  "      return;",
  "    }",
  "    var paragraphs = String(resp.insight || '').split(/\\n+/).filter(function(p){ return p.trim().length; });",
  "    var bodyHtml = paragraphs.map(function(p){",
  "      var esc = p.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');",
  "      return '<p style=\"margin:0 0 12px;line-height:1.55;color:var(--ink-700);\">' + esc + '</p>';",
  "    }).join('');",
  "    var stats = resp.stats || {};",
  "    var an = stats.analysis || {};",
  "    var tot = an.totals || {};",
  "    var metaBits = [];",
  "    if (typeof stats.daysOfHistory === 'number') metaBits.push(stats.daysOfHistory + ' dias de histórico de WhatsApp');",
  "    if (typeof tot.conversations === 'number') metaBits.push(tot.conversations + ' conversas');",
  "    if (typeof tot.inboundMessages === 'number') metaBits.push(tot.inboundMessages + ' mensagens de leads');",
  "    var metaHtml = metaBits.length ? '<div style=\"margin-top:10px;font-size:12px;color:var(--ink-500);\">Base da análise: ' + metaBits.join(' · ') + '</div>' : '';",
  "    el.innerHTML = '<div class=\"card\" style=\"padding:20px;\">' +",
  "      '<div style=\"font-weight:600;margin-bottom:12px;\">Leitura estratégica (IA)</div>' +",
  "      bodyHtml + metaHtml +",
  "      '</div>';",
  "  } catch (e) {",
  "    console.error('loadSdrAiInsight error', e);",
  "    el.innerHTML = '<div class=\"card\" style=\"padding:16px;\"><p class=\"muted\">Erro ao carregar a análise.</p></div>';",
  "  }",
  "}",
  "",
  ""
].join('\n');

src = src.replace(anchorC, newFuncs + anchorC);

fs.writeFileSync(file, src);
console.log('OK frontend ai-insight patched, backup at ' + backup);
