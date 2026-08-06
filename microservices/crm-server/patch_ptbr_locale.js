const fs = require('fs');
const file = 'public/agenda-visual.html';
const backup = file + '.bak_ptbrlocale_' + Date.now();
fs.copyFileSync(file, backup);
let content = fs.readFileSync(file, 'utf8');
let changes = 0;

function replaceOnce(oldStr, newStr, label) {
  const count = content.split(oldStr).length - 1;
  if (count === 0) { throw new Error('ANCHOR NOT FOUND: ' + label); }
  if (count !== 1) { throw new Error('ANCHOR NOT UNIQUE (' + count + 'x): ' + label); }
  content = content.replace(oldStr, newStr);
  changes++;
  console.log('OK: ' + label);
}

replaceOnce(
  '<script src="https://cdn.jsdelivr.net/npm/fullcalendar@6/index.global.min.js"></script>',
  '<script src="https://cdn.jsdelivr.net/npm/fullcalendar@6/index.global.min.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/fullcalendar@6/locales-all.global.min.js"></script>',
  'load fullcalendar pt-br locale bundle'
);

replaceOnce(
  "slotMinTime: '07:00:00',",
  "slotMinTime: '09:00:00',",
  "business hours start 09:00"
);

replaceOnce(
  "slotMaxTime: '21:00:00',",
  "slotMaxTime: '18:00:00',",
  "business hours end 18:00"
);

replaceOnce(
  "eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },",
  "eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },\n      locale: 'pt-br',\n      slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },\n      dayHeaderFormat: { weekday: 'short', day: '2-digit', month: '2-digit' },\n      titleFormat: { year: 'numeric', month: 'long', day: 'numeric' },",
  "pt-br locale + 24h slot labels + BR date headers"
);

fs.writeFileSync(file, content);
console.log('DONE - pt-BR locale patch (' + changes + ' changes). Backup: ' + backup);
