const fs = require('fs');
const file = 'crm-ui-api.js';
const backup = file + '.bak_defaultscheduled_' + Date.now();
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
  "const ALLOWED_STATUS = new Set(['confirmed', 'attended', 'no_show', 'cancelled', 'rescheduled']);",
  "const ALLOWED_STATUS = new Set(['scheduled', 'confirmed', 'attended', 'no_show', 'cancelled', 'rescheduled']);",
  "ALLOWED_STATUS - add scheduled"
);

replaceOnce(
  "[dealId, dentistUserId, title, description, startAt, endAt, 'confirmed', attendanceLikelihood, req.user.id]",
  "[dealId, dentistUserId, title, description, startAt, endAt, 'scheduled', attendanceLikelihood, req.user.id]",
  "POST create - default status scheduled (blue) instead of confirmed (green)"
);

fs.writeFileSync(file, content);
console.log('DONE - default-status patch (' + changes + ' changes). Backup: ' + backup);
