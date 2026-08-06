// Cria um usuário do CRM: node scripts/create-user.js "Nome" email@x.com senha [role]
require('dotenv').config()
const bcrypt = require('bcryptjs')
const pool = require('../db')

async function main() {
  const [name, email, password, role] = process.argv.slice(2)
  if (!name || !email || !password) {
    console.log('Uso: node scripts/create-user.js "Nome" email@x.com senha [admin|sdr|closer|recepcao]')
    process.exit(1)
  }
  const hash = await bcrypt.hash(password, 10)
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = VALUES(role), active = 1`,
    [name, email.toLowerCase().trim(), hash, role || 'admin'])
  console.log(`Usuário ${email} criado/atualizado com papel ${role || 'admin'}.`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
