const path = require('path')
const fs = require('fs')
const QRCode = require('qrcode')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const store = require('./connectionsStore')
const wa = require('./whatsapp')

const sockets = new Map()
const qrCache = new Map()

function baseDir() { return path.join(__dirname, '..') }

async function startSocket(connectionId, authDirRel) {
  const authDir = path.join(baseDir(), authDirRel)
  fs.mkdirSync(authDir, { recursive: true })
  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  let waVersion
  try { const v = await fetchLatestBaileysVersion(); waVersion = v.version } catch (e) {}
  const sock = makeWASocket({ auth: state, version: waVersion, printQRInTerminal: false, syncFullHistory: false, browser: ['Vivera Orofacial', 'Chrome', '120.0.0.0'] })
  sockets.set(connectionId, sock)
  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    if (qr) {
      const qrDataUrl = await QRCode.toDataURL(qr)
      qrCache.set(connectionId, qrDataUrl)
      await store.setStatus(connectionId, 'qr_pending', qrDataUrl).catch(() => {})
    }
    if (connection === 'open') {
      qrCache.delete(connectionId)
      const phoneNumber = (sock.user && sock.user.id) ? sock.user.id.split(':')[0] : null
      await store.setStatus(connectionId, 'connected', null, phoneNumber).catch(() => {})
      console.log('[sessionManager] conexao ' + connectionId + ' conectada, numero:', phoneNumber)
    }
    if (connection === 'close') {
      await store.setStatus(connectionId, 'disconnected').catch(() => {})
      const code = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode
      const loggedOut = code === (DisconnectReason ? DisconnectReason.loggedOut : 401)
      if (!loggedOut) {
        console.log('[sessionManager] conexao ' + connectionId + ' caiu, tentando reconectar em 4s...')
        setTimeout(() => { startSocket(connectionId, authDirRel).catch(e => console.error('[sessionManager] erro reconectando conexao', connectionId, e.message)) }, 4000)
      } else {
        console.log('[sessionManager] conexao ' + connectionId + ' deslogada')
        sockets.delete(connectionId)
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const m of messages) {
      if (!m.message) continue
      try {
        if (m.key.remoteJid && m.key.remoteJid.endsWith('@lid')) {
          let realJid = m.key.remoteJidAlt
          if (!realJid && sock.signalRepository && sock.signalRepository.lidMapping) {
            try {
              const pn = await sock.signalRepository.lidMapping.getPNForLID(m.key.remoteJid)
              if (pn) realJid = pn.includes('@') ? pn : (pn + '@s.whatsapp.net')
            } catch (e2) {
              console.warn('[sessionManager] getPNForLID falhou para ' + m.key.remoteJid + ':', e2.message)
            }
          }
          if (realJid) {
            console.log('[sessionManager] LID resolvido: ' + m.key.remoteJid + ' -> ' + realJid)
            m.key.remoteJid = realJid
          } else {
            console.warn('[sessionManager] LID NAO resolvido (sem mapeamento ainda): ' + m.key.remoteJid)
          }
        }
      } catch (e3) {
        console.error('[sessionManager] erro resolvendo LID:', e3.message)
      }
      if (m.key.fromMe) {
        try {
          await wa.handleOutgoingFromDevice(m.key.remoteJid, m, { connectionId })
        } catch (e) {
          console.error('[sessionManager] erro ao processar mensagem enviada pelo app na conexao ' + connectionId + ':', e.message)
        }
        continue
      }
      if (m.message.audioMessage) {
      try { await wa.handleIncomingAudio(m) } catch (e) { console.error('[sessionManager] erro ao processar audio da conexao ' + connectionId + ':', e.message) }
      continue
    }
    if (m.message.videoMessage) {
      try { await wa.handleIncomingVideo(m) } catch (e) { console.error('[sessionManager] erro ao processar video da conexao ' + connectionId + ':', e.message) }
      continue
    }
    if (m.message.documentMessage || m.message.documentWithCaptionMessage) {
      try { await wa.handleIncomingDocument(m) } catch (e) { console.error('[sessionManager] erro ao processar documento da conexao ' + connectionId + ':', e.message) }
      continue
    }
    if (m.message.imageMessage) {
      try { await wa.handleIncomingImage(m) } catch (e) { console.error('[sessionManager] erro ao processar imagem da conexao ' + connectionId + ':', e.message) }
      continue
    }
    const text = m.message.conversation || (m.message.extendedTextMessage && m.message.extendedTextMessage.text)
      if (!text) continue
      const pushName = m.pushName || ''
      try {
        await wa.handleIncomingText(m.key.remoteJid, text, pushName, { connectionId, sock })
      } catch (e) {
        console.error('[sessionManager] erro ao processar mensagem da conexao ' + connectionId + ':', e.message)
      }
    }
  })

  return sock
}

async function startAll() {
  try { wa.registerSessionManager(module.exports) } catch (e) { console.error('[sessionManager] erro ao registrar em whatsapp.js:', e.message) }
  let conns = []
  try { conns = await store.listConnections() } catch (e) { console.error('[sessionManager] erro ao listar conexoes:', e.message); return }
  for (const c of conns) {
    if (c.is_primary) continue
    const authDirAbs = path.join(baseDir(), c.auth_dir)
    if (c.status === 'disconnected' && !fs.existsSync(authDirAbs)) continue
    try { await startSocket(c.id, c.auth_dir) } catch (e) { console.error('[sessionManager] erro ao iniciar conexao', c.id, e.message) }
  }
}

async function connectNew(label) {
  const conn = await store.createConnection(label)
  await startSocket(conn.id, conn.auth_dir)
  return conn
}

function getSocket(connectionId) {
  return sockets.get(connectionId)
}

async function getQr(connectionId) {
  return qrCache.get(connectionId) || null
}

async function disconnect(connectionId) {
  const sock = sockets.get(connectionId)
  if (sock) {
    try { await sock.logout() } catch (e) {}
    sockets.delete(connectionId)
  }
  qrCache.delete(connectionId)
  const conn = await store.getConnection(connectionId)
  await store.setStatus(connectionId, 'disconnected')
  if (conn) {
    const dir = path.join(baseDir(), conn.auth_dir)
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch (e) {}
  }
}

async function forceReconnect(connectionId) {
  try {
    const old = sockets.get(connectionId)
    if (old) {
      try { old.end(new Error('forced reconnect - stale connection')) } catch (e) {}
      try { old.ws && old.ws.close && old.ws.close() } catch (e) {}
    }
    sockets.delete(connectionId)
    const conn = await store.getConnection(connectionId)
    if (!conn) { console.warn('[sessionManager] forceReconnect: conexao ' + connectionId + ' nao encontrada'); return false }
    const authDirAbs = path.join(baseDir(), conn.auth_dir)
    if (!fs.existsSync(authDirAbs)) { console.warn('[sessionManager] forceReconnect: auth_dir nao existe para conexao ' + connectionId); return false }
    console.log('[sessionManager] forcando reconexao imediata da conexao ' + connectionId + ' apos deteccao de socket morto')
    await startSocket(connectionId, conn.auth_dir)
    return true
  } catch (e) {
    console.error('[sessionManager] erro ao forcar reconexao da conexao ' + connectionId + ':', e.message)
    return false
  }
}

module.exports = { startAll, connectNew, getSocket, getQr, disconnect, startSocket, forceReconnect }
