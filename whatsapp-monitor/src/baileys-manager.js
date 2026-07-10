const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const db = require('./db');

const CALL_TERMINAL_STATUS = new Set(['timeout', 'reject', 'accept', 'terminate']);

class BaileysManager {
  constructor() {
    this.sessions = {};
  }

  async initSession(sessionName, sdrName, phoneNumber) {
    console.log(`[Baileys] Iniciando: ${sessionName} (${phoneNumber})`);

    const authPath = path.join(config.AUTH_DIR, sessionName);
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    let version;
    try {
      ({ version } = await fetchLatestBaileysVersion());
    } catch (error) {
      console.error(`[Baileys] Nao consegui buscar a versao mais recente do WhatsApp Web (${error.message}), usando a padrao da lib`);
    }

    const sock = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '120.0.0.0'],
      logger: pino({ level: 'error' }),
      qrTimeout: 300000,
    });

    sock.ev.on('connection.update', async (update) => {
      if (update.qr) {
        await db.query(
          'UPDATE whatsapp_sessions SET qr_code = ?, status = ? WHERE session_name = ?',
          [update.qr, 'qr_pending', sessionName]
        );
        console.log(`[Baileys] QR gerado: ${sessionName}`);
      }

      if (update.connection === 'open') {
        await db.query(
          'UPDATE whatsapp_sessions SET status = ?, qr_code = NULL, last_connected = NOW() WHERE session_name = ?',
          ['connected', sessionName]
        );
        console.log(`[Baileys] Conectado: ${sessionName}`);
      }

      if (update.connection === 'close') {
        await db.query('UPDATE whatsapp_sessions SET status = ? WHERE session_name = ?', ['disconnected', sessionName]);

        const statusCode = update.lastDisconnect?.error?.output?.statusCode;
        const reason = update.lastDisconnect?.error?.message || 'sem detalhe';
        console.log(`[Baileys] Desconectado: ${sessionName} (statusCode=${statusCode}, motivo=${reason})`);

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          setTimeout(() => this.initSession(sessionName, sdrName, phoneNumber), 5000);
        } else {
          console.log(`[Baileys] ${sessionName} fez logout - apague a pasta auth/${sessionName} e reinicie pra gerar um novo QR code`);
        }
      }
    });

    sock.ev.on('messages.upsert', async (m) => {
      for (const msg of m.messages) {
        if (msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') continue;

        const clientPhone = msg.key.remoteJid.split('@')[0];
        const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        if (!messageText) continue;

        console.log(`[Msg] ${sessionName} <- ${clientPhone}: ${messageText.substring(0, 50)}`);

        try {
          const conv = await this._findOrCreateConversation(clientPhone, sdrName, 'baileys');

          await db.query(
            `INSERT INTO whatsapp_messages
            (conversation_id, session_name, sdr_name, phone_number, from_number, from_type, text, direction, status)
            VALUES (?, ?, ?, ?, ?, 'client', ?, 'inbound', 'received')`,
            [conv.conversation_id, sessionName, sdrName, phoneNumber, clientPhone, messageText]
          );

          await db.query('UPDATE whatsapp_conversations SET last_message_at = NOW() WHERE conversation_id = ?', [
            conv.conversation_id,
          ]);
        } catch (error) {
          console.error(`[Baileys] Erro ao processar mensagem: ${error.message}`);
        }
      }
    });

    sock.ev.on('call', async (calls) => {
      for (const callEvent of calls) {
        const clientPhone = callEvent.from.split('@')[0];
        console.log(`[Call] ${sessionName}: ${clientPhone} - ${callEvent.status}`);

        try {
          await db.query('UPDATE whatsapp_sessions SET in_call = ? WHERE session_name = ?', [
            !CALL_TERMINAL_STATUS.has(callEvent.status),
            sessionName,
          ]);

          const conv = await this._findOrCreateConversation(clientPhone, sdrName, 'baileys');

          const existingCall = await db.queryOne('SELECT id FROM whatsapp_calls WHERE call_id = ?', [callEvent.id]);
          if (existingCall) {
            await db.query(
              'UPDATE whatsapp_calls SET status = ?, duration_seconds = ? WHERE call_id = ?',
              [callEvent.status, callEvent.duration || 0, callEvent.id]
            );
          } else {
            await db.query(
              `INSERT INTO whatsapp_calls
              (conversation_id, session_name, sdr_name, phone_number, call_id, to_number, call_timestamp, status, duration_seconds)
              VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), ?, ?)`,
              [
                conv.conversation_id,
                sessionName,
                sdrName,
                phoneNumber,
                callEvent.id,
                clientPhone,
                callEvent.date ? Math.floor(callEvent.date.getTime() / 1000) : Math.floor(Date.now() / 1000),
                callEvent.status,
                callEvent.duration || 0,
              ]
            );
          }
        } catch (error) {
          console.error(`[Baileys] Erro ao processar chamada: ${error.message}`);
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    this.sessions[sessionName] = sock;
    return sock;
  }

  async _findOrCreateConversation(clientPhone, sdrName, syncedFrom) {
    let conv = await db.queryOne('SELECT * FROM whatsapp_conversations WHERE client_phone = ? AND assigned_to = ?', [
      clientPhone,
      sdrName,
    ]);

    if (!conv) {
      const convId = uuidv4();
      await db.query(
        `INSERT INTO whatsapp_conversations
        (conversation_id, client_phone, client_name, assigned_to, status, created_at, synced_from)
        VALUES (?, ?, 'Desconhecido', ?, 'active', NOW(), ?)`,
        [convId, clientPhone, sdrName, syncedFrom]
      );
      conv = { conversation_id: convId };
    }

    return conv;
  }

  async sendMessage(sessionName, to, text) {
    const sock = this.sessions[sessionName];
    if (!sock) throw new Error(`Sessao nao conectada: ${sessionName}`);
    return sock.sendMessage(`${to}@s.whatsapp.net`, { text });
  }

  isConnected(sessionName) {
    return Boolean(this.sessions[sessionName]);
  }
}

module.exports = new BaileysManager();
