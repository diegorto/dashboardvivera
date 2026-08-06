const api = require('./crm-ui-api');
const pool = require('./db');
const { ddSdrDayMetrics, brTodayStr } = api;

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
