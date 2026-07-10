const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const QRCode = require('qrcode');
const router = express.Router();

const config = require('./config');
const db = require('./db');
const baileysManager = require('./baileys-manager');
const pipedriveIntegration = require('./pipedrive-integration');

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// exige sessao logada; se a rota tem :sdrName, so deixa acessar o proprio painel
function authenticateSDR(req, res, next) {
  const sessionName = req.session?.sdr_name;
  if (!sessionName) return res.redirect('/login');
  if (req.params.sdrName && req.params.sdrName !== sessionName) {
    return res.status(403).send('Acesso negado');
  }
  req.sdr = sessionName;
  next();
}

router.get('/login', async (req, res) => {
  const sessions = await db.query('SELECT session_name, sdr_name, phone_number, status FROM whatsapp_sessions');
  res.render('login', { sessions, error: null });
});

router.post('/login', async (req, res) => {
  const { sessionName, password } = req.body;
  const expected = config.sdrPassword(sessionName);

  if (!expected || !safeEqual(password, expected)) {
    const sessions = await db.query('SELECT session_name, sdr_name, phone_number, status FROM whatsapp_sessions');
    return res.status(401).render('login', { sessions, error: 'Senha incorreta' });
  }

  req.session.sdr_name = sessionName;
  res.redirect(`/sdr/${sessionName}`);
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

router.get('/api/qr/:sessionName', async (req, res) => {
  const { sessionName } = req.params;
  const sess = await db.queryOne('SELECT qr_code, status FROM whatsapp_sessions WHERE session_name = ?', [sessionName]);
  if (!sess) return res.status(404).json({ error: 'Sessao nao encontrada' });

  let qr_image = null;
  if (sess.qr_code) {
    try {
      qr_image = await QRCode.toDataURL(sess.qr_code, { width: 320, margin: 1 });
    } catch (error) {
      console.error(`[QR] Erro ao gerar imagem: ${error.message}`);
    }
  }

  res.json({ status: sess.status, qr_image });
});

router.get('/sdr/:sdrName', authenticateSDR, async (req, res) => {
  const { sdrName } = req.params;

  try {
    const conversations = await db.query(
      `
      SELECT c.*,
             COUNT(DISTINCT m.id) as message_count,
             COUNT(DISTINCT ca.id) as call_count
      FROM whatsapp_conversations c
      LEFT JOIN whatsapp_messages m ON c.conversation_id = m.conversation_id
      LEFT JOIN whatsapp_calls ca ON c.conversation_id = ca.conversation_id
      WHERE c.assigned_to = ? AND c.status = 'active'
      GROUP BY c.id
      ORDER BY c.last_message_at DESC
    `,
      [sdrName]
    );

    const sessions = await db.query('SELECT session_name, status, phone_number FROM whatsapp_sessions WHERE sdr_name = ?', [
      sdrName,
    ]);

    const metrics = await db.queryOne('SELECT * FROM daily_metrics WHERE sdr_name = ? AND date = CURDATE()', [sdrName]);

    res.render('sdr-panel', { sdr: sdrName, conversations, sessions, metrics });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao carregar painel');
  }
});

router.post('/api/send-message', authenticateSDR, async (req, res) => {
  const { conversationId, text } = req.body;
  const sdrName = req.sdr;

  try {
    const conv = await db.queryOne('SELECT * FROM whatsapp_conversations WHERE conversation_id = ? AND assigned_to = ?', [
      conversationId,
      sdrName,
    ]);
    if (!conv) return res.status(403).json({ error: 'Conversa nao e sua' });

    await baileysManager.sendMessage(sdrName, conv.client_phone, text);

    const session = await db.queryOne('SELECT phone_number FROM whatsapp_sessions WHERE session_name = ?', [sdrName]);

    await db.query(
      `INSERT INTO whatsapp_messages
      (conversation_id, session_name, sdr_name, phone_number, from_number, from_type, text, direction, status)
      VALUES (?, ?, ?, ?, 'bot', 'sdr', ?, 'outbound', 'sent')`,
      [conversationId, sdrName, sdrName, session?.phone_number, text]
    );

    res.json({ status: 'sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// prepara a ligacao: se o numero da propria SDR estiver em chamada, sugere o numero
// de fallback (a outra SDR) em vez dele - a discagem em si e manual, feita no celular
router.post('/api/prepare-call', authenticateSDR, async (req, res) => {
  const { conversationId } = req.body;
  const sdrName = req.sdr;

  try {
    const conv = await db.queryOne('SELECT * FROM whatsapp_conversations WHERE conversation_id = ? AND assigned_to = ?', [
      conversationId,
      sdrName,
    ]);
    if (!conv) return res.status(403).json({ error: 'Conversa nao e sua' });

    const session = await db.queryOne('SELECT * FROM whatsapp_sessions WHERE session_name = ?', [sdrName]);
    if (!session) return res.status(400).json({ error: 'Sessao nao configurada' });

    let dialSession = session;
    let attemptedFromOther = false;

    if (session.in_call && session.fallback_session) {
      const fallback = await db.queryOne('SELECT * FROM whatsapp_sessions WHERE session_name = ?', [session.fallback_session]);
      if (fallback && fallback.status === 'connected' && !fallback.in_call) {
        dialSession = fallback;
        attemptedFromOther = true;
      }
    }

    await db.query(
      `INSERT INTO whatsapp_calls
      (conversation_id, session_name, sdr_name, phone_number, to_number, status, attempted_from_other)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [conversationId, dialSession.session_name, dialSession.session_name, dialSession.phone_number, conv.client_phone, attemptedFromOther]
    );

    res.json({
      status: 'ready',
      dial: `+${conv.client_phone}`,
      from: dialSession.phone_number,
      attemptedFromOther,
      instruction: attemptedFromOther
        ? `${sdrName} esta ocupada, ligar pelo numero de ${dialSession.session_name} para ${conv.client_name}`
        : `Ligar para ${conv.client_name}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/add-label', authenticateSDR, async (req, res) => {
  const { conversationId, label } = req.body;
  const sdrName = req.sdr;

  try {
    const conv = await db.queryOne('SELECT * FROM whatsapp_conversations WHERE conversation_id = ? AND assigned_to = ?', [
      conversationId,
      sdrName,
    ]);
    if (!conv) return res.status(403).json({ error: 'Conversa nao e sua' });

    const labels = db.parseJSON(conv.labels);
    if (!labels.includes(label)) labels.push(label);

    await db.query('UPDATE whatsapp_conversations SET labels = ? WHERE conversation_id = ?', [JSON.stringify(labels), conversationId]);

    if (conv.pipedrive_id) {
      await pipedriveIntegration.syncOutboundLabel(conversationId, conv.pipedrive_id, label);
    }

    res.json({ status: 'synced' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/conversation/:conversationId', authenticateSDR, async (req, res) => {
  const { conversationId } = req.params;
  const sdrName = req.sdr;

  try {
    const conv = await db.queryOne('SELECT * FROM whatsapp_conversations WHERE conversation_id = ? AND assigned_to = ?', [
      conversationId,
      sdrName,
    ]);
    if (!conv) return res.status(403).json({ error: 'Conversa nao encontrada' });

    const messages = await db.query('SELECT * FROM whatsapp_messages WHERE conversation_id = ? ORDER BY timestamp ASC', [
      conversationId,
    ]);
    const calls = await db.query('SELECT * FROM whatsapp_calls WHERE conversation_id = ? ORDER BY call_timestamp DESC', [
      conversationId,
    ]);

    res.json({ conversation: conv, messages, calls });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/webhook/pipedrive/deal', (req, res) => pipedriveIntegration.handleNewDeal(req, res));
router.post('/webhook/pipedrive/label', (req, res) => pipedriveIntegration.handleLabelAdded(req, res));

router.get('/dashboard', async (req, res) => {
  try {
    const metrics = await db.query(`
      SELECT sdr_name,
             SUM(total_conversations) as total_conv,
             AVG(avg_script_adherence) as avg_adherence,
             SUM(messages_conforming) as conforming,
             SUM(calls_answered) as calls_answered,
             AVG(avg_call_duration) as avg_duration
      FROM daily_metrics
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY sdr_name
    `);

    res.render('dashboard', { metrics });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao carregar dashboard');
  }
});

module.exports = router;
