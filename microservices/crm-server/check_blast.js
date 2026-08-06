const pool = require('./db');
async function main() {
  console.log('=== deals with a "Negocio ganho" activity but current status != won ===');
  const [rows] = await pool.query(`
    SELECT DISTINCT d.id, d.title, d.owner_name, d.status, d.value, d.won_date, d.updated_at
    FROM deals d
    JOIN activities a ON a.deal_id = d.id
    WHERE a.content LIKE '%Neg%cio ganho%'
    AND d.status != 'won'
  `);
  console.log('count:', rows.length);
  rows.forEach(r => console.log(r.id, '|', r.title, '|', r.owner_name, '| status:', r.status, '| value:', r.value, '| won_date:', r.won_date, '| updated_at:', r.updated_at));

  console.log('\n=== deals updated in the same window as deal 1750 (2026-07-21 04:00 to 06:00 UTC), any owner ===');
  const [rows2] = await pool.query(`
    SELECT id, title, owner_name, status, value, won_date, updated_at
    FROM deals WHERE updated_at BETWEEN '2026-07-21 04:00:00' AND '2026-07-21 06:00:00'
    ORDER BY updated_at
  `);
  console.log('count:', rows2.length);
  rows2.forEach(r => console.log(r.id, '|', r.title, '|', r.owner_name, '| status:', r.status, '| value:', r.value, '| won_date:', r.won_date, '| updated_at:', r.updated_at));

  process.exit(0);
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
