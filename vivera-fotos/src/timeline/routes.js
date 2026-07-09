const express = require('express');
const processor = require('./processor');
const photosClient = require('../googlePhotos/photosClient');
const patientsStore = require('../patients/store');

const router = express.Router();

// Dispara a varredura da biblioteca do Google Photos + identificacao de pacientes.
// Pode demorar (baixa e analisa cada foto nao processada ainda via Rekognition).
router.post('/timeline/process', async (req, res) => {
  try {
    const summary = await processor.processGooglePhotosLibrary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Linha do tempo de um paciente, opcionalmente filtrada por tipo de pose
// (frontal | perfil_45 | lateral), ordenada por data para comparar antes/depois.
router.get('/patients/:id/timeline', async (req, res) => {
  const patient = patientsStore.getPatient(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Paciente nao encontrado.' });

  const { pose } = req.query;
  const entries = processor.getPatientTimeline(req.params.id, pose);

  try {
    const withUrls = await Promise.all(
      entries.map(async (entry) => {
        const mediaItem = await photosClient.getMediaItem(entry.photoId);
        return { ...entry, url: `${mediaItem.baseUrl}=w800` };
      })
    );
    res.json({ patient: { id: patient.id, name: patient.name }, pose: pose || 'todas', fotos: withUrls });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
