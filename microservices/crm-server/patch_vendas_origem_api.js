const fs = require('fs');
const p = 'crm-ui-api.js';
let src = fs.readFileSync(p, 'utf8');
const anchor = "app.get('/api/crm/ui/dashboard/executive-extra', auth, async (req, res) => {";
const count = src.split(anchor).length - 1;
if (count !== 1) { console.error('ANCHOR_NOT_UNIQUE', count); process.exit(1); }
const insert = "\napp.get('/api/crm/ui/dashboard/executive/vendas-drilldown', auth, async (req, res) => {\n" +
"  try {\n" +
"    const now = new Date();\n" +
"    const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);\n" +
"    const to = req.query.to || new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);\n" +
"    const { fromDt, toDt } = brRangeToUtc(from, to);\n" +
"    const fonteExpr = 'COALESCE(NULLIF(CASE WHEN d.origem IN (\"Organico\",\"Org\\u00e2nico\",\"Instagram Org\\u00e2nico\") THEN \"Org\\u00e2nico\" WHEN d.origem IN (\"Facebook\",\"Facebook Ads\",\"Meta\",\"Meta Ads\") THEN \"Instagram\" ELSE d.origem END,\"\"),\"Sem origem\")';\n" +
"    const [groups] = await pool.query(\n" +
"      'SELECT ' + fonteExpr + ' AS origem, COUNT(*) AS vendas, COALESCE(SUM(d.value),0) AS receita ' +\n" +
"      'FROM deals d WHERE d.status = \"won\" AND d.won_date BETWEEN ? AND ? ' +\n" +
"      'GROUP BY origem ORDER BY receita DESC',\n" +
"      [fromDt, toDt]\n" +
"    );\n" +
"    const [rows] = await pool.query(\n" +
"      'SELECT d.id AS dealId, COALESCE(p.name, d.title) AS title, ' + fonteExpr + ' AS origem, d.value AS value, d.won_date AS date ' +\n" +
"      'FROM deals d LEFT JOIN patients p ON p.id = d.patient_id ' +\n" +
"      'WHERE d.status = \"won\" AND d.won_date BETWEEN ? AND ? ' +\n" +
"      'ORDER BY origem ASC, d.won_date DESC',\n" +
"      [fromDt, toDt]\n" +
"    );\n" +
"    res.json({ success: true, from, to, groups, rows });\n" +
"  } catch (e) {\n" +
"    console.error('executive vendas drilldown error', e);\n" +
"    res.status(500).json({ success: false, error: 'Erro interno' });\n" +
"  }\n" +
"});\n\n";
src = src.replace(anchor, insert + anchor);
fs.writeFileSync(p, src);
console.log('OK patched crm-ui-api.js');
