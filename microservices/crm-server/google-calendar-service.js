const axios = require('axios');
const pool = require('./db');

const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'https://crm.viveraorofacial.com.br:8443/api/crm/google-calendar/callback';
const SCOPE = 'https://www.googleapis.com/auth/calendar';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: state
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
}

async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({ code: code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' }).toString();
  const resp = await axios.post(TOKEN_URL, body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  return resp.data;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({ refresh_token: refreshToken, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'refresh_token' }).toString();
  const resp = await axios.post(TOKEN_URL, body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  return resp.data;
}

async function saveTokens(userId, tokens) {
  const expiryDate = Date.now() + ((tokens.expires_in || 3600) * 1000);
  await pool.query(
    'INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, expiry_date, calendar_id) VALUES (?, ?, ?, ?, ?) ' +
    'ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), refresh_token = COALESCE(VALUES(refresh_token), refresh_token), expiry_date = VALUES(expiry_date), updated_at = NOW()',
    [userId, tokens.access_token, tokens.refresh_token || null, expiryDate, 'primary']
  );
}

async function getTokenRow(userId) {
  const [rows] = await pool.query('SELECT * FROM google_calendar_tokens WHERE user_id = ?', [userId]);
  return rows[0] || null;
}

async function getValidAccessToken(userId) {
  const row = await getTokenRow(userId);
  if (!row) return null;
  if (row.expiry_date && Number(row.expiry_date) > Date.now() + 60000) {
    return row.access_token;
  }
  if (!row.refresh_token) return row.access_token;
  const tokens = await refreshAccessToken(row.refresh_token);
  await saveTokens(userId, Object.assign({}, tokens, { refresh_token: row.refresh_token }));
  return tokens.access_token;
}

async function calRequest(userId, method, path, data, params) {
  const token = await getValidAccessToken(userId);
  if (!token) { const e = new Error('NOT_CONNECTED'); e.code = 'NOT_CONNECTED'; throw e; }
  const row = await getTokenRow(userId);
  const calendarId = encodeURIComponent((row && row.calendar_id) || 'primary');
  const url = CAL_BASE + '/' + calendarId + path;
  const resp = await axios({ method: method, url: url, data: data, params: params, headers: { Authorization: 'Bearer ' + token }, validateStatus: function(){ return true; } });
  if (resp.status >= 400) {
    const e = new Error('Google Calendar API error ' + resp.status + ': ' + JSON.stringify(resp.data));
    e.status = resp.status; e.data = resp.data;
    throw e;
  }
  return resp.data;
}

async function insertEvent(userId, event) {
  return calRequest(userId, 'post', '/events', event);
}

async function updateEvent(userId, googleEventId, event) {
  return calRequest(userId, 'patch', '/events/' + encodeURIComponent(googleEventId), event);
}

async function deleteEvent(userId, googleEventId) {
  try {
    return await calRequest(userId, 'delete', '/events/' + encodeURIComponent(googleEventId));
  } catch (e) {
    if (e.status === 410 || e.status === 404) return null;
    throw e;
  }
}

async function listEvents(userId, opts) {
  opts = opts || {};
  const params = { singleEvents: true, showDeleted: true, maxResults: 250 };
  if (opts.syncToken) { params.syncToken = opts.syncToken; }
  else {
    params.updatedMin = opts.updatedMin;
    params.timeMin = opts.timeMin;
    params.timeMax = opts.timeMax;
    params.orderBy = 'updated';
  }
  return calRequest(userId, 'get', '/events', null, params);
}


function gEventToRow(ev) {
  const startRaw = ev.start && (ev.start.dateTime || ev.start.date);
  const endRaw = ev.end && (ev.end.dateTime || ev.end.date);
  return {
    title: ev.summary || '(Sem titulo)',
    description: ev.description || null,
    startAt: startRaw ? startRaw.replace('Z', '').slice(0, 19).replace('T', ' ') : null,
    endAt: endRaw ? endRaw.replace('Z', '').slice(0, 19).replace('T', ' ') : null,
    status: ev.status === 'cancelled' ? 'cancelled' : 'confirmed'
  };
}

async function pollUser(tokenRow) {
  const userId = tokenRow.user_id;
  let nextSyncToken = null;
  let created = 0, updated = 0, cancelled = 0, total = 0;
  const MAX_PAGES = 50;
  try {
    let pageToken = null;
    let pageCount = 0;
    do {
      const opts = {};
      if (tokenRow.sync_token) { opts.syncToken = tokenRow.sync_token; }
      else {
        const since = tokenRow.last_synced_at ? new Date(tokenRow.last_synced_at) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
        opts.timeMin = since.toISOString();
        opts.timeMax = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
      }
      if (pageToken) { opts.pageToken = pageToken; }
      const resp = await listEvents(userId, opts);
      const pageItems = resp.items || [];
      total += pageItems.length;

      const eventIds = pageItems.map(function(ev){ return ev.id; }).filter(Boolean);
      const existingMap = new Map();
      if (eventIds.length) {
        const [existingRows] = await pool.query(
          'SELECT * FROM calendar_events WHERE dentist_user_id = ? AND google_event_id IN (' + eventIds.map(function(){ return '?'; }).join(',') + ')',
          [userId].concat(eventIds)
        );
        for (const r of existingRows) { existingMap.set(r.google_event_id, r); }
      }
      for (const ev of pageItems) {
        if (!ev.id) continue;
        try {
          const existing = existingMap.get(ev.id);
          if (ev.status === 'cancelled') {
            if (existing && existing.status !== 'cancelled') {
              await pool.query("UPDATE calendar_events SET status = 'cancelled' WHERE id = ?", [existing.id]);
              cancelled++;
            }
            continue;
          }
          const row = gEventToRow(ev);
          if (!row.startAt || !row.endAt) continue;
          if (existing) {
            await pool.query(
              'UPDATE calendar_events SET title=?, description=?, start_at=?, end_at=?, status=? WHERE id=?',
              [row.title, row.description, row.startAt, row.endAt, row.status, existing.id]
            );
            updated++;
          } else {
            await pool.query(
              'INSERT INTO calendar_events (deal_id, dentist_user_id, title, description, start_at, end_at, status, google_event_id, created_by_user_id) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, NULL)',
              [userId, row.title, row.description, row.startAt, row.endAt, row.status, ev.id]
            );
            created++;
          }
        } catch (evErr) {
          console.error('[gcal-poll] erro ao processar evento', ev.id, 'user', userId, evErr.message);
        }
      }

      pageToken = resp.nextPageToken || null;
      if (resp.nextSyncToken) { nextSyncToken = resp.nextSyncToken; }
      pageCount++;
      if (pageCount >= MAX_PAGES && pageToken) {
        console.error('[gcal-poll] limite de paginas atingido para user', userId, '- sync parcial, continua no proximo ciclo');
        pageToken = null;
        nextSyncToken = null;
      }
    } while (pageToken);
  } catch (e) {
    if (e.status === 410) {
      await pool.query('UPDATE google_calendar_tokens SET sync_token = NULL WHERE user_id = ?', [userId]);
      return { userId: userId, error: 'SYNC_TOKEN_EXPIRED_RESET' };
    }
    return { userId: userId, error: e.message || String(e) };
  }

  await pool.query(
    'UPDATE google_calendar_tokens SET sync_token = ?, last_synced_at = NOW() WHERE user_id = ?',
    [nextSyncToken, userId]
  );
  return { userId: userId, created: created, updated: updated, cancelled: cancelled, total: total };
}

async function pollAllUsers() {
  const [rows] = await pool.query('SELECT * FROM google_calendar_tokens');
  const results = [];
  for (const row of rows) {
    try {
      results.push(await pollUser(row));
    } catch (e) {
      results.push({ userId: row.user_id, error: e.message || String(e) });
    }
  }
  return results;
}

module.exports = { buildAuthUrl: buildAuthUrl, exchangeCodeForTokens: exchangeCodeForTokens, saveTokens: saveTokens, getTokenRow: getTokenRow, getValidAccessToken: getValidAccessToken, insertEvent: insertEvent, updateEvent: updateEvent, deleteEvent: deleteEvent, listEvents: listEvents, pollAllUsers: pollAllUsers };
