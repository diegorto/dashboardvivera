/**
 * Script para obter Refresh Token do Google
 * Execute: npm install googleapis express
 * Depois: node get-google-refresh-token.js
 *
 * Abra http://localhost:4000 no navegador
 */

const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Carrega credenciais do .env
require('dotenv').config();

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Erro: Configure GOOGLE_ADS_CLIENT_ID e GOOGLE_ADS_CLIENT_SECRET no arquivo .env');
  process.exit(1);
}

const REDIRECT_URL = process.env.GOOGLE_ADS_REDIRECT_URI || 'http://localhost:4000/auth/callback';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URL
);

const app = express();

// Gera URL de autenticação
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/adwords'],
  prompt: 'consent'
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Google Ads - Obter Refresh Token</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        .card {
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          max-width: 400px;
          text-align: center;
        }
        h1 {
          color: #333;
          margin-bottom: 20px;
        }
        p {
          color: #666;
          line-height: 1.6;
          margin-bottom: 20px;
        }
        .step {
          background: #f5f5f5;
          padding: 15px;
          border-radius: 4px;
          text-align: left;
          margin: 15px 0;
          font-size: 14px;
        }
        .step strong {
          color: #667eea;
        }
        .button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          text-decoration: none;
          display: inline-block;
          transition: transform 0.2s;
        }
        .button:hover {
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🔐 Google Ads - Autenticação</h1>
        <p>Clique no botão abaixo para autorizar o acesso ao Google Ads</p>

        <div class="step">
          <strong>Passo 1:</strong> Clique no botão abaixo
        </div>

        <div class="step">
          <strong>Passo 2:</strong> Faça login na sua conta Google
        </div>

        <div class="step">
          <strong>Passo 3:</strong> Autorize o acesso ao Google Ads
        </div>

        <div class="step">
          <strong>Passo 4:</strong> Copie o Refresh Token exibido
        </div>

        <a href="${authUrl}" class="button">Autorizar Google Ads</a>
      </div>
    </body>
    </html>
  `);
});

app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send('❌ Erro: Código de autorização não recebido');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Erro</title>
          <style>
            body { font-family: sans-serif; padding: 40px; text-align: center; background: #f5f5f5; }
            .error { background: #fee; padding: 20px; border-radius: 4px; color: #c00; }
          </style>
        </head>
        <body>
          <div class="error">
            <h2>⚠️ Erro</h2>
            <p>Refresh Token não foi gerado. Isso pode ocorrer se você já autorizou esta aplicação antes.</p>
            <p>Revogar a autorização: <a href="https://myaccount.google.com/permissions" target="_blank">Google Account Permissions</a></p>
            <p><a href="/">Tentar novamente</a></p>
          </div>
        </body>
        </html>
      `);
    }

    const htmlResponse = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>✅ Refresh Token Obtido</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .card {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            max-width: 600px;
          }
          h1 {
            color: #27ae60;
            margin-bottom: 20px;
          }
          p {
            color: #666;
            line-height: 1.6;
            margin: 15px 0;
          }
          .token-box {
            background: #f5f5f5;
            border: 2px solid #27ae60;
            padding: 20px;
            border-radius: 4px;
            margin: 20px 0;
            word-break: break-all;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 12px;
          }
          .copy-btn {
            background: #27ae60;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
          }
          .copy-btn:hover {
            background: #229954;
          }
          .instructions {
            background: #e8f5e9;
            padding: 20px;
            border-radius: 4px;
            margin: 20px 0;
          }
          .instructions ol {
            margin: 10px 0;
            padding-left: 20px;
          }
          .instructions li {
            margin: 8px 0;
          }
          .env-example {
            background: #f0f0f0;
            padding: 15px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            margin: 15px 0;
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✅ Sucesso! Refresh Token Obtido</h1>

          <p>Copie o token abaixo e adicione ao seu arquivo <strong>.env</strong>:</p>

          <div class="token-box" id="token">${refreshToken}</div>
          <button class="copy-btn" onclick="copiarToken()">📋 Copiar Token</button>

          <div class="instructions">
            <strong>Próximos passos:</strong>
            <ol>
              <li>Copie o token acima (clique no botão)</li>
              <li>Abra o arquivo <strong>.env</strong> do seu projeto</li>
              <li>Adicione ou atualize esta linha:
                <div class="env-example">GOOGLE_ADS_REFRESH_TOKEN=${refreshToken}</div>
              </li>
              <li>Salve o arquivo</li>
              <li>Execute: <strong>npm run test:google</strong></li>
            </ol>
          </div>

          <p><strong>Não compartilhe este token com ninguém!</strong> Ele permite acesso à sua conta Google Ads.</p>

          <p style="margin-top: 30px; text-align: center;">
            <a href="/" style="color: #667eea; text-decoration: none;">← Voltar</a>
          </p>
        </div>

        <script>
          function copiarToken() {
            const token = document.getElementById('token').textContent;
            navigator.clipboard.writeText(token).then(() => {
              alert('✅ Refresh Token copiado para a área de transferência!');
            });
          }
        </script>
      </body>
      </html>
    `;

    res.send(htmlResponse);

    // Log no console também
    console.log('\n✅ Refresh Token obtido com sucesso!\n');
    console.log('Adicione esta linha ao seu arquivo .env:\n');
    console.log(`GOOGLE_ADS_REFRESH_TOKEN=${refreshToken}\n`);
    console.log('Depois execute: npm run test:google\n');

  } catch (error) {
    console.error('Erro ao obter token:', error);
    res.status(500).send(`❌ Erro ao obter token: ${error.message}`);
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`\n🔗 Abra http://localhost:${PORT} no navegador\n`);
});
