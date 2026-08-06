const pool = require('../db');
const fs = require('fs');
(async () => {
  const log = fs.readFileSync('/tmp/recover_log.txt', 'utf8').split('\n').filter(Boolean);
  const ids = [];
  log.forEach(line => {
    const m = line.match(/patientId=(\d+) created=true/);
    if (m) ids.push(parseInt(m[1], 10));
  });
  console.log('PARSED_IDS_COUNT=' + ids.length);
  const [patients] = await pool.query(
    `SELECT p.id AS patient_id, p.name, p.phone, p.email, p.created_at AS patient_created,
            d.id AS deal_id, d.title, d.value, d.status, d.origem, d.campanha, d.stage_id, d.add_date
     FROM patients p LEFT JOIN deals d ON d.patient_id = p.id
     WHERE p.id IN (${ids.map(() => '?').join(',')})`, ids);
  console.log('ROWS_FOUND=' + patients.length);
  const header = 'patient_id,name,phone,email,patient_created,deal_id,title,value,status,origem,campanha,stage_id,add_date';
  const csvLines = [header];
  patients.forEach(r => {
    csvLines.push([r.patient_id, JSON.stringify(r.name||''), r.phone||'', r.email||'', r.patient_created, r.deal_id, JSON.stringify(r.title||''), r.value, r.status, JSON.stringify(r.origem||''), JSON.stringify(r.campanha||''), r.stage_id, r.add_date].join(','));
  });
  fs.writeFileSync('public/_revert_export.csv', csvLines.join('\n'));
  fs.writeFileSync('/tmp/revert_ids.json', JSON.stringify(ids));
  console.log('EXPORT_OK');
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
