const path = require('path');

const AUTH_DIR = path.join(__dirname, '..', 'auth');

const SDRS = [
  { session: 'helenice', name: 'Helenice', phone: '+55 48 99120-4285', fallback: 'agda' },
  { session: 'agda', name: 'Agda', phone: '+5548991415196', fallback: 'helenice' },
];

module.exports = {
  PORT: process.env.PORT || 4001,
  AUTH_DIR,
  SDRS,
  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  pipedrive: {
    token: process.env.PIPEDRIVE_TOKEN,
    baseURL: 'https://api.pipedrive.com/v1',
  },
  n8nWebhook: process.env.N8N_WEBHOOK,
  session: {
    secret: process.env.SESSION_SECRET,
  },
  // senha de acesso de cada SDR ao proprio painel - SDR_PASSWORD_HELENICE / SDR_PASSWORD_AGDA no .env
  sdrPassword(sessionName) {
    return process.env[`SDR_PASSWORD_${sessionName.toUpperCase()}`];
  },
};
