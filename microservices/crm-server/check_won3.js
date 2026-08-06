const pool = require('./db.js');
(async () => {
  try {
    const [rows] = await pool.query(`
      SELECT id, title, owner_name, pipeline_id, status, won_date, updated_at
      FROM deals
      WHERE won_date IS NOT NULL
        AND CONVERT_TZ(won_date,'+00:00','-03:00') BETWEEN '2026-07-21 00:00:00' AND '2026-07-22 23:59:59'
      ORDER BY won_date ASC
    `);
    for (const r of rows) {
      console.log(r.id, '|', r.title, '|', r.owner_name, '| pipeline', r.pipeline_id, '| status', r.status, '| won', r.won_date, '| updated', r.updated_at);
    }
  } catch (e) { console.error('ERR', e.message); }
  finally { process.exit(0); }
})();
