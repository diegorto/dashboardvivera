require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/auth', require('./src/auth/routes'));
app.use('/api/patients', require('./src/patients/routes'));
app.use('/api', require('./src/timeline/routes'));
app.use('/api', require('./src/albums/routes'));

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
});
