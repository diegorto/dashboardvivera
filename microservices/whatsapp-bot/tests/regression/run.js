// Fase 0.5 - Runner da suite de regressao clinica.
// Uso: node tests/regression/run.js
// Roda contra o pipeline real (ai.generateReply) com conversationIds sinteticos e isolados.
// Nunca cria/atualiza patient, deal ou handoff_alerts (generateReply so LE essas tabelas).

const path = require('path')
process.chdir(path.join(__dirname, '..', '..'))
const ai = require('../../services/ai')
const redis = require('../../lib/redis')
const { cases, findForbiddenDiminutive } = require('./cases')

function extractText(chunks) {
  return (chunks || []).join(' ')
}

async function cleanup(conversationId) {
  try {
    const keys = await redis.keys('*' + conversationId + '*')
    if (keys && keys.length) await redis.del(...keys)
  } catch (e) {
    console.error('[regressao] falha ao limpar redis de ' + conversationId + ': ' + e.message)
  }
}

async function runCase(tc, idx) {
  const conversationId = 'regressao-fase0-' + tc.id + '-' + Date.now() + '-' + idx
  let replyText = ''
  let error = null
  try {
    const result = await ai.generateReply(conversationId, tc.userText, 'Paciente Teste')
    replyText = extractText(result.chunks)
  } catch (e) {
    error = e
  }
  await cleanup(conversationId)

  const failures = []
  if (error) {
    failures.push('erro ao chamar generateReply: ' + error.message)
  } else {
    if (!replyText) failures.push('resposta vazia')
    const diminutiveHit = findForbiddenDiminutive(replyText) ? [findForbiddenDiminutive(replyText)] : null
    if (diminutiveHit) failures.push('diminutivo proibido encontrado: "' + diminutiveHit[0] + '"')
    for (const re of (tc.forbidden || [])) {
      const hit = replyText.match(re)
      if (hit) failures.push('padrao proibido encontrado (' + re + '): "' + hit[0] + '"')
    }
    for (const re of (tc.required || [])) {
      if (!re.test(replyText)) failures.push('padrao obrigatorio ausente: ' + re)
    }
  }

  return { id: tc.id, category: tc.category, userText: tc.userText, replyText, failures, passed: failures.length === 0 }
}

async function main() {
  console.log('=== Suite de regressao clinica - Fase 0.5 ===')
  console.log('Total de casos: ' + cases.length)
  console.log('')
  const results = []
  for (let i = 0; i < cases.length; i++) {
    process.stdout.write('[' + (i + 1) + '/' + cases.length + '] ' + cases[i].id + ' ... ')
    const r = await runCase(cases[i], i)
    results.push(r)
    console.log(r.passed ? 'PASSOU' : 'FALHOU')
    if (!r.passed) {
      console.log('    userText: ' + r.userText)
      console.log('    resposta: ' + r.replyText.slice(0, 300))
      r.failures.forEach(f => console.log('    -> ' + f))
    }
  }

  const failed = results.filter(r => !r.passed)
  console.log('')
  console.log('=== RESUMO ===')
  console.log('Passou: ' + (results.length - failed.length) + '/' + results.length)
  if (failed.length) {
    console.log('Falhou: ' + failed.map(f => f.id).join(', '))
  }

  const fs = require('fs')
  fs.writeFileSync(
    path.join(__dirname, 'last_run_report.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  )
  console.log('Relatorio completo salvo em tests/regression/last_run_report.json')

  process.exit(failed.length ? 1 : 0)
}

main().catch(e => {
  console.error('[regressao] erro fatal no runner:', e)
  process.exit(1)
})
