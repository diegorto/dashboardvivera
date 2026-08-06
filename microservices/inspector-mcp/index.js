require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8877;
const MAX_ROWS = parseInt(process.env.MAX_ROWS || '500', 10);
const QUERY_TIMEOUT_MS = parseInt(process.env.QUERY_TIMEOUT_MS || '8000', 10);
const TOKEN = process.env.INSPECTOR_TOKEN;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

const app = express();
app.use(express.json({ limit: '256kb' }));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
app.use(limiter);

const logFile = path.join(__dirname, 'query_audit.log');
function auditLog(entry) {
  fs.appendFile(logFile, JSON.stringify(entry) + '\n', () => {});
}

function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!TOKEN || token !== TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|truncate|replace|grant|revoke|call|exec|execute|lock|unlock|set|load_file|outfile|dumpfile|shutdown|kill)\b/i;

function isSelectOnly(sql) {
  const trimmed = sql.trim().replace(/;+\s*$/, '');
  if (trimmed.includes(';')) return { ok: false, reason: 'multiple statements not allowed' };
  if (!/^(select|with)\b/i.test(trimmed)) return { ok: false, reason: 'only SELECT statements are allowed' };
  if (FORBIDDEN.test(trimmed)) return { ok: false, reason: 'forbidden keyword detected' };
  return { ok: true, sql: trimmed };
}

app.get('/health', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.query('SELECT 1');
    conn.release();
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

app.get('/tables', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SHOW TABLES');
    res.json({ tables: rows.map(r => Object.values(r)[0]) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/query', authMiddleware, async (req, res) => {
  const { sql } = req.body || {};
  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({ error: 'missing sql field (string) in JSON body' });
  }
  const check = isSelectOnly(sql);
  if (!check.ok) {
    auditLog({ ts: new Date().toISOString(), ip: req.ip, rejected: true, reason: check.reason, sql });
    return res.status(400).json({ error: check.reason });
  }
  let conn;
  try {
    conn = await pool.getConnection();
    try { await conn.query('SET SESSION max_statement_time=' + (QUERY_TIMEOUT_MS/1000)); } catch (e) {}
    const [rows] = await conn.query(check.sql);
    const truncated = Array.isArray(rows) && rows.length > MAX_ROWS;
    const result = Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : rows;
    auditLog({ ts: new Date().toISOString(), ip: req.ip, rejected: false, sql: check.sql, rowCount: Array.isArray(rows) ? rows.length : null });
    res.json({ rowCount: Array.isArray(result) ? result.length : null, truncated, rows: result });
  } catch (e) {
    auditLog({ ts: new Date().toISOString(), ip: req.ip, rejected: true, reason: e.message, sql });
    res.status(400).json({ error: e.message });
  } finally {
    if (conn) conn.release();
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`vivera-inspector-mcp listening on port ${PORT}`);
});
