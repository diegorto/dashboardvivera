const fs = require('fs');
const file = 'server.js';
let src = fs.readFileSync(file, 'utf8');

const anchor = 'app.listen(PORT';
const count = src.split(anchor).length - 1;
if (count !== 1) { console.error('ANCHOR_NOT_UNIQUE', count); process.exit(1); }

const block = [
"app.get('/api/crm/google-calendar/sync-now', auth, async (req, res) => {",
'  try {',
'    const results = await gcal.pollAllUsers();',
'    res.json({ success: true, results: results });',
'  } catch (e) {',
"    console.error('gcal sync-now error', e);",
"    res.status(500).json({ success: false, error: 'Erro interno' });",
'  }',
'});',
'',
'const GCAL_POLL_INTERVAL_MS = 5 * 60 * 1000;',
'setInterval(function() {',
'  gcal.pollAllUsers().then(function(results) {',
"    var withChanges = results.filter(function(r){ return r && ((r.created||0)+(r.updated||0)+(r.cancelled||0) > 0); });",
'    if (withChanges.length) { console.log(\'[gcal-poll]\', JSON.stringify(results)); }',
'  }).catch(function(e) {',
"    console.error('gcal poll interval error', e);",
'  });',
'}, GCAL_POLL_INTERVAL_MS);',
''
].join('\n');

src = src.replace(anchor, block + '\n' + anchor);
fs.writeFileSync(file, src);
console.log('POLL_ROUTE_PATCH_OK');
