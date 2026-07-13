require('dotenv').config();
const { google } = require('googleapis');

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REDIRECT_URL = process.env.GOOGLE_ADS_REDIRECT_URI || 'http://localhost:3000/auth/callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

const code = process.argv[2];
if (code) {
  oauth2Client.getToken(code, (err, tokens) => {
    if (err) {
      console.error('❌ Erro:', err.message);
      process.exit(1);
    }
    console.log('\n✅ Refresh Token:\n');
    console.log(tokens.refresh_token);
    console.log('\n');
    process.exit(0);
  });
} else {
  console.log('❌ Cole o código como argumento\n');
  console.log('Uso: node get-token.js SEU_CODIGO\n');
}
