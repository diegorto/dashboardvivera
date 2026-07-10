require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { DATA_DIR } = require('./src/config');
const scheduler = require('./src/scheduler');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/composites', express.static(path.join(DATA_DIR, 'composites')));

app.use('/auth', require('./src/auth/routes'));
app.use('/api/patients', require('./src/patients/routes'));
app.use('/api', require('./src/timeline/routes'));
app.use('/api', require('./src/albums/routes'));

app.post('/api/scheduler/run-now', async (req, res) => {
  scheduler.runAutoScan().catch((err) => console.error('Erro na varredura manual:', err.message));
  res.json({ started: true });
});

app.get('/cadastro', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cadastro.html'));
});

app.get('/painel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'painel.html'));
});

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'vivera-fotos' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Vivera Fotos (Google Photos + timeline de pacientes) rodando na porta ${PORT}`);
  scheduler.start();
});
