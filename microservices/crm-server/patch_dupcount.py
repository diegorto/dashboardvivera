path = 'crm-ui-api.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

anchor = "leads, qualificados, vendas, receita, orcamento,"
assert content.count(anchor) == 1, 'anchor json count=%d' % content.count(anchor)
content = content.replace(anchor, "leads, qualificados, vendas, receita, orcamento, duplicados,", 1)

anchor2 = 'const orcamento = Number(orcRow.total);'
assert content.count(anchor2) == 1, 'anchor2 count=%d' % content.count(anchor2)
content = content.replace(anchor2, anchor2 + "\n    const [[dupRow]] = await pool.query('SELECT COUNT(*) AS c FROM deals WHERE duplicate_alert = 1 AND add_date BETWEEN ? AND ?', [fromDt, toDt]);\n    const duplicados = Number(dupRow.c);", 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('crm-ui-api.js dup patched OK')
