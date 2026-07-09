const { OAuth2Client } = require('google-auth-library');
const config = require('../config');
const store = require('../lib/jsonStore');

const TOKENS_FILE = 'google-tokens.json';

function createOAuthClient() {
  const client = new OAuth2Client(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );

  const savedTokens = store.read(TOKENS_FILE, null);
  if (savedTokens) client.setCredentials(savedTokens);

  client.on('tokens', (tokens) => {
    const merged = { ...savedTokens, ...client.credentials, ...tokens };
    store.write(TOKENS_FILE, merged);
  });

  return client;
}

function getAuthUrl() {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: config.google.scopes,
  });
}

async function handleOAuthCallback(code) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  store.write(TOKENS_FILE, tokens);
  return tokens;
}

function isConnected() {
  return !!store.read(TOKENS_FILE, null);
}

async function getAccessToken() {
  const client = createOAuthClient();
  if (!client.credentials || !client.credentials.refresh_token) {
    throw new Error('Google Photos nao autorizado ainda. Acesse /auth/google para conectar.');
  }
  const { token } = await client.getAccessToken();
  return token;
}

module.exports = { getAuthUrl, handleOAuthCallback, isConnected, getAccessToken };
