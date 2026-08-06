const pool = require('./db');
async function main() {
  console.log('=== deal id 1750 ===');
  const [rows] = await pool.query('SELECT id, title, owner_name, pipeline_id, status, value, won_date, add_date, updated_at FROM deals WHERE id = 1750');
  console.log(JSON.stringify(rows, null, 2));

  console.log('=== search Maria Aparecida ===');
  const [rows2] = await pool.query("SELECT id, title, owner_name, pipeline_id, status, value, won_date, add_date FROM deals WHERE title LIKE '%Maria Aparecida%Siqueira%' OR title LIKE '%Maria Aparecida de Siqueira%'");
  console.log(JSON.stringify(rows2, null, 2));

  console.log('=== all won deals with value between 3000-3500 won in July 2026 ===');
  const [rows3] = await pool.query("SELECT id, title, owner_name, pipeline_id, status, value, won_date FROM deals WHERE status='won' AND won_date >= '2026-07-01' AND won_date < '2026-08-01' AND value BETWEEN 3000 AND 3500 ORDER BY won_date");
  console.log(JSON.stringify(rows3, null, 2));

  console.log('=== distinct owner_name values (sample) ===');
  const [rows4] = await pool.query("SELECT DISTINCT owner_name FROM deals WHERE owner_name IS NOT NULL LIMIT 30");
  console.log(JSON.stringify(rows4));

  process.exit(0);
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
