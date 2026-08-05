// Motor de execucao dos fluxos visuais (estilo ManyChat) criados no editor.
// 7 tipos de no: trigger, message, question, condition, wait, reminder, end.
const pool = require('../db')

async function getFlowGraph(flowId) {
  const [nodes] = await pool.query('SELECT * FROM chatbot_flow_nodes WHERE flow_id = ?', [flowId])
  const [edges] = await pool.query('SELECT * FROM chatbot_flow_edges WHERE flow_id = ?', [flowId])
  return { nodes, edges }
}

function nextNodeId(edges, fromNodeId, handle) {
  const candidates = edges.filter(e => e.source_node_id === fromNodeId && (handle ? e.source_handle === handle : true))
  return candidates.length ? candidates[0].target_node_id : null
}

async function findActiveFlowForTrigger(userText) {
  const [flows] = await pool.query('SELECT * FROM chatbot_flows WHERE is_active = 1')
  const text = (userText || '').toLowerCase()
  for (const f of flows) {
    if (f.trigger_keyword && text.includes(String(f.trigger_keyword).toLowerCase())) return f
  }
  return null
}

// Executa um passo do fluxo a partir do node atual da conversa. Retorna { messages, nextState, finished }
async function step(conversation, userText, sendTextFn) {
  const { nodes, edges } = await getFlowGraph(conversation.active_flow_id)
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  let current = byId[conversation.active_node_id] || nodes.find(n => n.node_type === 'trigger')
  const messages = []

  if (!current) return { messages, nextNodeId: null, finished: true }

  // Se o no atual era uma pergunta aguardando resposta, avanca com base na resposta recebida.
  if (current.node_type === 'question') {
    const cfg = safeJson(current.config)
    const targetId = nextNodeId(edges, current.id)
    return { messages, nextNodeId: targetId, finished: !targetId, capturedAnswer: userText, varName: cfg.varName }
  }

  return runFrom(current, edges, byId, sendTextFn, messages)
}

async function runFrom(node, edges, byId, sendTextFn) {
  const messages = []
  let cursor = node
  let guard = 0
  while (cursor && guard < 20) {
    guard++
    if (cursor.node_type === 'trigger') {
      cursor = byId[nextNodeId(edges, cursor.id)]
      continue
    }
    if (cursor.node_type === 'message') {
      const cfg = safeJson(cursor.config)
      if (cfg.text) messages.push(cfg.text)
      cursor = byId[nextNodeId(edges, cursor.id)]
      continue
    }
    if (cursor.node_type === 'question') {
      const cfg = safeJson(cursor.config)
      if (cfg.text) messages.push(cfg.text)
      return { messages, nextNodeId: cursor.id, finished: false, awaitingAnswer: true }
    }
    if (cursor.node_type === 'condition') {
      // condicao simples: usa a config.field/value contra variaveis salvas (nao implementado em profundidade)
      const targetId = nextNodeId(edges, cursor.id, 'default') || nextNodeId(edges, cursor.id)
      cursor = byId[targetId]
      continue
    }
    if (cursor.node_type === 'wait') {
      const targetId = nextNodeId(edges, cursor.id)
      return { messages, nextNodeId: cursor.id, finished: false, waitMs: (safeJson(cursor.config).minutes || 1) * 60000, resumeNodeId: targetId }
    }
    if (cursor.node_type === 'reminder') {
      const cfg = safeJson(cursor.config)
      if (cfg.text) messages.push(cfg.text)
      cursor = byId[nextNodeId(edges, cursor.id)]
      continue
    }
    if (cursor.node_type === 'end') {
      return { messages, nextNodeId: null, finished: true }
    }
    break
  }
  return { messages, nextNodeId: cursor ? cursor.id : null, finished: !cursor }
}

function safeJson(v) { try { return typeof v === 'string' ? JSON.parse(v) : (v || {}) } catch (e) { return {} } }

module.exports = { getFlowGraph, findActiveFlowForTrigger, step }
