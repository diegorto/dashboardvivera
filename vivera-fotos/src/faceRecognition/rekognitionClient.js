const {
  RekognitionClient,
  CreateCollectionCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  DetectFacesCommand,
  ResourceAlreadyExistsException,
} = require('@aws-sdk/client-rekognition');
const config = require('../config');

const client = new RekognitionClient({
  region: config.aws.region,
  credentials: config.aws.accessKeyId
    ? { accessKeyId: config.aws.accessKeyId, secretAccessKey: config.aws.secretAccessKey }
    : undefined,
});

let collectionReady = false;

async function ensureCollection() {
  if (collectionReady) return;
  try {
    await client.send(new CreateCollectionCommand({ CollectionId: config.aws.collectionId }));
  } catch (err) {
    if (!(err instanceof ResourceAlreadyExistsException)) throw err;
  }
  collectionReady = true;
}

// Cadastra o rosto de referencia do paciente na collection do Rekognition.
// ExternalImageId = id do paciente no nosso sistema, e o que volta na busca depois.
async function indexPatientFace(patientId, imageBytes) {
  await ensureCollection();
  const result = await client.send(
    new IndexFacesCommand({
      CollectionId: config.aws.collectionId,
      Image: { Bytes: imageBytes },
      ExternalImageId: patientId,
      DetectionAttributes: [],
      MaxFaces: 1,
      QualityFilter: 'AUTO',
    })
  );
  const face = result.FaceRecords && result.FaceRecords[0];
  if (!face) throw new Error('Nenhum rosto detectado na foto de referencia.');
  return face.Face.FaceId;
}

// Busca na collection qual paciente cadastrado mais se parece com o rosto da foto.
// Retorna null se nao encontrar nenhum rosto ou nenhum match acima do threshold.
async function findMatchingPatient(imageBytes, similarityThreshold = 90) {
  await ensureCollection();
  try {
    const result = await client.send(
      new SearchFacesByImageCommand({
        CollectionId: config.aws.collectionId,
        Image: { Bytes: imageBytes },
        FaceMatchThreshold: similarityThreshold,
        MaxFaces: 1,
      })
    );
    const match = result.FaceMatches && result.FaceMatches[0];
    if (!match) return null;
    return { patientId: match.Face.ExternalImageId, similarity: match.Similarity };
  } catch (err) {
    if (err.name === 'InvalidParameterException') return null; // nenhum rosto na imagem
    throw err;
  }
}

// Angulo de yaw (Pose) do rosto -> classifica em frontal / perfil 45 / lateral.
function classifyPoseFromYaw(yaw) {
  const abs = Math.abs(yaw);
  if (abs < 15) return 'frontal';
  if (abs < 60) return 'perfil_45';
  return 'lateral';
}

// Nota de qualidade da foto (0-100), usada pra escolher a "melhor" foto de cada
// dia/pose: prioriza nitidez, brilho equilibrado (nem escura nem estourada) e olhos abertos.
function computeQualityScore(face) {
  const sharpness = face.Quality.Sharpness || 0;
  const brightness = face.Quality.Brightness || 0;
  const brightnessScore = 100 - Math.abs(brightness - 50) * 2;
  const eyesOpenBonus = face.EyesOpen && face.EyesOpen.Value ? 15 : 0;
  return sharpness * 0.5 + Math.max(brightnessScore, 0) * 0.35 + eyesOpenBonus;
}

async function detectPose(imageBytes) {
  const result = await client.send(
    new DetectFacesCommand({ Image: { Bytes: imageBytes }, Attributes: ['ALL'] })
  );
  const face = result.FaceDetails && result.FaceDetails[0];
  if (!face) return null;
  return {
    yaw: face.Pose.Yaw,
    pose: classifyPoseFromYaw(face.Pose.Yaw),
    sharpness: face.Quality.Sharpness,
    brightness: face.Quality.Brightness,
    eyesOpen: face.EyesOpen ? face.EyesOpen.Value : null,
    qualityScore: computeQualityScore(face),
  };
}

module.exports = { indexPatientFace, findMatchingPatient, detectPose, classifyPoseFromYaw };
