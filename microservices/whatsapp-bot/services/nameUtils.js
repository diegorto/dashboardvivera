// Utilitario centralizado de nome. Regra permanente: SEMPRE usar so o primeiro
// nome da pessoa ao se dirigir a ela (saudacoes, {{nome_lead}}, {nome}, prompt de IA).
// Nunca usar o campo completo (pode conter rotulo interno de teste, sobrenome, etc).
function getFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') return ''
  const trimmed = fullName.trim()
  if (!trimmed || trimmed === '.') return ''
  const first = trimmed.split(/\s+/)[0]
  return first
}
module.exports = { getFirstName }
