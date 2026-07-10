require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const cron = require('node-cron');

const config = require('./src/config');
const db = require('./src/db');
const baileysManager = require('./src/baileys-manager');
const pipedriveIntegration = require('./src/pipedrive-integration');
const iaAnalysis = require('./src/ia-analysis');
const routes = require('./src/routes');

if (!config.session.secret) {
  throw new Error('SESSION_SECRET nao configurado no .env');
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000 },
  })
);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);

app.get('/', (req, res) => res.redirect('/login'));

(async () => {
  try {
    const sessions = await db.query('SELECT * FROM whatsapp_sessions');
    for (const sess of sessions) {
      await baileysManager.initSession(sess.session_name, sess.sdr_name, sess.phone_number);
    }
  } catch (error) {
    console.error(`Erro ao inicializar Baileys: ${error.message}`);
  }
})();

cron.schedule('*/5 * * * *', () => pipedriveIntegration.syncDistribution());
cron.schedule('5 18 * * *', () => iaAnalysis.analyzeConversationsDaily());

app.listen(config.PORT, () => {
  console.log(`whatsapp-monitor rodando na porta ${config.PORT}`);
});
