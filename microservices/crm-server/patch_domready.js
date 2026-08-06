const fs = require('fs');
const file = 'public/detail.html';
const src = fs.readFileSync(file, 'utf8');
fs.writeFileSync(file + '.bak_domready', src);
const lines = src.split('\n');
const startIdx = lines.findIndex(l => l.indexOf("const _schedCancelBtn = document.getElementById('schedCancelBtn')") !== -1);
if (startIdx === -1) { console.log('START_NOT_FOUND'); process.exit(1); }
// find the matching end: the schedSaveBtn addEventListener closing "});" - search forward for a line that is exactly "});" AFTER the schedSaveBtn open line
const saveOpenIdx = lines.findIndex(l => l.indexOf("getElementById('schedSaveBtn')") !== -1);
if (saveOpenIdx === -1) { console.log('SAVEOPEN_NOT_FOUND'); process.exit(1); }
let endIdx = -1;
for (let i = saveOpenIdx; i < lines.length; i++) {
  if (lines[i].trim() === '});') { endIdx = i; break; }
}
if (endIdx === -1) { console.log('END_NOT_FOUND'); process.exit(1); }
lines.splice(endIdx + 1, 0, '});');
lines.splice(startIdx, 0, "document.addEventListener('DOMContentLoaded', function() {");
fs.writeFileSync(file, lines.join('\n'));
console.log('OK startIdx=' + startIdx + ' endIdx=' + endIdx);
