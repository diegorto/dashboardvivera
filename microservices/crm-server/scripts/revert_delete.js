const pool = require('../db');
const fs = require('fs');
(async () => {
  const ids = JSON.parse(fs.readFileSync('/tmp/revert_ids.json', 'utf8'));
  console.log('IDS_TO_DELETE=' + ids.length);
  const [deals] = await pool.query(`SELECT id FROM deals WHERE patient_id IN (${ids.map(()=>'?').join(',')})`, ids);
  const dealIds = deals.map(d => d.id);
  console.log('DEALS_MATCHED=' + dealIds.length);
  if (dealIds.length) {
    const [actRes] = await pool.query(`DELETE FROM activities WHERE deal_id IN (${dealIds.map(()=>'?').join(',')}) OR patient_id IN (${ids.map(()=>'?').join(',')})`, [...dealIds, ...ids]);
    console.log('ACTIVITIES_DELETED=' + actRes.affectedRows);
    const [dealRes] = await pool.query(`DELETE FROM deals WHERE id IN (${dealIds.map(()=>'?').join(',')})`, dealIds);
    console.log('DEALS_DELETED=' + dealRes.affectedRows);
  }
  const [patRes] = await pool.query(`DELETE FROM patients WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
  console.log('PATIENTS_DELETED=' + patRes.affectedRows);
  console.log('REVERT_OK');
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
