const pool = require('../db');
(async () => {
  const leads = [
    {name:'Rodrigo De Lima Rodrigues', phone:'5548999283916', origem:'Meta Ads', campanha:'PAT | [HOF][EXOJET][ENGJAMENTO][02/06/26]', conjunto:'[WHATSAPP][FLORIANOPOLIS E SAO JOSE][PUBLICO FRIO][MULHERES 30-60][IG]', criativo:'01 [VD] - SOLUCAO PELE FLACIDA', obs:'Agda - com resposta sem cadastro'},
    {name:'Maurilia Dias', phone:'5548984267598', origem:'Meta Ads', campanha:'PAT | [HOF][DORES][ENGAJAMENTO][23/06/26]', conjunto:'[DORES][WHATSAPP][FLORIANOPOLIS E SAO JOSE][PUBLICO FRIO][MULHERES 30-60][IG]', criativo:'04 [VD] - SUMIR COM PAPADA SEM PRECISAR DE LIPO', obs:'Agda'},
    {name:'energy flex', phone:'5548996959490', origem:'Meta Ads', campanha:'PAT | [HOF][DORES][ENGAJAMENTO][08/06/26]', conjunto:'[ABERTO][FIOS APTOS|FULL FACE|EVOLUTION][WHATSAPP][FLORIANOPOLIS E SAO JOSE][PUBLICO FRIO][MULHERES 30-60][IG]', criativo:'01 [VD] - PREENCHENDO BIGODE CHINES', obs:'Agda'},
    {name:'Lead 2526', phone:'5545999052526', origem:'Meta Ads', campanha:'[VIVERA] [HOF] - MENSAGENS - ENVOLVIMENTO', conjunto:'[Q-ENV60D + VV 90D] [FLORIPA E SJ + PEDRA BRANCA] [FIOS APTOS] [30 A 60 A]', criativo:'aptos 2 - existe tratamento pra flacidez que nao seja cirurgia', obs:'AGDA'},
    {name:'Lead 1975', phone:'5548991241975', origem:'Meta Ads', campanha:'PAT | [HOF][EXOJET][ENGAJAMENTO][15/06/26]', conjunto:'[EXOJET][WHATSAPP][FLORIANOPOLIS E SAO JOSE][PUBLICO FRIO][MULHERES 30-60][IG]', criativo:'04 [VD] - SOLUCAO PRA PELE FLACIDA', obs:'Agda com resposta sem cadastro'},
    {name:'Daisy Ramos', phone:'5548984434690', origem:'Meta Ads', campanha:'PAT | [HOF][EXOJET][ENGJAMENTO][02/06/26]', conjunto:'[WHATSAPP][FLORIANOPOLIS E SAO JOSE][PUBLICO FRIO][MULHERES 30-60][IG]', criativo:'04 [VD] - MEDO DO TRATAMENTO', obs:'AGDA'}
  ];
  const [[pl]] = await pool.query("SELECT id FROM pipelines WHERE slug = 'inbound'");
  const [[st]] = await pool.query('SELECT id FROM stages WHERE pipeline_id = ? ORDER BY sort LIMIT 1', [pl.id]);
  const created = [];
  for (const l of leads) {
    const [pRes] = await pool.query('INSERT INTO patients (name, phone) VALUES (?, ?)', [l.name, '+' + l.phone]);
    const patientId = pRes.insertId;
    const [dRes] = await pool.query(
      `INSERT INTO deals (patient_id, pipeline_id, stage_id, title, origem, campanha, conjunto, criativo, plataforma, stage_entered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Meta Ads', NOW())`,
      [patientId, pl.id, st.id, l.name, l.origem, l.campanha, l.conjunto, l.criativo]);
    const dealId = dRes.insertId;
    await pool.query('INSERT INTO activities (deal_id, patient_id, type, content) VALUES (?, ?, "note", ?)',
      [dealId, patientId, 'Importado da planilha Ana_lise.xlsx (linha amarela). Observacao original: ' + l.obs]);
    created.push({patientId, dealId, name: l.name, phone: l.phone});
  }
  console.log(JSON.stringify(created, null, 2));
  console.log('INSERT_OK count=' + created.length);
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
