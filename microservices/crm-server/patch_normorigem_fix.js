const fs = require('fs');
const p = 'public/dashboard.html';
let src = fs.readFileSync(p, 'utf8');

const funcAnchor = 'function openVendasDrilldown(from, to){';
if (src.split(funcAnchor).length - 1 !== 1) { console.error('FUNC_ANCHOR_NOT_UNIQUE'); process.exit(1); }
const helper = "function normOrigem(s){ return String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim().toLowerCase(); }\n";
src = src.replace(funcAnchor, helper + funcAnchor);

const a1 = "      var key = row.origem || 'Sem origem';\n";
if (src.split(a1).length - 1 !== 1) { console.error('A1_NOT_UNIQUE', src.split(a1).length - 1); process.exit(1); }
src = src.replace(a1, "      var key = normOrigem(row.origem || 'Sem origem');\n");

const a2 = "      var list = byOrigem[origem] || [];\n";
if (src.split(a2).length - 1 !== 1) { console.error('A2_NOT_UNIQUE', src.split(a2).length - 1); process.exit(1); }
src = src.replace(a2, "      var list = byOrigem[normOrigem(origem)] || [];\n");

fs.writeFileSync(p, src);
console.log('OK normOrigem fix applied');
