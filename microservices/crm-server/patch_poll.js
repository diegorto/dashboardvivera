const fs = require('fs');
const file = 'google-calendar-service.js';
let src = fs.readFileSync(file, 'utf8');
const block = fs.readFileSync('/tmp/poll_block.txt', 'utf8');

const anchor = "module.exports = { buildAuthUrl: buildAuthUrl, exchangeCodeForTokens: exchangeCodeForTokens, saveTokens: saveTokens, getTokenRow: getTokenRow, getValidAccessToken: getValidAccessToken, insertEvent: insertEvent, updateEvent: updateEvent, deleteEvent: deleteEvent, listEvents: listEvents };";
const count = src.split(anchor).length - 1;
if (count !== 1) { console.error('ANCHOR_NOT_UNIQUE', count); process.exit(1); }

const newExport = "module.exports = { buildAuthUrl: buildAuthUrl, exchangeCodeForTokens: exchangeCodeForTokens, saveTokens: saveTokens, getTokenRow: getTokenRow, getValidAccessToken: getValidAccessToken, insertEvent: insertEvent, updateEvent: updateEvent, deleteEvent: deleteEvent, listEvents: listEvents, pollAllUsers: pollAllUsers };";

src = src.replace(anchor, block + '\n' + newExport);
fs.writeFileSync(file, src);
console.log('POLL_PATCH_OK');
