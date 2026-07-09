const express = require('express');
const oauthClient = require('../googlePhotos/oauthClient');

const router = express.Router();

router.get('/google', (req, res) => {
  res.redirect(oauthClient.getAuthUrl());
});

router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).send(`Autorizacao negada: ${error}`);
  try {
    await oauthClient.handleOAuthCallback(code);
    res.send('<h2>Google Photos conectado com sucesso.</h2><p>Pode fechar esta aba.</p>');
  } catch (err) {
    res.status(500).send(`Erro ao conectar Google Photos: ${err.message}`);
  }
});

router.get('/google/status', (req, res) => {
  res.json({ connected: oauthClient.isConnected() });
});

module.exports = router;
