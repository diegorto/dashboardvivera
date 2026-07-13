const fs = require('fs');
const path = require('path');

// Lê o .env manualmente
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const parseEnv = (content) => {
  const env = {};
  content.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        env[key.trim()] = value.trim();
      }
    }
  });
  return env;
};

const env = parseEnv(envContent);

const CLIENT_ID = env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_ADS_CLIENT_SECRET;
const REDIRECT_URI = env.GOOGLE_ADS_REDIRECT_URI;
const code = process.argv[2];

console.log('\n📋 Credenciais carregadas:');
console.log(`  Client ID: ${CLIENT_ID.substring(0, 30)}...`);
console.log(`  Secret: ${CLIENT_SECRET.substring(0, 20)}...`);
console.log(`  Redirect: ${REDIRECT_URI}\n`);

if (!code) {
  console.log('❌ Cole o código como argumento\n');
  console.log('Uso: node final-token.js SEU_CODIGO\n');
  process.exit(1);
}

const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

oauth2Client.getToken(code, (err, tokens) => {
  if (err) {
    console.error('\n❌ Erro:', err.message, '\n');
    process.exit(1);
  }
  console.log('\n✅✅✅ REFRESH TOKEN OBTIDO! ✅✅✅\n');
  console.log(tokens.refresh_token);
  console.log('\n');
});
