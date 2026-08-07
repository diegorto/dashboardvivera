const fs = require('fs');
const bfile = 'public/board.html';
let bsrc = fs.readFileSync(bfile, 'utf8');
const anchorIso = "var iso = function(d){ return d.toISOString().slice(0,10); };";
const countIso = bsrc.split(anchorIso).length - 1;
if (countIso !== 2) { console.error('ANCHOR_ISO_COUNT_UNEXPECTED', countIso); process.exit(1); }
const newIso = "var iso = function(d){ return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); };";
bsrc = bsrc.split(anchorIso).join(newIso);
fs.writeFileSync(bfile, bsrc);
console.log('BOARD_HTML_PATCHED_OK');
