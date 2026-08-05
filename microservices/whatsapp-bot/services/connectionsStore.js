const pool = require('../db')

async function listConnections() {
  const [rows] = await pool.query('SELECT * FROM whatsapp_connections ORDER BY is_primary DESC, id ASC')
  return rows
}

async function getConnection(id) {
  const [rows] = await pool.query('SELECT * FROM whatsapp_connections WHERE id = ?', [id])
  return rows[0] || null
}

async function getPrimaryConnection() {
  const [rows] = await pool.query('SELECT * FROM whatsapp_connections WHERE is_primary = 1 LIMIT 1')
  return rows[0] || null
}

async function getFlowConnection(triggerKeyword) {
  const [rows] = await pool.query(
    'SELECT c.* FROM chatbot_flows f JOIN whatsapp_connections c ON c.id = f.connection_id WHERE f.trigger_keyword = ? LIMIT 1',
    [triggerKeyword]
  )
  return rows[0] || null
}

async function getFlags(connectionId) {
  try {
    const conn = connectionId ? await getConnection(connectionId) : await getPrimaryConnection()
    if (!conn) return { ai_enabled: true, chatbot_enabled: true }
    return { ai_enabled: !!conn.ai_enabled, chatbot_enabled: !!conn.chatbot_enabled }
  } catch (e) {
    console.error('[connectionsStore] erro ao ler flags, liberando por padrao:', e.message)
    return { ai_enabled: true, chatbot_enabled: true }
  }
}

async function createConnection(label) {
  const key = 'conn_' + Date.now()
  const authDir = 'auth_sessions/' + key
  const [r] = await pool.query(
    'INSERT INTO whatsapp_connections (connection_key, label, status, auth_dir, ai_enabled, chatbot_enabled, is_primary) VALUES (?, ?, "disconnected", ?, 1, 1, 0)',
    [key, label || null, authDir]
  )
  return getConnection(r.insertId)
}

async function setStatus(id, status, qrCode, phoneNumber) {
  const fields = ['status = ?']
  const values = [status]
  if (qrCode !== undefined) { fields.push('qr_code = ?'); values.push(qrCode) }
  if (phoneNumber !== undefined) { fields.push('phone_number = ?'); values.push(phoneNumber) }
  if (status === 'connected') { fields.push('connected_at = NOW()'); fields.push('last_seen = NOW()') }
  values.push(id)
  await pool.query('UPDATE whatsapp_connections SET ' + fields.join(', ') + ' WHERE id = ?', values)
}

async function setFlags(id, flags) {
  const fields = []
  const values = []
  if (flags.ai_enabled !== undefined) { fields.push('ai_enabled = ?'); values.push(flags.ai_enabled ? 1 : 0) }
  if (flags.chatbot_enabled !== undefined) { fields.push('chatbot_enabled = ?'); values.push(flags.chatbot_enabled ? 1 : 0) }
  if (!fields.length) return
  values.push(id)
  await pool.query('UPDATE whatsapp_connections SET ' + fields.join(', ') + ' WHERE id = ?', values)
}

async function deleteConnection(id) {
  const conn = await getConnection(id)
  if (!conn) return null
  if (conn.is_primary) throw new Error('Nao e possivel remover a conexao principal por aqui')
  await pool.query('DELETE FROM whatsapp_connections WHERE id = ?', [id])
  return conn
}

async function setFlowConnection(flowId, connectionId) {
  await pool.query('UPDATE chatbot_flows SET connection_id = ? WHERE id = ?', [connectionId || null, flowId])
}

module.exports = { listConnections, getConnection, getPrimaryConnection, getFlowConnection, getFlags, createConnection, setStatus, setFlags, deleteConnection, setFlowConnection }
