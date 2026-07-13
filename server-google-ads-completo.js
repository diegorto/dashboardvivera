require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { google } = require('googleapis');

const app = express();
const PORT = 3001;

// Credenciais do .env
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;
const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID;

// OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  process.env.GOOGLE_ADS_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: REFRESH_TOKEN
});

// Endpoint: Gastos do mês
app.get('/ads/gastos', async (req, res) => {
  try {
    console.log('📊 Buscando gastos de campanhas...');

    // Obtém novo access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    const accessToken = credentials.access_token;

    // Query para puxar dados de campanhas
    const query = `
      SELECT 
        campaign.id,
        campaign.name,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.conversions
      FROM campaign
      WHERE segments.date DURING LAST_30_DAYS
      ORDER BY metrics.cost_micros DESC
      LIMIT 100
    `;

    // Faz requisição à API Google Ads
    const response = await axios.post(
      `https://googleads.googleapis.com/v16/customers/${CUSTOMER_ID}/googleAds:searchStream`,
      { query: query },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': DEVELOPER_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    // Processa resposta
    let campanhas = [];
    let totalGasto = 0;

    if (response.data && Array.isArray(response.data)) {
      response.data.forEach(batch => {
        if (batch.results && Array.isArray(batch.results)) {
          batch.results.forEach(row => {
            const gasto = (row.metrics.costMicros || 0) / 1000000;
            const clicks = row.metrics.clicks || 0;
            const impressoes = row.metrics.impressions || 0;
            const conversoes = row.metrics.conversions || 0;

            campanhas.push({
              id: row.campaign.id,
              nome: row.campaign.name,
              gasto: parseFloat(gasto.toFixed(2)),
              clicks: parseInt(clicks),
              impressoes: parseInt(impressoes),
              conversoes: parseInt(conversoes),
              cpc: clicks > 0 ? parseFloat((gasto / clicks).toFixed(2)) : 0
            });

            totalGasto += gasto;
          });
        }
      });
    }

    // Ordena por gasto
    campanhas.sort((a, b) => b.gasto - a.gasto);

    console.log(`✅ ${campanhas.length} campanhas encontradas`);

    res.json({
      sucesso: true,
      periodo: 'Últimos 30 dias',
      timestamp: new Date().toISOString(),
      resumo: {
        total_gasto: parseFloat(totalGasto.toFixed(2)),
        total_cliques: campanhas.reduce((sum, c) => sum + c.clicks, 0),
        total_impressoes: campanhas.reduce((sum, c) => sum + c.impressoes, 0),
        total_conversoes: campanhas.reduce((sum, c) => sum + c.conversoes, 0),
        total_campanhas: campanhas.length
      },
      campanhas: campanhas
    });

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
    
    res.json({
      sucesso: false,
      erro: error.response?.data?.error?.message || error.message,
      detalhes: error.response?.data
    });
  }
});

// Endpoint: Status da conexão
app.get('/ads/status', (req, res) => {
  res.json({
    conectado: true,
    customer_id: CUSTOMER_ID,
    developer_token: DEVELOPER_TOKEN.substring(0, 10) + '...',
    refresh_token_configurado: !!REFRESH_TOKEN
  });
});

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 SERVIDOR GOOGLE ADS COMPLETO INICIADO');
  console.log('='.repeat(70));
  console.log(`\n📊 Gastos (últimos 30 dias): http://app.viveraorofacial.com.br:${PORT}/ads/gastos`);
  console.log(`✅ Status da conexão: http://app.viveraorofacial.com.br:${PORT}/ads/status\n`);
  console.log('='.repeat(70) + '\n');
});
