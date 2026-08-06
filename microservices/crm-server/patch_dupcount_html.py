path = 'public/dashboard.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = '<div class="sub">${fmtPct(d.taxaQualif)} taxa de qualif.</div></div>'
assert content.count(old) == 1, 'old count=%d' % content.count(old)
new = '<div class="sub">${fmtPct(d.taxaQualif)} taxa de qualif.</div><div class="sub">${d.duplicados||0} duplicado(s)</div></div>'
content = content.replace(old, new, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('dashboard.html dup patched OK')
