const fs = require('fs');
let s = fs.readFileSync('crm-ui-api.js', 'utf8');
if (s.indexOf('__HISTORICAL_EXPORTS__') === -1) {
  s += '\n// __HISTORICAL_EXPORTS__ (added for one-off historical export script)\nmodule.exports.ddSdrDayMetrics = ddSdrDayMetrics;\nmodule.exports.brRangeToUtc = brRangeToUtc;\nmodule.exports.brTodayStr = brTodayStr;\nmodule.exports.ddSumDedupedBudget = ddSumDedupedBudget;\n';
  fs.writeFileSync('crm-ui-api.js', s);
  console.log('APPENDED');
} else {
  console.log('ALREADY_PRESENT');
}
