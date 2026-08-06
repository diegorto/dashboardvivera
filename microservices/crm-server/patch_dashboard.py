path = 'public/dashboard.html'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.read().split('\n')

grid_idx = None
for i, l in enumerate(lines):
    if l.strip() == '<div class="kpi-grid">':
        grid_idx = i
        break
assert grid_idx is not None, 'kpi-grid not found'

card_lines = lines[grid_idx+1:grid_idx+9]
assert len(card_lines) == 8, 'expected 8 card lines got %d' % len(card_lines)
labels_expected = ['Leads', 'Qualificados', 'Vendas', 'Receita', 'Ticket Medio', 'Consultas Agendadas', 'Consultas Comparecidas', 'Faltaram no Periodo']
for cl, lab in zip(card_lines, labels_expected):
    assert ('>' + lab + '<') in cl, 'label mismatch: expected %s in %r' % (lab, cl)

leads_l, qualif_l, vendas_l, receita_l, ticket_l, agend_l, compar_l, falt_l = card_lines

old_ticket_open = '<div class="kpi-card">'
assert old_ticket_open in ticket_l
new_ticket_l = ticket_l.replace(old_ticket_open, '<div class="kpi-card" style="cursor:pointer" onclick="openTicketMedioDrilldown(\'${from}\',\'${to}\')">', 1)

indent = leads_l[:len(leads_l) - len(leads_l.lstrip())]
orcamento_l = indent + '<div class="kpi-card" style="cursor:pointer" onclick="openOrcamentoDrilldown(\'${from}\',\'${to}\')"><div class="lbl">Orcamento</div><div class="val">${fmtMoney(d.orcamento)}</div></div>'

new_card_lines = [leads_l, qualif_l, agend_l, compar_l, orcamento_l, vendas_l, receita_l, new_ticket_l]
lines[grid_idx+1:grid_idx+9] = new_card_lines

chart_idx = None
for i, l in enumerate(lines):
    if 'id="leadsChart"' in l:
        chart_idx = i
        break
assert chart_idx is not None, 'chart div not found'
assert lines[chart_idx+1].strip() == '</div>', 'unexpected line after chart: %r' % lines[chart_idx+1]

falt_section = [
    '<div class="card">',
    '<h3 style="margin-top:0;">Faltaram no Periodo</h3>',
    falt_l.strip(),
    '</div>'
]
insert_at = chart_idx + 2
lines[insert_at:insert_at] = falt_section

content = '\n'.join(lines)

anchor = 'var agendadasDrilldownState = { from: null, to: null };'
assert content.count(anchor) == 1, 'anchor count=%d' % content.count(anchor)

new_funcs = '''var orcamentoDrilldownState = { from: null, to: null };
function openOrcamentoDrilldown(from, to){
orcamentoDrilldownState = { from: from, to: to };
document.getElementById('sddTitle').textContent = 'Orcamento - ' + from + ' a ' + to;
document.getElementById('sdrDrilldownOverlay').style.display = 'flex';
loadOrcamentoDrilldown();
}
async function loadOrcamentoDrilldown(){
var summaryEl = document.getElementById('sddSummary');
var listEl = document.getElementById('sddList');
summaryEl.textContent = 'Carregando...';
listEl.innerHTML = '';
try {
var url = '/api/crm/ui/dashboard/orcamento/drilldown?from=' + encodeURIComponent(orcamentoDrilldownState.from) + '&to=' + encodeURIComponent(orcamentoDrilldownState.to);
var d = await api(url);
if (!d || d.success === false) throw new Error((d && d.error) || 'erro');
var totalValue = d.rows.reduce(function(s,r){ return s + Number(r.value||0); }, 0);
summaryEl.textContent = d.rows.length + ' orcamento(s) - ' + fmtMoney(totalValue);
if (!d.rows.length) {
listEl.innerHTML = '<p class="muted">Nenhum orcamento gerado no periodo.</p>';
} else {
listEl.innerHTML = d.rows.map(function(row){
return '<div style="padding:9px 4px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">' +
'<div><a href="detail.html?id=' + row.dealId + '" target="_blank" style="color:#4f46e5;text-decoration:none;font-weight:600;">' + (row.patientName||'Sem nome') + '</a><br><span style="color:#888;font-size:12px;">' + (row.origem||'Sem origem') + ' &middot; ' + (row.ownerName||'Sem SDR') + '</span></div>' +
'<div style="text-align:right;font-size:12px;color:#666;">' + fmtMoney(row.value) + '<br>' + (row.addDateBr||'') + '</div>' +
'</div>';
}).join('');
}
} catch (e) {
summaryEl.textContent = 'Erro ao carregar.';
}
}
function openTicketMedioDrilldown(from, to){
receitaDrilldownState = { from: from, to: to };
document.getElementById('sddTitle').textContent = 'Ticket Medio - ' + from + ' a ' + to;
document.getElementById('sdrDrilldownOverlay').style.display = 'flex';
loadReceitaDrilldown();
}
''' + anchor

content = content.replace(anchor, new_funcs, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('dashboard.html patched OK')
