const fs = require('fs');
const file = 'crm-ui-api.js';
let src = fs.readFileSync(file, 'utf8');
const block = fs.readFileSync('/tmp/calendar_routes.txt', 'utf8');

const anchor = /\n\};\s*$/;
const matches = src.match(new RegExp(anchor.source, 'gm'));
if (!matches || matches.length !== 1) { console.error('ANCHOR_NOT_UNIQUE', matches ? matches.length : 0); process.exit(1); }

src = src.replace(anchor, '\n' + block + '\n};\n');
fs.writeFileSync(file, src);
console.log('CALENDAR_ROUTES_PATCH_OK');
