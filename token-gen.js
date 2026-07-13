require('dotenv').config();
const { google } = require('googleapis');

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_ADS_REDIRECT_URI;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const code = process.argv[2];
if (!code) {
  console.log('\n❌ Cole o código como argumento\n');
  console.log('Uso: node token-gen.js SEU_CODIGO\n');
  process.exit(1);
}

oauth2Client.getToken(code, (err, tokens) => {
  if (err) {
    console.error('\n❌ Erro:', err.message, '\n');
    process.exit(1);
  }
  console.log('\n✅ REFRESH TOKEN:\n');
  console.log(tokens.refresh_token);
  console.log('\n');
});
