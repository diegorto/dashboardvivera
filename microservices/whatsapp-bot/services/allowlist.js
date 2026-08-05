// Allowlist de numeros para IA/chatbot durante rollout controlado.
// Gated por chatbot_ai_config.restrict_to_allowlist.
const pool = require('../db')

function normalize(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-11)
}

// Remove o codigo de pais (55) quando presente e retorna DDD+numero local
// (10 ou 11 digitos, com ou sem o 9o digito).
function toLocal(phone) {
  let d = String(phone || '').replace(/\D/g, '')
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) {
    d = d.slice(2)
  }
  return d
}

// Forma canonica de 10 digitos (DDD + 8 digitos), removendo o 9o digito
// do celular quando presente, pra comparar numeros com/sem esse digito
// como o mesmo numero.
function localTen(phone) {
  const d = toLocal(phone)
  if (d.length === 11) return d.slice(0, 2) + d.slice(3)
  if (d.length === 10) return d
  if (d.length > 11) return d.slice(-10)
  return d
}

async function isRestrictedMode() {
  try {
    const [[row]] = await pool.query("SELECT config_value FROM chatbot_ai_config WHERE config_key='restrict_to_allowlist'")
    return !!(row && row.config_value === '1')
  } catch (e) {
    console.error('[allowlist] erro lendo restrict_to_allowlist:', e.message)
    return false
  }
}

async function isAllowlisted(phone) {
  try {
    const target = localTen(phone)
    if (!target) return false
    const [rows] = await pool.query('SELECT phone FROM ai_chatbot_allowlist')
    return rows.some(r => localTen(r.phone) === target)
  } catch (e) {
    console.error('[allowlist] erro checando allowlist:', e.message)
    return false
  }
}

module.exports = { isRestrictedMode, isAllowlisted, normalize, localTen }
