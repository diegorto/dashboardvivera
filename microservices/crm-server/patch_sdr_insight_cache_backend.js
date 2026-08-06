const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'crm-ui-api.js');
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP = FILE + '.bak_insightcache_' + ts;

const src = fs.readFileSync(FILE, 'utf8');
fs.writeFileSync(BACKUP, src);
console.log('Backup written to', BACKUP);

const lines = src.split('\n');

function assertLine(idx, mustInclude, label) {
  const line = lines[idx];
  if (line === undefined || line.indexOf(mustInclude) === -1) {
    throw new Error('Assertion failed for ' + label + ' at line ' + (idx + 1) + '. Got: ' + JSON.stringify(line));
  }
}

assertLine(2506, 'const __aiInsightCache = {}', 'old cache decl (2507)');
assertLine(2507, "app.get('/api/crm/ui/dashboard/sdrs/ai-insight', auth, async (req, res) => {", 'old route sig (2508)');
assertLine(2508, 'try {', 'try open (2509)');
assertLine(2509, 'req.query.from', 'from decl (2510)');
assertLine(2510, 'req.query.to', 'to decl (2511)');
assertLine(2511, 'cacheKey', 'cacheKey decl (2512)');
assertLine(2512, '__aiInsightCache[cacheKey]', 'cached decl (2513)');
assertLine(2513, 'if (cached', 'if cached (2514)');
assertLine(2514, 'insight: cached.insight, cached: true', 'old cache return (2515)');
assertLine(2516, 'fromDt, toDt } = brRangeToUtc(from, to)', 'fromDt/toDt decl (2517)');
assertLine(2590, '__aiInsightCache[cacheKey] = { insight: insightText', 'old cache write (2591)');
assertLine(2591, 'res.json({ success: true, insight: insightText, cached: false, stats:', 'old final response (2592)');
assertLine(2592, 'catch (e)', 'catch open (2593)');
assertLine(2596, '});', 'route close (2597)');

const blockA = [
"async function getSdrInsightCache(periodKey) {",
"  const [rows] = await pool.query('SELECT insight_text, stats_json, generated_at FROM sdr_insight_cache WHERE period_key = ? LIMIT 1', [periodKey]);",
"  return (rows && rows[0]) ? rows[0] : null;",
"}",
"async function upsertSdrInsightCache(periodKey, from, to, insightText, statsObj) {",
"  await pool.query(",
"    'INSERT INTO sdr_insight_cache (period_key, period_from, period_to, insight_text, stats_json, generated_at) VALUES (?, ?, ?, ?, ?, NOW()) ' +",
"    'ON DUPLICATE KEY UPDATE insight_text = VALUES(insight_text), stats_json = VALUES(stats_json), generated_at = NOW()',",
"    [periodKey, from, to, insightText, JSON.stringify(statsObj || {})]",
"  );",
"}",
"function brDateStrFromDate(d) {",
"  return new Date(new Date(d).getTime() - BR_OFFSET_MS).toISOString().slice(0,10);",
"}",
"app.get('/api/crm/ui/dashboard/sdrs/ai-insight', auth, function(req, res) { return runAiInsight(req, res, false); });",
"app.post('/api/crm/ui/dashboard/sdrs/ai-insight/refazer', auth, function(req, res) { return runAiInsight(req, res, true); });",
"async function runAiInsight(req, res, forceRefresh) {"
];

const blockB = [
"const from = req.query.from || brTodayStr();",
"const to = req.query.to || brTodayStr();",
"const periodKey = from + '|' + to;",
"const todayBr = brTodayStr();",
"const periodFinished = to < todayBr;",
"if (!forceRefresh) {",
"  const cachedRow = await getSdrInsightCache(periodKey);",
"  if (cachedRow) {",
"    const generatedDateBr = brDateStrFromDate(cachedRow.generated_at);",
"    const sameDay = generatedDateBr === todayBr;",
"    if (periodFinished || sameDay) {",
"      var cachedStats;",
"      try { cachedStats = cachedRow.stats_json ? JSON.parse(cachedRow.stats_json) : undefined; } catch (parseErr) { cachedStats = undefined; }",
"      return res.json({ success: true, insight: cachedRow.insight_text, cached: true, generatedAt: cachedRow.generated_at, stats: cachedStats });",
"    }",
"  }",
"}"
];

const blockC = [
"const statsObj = { analysis: analysis, topInboundHours: topInboundHours, topCallHours: topCallHours, daysOfHistory: daysOfHistory };",
"await upsertSdrInsightCache(periodKey, from, to, insightText, statsObj);",
"res.json({ success: true, insight: insightText, cached: false, forced: !!forceRefresh, stats: statsObj });"
];

const before1 = lines.slice(0, 2506);
const middle1 = lines.slice(2508, 2509);
const middle2 = lines.slice(2516, 2590);
const middle3 = lines.slice(2592, 2596);
const after = lines.slice(2597);

const newLines = [].concat(before1, blockA, middle1, blockB, middle2, blockC, middle3, ['}'], after);

fs.writeFileSync(FILE, newLines.join('\n'));
console.log('Patched', FILE, '- old lines', lines.length, 'new lines', newLines.length);
