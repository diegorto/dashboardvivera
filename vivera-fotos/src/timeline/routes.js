const express = require('express');
const processor = require('./processor');
const compositor = require('./compositor');
const patientsStore = require('../patients/store');

const router = express.Router();

// Linha do tempo de um paciente, opcionalmente filtrada por tipo de pose
// (frontal | perfil_45 | lateral), ordenada por data para comparar antes/depois.
// As fotos ja ficam guardadas localmente (baixadas na importacao do Picker),
// entao aqui e so montar a URL servida por /photos.
router.get('/patients/:id/timeline', (req, res) => {
  const patient = patientsStore.getPatient(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Paciente nao encontrado.' });

  const { pose } = req.query;
  const entries = processor.getPatientTimeline(req.params.id, pose);
  const fotos = entries.map((entry) => ({ ...entry, url: `/photos/${entry.localFile}` }));

  res.json({ patient: { id: patient.id, name: patient.name }, pose: pose || 'todas', fotos });
});

// Gera (ou regenera) a imagem antes/depois lado a lado, escolhendo a foto de
// melhor qualidade do dia mais antigo e do dia mais recente daquela pose.
router.post('/patients/:id/before-after', async (req, res) => {
  const patient = patientsStore.getPatient(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Paciente nao encontrado.' });

  const { pose } = req.query;
  try {
    const result = await compositor.buildBeforeAfter(req.params.id, pose);
    if (!result) {
      return res.status(404).json({
        error: 'Ainda nao ha fotos suficientes em dias diferentes para montar o antes/depois dessa pose.',
      });
    }
    res.json({
      url: `/composites/${result.fileName}`,
      before: { date: result.before.creationTime },
      after: { date: result.after.creationTime },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
