// Integracao com o banco vivera_crm (patients/deals/activities)
// A logica de round-robin de SDR replica EXATAMENTE a funcao getNextRoundRobinOwner()
// do webhook do Tintim em crm-server/server.js (linhas ~774-782), para manter a mesma
// distribuicao de leads entre Agda (userId 3) e Helenice (userId 2).
const pool = require('../db')

const ROUND_ROBIN_OWNERS = [ { name: 'Agda', userId: 3 }, { name: 'Helenice', userId: 2 } ]

async function getNextRoundRobinOwner() {
  return ROUND_ROBIN_OWNERS[1] // PAUSADO a pedido do Diego (31/07/2026): round-robin OFF, todo lead novo vai para Helenice ate novo aviso
  try {
    const [[last]] = await pool.query(
      "SELECT owner_name FROM deals WHERE owner_name IN ('Agda','Helenice') ORDER BY id DESC LIMIT 1"
    )
    if (last && last.owner_name === 'Agda') return ROUND_ROBIN_OWNERS[1]
    return ROUND_ROBIN_OWNERS[0]
  } catch (e) {
    console.error('[crm] getNextRoundRobinOwner error', e.message)
    return ROUND_ROBIN_OWNERS[0]
  }
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return null
  return '+' + (digits.startsWith('55') ? digits : '55' + digits)
}

function phoneDigitVariants(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return []
  const variants = new Set([digits])
  if (digits.startsWith('55') && digits.length >= 12) {
    const prefix = digits.slice(0, 4)
    const rest = digits.slice(4)
    if (rest.length === 9 && rest[0] === '9') variants.add(prefix + rest.slice(1))
    else if (rest.length === 8) variants.add(prefix + '9' + rest)
  }
  return Array.from(variants)
}

async function hasTintimOrigin(rawPhone) {
  const variants = phoneDigitVariants(rawPhone)
  if (!variants.length) return false
  const ph = variants.map(() => '?').join(',')
  const params = [...variants, ...variants, ...variants]
  const [rows] = await pool.query(
    `SELECT 1 AS ok FROM tintim_leads_raw WHERE REPLACE(REPLACE(phone,'+',''),' ','') IN (${ph}) OR REPLACE(REPLACE(phone_e164,'+',''),' ','') IN (${ph})
     UNION
     SELECT 1 AS ok FROM tintim_webhook_log WHERE REPLACE(REPLACE(phone,'+',''),' ','') IN (${ph})
     LIMIT 1`,
    params
  )
  return rows.length > 0
}

async function isCrmSyncGateEnabled() {
  const [rows] = await pool.query("SELECT config_value FROM chatbot_ai_config WHERE config_key='crm_sync_require_tintim' LIMIT 1")
  return rows.length > 0 && rows[0].config_value === 'true'
}

async function findPatientByPhone(rawPhone) {
  const exact = normalizePhone(rawPhone)
  if (exact) {
    const [exactRows] = await pool.query('SELECT * FROM patients WHERE phone = ? LIMIT 1', [exact])
    if (exactRows.length) return exactRows[0]
  }
  // sem match exato: tenta variantes com/sem 9o digito (cuidado, so usar como fallback -
  // numeros de pessoas DIFERENTES podem colidir nessa normalizacao)
  const variants = phoneDigitVariants(rawPhone).map(d => '+' + (d.startsWith('55') ? d : '55' + d))
  if (!variants.length) return null
  const placeholders = variants.map(() => '?').join(',')
  const [patients] = await pool.query('SELECT * FROM patients WHERE phone IN (' + placeholders + ') ORDER BY id ASC LIMIT 1', variants)
  return patients.length ? patients[0] : null
}

async function findOrCreatePatient(rawPhone, name) {
  const phone = normalizePhone(rawPhone)
  if (!phone) throw new Error('telefone invalido')
  const existing = await findPatientByPhone(rawPhone)
  if (existing) return { patient: existing, created: false }
  const [r] = await pool.query('INSERT INTO patients (name, phone) VALUES (?, ?)', [name || 'Lead WhatsApp sem nome', phone])
  const [[patient]] = await pool.query('SELECT * FROM patients WHERE id = ?', [r.insertId])
  return { patient, created: true }
}

async function findOpenDealByPatient(patientId) {
  const [rows] = await pool.query(
    `SELECT d.*, s.label AS stage_label FROM deals d JOIN stages s ON s.id = d.stage_id
     WHERE d.patient_id = ? AND d.status IS NULL OR (d.patient_id = ? AND d.status NOT IN ('won','lost'))
     ORDER BY d.id DESC LIMIT 1`,
    [patientId, patientId]
  ).catch(async () => {
    // fallback simples caso a coluna status tenha outro dominio
    return pool.query('SELECT * FROM deals WHERE patient_id = ? ORDER BY id DESC LIMIT 1', [patientId])
  })
  return rows[0] || null
}

async function findMostRecentDealByPatient(patientId) {
  const [rows] = await pool.query(
    `SELECT d.*, s.label AS stage_label FROM deals d JOIN stages s ON s.id = d.stage_id
     WHERE d.patient_id = ?
     ORDER BY d.id DESC LIMIT 1`,
    [patientId]
  )
  return rows.length ? rows[0] : null
}

async function reopenDeal(dealId, patientId) {
  const [[pl]] = await pool.query("SELECT id FROM pipelines WHERE slug = 'inbound'")
  const [[stage]] = await pool.query('SELECT id FROM stages WHERE pipeline_id = ? ORDER BY sort LIMIT 1', [pl.id])
  await pool.query(
    `UPDATE deals SET status = 'open', stage_id = ?, stage_entered_at = NOW() WHERE id = ?`,
    [stage.id, dealId]
  )
  await pool.query(
    'INSERT INTO activities (deal_id, patient_id, type, content) VALUES (?, ?, "system", ?)',
    [dealId, patientId, 'Deal reaberto automaticamente pelo Bot WhatsApp: paciente ja existente reengajou (correcao anti-duplicacao 31/07/2026)']
  )
  const [[deal]] = await pool.query('SELECT * FROM deals WHERE id = ?', [dealId])
  return deal
}

async function createDealForWhatsappLead({ patientId, patientName, phone, title }) {
  const [[pl]] = await pool.query("SELECT id FROM pipelines WHERE slug = 'inbound'")
  const [[stage]] = await pool.query('SELECT id FROM stages WHERE pipeline_id = ? ORDER BY sort LIMIT 1', [pl.id])
  const nextOwner = await getNextRoundRobinOwner()
  const [r] = await pool.query(
    `INSERT INTO deals (patient_id, pipeline_id, stage_id, title, origem, plataforma, owner_name, sdr_user_id, stage_entered_at, add_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [patientId, pl.id, stage.id, title || (patientName || 'Lead WhatsApp'), 'WhatsApp Bot', 'whatsapp', nextOwner.name, nextOwner.userId]
  )
  await pool.query(
    'INSERT INTO activities (deal_id, patient_id, type, content) VALUES (?, ?, "system", ?)',
    [r.insertId, patientId, 'Lead criado automaticamente pelo Bot WhatsApp (Vive)']
  )
  const [[deal]] = await pool.query('SELECT * FROM deals WHERE id = ?', [r.insertId])
  return deal
}

async function logActivity(dealId, patientId, content, type) {
  await pool.query('INSERT INTO activities (deal_id, patient_id, type, content) VALUES (?, ?, ?, ?)', [dealId, patientId, type || 'system', content])
}

// Estagio "Qualificado" no pipeline Inbound (confirmado via SELECT em stages: id=9, skey='qualificado').
const QUALIFICADO_STAGE_ID = 9

// Atualiza os campos de qualificacao do deal e move para o estagio Qualificado.
// Protegido por qualificado_at IS NULL: so escreve uma vez por deal, mesmo que
// o agente qualificador dispare de novo em mensagens seguintes.
async function updateQualification(dealId, patientId, qualification, crmSummary) {
  if (!dealId || !qualification) return
  await pool.query(
    `UPDATE deals SET qualificado = ?, regiao = ?, dor_necessidade = ?, intencao = ?, objections = ?, resumo_crm = ?, qualificado_at = NOW(), stage_id = ?
     WHERE id = ? AND qualificado_at IS NULL`,
    [qualification.qualificado || 'nao', qualification.regiao || null, qualification.dor_necessidade || null, qualification.intencao || null, (qualification.objecao != null ? JSON.stringify(qualification.objecao) : null), crmSummary || null, QUALIFICADO_STAGE_ID, dealId]
  )
}

module.exports = { normalizePhone, findOrCreatePatient, findOpenDealByPatient, findMostRecentDealByPatient, reopenDeal, createDealForWhatsappLead, logActivity, updateQualification, getNextRoundRobinOwner, ROUND_ROBIN_OWNERS, hasTintimOrigin, isCrmSyncGateEnabled, findPatientByPhone }
