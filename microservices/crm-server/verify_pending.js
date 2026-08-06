const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: 'localhost', user: 'root', database: 'vivera_crm' });
  const [rows] = await pool.query("SELECT t.id, t.phone, t.raw_payload FROM tintim_webhook_log t INNER JOIN (SELECT phone, MAX(id) AS max_id FROM tintim_webhook_log WHERE event_type = 'message.create' AND phone IS NOT NULL AND phone <> '' GROUP BY phone) latest ON latest.phone = t.phone AND latest.max_id = t.id");
  const stat = {};
  for (const r of rows) { try { const o = JSON.parse(r.raw_payload); const lead = o.lead || {}; const s = lead.first_response_status; stat[s] = (stat[s] || 0) + 1; } catch (e) {} }
  console.log('rows:', rows.length, 'stat:', stat);
  process.exit(0);
})();
