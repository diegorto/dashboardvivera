const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const config = require('../config');
const patientsStore = require('./store');
const rekognition = require('../faceRecognition/rekognitionClient');

if (!fs.existsSync(config.UPLOADS_DIR)) fs.mkdirSync(config.UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: config.UPLOADS_DIR,
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

const router = express.Router();

// Cadastra um paciente com uma foto de referencia (rosto frontal, boa iluminacao).
// A foto e indexada no Rekognition para depois comparar com as fotos do Google Photos.
router.post('/', upload.single('photo'), async (req, res) => {
  const { name, consentimento } = req.body;

  if (!name || !req.file) {
    return res.status(400).json({ error: 'Informe "name" e envie uma foto ("photo").' });
  }
  if (consentimento !== 'true') {
    return res.status(400).json({
      error: 'Consentimento do paciente (LGPD) e obrigatorio para processar dado biometrico.',
    });
  }

  try {
    const imageBytes = fs.readFileSync(req.file.path);
    const patientId = crypto.randomUUID();
    const faceId = await rekognition.indexPatientFace(patientId, imageBytes);

    const patient = patientsStore.createPatient({
      id: patientId,
      name,
      faceId,
      referencePhotoPath: req.file.path,
      consentimentoLGPD: true,
    });

    res.status(201).json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  res.json(patientsStore.listPatients());
});

router.get('/:id', (req, res) => {
  const patient = patientsStore.getPatient(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Paciente nao encontrado.' });
  res.json(patient);
});

module.exports = router;
