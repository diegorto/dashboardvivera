
const express = require('express');
const fs = require('fs');
const path = require('path');

module.exports = {
  setupWebhooks: function(app) {
    // Webhook para receber análise de script do N8N
    app.post('/webhook/n8n/script-analysis', (req, res) => {
      console.log('[WEBHOOK] Recebendo análise de script do N8N...');

      const data = req.body;
      const cacheFile = path.join(__dirname, '..', 'data', 'cache', 'compliance-cache.json');

      fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));

      res.json({ success: true, message: 'Análise recebida e armazenada' });
    });

    // Webhook para receber dados de chamadas do monitor
    app.post('/webhook/monitor/calls', (req, res) => {
      console.log('[WEBHOOK] Recebendo dados de chamadas...');

      const data = req.body;
      const cacheFile = path.join(__dirname, '..', 'data', 'cache', 'calls-cache.json');

      fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));

      res.json({ success: true, message: 'Chamadas sincronizadas' });
    });

    console.log('✅ Webhooks configurados');
  }
};
