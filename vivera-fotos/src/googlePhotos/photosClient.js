const axios = require('axios');
const { getAccessToken } = require('./oauthClient');

const BASE_URL = 'https://photoslibrary.googleapis.com/v1';

// Percorre toda a biblioteca do Google Photos (paginado) e retorna os mediaItems.
// So traz fotos (mediaMetadata.photo existente), ignora videos.
async function listAllPhotos({ pageLimit = 20 } = {}) {
  const accessToken = await getAccessToken();
  const items = [];
  let pageToken;
  let pages = 0;

  do {
    const response = await axios.get(`${BASE_URL}/mediaItems`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { pageSize: 100, pageToken },
    });
    const batch = response.data.mediaItems || [];
    items.push(...batch.filter((item) => item.mediaMetadata && item.mediaMetadata.photo));
    pageToken = response.data.nextPageToken;
    pages += 1;
  } while (pageToken && pages < pageLimit);

  return items;
}

// baseUrl do Google Photos expira (~1h), por isso buscamos de novo na hora de exibir.
async function getMediaItem(mediaItemId) {
  const accessToken = await getAccessToken();
  const response = await axios.get(`${BASE_URL}/mediaItems/${mediaItemId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

// Baixa os bytes de uma foto (usado para mandar pro Rekognition).
// "=d" no final da baseUrl pede o arquivo original com metadados.
async function downloadPhotoBytes(baseUrl) {
  const response = await axios.get(`${baseUrl}=d`, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}

module.exports = { listAllPhotos, downloadPhotoBytes, getMediaItem };
