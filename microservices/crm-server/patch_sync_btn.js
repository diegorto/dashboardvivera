const fs = require('fs');
const file = 'public/agenda-visual.html';
let src = fs.readFileSync(file, 'utf8');

const anchorHtml = '<button class="btn" id="gcalConnectBtn" style="display:none;">Conectar Google Calendar</button>';
if ((src.split(anchorHtml).length - 1) !== 1) { console.error('ANCHOR_HTML_NOT_UNIQUE'); process.exit(1); }
src = src.replace(anchorHtml, anchorHtml + '\n      <button class="btn" id="gcalSyncBtn" style="display:none;">Sincronizar agora</button>');

const anchorJs = "document.getElementById('gcalConnectBtn').addEventListener('click', async function() {";
if ((src.split(anchorJs).length - 1) !== 1) { console.error('ANCHOR_JS_NOT_UNIQUE'); process.exit(1); }
const syncJs = "document.getElementById('gcalSyncBtn').addEventListener('click', async function() {\n  const btn = this;\n  btn.textContent = 'Sincronizando...';\n  btn.disabled = true;\n  try {\n    const data = await api('/api/crm/google-calendar/sync-now');\n    const r = (data.results && data.results[0]) || {};\n    if (r.error) { showToast('Erro na sincronizacao: ' + r.error, 'error'); }\n    else { showToast('Sincronizado! ' + (r.created||0) + ' criados, ' + (r.updated||0) + ' atualizados, ' + (r.cancelled||0) + ' cancelados', 'success'); }\n    if (calendar) calendar.refetchEvents();\n  } catch (e) {\n    showToast(e.message || 'Erro ao sincronizar', 'error');\n  } finally {\n    btn.textContent = 'Sincronizar agora';\n    btn.disabled = false;\n  }\n});\n\n" + anchorJs;
src = src.replace(anchorJs, syncJs);

const anchorStatusOk = "btn.style.display = 'none';";
if ((src.split(anchorStatusOk).length - 1) !== 1) { console.error('ANCHOR_STATUSOK_NOT_UNIQUE'); process.exit(1); }
src = src.replace(anchorStatusOk, "btn.style.display = 'none';\n      document.getElementById('gcalSyncBtn').style.display = 'inline-block';");

const anchorStatusNo = "btn.style.display = 'inline-block';";
if ((src.split(anchorStatusNo).length - 1) !== 1) { console.error('ANCHOR_STATUSNO_NOT_UNIQUE'); process.exit(1); }
src = src.replace(anchorStatusNo, "btn.style.display = 'inline-block';\n      document.getElementById('gcalSyncBtn').style.display = 'none';");

fs.writeFileSync(file, src);
console.log('SYNC_BTN_PATCH_OK');
