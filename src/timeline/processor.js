const store = require('../lib/jsonStore');
const photosClient = require('../googlePhotos/photosClient');
const rekognition = require('../faceRecognition/rekognitionClient');

const TIMELINE_FILE = 'timeline.json';

function loadTimeline() {
  return store.read(TIMELINE_FILE, { processedPhotoIds: [], entries: [] });
}

function saveTimeline(timeline) {
  store.write(TIMELINE_FILE, timeline);
}

// Varre a biblioteca do Google Photos, identifica o paciente de cada foto (Rekognition)
// e classifica a pose (frontal / perfil_45 / lateral) via angulo de yaw do rosto.
// So processa fotos ainda nao vistas (processedPhotoIds), pra nao gastar Rekognition a toa.
async function processGooglePhotosLibrary() {
  const timeline = loadTimeline();
  const processedSet = new Set(timeline.processedPhotoIds);

  const photos = await photosClient.listAllPhotos();
  const pending = photos.filter((photo) => !processedSet.has(photo.id));

  let matched = 0;
  for (const photo of pending) {
    try {
      const bytes = await photosClient.downloadPhotoBytes(photo.baseUrl);
      const match = await rekognition.findMatchingPatient(bytes);

      if (match) {
        const pose = await rekognition.detectPose(bytes);
        timeline.entries.push({
          patientId: match.patientId,
          similarity: match.similarity,
          photoId: photo.id,
          filename: photo.filename,
          creationTime: photo.mediaMetadata.creationTime,
          pose: pose ? pose.pose : 'desconhecida',
          yaw: pose ? pose.yaw : null,
        });
        matched += 1;
      }
    } catch (err) {
      console.error(`Erro ao processar foto ${photo.id}: ${err.message}`);
    } finally {
      processedSet.add(photo.id);
    }
  }

  timeline.processedPhotoIds = Array.from(processedSet);
  saveTimeline(timeline);

  return { scanned: photos.length, novasProcessadas: pending.length, matched };
}

function getPatientTimeline(patientId, pose) {
  const timeline = loadTimeline();
  return timeline.entries
    .filter((e) => e.patientId === patientId && (!pose || e.pose === pose))
    .sort((a, b) => new Date(a.creationTime) - new Date(b.creationTime));
}

module.exports = { processGooglePhotosLibrary, getPatientTimeline };
