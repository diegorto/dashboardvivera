require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } = require('@modelcontextprotocol/sdk/server/auth/router.js');
const { requireBearerAuth } = require('@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js');
const { InvalidTokenError } = require('@modelcontextprotocol/sdk/server/auth/errors.js');

const PORT = process.env.PORT || 8878;
const ISSUER_URL = new URL(process.env.ISSUER_URL);
const MCP_URL = new URL(process.env.ISSUER_URL + '/mcp');
const OWNER_PASSPHRASE = process.env.OWNER_PASSPHRASE;
const MAX_ROWS = parseInt(process.env.MAX_ROWS || '500', 10);
const QUERY_TIMEOUT_MS = parseInt(process.env.QUERY_TIMEOUT_MS || '8000', 10);

// ---------- MySQL pool (read-only inspector_ro user) ----------
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|truncate|replace|grant|revoke|call|exec|execute|lock|unlock|set|load_file|outfile|dumpfile|shutdown|kill)\b/i;
function isSelectOnly(sql) {
  const trimmed = sql.trim().replace(/;+\s*$/, '');
  if (trimmed.includes(';')) return { ok: false, reason: 'multiple statements not allowed' };
  if (!/^(select|with)\b/i.test(trimmed)) return { ok: false, reason: 'only SELECT statements are allowed' };
  if (FORBIDDEN.test(trimmed)) return { ok: false, reason: 'forbidden keyword detected' };
  return { ok: true, sql: trimmed };
}

const auditLogFile = path.join(__dirname, 'query_audit.log');
function auditLog(entry) {
  fs.appendFile(auditLogFile, JSON.stringify(entry) + '\n', () => {});
}

async function runQuery(sql) {
  const check = isSelectOnly(sql);
  if (!check.ok) {
    auditLog({ ts: new Date().toISOString(), rejected: true, reason: check.reason, sql });
    throw new Error(check.reason);
  }
  let conn;
  try {
    conn = await pool.getConnection();
    try {
      await conn.query('SET SESSION max_statement_time=' + (QUERY_TIMEOUT_MS / 1000));
    } catch (e) {
      // MariaDB-specific; ignore if unsupported
    }
    const [rows] = await conn.query(check.sql);
    const truncated = Array.isArray(rows) && rows.length > MAX_ROWS;
    const result = Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : rows;
    auditLog({ ts: new Date().toISOString(), rejected: false, sql: check.sql, rowCount: Array.isArray(rows) ? rows.length : null });
    return { rowCount: Array.isArray(result) ? result.length : null, truncated, rows: result };
  } finally {
    if (conn) conn.release();
  }
}

// ---------- Persistence for OAuth state (survives pm2 restarts) ----------
const STATE_FILE = path.join(__dirname, 'oauth_state.json');
let state = { clients: {}, codes: {}, tokens: {}, refreshTokens: {} };
try {
  if (fs.existsSync(STATE_FILE)) {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
} catch (e) {
  console.error('Failed to load oauth state, starting fresh', e);
}
let saveTimer = null;
function saveState() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(STATE_FILE, JSON.stringify(state), (err) => {
      if (err) console.error('Failed to persist oauth state', err);
    });
  }, 50);
}

// periodic cleanup of expired codes/tokens
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [k, v] of Object.entries(state.codes)) {
    if (v.expiresAt && v.expiresAt < now) { delete state.codes[k]; changed = true; }
  }
  for (const [k, v] of Object.entries(state.tokens)) {
    if (v.expiresAt && v.expiresAt < now) { delete state.tokens[k]; changed = true; }
  }
  if (changed) saveState();
}, 5 * 60 * 1000).unref();

// ---------- OAuth Server Provider (single-user, passphrase-gated) ----------
const clientsStore = {
  async getClient(clientId) {
    return state.clients[clientId];
  },
  async registerClient(client) {
    const client_id = crypto.randomUUID();
    const full = {
      ...client,
      client_id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    state.clients[client_id] = full;
    saveState();
    return full;
  },
};

const provider = {
  clientsStore,

  async authorize(client, params, res) {
    const authId = crypto.randomBytes(16).toString('hex');
    state.codes[authId] = {
      pending: true,
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      scopes: params.scopes || [],
      state: params.state,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    saveState();
    res.status(200).send(renderLoginPage(authId));
  },

  async challengeForAuthorizationCode(client, authorizationCode) {
    const entry = state.codes[authorizationCode];
    if (!entry || entry.pending) throw new Error('invalid authorization code');
    return entry.codeChallenge;
  },

  async exchangeAuthorizationCode(client, authorizationCode) {
    const entry = state.codes[authorizationCode];
    if (!entry || entry.pending || entry.clientId !== client.client_id) {
      throw new Error('invalid_grant');
    }
    if (entry.expiresAt < Date.now()) {
      delete state.codes[authorizationCode];
      saveState();
      throw new Error('invalid_grant');
    }
    delete state.codes[authorizationCode];
    const accessToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const expiresIn = 3600;
    state.tokens[accessToken] = {
      clientId: client.client_id,
      scopes: entry.scopes,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    state.refreshTokens[refreshToken] = {
      clientId: client.client_id,
      scopes: entry.scopes,
    };
    saveState();
    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: expiresIn,
      refresh_token: refreshToken,
      scope: entry.scopes.join(' '),
    };
  },

  async exchangeRefreshToken(client, refreshToken) {
    const entry = state.refreshTokens[refreshToken];
    if (!entry || entry.clientId !== client.client_id) {
      throw new Error('invalid_grant');
    }
    delete state.refreshTokens[refreshToken];
    const accessToken = crypto.randomBytes(32).toString('hex');
    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const expiresIn = 3600;
    state.tokens[accessToken] = {
      clientId: client.client_id,
      scopes: entry.scopes,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    state.refreshTokens[newRefreshToken] = {
      clientId: client.client_id,
      scopes: entry.scopes,
    };
    saveState();
    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: expiresIn,
      refresh_token: newRefreshToken,
      scope: entry.scopes.join(' '),
    };
  },

  async verifyAccessToken(token) {
    const entry = state.tokens[token];
    if (!entry) throw new InvalidTokenError('token not found');
    if (entry.expiresAt < Date.now()) {
      delete state.tokens[token];
      saveState();
      throw new InvalidTokenError('token expired');
    }
    return {
      token,
      clientId: entry.clientId,
      scopes: entry.scopes,
      expiresAt: Math.floor(entry.expiresAt / 1000),
    };
  },

  async revokeToken(client, request) {
    if (state.tokens[request.token]) delete state.tokens[request.token];
    if (state.refreshTokens[request.token]) delete state.refreshTokens[request.token];
    saveState();
  },
};

function renderLoginPage(authId, error) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Vivera Inspector - Autorizar acesso</title>
<style>
body{font-family:-apple-system,sans-serif;max-width:420px;margin:80px auto;padding:0 20px;color:#1a1a1a}
input{width:100%;padding:10px;margin:10px 0;box-sizing:border-box;border:1px solid #ccc;border-radius:6px;font-size:16px}
button{width:100%;padding:12px;background:#5b21b6;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:16px}
.err{color:#c00;font-weight:bold}
</style></head>
<body>
<h2>Vivera CRM Inspector</h2>
<p>Um cliente MCP esta solicitando acesso de <strong>leitura</strong> aos dados do CRM e WhatsApp da clinica. Digite a senha de proprietario para autorizar.</p>
${error ? `<p class="err">${error}</p>` : ''}
<form method="POST" action="/authorize/approve">
<input type="hidden" name="auth_id" value="${authId}" />
<input type="password" name="passphrase" placeholder="Senha de proprietario" autofocus required />
<button type="submit">Autorizar acesso</button>
</form>
</body></html>`;
}

// ---------- Express app ----------
const app = express();
app.set('trust proxy', 1);

// ---- TEMP DEBUG LOGGING for DCR troubleshooting ----
const dcrLogFile = path.join(__dirname, 'dcr_debug.log');
function dcrLog(line) {
  const entry = new Date().toISOString() + ' ' + line + '\n';
  fs.appendFile(dcrLogFile, entry, () => {});
  console.log(entry);
}
app.use((req, res, next) => {
  if (req.path === '/register') {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      dcrLog('INCOMING ' + req.method + ' ' + req.originalUrl + ' headers=' + JSON.stringify(req.headers) + ' body=' + raw);
    });
    const origJson = res.json.bind(res);
    res.json = (body) => {
      dcrLog('RESPONSE status=' + res.statusCode + ' body=' + JSON.stringify(body));
      return origJson(body);
    };
    const origSend = res.send.bind(res);
    res.send = (body) => {
      dcrLog('RESPONSE(send) status=' + res.statusCode + ' body=' + (typeof body === 'string' ? body : JSON.stringify(body)));
      return origSend(body);
    };
  }
  next();
});
// ---- END TEMP DEBUG LOGGING ----

app.use(mcpAuthRouter({
  provider,
  issuerUrl: ISSUER_URL,
  resourceServerUrl: MCP_URL,
  resourceName: 'Vivera CRM Inspector',
}));

app.post('/authorize/approve', express.urlencoded({ extended: false }), async (req, res) => {
  const { auth_id, passphrase } = req.body || {};
  const entry = auth_id && state.codes[auth_id];
  if (!entry || !entry.pending) {
    return res.status(400).send('Solicitacao expirada ou invalida. Feche esta aba e tente conectar novamente pelo Claude.');
  }
  if (passphrase !== OWNER_PASSPHRASE) {
    return res.status(401).send(renderLoginPage(auth_id, 'Senha incorreta. Tente novamente.'));
  }
  entry.pending = false;
  saveState();
  const redirect = new URL(entry.redirectUri);
  redirect.searchParams.set('code', auth_id);
  if (entry.state) redirect.searchParams.set('state', entry.state);
  res.redirect(302, redirect.toString());
});

const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(MCP_URL);
const bearerAuth = requireBearerAuth({ verifier: provider, resourceMetadataUrl });

function buildMcpServer() {
  const server = new McpServer({ name: 'vivera-crm-inspector', version: '1.0.0' });

  server.registerTool('query_sql', {
    description: 'Executa uma query SELECT (somente leitura) no banco vivera_crm, usado pelo CRM e pelo bot de WhatsApp da clinica. Bloqueia INSERT/UPDATE/DELETE/DROP/ALTER e qualquer comando de escrita, tanto na validacao da aplicacao quanto nas permissoes do usuario do banco. Maximo 500 linhas por resposta, timeout de 8s.',
    inputSchema: {
      sql: z.string().describe('Query SQL. Deve comecar com SELECT ou WITH. Nao use multiplos statements (sem ; no meio).'),
    },
  }, async ({ sql }) => {
    try {
      const result = await runQuery(sql);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: 'Erro: ' + e.message }], isError: true };
    }
  });

  server.registerTool('list_tables', {
    description: 'Lista todas as tabelas disponiveis no banco vivera_crm (deals, patients, activities, whatsapp_messages, whatsapp_conversations, chatbot_ai_config, chatbot_flows, etc).',
    inputSchema: {},
  }, async () => {
    try {
      const result = await runQuery('SHOW TABLES');
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: 'Erro: ' + e.message }], isError: true };
    }
  });

  return server;
}

app.post('/mcp', express.json({ limit: '1mb' }), bearerAuth, async (req, res) => {
  try {
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error('MCP request error', e);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  }
});

app.get('/mcp', bearerAuth, async (req, res) => {
  res.status(405).json({ error: 'Method not allowed. Stateless server, no SSE stream on GET.' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'vivera-crm-inspector-mcp', time: new Date().toISOString() });
});


app.use((err, req, res, next) => {
  dcrLog('UNHANDLED ERROR path=' + req.path + ' message=' + (err && err.message) + ' stack=' + (err && err.stack));
  if (!res.headersSent) {
    res.status(err && err.status ? err.status : 500).json({ error: (err && err.message) || 'internal error' });
  }
});
app.listen(PORT, '0.0.0.0', () => {
  console.log('vivera-crm-inspector-mcp (real MCP + OAuth) listening on 127.0.0.1:' + PORT);
});
