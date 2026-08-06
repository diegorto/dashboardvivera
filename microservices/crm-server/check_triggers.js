const pool = require('./db.js');
(async () => {
  try {
    const [trigs] = await pool.query("SHOW TRIGGERS WHERE `Table` = 'deals'");
    console.log('TRIGGERS:', JSON.stringify(trigs, null, 2));
    const [events] = await pool.query("SHOW EVENTS");
    console.log('EVENTS:', JSON.stringify(events, null, 2));
  } catch (e) { console.error('ERR', e.message); }
  finally { process.exit(0); }
})();
