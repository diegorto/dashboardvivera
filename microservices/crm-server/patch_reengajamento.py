import sys

path = 'server.js'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

line_1010 = lines[1009]
line_1030 = lines[1029]
assert 'else if (open.length === 0 && !created)' in line_1010, ('L1010 mismatch: ' + line_1010)
assert line_1030.strip() == '} else {', ('L1030 mismatch: ' + repr(line_1030))

webhook_idx = None
for i, l in enumerate(lines):
    if "app.post('/api/crm/webhooks/tintim'" in l:
        webhook_idx = i
        break
assert webhook_idx is not None, 'webhook route line not found'

HELPERS = """
// ==== Lead perdido reaberto: helpers de resumo via IA (2026-07-27, decisao Diego) ====
async function ddCountDedupedActivityByDeal(pool, dealId, actType) {
  const [rows] = await pool.query(
    'SELECT created_at AS createdAt, content FROM activities WHERE deal_id = ? AND type = ? ORDER BY created_at ASC',
    [dealId, actType]
  )
  const CONFIRM_MARKER = 'autorizado e confirmado pelo responsavel'
  let total = 0
  let lastKeptTime = null
  for (const r of rows) {
    const t = new Date(r.createdAt).getTime()
    const isConfirmed = !!(r.content && r.content.indexOf(CONFIRM_MARKER) !== -1)
    let counts = true
    if (lastKeptTime !== null && !isConfirmed) {
      const gapSec = (t - lastKeptTime) / 1000
      if (gapSec < 120) counts = false
    }
    if (counts) { lastKeptTime = t; total++ }
  }
  return total
}

async function buildLostLeadAiSummary(pool, lostDeal) {
  try {
    const [notes] = await pool.query(
      "SELECT content, created_at FROM activities WHERE deal_id = ? AND type = 'note' ORDER BY created_at ASC",
      [lostDeal.id]
    )
    const chamadasEfetuadas = await ddCountDedupedActivityByDeal(pool, lostDeal.id, 'Chamada Realizada')
    const chamadasAtendidas = await ddCountDedupedActivityByDeal(pool, lostDeal.id, 'Ligação Atendida')
    let tagsList = []
    try { tagsList = lostDeal.tags ? (typeof lostDeal.tags === 'string' ? JSON.parse(lostDeal.tags) : lostDeal.tags) : [] } catch (e) { tagsList = [] }
    const notesText = notes.length
      ? notes.map(n => `${new Date(n.created_at).toLocaleDateString('pt-BR')}: ${String(n.content || '').slice(0, 300)}`).join(' | ')
      : 'nenhuma anotacao registrada'

    const promptData = [
      'Dados do negocio anterior (perdido) deste paciente no CRM de uma clinica odontologica/orofacial.',
      `Interesse/procedimento: ${lostDeal.procedure_name || 'nao informado'}.`,
      `Tags: ${tagsList.length ? tagsList.join(', ') : 'nenhuma'}.`,
      `Motivo da perda: ${lostDeal.loss_reason || 'nao informado'}.`,
      `Quantidade de chamadas efetuadas: ${chamadasEfetuadas}.`,
      `Quantidade de ligacoes atendidas: ${chamadasAtendidas}.`,
      `Anotacoes registradas: ${notesText}.`
    ].join(' ')

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return 'Resumo automatico indisponivel (chave da IA nao configurada).'

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.5,
        messages: [
          { role: 'system', content: 'Voce e um assistente de CRM de uma clinica odontologica/orofacial. Resuma o historico anterior de um lead que voltou a entrar em contato apos ter sido perdido. Escreva em portugues, entre 3 e 5 frases curtas e claras, cobrindo: interesse demonstrado, tags/perfil, quantidade de chamadas e ligacoes atendidas, anotacoes relevantes, e o motivo da perda. Nao invente dados que nao foram fornecidos.' },
          { role: 'user', content: promptData }
        ]
      })
    })
    const data = await resp.json()
    const summary = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
    return summary || 'Nao foi possivel gerar o resumo automatico do historico anterior.'
  } catch (e) {
    console.error('[reengajamento-ia] erro ao gerar resumo', e.message)
    return 'Nao foi possivel gerar o resumo automatico do historico anterior (erro tecnico).'
  }
}

"""

NEW_BLOCK = """      } else if (open.length === 0 && !created) {
        const lastClosed = closedHistForNote.length > 0 ? closedHistForNote[0] : null
