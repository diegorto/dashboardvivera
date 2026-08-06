const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'public', 'dashboard.html');
const backup = file + '.bak_sdrhourcharts_' + Date.now();
let src = fs.readFileSync(file, 'utf8');
fs.writeFileSync(backup, src);

const anchorA = 'id="sdrHojeWidget"><p class="muted">Carregando quadro Hoje...</p></div>';
const countA = src.split(anchorA).length - 1;
if (countA !== 1) { console.error('ANCHOR_A_COUNT_' + countA); process.exit(1); }
src = src.replace(anchorA, anchorA + '<div id="sdrHourCharts" style="margin-top:24px"></div>');

const anchorB = 'loadSdrHojeWidget();';
const countB = src.split(anchorB).length - 1;
if (countB !== 1) { console.error('ANCHOR_B_COUNT_' + countB); process.exit(1); }
src = src.replace(anchorB, "loadSdrHojeWidget();\n  loadSdrHourCharts(d.rows.map(function(x){ return x.name; }));");

const anchorC = 'async function loadProfessionals() {';
const countC = src.split(anchorC).length - 1;
if (countC !== 1) { console.error('ANCHOR_C_COUNT_' + countC); process.exit(1); }

const newFuncs = [
  "function renderHourBarChart(title, hoursArr, color){",
  "  var max = 1;",
  "  for (var i=0;i<24;i++){ if ((hoursArr[i]||0) > max) max = hoursArr[i]; }",
  "  var bars = '';",
  "  for (var h=0; h<24; h++){",
  "    var v = hoursArr[h] || 0;",
  "    var pct = Math.round((v/max)*100);",
  "    var barH = Math.max(2, Math.round(pct*0.9));",
  "    bars += '<div style=\"flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;height:100%;\">' +",
  "      '<div title=\"' + h + 'h: ' + v + '\" style=\"width:100%;max-width:14px;height:' + barH + 'px;background:' + color + ';border-radius:3px 3px 0 0;\"></div>' +",
  "      '<div style=\"font-size:9px;color:var(--ink-500);\">' + (h % 3 === 0 ? h : '') + '</div>' +",
  "      '</div>';",
  "  }",
  "  return '<div class=\"card\" style=\"padding:16px;margin-bottom:16px;\">' +",
  "    '<div style=\"font-weight:600;margin-bottom:10px;\">' + title + '</div>' +",
  "    '<div style=\"display:flex;align-items:flex-end;gap:2px;height:120px;\">' + bars + '</div>' +",
  "    '</div>';",
  "}",
  "",
  "function buildHourMap(rows, sdrNames){",
  "  var byOwner = {};",
  "  (sdrNames||[]).forEach(function(name){ byOwner[name] = new Array(24).fill(0); });",
  "  var total = new Array(24).fill(0);",
  "  (rows||[]).forEach(function(row){",
  "    var owner = row.ownerName || 'Sem SDR';",
  "    if (!byOwner[owner]) byOwner[owner] = new Array(24).fill(0);",
  "    var h = Number(row.hourBr);",
  "    var c = Number(row.cnt) || 0;",
  "    byOwner[owner][h] = (byOwner[owner][h] || 0) + c;",
  "    total[h] += c;",
  "  });",
  "  return { byOwner: byOwner, total: total };",
  "}",
  "",
  "async function loadSdrHourCharts(sdrNames){",
  "  var el = document.getElementById('sdrHourCharts');",
  "  if (!el) return;",
  "  el.innerHTML = '<p class=\"muted\">Carregando graficos de horario...</p>';",
  "  try {",
  "    var selVal = document.getElementById('rangeSel').value;",
  "    var r = rangeDates(selVal);",
  "    var qs = 'from=' + r.from + '&to=' + r.to;",
  "    var wa = await api('/api/crm/ui/dashboard/sdrs/whatsapp-hours?' + qs);",
  "    var calls = await api('/api/crm/ui/dashboard/sdrs/calls-hours?' + qs);",
  "    var waData = buildHourMap(wa && wa.rows, sdrNames);",
  "    var callData = buildHourMap(calls && calls.rows, sdrNames);",
  "    var html = '<h3 style=\"margin:24px 0 8px;\">Horarios em que os leads mais respondem no WhatsApp</h3>';",
  "    Object.keys(waData.byOwner).forEach(function(owner){",
  "      html += renderHourBarChart(owner, waData.byOwner[owner], '#4f46e5');",
  "    });",
  "    html += renderHourBarChart('Total da clinica (todas as SDRs)', waData.total, '#0ea5e9');",
  "    html += '<h3 style=\"margin:24px 0 8px;\">Horarios em que mais atendem ligacoes</h3>';",
  "    Object.keys(callData.byOwner).forEach(function(owner){",
  "      html += renderHourBarChart(owner, callData.byOwner[owner], '#10b981');",
  "    });",
  "    html += renderHourBarChart('Total da clinica (todas as SDRs)', callData.total, '#f59e0b');",
  "    el.innerHTML = html;",
  "  } catch (e) {",
  "    console.error('loadSdrHourCharts error', e);",
  "    el.innerHTML = '<p class=\"muted\">Erro ao carregar graficos de horario.</p>';",
  "  }",
  "}",
  "",
  ""
].join('\n');

src = src.replace(anchorC, newFuncs + anchorC);

fs.writeFileSync(file, src);
console.log('OK frontend patched, backup at ' + backup);
