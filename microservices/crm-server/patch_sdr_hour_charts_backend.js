const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'crm-ui-api.js');
const backup = file + '.bak_sdrhourcharts_' + Date.now();
let src = fs.readFileSync(file, 'utf8');
fs.writeFileSync(backup, src);

const newRoutes = [
  '',
  "// ---- Patch: graficos de horario SDR (WhatsApp + ligacoes atendidas) ----",
  "app.get('/api/crm/ui/dashboard/sdrs/whatsapp-hours', auth, async (req, res) => {",
  "  try {",
  "    const from = req.query.from || brTodayStr();",
  "    const to = req.query.to || brTodayStr();",
  "    const { fromDt, toDt } = brRangeToUtc(from, to);",
  "    const [rows] = await pool.query(",
  "      \"SELECT COALESCE(d.owner_name,'Sem SDR') AS ownerName, HOUR(DATE_SUB(wm.created_at, INTERVAL 3 HOUR)) AS hourBr, COUNT(*) AS cnt \" +",
  "      \"FROM whatsapp_messages wm \" +",
  "      \"JOIN whatsapp_conversations wc ON wc.id = wm.conversation_id \" +",
  "      \"LEFT JOIN deals d ON d.id = wc.deal_id \" +",
  "      \"WHERE wm.direction = 'in' AND wm.created_at BETWEEN ? AND ? \" +",
  "      \"GROUP BY ownerName, hourBr\",",
  "      [fromDt, toDt]",
  "    );",
  "    res.json({ success: true, rows });",
  "  } catch (e) {",
  "    console.error('sdrs whatsapp-hours error', e.message);",
  "    res.status(500).json({ success: false, error: e.message });",
  "  }",
  "});",
  "",
  "app.get('/api/crm/ui/dashboard/sdrs/calls-hours', auth, async (req, res) => {",
  "  try {",
  "    const from = req.query.from || brTodayStr();",
  "    const to = req.query.to || brTodayStr();",
  "    const { fromDt, toDt } = brRangeToUtc(from, to);",
  "    const [rows] = await pool.query(",
  "      \"SELECT COALESCE(a.user_name,'Sem SDR') AS ownerName, HOUR(DATE_SUB(a.created_at, INTERVAL 3 HOUR)) AS hourBr, COUNT(*) AS cnt \" +",
  "      \"FROM activities a \" +",
  "      \"WHERE a.type = 'Ligação Atendida' AND a.created_at BETWEEN ? AND ? \" +",
  "      \"GROUP BY ownerName, hourBr\",",
  "      [fromDt, toDt]",
  "    );",
  "    res.json({ success: true, rows });",
  "  } catch (e) {",
  "    console.error('sdrs calls-hours error', e.message);",
  "    res.status(500).json({ success: false, error: e.message });",
  "  }",
  "});",
  ""
].join('\n');

const marker = /\n\};\s*$/;
if (!marker.test(src)) {
  console.error('MARKER_NOT_FOUND');
  process.exit(1);
}
src = src.replace(marker, '\n' + newRoutes + '\n};\n');
fs.writeFileSync(file, src);
console.log('OK backend patched, backup at ' + backup);
