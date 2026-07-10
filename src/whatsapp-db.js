// Conexão com banco whatsapp-monitor para analytics
const mysql = require('mysql2/promise');

let pool;

async function initPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.WHATSAPP_DB_HOST || '127.0.0.1',
    port: process.env.WHATSAPP_DB_PORT || 3306,
    user: process.env.WHATSAPP_DB_USER || 'root',
    password: process.env.WHATSAPP_DB_PASSWORD || '',
    database: process.env.WHATSAPP_DB_NAME || 'vivera_whatsapp',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  console.log('[WhatsApp DB] Pool inicializado');
  return pool;
}

async function query(sql, params = []) {
  if (!pool) await initPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

module.exports = {
  initPool,
  query,
  queryOne,
};
