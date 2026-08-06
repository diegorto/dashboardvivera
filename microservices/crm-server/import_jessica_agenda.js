const mysql = require('mysql2/promise');

function normalizePhoneBR(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/[^0-9]/g, '');
  if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2);
  if (d.length < 10) return null;
  const ddd = d.slice(0, 2);
  const suffix8 = d.slice(-8);
  return ddd + suffix8;
}

function toE164(raw) {
  let d = String(raw).replace(/[^0-9]/g, '');
  if (d.indexOf('55') === 0 && d.length > 11) d = d.slice(2);
  return '+55' + d;
}

function parseDateTime(s) {
  const [datePart, timePart] = s.split(' ');
  const [dd, mm, yyyy] = datePart.split('/');
  return `${yyyy}-${mm}-${dd} ${timePart}:00`;
}

function addHour(mysqlDt) {
  const [datePart, timePart] = mysqlDt.split(' ');
  const [y, mo, da] = datePart.split('-').map(Number);
  const [ho, mi] = timePart.split(':').map(Number);
  const d = new Date(y, mo - 1, da, ho + 1, mi, 0);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

const DENTIST_USER_ID = 6; // Jessica Lorena Goncalves Nascimento (users.id)
const CREATED_BY_USER_ID = 1; // Diego

const records = [
  {name:"Mônica Oliveira Ferreira", phone:"48 9113 1621", dt:"08/09/2026 14:00", status:"AGENDADA"},
  {name:"Clarice Cacciari", phone:"48 9116 5342", dt:"13/08/2026 15:00", status:"AGENDADA"},
  {name:"Silvia Barbosa Lopes", phone:"48 9151 1822", dt:"10/08/2026 15:00", status:"AGENDADA"},
  {name:"Regina Alonso da Silva", phone:"48 99864 2122", dt:"10/08/2026 09:00", status:"AGENDADA"},
  {name:"Neli Do Carmo Da Silva Ribeiro", phone:"48 99600 4749", dt:"06/08/2026 15:30", status:"AGENDADA"},
  {name:"Marcia Boechat", phone:"41 99127 1333", dt:"03/08/2026 17:00", status:"AGENDADA"},
  {name:"Felipe de Oliveira Lima Rosa", phone:"66 9900 8926", dt:"03/08/2026 16:00", status:"AGENDADA"},
  {name:"Jeniffer Rosa Buch Lima", phone:"66 99900 8926", dt:"03/08/2026 16:00", status:"AGENDADA"},
  {name:"Maíra Vieira", phone:"48 8453 2486", dt:"03/08/2026 15:00", status:"AGENDADA"},
  {name:"Silvia Goulart", phone:"+55 48 9655 6668", dt:"03/08/2026 11:00", status:"AGENDADA"},
  {name:"Valfride Schmitt", phone:"48 9671 1522", dt:"31/07/2026 17:45", status:"AGENDADA"},
  {name:"Jucélia Machado", phone:"48 8459 6524", dt:"31/07/2026 17:00", status:"AGENDADA"},
  {name:"Maria Aparecida de Siqueira de Souza", phone:"48 9120 2913", dt:"31/07/2026 16:00", status:"AGENDADA"},
  {name:"Célia Regina Machado De Sousa", phone:"48 99927 4001", dt:"31/07/2026 15:00", status:"AGENDADA"},
  {name:"Daiana da Silva Silveira", phone:"48 99801 8049", dt:"31/07/2026 14:00", status:"AGENDADA"},
  {name:"ZAIRA FEUSER LEHMKUHL", phone:"(48) 99947-4747", dt:"31/07/2026 11:00", status:"AGENDADA"},
  {name:"Viviane Regina Wojcikiewvicz", phone:"48 98457 8523", dt:"31/07/2026 10:30", status:"AGENDADA"},
  {name:"Alice Peluso De Andrade Almada Rocha", phone:"12 99605 2345", dt:"31/07/2026 08:30", status:"CONFIRMADA"},
  {name:"Luciana Oliveira Danielski", phone:"48 99862 3510", dt:"30/07/2026 17:30", status:"AGENDADA"},
  {name:"Hellen Nunes", phone:"54 98445 6603", dt:"30/07/2026 17:00", status:"AGENDADA"},
  {name:"Almira Braz Do Bonfim", phone:"73 9969 4100", dt:"30/07/2026 16:00", status:"AGENDADA"},
  {name:"Tania Regina ventura Muller", phone:"48 98811 9417", dt:"30/07/2026 14:45", status:"AGENDADA"},
  {name:"Gisele Takaki", phone:"48 98496 6664", dt:"30/07/2026 14:00", status:"AGENDADA"},
  {name:"Arleny Jaqueline Mangrich Pacheco", phone:"48 98408 5186", dt:"30/07/2026 13:00", status:"AGENDADA"},
  {name:"Perla Silva de Souza", phone:"48 9952 1663", dt:"30/07/2026 11:00", status:"AGENDADA"},
  {name:"Janaina Santos de Macedo", phone:"48 9959 7213", dt:"30/07/2026 09:00", status:"AGENDADA"},
  {name:"Clair Fagundes", phone:"48 99656 2341", dt:"29/07/2026 17:00", status:"AGENDADA"},
  {name:"Greysi Tamara Farias", phone:"48 98447 0209", dt:"29/07/2026 16:15", status:"AGENDADA"},
  {name:"Leni Campos", phone:"48 9956 6167", dt:"29/07/2026 15:00", status:"AGENDADA"},
  {name:"Priscilla Baumann", phone:"48 9938 5743", dt:"29/07/2026 13:45", status:"CONFIRMADA"},
  {name:"Andressa Stadnik", phone:"48 9112 7563", dt:"29/07/2026 13:00", status:"CONFIRMADA"},
  {name:"Sândalla Riclésia Valentim", phone:"48 99645 9142", dt:"29/07/2026 11:45", status:"AGENDADA"},
  {name:"Andréa Schaly", phone:"48 99602 0579", dt:"29/07/2026 11:00", status:"AGENDADA"},
  {name:"Carolina Heinz do Espírito Santo", phone:"48 99822 8741", dt:"29/07/2026 09:45", status:"AGENDADA"},
  {name:"Cleusa Antunes Kelin", phone:"48 99145 9100", dt:"28/07/2026 16:00", status:"CONFIRMADA"},
  {name:"Marijane De Souza Vieira Da Silva", phone:"48 98494 1284", dt:"28/07/2026 13:00", status:"CONFIRMADA"},
  {name:"Cíntia Moscon Ferreira", phone:"48 99649 5655", dt:"28/07/2026 11:00", status:"CONFIRMADA"},
  {name:"Ricardo Carvalho Torres", phone:"48 98808 8780", dt:"28/07/2026 09:00", status:"CONFIRMADA"},
  {name:"Angela de Souza", phone:"48 98857 9011", dt:"22/07/2026 10:30", status:"EM ATRASO", pastFlag:true},
  {name:"Janaina", phone:"48 9658 0380", dt:"10/04/2026 11:30", status:"AGENDADA", pastFlag:true},
  {name:"DIEGO ANDREI AGUIAR", phone:"(48) 98829-4496", dt:"13/03/2026 10:00", status:"EM ATENDIMENTO", pastFlag:true}
];

async function main() {
  const startIdx = process.argv[2] ? parseInt(process.argv[2], 10) - 1 : 0;
  const count = process.argv[3] ? parseInt(process.argv[3], 10) : records.length;
  const batch = records.slice(startIdx, startIdx + count);

  const conn = await mysql.createConnection({ host: '127.0.0.1', user: 'crm', password: 'crmdev123', database: 'vivera_crm' });

  const [patRows] = await conn.query('SELECT id, name, phone FROM patients');
  const phoneMap = new Map();
  for (const p of patRows) {
    const np = normalizePhoneBR(p.phone);
    if (np && !phoneMap.has(np)) phoneMap.set(np, p.id);
  }

  let createdEvents = 0, newPatients = 0, linkedExisting = 0, skippedDup = 0;
  const results = [];

  for (const r of batch) {
    const np = normalizePhoneBR(r.phone);
    let patientId, isNew = false;

    if (np && phoneMap.has(np)) {
      patientId = phoneMap.get(np);
      linkedExisting++;
    } else {
      const e164 = toE164(r.phone);
      const [ins] = await conn.query('INSERT INTO patients (name, phone) VALUES (?, ?)', [r.name, e164]);
      patientId = ins.insertId;
      if (np) phoneMap.set(np, patientId);
      newPatients++;
      isNew = true;
    }

    const startAt = parseDateTime(r.dt);
    const endAt = addHour(startAt);

    const [dupRows] = await conn.query(
      'SELECT id FROM calendar_events WHERE dentist_user_id=? AND start_at=?',
      [DENTIST_USER_ID, startAt]
    );
    if (dupRows.length) {
      skippedDup++;
      results.push(`DUP-SKIP | ${r.name} | ${r.dt} | ja existe evento id=${dupRows[0].id}`);
      continue;
    }

    const [dealRows] = await conn.query('SELECT id FROM deals WHERE patient_id=? ORDER BY id DESC LIMIT 1', [patientId]);
    const dealId = dealRows.length ? dealRows[0].id : null;

    const titlePrefix = r.pastFlag ? '[REGISTRO ANTIGO/ATRASADO] ' : '';
    const title = `${titlePrefix}Avaliação - ${r.name}`;
    const description = `Importado da planilha de agendamentos (sistema clínico da avaliadora Jéssica). Status original na planilha: ${r.status}. Telefone: ${r.phone}. Paciente ${isNew ? 'CADASTRADO AGORA (novo)' : 'ja existente'} (patient_id=${patientId}).${r.pastFlag ? ' ATENCAO: data anterior a hoje (28/07/2026) - registro pendente/atrasado no sistema de origem.' : ''}`;

    const [ins2] = await conn.query(
      'INSERT INTO calendar_events (deal_id, dentist_user_id, title, description, start_at, end_at, status, created_by_user_id) VALUES (?,?,?,?,?,?,?,?)',
      [dealId, DENTIST_USER_ID, title, description, startAt, endAt, 'confirmed', CREATED_BY_USER_ID]
    );
    createdEvents++;
    results.push(`OK | id=${ins2.insertId} | ${r.name} | ${r.dt} | patient_id=${patientId} ${isNew ? '(novo)' : '(existente)'} | deal_id=${dealId}`);
  }

  console.log('--- RESULTADOS ---');
  console.log(results.join('\n'));
  console.log('--- RESUMO DO LOTE ---');
  console.log(JSON.stringify({ processed: batch.length, createdEvents, newPatients, linkedExisting, skippedDup }, null, 2));

  await conn.end();
}

main().catch(e => { console.error('ERRO:', e); process.exit(1); });
