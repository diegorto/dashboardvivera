const fs = require('fs');
const p = 'crm-ui-api.js';
let src = fs.readFileSync(p, 'utf8');

const a1 = "'GROUP BY origem ORDER BY receita DESC',";
if (src.split(a1).length - 1 !== 1) { console.error('A1_NOT_UNIQUE'); process.exit(1); }
src = src.replace(a1, "'GROUP BY 1 ORDER BY receita DESC',");

const a2 = "'ORDER BY origem ASC, d.won_date DESC',";
if (src.split(a2).length - 1 !== 1) { console.error('A2_NOT_UNIQUE'); process.exit(1); }
src = src.replace(a2, "'ORDER BY 3 ASC, d.won_date DESC',");

fs.writeFileSync(p, src);
console.log('OK groupby fix applied');
