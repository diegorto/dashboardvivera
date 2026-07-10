const axios = require('axios');
const { getAccessToken } = require('./oauthClient');

const BASE_URL = 'https://photospicker.googleapis.com/v1';

// Cria uma sessao de selecao: o usuario abre a pickerUri no navegador e escolhe
// fotos/album no proprio Google Photos. Nos so recebemos o que ele selecionar.
async function createSession() {
  const accessToken = await getAccessToken();
  const response = await axios.post(
    `${BASE_URL}/sessions`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return response.data; // { id, pickerUri, pollingConfig, mediaItemsSet, expireTime }
}

async function getSession(sessionId) {
  const accessToken = await getAccessToken();
  const response = await axios.get(`${BASE_URL}/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

async function deleteSession(sessionId) {
  const accessToken = await getAccessToken();
  await axios.delete(`${BASE_URL}/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// Lista as fotos que o usuario selecionou numa sessao ja concluida (mediaItemsSet=true).
async function listSessionMediaItems(sessionId) {
  const accessToken = await getAccessToken();
  const items = [];
  let pageToken;

  do {
    const response = await axios.get(`${BASE_URL}/mediaItems`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { sessionId, pageSize: 100, pageToken },
    });
    items.push(...(response.data.mediaItems || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);

  // Normaliza pro mesmo formato que o resto do app espera (id, filename, baseUrl, creationTime)
  return items
    .filter((item) => item.type === 'PHOTO' && item.mediaFile)
    .map((item) => ({
      id: item.id,
      filename: item.mediaFile.filename,
      baseUrl: item.mediaFile.baseUrl,
      creationTime: item.createTime,
    }));
}

// O baseUrl do Picker exige o mesmo token OAuth pra baixar os bytes (nao e um link publico).
async function downloadPhotoBytes(baseUrl) {
  const accessToken = await getAccessToken();
  const response = await axios.get(`${baseUrl}=d`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: 'arraybuffer',
  });
  return Buffer.from(response.data);
}

module.exports = { createSession, getSession, deleteSession, listSessionMediaItems, downloadPhotoBytes };
