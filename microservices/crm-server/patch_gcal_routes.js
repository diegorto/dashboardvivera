const fs = require('fs');
const file = 'server.js';
let src = fs.readFileSync(file, 'utf8');

const anchor1 = "require('dotenv').config()";
const count1 = src.split(anchor1).length - 1;
if (count1 !== 1) { console.error('ANCHOR1_NOT_UNIQUE', count1); process.exit(1); }
const insert1 = anchor1 + "\nrequire('dotenv').config({ path: require('path').join(__dirname, '.env.google-calendar') });\nconst gcal = require('./google-calendar-service');";
src = src.replace(anchor1, insert1);

const anchor2 = 'app.listen(PORT';
const count2 = src.split(anchor2).length - 1;
if (count2 !== 1) { console.error('ANCHOR2_NOT_UNIQUE', count2); process.exit(1); }

const routesBlock = [
'// ---------------- GOOGLE CALENDAR OAUTH ----------------',
'',
"app.get('/api/crm/google-calendar/auth-url', auth, (req, res) => {",
'  try {',
"    const state = jwt.sign({ uid: req.user.id, purpose: 'gcal_connect' }, JWT_SECRET, { expiresIn: '15m' });",
'    res.json({ success: true, url: gcal.buildAuthUrl(state) });',
'  } catch (e) {',
"    console.error('gcal auth-url error', e);",
"    res.status(500).json({ success: false, error: 'Erro interno' });",
'  }',
'});',
'',
"app.get('/api/crm/google-calendar/callback', async (req, res) => {",
'  try {',
'    const { code, state, error } = req.query;',
"    if (error) return res.redirect('/agenda-visual.html?google_connected=0&reason=' + encodeURIComponent(error));",
"    if (!code || !state) return res.status(400).send('Faltando code ou state');",
'    let payload;',
'    try {',
'      payload = jwt.verify(state, JWT_SECRET);',
'    } catch (e) {',
"      return res.status(400).send('State invalido ou expirado. Tente conectar novamente.');",
'    }',
'    const tokens = await gcal.exchangeCodeForTokens(code);',
'    await gcal.saveTokens(payload.uid, tokens);',
"    res.redirect('/agenda-visual.html?google_connected=1');",
'  } catch (e) {',
"    console.error('gcal callback error', e.response ? e.response.data : e);",
"    res.redirect('/agenda-visual.html?google_connected=0');",
'  }',
'});',
'',
"app.get('/api/crm/google-calendar/status', auth, async (req, res) => {",
'  try {',
'    const row = await gcal.getTokenRow(req.user.id);',
'    res.json({ success: true, connected: !!row, calendarId: row ? row.calendar_id : null, updatedAt: row ? row.updated_at : null });',
'  } catch (e) {',
"    console.error('gcal status error', e);",
"    res.status(500).json({ success: false, error: 'Erro interno' });",
'  }',
'});',
'',
''
].join('\n');

src = src.replace(anchor2, routesBlock + anchor2);

fs.writeFileSync(file, src);
console.log('PATCH_APPLIED_OK');
