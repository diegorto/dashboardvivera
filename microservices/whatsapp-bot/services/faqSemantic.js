// Fase 2: RAG semantico (embeddings) sobre o FAQ configurado.
// Complementa (nao substitui, por enquanto) a busca por palavra-chave (searchFaq,
// em ai.js). So entra em acao quando a config 'faq_semantic_enabled' === 'true'.
// Ate isso ser ligado, o comportamento em producao e identico ao anterior.
//
// Usa a mesma OPENAI_API_KEY ja configurada no .env, via chamada REST direta
// (mesmo padrao usado no resto do projeto - sem depender do pacote npm 'openai').
//
// Estrategia de armazenamento: sem vetores externos (sem pgvector/Pinecone).
// O FAQ atual da Vivera e pequeno (poucas dezenas de itens no maximo), entao
// calculamos e cacheamos o embedding de cada item em 'faq_items_embedded'
// (chatbot_ai_config) e comparamos por similaridade de cosseno em memoria a
// cada mensagem. Isso e suficiente e muito mais simples/barato do que subir
// um banco vetorial dedicado nessa escala.

const crypto = require('crypto')

const EMBEDDING_MODEL = 'text-embedding-3-small'

function hashText(s) {
  return crypto.createHash('sha256').update(s || '').digest('hex')
}

async function embedText(text) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY nao configurada')
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text })
  })
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '')
    throw new Error('Falha ao gerar embedding (HTTP ' + resp.status + '): ' + errBody.slice(0, 300))
  }
  const data = await resp.json()
  return data.data[0].embedding
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return -1
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return -1
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// Le faq_items (fonte de verdade, editada por humanos no painel) e o cache de
// embeddings (faq_items_embedded), recalcula so o que mudou ou esta faltando
// (por hash do conteudo q+a), e persiste o cache de volta via setConfigFn.
// Retorna a lista final [{ q, a, hash, embedding }].
async function ensureFaqEmbeddings(cfg, setConfigFn) {
  let items = []
  try { items = JSON.parse(cfg.faq_items || '[]') } catch (e) { items = [] }
  let cache = []
  try { cache = JSON.parse(cfg.faq_items_embedded || '[]') } catch (e) { cache = [] }
  const cacheByHash = new Map(cache.map(c => [c.hash, c]))

  const result = []
  let changed = false
  for (const item of items) {
    const contentHash = hashText((item.q || '') + '|' + (item.a || ''))
    const cached = cacheByHash.get(contentHash)
    if (cached && Array.isArray(cached.embedding)) {
      result.push({ q: item.q, a: item.a, hash: contentHash, embedding: cached.embedding })
    } else {
      const embedding = await embedText(item.q + (item.a ? ' - ' + item.a : ''))
      result.push({ q: item.q, a: item.a, hash: contentHash, embedding })
      changed = true
    }
  }
  if (changed && typeof setConfigFn === 'function') {
    await setConfigFn('faq_items_embedded', JSON.stringify(result))
  }
  return result
}

// Busca semantica: embeda a pergunta do usuario e compara por similaridade de
// cosseno contra o cache de embeddings do FAQ. Retorna { q, a, score } do item
// mais parecido, se estiver acima do limiar de confianca; senao null (deixa o
// chamador cair pro keyword-matching / resto do fluxo normal).
async function searchFaqSemantic(cfg, userText, setConfigFn, threshold) {
  // Calibrado empiricamente em 06/08 com o FAQ real da Vivera (3 itens) e
  // text-embedding-3-small: matches corretos ficaram na faixa 0.45-0.64,
  // 2o lugar (nao-match) ficou em 0.22-0.30. 0.42 da margem de seguranca.
  // Revisar quando o FAQ crescer (mais itens = mais chance de confusao).
  threshold = threshold || 0.42
  const items = await ensureFaqEmbeddings(cfg, setConfigFn)
  if (!items.length) return null
  const queryEmbedding = await embedText(userText || '')
  let best = null, bestScore = -1
  for (const item of items) {
    const score = cosineSimilarity(queryEmbedding, item.embedding)
    if (score > bestScore) { bestScore = score; best = item }
  }
  if (best && bestScore >= threshold) {
    return { q: best.q, a: best.a, score: bestScore }
  }
  return null
}

module.exports = { embedText, cosineSimilarity, ensureFaqEmbeddings, searchFaqSemantic, EMBEDDING_MODEL }
