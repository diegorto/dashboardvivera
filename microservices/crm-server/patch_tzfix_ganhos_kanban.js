const fs = require('fs');

// ---- server.js: fix won-list / lost-list date range filtering ----
const file = 'server.js';
let src = fs.readFileSync(file, 'utf8');

const anchorFn = "function brDateOnlyToUtc(dateStr) {\n  return new Date(new Date(dateStr + 'T00:00:00.000Z').getTime() + BR_OFFSET_MS)\n}";
if ((src.split(anchorFn).length - 1) !== 1) { console.error('ANCHOR_FN_NOT_UNIQUE'); process.exit(1); }
const newFn = anchorFn + "\n// Fim do dia (23:59:59.999) em horario de Brasilia, convertido para UTC.\n// Usado com brDateOnlyToUtc nos filtros de periodo (Ganhos/Perdidos do Kanban),\n// que antes comparavam won_date/lost_date (UTC) contra strings de data ingenuas\n// e faziam fechamentos de hoje (Brasilia) carem no dia anterior.\nfunction brDayEndToUtc(dateStr) {\n  return new Date(new Date(dateStr + 'T00:00:00.000Z').getTime() + BR_OFFSET_MS + 24*60*60*1000 - 1)\n}";
src = src.split(anchorFn).join(newFn);

const anchorRange = "[from + ' 00:00:00', to + ' 23:59:59']";
const countRange = src.split(anchorRange).length - 1;
if (countRange !== 2) { console.error('ANCHOR_RANGE_COUNT_UNEXPECTED', countRange); process.exit(1); }
src = src.split(anchorRange).join('[brDateOnlyToUtc(from), brDayEndToUtc(to)]');

fs.writeFileSync(file, src);
console.log('SERVER_JS_PATCHED_OK');

// ---- public/board.html: fix wdRangeDates() to use Brasilia calendar date ----
const bfile = 'public/board.html';
let bsrc = fs.readFileSync(bfile, 'utf8');
const anchorIso = "var iso = function(d){ return d.toISOString().slice(0,10); };";
const countIso = bsrc.split(anchorIso).length - 1;
if (countIso !== 1) { console.error('ANCHOR_ISO_NOT_UNIQUE', countIso); process.exit(1); }
const newIso = "var iso = function(d){ return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); };";
bsrc = bsrc.split(anchorIso).join(newIso);
fs.writeFileSync(bfile, bsrc);
console.log('BOARD_HTML_PATCHED_OK');
