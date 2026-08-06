const fs = require('fs');
const file = 'public/agenda-visual.html';
const backup = file + '.bak_ptbrmonthfix_' + Date.now();
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
  "firstDay: 1,",
  "firstDay: 1,\n      views: { dayGridMonth: { dayHeaderFormat: { weekday: 'short' }, titleFormat: { year: 'numeric', month: 'long' } } },",
  "fix month view header/title (weekday-only, no bogus date)"
);

fs.writeFileSync(file, content);
console.log('DONE - month view fix (' + changes + ' changes). Backup: ' + backup);
