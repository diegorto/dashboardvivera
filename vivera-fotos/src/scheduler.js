const cron = require('node-cron');
const patientsStore = require('./patients/store');
const photosClient = require('./googlePhotos/photosClient');
const processor = require('./timeline/processor');
const compositor = require('./timeline/compositor');

function normalize(name) {
  return (name || '').trim().toLowerCase();
}

// Casa cada paciente cadastrado com o album do Google Photos de mesmo nome,
// processa as fotos novas e regenera o antes/depois de cada pose.
async function runAutoScan() {
  console.log('[scheduler] iniciando varredura automatica...');
  try {
    const [albums, patients] = await Promise.all([
      photosClient.listAlbums(),
      Promise.resolve(patientsStore.listPatients()),
    ]);
    const byName = new Map(albums.map((a) => [normalize(a.title), a]));

    for (const patient of patients) {
      const album = byName.get(normalize(patient.name));
      if (!album) continue;

      const summary = await processor.processPatientAlbum(patient.id, album.id);
      console.log(`[scheduler] ${patient.name}: ${summary.novasProcessadas} foto(s) nova(s)`);

      if (summary.novasProcessadas > 0) {
        for (const pose of ['frontal', 'perfil_45', 'lateral']) {
          try {
            await compositor.buildBeforeAfter(patient.id, pose);
          } catch (err) {
            console.error(`[scheduler] erro ao montar antes/depois (${patient.name}, ${pose}): ${err.message}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('[scheduler] erro na varredura automatica:', err.message);
  }
  console.log('[scheduler] varredura automatica concluida.');
}

// Roda 2x por dia: 8h e 20h (horario de Brasilia).
function start() {
  cron.schedule('0 8,20 * * *', runAutoScan, { timezone: 'America/Sao_Paulo' });
  console.log('[scheduler] agendado para rodar as 8h e 20h (America/Sao_Paulo)');
}

module.exports = { start, runAutoScan };
