// Enriquece pacientes com o export de Pessoas do Pipedrive (telefones, e-mails, etiquetas).
// Casa pelo pipedrive_person_id. Cria pacientes que ainda nao existem (pessoa sem negocio).
// Uso: node scripts/enrich-people-export.js caminho/do/people.csv
require('dotenv').config()
const fs = require('fs')
const XLSX = require('xlsx')
const pool = require('../db')

function normPhone(raw) {
  if (!raw) return null
  // pode vir "486293372, 48999999999" — pega o primeiro valor com 8+ digitos
  for (const part of String(raw).split(',')) {
    const digits = part.replace(/[^\d]/g, '')
    if (digits.length >= 8) {
      return '+' + (digits.startsWith('55') && digits.length >= 12 ? digits : '55' + digits.replace(/^0+/, ''))
    }
  }
  return null
}

async function run(file) {
  if (!file || !fs.existsSync(file)) throw new Error('Arquivo não encontrado: ' + file)
  const wb = XLSX.readFile(file, { raw: true, codepage: 65001 })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
  const headers = rows[0].map(h => String(h).trim())
  const data = rows.slice(1).filter(r => r.some(c => String(c).trim() !== ''))
  const idx = name => headers.indexOf(name)

  const I = {
    id: idx('Pessoa - ID'),
    nome: idx('Pessoa - Nome'),
    etiqueta: idx('Pessoa - Etiqueta'),
    etiquetas: idx('Pessoa - Etiquetas'),
    telTrabalho: idx('Pessoa - Telefone - Trabalho'),
    telResid: idx('Pessoa - Telefone - Residencial'),
    telCel: idx('Pessoa - Telefone - Celular'),
    telOutros: idx('Pessoa - Telefone - Outros'),
    emailTrab: idx('Pessoa - E-mail - Trabalho'),
    emailResid: idx('Pessoa - E-mail - Residencial'),
    emailOutros: idx('Pessoa - E-mail - Outros'),
    criada: idx('Pessoa - Pessoa criada'),
  }

  console.log(`Lendo ${data.length} pessoas de ${file}`)
  const [patRows] = await pool.query('SELECT id, pipedrive_person_id, phone, email FROM patients WHERE pipedrive_person_id IS NOT NULL')
  const byPdId = new Map(patRows.map(p => [String(p.pipedrive_person_id), p]))

  let phones = 0, emails = 0, createdCount = 0, matched = 0, notes = 0
  for (const row of data) {
    const get = i => (i >= 0 ? String(row[i] ?? '').trim() : '')
    const pdId = get(I.id)
    const name = get(I.nome)
    if (!pdId || !name) continue

    // celular > outros > residencial > trabalho
    const phone = normPhone(get(I.telCel)) || normPhone(get(I.telOutros)) || normPhone(get(I.telResid)) || normPhone(get(I.telTrabalho))
    const email = get(I.emailTrab) || get(I.emailResid) || get(I.emailOutros) || null
    const tags = [get(I.etiqueta), get(I.etiquetas)].filter(Boolean).join(', ') || null

    const existing = byPdId.get(pdId)
    if (existing) {
      matched++
      if (phone && !existing.phone) { await pool.query('UPDATE patients SET phone = ? WHERE id = ?', [phone, existing.id]); phones++ }
      if (email && !existing.email) { await pool.query('UPDATE patients SET email = ? WHERE id = ?', [email, existing.id]); emails++ }
      if (tags) {
        const [r] = await pool.query('UPDATE patients SET notes = COALESCE(notes, ?) WHERE id = ? AND notes IS NULL', [`Etiquetas Pipedrive: ${tags}`, existing.id])
        if (r.affectedRows) notes++
      }
    } else {
      // pessoa sem negocio importado — cadastra mesmo assim (base de contatos completa)
      await pool.query(
        'INSERT INTO patients (name, phone, email, pipedrive_person_id, notes) VALUES (?, ?, ?, ?, ?)',
        [name, phone, email, pdId, tags ? `Etiquetas Pipedrive: ${tags}` : null])
      createdCount++
    }
  }

  const [[cov]] = await pool.query(
    `SELECT COUNT(*) total, SUM(phone IS NOT NULL) com_tel, SUM(email IS NOT NULL) com_email FROM patients`)
  const result = {
    pessoasNoArquivo: data.length, casadas: matched, criadas: createdCount,
    telefonesPreenchidos: phones, emailsPreenchidos: emails,
    cobertura: `${cov.com_tel}/${cov.total} pacientes com telefone (${Math.round(cov.com_tel / cov.total * 100)}%)`
  }
  console.log('Enriquecimento concluído:', result)
  return result
}

if (require.main === module) {
  if (process.env.CONFIRM_DESTRUCTIVE_IMPORT !== 'yes') { console.error('[SAFETY] Pipedrive foi descontinuado 22/07/2026 - nao rodar mais scripts que leem/escrevem no Pipedrive.'); process.exit(1); }
  
  
  run(process.argv[2]).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
}
module.exports = { run }
