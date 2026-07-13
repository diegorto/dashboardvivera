require('dotenv').config();
const { google } = require('googleapis');

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REDIRECT_URL = process.env.GOOGLE_ADS_REDIRECT_URI || 'http://localhost:3000/auth/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Erro: CLIENT_ID ou CLIENT_SECRET não configurados no .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URL
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/adwords'],
  prompt: 'consent'
});

console.log('\n✅ URL de Autenticação Gerada!\n');
console.log('📱 Abra esta URL no navegador:\n');
console.log(authUrl);
console.log('\n\n📋 Depois de autorizar:');
console.log('1. Você será redirecionado para uma URL com um código');
console.log('2. Cole o código abaixo no formato:');
console.log('   node quick-refresh-token.js <codigo>\n');
console.log('Exemplo:');
console.log('   node quick-refresh-token.js 4/0AY0e-g...\n');

// Se passou código como argumento
const code = process.argv[2];
if (code) {
  oauth2Client.getToken(code, async (err, tokens) => {
    if (err) {
      console.error('❌ Erro ao obter token:', err.message);
      process.exit(1);
    }

    console.log('\n✅ Refresh Token Obtido!\n');
    console.log('Adicione isto ao seu .env:\n');
    console.log(`GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log('Depois execute: npm run test:google\n');
    process.exit(0);
  });
}
