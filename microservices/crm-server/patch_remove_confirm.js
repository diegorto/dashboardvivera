const fs = require('fs');
const file = 'public/agenda-visual.html';
let src = fs.readFileSync(file, 'utf8');
const old = "if (!confirm('Cancelar este compromisso? Ele tambem sera removido do Google Calendar.')) return;";
const count = src.split(old).length - 1;
if (count !== 1) { console.error('ANCHOR_NOT_UNIQUE', count); process.exit(1); }
src = src.replace(old, '');
fs.writeFileSync(file, src);
console.log('REMOVE_CONFIRM_OK');
