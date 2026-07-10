const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'patients');
const PHOTOS_DIR = path.join(__dirname, '..', 'uploads', 'photos');

module.exports = {
  DATA_DIR,
  UPLOADS_DIR,
  PHOTOS_DIR,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    // photoslibrary.readonly nao da mais acesso a listar a biblioteca/albuns inteiros
    // (restricao do Google desde 2025) - usamos o Picker, que exige escolha manual
    // do usuario por sessao, mas em compensacao nao precisa de app verificado.
    scopes: ['https://www.googleapis.com/auth/photospicker.mediaitems.readonly'],
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1',
    collectionId: process.env.REKOGNITION_COLLECTION_ID || 'vivera-pacientes',
  },
};
