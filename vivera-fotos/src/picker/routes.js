const express = require('express');
const pickerClient = require('../googlePhotos/pickerClient');
const patientsStore = require('../patients/store');
const processor = require('../timeline/processor');
const compositor = require('../timeline/compositor');
const store = require('../lib/jsonStore');

const SESSIONS_FILE = 'picker-sessions.json';
const router = express.Router();

function loadSessions() {
  return store.read(SESSIONS_FILE, {});
}
function saveSessions(sessions) {
  store.write(SESSIONS_FILE, sessions);
}

// Abre uma sessao de selecao do Google Photos Picker para esse paciente.
// O front-end deve abrir a pickerUri retornada numa nova aba pro usuario escolher as fotos.
router.post('/patients/:id/picker/session', async (req, res) => {
  const patient = patientsStore.getPatient(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Paciente nao encontrado.' });

  try {
    const session = await pickerClient.createSession();
    const sessions = loadSessions();
    sessions[req.params.id] = { sessionId: session.id };
    saveSessions(sessions);
    res.json({ pickerUri: session.pickerUri, sessionId: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verifica se o usuario ja terminou de escolher as fotos na sessao aberta.
router.get('/patients/:id/picker/status', async (req, res) => {
  const sessions = loadSessions();
  const saved = sessions[req.params.id];
  if (!saved) return res.status(404).json({ error: 'Nenhuma sessao de selecao aberta para esse paciente.' });

  try {
    const session = await pickerClient.getSession(saved.sessionId);
    res.json({ mediaItemsSet: !!session.mediaItemsSet });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Depois que o usuario termina de escolher, importa as fotos selecionadas:
// baixa, guarda localmente e classifica a pose de cada uma.
router.post('/patients/:id/picker/import', async (req, res) => {
  const patient = patientsStore.getPatient(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Paciente nao encontrado.' });

  const sessions = loadSessions();
  const saved = sessions[req.params.id];
  if (!saved) return res.status(404).json({ error: 'Nenhuma sessao de selecao aberta para esse paciente.' });

  try {
    const items = await pickerClient.listSessionMediaItems(saved.sessionId);
    const summary = await processor.processPickerItems(req.params.id, items);

    if (summary.novasProcessadas > 0) {
      for (const pose of ['frontal', 'perfil_45', 'lateral']) {
        try {
          await compositor.buildBeforeAfter(req.params.id, pose);
        } catch (err) {
          console.error(`Erro ao montar antes/depois (${patient.name}, ${pose}): ${err.message}`);
        }
      }
    }

    await pickerClient.deleteSession(saved.sessionId).catch(() => {});
    delete sessions[req.params.id];
    saveSessions(sessions);

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
