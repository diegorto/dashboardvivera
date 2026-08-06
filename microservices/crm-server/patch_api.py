path = 'crm-ui-api.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

anchor_vendas = '''const [[vendasRow]] = await pool.query('SELECT COUNT(*) AS c, COALESCE(SUM(value),0) AS receita FROM deals WHERE status = "won" AND won_date BETWEEN ? AND ?', [fromDt, toDt]);'''
cnt = content.count(anchor_vendas)
assert cnt == 1, 'anchor_vendas count=%d' % cnt
new_orc_query = anchor_vendas + "\n    const [[orcRow]] = await pool.query('SELECT COUNT(*) AS c, COALESCE(SUM(amount),0) AS total FROM activities WHERE type = \"Orcamento Gerado\" AND created_at BETWEEN ? AND ?', [fromDt, toDt]);"
content = content.replace(anchor_vendas, new_orc_query, 1)

anchor_falt = 'const faltaram = faltRow.c;'
cnt = content.count(anchor_falt)
assert cnt == 1, 'anchor_falt count=%d' % cnt
content = content.replace(anchor_falt, anchor_falt + "\n    const orcamento = Number(orcRow.total);", 1)

anchor_json = 'leads, qualificados, vendas, receita,'
cnt = content.count(anchor_json)
assert cnt == 1, 'anchor_json count=%d' % cnt
content = content.replace(anchor_json, 'leads, qualificados, vendas, receita, orcamento,', 1)

start_marker = "app.get('/api/crm/ui/dashboard/receita/drilldown'"
idx_start = content.index(start_marker)
idx_close = content.index('\n});\n', idx_start) + len('\n});\n')
route_block = content[idx_start:idx_close]
assert 'receita drilldown error' in route_block, 'route_block missing marker'

new_route = route_block.replace('/api/crm/ui/dashboard/receita/drilldown', '/api/crm/ui/dashboard/orcamento/drilldown')
new_route = new_route.replace('receita drilldown error', 'orcamento drilldown error')

old_query_block = r'''"SELECT d.id AS dealId, COALESCE(p.name, d.title) AS patientName, d.origem AS origem, d.owner_name AS ownerName, d.value AS value, " +
"DATE_FORMAT(CONVERT_TZ(d.won_date,'+00:00','-03:00'), '%d/%m/%Y %H:%i') AS addDateBr " +
"FROM deals d LEFT JOIN patients p ON p.id = d.patient_id " +
"WHERE d.status = \"won\" AND d.won_date BETWEEN ? AND ? " +
"ORDER BY d.won_date DESC",'''

new_query_block = r'''"SELECT a.deal_id AS dealId, COALESCE(p.name, d.title) AS patientName, d.origem AS origem, d.owner_name AS ownerName, a.amount AS value, " +
"DATE_FORMAT(CONVERT_TZ(a.created_at,'+00:00','-03:00'), '%d/%m/%Y %H:%i') AS addDateBr " +
"FROM activities a LEFT JOIN deals d ON d.id = a.deal_id LEFT JOIN patients p ON p.id = a.patient_id " +
"WHERE a.type = \"Orcamento Gerado\" AND a.created_at BETWEEN ? AND ? " +
"ORDER BY a.created_at DESC",'''

assert old_query_block in new_route, 'old_query_block not found in extracted route'
new_route = new_route.replace(old_query_block, new_query_block)

content = content[:idx_start] + new_route + content[idx_close:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('crm-ui-api.js patched OK')
