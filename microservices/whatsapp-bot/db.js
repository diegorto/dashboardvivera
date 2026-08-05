require('dotenv').config()
const mysql = require('mysql2/promise')

const pool = mysql.createPool({
  host: process.env.CRM_DB_HOST || '127.0.0.1',
  port: parseInt(process.env.CRM_DB_PORT || '3306'),
  user: process.env.CRM_DB_USER || 'crm',
  password: process.env.CRM_DB_PASSWORD || '',
  database: process.env.CRM_DB_NAME || 'vivera_crm',
  waitForConnections: true,
  connectionLimit: 8,
  namedPlaceholders: true,
  timezone: 'Z'
})

module.exports = pool
