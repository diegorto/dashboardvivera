const pool = require('./db.js');
(async () => {
  try {
    const [rows] = await pool.query(`
      SELECT DATE(CONVERT_TZ(won_date,'+00:00','-03:00')) AS won_day,
             status, COUNT(*) c
      FROM deals
      WHERE won_date IS NOT NULL AND won_date >= (CURDATE() - INTERVAL 10 DAY)
      GROUP BY won_day, status
      ORDER BY won_day DESC
    `);
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) { console.error('ERR', e.message); }
  finally { process.exit(0); }
})();
