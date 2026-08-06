const fs = require('fs');
const p = 'public/dashboard.html';
let src = fs.readFileSync(p, 'utf8');

const cardAnchor = '<div class="kpi-card"><div class="lbl">Vendas</div><div class="val">${d.vendas}</div></div>';
const cardCount = src.split(cardAnchor).length - 1;
if (cardCount !== 1) { console.error('CARD_ANCHOR_NOT_UNIQUE', cardCount); process.exit(1); }
const cardReplacement = '<div class="kpi-card" style="cursor:pointer" onclick="openVendasDrilldown(\'${from}\',\'${to}\')"><div class="lbl">Vendas</div><div class="val">${d.vendas}</div></div>';
src = src.replace(cardAnchor, cardReplacement);

const modalAnchor = '<div class="modal-overlay" id="mktPagoDrilldownOverlay" style="display:none;">';
const modalCount = src.split(modalAnchor).length - 1;
if (modalCount !== 1) { console.error('MODAL_ANCHOR_NOT_UNIQUE', modalCount); process.exit(1); }

const modalBlock = "\n" +
'<div class="modal-overlay" id="vendasDrilldownOverlay" style="display:none;">\n' +
'  <div class="modal-box" style="width:640px;max-width:92vw;">\n' +
'    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;"><h2 style="margin:0;" id="vddTitle">Vendas por Origem</h2><button class="btn" style="padding:4px 10px;" onclick="closeVendasDrilldown()">Fechar</button></div>\n' +
'    <div id="vddSummary" style="font-size:13px;color:#666;margin-bottom:10px;"></div>\n' +
'    <div id="vddList" style="max-height:420px;overflow-y:auto;"></div>\n' +
'  </div>\n' +
'</div>\n' +
'<script>\n' +
'function openVendasDrilldown(from, to){\n' +
"  document.getElementById('vendasDrilldownOverlay').style.display = 'flex';\n" +
'  loadVendasDrilldown(from, to);\n' +
'}\n' +
'function closeVendasDrilldown(){\n' +
"  document.getElementById('vendasDrilldownOverlay').style.display = 'none';\n" +
'}\n' +
'async function loadVendasDrilldown(from, to){\n' +
"  var summaryEl = document.getElementById('vddSummary');\n" +
"  var listEl = document.getElementById('vddList');\n" +
"  summaryEl.textContent = 'Carregando...';\n" +
"  listEl.innerHTML = '';\n" +
'  try {\n' +
"    var url = '/api/crm/ui/dashboard/executive/vendas-drilldown?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);\n" +
'    var d = await api(url);\n' +
"    if (!d || d.success === false) throw new Error((d && d.error) || 'erro');\n" +
'    var groups = d.groups || [];\n' +
'    var rows = d.rows || [];\n' +
"    if (!rows.length) { summaryEl.innerHTML = ''; listEl.innerHTML = '<p class=\"muted\">Nenhuma venda no periodo.</p>'; return; }\n" +
"    var totalVendas = groups.reduce(function(s,g){ return s + Number(g.vendas||0); }, 0);\n" +
"    var totalReceita = groups.reduce(function(s,g){ return s + Number(g.receita||0); }, 0);\n" +
"    var groupRows = groups.map(function(g){ return [g.origem, String(g.vendas), fmtMoney(g.receita)]; });\n" +
"    groupRows.push(['Total', String(totalVendas), fmtMoney(totalReceita)]);\n" +
"    summaryEl.innerHTML = tableHtml(['Origem','Vendas','Valor'], groupRows);\n" +
'    var byOrigem = {};\n' +
'    rows.forEach(function(row){\n' +
"      var key = row.origem || 'Sem origem';\n" +
'      (byOrigem[key] = byOrigem[key] || []).push(row);\n' +
'    });\n' +
"    var order = groups.map(function(g){ return g.origem; });\n" +
'    listEl.innerHTML = order.map(function(origem){\n' +
'      var list = byOrigem[origem] || [];\n' +
'      var itemsHtml = list.map(function(row){\n' +
"        var when = row.date ? new Date(row.date).toLocaleString('pt-BR') : '-';\n" +
"        return '<div style=\"padding:8px 0;border-bottom:1px solid #f3f4f6;\">' +\n" +
"          '<div style=\"font-weight:600;\">' + (row.title || ('Deal #' + row.dealId)) + '</div>' +\n" +
"          '<div style=\"font-size:12px;color:#6b7280;\">' + when + (row.value ? ' - ' + fmtMoney(row.value) : '') + '</div>' +\n" +
"          '</div>';\n" +
'      }).join(\'\');\n' +
"      return '<h3 style=\"margin:16px 0 6px;font-size:14px;\">' + origem + ' (' + list.length + ')</h3>' + itemsHtml;\n" +
"    }).join('');\n" +
'  } catch (e) {\n' +
"    summaryEl.textContent = 'Erro ao carregar.';\n" +
'  }\n' +
'}\n' +
'</script>\n';

src = src.replace(modalAnchor, modalBlock + modalAnchor);
fs.writeFileSync(p, src);
console.log('OK patched public/dashboard.html');
