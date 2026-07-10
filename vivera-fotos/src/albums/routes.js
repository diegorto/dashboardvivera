const express = require('express');
const photosClient = require('../googlePhotos/photosClient');
const patientsStore = require('../patients/store');
const processor = require('../timeline/processor');

const router = express.Router();

function normalize(name) {
  return (name || '').trim().toLowerCase();
}

// Lista os albuns do Google Photos e casa pelo nome com pacientes ja cadastrados.
router.get('/albums', async (req, res) => {
  try {
    const [albums, patients] = await Promise.all([
      photosClient.listAlbums(),
      Promise.resolve(patientsStore.listPatients()),
    ]);

    const byName = new Map(patients.map((p) => [normalize(p.name), p]));

    const result = albums.map((album) => {
      const patient = byName.get(normalize(album.title));
      return {
        albumId: album.id,
        title: album.title,
        mediaItemsCount: album.mediaItemsCount,
        patient: patient ? { id: patient.id, name: patient.name } : null,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Processa as fotos de um album que corresponde a um paciente (classifica pose de cada foto).
router.post('/albums/:albumId/process', async (req, res) => {
  const { patientId } = req.body;
  if (!patientId) return res.status(400).json({ error: 'Informe "patientId".' });

  const patient = patientsStore.getPatient(patientId);
  if (!patient) return res.status(404).json({ error: 'Paciente nao encontrado.' });

  try {
    const summary = await processor.processPatientAlbum(patientId, req.params.albumId);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
