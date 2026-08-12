const express = require('express')
const jwt = require('jsonwebtoken')
const pool = require('../db')
const crm = require('../services/crm')
const ai = require('../services/ai')
const wa = require('../services/whatsapp')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const monthlyUploadDir = path.join(__dirname, '..', 'assets', 'monthly')
if (!fs.existsSync(monthlyUploadDir)) fs.mkdirSync(monthlyUploadDir, { recursive: true })
const monthlyUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, monthlyUploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || ''
      cb(null, 'block_' + Date.now() + '_' + Math.round(Math.random() * 1e9) + ext)
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }
})
function currentMonthKey() {
  const d = new Date()
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0')
}

const router = express.Router()
const JWT_SECRET = process.env.CRM_JWT_SECRET

// Mesma logica de autenticacao do crm-server (Bearer JWT), para ficar atras do login existente do CRM.
function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ success: false, error: 'Sem token' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch (e) {
    return res.status(401).json({ success: false, error: 'Token invalido ou expirado' })
  }
}

router.get('/status', auth, async (req, res) => {
  try {
    const live = wa.getStatus()
    if (live && live.status && live.status !== 'disconnected') {
      return res.json({ success: true, ...live })
    }
    try {
      const [[conn]] = await pool.query('SELECT phone_number FROM whatsapp_connections ORDER BY updated_at DESC LIMIT 1')
      return res.json({ success: true, ...live, phone_number: (live && live.phone_number) || (conn && conn.phone_number) || null })
    } catch (dbErr) {
      console.error('[api] status: fallback legado indisponivel:', dbErr.message)
      return res.json({ success: true, ...live })
    }
  } catch (e) {
    console.error('[api] erro ao ler status:', e.message)
    return res.status(500).json({ success: false, error: 'status indisponivel' })
  }
})

router.get('/conversations', auth, async (req, res) => {
  const [rows] = await pool.query(
      "SELECT wc.*, d.owner_name AS deal_owner_name, " +
      "(SELECT sent_by FROM whatsapp_messages wm WHERE wm.conversation_id = wc.id ORDER BY wm.id DESC LIMIT 1) AS last_sent_by, " +
      "(SELECT created_at FROM whatsapp_messages wm WHERE wm.conversation_id = wc.id ORDER BY wm.id DESC LIMIT 1) AS last_msg_created_at, " +
      "(SELECT content FROM whatsapp_messages wm WHERE wm.conversation_id = wc.id ORDER BY wm.id DESC LIMIT 1) AS last_msg_content, " +
      "(SELECT message_type FROM whatsapp_messages wm WHERE wm.conversation_id = wc.id ORDER BY wm.id DESC LIMIT 1) AS last_msg_type " +
      "FROM whatsapp_conversations wc LEFT JOIN deals d ON d.id = wc.deal_id " +
      "ORDER BY wc.last_message_at DESC LIMIT 300"
    )
  res.json({ success: true, conversations: rows })
})

router.get('/conversations/:id/messages', auth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM whatsapp_messages WHERE conversation_id = ? ORDER BY id ASC', [req.params.id])
  res.json({ success: true, messages: rows })
})

router.post('/conversations/:id/toggle-ai', auth, async (req, res) => {
  const { ai_enabled } = req.body
  await pool.query('UPDATE whatsapp_conversations SET ai_enabled = ? WHERE id = ?', [ai_enabled ? 1 : 0, req.params.id])
  res.json({ success: true })
})

// Envio manual de mensagem (Diego/equipe assume a conversa); desliga a IA automaticamente.
router.post('/conversations/:id/send', auth, async (req, res) => {
  try {
    const { text } = req.body
    if (!text || !String(text).trim()) return res.status(400).json({ success: false, error: 'text obrigatorio' })
    await wa.sendManualMessage(req.params.id, String(text).trim())
    res.json({ success: true })
  } catch (e) {
    console.error('[api] erro ao enviar mensagem manual:', e.message)
    res.status(500).json({ success: false, error: e.message })
  }
})

const attachmentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const fsx = require('fs')
    const dir = require('path').join(__dirname, '..', 'assets', 'manual_attachments')
    try { fsx.mkdirSync(dir, { recursive: true }) } catch (e) {}
    cb(null, dir)
  },
  filename: function (req, file, cb) {
    const ext = require('path').extname(file.originalname || '') || ''
    cb(null, 'att_' + Date.now() + '_' + Math.round(Math.random() * 1e9) + ext)
  }
})
const attachmentUpload = multer({ storage: attachmentStorage, limits: { fileSize: 64 * 1024 * 1024 } })

function mediaTypeFromMimetype(mimetype) {
  if (!mimetype) return 'document'
  if (mimetype.startsWith('image/')) return 'image'
  if (mimetype.startsWith('video/')) return 'video'
  if (mimetype.startsWith('audio/')) return 'audio'
  return 'document'
}

// Envio manual de anexo (documento/foto/video) pela equipe; reusa sendImage/sendVideo/sendDocument/sendAudio.
const recordingStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const fsx = require('fs')
    const dir = require('path').join(__dirname, '..', 'assets', 'manual_recordings')
    try { fsx.mkdirSync(dir, { recursive: true }) } catch (e) {}
    cb(null, dir)
  },
  filename: function (req, file, cb) {
    cb(null, 'rec_' + Date.now() + '_' + Math.round(Math.random() * 1e9) + '.input')
  }
})
const recordingUpload = multer({ storage: recordingStorage, limits: { fileSize: 20 * 1024 * 1024 } })

// Envio de audio gravado no navegador (MediaRecorder, geralmente webm/opus); transcodifica para ogg/opus via ffmpeg antes de enviar pelo Baileys.
router.post('/conversations/:id/send-recorded-audio', auth, recordingUpload.single('file'), async (req, res) => {
  const { execFile } = require('child_process')
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'arquivo obrigatorio' })
    const inputPath = req.file.path
    const outputPath = inputPath.replace(/\.input$/, '.ogg')
    await new Promise((resolve, reject) => {
      execFile('ffmpeg', ['-y', '-i', inputPath, '-c:a', 'libopus', '-b:a', '64k', '-ar', '48000', '-ac', '1', outputPath], { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) return reject(new Error('falha ao converter audio (ffmpeg): ' + (stderr ? String(stderr).slice(0, 300) : err.message)))
        resolve()
      })
    })
    await wa.sendManualMedia(req.params.id, outputPath, 'audio', {})
    res.json({ success: true })
  } catch (e) {
    console.error('[api] erro ao enviar audio gravado:', e.message)
    res.status(500).json({ success: false, error: e.message })
  }
})

router.get('/media', auth, (req, res) => {
  try {
    var rel = String(req.query.path || '')
    if (!rel || rel.indexOf('..') !== -1 || !/^assets\//.test(rel)) {
      return res.status(400).json({ success: false, error: 'path invalido' })
    }
    var assetsRoot = path.resolve(path.join(__dirname, '..', 'assets'))
    var fullPath = path.resolve(path.join(__dirname, '..', rel))
    if (fullPath.indexOf(assetsRoot + path.sep) !== 0) {
      return res.status(400).json({ success: false, error: 'path invalido' })
    }
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: 'arquivo nao encontrado' })
    }
    res.sendFile(fullPath)
  } catch (e) {
    console.error('[api] erro ao servir media:', e.message)
    res.status(500).json({ success: false, error: e.message })
  }
})

router.post('/conversations/:id/send-attachment', auth, attachmentUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'arquivo obrigatorio' })
    const mediaType = mediaTypeFromMimetype(req.file.mimetype)
    await wa.sendManualMedia(req.params.id, req.file.path, mediaType, {
      caption: req.body.caption || '',
      fileName: req.file.originalname,
      mimetype: req.file.mimetype
    })
    res.json({ success: true, mediaType })
  } catch (e) {
    console.error('[api] erro ao enviar anexo manual:', e.message)
    res.status(500).json({ success: false, error: e.message })
  }
})

// ===== Media Central (biblioteca de midias reutilizaveis) =====
const mediaLibraryDir = path.join(__dirname, '..', 'assets', 'media_library')
if (!fs.existsSync(mediaLibraryDir)) fs.mkdirSync(mediaLibraryDir, { recursive: true })
const mediaLibraryStorage = multer.diskStorage({
destination: function (req, file, cb) { cb(null, mediaLibraryDir) },
filename: function (req, file, cb) {
const ext = path.extname(file.originalname || '') || ''
cb(null, 'lib_' + Date.now() + '_' + Math.round(Math.random() * 1e9) + ext)
}
})
const mediaLibraryUpload = multer({ storage: mediaLibraryStorage, limits: { fileSize: 64 * 1024 * 1024 } })

router.get('/media-library', auth, async (req, res) => {
try {
const [rows] = await pool.query('SELECT * FROM media_library ORDER BY category, position, id')
res.json({ success: true, items: rows })
} catch (e) {
console.error('[api] erro ao listar media library:', e.message)
res.status(500).json({ success: false, error: e.message })
}
})

router.post('/media-library/upload', auth, mediaLibraryUpload.single('file'), async (req, res) => {
try {
if (!req.file) return res.status(400).json({ success: false, error: 'arquivo obrigatorio' })
const relPath = 'assets/media_library/' + req.file.filename
res.json({ success: true, path: relPath, fileName: req.file.originalname, mimetype: req.file.mimetype })
} catch (e) {
console.error('[api] erro ao enviar arquivo da media library:', e.message)
res.status(500).json({ success: false, error: e.message })
}
})

router.post('/media-library', auth, async (req, res) => {
try {
const { type, title, category, content, fileName, mimetype } = req.body
if (!type || ['text','image','video','audio','document'].indexOf(type) === -1) return res.status(400).json({ success: false, error: 'tipo invalido' })
if (!title || !String(title).trim()) return res.status(400).json({ success: false, error: 'titulo obrigatorio' })
if (!content || !String(content).trim()) return res.status(400).json({ success: false, error: 'conteudo obrigatorio' })
const [result] = await pool.query(
'INSERT INTO media_library (type, title, content, category, file_name, mimetype) VALUES (?, ?, ?, ?, ?, ?)',
[type, String(title).trim(), content, category || null, fileName || null, mimetype || null]
)
res.json({ success: true, id: result.insertId })
} catch (e) {
console.error('[api] erro ao criar item da media library:', e.message)
res.status(500).json({ success: false, error: e.message })
}
})

router.delete('/media-library/:id', auth, async (req, res) => {
try {
const [[item]] = await pool.query('SELECT * FROM media_library WHERE id = ?', [req.params.id])
if (item && item.type !== 'text') {
try {
const fullPath = path.join(__dirname, '..', item.content)
if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
} catch (e) {}
}
await pool.query('DELETE FROM media_library WHERE id = ?', [req.params.id])
res.json({ success: true })
} catch (e) {
console.error('[api] erro ao remover item da media library:', e.message)
res.status(500).json({ success: false, error: e.message })
}
})

router.patch('/media-library/:id', auth, async (req, res) => {
try {
const [[existing]] = await pool.query('SELECT * FROM media_library WHERE id = ?', [req.params.id])
if (!existing) return res.status(404).json({ success: false, error: 'item nao encontrado' })
const { type, title, content, category, position, fileName, mimetype } = req.body
const updates = []
const params = []
if (type !== undefined) {
if (['text','image','video','audio','document','empty'].indexOf(type) === -1) return res.status(400).json({ success: false, error: 'tipo invalido' })
updates.push('type = ?'); params.push(type)
}
if (title !== undefined) { updates.push('title = ?'); params.push(String(title).trim() || 'vazio') }
if (content !== undefined) { updates.push('content = ?'); params.push(content || null) }
if (category !== undefined) { updates.push('category = ?'); params.push(category || null) }
if (position !== undefined) { updates.push('position = ?'); params.push(position) }
if (fileName !== undefined) { updates.push('file_name = ?'); params.push(fileName || null) }
if (mimetype !== undefined) { updates.push('mimetype = ?'); params.push(mimetype || null) }
if (!updates.length) return res.status(400).json({ success: false, error: 'nada para atualizar' })
if (existing.content && existing.type !== 'text' && existing.type !== 'empty' && type !== undefined && (type !== existing.type || (content !== undefined && content !== existing.content))) {
try {
const oldPath = path.join(__dirname, '..', existing.content)
if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
} catch (e) {}
}
params.push(req.params.id)
await pool.query('UPDATE media_library SET ' + updates.join(', ') + ' WHERE id = ?', params)
const [[updated]] = await pool.query('SELECT * FROM media_library WHERE id = ?', [req.params.id])
res.json({ success: true, item: updated })
} catch (e) {
console.error('[api] erro ao editar item da media library:', e.message)
res.status(500).json({ success: false, error: e.message })
}
})


router.post('/conversations/:id/send-media-library/:itemId', auth, async (req, res) => {
try {
const [[item]] = await pool.query('SELECT * FROM media_library WHERE id = ?', [req.params.itemId])
if (!item) return res.status(404).json({ success: false, error: 'item nao encontrado' })
if (item.type === 'empty' || !item.content) return res.status(400).json({ success: false, error: 'Este item ainda esta vazio. Clique em editar para configurar antes de enviar.' })
if (item.type === 'text') {
await wa.sendManualMessage(req.params.id, item.content)
} else {
const fullPath = path.join(__dirname, '..', item.content)
await wa.sendManualMedia(req.params.id, fullPath, item.type, {
fileName: item.file_name || item.title,
mimetype: item.mimetype || undefined
})
}
await pool.query('UPDATE media_library SET usage_count = usage_count + 1 WHERE id = ?', [req.params.itemId])
res.json({ success: true })
} catch (e) {
console.error('[api] erro ao enviar item da media library:', e.message)
res.status(500).json({ success: false, error: e.message })
}
})
// ===== fim Media Central =====


router.get('/conversations/:id/sidebar', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.deal_id AS dealId, d.title, d.tags, d.lead_score, d.resumo_crm, d.stage_tag, d.notas_manuais, d.interesse
       FROM whatsapp_conversations c
       LEFT JOIN deals d ON d.id = c.deal_id
       WHERE c.id = ?`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ success: false, error: 'conversa nao encontrada' })
    const row = rows[0]
    let tags = []
    try { tags = row.tags ? JSON.parse(row.tags) : [] } catch (e) { tags = [] }
    res.json({
      success: true,
      dealId: row.dealId || null,
      dealTitle: row.title || null,
      tags,
      leadScore: row.lead_score,
      resumo: row.resumo_crm || null,
      notasManuais: row.notas_manuais || null,
      interesse: row.interesse || null,
      stageTag: row.stage_tag || null
    })
  } catch (e) {
    console.error('[api] erro ao buscar sidebar da conversa:', e.message)
    res.status(500).json({ success: false, error: e.message })
  }
})

router.patch('/conversations/:id/deal-meta', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.deal_id AS dealId FROM whatsapp_conversations c WHERE c.id = ?`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ success: false, error: 'conversa nao encontrada' })
    const dealId = rows[0].dealId
    if (!dealId) return res.status(400).json({ success: false, error: 'esta conversa nao esta vinculada a um negocio' })

    const updates = []
    const params = []
    if (req.body.tags !== undefined) {
      if (!Array.isArray(req.body.tags) || !req.body.tags.every(t => typeof t === 'string')) {
        return res.status(400).json({ success: false, error: 'tags deve ser uma lista de textos' })
      }
      updates.push('tags = ?')
      params.push(JSON.stringify(req.body.tags))
    }
    if (req.body.leadScore !== undefined) {
      const score = req.body.leadScore
      if (score !== null && (!Number.isInteger(score) || score < 1 || score > 5)) {
        return res.status(400).json({ success: false, error: 'leadScore deve ser um numero inteiro de 1 a 5 (ou null)' })
      }
      updates.push('lead_score = ?')
      params.push(score)
    }
    if (req.body.notasManuais !== undefined) {
      const notas = req.body.notasManuais
      if (notas !== null && typeof notas !== 'string') {
        return res.status(400).json({ success: false, error: 'notasManuais deve ser texto (ou null)' })
      }
      updates.push('notas_manuais = ?')
      params.push(notas === null ? null : notas.slice(0, 5000))
    }
    if (!updates.length) return res.status(400).json({ success: false, error: 'nada para atualizar' })

    if (req.body.interesse !== undefined) {
      const interesse = req.body.interesse
      if (interesse !== null && typeof interesse !== 'string') {
        return res.status(400).json({ success: false, error: 'interesse deve ser texto (ou null)' })
      }
      updates.push('interesse = ?')
      params.push(interesse)
    }
    params.push(dealId)
    await pool.query('UPDATE deals SET ' + updates.join(', ') + ' WHERE id = ?', params)
    res.json({ success: true })
  } catch (e) {
    console.error('[api] erro ao atualizar deal-meta:', e.message)
    res.status(500).json({ success: false, error: e.message })
  }
})

router.get('/labels', auth, async (req, res) => {
  try {
    const [labels] = await pool.query(
      `SELECT id, name, color FROM labels WHERE active = 1 ORDER BY name`
    )
    res.json({ success: true, labels })
  } catch (e) {
    console.error('[api] erro ao buscar labels:', e.message)
    res.status(500).json({ success: false, error: e.message })
  }
})

// ---- Configuracao do agente de IA (Vive) ----
router.get('/ai-config', auth, async (req, res) => {
  const cfg = await ai.getConfig()
  res.json({ success: true, config: cfg })
})

router.post('/ai-config', auth, async (req, res) => {
  const body = req.body || {}
  for (const key of Object.keys(body)) {
    await ai.setConfig(key, typeof body[key] === 'string' ? body[key] : JSON.stringify(body[key]))
  }
  res.json({ success: true })
})

router.post('/ai-config/toggle-global', auth, async (req, res) => {
  const { enabled } = req.body || {}
  const value = enabled ? 'true' : 'false'
  await ai.setConfig('ai_globally_enabled', value)
  res.json({ success: true, ai_globally_enabled: value === 'true' })
})


// ---- Editor de prompt assistido por IA (Orientacao do Robo) ----
// Guarda revisoes pendentes em memoria (nao no banco) ate confirmacao explicita
// feita pela pessoa na tela. Nada e gravado em chatbot_ai_config antes disso.
const pendingPromptRevisions = new Map()

router.post('/chatbot/prompt-editor', auth, async (req, res) => {
  try {
    const instruction = (req.body || {}).instruction
    const imageDataUrl = (req.body || {}).imageDataUrl
    if ((!instruction || !instruction.trim()) && !imageDataUrl) {
      return res.status(400).json({ success: false, error: 'Instrucao vazia.' })
    }
    const cfg = await ai.getConfig()
    const currentPrompt = cfg.system_prompt || ''
    const result = await ai.reviseSystemPrompt(currentPrompt, instruction, imageDataUrl)
    const revisionId = 'rev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    pendingPromptRevisions.set(revisionId, { before: currentPrompt, after: result.revised_prompt, createdAt: Date.now() })
    for (const [id, rev] of pendingPromptRevisions) {
      if (Date.now() - rev.createdAt > 30 * 60 * 1000) pendingPromptRevisions.delete(id)
    }
    res.json({
      success: true,
      revisionId,
      before: currentPrompt,
      after: result.revised_prompt,
      changeSummary: result.change_summary,
      applied: result.applied
    })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.post('/chatbot/prompt-editor/confirm', auth, async (req, res) => {
  try {
    const revisionId = (req.body || {}).revisionId
    const rev = revisionId && pendingPromptRevisions.get(revisionId)
    if (!rev) return res.status(404).json({ success: false, error: 'Revisao nao encontrada ou expirada. Gere a revisao novamente.' })
    await ai.setConfig('system_prompt', rev.after)
    pendingPromptRevisions.delete(revisionId)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// ---- Fluxos visuais ----
// ---- Fluxo Mensal: blocos de mensagem (estilo ManyChat) ----
router.get('/monthly-message', auth, async (req, res) => {
  try {
    const monthKey = req.query.month_key || currentMonthKey()
    const [rows] = await pool.query('SELECT * FROM chatbot_monthly_message_blocks WHERE month_key = ? ORDER BY block_order ASC, id ASC', [monthKey])
    res.json({ success: true, month_key: monthKey, blocks: rows })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.put('/monthly-message', auth, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    const monthKey = req.body.month_key || currentMonthKey()
    const blocks = Array.isArray(req.body.blocks) ? req.body.blocks : []
    await conn.beginTransaction()
    await conn.query('DELETE FROM chatbot_monthly_message_blocks WHERE month_key = ?', [monthKey])
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]
      if (!b || !['text', 'audio', 'video'].includes(b.block_type)) continue
      await conn.query(
        'INSERT INTO chatbot_monthly_message_blocks (month_key, block_order, block_type, text_content, media_path) VALUES (?, ?, ?, ?, ?)',
        [monthKey, i, b.block_type, b.text_content || null, b.media_path || null]
      )
    }
    await conn.commit()
    res.json({ success: true, month_key: monthKey })
  } catch (e) {
    await conn.rollback()
    res.status(500).json({ success: false, error: e.message })
  } finally {
    conn.release()
  }
})

router.post('/monthly-message/upload', auth, monthlyUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' })
  const relPath = 'assets/monthly/' + req.file.filename
  res.json({ success: true, media_path: relPath, url: '/assets/monthly/' + req.file.filename })
})

router.get('/flows', auth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM chatbot_flows ORDER BY id DESC')
  res.json({ success: true, flows: rows })
})

router.post('/flows', auth, async (req, res) => {
  const { name, description, trigger_keyword } = req.body
  const [r] = await pool.query('INSERT INTO chatbot_flows (name, description, trigger_keyword) VALUES (?, ?, ?)', [name, description || null, trigger_keyword || null])
  res.json({ success: true, id: r.insertId })
})

router.get('/flows/:id', auth, async (req, res) => {
  const [[flow]] = await pool.query('SELECT * FROM chatbot_flows WHERE id = ?', [req.params.id])
  const [nodes] = await pool.query('SELECT * FROM chatbot_flow_nodes WHERE flow_id = ?', [req.params.id])
  const [edges] = await pool.query('SELECT * FROM chatbot_flow_edges WHERE flow_id = ?', [req.params.id])
  res.json({ success: true, flow, nodes, edges })
})

router.put('/flows/:id', auth, async (req, res) => {
  const { name, description, trigger_keyword, is_active } = req.body
  await pool.query('UPDATE chatbot_flows SET name=?, description=?, trigger_keyword=?, is_active=? WHERE id=?',
    [name, description || null, trigger_keyword || null, is_active ? 1 : 0, req.params.id])
  res.json({ success: true })
})

router.delete('/flows/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM chatbot_flows WHERE id = ?', [req.params.id])
  res.json({ success: true })
})

// Salva o grafo inteiro (nos + arestas) de uma vez, como o editor visual envia ao clicar "Salvar".
router.put('/flows/:id/graph', auth, async (req, res) => {
  const flowId = req.params.id
  const { nodes, edges } = req.body
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query('DELETE FROM chatbot_flow_nodes WHERE flow_id = ?', [flowId])
    const idMap = {}
    for (const n of nodes) {
      const [r] = await conn.query(
        'INSERT INTO chatbot_flow_nodes (flow_id, node_type, label, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?)',
        [flowId, n.node_type, n.label || null, n.position_x || 0, n.position_y || 0, JSON.stringify(n.config || {})]
      )
      idMap[n.client_id || n.id] = r.insertId
    }
    for (const e of edges) {
      const src = idMap[e.source] || e.source
      const tgt = idMap[e.target] || e.target
      if (src && tgt) {
        await conn.query('INSERT INTO chatbot_flow_edges (flow_id, source_node_id, source_handle, target_node_id) VALUES (?, ?, ?, ?)',
          [flowId, src, e.source_handle || null, tgt])
      }
    }
    await conn.commit()
    res.json({ success: true })
  } catch (e) {
    await conn.rollback()
    res.status(500).json({ success: false, error: e.message })
  } finally {
    conn.release()
  }
})

// ---- Teste manual de criacao de deal (usado para validar a atribuicao de SDR) ----
router.get('/test/check-number', auth, async (req, res) => {
  try {
    const number = req.query.number
    if (!number) return res.status(400).json({ success: false, error: 'number obrigatorio' })
    const results = await wa.checkOnWhatsApp(number)
    res.json({ success: true, results })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.post('/test/send-native-audio-ack', auth, async (req, res) => {
  try {
    const { jid, filePath, timeoutMs } = req.body
    if (!jid || !filePath) return res.status(400).json({ success: false, error: 'jid e filePath obrigatorios' })
    const path = require('path')
    const abs = path.join(__dirname, '..', filePath)
    const ackResult = await wa.sendAudioWithAck(jid, abs, timeoutMs)
    res.json({ success: true, jid, ...ackResult })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.post('/test/fluxo-inicial', async (req, res) => {
  try {
    const { conversationId, patientName } = req.body
    if (!conversationId) return res.status(400).json({ success: false, error: 'conversationId obrigatorio' })
    const fluxoInicial = require('../services/fluxoInicial')
    await fluxoInicial.testTrigger(conversationId, patientName)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.post('/test/send-native-media', auth, async (req, res) => {
  try {
    const { phone, filePath, type } = req.body
    if (!phone || !filePath || !type) return res.status(400).json({ success: false, error: 'phone, filePath e type sao obrigatorios' })
    const jid = phone.includes('@') ? phone : phone.replace(/\D/g, '') + '@s.whatsapp.net'
    const path = require('path')
    const abs = path.join(__dirname, '..', filePath)
    if (type === 'audio') {
      await wa.sendAudio(jid, abs)
    } else if (type === 'video') {
      await wa.sendVideo(jid, abs)
    } else {
      return res.status(400).json({ success: false, error: 'type deve ser audio ou video' })
    }
    res.json({ success: true, sent_to: jid })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

router.post('/test/create-deal', auth, async (req, res) => {
  try {
    const { phone, name } = req.body
    const { patient, created } = await crm.findOrCreatePatient(phone, name || 'Teste SDR WhatsApp Bot')
    const deal = await crm.createDealForWhatsappLead({ patientId: patient.id, patientName: name, phone })
    res.json({ success: true, patient, deal, patientCreated: created })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})


// ---- Dashboard de metricas (mensagens WhatsApp + ligacoes) ----
async function ddCountDedupedActivityAll(pool, actType, fromDt, toDt) {
  const [rawRows] = await pool.query(
    "SELECT a.deal_id AS dealId, a.created_at AS createdAt, a.content AS content FROM activities a WHERE a.deal_id IS NOT NULL AND a.type = ? AND a.created_at BETWEEN ? AND ? ORDER BY a.deal_id, a.created_at ASC",
    [actType, fromDt, toDt]
  )
  const CONFIRM_MARKER = 'autorizada e confirmada pelo responsavel'
  const groups = {}
  for (const r of rawRows) { if (!groups[r.dealId]) groups[r.dealId] = []; groups[r.dealId].push(r) }
  let total = 0
  for (const dId in groups) {
    const list = groups[dId]
    let lastKeptTime = null
    for (const r of list) {
      const t = new Date(r.createdAt).getTime()
      const isConfirmed = !!(r.content && r.content.indexOf(CONFIRM_MARKER) !== -1)
      let counts = true
      if (lastKeptTime !== null && !isConfirmed) {
        const gapSec = (t - lastKeptTime) / 1000
        if (gapSec < 120) counts = false
      }
      if (counts) { lastKeptTime = t; total++ }
    }
  }
  return total
}

async function ddCountDedupedActivityByOwner(pool, actType, fromDt, toDt) {
  // Mesma logica de dedup usada na tela SDRs (crm-server/crm-ui-api.js: ddCountDedupedActivity),
  // aplicada de uma vez para todos os owners (usado no card de ligacoes do Dashboard).
  const [rawRows] = await pool.query(
    "SELECT a.deal_id AS dealId, d.owner_name AS ownerName, a.created_at AS createdAt, a.content AS content FROM activities a JOIN deals d ON d.id = a.deal_id WHERE a.type = ? AND a.created_at BETWEEN ? AND ? ORDER BY a.deal_id, a.created_at ASC",
    [actType, fromDt, toDt]
  )
  const CONFIRM_MARKER = 'autorizada e confirmada pelo responsavel'
  const groups = {}
  for (const r of rawRows) { if (!groups[r.dealId]) groups[r.dealId] = []; groups[r.dealId].push(r) }
  const byOwner = {}
  for (const dId in groups) {
    const list = groups[dId]
    const ownerName = (list[0] && list[0].ownerName) || 'Sem responsavel'
    let lastKeptTime = null
    for (const r of list) {
      const t = new Date(r.createdAt).getTime()
      const isConfirmed = !!(r.content && r.content.indexOf(CONFIRM_MARKER) !== -1)
      let counts = true
      if (lastKeptTime !== null && !isConfirmed) {
        const gapSec = (t - lastKeptTime) / 1000
        if (gapSec < 120) counts = false
      }
      if (counts) { lastKeptTime = t; byOwner[ownerName] = (byOwner[ownerName] || 0) + 1 }
    }
  }
  return byOwner
}

router.get('/dashboard/metrics', auth, async (req, res) => {
  try {
    const from = String(req.query.from || '').trim()
    const to = String(req.query.to || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ success: false, error: 'Parametros from/to sao obrigatorios no formato YYYY-MM-DD' })
    }
    const fromDt = from + ' 00:00:00'
    const toDt = to + ' 23:59:59'

    const [msgRows] = await pool.query(
      'SELECT direction, COUNT(*) AS c FROM whatsapp_messages WHERE created_at BETWEEN ? AND ? GROUP BY direction',
      [fromDt, toDt]
    )
    let messagesSent = 0, messagesReceived = 0
    msgRows.forEach(r => { if (r.direction === 'out') messagesSent = Number(r.c); else if (r.direction === 'in') messagesReceived = Number(r.c) })

    const [msgOwnerRows] = await pool.query(
      "SELECT d.owner_name AS ownerName, wm.direction AS direction, COUNT(*) AS c FROM whatsapp_messages wm JOIN whatsapp_conversations wc ON wc.id = wm.conversation_id LEFT JOIN deals d ON d.id = wc.deal_id WHERE wm.created_at BETWEEN ? AND ? GROUP BY d.owner_name, wm.direction",
      [fromDt, toDt]
    )
    const messagesSentByOwner = {}, messagesReceivedByOwner = {}
    msgOwnerRows.forEach(r => {
      const ownerName = r.ownerName || 'Sem responsavel'
      if (r.direction === 'out') messagesSentByOwner[ownerName] = (messagesSentByOwner[ownerName] || 0) + Number(r.c)
      else if (r.direction === 'in') messagesReceivedByOwner[ownerName] = (messagesReceivedByOwner[ownerName] || 0) + Number(r.c)
    })

    const callsMade = await ddCountDedupedActivityAll(pool, 'Chamada Realizada', fromDt, toDt)
    const callsAnswered = await ddCountDedupedActivityAll(pool, 'Ligação Atendida', fromDt, toDt)
    const callsMadeByOwner = await ddCountDedupedActivityByOwner(pool, 'Chamada Realizada', fromDt, toDt)
    const callsAnsweredByOwner = await ddCountDedupedActivityByOwner(pool, 'Ligação Atendida', fromDt, toDt)

    const [respRows] = await pool.query(`
      SELECT AVG(gap_sec) AS avgSec, COUNT(*) AS n FROM (
        SELECT
          direction,
          LAG(direction) OVER (PARTITION BY conversation_id ORDER BY created_at, id) AS prevDir,
          TIMESTAMPDIFF(SECOND, LAG(created_at) OVER (PARTITION BY conversation_id ORDER BY created_at, id), created_at) AS gap_sec
        FROM whatsapp_messages
        WHERE created_at BETWEEN ? AND ?
      ) t
      WHERE direction = 'out' AND prevDir = 'in'
    `, [fromDt, toDt])
    const avgResponseSeconds = (respRows[0] && respRows[0].avgSec !== null) ? Math.round(Number(respRows[0].avgSec)) : null
    const avgResponseSamples = respRows[0] ? Number(respRows[0].n) : 0

    const [respOwnerRows] = await pool.query(
      "SELECT d.owner_name AS ownerName, AVG(t.gap_sec) AS avgSec, COUNT(*) AS n FROM (SELECT wc.deal_id AS dealId, wm.direction AS direction, LAG(wm.direction) OVER (PARTITION BY wm.conversation_id ORDER BY wm.created_at, wm.id) AS prevDir, TIMESTAMPDIFF(SECOND, LAG(wm.created_at) OVER (PARTITION BY wm.conversation_id ORDER BY wm.created_at, wm.id), wm.created_at) AS gap_sec FROM whatsapp_messages wm JOIN whatsapp_conversations wc ON wc.id = wm.conversation_id WHERE wm.created_at BETWEEN ? AND ?) t LEFT JOIN deals d ON d.id = t.dealId WHERE t.direction = 'out' AND t.prevDir = 'in' GROUP BY d.owner_name",
      [fromDt, toDt]
    )
    const avgResponseByOwner = {}
    respOwnerRows.forEach(r => {
      const ownerName = r.ownerName || 'Sem responsavel'
      avgResponseByOwner[ownerName] = {
        avgResponseSeconds: (r.avgSec !== null) ? Math.round(Number(r.avgSec)) : null,
        avgResponseSamples: Number(r.n)
      }
    })

    res.json({
      success: true,
      period: { from, to },
      messagesSent,
      messagesReceived,
      messagesSentByOwner,
      messagesReceivedByOwner,
      callsMade,
      callsAnswered,
      callsMadeByOwner,
      callsAnsweredByOwner,
      callsReceived: null,
      callsReceivedNote: 'Nao ha registro de ligacoes recebidas pelo lead no sistema atualmente (sem integracao de telefonia/PABX).',
      avgResponseSeconds,
      avgResponseSamples,
      avgResponseByOwner
    })
  } catch (e) {
    console.error('[whatsapp-bot] dashboard/metrics error', e)
    res.status(500).json({ success: false, error: 'Erro interno' })
  }
})

router.post('/test/send-cadence-full', auth, async (req, res) => {
  try {
    const { phone, only } = req.body
    if (!phone) return res.status(400).json({ success: false, error: 'phone obrigatorio' })
    const shouldRun = (key) => !only || !only.length || only.includes(key)
    const path = require('path')
    const results = await wa.checkOnWhatsApp(phone)
    const jid = (results && results[0] && results[0].jid) ? results[0].jid : (phone.replace(/\D/g, '') + '@s.whatsapp.net')

    const sent = []
    const skipped = []
    const sleep = (ms) => new Promise(r => setTimeout(r, ms))

    async function getCfg(key) {
      const [[row]] = await pool.query('SELECT config_value FROM chatbot_ai_config WHERE config_key = ?', [key])
      return row ? row.config_value : null
    }

    async function sendTextBubbles(raw, replacements) {
      if (!raw) return false
      let text = raw
      for (const [k, v] of Object.entries(replacements || {})) {
        text = text.split(k).join(v)
      }
      const parts = text.split('|||').map(p => p.trim()).filter(Boolean)
      for (const part of parts) {
        await wa.sendText(jid, part)
        await sleep(2500)
      }
      return true
    }

    // Fluxo Inicial (seq_step1..4)
    const labelSends = shouldRun('trigger') || shouldRun('step1') || shouldRun('step2') || shouldRun('step3') || shouldRun('step4')

    const triggerAudio = shouldRun('trigger') ? await getCfg('seq_trigger_audio_path') : null
    if (triggerAudio) {
      await wa.sendText(jid, '--- Isso e o que chega aos 5 SEGUNDOS (audio de abertura) ---')
      await sleep(800)
      await wa.sendAudioWithAck(jid, path.join(__dirname, '..', triggerAudio), 15000)
      sent.push('Fluxo Inicial - audio de abertura (trigger, T+5s)')
      await sleep(1500)
    } else skipped.push('Fluxo Inicial - audio de abertura (config ausente)')

    const step1 = shouldRun('step1') ? await getCfg('seq_step1_content') : null
    if (step1) {
      await wa.sendText(jid, '--- Isso e o que chega aos 5 MINUTOS ---')
      await sleep(800)
      await wa.sendAudioWithAck(jid, path.join(__dirname, '..', step1), 15000)
      sent.push('Fluxo Inicial - step1 (audio, T+5min)')
      await sleep(1500)
    } else skipped.push('Fluxo Inicial - step1 audio (config ausente)')

    const rep = { '{nome}': 'Diego', '{owner}': 'Agda' }
    if (shouldRun('step2')) {
      await wa.sendText(jid, '--- Isso e o que chega aos 20 MINUTOS ---')
      await sleep(800)
      if (await sendTextBubbles(await getCfg('seq_step2_content'), rep)) sent.push('Fluxo Inicial - step2 (texto, T+20min)')
    }
    if (shouldRun('step3')) {
      await wa.sendText(jid, '--- Isso e o que chega aos 50 MINUTOS ---')
      await sleep(800)
      if (await sendTextBubbles(await getCfg('seq_step3_content'), rep)) sent.push('Fluxo Inicial - step3 (texto, T+50min)')
    }
    if (shouldRun('step4')) {
      await wa.sendText(jid, '--- Isso e o que chega aos 110 MINUTOS ---')
      await sleep(800)
      if (await sendTextBubbles(await getCfg('seq_step4_content'), rep)) sent.push('Fluxo Inicial - step4 (texto, {owner}, T+110min)')
    }

    // Fluxo de Cadencia (draft) D1..D5
    const repCad = { '[NOME]': 'Diego', '{owner do deal}': 'Agda', '{nome}': 'Diego' }

    if (shouldRun('d1') && await sendTextBubbles(await getCfg('cadencia_draft_d1_content'), repCad)) sent.push('Cadencia - dia-seguinte / D1 (texto)')
    else skipped.push('Cadencia - dia-seguinte / D1 (sem conteudo)')

    if (shouldRun('d2') && await sendTextBubbles(await getCfg('cadencia_draft_d2_content'), repCad)) sent.push('Cadencia - D+2 (texto)')
    const d2Audio = shouldRun('d2') ? await getCfg('cadencia_draft_d2_audio_path') : null
    if (d2Audio) {
      await wa.sendAudioWithAck(jid, path.join(__dirname, '..', d2Audio), 15000)
      sent.push('Cadencia - D+2 (audio Dr. Diego)')
      await sleep(1500)
    } else skipped.push('Cadencia - D+2 audio (nao confirmado)')

    if (shouldRun('d3') && await sendTextBubbles(await getCfg('cadencia_draft_d3_content'), repCad)) sent.push('Cadencia - D+3 (texto)')
    const d3Video = shouldRun('d3') ? await getCfg('cadencia_draft_d3_video_path') : null
    if (d3Video) {
      await wa.sendVideo(jid, path.join(__dirname, '..', d3Video))
      sent.push('Cadencia - D+3 (video)')
      await sleep(1500)
    } else skipped.push('Cadencia - D+3 video (ainda nao recebido)')

    if (shouldRun('d4') && await sendTextBubbles(await getCfg('cadencia_draft_d4_content'), repCad)) sent.push('Cadencia - D+4 (texto, caso Leticia)')
    const d4Images = shouldRun('d4') ? await getCfg('cadencia_draft_d4_image_paths') : null
    if (d4Images) {
      for (const imgPath of d4Images.split(',')) {
        await wa.sendImage(jid, path.join(__dirname, '..', imgPath.trim()))
        await sleep(2000)
      }
      sent.push('Cadencia - D+4 (imagens antes/depois Leticia, ' + d4Images.split(',').length + ' fotos)')
    } else skipped.push('Cadencia - D+4 imagens antes/depois (ainda nao recebidas)')

    if (shouldRun('d5') && await sendTextBubbles(await getCfg('cadencia_draft_d5_content'), repCad)) sent.push('Cadencia - D+5 (texto completo)')
    const d5Video = shouldRun('d5') ? await getCfg('cadencia_draft_d5_video_path') : null
    if (d5Video) {
      await wa.sendVideo(jid, path.join(__dirname, '..', d5Video))
      sent.push('Cadencia - D+5 (video depoimento)')
      await sleep(1500)
    } else skipped.push('Cadencia - D+5 video de depoimento (ainda nao recebido)')
    if (shouldRun('d5') && await sendTextBubbles(await getCfg('cadencia_draft_d5_cta_content'), repCad)) sent.push('Cadencia - D+5 (CTA final apos video)')

    res.json({ success: true, sent_to: jid, sent, skipped })
  } catch (e) {
    console.error('[api] erro em /test/send-cadence-full:', e.message)
    res.status(500).json({ success: false, error: e.message })
  }
})

router.post('/test/send-raw-text', auth, async (req, res) => {
  try {
    const { phone, text } = req.body
    if (!phone || !text) return res.status(400).json({ success: false, error: 'phone e text obrigatorios' })
    const results = await wa.checkOnWhatsApp(phone)
    const jid = (results && results[0] && results[0].jid) ? results[0].jid : (phone.replace(/\D/g, '') + '@s.whatsapp.net')
    const parts = text.split('|||').map(p => p.trim()).filter(Boolean)
    for (const part of parts) {
      await wa.sendText(jid, part)
      await new Promise(r => setTimeout(r, 2500))
    }
    res.json({ success: true, sent_to: jid, bubbles: parts.length })
  } catch (e) {
    console.error('[api] erro em /test/send-raw-text:', e.message)
    res.status(500).json({ success: false, error: e.message })
  }
})

router.get('/connections', auth, async (req, res) => {
  try {
    const rows = await require('../services/connectionsStore').listConnections()
    res.json({ success: true, connections: rows })
  } catch (e) { console.error('[api] erro em /connections', e.message); res.status(500).json({ success: false, error: e.message }) }
})

router.post('/connections', auth, async (req, res) => {
  try {
    const label = req.body && req.body.label
    const conn = await require('../services/sessionManager').connectNew(label)
    res.json({ success: true, connection: conn })
  } catch (e) { console.error('[api] erro ao criar conexao', e.message); res.status(500).json({ success: false, error: e.message }) }
})

router.get('/connections/:id/qr', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const store = require('../services/connectionsStore')
    const conn = await store.getConnection(id)
    if (!conn) return res.status(404).json({ success: false, error: 'conexao nao encontrada' })
    const qr = await require('../services/sessionManager').getQr(id)
    res.json({ success: true, status: conn.status, qr: qr || conn.qr_code || null })
  } catch (e) { console.error('[api] erro em /connections/:id/qr', e.message); res.status(500).json({ success: false, error: e.message }) }
})

router.patch('/connections/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const body = req.body || {}
    const store = require('../services/connectionsStore')
    if (body.ai_enabled !== undefined || body.chatbot_enabled !== undefined) await store.setFlags(id, { ai_enabled: body.ai_enabled, chatbot_enabled: body.chatbot_enabled })
    if (body.label !== undefined) await pool.query('UPDATE whatsapp_connections SET label = ? WHERE id = ?', [body.label, id])
    const conn = await store.getConnection(id)
    res.json({ success: true, connection: conn })
  } catch (e) { console.error('[api] erro ao atualizar conexao', e.message); res.status(500).json({ success: false, error: e.message }) }
})

router.delete('/connections/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const conn = await require('../services/connectionsStore').getConnection(id)
    if (conn && conn.is_primary) return res.status(400).json({ success: false, error: 'Nao e possivel remover a conexao principal por aqui' })
    await require('../services/sessionManager').disconnect(id)
    await require('../services/connectionsStore').deleteConnection(id).catch(function(){});
    res.json({ success: true })
  } catch (e) { console.error('[api] erro ao remover conexao', e.message); res.status(500).json({ success: false, error: e.message }) }
})

router.patch('/flows/:id/connection', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const connectionId = req.body && req.body.connection_id ? parseInt(req.body.connection_id) : null
    await require('../services/connectionsStore').setFlowConnection(id, connectionId)
    res.json({ success: true })
  } catch (e) { console.error('[api] erro ao associar fluxo a conexao', e.message); res.status(500).json({ success: false, error: e.message }) }
})

module.exports = router

// ==== ROTAS: DISPARO MANUAL DE CADENCIA (adicionado - botao no CRM) ====
router.get('/cadence/steps', auth, async (req, res) => {
  try {
    const dealId = parseInt(req.query.dealId)
    if (!dealId) return res.status(400).json({ success: false, error: 'dealId obrigatorio' })
    const cadenceEngineManual = require('../services/cadenceEngine')
    const data = await cadenceEngineManual.listCadenceStepsForDeal(dealId)
    if (!data.deal) return res.status(404).json({ success: false, error: 'Deal nao encontrado' })
    res.json(Object.assign({ success: true }, data))
  } catch (e) {
    console.error('[api] erro /cadence/steps', e.message)
    res.status(500).json({ success: false, error: 'Erro interno' })
  }
})

router.post('/cadence/manual-send', auth, async (req, res) => {
  try {
    const body = req.body || {}
    const dealId = parseInt(body.dealId)
    const step = body.step
    if (!dealId || !step) return res.status(400).json({ success: false, error: 'dealId e step obrigatorios' })
    const actorName = (req.user && req.user.name) || 'usuario desconhecido'
    const cadenceEngineManual = require('../services/cadenceEngine')
    const result = await cadenceEngineManual.manualSendStep(dealId, step, actorName)
    if (!result.ok) return res.status(422).json({ success: false, error: result.detail || result.error, code: result.error, waitSeconds: result.waitSeconds })
    res.json({ success: true, step: result.step, dealId: result.dealId })
  } catch (e) {
    console.error('[api] erro /cadence/manual-send', e.message)
    res.status(500).json({ success: false, error: 'Erro interno ao disparar mensagem' })
  }
})
