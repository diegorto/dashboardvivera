const pool = require('./db.js');
(async () => {
  try {
    const [rows] = await pool.query(`
      SELECT id, title, owner_name, pipeline_id, status, won_date,
             CONVERT_TZ(won_date,'+00:00','-03:00') AS won_date_br,
             add_date, updated_at
      FROM deals
      WHERE status = 'won'
        AND CONVERT_TZ(won_date,'+00:00','-03:00') BETWEEN '2026-07-21 00:00:00' AND '2026-07-22 23:59:59'
      ORDER BY won_date ASC
    `);
    console.log('TOTAL_STILL_WON:', rows.length);
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) { console.error('ERR', e.message); }
  finally { process.exit(0); }
})();
