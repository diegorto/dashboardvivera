const fs = require('fs');
const file = 'crm-ui-api.js';
let content = fs.readFileSync(file, 'utf8');
const anchor = 'Instagram Orgânico") THEN "Orgânico" ELSE d.origem END';
const count = content.split(anchor).length - 1;
if (count !== 1) { console.error('ANCHOR_NOT_UNIQUE:' + count); process.exit(1); }
const replacement = 'Instagram Orgânico") THEN "Orgânico" WHEN d.origem IN ("Facebook","Facebook Ads","Meta","Meta Ads") THEN "Instagram" ELSE d.origem END';
content = content.split(anchor).join(replacement);
fs.writeFileSync(file, content, 'utf8');
console.log('PATCHED_OK');
