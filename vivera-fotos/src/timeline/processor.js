const fs = require('fs');
const path = require('path');
const store = require('../lib/jsonStore');
const rekognition = require('../faceRecognition/rekognitionClient');
const pickerClient = require('../googlePhotos/pickerClient');
const { PHOTOS_DIR } = require('../config');

const TIMELINE_FILE = 'timeline.json';

if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });

function loadTimeline() {
  return store.read(TIMELINE_FILE, { processedPhotoIds: [], entries: [] });
}

function saveTimeline(timeline) {
  store.write(TIMELINE_FILE, timeline);
}

// Processa as fotos que o usuario selecionou via Google Photos Picker.
// Baixa os bytes uma unica vez e guarda localmente (o link do Google expira em ~1h,
// entao nao da pra depender dele pra exibir depois). Antes de aceitar a foto,
// confere pelo rosto (Rekognition) se e realmente o paciente cadastrado - assim
// da pra selecionar de forma mais ampla no Picker que o sistema descarta sozinho
// quem nao bate (ex: familiares, outras pessoas na mesma foto/album).
async function processPickerItems(patientId, items) {
  const timeline = loadTimeline();
  const processedSet = new Set(timeline.processedPhotoIds);
  const patientDir = path.join(PHOTOS_DIR, patientId);
  if (!fs.existsSync(patientDir)) fs.mkdirSync(patientDir, { recursive: true });

  const pending = items.filter((item) => !processedSet.has(item.id));
  let processadas = 0;
  let descartadas = 0;
  let comErro = 0;

  for (const item of pending) {
    try {
      const bytes = await pickerClient.downloadPhotoBytes(item.baseUrl);

      const match = await rekognition.findMatchingPatient(bytes);
      if (!match || match.patientId !== patientId) {
        descartadas += 1;
        processedSet.add(item.id); // rosto nao bate (ou nenhum rosto) - descarta e nao tenta de novo
        continue;
      }

      const localFile = `${patientId}/${item.id}.jpg`;
      fs.writeFileSync(path.join(patientDir, `${item.id}.jpg`), bytes);

      const pose = await rekognition.detectPose(bytes);
      timeline.entries.push({
        patientId,
        photoId: item.id,
        filename: item.filename,
        creationTime: item.creationTime,
        localFile,
        similarity: match.similarity,
        pose: pose ? pose.pose : 'desconhecida',
        yaw: pose ? pose.yaw : null,
        qualityScore: pose ? pose.qualityScore : 0,
      });
      processadas += 1;
      processedSet.add(item.id);
    } catch (err) {
      console.error(`Erro ao processar foto ${item.id}: ${err.message}`);
      comErro += 1;
      // nao marca como processada - erro pode ser transitorio (rede, token expirado), tenta de novo depois
    }
  }

  timeline.processedPhotoIds = Array.from(processedSet);
  saveTimeline(timeline);

  return { selecionadas: items.length, novasProcessadas: pending.length, processadas, descartadas, comErro };
}

function getPatientTimeline(patientId, pose) {
  const timeline = loadTimeline();
  return timeline.entries
    .filter((e) => e.patientId === patientId && (!pose || e.pose === pose))
    .sort((a, b) => new Date(a.creationTime) - new Date(b.creationTime));
}

module.exports = { processPickerItems, getPatientTimeline };
