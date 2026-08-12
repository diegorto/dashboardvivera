const webpush = require('web-push')
const pool = require('../db')

const PUB = process.env.VAPID_PUBLIC_KEY
const PRIV = process.env.VAPID_PRIVATE_KEY
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'

if (PUB && PRIV) {
  webpush.setVapidDetails(SUBJECT, PUB, PRIV)
}

async function sendPushToUser(userId, payload) {
  if (!PUB || !PRIV) return
  const [subs] = await pool.query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?', [userId])
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      )
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        await pool.query('DELETE FROM push_subscriptions WHERE id = ?', [s.id]).catch(() => {})
      } else {
        console.error('[push] erro ao enviar para user=' + userId + ':', e.message)
      }
    }
  }
}

async function sendPushToUserByName(userName, payload) {
  if (!userName) return
  const [[u]] = await pool.query('SELECT id FROM users WHERE name = ? LIMIT 1', [userName])
  if (!u) return
  await sendPushToUser(u.id, payload)
}

module.exports = { sendPushToUser, sendPushToUserByName }
