const crypto = require('crypto');
const store = require('../lib/jsonStore');

const PATIENTS_FILE = 'patients.json';

function listPatients() {
  return store.read(PATIENTS_FILE, []);
}

function getPatient(id) {
  return listPatients().find((p) => p.id === id) || null;
}

function createPatient({ id, name, faceId, referencePhotoPath, consentimentoLGPD }) {
  const patients = listPatients();
  const patient = {
    id: id || crypto.randomUUID(),
    name,
    faceId,
    referencePhotoPath,
    consentimentoLGPD: !!consentimentoLGPD,
    createdAt: new Date().toISOString(),
  };
  patients.push(patient);
  store.write(PATIENTS_FILE, patients);
  return patient;
}

module.exports = { listPatients, getPatient, createPatient };
