require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth', require('./src/auth/routes'));
app.use('/api/patients', require('./src/patients/routes'));
app.use('/api', require('./src/timeline/routes'));

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'vivera-fotos' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Vivera Fotos (Google Photos + timeline de pacientes) rodando na porta ${PORT}`);
});
