const fs = require('fs');
let s = fs.readFileSync('crm-ui-api.js', 'utf8');

// Remove the bad top-level append if present
const marker = '\n// __HISTORICAL_EXPORTS__';
const idx = s.indexOf(marker);
if (idx !== -1) {
  s = s.substring(0, idx);
  console.log('REMOVED_BAD_APPEND at', idx);
} else {
  console.log('NO_BAD_APPEND_FOUND');
}

// Insert correct exports right after ddSumDedupedBudget's function body ends.
// Find "async function ddSumDedupedBudget" then find the matching end by
// locating the next "async function ddGetMetas" and inserting just before it.
const anchor = 'async function ddGetMetas';
const anchorIdx = s.indexOf(anchor);
if (anchorIdx === -1) {
  console.log('ANCHOR_NOT_FOUND');
  process.exit(1);
}
const insertion = "module.exports.ddSdrDayMetrics = ddSdrDayMetrics;\nmodule.exports.brRangeToUtc = brRangeToUtc;\nmodule.exports.brTodayStr = brTodayStr;\nmodule.exports.ddSumDedupedBudget = ddSumDedupedBudget;\n\n";
s = s.slice(0, anchorIdx) + insertion + s.slice(anchorIdx);

fs.writeFileSync('crm-ui-api.js', s);
console.log('FIXED_LEN', s.length);
