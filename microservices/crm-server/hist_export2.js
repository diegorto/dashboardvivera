const registerCrmUiRoutes = require('./crm-ui-api');
const pool = require('./db');

const stubApp = { get: () => {}, post: () => {}, patch: () => {}, delete: () => {}, put: () => {}, use: () => {} };
const stubAuth = (req, res, next) => { if (next) next(); };
registerCrmUiRoutes(stubApp, pool, stubAuth);

const ddSdrDayMetrics = registerCrmUiRoutes.ddSdrDayMetrics;
const brTodayStr = registerCrmUiRoutes.brTodayStr;

if (typeof ddSdrDayMetrics !== 'function' || typeof brTodayStr !== 'function') {
  console.error('EXPORTS_STILL_MISSING', typeof ddSdrDayMetrics, typeof brTodayStr);
  process.exit(1);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const startDate = '2026-03-18';
  const endDate = brTodayStr();
  console.log('Range', startDate, 'to', endDate);

  const rows = [];
  let cur = startDate;
  let dayCount = 0;
  while (cur <= endDate) {
    const agda = await ddSdrDayMetrics(pool, 'Agda', cur, cur);
    const helenice = await ddSdrDayMetrics(pool, 'Helenice', cur, cur);
    rows.push({ date: cur, sdr: 'Agda', ...agda });
    rows.push({ date: cur, sdr: 'Helenice', ...helenice });
    dayCount++;
    if (dayCount % 20 === 0) console.error('...processed', dayCount, 'days, at', cur);
    cur = addDays(cur, 1);
  }

  const fs = require('fs');
  fs.writeFileSync('/root/historico_sdr.json', JSON.stringify(rows));
  console.log('TOTAL_ROWS', rows.length, 'DAYS', dayCount);
  console.log('DONE');
  process.exit(0);
}
main().catch(e => { console.error('ERR', e.message, e.stack); process.exit(1); });
