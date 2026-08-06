// Importa o export REAL de negócios do Pipedrive (formato "Negócio - *", PT-BR).
// Uso: node scripts/import-real-export.js caminho/do/deals.csv
//
// - Pessoas casadas pelo "ID da pessoa de contato" do Pipedrive (telefone quando houver)
// - Funis/etapas criados automaticamente se não existirem (match por nome)
// - Etiquetas, procedimentos e origens cadastrados automaticamente
// - Roda quantas vezes precisar: não duplica (chave = ID do negócio no Pipedrive)
require('dotenv').config()
const fs = require('fs')
const XLSX = require('xlsx')
const pool = require('../db')

function normPhone(v) {
  if (!v) return null
  const digits = String(v).replace(/[^\d]/g, '')
  if (digits.length < 8) return null
  return '+' + (digits.startsWith('55') ? digits : '55' + digits.replace(/^0+/, ''))
}

function parseDate(v) {
  if (!v) return null
  const s = String(v).trim()
  if (!s) return null
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'))
  return isNaN(d) ? null : d.toISOString().slice(0, 19).replace('T', ' ')
}

const LABEL_COLORS = ['teal', 'blue', 'purple', 'amber', 'green', 'red', 'gray']

async function run(file) {
  if (!file || !fs.existsSync(file)) throw new Error('Arquivo não encontrado: ' + file)
  const wb = XLSX.readFile(file, { raw: true, codepage: 65001 })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  const headers = rows[0].map(h => String(h).trim())
  const data = rows.slice(1).filter(r => r.some(c => String(c).trim() !== ''))

  // indice por nome; para duplicatas ("Negócio - Origem" aparece 2x) guarda TODAS as posicoes
  const idxAll = {}
  headers.forEach((h, i) => { (idxAll[h] = idxAll[h] || []).push(i) })
  const first = h => (idxAll[h] ? idxAll[h][0] : -1)
  const last = h => (idxAll[h] ? idxAll[h][idxAll[h].length - 1] : -1)

  const I = {
    id: first('Negócio - ID'),
    titulo: first('Negócio - Título'),
    owner: first('Negócio - Proprietário'),
    funil: first('Negócio - Funil'),
    etapa: first('Negócio - Etapa'),
    status: first('Negócio - Status'),
    criadoEm: first('Negócio - Negócio criado em'),
    mudancaEtapa: first('Negócio - Última alteração de etapa'),
    proximaAtividade: first('Negócio - Próxima atividade em'),
    ganhoEm: first('Negócio - Ganho em'),
    perdaEm: first('Negócio - Data de perda'),
    motivoPerda: first('Negócio - Motivo da perda'),
    valor: first('Negócio - Valor'),
    pessoa: first('Negócio - Pessoa de contato'),
    pessoaId: first('Negócio - ID da pessoa de contato'),
    etiqueta: first('Negócio - Etiqueta'),
    telefone: first('Negócio - Telefone'),
    procedimento: first('Negócio - Procedimento'),
    origem: last('Negócio - Origem'),          // ultima ocorrencia = campo personalizado
    plataforma: first('Negócio - Plataforma'),
    campanha: first('Negócio - Campanha'),
    conjunto: first('Negócio - Conjunto de anúncio'),
    palavraChave: first('Negócio - Palavra Chave'),
    dor: first('Negócio - Dor'),
    regiao: first('Negócio - Região'),
  }

  console.log(`Lendo ${data.length} negócios de ${file}`)
  const [runRow] = await pool.query('INSERT INTO sync_runs (kind) VALUES ("import")')
  const runId = runRow.insertId

  // caches
  const [pipelinesRows] = await pool.query('SELECT id, name FROM pipelines')
  const pipelineByName = new Map(pipelinesRows.map(p => [p.name.toLowerCase(), p.id]))
  const [stagesRows] = await pool.query('SELECT id, pipeline_id, label FROM stages')
  const stageKeyOf = (pid, label) => `${pid}::${String(label).toLowerCase().trim()}`
  const stageByName = new Map(stagesRows.map(s => [stageKeyOf(s.pipeline_id, s.label), s.id]))
  const [labelRows] = await pool.query('SELECT id, name FROM labels')
  const labelByName = new Map(labelRows.map(l => [l.name.toLowerCase(), l.id]))
  const patientByPdId = new Map()
  const [patRows] = await pool.query('SELECT id, pipedrive_person_id FROM patients WHERE pipedrive_person_id IS NOT NULL')
  patRows.forEach(p => patientByPdId.set(String(p.pipedrive_person_id), p.id))

  let nextSort = 100
  async function ensurePipeline(name) {
    const key = String(name || 'Inbound').toLowerCase().trim()
    if (pipelineByName.has(key)) return pipelineByName.get(key)
    const slug = key.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')
    const [r] = await pool.query('INSERT INTO pipelines (slug, name, sort) VALUES (?, ?, ?)', [slug, name, nextSort++])
    pipelineByName.set(key, r.insertId)
    return r.insertId
  }
  async function ensureStage(pipelineId, label) {
    const key = stageKeyOf(pipelineId, label)
    if (stageByName.has(key)) return stageByName.get(key)
    const skey = String(label).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 55)
    const [r] = await pool.query('INSERT INTO stages (pipeline_id, skey, label, sort) VALUES (?, ?, ?, ?)', [pipelineId, skey, label, nextSort++])
    stageByName.set(key, r.insertId)
    return r.insertId
  }
  async function ensureLabel(name) {
    const key = name.toLowerCase()
    if (labelByName.has(key)) return labelByName.get(key)
    const color = LABEL_COLORS[labelByName.size % LABEL_COLORS.length]
    const [r] = await pool.query('INSERT INTO labels (name, color) VALUES (?, ?)', [name, color])
    labelByName.set(key, r.insertId)
    return r.insertId
  }

  const proceduresSeen = new Set()
  const originsSeen = new Set()
  let imported = 0, updated = 0, skipped = 0

  for (const row of data) {
    const get = i => (i >= 0 ? String(row[i] ?? '').trim() : '')
    const pdId = get(I.id)
    const personName = get(I.pessoa) || get(I.titulo)
    if (!pdId || !personName) { skipped++; continue }

    try {
      const pipelineId = await ensurePipeline(get(I.funil) || 'Inbound')
      const stageId = await ensureStage(pipelineId, get(I.etapa) || 'Entrada')

      // paciente (pessoa) — casa pelo ID de pessoa do Pipedrive
      const personId = get(I.pessoaId)
      const phone = normPhone(get(I.telefone))
      let patientId = personId ? patientByPdId.get(personId) : null
      if (!patientId && phone) {
        const [p] = await pool.query('SELECT id FROM patients WHERE phone = ?', [phone])
        if (p[0]) patientId = p[0].id
      }
      if (patientId) {
        if (phone) await pool.query('UPDATE patients SET phone = COALESCE(phone, ?) WHERE id = ?', [phone, patientId])
      } else {
        const [r] = await pool.query(
          'INSERT INTO patients (name, phone, pipedrive_person_id) VALUES (?, ?, ?)',
          [personName, phone, personId || null])
        patientId = r.insertId
        if (personId) patientByPdId.set(personId, patientId)
      }

      const statusRaw = get(I.status).toLowerCase()
      const status = statusRaw === 'ganho' ? 'won' : statusRaw === 'perdido' ? 'lost' : 'open'
      const procedimento = get(I.procedimento) || null
      if (procedimento) procedimento.split(',').map(s => s.trim()).filter(Boolean).forEach(p => proceduresSeen.add(p))
      const origem = get(I.origem) || null
      if (origem) originsSeen.add(origem)
      const campanha = get(I.campanha) || null
      const palavra = get(I.palavraChave) || null
      const notaExtra = [get(I.dor) && `Dor: ${get(I.dor)}`, get(I.regiao) && `Região: ${get(I.regiao)}`].filter(Boolean).join(' · ')

      const vals = {
        title: get(I.titulo) || personName,
        value: parseFloat(get(I.valor)) || 0,
        status,
        stage_id: stageId,
        pipeline_id: pipelineId,
        procedure_name: procedimento,
        origem,
        plataforma: get(I.plataforma) || null,
        campanha,
        conjunto: get(I.conjunto) || null,
        criativo: palavra,
        palavra_chave: palavra,
        owner_name: get(I.owner) || null,
        add_date: parseDate(get(I.criadoEm)),
        won_date: parseDate(get(I.ganhoEm)),
        lost_date: parseDate(get(I.perdaEm)),
        stage_entered_at: parseDate(get(I.mudancaEtapa)) || parseDate(get(I.criadoEm)),
        loss_reason: get(I.motivoPerda) || null,
      }

      const [existing] = await pool.query('SELECT id FROM deals WHERE pipedrive_id = ?', [pdId])
      let dealId
      if (existing[0]) {
        dealId = existing[0].id
        await pool.query(
          `UPDATE deals SET patient_id=?, pipeline_id=?, stage_id=?, title=?, value=?, status=?, procedure_name=?,
             origem=?, plataforma=?, campanha=?, conjunto=?, criativo=?, palavra_chave=?, owner_name=?,
             add_date=COALESCE(?, add_date), won_date=?, lost_date=?, stage_entered_at=COALESCE(?, stage_entered_at),
             loss_reason=?, sync_status='imported'
           WHERE id=?`,
          [patientId, vals.pipeline_id, vals.stage_id, vals.title, vals.value, vals.status, vals.procedure_name,
           vals.origem, vals.plataforma, vals.campanha, vals.conjunto, vals.criativo, vals.palavra_chave, vals.owner_name,
           vals.add_date, vals.won_date, vals.lost_date, vals.stage_entered_at, vals.loss_reason, dealId])
        updated++
      } else {
        const [r] = await pool.query(
          `INSERT INTO deals (patient_id, pipeline_id, stage_id, title, value, status, procedure_name,
             origem, plataforma, campanha, conjunto, criativo, palavra_chave, owner_name,
             add_date, won_date, lost_date, stage_entered_at, loss_reason, pipedrive_id, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()), ?, ?, COALESCE(?, NOW()), ?, ?, 'imported')`,
          [patientId, vals.pipeline_id, vals.stage_id, vals.title, vals.value, vals.status, vals.procedure_name,
           vals.origem, vals.plataforma, vals.campanha, vals.conjunto, vals.criativo, vals.palavra_chave, vals.owner_name,
           vals.add_date, vals.won_date, vals.lost_date, vals.stage_entered_at, vals.loss_reason, pdId])
        dealId = r.insertId
        imported++
      }

      // etiquetas
      const labelsRaw = get(I.etiqueta)
      if (labelsRaw) {
        const names = labelsRaw.split(',').map(s => s.trim()).filter(Boolean)
        await pool.query('DELETE FROM deal_labels WHERE deal_id = ?', [dealId])
        for (const n of names) {
          const lid = await ensureLabel(n)
          await pool.query('INSERT IGNORE INTO deal_labels (deal_id, label_id) VALUES (?, ?)', [dealId, lid])
        }
      }

      // proxima atividade agendada vira tarefa aberta
      const prox = parseDate(get(I.proximaAtividade))
      if (prox && status === 'open') {
        const [has] = await pool.query(
          'SELECT id FROM activities WHERE deal_id = ? AND type = "task" AND done = 0 LIMIT 1', [dealId])
        if (!has[0]) {
          await pool.query(
            'INSERT INTO activities (deal_id, patient_id, type, content, due_at) VALUES (?, ?, "task", "Atividade migrada do Pipedrive", ?)',
            [dealId, patientId, prox])
        }
      }

      // nota com dor/regiao
      if (notaExtra) {
        const [hasNote] = await pool.query(
          'SELECT id FROM activities WHERE deal_id = ? AND type = "note" AND content = ? LIMIT 1', [dealId, notaExtra])
        if (!hasNote[0]) {
          await pool.query('INSERT INTO activities (deal_id, patient_id, type, content) VALUES (?, ?, "note", ?)', [dealId, patientId, notaExtra])
        }
      }
    } catch (e) {
      console.error(`Linha com erro (ID ${pdId}):`, e.message)
      skipped++
    }
  }

  // catalogos
  for (const name of proceduresSeen) {
    await pool.query('INSERT INTO procedures (name) VALUES (?) ON DUPLICATE KEY UPDATE active = 1', [name])
  }
  let sort = 50
  for (const name of originsSeen) {
    await pool.query('INSERT INTO lead_origins (name, sort) VALUES (?, ?) ON DUPLICATE KEY UPDATE active = 1', [name, sort++])
  }

  // recalcula LTV de todo mundo
  await pool.query(
    `UPDATE patients p SET p.ltv = (SELECT COALESCE(SUM(d.value),0) FROM deals d WHERE d.patient_id = p.id AND d.status = 'won')`)

  await pool.query('UPDATE sync_runs SET finished_at = NOW(), status = "ok", deals_checked = ? WHERE id = ?', [data.length, runId])
  const result = { imported, updated, skipped, total: data.length, procedimentos: proceduresSeen.size, origens: originsSeen.size }
  console.log('Importação concluída:', result)
  return result
}

if (require.main === module) {
  if (process.env.CONFIRM_DESTRUCTIVE_IMPORT !== 'yes') { console.error('[SAFETY] Este script sobrescreve deals existentes (status/valor/titulo) com um export estatico antigo. Ja causou perda de dados de negocios Ganho em producao (21/07 e 22/07/2026). Rode com CONFIRM_DESTRUCTIVE_IMPORT=yes apenas se tiver certeza absoluta.'); process.exit(1); }
  
  
  run(process.argv[2]).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
}
module.exports = { run }
