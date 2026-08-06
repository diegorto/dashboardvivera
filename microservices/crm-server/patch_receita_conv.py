path = 'public/dashboard.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_suffix = '<div class="lbl">Receita</div><div class="val">${fmtMoney(d.receita)}</div></div>'
new_suffix = '<div class="lbl">Receita</div><div class="val">${fmtMoney(d.receita)}</div><div class="sub">${d.orcamento ? fmtPct(d.receita / d.orcamento * 100) : (window.__nbsp||"-")} do orcado</div></div>'

assert content.count(old_suffix) == 1, 'old_suffix count=%d' % content.count(old_suffix)
content = content.replace(old_suffix, new_suffix, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('receita conv patched OK')
