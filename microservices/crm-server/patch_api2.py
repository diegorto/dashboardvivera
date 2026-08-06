path = 'crm-ui-api.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "app.get('/api/crm/ui/dashboard/receita/drilldown'"
idx_start = content.index(start_marker)
idx_close = content.index('\n});\n', idx_start) + len('\n});\n')
route_block = content[idx_start:idx_close]
assert 'receita drilldown error' in route_block, 'route_block missing marker'

q_start = route_block.index('"SELECT d.id AS dealId')
q_end = route_block.index('"ORDER BY d.won_date DESC",', q_start) + len('"ORDER BY d.won_date DESC",')
old_query_exact = route_block[q_start:q_end]
print('---OLD QUERY EXACT REPR---')
print(repr(old_query_exact))

new_query_exact = old_query_exact
new_query_exact = new_query_exact.replace('d.id AS dealId', 'a.deal_id AS dealId')
new_query_exact = new_query_exact.replace('d.value AS value', 'a.amount AS value')
new_query_exact = new_query_exact.replace("CONVERT_TZ(d.won_date,", "CONVERT_TZ(a.created_at,")
new_query_exact = new_query_exact.replace('FROM deals d LEFT JOIN patients p ON p.id = d.patient_id', 'FROM activities a LEFT JOIN deals d ON d.id = a.deal_id LEFT JOIN patients p ON p.id = a.patient_id')
new_query_exact = new_query_exact.replace('WHERE d.status = ', 'WHERE a.type = ')
new_query_exact = new_query_exact.replace('won\\" AND d.won_date BETWEEN', 'Orcamento Gerado\\" AND a.created_at BETWEEN')
new_query_exact = new_query_exact.replace('ORDER BY d.won_date DESC', 'ORDER BY a.created_at DESC')

print('---NEW QUERY EXACT REPR---')
print(repr(new_query_exact))

assert old_query_exact in route_block
new_route = route_block.replace(old_query_exact, new_query_exact)
new_route = new_route.replace('/api/crm/ui/dashboard/receita/drilldown', '/api/crm/ui/dashboard/orcamento/drilldown')
new_route = new_route.replace('receita drilldown error', 'orcamento drilldown error')

content2 = content[:idx_start] + new_route + content[idx_close:]

anchor_vendas = "await pool.query('SELECT COUNT(*) AS c, COALESCE(SUM(value),0) AS receita FROM deals WHERE status = \"won\" AND won_date BETWEEN ? AND ?', [fromDt, toDt]);"
cnt = content2.count(anchor_vendas)
assert cnt == 1, 'anchor_vendas count=%d' % cnt
new_orc_query = "\n    const [[orcRow]] = await pool.query('SELECT COUNT(*) AS c, COALESCE(SUM(amount),0) AS total FROM activities WHERE type = \"Orcamento Gerado\" AND created_at BETWEEN ? AND ?', [fromDt, toDt]);"
content2 = content2.replace(anchor_vendas, anchor_vendas + new_orc_query, 1)

anchor_falt = 'const faltaram = faltRow.c;'
cnt = content2.count(anchor_falt)
assert cnt == 1, 'anchor_falt count=%d' % cnt
content2 = content2.replace(anchor_falt, anchor_falt + "\n    const orcamento = Number(orcRow.total);", 1)

anchor_json = 'leads, qualificados, vendas, receita,'
cnt = content2.count(anchor_json)
assert cnt == 1, 'anchor_json count=%d' % cnt
content2 = content2.replace(anchor_json, 'leads, qualificados, vendas, receita, orcamento,', 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content2)

print('crm-ui-api.js patched OK')
