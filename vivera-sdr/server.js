require('dotenv').config();
const path = require('path');
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_TOKEN;
const PIPEDRIVE_BASE = 'https://api.pipedrive.com/v1';
const ALLOWED_RESOURCES = new Set(['users', 'deals', 'activities']);

// Proxy para o Pipedrive: o token nunca chega ao navegador.
app.get('/api/pipedrive/:resource', async (req, res) => {
  const { resource } = req.params;

  if (!ALLOWED_RESOURCES.has(resource)) {
    return res.status(404).json({ success: false, error: 'Recurso não suportado' });
  }

  try {
    const response = await axios.get(`${PIPEDRIVE_BASE}/${resource}`, {
      params: { ...req.query, api_token: PIPEDRIVE_TOKEN }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data?.error || error.message
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Painel Vivera SDR rodando na porta ${PORT}`);
  console.log(`Pipedrive Token: ${PIPEDRIVE_TOKEN ? PIPEDRIVE_TOKEN.substring(0, 10) + '...' : 'NAO CONFIGURADO'}`);
});
