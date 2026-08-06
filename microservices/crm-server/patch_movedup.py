path = 'public/dashboard.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

dup_sub = '<div class="sub">${d.duplicados||0} duplicado(s)</div>'
assert content.count(dup_sub) == 1, 'dup_sub count=%d' % content.count(dup_sub)
content = content.replace(dup_sub, '', 1)

leads_val = '<div class="lbl">Leads</div><div class="val">${d.leads}</div>'
assert content.count(leads_val) == 1, 'leads_val count=%d' % content.count(leads_val)
content = content.replace(leads_val, '<div class="lbl">Leads</div><div class="val">${d.leads}</div>' + dup_sub, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('moved duplicados to Leads card OK')
