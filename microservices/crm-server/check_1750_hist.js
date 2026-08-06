const pool = require('./db');
async function main() {
  console.log('=== activities for deal 1750 ===');
  const [acts] = await pool.query("SELECT id, type, content, amount, created_at FROM activities WHERE deal_id = 1750 ORDER BY created_at");
  acts.forEach(a => console.log(a.id, '|', a.type, '| R$', a.amount, '|', a.created_at, '|', (a.content||'').substring(0,80)));

  console.log('\n=== stage_history for deal 1750 (if table exists) ===');
  try {
    const [sh] = await pool.query("SELECT * FROM stage_history WHERE deal_id = 1750 ORDER BY id");
    sh.forEach(s => console.log(JSON.stringify(s)));
  } catch(e) { console.log('no stage_history or error:', e.message); }

  console.log('\n=== other deals with status=open but won_date IS NOT NULL (systemic check) ===');
  const [bad] = await pool.query("SELECT id, title, owner_name, status, value, won_date, updated_at FROM deals WHERE status != 'won' AND won_date IS NOT NULL LIMIT 50");
  console.log('count:', bad.length);
  bad.forEach(b => console.log(b.id, '|', b.title, '|', b.owner_name, '| status:', b.status, '| value:', b.value, '| won_date:', b.won_date, '| updated_at:', b.updated_at));

  process.exit(0);
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
