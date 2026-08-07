'use strict';

/**
 * Rotas novas para a interface visual basica do CRM (lista + detalhe).
 * Isoladas neste arquivo pra nao mexer demais no server.js existente.
 * Reutiliza o mesmo pool de conexao e o mesmo middleware de autenticacao (auth)
 * ja definidos em server.js.
 */
const metaAdsService = require('./metaAdsService');
const googleAdsCacheReader = require('./googleAdsCacheReader');
const bcrypt = require('bcryptjs');
const JESSICA_USER_ID = 6; // Dra. Jessica - avaliadora padrao fixa (regra 2026-07-23)

module.exports = function registerCrmUiRoutes(app, pool, auth) {
  function requireAdmin(req, res, next) {
    return next() // TEMP-REVERT-2026-07-28: restricao SDR desativada, liberado geral
    next()
  }

  // Pipelines + etapas (pra popular os selects de "etapa" na tela de detalhe)
  app.get('/api/crm/ui/pipelines', auth, async (req, res) => {
    try {
      const [pipelines] = await pool.query(
        'SELECT id, slug, name FROM pipelines WHERE active = 1 ORDER BY sort, name'
      );
      const [stages] = await pool.query(
        'SELECT id, pipeline_id, skey, label, sort FROM stages WHERE active = 1 ORDER BY pipeline_id, sort'
      );
      res.json({ success: true, pipelines, stages });
    } catch (e) {
      console.error('ui/pipelines error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  // Lista unificada de deals + dados do paciente, com busca e paginacao
  app.get('/api/crm/ui/deal-owners', auth, async (req, res) => {
    try {
      if (req.user.role === 'sdr') {
        return res.json({ success: true, owners: [req.user.name] });
      }
      const [rows] = await pool.query(`SELECT DISTINCT owner_name FROM deals WHERE owner_name IS NOT NULL AND owner_name <> '' ORDER BY owner_name`);
      res.json({ success: true, owners: rows.map(function(r){ return r.owner_name; }) });
    } catch (e) {
      console.error('ui/deal-owners error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  app.get('/api/crm/ui/deal-origins', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT DISTINCT origem FROM deals WHERE origem IS NOT NULL AND origem <> '' ORDER BY origem`);
    res.json({ success: true, origins: rows.map(function(r){ return r.origem; }) });
  } catch (e) {
    console.error('ui/deal-origins error', e);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

app.get('/api/crm/ui/deal-situacoes', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT DISTINCT tags FROM deals WHERE tags LIKE '%situacao:%'`);
    const set = new Set();
    rows.forEach(function(r){
      var m = String(r.tags || '').match(/situacao:([a-zA-Z0-9_]+)/);
      if (m) set.add(m[1]);
    });
    res.json({ success: true, situacoes: Array.from(set).sort() });
  } catch (e) {
    console.error('ui/deal-situacoes error', e);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

app.get('/api/crm/ui/deals', auth, async (req, res) => {
    try {
      const search = (req.query.search || '').toString().trim();
      const status = (req.query.status || '').toString().trim();
      let page = parseInt(req.query.page, 10) || 1;
      let pageSize = parseInt(req.query.pageSize, 10) || 50;
      if (page < 1) page = 1;
      if (pageSize < 1) pageSize = 50;
      if (pageSize > 200) pageSize = 200;
      const offset = (page - 1) * pageSize;

      const where = [];
      const params = [];
      if (search) {
        where.push('(p.name LIKE ? OR p.phone LIKE ? OR p.email LIKE ? OR d.title LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }
      if (status && ['open', 'won', 'lost'].includes(status)) {
        where.push('d.status = ?');
        params.push(status);
      }
      if (req.query.activityType) {
        where.push('EXISTS (SELECT 1 FROM activities act WHERE act.deal_id = d.id AND act.type = ?)');
        params.push(req.query.activityType);
      }
      if (req.query.pipeline) {
      where.push('d.pipeline_id = (SELECT id FROM pipelines WHERE slug = ?)');
      params.push(req.query.pipeline);
    }
    var ownerFilter = (req.query.owner || '').toString().trim();
    if (req.user.role === 'sdr') {
      where.push('d.owner_name = ?');
      params.push(req.user.name);
    } else if (ownerFilter) {
      where.push('d.owner_name = ?');
      params.push(ownerFilter);
    }
    if (req.query.origem) {
    where.push('d.origem = ?');
    params.push(req.query.origem);
  }
    if (req.query.situacao) {
      where.push('d.tags LIKE ?');
      params.push('%situacao:' + req.query.situacao + '%');
    }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

      const [countRows] = await pool.query(
        `SELECT COUNT(*) AS total FROM deals d JOIN patients p ON p.id = d.patient_id ${whereSql}`,
        params
      );
      const total = countRows[0] ? countRows[0].total : 0;

      const [rows] = await pool.query(
        `SELECT d.id, d.title, d.value, d.status, d.origem, d.procedure_name AS procedimento,
                d.add_date, d.won_date, d.lost_date,
                d.stage_id, d.pipeline_id, d.owner_name, pl.slug AS pipeline_slug, s.label AS stage_label, pl.name AS pipeline_name,
                p.id AS patient_id, p.name AS patient_name, p.phone AS patient_phone, p.email AS patient_email
         FROM deals d
         JOIN patients p ON p.id = d.patient_id
         JOIN stages s ON s.id = d.stage_id
         JOIN pipelines pl ON pl.id = d.pipeline_id
         ${whereSql}
         ORDER BY d.add_date DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );

      let patientsOnly = [];
      if (search) {
        const [pRows] = await pool.query(
          `SELECT p.id, p.name, p.phone, p.email FROM patients p
           WHERE (p.name LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)
           AND NOT EXISTS (SELECT 1 FROM deals d2 WHERE d2.patient_id = p.id)
           ORDER BY p.created_at DESC LIMIT 20`,
          [`%${search}%`, `%${search}%`, `%${search}%`]
        );
        patientsOnly = pRows;
      }
      res.json({ success: true, total, page, pageSize, deals: rows, patientsOnly });
    } catch (e) {
      console.error('ui/deals error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  // Atualizacao basica de paciente (nome / telefone / email)
  app.patch('/api/crm/ui/patients/:id', auth, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { name, phone, email } = req.body || {};
      const fields = [];
      const params = [];
      if (name !== undefined) {
        const v = String(name).trim();
        if (!v) return res.status(400).json({ success: false, error: 'Nome nao pode ficar vazio' });
        fields.push('name = ?');
        params.push(v);
      }
      if (phone !== undefined) {
        fields.push('phone = ?');
        params.push(phone ? String(phone).trim() : null);
      }
      if (email !== undefined) {
        fields.push('email = ?');
        params.push(email ? String(email).trim() : null);
      }
      if (!fields.length) return res.status(400).json({ success: false, error: 'Nada para atualizar' });
      params.push(id);
      await pool.query(`UPDATE patients SET ${fields.join(', ')} WHERE id = ?`, params);
      const [[patient]] = await pool.query(
        'SELECT id, name, phone, email FROM patients WHERE id = ?',
        [id]
      );
      if (!patient) return res.status(404).json({ success: false, error: 'Paciente nao encontrado' });
      res.json({ success: true, patient });
    } catch (e) {
      console.error('ui/patients patch error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  // Motivos de perda + etiquetas (importados do Pipedrive)
  app.get('/api/crm/ui/meta', auth, async (req, res) => {
    try {
      const [lossReasons] = await pool.query('SELECT id, label FROM loss_reasons WHERE active = 1 ORDER BY sort, label');
      const [labels] = await pool.query('SELECT id, name, color FROM labels WHERE active = 1 ORDER BY name');
      const [origens] = await pool.query('SELECT id, label FROM origem_options WHERE active = 1 ORDER BY sort, label');
      const [campanhas] = await pool.query('SELECT id, label FROM campaign_options WHERE active = 1 ORDER BY sort, label');
      res.json({ success: true, lossReasons, labels, origens, campanhas });
    } catch (e) {
      console.error('ui/meta error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  app.post('/api/crm/ui/campaign-options', auth, async (req, res) => {
    try {
      const label = String((req.body && req.body.label) || '').trim();
      if (!label) return res.status(400).json({ success: false, error: 'Nome da campanha obrigatorio' });
      const [existing] = await pool.query('SELECT id, label FROM campaign_options WHERE LOWER(label) = LOWER(?)', [label]);
      if (existing[0]) {
        if (!existing[0].active) await pool.query('UPDATE campaign_options SET active = 1 WHERE id = ?', [existing[0].id]);
        return res.json({ success: true, campaign: existing[0] });
      }
      const [result] = await pool.query('INSERT INTO campaign_options (label) VALUES (?)', [label]);
      res.json({ success: true, campaign: { id: result.insertId, label } });
    } catch (e) {
      console.error('campaign-options create error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  function normalizePhoneBR(raw) {
    if (!raw) return null;
    let d = String(raw).replace(/[^0-9]/g, '');
    if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2);
    if (d.length < 10) return null;
    const ddd = d.slice(0, 2);
    const suffix8 = d.slice(-8);
    return ddd + suffix8;
  }

  // ===== Buscar Paciente (dedupe por telefone) =====
  function normName(s) {
    return (s || '').toString().normalize('NFD').replace(new RegExp('[\u0300-\u036f]', 'g'), '').toLowerCase().trim();
  }

  app.get('/api/crm/ui/deals/:id/patient-matches', auth, async (req, res) => {
    try {
      const dealId = req.params.id;
      const [[deal]] = await pool.query('SELECT id, patient_id, pipeline_id, stage_id FROM deals WHERE id = ?', [dealId]);
      if (!deal) return res.status(404).json({ success: false, error: 'Negocio nao encontrado' });
      const [[patient]] = await pool.query('SELECT id, name, phone FROM patients WHERE id = ?', [deal.patient_id]);
      if (!patient) return res.status(404).json({ success: false, error: 'Paciente do negocio nao encontrado' });

      const [[recPipeline]] = await pool.query("SELECT id FROM pipelines WHERE slug = 'recepcao' LIMIT 1");
      let recepcaoEntryStageId = null;
      if (recPipeline) {
        const [[recStage]] = await pool.query('SELECT id FROM stages WHERE pipeline_id = ? ORDER BY sort LIMIT 1', [recPipeline.id]);
        if (recStage) recepcaoEntryStageId = recStage.id;
      }

      const npCurrent = normalizePhoneBR(patient.phone);
      if (!npCurrent) {
        return res.json({
          success: true,
          currentPatient: { id: patient.id, name: patient.name, phone: patient.phone },
          matches: [],
          phoneAvailable: false,
          recepcaoEntryStageId
        });
      }

      const [candidates] = await pool.query('SELECT id, name, phone FROM patients WHERE id != ? AND phone IS NOT NULL AND phone <> ?', [patient.id, '']);
      const currentNameNorm = normName(patient.name);
      const matchedPatients = candidates.filter(c => normalizePhoneBR(c.phone) === npCurrent);

      const results = [];
      for (const m of matchedPatients) {
        const [mDeals] = await pool.query(
          `SELECT d.id, d.title, d.status, d.pipeline_id, d.stage_id, pl.name AS pipeline_name, s.label AS stage_label,
                  d.add_date, d.won_date, d.lost_date, d.stage_entered_at
           FROM deals d
           LEFT JOIN pipelines pl ON pl.id = d.pipeline_id
           LEFT JOIN stages s ON s.id = d.stage_id
           WHERE d.patient_id = ?
           ORDER BY d.add_date DESC`, [m.id]);
        const isRealPatient = mDeals.some(d => d.status === 'won');
        let lastInteraction = null;
        mDeals.forEach(d => {
          ['stage_entered_at', 'won_date', 'lost_date', 'add_date'].forEach(f => {
            if (d[f] && (!lastInteraction || new Date(d[f]) > new Date(lastInteraction))) lastInteraction = d[f];
          });
        });
        results.push({
          patientId: m.id,
          name: m.name,
          phone: m.phone,
          nameSimilar: !!currentNameNorm && normName(m.name) === currentNameNorm,
          isRealPatient,
          lastInteraction,
          deals: mDeals.map(d => ({ id: d.id, title: d.title, status: d.status, pipelineId: d.pipeline_id, pipelineName: d.pipeline_name, stageLabel: d.stage_label }))
        });
      }

      results.sort((a, b) => (b.isRealPatient - a.isRealPatient) || (new Date(b.lastInteraction || 0) - new Date(a.lastInteraction || 0)));

      res.json({
        success: true,
        currentPatient: { id: patient.id, name: patient.name, phone: patient.phone },
        matches: results,
        phoneAvailable: true,
        recepcaoEntryStageId
      });
    } catch (e) {
      console.error('patient-matches error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });


  app.get('/api/crm/ui/stalled-conversations', auth, async (req, res) => {
    try {
      const days = parseInt(req.query.days || process.env.CRM_STALLED_THRESHOLD_DAYS || '7')
    const hours = days * 24
      const [openDeals] = await pool.query(
        `SELECT d.id AS deal_id, d.title, d.value, d.origem, d.add_date, d.owner_name, d.stage_id, s.label AS stage_label,
         (SELECT MAX(sh.changed_at) FROM stage_history sh WHERE sh.deal_id = d.id AND sh.to_stage_id = d.stage_id) AS stage_entered_at,
         p.name AS patient_name, p.phone AS patient_phone
         FROM deals d JOIN patients p ON p.id = d.patient_id
         LEFT JOIN stages s ON s.id = d.stage_id
         WHERE d.status = 'open' AND p.phone IS NOT NULL`
      )
      if (!openDeals.length) return res.json({ success: true, threshold: { days, hours }, count: 0, deals: [] })
      const [events] = await pool.query(
        `SELECT phone, MAX(received_at) AS last_event FROM tintim_webhook_log WHERE phone IS NOT NULL AND phone <> '' GROUP BY phone`
      )
      const lastByPhone = {}
      events.forEach(function(e) {
        const np = normalizePhoneBR(e.phone)
        if (np) lastByPhone[np] = e.last_event
      })
      const now = Date.now()
      const rows = []
      openDeals.forEach(function(d) {
        const np = normalizePhoneBR(d.patient_phone)
        const lastEvent = (np && lastByPhone[np]) ? lastByPhone[np] : d.add_date
        if (!lastEvent) return
        const hoursSince = Math.round((now - new Date(lastEvent).getTime()) / 3600000)
        if (hoursSince >= hours) {
          rows.push({
            deal_id: d.deal_id,
            title: d.title,
            value: d.value,
            origem: d.origem,
            patient_name: d.patient_name,
            patient_phone: d.patient_phone,
        owner_name: d.owner_name || null,
        stage_label: d.stage_label || null,
        days_in_stage: d.stage_entered_at ? Math.floor((now - new Date(d.stage_entered_at).getTime()) / 86400000) : (d.add_date ? Math.floor((now - new Date(d.add_date).getTime()) / 86400000) : null),
            status_name: null,
            lead_updated_at: lastEvent,
            hours_since_last_msg: hoursSince
          })
        }
      })
      rows.sort(function(a, b) { return new Date(a.lead_updated_at) - new Date(b.lead_updated_at) })
      res.json({ success: true, threshold: { days, hours }, count: rows.length, deals: rows })
    } catch (e) {
      console.error('stalled-conversations error', e)
      res.status(500).json({ success: false, error: 'Erro interno' })
    }
  })

  app.get('/api/crm/ui/stalled-conversations/dashboard', auth, async (req, res) => {
    try {
      const [openDeals] = await pool.query(
        `SELECT d.id AS deal_id, d.add_date, p.phone AS patient_phone
         FROM deals d JOIN patients p ON p.id = d.patient_id
         WHERE d.status = 'open' AND p.phone IS NOT NULL`
      )
      const [events] = await pool.query(
        `SELECT phone, MAX(received_at) AS last_event FROM tintim_webhook_log WHERE phone IS NOT NULL AND phone <> '' GROUP BY phone`
      )
      const lastByPhone = {}
      events.forEach(function(e) {
        const np = normalizePhoneBR(e.phone)
        if (np) lastByPhone[np] = e.last_event
      })
      const now = Date.now()
      let noInteraction4d = 0
      const histogram = {}
      for (let i = 1; i <= 90; i++) histogram[i] = 0
      openDeals.forEach(function(d) {
        const np = normalizePhoneBR(d.patient_phone)
        const lastEvent = (np && lastByPhone[np]) ? lastByPhone[np] : d.add_date
        if (!lastEvent) return
        const days = Math.floor((now - new Date(lastEvent).getTime()) / 86400000)
        if (days > 4) noInteraction4d++
        if (days >= 1 && days <= 90) histogram[days]++
      })
      const histogramArr = []
      for (let i = 1; i <= 90; i++) histogramArr.push({ days: i, count: histogram[i] })
      res.json({ success: true, openTotal: openDeals.length, noInteraction4d, histogram: histogramArr })
    } catch (e) {
      console.error('stalled-dashboard error', e)
      res.status(500).json({ success: false, error: 'Erro interno' })
    }
  });


  app.get('/api/crm/ui/tintim-pending', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.phone, t.deal_id, t.received_at, t.raw_payload, d.title AS deal_title
       FROM tintim_webhook_log t
       INNER JOIN (SELECT phone, MAX(id) AS max_id FROM tintim_webhook_log WHERE event_type = 'message.create' AND phone IS NOT NULL AND phone <> '' GROUP BY phone) latest
         ON latest.phone = t.phone AND latest.max_id = t.id
       LEFT JOIN deals d ON d.id = t.deal_id`
    )
    const items = []
    for (const r of rows) {
      let payload
      try { payload = (typeof r.raw_payload === 'string') ? JSON.parse(r.raw_payload) : (r.raw_payload || {}) } catch (e) { continue }
      const lead = payload.lead || {}
      if (lead.first_response_status !== 'awaiting') continue
      items.push({ phone: r.phone, name: lead.name || null, message: payload.message || null, received_at: r.received_at, deal_id: r.deal_id || null, deal_title: r.deal_title || null })
    }
    items.sort(function (a, b) { return new Date(a.received_at) - new Date(b.received_at) })
    res.json({ success: true, count: items.length, items: items })
  } catch (e) {
    console.error('tintim-pending error', e)
    res.status(500).json({ success: false, error: 'Erro interno' })
  }
});

app.get('/api/crm/ui/agenda', auth, async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId) : null
      const from = req.query.from || null
      const to = req.query.to || null
      const includeDone = req.query.includeDone === 'true'
      const where = []
      const params = []
      if (!includeDone) where.push('a.done = 0')
      where.push('a.due_at IS NOT NULL')
      if (userId) { where.push('a.user_id = ?'); params.push(userId) }
      if (from) { where.push('a.due_at >= ?'); params.push(from) }
      if (to) { where.push('a.due_at <= ?'); params.push(to) }
      const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
      const [rows] = await pool.query(
        `SELECT a.id, a.deal_id, a.patient_id, a.user_id, a.type, a.content, a.subject, a.due_at,
                a.duration, a.done, a.done_at, a.created_at,
                d.title AS deal_title, p.name AS patient_name, p.phone AS patient_phone,
                u.name AS user_name, d.owner_name AS deal_owner_name
         FROM activities a
         LEFT JOIN deals d ON d.id = a.deal_id
         LEFT JOIN patients p ON p.id = a.patient_id
         LEFT JOIN users u ON u.id = a.user_id
         ${whereSql}
         ORDER BY a.due_at ASC`,
        params
      )
      res.json({ success: true, count: rows.length, activities: rows })
    } catch (e) {
      console.error('agenda list error', e)
      res.status(500).json({ success: false, error: 'Erro interno' })
    }
  });

  app.get('/api/crm/ui/dashboard/executive', auth, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const to = req.query.to || new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
    const { fromDt, toDt } = brRangeToUtc(from, to)
    const [[leadsRow]] = await pool.query('SELECT COUNT(*) AS c FROM deals WHERE pipeline_id = 1 AND add_date BETWEEN ? AND ? AND (campanha IS NULL OR LOWER(TRIM(campanha)) <> "ja e paciente") AND count_as_lead_entry = 1', [fromDt, toDt]);
    const [[qualRow]] = await pool.query('SELECT COUNT(*) AS c FROM deals d JOIN stages s ON s.id = d.stage_id WHERE d.pipeline_id = 1 AND s.sort >= 9 AND d.add_date BETWEEN ? AND ? AND (d.campanha IS NULL OR LOWER(TRIM(d.campanha)) <> "ja e paciente") AND d.count_as_lead_entry = 1', [fromDt, toDt]);
    const [[vendasRow]] = await pool.query('SELECT COUNT(*) AS c, COALESCE(SUM(value),0) AS receita FROM deals WHERE status = "won" AND won_date BETWEEN ? AND ? AND (tags IS NULL OR tags NOT LIKE "%teste_allowlist%") AND NOT EXISTS (SELECT 1 FROM patient_labels pl JOIN labels l ON l.id = pl.label_id WHERE pl.patient_id = deals.patient_id AND l.name = "Vendedor")', [fromDt, toDt]);
    const [[orcRow]] = await pool.query('SELECT COUNT(*) AS c, COALESCE(SUM(amount),0) AS total FROM activities WHERE type = "Orcamento Gerado" AND created_at BETWEEN ? AND ?', [fromDt, toDt]);
    const [[agendRow]] = await pool.query('SELECT COUNT(*) AS c FROM activities WHERE type = "Agendou" AND created_at BETWEEN ? AND ?', [fromDt, toDt]);
    const [[compRow]] = await pool.query('SELECT COUNT(*) AS c FROM activities WHERE type = "Compareceu" AND created_at BETWEEN ? AND ?', [fromDt, toDt]);
    const [[faltRow]] = await pool.query('SELECT COUNT(*) AS c FROM activities WHERE type = "Faltou" AND created_at BETWEEN ? AND ?', [fromDt, toDt]);
    const [dailyLeads] = await pool.query('SELECT DATE(add_date) AS dia, COUNT(*) AS c FROM deals WHERE pipeline_id = 1 AND add_date BETWEEN ? AND ? AND (campanha IS NULL OR LOWER(TRIM(campanha)) <> "ja e paciente") AND count_as_lead_entry = 1 GROUP BY DATE(add_date) ORDER BY dia', [fromDt, toDt]);
    const [dailyQual] = await pool.query('SELECT DATE(d.add_date) AS dia, COUNT(*) AS c FROM deals d JOIN stages s ON s.id = d.stage_id WHERE d.pipeline_id = 1 AND s.sort >= 9 AND d.add_date BETWEEN ? AND ? AND (d.campanha IS NULL OR LOWER(TRIM(d.campanha)) <> "ja e paciente") AND d.count_as_lead_entry = 1 GROUP BY DATE(d.add_date) ORDER BY dia', [fromDt, toDt]);
    const leads = leadsRow.c;
    const qualificados = qualRow.c;
    const vendas = vendasRow.c;
    const receita = Number(vendasRow.receita);
    const agendadas = agendRow.c;
    const comparecidas = compRow.c;
    const faltaram = faltRow.c;
    const orcamento = Number(orcRow.total);
    const [[dupRow]] = await pool.query('SELECT COUNT(*) AS c FROM deals WHERE duplicate_alert = 1 AND add_date BETWEEN ? AND ? AND count_as_lead_entry = 1', [fromDt, toDt]);
    const duplicados = Number(dupRow.c);
    const [[tRow]] = await pool.query(
      'SELECT COUNT(*) AS n, ' +
      'AVG(TIMESTAMPDIFF(HOUR, d.add_date, x.comp_at))/24 AS avgLeadComp, ' +
      'AVG(TIMESTAMPDIFF(HOUR, x.comp_at, d.won_date))/24 AS avgCompCompra, ' +
      'AVG(TIMESTAMPDIFF(HOUR, d.add_date, d.won_date))/24 AS avgLeadCompra ' +
      'FROM deals d JOIN (SELECT deal_id, MIN(created_at) AS comp_at FROM activities WHERE type = "Compareceu" GROUP BY deal_id) x ON x.deal_id = d.id ' +
      'WHERE d.status = "won" AND x.comp_at >= d.add_date AND d.won_date >= x.comp_at AND d.won_date BETWEEN ? AND ?',
      [fromDt, toDt]
    );
    const tempoCohortN = Number(tRow.n);
    const tempoLeadComparecimento = { dias: tRow.n > 0 ? Number(tRow.avgLeadComp) : null, n: tempoCohortN };
    const tempoComparecimentoCompra = { dias: tRow.n > 0 ? Number(tRow.avgCompCompra) : null, n: tempoCohortN };
    const tempoLeadCompra = { dias: tRow.n > 0 ? Number(tRow.avgLeadCompra) : null, n: tempoCohortN };
    res.json({
      success: true, from, to,
      leads, qualificados, vendas, receita, orcamento, duplicados,
      taxaQualif: leads ? (qualificados / leads * 100) : 0,
      ticketMedio: vendas ? (receita / vendas) : 0,
      agendadas, comparecidas, faltaram,
      faltaramPct: agendadas ? (faltaram / agendadas * 100) : 0,
      dailyLeads, dailyQual, tempoLeadComparecimento, tempoLeadCompra, tempoComparecimentoCompra, tempoCohortN
    });
  } catch (e) {
    console.error('dashboard executive error', e);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

app.post('/api/crm/ui/loss-reasons', auth, async (req, res) => {
  try {
    const label = String((req.body && req.body.label) || '').trim();
    if (!label) return res.status(400).json({ success: false, error: 'Nome do motivo obrigatorio' });
    const [existing] = await pool.query('SELECT id, label, active FROM loss_reasons WHERE LOWER(label) = LOWER(?)', [label]);
    if (existing[0]) {
      if (!existing[0].active) await pool.query('UPDATE loss_reasons SET active = 1 WHERE id = ?', [existing[0].id]);
      return res.json({ success: true, lossReason: { id: existing[0].id, label: existing[0].label } });
    }
    const [[maxSort]] = await pool.query('SELECT COALESCE(MAX(sort), -1) AS m FROM loss_reasons');
    const nextSort = Number(maxSort.m) + 1;
    const [result] = await pool.query('INSERT INTO loss_reasons (label, sort, active) VALUES (?, ?, 1)', [label, nextSort]);
    res.json({ success: true, lossReason: { id: result.insertId, label } });
  } catch (e) {
    console.error('loss-reasons create error', e);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

app.get('/api/crm/ui/dashboard/executive/drilldown', auth, requireAdmin, async (req, res) => {
  try {
    const indicador = req.query.indicador
    const fromDt = req.query.from
    const toDt = req.query.to
    if (!indicador || !fromDt || !toDt) return res.status(400).json({ success: false, error: 'indicador, from, to sao obrigatorios' })
    const FUNNEL_SORT = { 'Entrada': 1, 'Contato realizado': 2, 'Qualificado': 3, 'Agendado': 4, 'Compareceu': 5, 'Negociação': 6 }
    let rows = []
    if (indicador === 'Ganho') {
      ;[rows] = await pool.query(
        "SELECT d.id AS dealId, COALESCE(p.name, d.title) AS title, d.value AS value, d.won_date AS date FROM deals d LEFT JOIN patients p ON p.id = d.patient_id WHERE d.pipeline_id = 1 AND d.status = 'won' AND d.add_date BETWEEN ? AND ? ORDER BY d.won_date DESC",
        [fromDt, toDt])
    } else if (indicador === 'Perdido') {
      ;[rows] = await pool.query(
        "SELECT d.id AS dealId, COALESCE(p.name, d.title) AS title, d.value AS value, d.add_date AS date FROM deals d LEFT JOIN patients p ON p.id = d.patient_id WHERE d.pipeline_id = 1 AND d.status = 'lost' AND d.add_date BETWEEN ? AND ? ORDER BY d.add_date DESC",
        [fromDt, toDt])
    } else if (FUNNEL_SORT[indicador]) {
      const targetSort = FUNNEL_SORT[indicador]
      const bucketSortCol = function(col) {
        return 'CASE ' + col + ' ' +
          'WHEN 1 THEN 1 WHEN 2 THEN 1 ' +
          'WHEN 3 THEN 2 WHEN 4 THEN 2 WHEN 5 THEN 2 WHEN 6 THEN 2 WHEN 7 THEN 2 WHEN 8 THEN 2 ' +
          'WHEN 9 THEN 3 WHEN 11 THEN 3 ' +
          'WHEN 10 THEN 4 WHEN 12 THEN 4 ' +
          'WHEN 13 THEN 5 ' +
          'WHEN 14 THEN 6 WHEN 15 THEN 6 ' +
          'ELSE NULL END'
      }
      const [maxReachedRows] = await pool.query(
        'SELECT deal_id, MAX(bsort) AS reached_sort FROM (' +
          'SELECT d.id AS deal_id, ' + bucketSortCol('d.stage_id') + ' AS bsort ' +
          'FROM deals d WHERE d.pipeline_id = 1 AND d.add_date BETWEEN ? AND ? AND (d.campanha IS NULL OR LOWER(TRIM(d.campanha)) <> "ja e paciente") ' +
          'UNION ALL ' +
          'SELECT sh.deal_id, ' + bucketSortCol('sh.to_stage_id') + ' AS bsort ' +
          'FROM stage_history sh JOIN deals d2 ON d2.id = sh.deal_id ' +
          'WHERE d2.pipeline_id = 1 AND d2.add_date BETWEEN ? AND ? AND (d2.campanha IS NULL OR LOWER(TRIM(d2.campanha)) <> "ja e paciente")' +
        ') u GROUP BY deal_id',
        [fromDt, toDt, fromDt, toDt])
      const dealIds = maxReachedRows.filter(function(r){ return r.reached_sort != null && r.reached_sort >= targetSort }).map(function(r){ return r.deal_id })
      if (dealIds.length) {
        ;[rows] = await pool.query(
          'SELECT d.id AS dealId, COALESCE(p.name, d.title) AS title, d.value AS value, d.add_date AS date FROM deals d LEFT JOIN patients p ON p.id = d.patient_id WHERE d.id IN (?) ORDER BY d.add_date DESC',
          [dealIds])
      }
    } else {
      return res.json({ success: true, indicador, rows: [], noDrilldown: true })
    }
    res.json({ success: true, indicador, rows })
  } catch (e) {
    console.error('executive drilldown error', e)
    res.status(500).json({ success: false, error: 'Erro interno' })
  }
})


app.get('/api/crm/ui/dashboard/executive/vendas-drilldown', auth, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const to = req.query.to || new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
    const { fromDt, toDt } = brRangeToUtc(from, to);
    const fonteExpr = 'COALESCE(NULLIF(CASE WHEN d.origem IN ("Instagram Org\u00e2nico","Organico","Org\u00e2nico") OR (d.origem = "Instagram" AND COALESCE(d.tintim_source_raw,"") NOT IN ("Meta Ads","Google Ads") AND COALESCE(d.plataforma,"") NOT IN ("Meta Ads","Meta") AND COALESCE(d.utm_source,"") <> "meta-ads" AND d.ad_campaign_name IS NULL AND d.ad_adset_name IS NULL AND d.ad_name IS NULL AND COALESCE(d.campanha,"") = "") THEN "Instagram Organico" WHEN d.origem IN ("Facebook","Facebook Ads","Meta","Meta Ads","Organico","Org\u00e2nico","Instagram Org\u00e2nico") THEN "Instagram" WHEN d.origem IN ("Google","Google Ads","Google ads") THEN "Google" WHEN d.origem IN ("Origem nao Identificada","Origem n\u00e3o Identificada","N\u00e3o rastreada","Nao rastreada") THEN "Sem rastreio" ELSE d.origem END,""),"Sem rastreio")';
    const [groups] = await pool.query(
      'SELECT ' + fonteExpr + ' AS origem, COUNT(*) AS vendas, COALESCE(SUM(d.value),0) AS receita ' +
      'FROM deals d WHERE d.status = "won" AND d.won_date BETWEEN ? AND ? ' +
      'GROUP BY 1 ORDER BY receita DESC',
      [fromDt, toDt]
    );
    const [rows] = await pool.query(
      'SELECT d.id AS dealId, COALESCE(p.name, d.title) AS title, ' + fonteExpr + ' AS origem, d.value AS value, d.won_date AS date ' +
      'FROM deals d LEFT JOIN patients p ON p.id = d.patient_id ' +
      'WHERE d.status = "won" AND d.won_date BETWEEN ? AND ? ' +
      'ORDER BY 3 ASC, d.won_date DESC',
      [fromDt, toDt]
    );
    res.json({ success: true, from, to, groups, rows });
  } catch (e) {
    console.error('executive vendas drilldown error', e);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

app.get('/api/crm/ui/dashboard/executive-extra', auth, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const to = req.query.to || new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
    const { fromDt, toDt } = brRangeToUtc(from, to)

    const [bySource] = await pool.query(
      'SELECT COALESCE(NULLIF(CASE WHEN d.origem IN ("Instagram Orgânico","Organico","Orgânico") OR (d.origem = "Instagram" AND COALESCE(d.tintim_source_raw,"") NOT IN ("Meta Ads","Google Ads") AND COALESCE(d.plataforma,"") NOT IN ("Meta Ads","Meta") AND COALESCE(d.utm_source,"") <> "meta-ads" AND d.ad_campaign_name IS NULL AND d.ad_adset_name IS NULL AND d.ad_name IS NULL AND COALESCE(d.campanha,"") = "") THEN "Instagram Organico" WHEN d.origem IN ("Facebook","Facebook Ads","Meta","Meta Ads","Organico","Orgânico","Instagram Orgânico") THEN "Instagram" WHEN d.origem IN ("Google","Google Ads","Google ads") THEN "Google" WHEN d.origem IN ("Origem nao Identificada","Origem não Identificada","Não rastreada","Nao rastreada") THEN "Sem rastreio" ELSE d.origem END,""),"Sem rastreio") AS fonte, ' +
      'SUM(CASE WHEN d.pipeline_id IN (1,4) AND d.add_date BETWEEN ? AND ? AND (d.campanha IS NULL OR LOWER(TRIM(d.campanha)) <> "ja e paciente") THEN 1 ELSE 0 END) AS leads, ' +
      'SUM(CASE WHEN d.pipeline_id IN (1,4) AND d.add_date BETWEEN ? AND ? AND s.sort >= 9 AND (d.campanha IS NULL OR LOWER(TRIM(d.campanha)) <> "ja e paciente") THEN 1 ELSE 0 END) AS qualificados, ' +
      'SUM(CASE WHEN d.status = "won" AND d.won_date BETWEEN ? AND ? THEN 1 ELSE 0 END) AS vendas, ' +
      'COALESCE(SUM(CASE WHEN d.status = "won" AND d.won_date BETWEEN ? AND ? THEN d.value ELSE 0 END),0) AS receita ' +
      'FROM deals d LEFT JOIN stages s ON s.id = d.stage_id ' +
      'GROUP BY fonte ORDER BY leads DESC',
      [fromDt, toDt, fromDt, toDt, fromDt, toDt, fromDt, toDt]
    );

    const fonteExprLocal = 'COALESCE(NULLIF(CASE WHEN d.origem IN ("Instagram Orgânico","Organico","Orgânico") OR (d.origem = "Instagram" AND COALESCE(d.tintim_source_raw,"") NOT IN ("Meta Ads","Google Ads") AND COALESCE(d.plataforma,"") NOT IN ("Meta Ads","Meta") AND COALESCE(d.utm_source,"") <> "meta-ads" AND d.ad_campaign_name IS NULL AND d.ad_adset_name IS NULL AND d.ad_name IS NULL AND COALESCE(d.campanha,"") = "") THEN "Instagram Organico" WHEN d.origem IN ("Facebook","Facebook Ads","Meta","Meta Ads","Organico","Orgânico","Instagram Orgânico","Instagram Orgânico") THEN "Instagram" WHEN d.origem IN ("Google","Google Ads","Google ads") THEN "Google" WHEN d.origem IN ("Origem nao Identificada","Origem não Identificada","Não rastreada","Nao rastreada") THEN "Sem rastreio" ELSE d.origem END,""),"Sem rastreio")';
    const [bySourceAgendadas] = await pool.query(
      'SELECT ' + fonteExprLocal + ' AS fonte, COUNT(*) c FROM activities a JOIN deals d ON d.id = a.deal_id WHERE a.type = "Agendou" AND a.created_at BETWEEN ? AND ? GROUP BY fonte',
      [fromDt, toDt]
    );
    const fontePacienteExpr = 'CASE WHEN LOWER(TRIM(COALESCE(d.campanha,""))) = "ja e paciente" THEN "Ja e paciente" ELSE ' + fonteExprLocal + ' END';
    const [bySourceOrcamento] = await pool.query(
      'SELECT ' + fontePacienteExpr + ' AS fonte, COALESCE(SUM(a.amount),0) AS total FROM activities a JOIN deals d ON d.id = a.deal_id WHERE a.type = "Orcamento Gerado" AND a.created_at BETWEEN ? AND ? GROUP BY fonte',
      [fromDt, toDt]
    );
    const bySourceMap = {};
    (bySource || []).forEach(function(r){
      bySourceMap[r.fonte] = { fonte: r.fonte, leads: Number(r.leads||0), qualificados: Number(r.qualificados||0), vendas: Number(r.vendas||0), receita: Number(r.receita||0), agendadas: 0, orcamento: 0 };
    });
    (bySourceAgendadas || []).forEach(function(r){
      if (!bySourceMap[r.fonte]) bySourceMap[r.fonte] = { fonte: r.fonte, leads: 0, qualificados: 0, vendas: 0, receita: 0, agendadas: 0, orcamento: 0 };
      bySourceMap[r.fonte].agendadas = Number(r.c||0);
    });
    (bySourceOrcamento || []).forEach(function(r){
      if (!bySourceMap[r.fonte]) bySourceMap[r.fonte] = { fonte: r.fonte, leads: 0, qualificados: 0, vendas: 0, receita: 0, agendadas: 0, orcamento: 0 };
      bySourceMap[r.fonte].orcamento = Number(r.total||0);
    });
    const bySourceEnriched = Object.keys(bySourceMap).map(function(k){ return bySourceMap[k]; });

        const bucketSortCol = function(col) {
      return "CASE " + col + " " +
        "WHEN 1 THEN 1 WHEN 2 THEN 1 " +
        "WHEN 3 THEN 2 WHEN 4 THEN 2 WHEN 5 THEN 2 WHEN 6 THEN 2 WHEN 7 THEN 2 WHEN 8 THEN 2 " +
        "WHEN 9 THEN 3 WHEN 11 THEN 3 " +
        "WHEN 10 THEN 4 WHEN 12 THEN 4 " +
        "WHEN 13 THEN 5 " +
        "WHEN 14 THEN 6 WHEN 15 THEN 6 " +
        "ELSE NULL END";
    };
    const bucketLabelCol = function(col) {
      return "CASE " + col + " " +
        "WHEN 1 THEN 'Entrada' WHEN 2 THEN 'Entrada' " +
        "WHEN 3 THEN 'Contato realizado' WHEN 4 THEN 'Contato realizado' WHEN 5 THEN 'Contato realizado' WHEN 6 THEN 'Contato realizado' WHEN 7 THEN 'Contato realizado' WHEN 8 THEN 'Contato realizado' " +
        "WHEN 9 THEN 'Qualificado' WHEN 11 THEN 'Qualificado' " +
        "WHEN 10 THEN 'Agendado' WHEN 12 THEN 'Agendado' " +
        "WHEN 13 THEN 'Compareceu' " +
        "WHEN 14 THEN 'Negociação' WHEN 15 THEN 'Negociação' " +
        "ELSE NULL END";
    };
    const [maxReachedRows] = await pool.query(
      "SELECT deal_id, MAX(bsort) AS reached_sort FROM (" +
        "SELECT d.id AS deal_id, " + bucketSortCol("d.stage_id") + " AS bsort " +
        "FROM deals d WHERE d.pipeline_id = 1 AND d.add_date BETWEEN ? AND ? AND (d.campanha IS NULL OR LOWER(TRIM(d.campanha)) <> 'ja e paciente') " +
        "UNION ALL " +
        "SELECT sh.deal_id, " + bucketSortCol("sh.to_stage_id") + " AS bsort " +
        "FROM stage_history sh JOIN deals d2 ON d2.id = sh.deal_id " +
        "WHERE d2.pipeline_id = 1 AND d2.add_date BETWEEN ? AND ? AND (d2.campanha IS NULL OR LOWER(TRIM(d2.campanha)) <> 'ja e paciente') AND d2.count_as_lead_entry = 1" +
      ") u GROUP BY deal_id",
      [fromDt, toDt, fromDt, toDt]
    );
    const maxReachedMap = new Map();
    for (const r of maxReachedRows) { if (r.reached_sort != null) maxReachedMap.set(r.deal_id, r.reached_sort); }
    const BUCKETS = [
      { label: "Entrada", sort: 1 },
      { label: "Contato realizado", sort: 2 },
      { label: "Qualificado", sort: 3 },
      { label: "Agendado", sort: 4 },
      { label: "Compareceu", sort: 5 },
      { label: "Negociação", sort: 6 }
    ];
    const funnel = BUCKETS.map(function(b) {
      let c = 0;
      for (const v of maxReachedMap.values()) { if (v >= b.sort) c++; }
      return { id: null, label: b.label, sort: b.sort, total: c };
    });

    const [criativoRows] = await pool.query(
      "SELECT bucket_label, criativo, COUNT(*) AS cnt FROM (" +
        "SELECT " + bucketLabelCol("d.stage_id") + " AS bucket_label, " +
        "COALESCE(NULLIF(d.ad_name,''), NULLIF(d.criativo,''), 'Sem criativo') AS criativo " +
        "FROM deals d WHERE d.pipeline_id = 1 AND d.status = 'open' AND d.add_date BETWEEN ? AND ? AND (d.campanha IS NULL OR LOWER(TRIM(d.campanha)) <> 'ja e paciente') " +
        "UNION ALL " +
        "SELECT CASE WHEN d.status = 'won' THEN 'Ganho' WHEN d.status = 'lost' THEN 'Perdido' END AS bucket_label, " +
        "COALESCE(NULLIF(d.ad_name,''), NULLIF(d.criativo,''), 'Sem criativo') AS criativo " +
        "FROM deals d WHERE d.pipeline_id = 1 AND d.status IN ('won','lost') AND d.add_date BETWEEN ? AND ? AND (d.campanha IS NULL OR LOWER(TRIM(d.campanha)) <> 'ja e paciente')" +
      ") x WHERE bucket_label IS NOT NULL GROUP BY bucket_label, criativo",
      [fromDt, toDt, fromDt, toDt]
    );
    const criativoByBucket = {};
    for (const r of criativoRows) {
      if (!criativoByBucket[r.bucket_label]) criativoByBucket[r.bucket_label] = [];
      criativoByBucket[r.bucket_label].push({ criativo: r.criativo, cnt: r.cnt });
    }
    function top5For(label) {
      const arr = (criativoByBucket[label] || []).slice().sort(function(a, b) { return b.cnt - a.cnt; });
      const total = arr.reduce(function(s, x) { return s + x.cnt; }, 0);
      return arr.slice(0, 5).map(function(x) {
        return { criativo: x.criativo, pct: total ? Math.round((x.cnt / total) * 1000) / 10 : 0 };
      });
    }
    for (const f of funnel) { f.top5 = top5For(f.label); }

    const [[wonRow]] = await pool.query(
      'SELECT COUNT(*) AS c FROM deals WHERE pipeline_id = 1 AND status = "won" AND won_date BETWEEN ? AND ?',
      [fromDt, toDt]
    );
    const [[lostRow]] = await pool.query(
      'SELECT COUNT(*) AS c FROM deals WHERE pipeline_id = 1 AND status = "lost" AND add_date BETWEEN ? AND ?',
      [fromDt, toDt]
    );
    funnel.push({ id: null, label: 'Ganho', sort: 9998, total: (wonRow && wonRow.c) || 0, top5: top5For('Ganho') });
    funnel.push({ id: null, label: 'Perdido', sort: 9999, total: (lostRow && lostRow.c) || 0, top5: top5For('Perdido') });


    const [lossReasons] = await pool.query(
      'SELECT COALESCE(NULLIF(loss_reason,""),"Nao informado") AS motivo, COUNT(*) AS c ' +
      'FROM deals WHERE pipeline_id = 1 AND status = "lost" AND lost_date BETWEEN ? AND ? ' +
      'GROUP BY motivo ORDER BY c DESC LIMIT 6',
      [fromDt, toDt]
    );

    const [objRows] = await pool.query(
      'SELECT ' +
      'SUM(CASE WHEN tags LIKE ? AND add_date BETWEEN ? AND ? THEN 1 ELSE 0 END) AS financeira, ' +
      'SUM(CASE WHEN tags LIKE ? AND add_date BETWEEN ? AND ? THEN 1 ELSE 0 END) AS semInteresse, ' +
      'SUM(CASE WHEN tags LIKE ? AND add_date BETWEEN ? AND ? THEN 1 ELSE 0 END) AS distancia, ' +
      'SUM(CASE WHEN tags LIKE ? AND add_date BETWEEN ? AND ? THEN 1 ELSE 0 END) AS parouResponder ' +
      'FROM deals WHERE pipeline_id IN (1,4)',
      [
        '%Objeção financeira%', fromDt, toDt,
        '%Não tem interesse no momento%', fromDt, toDt,
        '%Objeção de distância(muito longe)%', fromDt, toDt,
        '%Parou de responder após o valor da consulta%', fromDt, toDt
      ]
    );
    const objRow0 = objRows[0] || {};
    const objections = [
      { motivo: 'Objeção financeira', c: Number(objRow0.financeira||0) },
      { motivo: 'Não tem interesse no momento', c: Number(objRow0.semInteresse||0) },
      { motivo: 'Objeção de distância(muito longe)', c: Number(objRow0.distancia||0) },
      { motivo: 'Parou de responder após o valor da consulta', c: Number(objRow0.parouResponder||0) }
    ].sort((a,b) => b.c - a.c);
    const [[lostTotalRow]] = await pool.query(
      'SELECT COUNT(*) AS c FROM deals WHERE pipeline_id = 1 AND status = "lost" AND lost_date BETWEEN ? AND ?',
      [fromDt, toDt]
    );

    const refDate = new Date(to + 'T00:00:00');
    const start6 = new Date(refDate.getFullYear(), refDate.getMonth() - 5, 1);
    const [monthlyRevenue] = await pool.query(
      'SELECT DATE_FORMAT(won_date, "%Y-%m") AS ym, COALESCE(SUM(CASE WHEN pipeline_id = 1 THEN value ELSE 0 END),0) AS receita_pago, COALESCE(SUM(CASE WHEN pipeline_id <> 1 THEN value ELSE 0 END),0) AS receita_organico ' +
      'FROM deals WHERE status = "won" AND won_date >= ? ' +
      'GROUP BY ym ORDER BY ym',
      [start6.toISOString().slice(0,10) + ' 00:00:00']
    );

  const [profRows] = await pool.query('SELECT id, name FROM professionals WHERE active = 1');
  function normName(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^(dra?\.?\s+)/, '').trim();
  }
  const profList = profRows.map(function(p){ return { id: p.id, name: p.name, norm: normName(p.name) }; });
  const [wonDealsR] = await pool.query('SELECT id, professional_id, value, tags FROM deals WHERE status = "won" AND won_date BETWEEN ? AND ?', [fromDt, toDt]);
  const [addedDealsR] = await pool.query('SELECT professional_id, tags FROM deals WHERE add_date BETWEEN ? AND ?', [fromDt, toDt]);
  function matchProfessional(professionalId, tagsRaw) {
    if (professionalId) { const byId = profList.find(function(p){ return p.id === professionalId; }); if (byId) return byId; }
    if (tagsRaw) { let tags; try { tags = JSON.parse(tagsRaw); } catch (e) { tags = []; } const joined = normName(tags.join(' ')); for (const p of profList) { if (p.norm && joined.indexOf(p.norm) !== -1) return p; } }
    return null;
  }
  const statsMap = {};
  profList.forEach(function(p){ statsMap[p.id] = { id: p.id, name: p.name, negocios: 0, vendas: 0, receita: 0 }; });
  addedDealsR.forEach(function(d){ const p = matchProfessional(d.professional_id, d.tags); if (p) statsMap[p.id].negocios++; });
  wonDealsR.forEach(function(d){ const p = matchProfessional(d.professional_id, d.tags); if (p) { statsMap[p.id].vendas++; statsMap[p.id].receita += Number(d.value || 0); } });
  const ranking = Object.values(statsMap).filter(function(r){ return r.negocios > 0 || r.vendas > 0; }).sort(function(a,b){ return b.receita - a.receita; }).slice(0, 5);


  const [byProcedure] = await pool.query(
    'SELECT COALESCE(NULLIF(procedure_name,""),"Outros") AS proc, COALESCE(SUM(value),0) AS receita ' +
    'FROM deals WHERE status = "won" AND won_date BETWEEN ? AND ? ' +
    'GROUP BY proc ORDER BY receita DESC LIMIT 8',
    [fromDt, toDt]
  );

    res.json({
      success: true, from, to,
      bySource: bySourceEnriched, funnel, lossReasons, objections,
      lostTotal: lostTotalRow.c,
      monthlyRevenue, ranking, byProcedure
    });
  } catch (e) {
    console.error('dashboard executive-extra error', e);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

app.get('/api/crm/ui/dashboard/sdrs', auth, requireAdmin, async (req, res) => {
  try {
    const now = new Date()
    const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10)
    const to = req.query.to || new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10)
    const { fromDt, toDt } = brRangeToUtc(from, to)
    const [rows] = await pool.query(
      'SELECT u.id, u.name, ' +
      'COALESCE(dm.leads,0) AS leads, COALESCE(dm.qualificados,0) AS qualificados, COALESCE(vm.vendas,0) AS vendas, COALESCE(vm.receita,0) AS receita, ' +
      'COALESCE(dm.orcamentos_gerados,0) AS orcamentos_gerados, COALESCE(dm.valor_orcamentos_gerados,0) AS valor_orcamentos_gerados ' +
      'FROM users u ' +
      'LEFT JOIN ( ' +
      '  SELECT d.owner_name AS ownerName, COUNT(d.id) AS leads, ' +
      '    SUM(CASE WHEN s.sort >= 9 THEN 1 ELSE 0 END) AS qualificados, ' +
      '    SUM(CASE WHEN d.value > 0 THEN 1 ELSE 0 END) AS orcamentos_gerados, ' +
      '    COALESCE(SUM(CASE WHEN d.value > 0 THEN d.value ELSE 0 END),0) AS valor_orcamentos_gerados ' +
      '  FROM deals d ' +
      '  LEFT JOIN stages s ON s.id = d.stage_id ' +
      '  WHERE d.stage_id IN (SELECT id FROM stages WHERE pipeline_id = 1) AND d.add_date BETWEEN ? AND ? AND d.count_as_lead_entry = 1 ' +
      '  GROUP BY d.owner_name ' +
      ') dm ON dm.ownerName = u.name ' +
      'LEFT JOIN ( ' +
      '  SELECT d3.owner_name AS ownerName, COUNT(d3.id) AS vendas, COALESCE(SUM(d3.value),0) AS receita ' +
      '  FROM deals d3 ' +
      "  WHERE d3.stage_id IN (SELECT id FROM stages WHERE pipeline_id = 1) AND d3.status = 'won' AND d3.won_date BETWEEN ? AND ? AND (d3.tags IS NULL OR d3.tags NOT LIKE '%teste_allowlist%') AND NOT EXISTS (SELECT 1 FROM patient_labels pl JOIN labels l ON l.id = pl.label_id WHERE pl.patient_id = d3.patient_id AND l.name = 'Vendedor') " +
      '  GROUP BY d3.owner_name ' +
      ') vm ON vm.ownerName = u.name ' +
      "WHERE u.role = 'sdr' AND u.active = 1 " +
      'ORDER BY leads DESC',
      [fromDt, toDt, fromDt, toDt]
    )

    const ACT_TYPE_TO_METRIC = {
      'Chamada Realizada': 'ligacoes_efetuadas',
      'Ligação Atendida': 'ligacoes_atendidas',
      'Agendou': 'agendamentos',
      'Compareceu': 'comparecimentos'
    }
    const [actRows] = await pool.query(
      'SELECT d.owner_name AS ownerName, d.id AS dealId, a.type AS type, a.created_at AS createdAt, a.content AS content ' +
      'FROM activities a JOIN deals d ON d.id = a.deal_id ' +
      "WHERE a.created_at BETWEEN ? AND ? AND a.type IN ('Chamada Realizada','Ligação Atendida','Agendou','Compareceu') " +
      'ORDER BY d.id, a.type, a.created_at ASC',
      [fromDt, toDt]
    )
    const CONFIRM_MARKER = 'autorizada e confirmada pelo responsavel'
    const actCounts = {}
    const groups = {}
    for (const r of actRows) {
      const key = r.dealId + '|' + r.type
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    }
    for (const key in groups) {
      const list = groups[key]
      let lastKeptTime = null
      for (let i = 0; i < list.length; i++) {
        const r = list[i]
        const t = new Date(r.createdAt).getTime()
        const isConfirmed = !!(r.content && r.content.indexOf(CONFIRM_MARKER) !== -1)
        let counts = true
        if (lastKeptTime !== null && !isConfirmed) {
          const gapSec = (t - lastKeptTime) / 1000
          if (gapSec < 120) counts = false
        }
        if (counts) {
          lastKeptTime = t
          const metric = ACT_TYPE_TO_METRIC[r.type]
          const ownerKey = r.ownerName || ''
          if (!actCounts[ownerKey]) actCounts[ownerKey] = {}
          actCounts[ownerKey][metric] = (actCounts[ownerKey][metric] || 0) + 1
        }
      }
    }

    const outRows = rows.map(function(row) {
      const ac = actCounts[row.name] || {}
      return {
        id: row.id,
        name: row.name,
        leads: row.leads,
        qualificados: row.qualificados,
        vendas: row.vendas,
        receita: row.receita,
        orcamentos_gerados: row.orcamentos_gerados,
        valor_orcamentos_gerados: row.valor_orcamentos_gerados,
        ligacoes_efetuadas: ac.ligacoes_efetuadas || 0,
        ligacoes_atendidas: ac.ligacoes_atendidas || 0,
        agendamentos: ac.agendamentos || 0,
        comparecimentos: ac.comparecimentos || 0
      }
    })

    res.json({ success: true, from, to, rows: outRows })
  } catch (e) { console.error('dashboard sdrs error', e); res.status(500).json({ success: false, error: 'Erro interno' }) }
})
app.get('/api/crm/ui/dashboard/sdrs/drilldown', auth, requireAdmin, async (req, res) => {
  try {
    const ownerName = String(req.query.ownerName || '').trim()
    const metric = String(req.query.metric || '')
    const from = req.query.from
    const to = req.query.to
    if (!ownerName || !from || !to) return res.status(400).json({ success:false, error: 'ownerName, from, to sao obrigatorios' })
    const { fromDt, toDt } = brRangeToUtc(from, to)
    let rows
    if (metric === 'leads') {
      ;[rows] = await pool.query('SELECT d.id AS dealId, p.name AS patientName, p.phone, d.add_date AS date, d.value FROM deals d JOIN patients p ON p.id = d.patient_id WHERE d.owner_name = ? AND d.pipeline_id = 1 AND d.add_date BETWEEN ? AND ? ORDER BY d.add_date DESC', [ownerName, fromDt, toDt])
    } else if (metric === 'qualificados') {
      ;[rows] = await pool.query('SELECT d.id AS dealId, p.name AS patientName, p.phone, d.add_date AS date, d.value FROM deals d JOIN patients p ON p.id = d.patient_id LEFT JOIN stages s ON s.id = d.stage_id WHERE d.owner_name = ? AND d.pipeline_id = 1 AND d.add_date BETWEEN ? AND ? AND s.sort >= 9 ORDER BY d.add_date DESC', [ownerName, fromDt, toDt])
    } else if (metric === 'vendas' || metric === 'fechados') {
      ;[rows] = await pool.query("SELECT d.id AS dealId, p.name AS patientName, p.phone, d.won_date AS date, d.value FROM deals d JOIN patients p ON p.id = d.patient_id WHERE d.owner_name = ? AND d.pipeline_id = 1 AND d.won_date BETWEEN ? AND ? AND d.status = 'won' ORDER BY d.won_date DESC", [ownerName, fromDt, toDt])
    } else if (metric === 'orcamentos_gerados') {
      ;[rows] = await pool.query('SELECT d.id AS dealId, p.name AS patientName, p.phone, d.add_date AS date, d.value FROM deals d JOIN patients p ON p.id = d.patient_id WHERE d.owner_name = ? AND d.pipeline_id = 1 AND d.add_date BETWEEN ? AND ? AND d.value > 0 ORDER BY d.add_date DESC', [ownerName, fromDt, toDt])
    } else if (['ligacoes_efetuadas','ligacoes_atendidas','agendamentos','comparecimentos'].includes(metric)) {
      const typeMap = { ligacoes_efetuadas: 'Chamada Realizada', ligacoes_atendidas: 'Ligação Atendida', agendamentos: 'Agendou', comparecimentos: 'Compareceu' }
      const actType = typeMap[metric]
      const [rawRows] = await pool.query('SELECT d.id AS dealId, p.name AS patientName, p.phone, a.created_at AS date, d.value, a.content AS content FROM activities a JOIN deals d ON d.id = a.deal_id JOIN patients p ON p.id = d.patient_id WHERE d.owner_name = ? AND d.pipeline_id = 1 AND a.type = ? AND a.created_at BETWEEN ? AND ? ORDER BY d.id, a.created_at ASC', [ownerName, actType, fromDt, toDt])
      const CONFIRM_MARKER = 'autorizada e confirmada pelo responsavel'
      const groups = {}
      for (const r of rawRows) { if (!groups[r.dealId]) groups[r.dealId] = []; groups[r.dealId].push(r) }
      const kept = []
      for (const dId in groups) {
        const list = groups[dId]
        let lastKeptTime = null
        for (const r of list) {
          const t = new Date(r.date).getTime()
          const isConfirmed = !!(r.content && r.content.indexOf(CONFIRM_MARKER) !== -1)
          let counts = true
          if (lastKeptTime !== null && !isConfirmed) {
            const gapSec = (t - lastKeptTime) / 1000
            if (gapSec < 120) counts = false
          }
          if (counts) { lastKeptTime = t; kept.push(r) }
        }
      }
      kept.sort(function(a,b){ return new Date(b.date) - new Date(a.date) })
      rows = kept
    } else {
      return res.status(400).json({ success:false, error: 'metric invalido' })
    }
    res.json({ success: true, rows })
  } catch (e) { console.error('sdr drilldown error', e); res.status(500).json({ success:false, error: 'Erro interno' }) }
})

// ===== DIRETORIA dashboard =====
const BR_OFFSET_MS = 3 * 60 * 60 * 1000 // Brazil is UTC-3, no DST since 2019
function brDayStartUtc(dateStr) {
  return new Date(new Date(dateStr + 'T00:00:00.000Z').getTime() + BR_OFFSET_MS)
}
function brRangeToUtc(fromDate, toDate) {
  const fromUtc = brDayStartUtc(fromDate)
  const toUtc = new Date(brDayStartUtc(toDate).getTime() + 24*60*60*1000 - 1000)
  const fmt = function(d){ return d.toISOString().slice(0,19).replace('T',' ') }
  return { fromDt: fmt(fromUtc), toDt: fmt(toUtc) }
}
function brTodayStr() {
  return new Date(Date.now() - BR_OFFSET_MS).toISOString().slice(0,10)
}
async function ddCountLeads(pool, ownerName, fromDt, toDt) {
  const [[r]] = await pool.query('SELECT COUNT(*) c FROM deals WHERE pipeline_id = 1 AND owner_name = ? AND add_date BETWEEN ? AND ? AND count_as_lead_entry = 1', [ownerName, fromDt, toDt])
  return r.c
}
async function ddCountDuplicates(pool, ownerName, fromDt, toDt) {
  const [[r]] = await pool.query('SELECT COUNT(*) c FROM deals WHERE pipeline_id = 1 AND owner_name = ? AND duplicate_alert = 1 AND add_date BETWEEN ? AND ?', [ownerName, fromDt, toDt])
  return r.c
}
async function ddCountDedupedActivity(pool, ownerName, actType, fromDt, toDt) {
  const [rawRows] = await pool.query('SELECT d.id AS dealId, a.created_at AS createdAt, a.content AS content FROM activities a JOIN deals d ON d.id = a.deal_id WHERE d.owner_name = ? AND a.type = ? AND a.created_at BETWEEN ? AND ? ORDER BY d.id, a.created_at ASC', [ownerName, actType, fromDt, toDt])
  const CONFIRM_MARKER = 'autorizada e confirmada pelo responsavel'
  const groups = {}
  for (const r of rawRows) { if (!groups[r.dealId]) groups[r.dealId] = []; groups[r.dealId].push(r) }
  let total = 0
  for (const dId in groups) {
    const list = groups[dId]
    let lastKeptTime = null
    for (const r of list) {
      const t = new Date(r.createdAt).getTime()
      const isConfirmed = !!(r.content && r.content.indexOf(CONFIRM_MARKER) !== -1)
      let counts = true
      if (lastKeptTime !== null && !isConfirmed) {
        const gapSec = (t - lastKeptTime) / 1000
        if (gapSec < 120) counts = false
      }
      if (counts) { lastKeptTime = t; total++ }
    }
  }
  return total
}
async function ddSumDedupedBudget(pool, whereClause, params) {
  const [rawRows] = await pool.query('SELECT a.deal_id AS dealId, a.created_at AS createdAt, a.content AS content, a.amount AS amount FROM activities a JOIN deals d ON d.id = a.deal_id WHERE a.type = \'Orcamento Gerado\' AND ' + whereClause, params)
  const CONFIRM_MARKER = 'autorizado e confirmado pelo responsavel'
  const groups = {}
  for (const r of rawRows) { if (!groups[r.dealId]) groups[r.dealId] = []; groups[r.dealId].push(r) }
  let total = 0
  for (const dId in groups) {
    const list = groups[dId]
    let lastKeptTime = null
    for (const r of list) {
      const t = new Date(r.createdAt).getTime()
      const isConfirmed = !!(r.content && r.content.indexOf(CONFIRM_MARKER) !== -1)
      let counts = true
      if (lastKeptTime !== null && !isConfirmed) { const gapSec = (t - lastKeptTime) / 1000; if (gapSec < 120) counts = false }
      if (counts) { lastKeptTime = t; total += Number(r.amount || 0) }
    }
  }
  return total
}
module.exports.ddSdrDayMetrics = ddSdrDayMetrics;
module.exports.brRangeToUtc = brRangeToUtc;
module.exports.brTodayStr = brTodayStr;
module.exports.ddSumDedupedBudget = ddSumDedupedBudget;

async function ddGetMetas(pool, keys, periodoKey) {
  if (!keys.length) return {}
  const [rows] = await pool.query('SELECT indicador_key, meta_value FROM diretoria_metas WHERE periodo_key = ? AND indicador_key IN (' + keys.map(()=>'?').join(',') + ')', [periodoKey, ...keys])
  const out = {}
  rows.forEach(function(r){ out[r.indicador_key] = Number(r.meta_value) })
  return out
}
function ddWeeksForMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  const monthStart = new Date(y, m - 1, 1)
  const monthEnd = new Date(y, m, 0)
  let weekStart = new Date(monthStart)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weeks = []
  while (weekStart <= monthEnd) {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weeks.push({ from: weekStart.toISOString().slice(0,10), to: weekEnd.toISOString().slice(0,10) })
    weekStart = new Date(weekStart)
    weekStart.setDate(weekStart.getDate() + 7)
  }
  return weeks
}
async function ddComputeIndicators(pool, fromDate, toDate) {
  const { fromDt, toDt } = brRangeToUtc(fromDate, toDate)
  const out = {}

  const [[fat]] = await pool.query("SELECT COALESCE(SUM(value),0) v, COUNT(*) c FROM deals WHERE status = 'won' AND won_date BETWEEN ? AND ?", [fromDt, toDt])
  out.faturamento_clinica = Number(fat.v)
  const vendasCount = Number(fat.c)
  out.ticket_medio = vendasCount > 0 ? out.faturamento_clinica / vendasCount : 0

  out.oportunidades_criadas = await ddSumDedupedBudget(pool, 'a.created_at BETWEEN ? AND ?', [fromDt, toDt])

  const leadsAgda = await ddCountLeads(pool, 'Agda', fromDt, toDt)
  const compAgda = await ddCountDedupedActivity(pool, 'Agda', 'Compareceu', fromDt, toDt)
  out.num_comparecimento_agda = compAgda
  out.pct_comparecem_agda = leadsAgda > 0 ? (compAgda / leadsAgda * 100) : 0

  const leadsHelenice = await ddCountLeads(pool, 'Helenice', fromDt, toDt)
  const compHelenice = await ddCountDedupedActivity(pool, 'Helenice', 'Compareceu', fromDt, toDt)
  out.num_comparecimento_helenice = compHelenice
  out.pct_comparecem_helenice = leadsHelenice > 0 ? (compHelenice / leadsHelenice * 100) : 0

  const closerNameMatch = "(LOWER(CAST(d.tags AS CHAR)) LIKE '%jessica%' OR LOWER(CAST(d.tags AS CHAR)) LIKE '%jéssica%' OR EXISTS (SELECT 1 FROM deal_labels dl JOIN labels lb ON lb.id = dl.label_id WHERE dl.deal_id = d.id AND LOWER(lb.name) LIKE '%jessica%'))"
  const [[closerFat]] = await pool.query(`SELECT COALESCE(SUM(value),0) v FROM deals d WHERE (d.professional_id = 2 OR ${closerNameMatch}) AND d.status = 'won' AND d.won_date BETWEEN ? AND ?`, [fromDt, toDt])
  out.faturamento_closer1 = Number(closerFat.v)

  const [[closerConv]] = await pool.query(`SELECT COUNT(*) total, SUM(CASE WHEN d.status = 'won' THEN 1 ELSE 0 END) won FROM deals d WHERE (d.professional_id = 2 OR ${closerNameMatch}) AND d.add_date BETWEEN ? AND ?`, [fromDt, toDt])
  const closerTotal = Number(closerConv.total)
  const closerWon = Number(closerConv.won || 0)
  out.pct_conversao_closer1 = closerTotal > 0 ? (closerWon / closerTotal * 100) : 0

  const [[leadsAll]] = await pool.query('SELECT COUNT(*) c FROM deals WHERE add_date BETWEEN ? AND ?', [fromDt, toDt])
  out.leads_gerados_diretor = Number(leadsAll.c)

  return out
}
const DIRETORIA_INDICATORS = [
  { key: 'faturamento_clinica', label: 'Faturamento (Total da Clínica)', responsavel: 'Gerente Comercial', format: 'money' },
  { key: 'oportunidades_criadas', label: 'Oportunidades Criadas (R$)', responsavel: 'Gerente Comercial', format: 'money' },
  { key: 'ticket_medio', label: 'Ticket Médio (Total da Clínica)', responsavel: 'Gerente Comercial', format: 'money' },
  { key: 'pct_comparecem_agda', label: '% de Leads que Comparecem (SDR)', responsavel: 'Agda', format: 'pct' },
  { key: 'num_comparecimento_agda', label: 'Número de Comparecimentos (SDR)', responsavel: 'Agda', format: 'int' },
  { key: 'pct_comparecem_helenice', label: '% de Leads que Comparecem (SDR)', responsavel: 'Helenice', format: 'pct' },
  { key: 'num_comparecimento_helenice', label: 'Número de Comparecimentos (SDR)', responsavel: 'Helenice', format: 'int' },
  { key: 'faturamento_closer1', label: 'Faturamento (vendas realizadas em R$)', responsavel: 'Closer nº 1 (Dra. Jéssica)', format: 'money' },
  { key: 'pct_conversao_closer1', label: '% de Conversão (incluindo follow-up)', responsavel: 'Closer nº 1 (Dra. Jéssica)', format: 'pct' },
  { key: 'leads_gerados_diretor', label: 'Quantidade de Leads Gerados', responsavel: 'Diretor', format: 'int' }
]
app.get('/api/crm/ui/dashboard/diretoria/annual', auth, requireAdmin, async (req, res) => {
  try {
    var year = parseInt(req.query.year, 10) || new Date().getFullYear();
    var monthLabels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    var months = [];
    for (var m = 0; m < 12; m++) {
      var mm = String(m + 1).padStart(2, '0');
      var from = year + '-' + mm + '-01';
      var lastDay = new Date(year, m + 1, 0).getDate();
      var to = year + '-' + mm + '-' + String(lastDay).padStart(2, '0');
      var periodoKey = 'M:' + year + '-' + mm;
      var ind = await ddComputeIndicators(pool, from, to);
      var metas = await ddGetMetas(pool, ['faturamento_clinica'], periodoKey);
      months.push({
        month: periodoKey,
        label: monthLabels[m],
        realizado: ind.faturamento_clinica || 0,
        meta: metas.faturamento_clinica || 0
      });
    }
    res.json({ success: true, year: year, months: months });
  } catch (e) {
    console.error('diretoria annual error', e);
    res.status(500).json({ success: false, error: e.message });
  }
});
app.get('/api/crm/ui/dashboard/diretoria', auth, requireAdmin, async (req, res) => {
  try {
    const month = req.query.month || brTodayStr().slice(0,7)
    const weeks = ddWeeksForMonth(month)
    const [y, m] = month.split('-').map(Number)
    const monthFrom = month + '-01'
    const monthTo = new Date(y, m, 0).toISOString().slice(0,10)

    const periods = [{ key: 'M:' + month, label: 'Mes (Acumulado)', from: monthFrom, to: monthTo }]
    weeks.forEach(function(w, i){ periods.push({ key: 'W:' + w.from, label: 'Semana (' + w.from.slice(8,10) + '/' + w.from.slice(5,7) + ' a ' + w.to.slice(8,10) + '/' + w.to.slice(5,7) + ')', from: w.from, to: w.to }) })

    const keys = DIRETORIA_INDICATORS.map(function(i){ return i.key })
    const result = []
    for (const ind of DIRETORIA_INDICATORS) {
      const row = { key: ind.key, label: ind.label, responsavel: ind.responsavel, format: ind.format, periods: [] }
      for (const p of periods) {
        const real = await ddComputeIndicators(pool, p.from, p.to)
        const metas = await ddGetMetas(pool, [ind.key], p.key)
        row.periods.push({ periodoKey: p.key, label: p.label, from: p.from, to: p.to, real: real[ind.key], meta: metas[ind.key] || 0 })
      }
      result.push(row)
    }
    res.json({ success: true, month, periods: periods.map(function(p){ return { key: p.key, label: p.label, from: p.from, to: p.to } }), indicators: result })
  } catch (e) { console.error('diretoria error', e); res.status(500).json({ success: false, error: 'Erro interno' }) }
})
app.get('/api/crm/ui/dashboard/diretoria/drilldown', auth, requireAdmin, async (req, res) => {
  try {
    const indicador = req.query.indicador;
    const { fromDt: from, toDt: to } = brRangeToUtc(req.query.from, req.query.to);
    if (!indicador || !from || !to) return res.status(400).json({ success: false, error: 'indicador, from, to sao obrigatorios' });
    let rows = [];
    if (indicador === 'faturamento_clinica') {
      [rows] = await pool.query("SELECT d.id AS dealId, COALESCE(p.name, d.title) AS title, d.value AS value, d.won_date AS date FROM deals d LEFT JOIN patients p ON p.id = d.patient_id WHERE d.status = 'won' AND d.won_date BETWEEN ? AND ? ORDER BY d.value DESC", [from, to]);
    } else if (indicador === 'faturamento_closer1') {
      const closerNameMatch = "(LOWER(CAST(d.tags AS CHAR)) LIKE '%jessica%' OR LOWER(CAST(d.tags AS CHAR)) LIKE '%jéssica%' OR EXISTS (SELECT 1 FROM deal_labels dl JOIN labels lb ON lb.id = dl.label_id WHERE dl.deal_id = d.id AND LOWER(lb.name) LIKE '%jessica%'))";
      [rows] = await pool.query(`SELECT d.id AS dealId, COALESCE(p.name, d.title) AS title, d.value AS value, d.won_date AS date FROM deals d LEFT JOIN patients p ON p.id = d.patient_id WHERE (d.professional_id = 2 OR ${closerNameMatch}) AND d.status = 'won' AND d.won_date BETWEEN ? AND ? ORDER BY d.value DESC`, [from, to]);
    } else if (indicador === 'leads_gerados_diretor') {
      [rows] = await pool.query('SELECT d.id AS dealId, COALESCE(p.name, d.title) AS title, d.value AS value, d.add_date AS date FROM deals d LEFT JOIN patients p ON p.id = d.patient_id WHERE d.add_date BETWEEN ? AND ? ORDER BY d.add_date DESC', [from, to]);
    } else if (indicador === 'num_comparecimento_agda') {
      rows = await ddDedupedActivityItems(pool, 'Agda', 'Compareceu', from, to);
    } else if (indicador === 'num_comparecimento_helenice') {
      rows = await ddDedupedActivityItems(pool, 'Helenice', 'Compareceu', from, to);
    } else {
      return res.json({ success: true, indicador, rows: [], noDrilldown: true });
    }
    res.json({ success: true, indicador, rows });
  } catch (e) { console.error('diretoria drilldown error', e); res.status(500).json({ success: false, error: 'Erro interno' }); }
});

app.patch('/api/crm/ui/dashboard/diretoria/meta', auth, requireAdmin, async (req, res) => {
  try {
    const { indicadorKey, periodoKey, value } = req.body || {}
    if (!indicadorKey || !periodoKey || value === undefined) return res.status(400).json({ success: false, error: 'indicadorKey, periodoKey, value sao obrigatorios' })
    await pool.query('INSERT INTO diretoria_metas (indicador_key, periodo_key, meta_value) VALUES (?,?,?) ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)', [indicadorKey, periodoKey, value])
    res.json({ success: true })
  } catch (e) { console.error('diretoria meta patch error', e); res.status(500).json({ success: false, error: 'Erro interno' }) }
})

const SDR_DAILY_METRICS = [
  { key: 'leads_recebidos_dia', label: 'Leads Recebidos' },
  { key: 'ligacoes_efetuadas_dia', label: 'Tentativas de Ligacao' },
  { key: 'ligacoes_atendidas_dia', label: 'Ligacoes Atendidas' },
  { key: 'agendamentos_dia', label: 'Agendamentos Realizados (Inbound)' },
  { key: 'comparecimentos_dia', label: 'Comparecimentos' },
  { key: 'oportunidades_dia', label: 'Oportunidades' },
  { key: 'fechamentos_dia', label: 'Fechamentos' }
]
async function ddSdrDayMetrics(pool, ownerName, fromDate, toDate) {
  const { fromDt, toDt } = brRangeToUtc(fromDate, toDate)
  const leads = await ddCountLeads(pool, ownerName, fromDt, toDt)
  const ligEfet = await ddCountDedupedActivity(pool, ownerName, 'Chamada Realizada', fromDt, toDt)
  const ligAtend = await ddCountDedupedActivity(pool, ownerName, 'Ligação Atendida', fromDt, toDt)
  const agend = await ddCountDedupedActivity(pool, ownerName, 'Agendou', fromDt, toDt)
  const comp = await ddCountDedupedActivity(pool, ownerName, 'Compareceu', fromDt, toDt)
  const dup = await ddCountDuplicates(pool, ownerName, fromDt, toDt)
  const oppSum = await ddSumDedupedBudget(pool, 'd.owner_name = ? AND a.created_at BETWEEN ? AND ?', [ownerName, fromDt, toDt])
  const [[fech]] = await pool.query("SELECT COALESCE(SUM(value),0) v FROM deals WHERE pipeline_id = 1 AND owner_name = ? AND status = 'won' AND won_date BETWEEN ? AND ?", [ownerName, fromDt, toDt])
  return {
    leads_recebidos_dia: leads,
    ligacoes_efetuadas_dia: ligEfet,
    ligacoes_atendidas_dia: ligAtend,
    agendamentos_dia: agend,
    comparecimentos_dia: comp,
    oportunidades_dia: oppSum,
    fechamentos_dia: Number(fech.v),
    leads_duplicados_dia: dup
  }
}
app.get('/api/crm/ui/dashboard/sdr-daily', auth, requireAdmin, async (req, res) => {
  try {
    const from = req.query.from || brTodayStr()
    const to = req.query.to || from
    const fromD = new Date(from + 'T12:00:00')
    const toD = new Date(to + 'T12:00:00')
    const periodDays = Math.max(1, Math.round((toD - fromD) / 86400000) + 1)
    const prevToD = new Date(fromD); prevToD.setDate(prevToD.getDate() - 1)
    const prevFromD = new Date(prevToD); prevFromD.setDate(prevFromD.getDate() - (periodDays - 1))
    const prevFrom = prevFromD.toISOString().slice(0,10)
    const prevTo = prevToD.toISOString().slice(0,10)
    const agdaHoje = await ddSdrDayMetrics(pool, 'Agda', from, to)
    const heleniceHoje = await ddSdrDayMetrics(pool, 'Helenice', from, to)
    const agdaOntem = await ddSdrDayMetrics(pool, 'Agda', prevFrom, prevTo)
    const heleniceOntem = await ddSdrDayMetrics(pool, 'Helenice', prevFrom, prevTo)
    const metaKeys = SDR_DAILY_METRICS.map(function(m){ return m.key })
    const metasRaw = await ddGetMetas(pool, metaKeys, 'daily')
    const rows = SDR_DAILY_METRICS.map(function(m){
      const metaScaled = (metasRaw[m.key] || 0) * periodDays
      return { key: m.key, label: m.label, isMoney: m.key === 'oportunidades_dia' || m.key === 'fechamentos_dia', hoje: { agda: agdaHoje[m.key], helenice: heleniceHoje[m.key] }, ontem: { agda: agdaOntem[m.key], helenice: heleniceOntem[m.key] }, dupHoje: { agda: agdaHoje.leads_duplicados_dia, helenice: heleniceHoje.leads_duplicados_dia }, meta: metaScaled }
    })
    res.json({ success: true, today: from, todayTo: to, yesterday: prevFrom, yesterdayTo: prevTo, periodDays: periodDays, rows: rows })
  } catch (e) { console.error('sdr-daily error', e); res.status(500).json({ success: false, error: 'Erro interno' }) }
})
async function ddDedupedActivityItems(pool, ownerName, actType, fromDt, toDt) {
  const [rawRows] = await pool.query('SELECT d.id AS dealId, d.title AS title, p.name AS patientName, a.created_at AS createdAt, a.content AS content FROM activities a JOIN deals d ON d.id = a.deal_id LEFT JOIN patients p ON p.id = d.patient_id WHERE d.owner_name = ? AND a.type = ? AND a.created_at BETWEEN ? AND ? ORDER BY d.id, a.created_at ASC', [ownerName, actType, fromDt, toDt]);
  const CONFIRM_MARKER = 'autorizada e confirmada pelo responsavel';
  const groups = {};
  for (const r of rawRows) { if (!groups[r.dealId]) groups[r.dealId] = []; groups[r.dealId].push(r); }
  const out = [];
  for (const dId in groups) {
    const list = groups[dId];
    let lastKeptTime = null;
    for (const r of list) {
      const t = new Date(r.createdAt).getTime();
      const isConfirmed = !!(r.content && r.content.indexOf(CONFIRM_MARKER) !== -1);
      let counts = true;
      if (lastKeptTime !== null && !isConfirmed) { const gapSec = (t - lastKeptTime) / 1000; if (gapSec < 120) counts = false; }
      if (counts) { lastKeptTime = t; out.push({ dealId: r.dealId, title: r.patientName || r.title, date: r.createdAt, content: r.content }); }
    }
  }
  return out;
}
async function ddDedupedBudgetItems(pool, ownerName, fromDt, toDt) {
  const [rawRows] = await pool.query('SELECT d.id AS dealId, d.title AS title, p.name AS patientName, a.created_at AS createdAt, a.content AS content, a.amount AS amount FROM activities a JOIN deals d ON d.id = a.deal_id LEFT JOIN patients p ON p.id = d.patient_id WHERE a.type = \'Orçamento Gerado\' AND d.owner_name = ? AND a.created_at BETWEEN ? AND ? ORDER BY d.id, a.created_at ASC', [ownerName, fromDt, toDt]);
  const CONFIRM_MARKER = 'autorizada e confirmada pelo responsavel';
  const groups = {};
  for (const r of rawRows) { if (!groups[r.dealId]) groups[r.dealId] = []; groups[r.dealId].push(r); }
  const out = [];
  for (const dId in groups) {
    const list = groups[dId];
    let lastKeptTime = null;
    for (const r of list) {
      const t = new Date(r.createdAt).getTime();
      const isConfirmed = !!(r.content && r.content.indexOf(CONFIRM_MARKER) !== -1);
      let counts = true;
      if (lastKeptTime !== null && !isConfirmed) { const gapSec = (t - lastKeptTime) / 1000; if (gapSec < 120) counts = false; }
      if (counts) { lastKeptTime = t; out.push({ dealId: r.dealId, title: r.patientName || r.title, date: r.createdAt, value: Number(r.amount || 0), content: r.content }); }
    }
  }
  return out;
}
app.get('/api/crm/ui/dashboard/sdr-daily/drilldown', auth, requireAdmin, async (req, res) => {
  try {
    const ownerName = req.query.ownerName;
    const metric = req.query.metric;
    const day = req.query.day;
    if (!ownerName || !metric || !day) return res.status(400).json({ success: false, error: 'ownerName, metric, day sao obrigatorios' });
    const { fromDt, toDt } = brRangeToUtc(day, day);
    let rows = [];
    if (metric === 'leads_recebidos_dia') {
      [rows] = await pool.query('SELECT d.id AS dealId, COALESCE(p.name, d.title) AS title, d.value AS value, d.add_date AS date FROM deals d LEFT JOIN patients p ON p.id = d.patient_id WHERE d.pipeline_id = 1 AND d.owner_name = ? AND d.add_date BETWEEN ? AND ? ORDER BY d.add_date DESC', [ownerName, fromDt, toDt]);
    } else if (metric === 'ligacoes_efetuadas_dia') {
      rows = await ddDedupedActivityItems(pool, ownerName, 'Chamada Realizada', fromDt, toDt);
    } else if (metric === 'ligacoes_atendidas_dia') {
      rows = await ddDedupedActivityItems(pool, ownerName, 'Ligação Atendida', fromDt, toDt);
    } else if (metric === 'agendamentos_dia') {
      rows = await ddDedupedActivityItems(pool, ownerName, 'Agendou', fromDt, toDt);
    } else if (metric === 'comparecimentos_dia') {
      rows = await ddDedupedActivityItems(pool, ownerName, 'Compareceu', fromDt, toDt);
    } else if (metric === 'oportunidades_dia') {
      rows = await ddDedupedBudgetItems(pool, ownerName, fromDt, toDt);
    } else if (metric === 'fechamentos_dia') {
      [rows] = await pool.query("SELECT d.id AS dealId, COALESCE(p.name, d.title) AS title, d.value AS value, d.won_date AS date FROM deals d LEFT JOIN patients p ON p.id = d.patient_id WHERE d.pipeline_id = 1 AND d.owner_name = ? AND d.status = 'won' AND d.won_date BETWEEN ? AND ? ORDER BY d.won_date DESC", [ownerName, fromDt, toDt]);
    } else {
      return res.status(400).json({ success: false, error: 'metric invalido' });
    }
    res.json({ success: true, rows });
  } catch (e) { console.error('sdr-daily drilldown error', e); res.status(500).json({ success: false, error: 'Erro interno' }); }
});

const QUALIFIED_STAGE_ID = 9;
function categorizeMessages(stat) {
  if (!stat) return 'sem_mensagem';
  var total = Number(stat.total_messages || 0);
  var inbound = Number(stat.inbound_count || 0);
  if (inbound > 0) return 'respondeu';
  if (total > 0) return 'nunca_respondeu';
  return 'sem_mensagem';
}
app.get('/api/crm/ui/dashboard/mktpago', auth, requireAdmin, async (req, res) => {
  try {
    const from = req.query.from;
    const to = req.query.to;
    if (!from || !to) return res.status(400).json({ success: false, error: 'from e to sao obrigatorios' });
    const { fromDt, toDt } = brRangeToUtc(from, to);
    const [deals] = await pool.query(
      "SELECT d.id, d.lead_score, d.status, d.value, " +
      "COALESCE(NULLIF(d.ad_name,''), NULLIF(d.criativo,''), 'Sem criativo') AS criativo, " +
      "COALESCE(NULLIF(d.ad_campaign_name,''), NULLIF(d.campanha,''), 'Sem campanha') AS campanha, " +
      "(EXISTS(SELECT 1 FROM stage_history sh WHERE sh.deal_id = d.id AND sh.to_stage_id = ?) OR d.stage_id = ?) AS qualified " +
      "FROM deals d WHERE d.pipeline_id = 1 AND CONVERT_TZ(d.add_date, '+00:00', '-03:00') BETWEEN ? AND ? AND (d.campanha IS NULL OR LOWER(TRIM(d.campanha)) <> 'ja e paciente')",
      [QUALIFIED_STAGE_ID, QUALIFIED_STAGE_ID, fromDt, toDt]
    );
    if (!deals.length) return res.json({ success: true, from, to, rows: [] });
    const dealIds = deals.map(function(d) { return d.id; });
    const [msgStats] = await pool.query(
      "SELECT deal_id, COUNT(*) AS total_messages, " +
      "SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(raw_payload,'$.from_me')) = 'false' THEN 1 ELSE 0 END) AS inbound_count, " +
      "MAX(received_at) AS last_message_at " +
      "FROM tintim_webhook_log WHERE event_type = 'message.create' AND deal_id IN (?) GROUP BY deal_id",
      [dealIds]
    );
    const statsByDeal = {};
    msgStats.forEach(function(s) { statsByDeal[s.deal_id] = s; });
    const now = Date.now();
    const groups = {};
    deals.forEach(function(d) {
      const key = d.criativo + '|||' + d.campanha;
      if (!groups[key]) groups[key] = { criativo: d.criativo, campanha: d.campanha, leads: 0, responded: 0, neverResponded: 0, respondedThenStopped: 0, qualified: 0, scoreSum: 0, scoreCount: 0, noScore: 0, wonCount: 0, wonValue: 0 };
      const g = groups[key];
      g.leads += 1;
      const stat = statsByDeal[d.id];
      const cat = categorizeMessages(stat);
      if (cat === 'respondeu') {
        g.responded += 1;
        const lastMs = stat.last_message_at ? new Date(stat.last_message_at).getTime() : now;
        const daysSince = (now - lastMs) / (1000 * 60 * 60 * 24);
        if (daysSince > 7) g.respondedThenStopped += 1;
      } else if (cat === 'nunca_respondeu') {
        g.neverResponded += 1;
      }
      if (d.qualified) g.qualified += 1;
      if (d.status === 'won') { g.wonCount += 1; g.wonValue += Number(d.value || 0); }
      if (d.lead_score !== null && d.lead_score !== undefined) { g.scoreSum += Number(d.lead_score); g.scoreCount += 1; } else { g.noScore += 1; }
    });
    const rows = Object.keys(groups).map(function(k) {
      const g = groups[k];
      return {
        criativo: g.criativo, campanha: g.campanha, leads: g.leads, responded: g.responded,
        neverResponded: g.neverResponded, respondedThenStopped: g.respondedThenStopped,
        qualified: g.qualified, avgScore: g.scoreCount ? Number((g.scoreSum / g.scoreCount).toFixed(1)) : null,
        noScore: g.noScore, wonCount: g.wonCount, wonValue: Number((g.wonValue || 0).toFixed(2))
      };
    }).sort(function(a, b) { return b.leads - a.leads; });
    try {
      var statusInfo = await metaAdsService.getCampaignStatuses();
      var statusLabels = { PAUSED: 'Pausada', ARCHIVED: 'Arquivada', DELETED: 'Excluida', PENDING_REVIEW: 'Em analise', DISAPPROVED: 'Reprovada', WITH_ISSUES: 'Com problemas', CAMPAIGN_PAUSED: 'Pausada', ADSET_PAUSED: 'Pausada (conjunto)', IN_PROCESS: 'Em processamento', PENDING_BILLING_INFO: 'Pendente de cobranca' };
      rows.forEach(function(row) {
        var key = String(row.campanha || '').trim().toLowerCase();
        var st = statusInfo.map[key];
        if (st === undefined) {
          row.campaignStatus = statusInfo.anyFailure ? 'Status indisponivel' : 'Nao encontrada';
        } else if (st === 'ACTIVE') {
          row.campaignStatus = 'Ativa';
        } else {
          row.campaignStatus = statusLabels[st] || st || 'Status indisponivel';
        }
      });
    } catch (e) {
      console.error('mktpago campaign status error', e.message);
      rows.forEach(function(row) { row.campaignStatus = 'Status indisponivel'; });
    }
    res.json({ success: true, from, to, rows });
  } catch (e) { console.error('mktpago error', e); res.status(500).json({ success: false, error: 'Erro interno' }); }
});
app.get('/api/crm/ui/dashboard/mktpago/drilldown', auth, requireAdmin, async (req, res) => {
  try {
    const from = req.query.from;
    const to = req.query.to;
    const criativo = req.query.criativo;
    const campanha = req.query.campanha;
    const metric = req.query.metric;
    if (!from || !to || !criativo || !campanha || !metric) return res.status(400).json({ success: false, error: 'parametros obrigatorios ausentes' });
    const { fromDt, toDt } = brRangeToUtc(from, to);
    const [deals] = await pool.query(
      "SELECT d.id, d.title, d.value, d.add_date, d.lead_score, p.name AS patient_name, " +
      "COALESCE(NULLIF(d.ad_name,''), NULLIF(d.criativo,''), 'Sem criativo') AS criativo, " +
      "COALESCE(NULLIF(d.ad_campaign_name,''), NULLIF(d.campanha,''), 'Sem campanha') AS campanha, " +
      "(EXISTS(SELECT 1 FROM stage_history sh WHERE sh.deal_id = d.id AND sh.to_stage_id = ?) OR d.stage_id = ?) AS qualified " +
      "FROM deals d LEFT JOIN patients p ON p.id = d.patient_id " +
      "WHERE d.pipeline_id = 1 AND CONVERT_TZ(d.add_date, '+00:00', '-03:00') BETWEEN ? AND ? AND " +
      "COALESCE(NULLIF(d.ad_name,''), NULLIF(d.criativo,''), 'Sem criativo') = ? AND " +
      "COALESCE(NULLIF(d.ad_campaign_name,''), NULLIF(d.campanha,''), 'Sem campanha') = ?",
      [QUALIFIED_STAGE_ID, QUALIFIED_STAGE_ID, fromDt, toDt, criativo, campanha]
    );
    const dealIds = deals.map(function(d) { return d.id; });
    let statsByDeal = {};
    if (dealIds.length) {
      const [msgStats] = await pool.query(
        "SELECT deal_id, COUNT(*) AS total_messages, " +
        "SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(raw_payload,'$.from_me')) = 'false' THEN 1 ELSE 0 END) AS inbound_count, " +
        "MAX(received_at) AS last_message_at " +
        "FROM tintim_webhook_log WHERE event_type = 'message.create' AND deal_id IN (?) GROUP BY deal_id",
        [dealIds]
      );
      msgStats.forEach(function(s) { statsByDeal[s.deal_id] = s; });
    }
    const now = Date.now();
    const filtered = deals.filter(function(d) {
      if (metric === 'leads') return true;
      if (metric === 'qualified') return !!d.qualified;
      if (metric === 'noScore') return d.lead_score === null || d.lead_score === undefined;
      const stat = statsByDeal[d.id];
      const cat = categorizeMessages(stat);
      if (metric === 'responded') return cat === 'respondeu';
      if (metric === 'neverResponded') return cat === 'nunca_respondeu';
      if (metric === 'respondedThenStopped') {
        if (cat !== 'respondeu') return false;
        const lastMs = stat.last_message_at ? new Date(stat.last_message_at).getTime() : now;
        return (now - lastMs) / (1000 * 60 * 60 * 24) > 7;
      }
      return false;
    });
    const rows = filtered.map(function(d) {
      return { dealId: d.id, title: d.patient_name || d.title, value: d.value, date: d.add_date, leadScore: d.lead_score };
    });
    res.json({ success: true, rows });
  } catch (e) { console.error('mktpago drilldown error', e); res.status(500).json({ success: false, error: 'Erro interno' }); }
});

app.get('/api/crm/ui/dashboard/professionals', auth, requireAdmin, async (req, res) => {
  try {
    const now = new Date()
    const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10)
    const to = req.query.to || new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10)
    const { fromDt, toDt } = brRangeToUtc(from, to)
    const [rows] = await pool.query(
      'SELECT p.id, p.name, ' +
      'SUM(CASE WHEN d.add_date BETWEEN ? AND ? THEN 1 ELSE 0 END) AS negocios, ' +
      'SUM(CASE WHEN d.status="won" AND d.won_date BETWEEN ? AND ? THEN 1 ELSE 0 END) AS vendas, ' +
      'COALESCE(SUM(CASE WHEN d.status="won" AND d.won_date BETWEEN ? AND ? THEN d.value ELSE 0 END),0) AS receita ' +
      'FROM professionals p ' +
      'LEFT JOIN deals d ON d.professional_id = p.id ' +
      'WHERE p.active = 1 ' +
      'GROUP BY p.id, p.name ORDER BY receita DESC',
      [fromDt, toDt, fromDt, toDt, fromDt, toDt]
    )
    res.json({ success: true, from, to, rows })
  } catch (e) { console.error('dashboard professionals error', e); res.status(500).json({ success: false, error: 'Erro interno' }) }
})

app.get('/api/crm/ui/dashboard/campaigns', auth, requireAdmin, async (req, res) => {
  try {
    const now = new Date()
    const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10)
    const to = req.query.to || new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10)
    const { fromDt, toDt } = brRangeToUtc(from, to)
    const [rows] = await pool.query(
      'SELECT COALESCE(NULLIF(campanha,""), "(sem campanha)") AS campanha, ' +
        'SUM(CASE WHEN add_date BETWEEN ? AND ? THEN 1 ELSE 0 END) AS leads, ' +
        'SUM(CASE WHEN status="won" AND won_date BETWEEN ? AND ? THEN 1 ELSE 0 END) AS vendas, ' +
        'COALESCE(SUM(CASE WHEN status="won" AND won_date BETWEEN ? AND ? THEN value ELSE 0 END),0) AS receita ' +
        'FROM deals WHERE pipeline_id = 1 AND (campanha IS NULL OR LOWER(TRIM(campanha)) <> "ja e paciente") AND (add_date BETWEEN ? AND ? OR (status="won" AND won_date BETWEEN ? AND ?)) ' +
        'GROUP BY COALESCE(NULLIF(campanha,""), "(sem campanha)") ORDER BY leads DESC LIMIT 30',
      [fromDt, toDt, fromDt, toDt, fromDt, toDt, fromDt, toDt, fromDt, toDt]
    )
    res.json({ success: true, from, to, rows })
  } catch (e) { console.error('dashboard campaigns error', e); res.status(500).json({ success: false, error: 'Erro interno' }) }
})

app.get('/api/crm/ui/dashboard/creatives', auth, requireAdmin, async (req, res) => {
  try {
    const now = new Date()
    const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10)
    const to = req.query.to || new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10)
    const { fromDt, toDt } = brRangeToUtc(from, to)
    const [rows] = await pool.query(
      'SELECT COALESCE(NULLIF(ad_name,""), NULLIF(criativo,""), NULLIF(palavra_chave,""), "(sem criativo)") AS criativo, ' +
        'COALESCE(NULLIF(MAX(campanha),""), "(sem campanha)") AS campanha, ' +
        'MAX(CASE WHEN criativo REGEXP "^[0-9]{10,}$" THEN criativo END) AS ad_id_raw, ' +
        'SUM(CASE WHEN add_date BETWEEN ? AND ? THEN 1 ELSE 0 END) AS leads, ' +
        'SUM(CASE WHEN status="won" AND won_date BETWEEN ? AND ? THEN 1 ELSE 0 END) AS vendas, ' +
        'COALESCE(SUM(CASE WHEN status="won" AND won_date BETWEEN ? AND ? THEN value ELSE 0 END),0) AS receita ' +
        'FROM deals WHERE pipeline_id = 1 AND (campanha IS NULL OR LOWER(TRIM(campanha)) <> "ja e paciente") AND (add_date BETWEEN ? AND ? OR (status="won" AND won_date BETWEEN ? AND ?)) ' +
        'GROUP BY COALESCE(NULLIF(ad_name,""), NULLIF(criativo,""), NULLIF(palavra_chave,""), "(sem criativo)") ORDER BY leads DESC LIMIT 30',
      [fromDt, toDt, fromDt, toDt, fromDt, toDt, fromDt, toDt, fromDt, toDt]
    )
    const numericIds = Array.from(new Set(rows.map(function(r){ return r.ad_id_raw }).filter(Boolean)))
    var nameMap = {}
    if (numericIds.length) { try { nameMap = await metaAdsService.resolveAdNames(numericIds) } catch (e) { console.error('dashboard creatives resolveAdNames error', e.message) } }
    const rowsOut = rows.map(function(r) {
      var adId = r.ad_id_raw
      var resolvedName = adId && nameMap[adId] ? nameMap[adId] : null
      return { criativo: r.criativo, criativoDisplay: resolvedName || r.criativo, campanha: r.campanha, leads: r.leads, vendas: r.vendas, receita: r.receita, link: adId ? ('https://business.facebook.com/adsmanager/manage/ads?selected_ad_ids=' + adId) : null }
    })
    res.json({ success: true, from, to, rows: rowsOut })
  } catch (e) { console.error('dashboard creatives error', e); res.status(500).json({ success: false, error: 'Erro interno' }) }
})

app.get('/api/crm/ui/dashboard/agenda', auth, requireAdmin, async (req, res) => {
  try {
    const __hojeRange = brRangeToUtc(brTodayStr(), brTodayStr()); const [[hoje]] = await pool.query('SELECT COUNT(*) AS c FROM activities WHERE done = 0 AND due_at BETWEEN ? AND ?', [__hojeRange.fromDt, __hojeRange.toDt])
    const [[atrasadas]] = await pool.query('SELECT COUNT(*) AS c FROM activities WHERE done = 0 AND due_at < NOW()')
    const [[proximos7]] = await pool.query('SELECT COUNT(*) AS c FROM activities WHERE done = 0 AND due_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)')
    const [porTipo] = await pool.query('SELECT type, COUNT(*) AS c FROM activities WHERE done = 0 AND due_at IS NOT NULL AND due_at >= NOW() GROUP BY type ORDER BY c DESC')
    const [proximas] = await pool.query('SELECT id, deal_id, patient_id, type, subject, due_at, person_name, deal_title, user_name FROM activities WHERE done = 0 AND due_at IS NOT NULL ORDER BY due_at ASC LIMIT 20')
    res.json({ success: true, hoje: hoje.c, atrasadas: atrasadas.c, proximos7: proximos7.c, porTipo, proximas })
  } catch (e) { console.error('dashboard agenda error', e); res.status(500).json({ success: false, error: 'Erro interno' }) }
})

app.get('/api/crm/ui/dashboard/tintim', auth, requireAdmin, async (req, res) => {
  try {
    const now = new Date()
    const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10)
    const to = req.query.to || new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10)
    const { fromDt, toDt } = brRangeToUtc(from, to)
    const [[total]] = await pool.query('SELECT COUNT(*) AS c FROM tintim_webhook_log WHERE received_at BETWEEN ? AND ?', [fromDt, toDt])
    const [[matched]] = await pool.query('SELECT COUNT(*) AS c FROM tintim_webhook_log WHERE received_at BETWEEN ? AND ? AND deal_id IS NOT NULL', [fromDt, toDt])
    const [porTipo] = await pool.query('SELECT event_type, COUNT(*) AS c FROM tintim_webhook_log WHERE received_at BETWEEN ? AND ? GROUP BY event_type ORDER BY c DESC', [fromDt, toDt])
    const [recentes] = await pool.query('SELECT id, phone, event_type, deal_id, received_at FROM tintim_webhook_log WHERE received_at BETWEEN ? AND ? ORDER BY received_at DESC LIMIT 20', [fromDt, toDt])
    res.json({ success: true, from, to, total: total.c, matched: matched.c, unmatched: total.c - matched.c, matchRate: total.c ? (matched.c/total.c*100) : 0, porTipo, recentes })
  } catch (e) { console.error('dashboard tintim error', e); res.status(500).json({ success: false, error: 'Erro interno' }) }
})


  // Auditoria Tintim: leads que existem no Tintim (via webhook log) mas nao tem patient no CRM
  app.get('/api/crm/ui/dashboard/tintim/leads-sem-crm', auth, requireAdmin, async (req, res) => {
    try {
      const [leadRows] = await pool.query(
        "SELECT phone, MAX(received_at) last_seen, MIN(received_at) first_seen FROM tintim_webhook_log WHERE event_type = 'lead.create' GROUP BY phone ORDER BY last_seen DESC"
      );
      const [patientRows] = await pool.query('SELECT phone FROM patients WHERE phone IS NOT NULL');
      const patientDigits = new Set(patientRows.map(p => String(p.phone).replace(/\D/g, '').slice(-8)));
      const semCrm = leadRows.filter(l => !patientDigits.has(String(l.phone).replace(/\D/g, '').slice(-8)));
      const out = [];
      for (const l of semCrm.slice(0, 100)) {
        const [[log]] = await pool.query(
          "SELECT raw_payload FROM tintim_webhook_log WHERE phone = ? AND event_type = 'lead.create' ORDER BY received_at DESC LIMIT 1",
          [l.phone]
        );
        let name = null, source = null;
        try { const pl = JSON.parse(log.raw_payload); name = pl.name || null; source = pl.source || null; } catch (e) {}
        out.push({ phone: l.phone, name, source, firstSeen: l.first_seen, lastSeen: l.last_seen });
      }
      res.json({ success: true, total: semCrm.length, leads: out });
    } catch (e) {
      console.error('leads-sem-crm error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  // Auditoria Tintim: negocios no CRM sem nenhum rastreio confirmado (nem tintim_source_raw, nem historico de webhook)
  app.get('/api/crm/ui/dashboard/tintim/sem-rastreio', auth, requireAdmin, async (req, res) => {
    try {
      const [phoneRows] = await pool.query('SELECT DISTINCT phone FROM tintim_webhook_log');
      const trackedDigits = new Set(phoneRows.map(r => String(r.phone).replace(/\D/g, '').slice(-8)));
      const [deals] = await pool.query(
        `SELECT d.id, d.title, d.origem, d.plataforma, d.created_at, p.name pname, p.phone
         FROM deals d JOIN patients p ON p.id = d.patient_id
         WHERE (d.tintim_source_raw IS NULL OR d.tintim_source_raw = '')
         ORDER BY d.created_at DESC LIMIT 500`
      );
      const semRastreio = deals.filter(d => !trackedDigits.has(String(d.phone || '').replace(/\D/g, '').slice(-8)));
      res.json({ success: true, total: semRastreio.length, deals: semRastreio.slice(0, 100) });
    } catch (e) {
      console.error('sem-rastreio error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

app.get('/api/crm/ui/dashboard/crmintel', auth, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const to = req.query.to || new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
    const { fromDt, toDt } = brRangeToUtc(from, to);
    const [funil] = await pool.query('SELECT s.label, s.sort, SUM(CASE WHEN d.id IS NULL THEN 0 WHEN (d.count_as_lead_entry = 0 AND s.sort = (SELECT MIN(sort) FROM stages WHERE pipeline_id = 1 AND active = 1)) THEN 0 ELSE 1 END) AS c FROM stages s LEFT JOIN deals d ON d.stage_id = s.id AND d.status = "open" AND CONVERT_TZ(d.add_date,\'+00:00\',\'-03:00\') BETWEEN ? AND ? WHERE s.pipeline_id = 1 AND s.active = 1 GROUP BY s.id, s.label, s.sort ORDER BY s.sort', [fromDt, toDt])
    const [rotting] = await pool.query('SELECT d.id, d.title, s.label AS stage, d.stage_entered_at, DATEDIFF(NOW(), d.stage_entered_at) AS dias FROM deals d JOIN stages s ON s.id = d.stage_id WHERE d.status = "open" AND d.pipeline_id = 1 AND d.stage_entered_at IS NOT NULL AND CONVERT_TZ(d.add_date,\'+00:00\',\'-03:00\') BETWEEN ? AND ? ORDER BY d.stage_entered_at ASC LIMIT 15', [fromDt, toDt])
    const [perdas] = await pool.query('SELECT COALESCE(NULLIF(loss_reason,""), "(sem motivo)") AS motivo, COUNT(*) AS c FROM deals WHERE status = "lost" AND pipeline_id = 1 AND CONVERT_TZ(lost_date,\'+00:00\',\'-03:00\') BETWEEN ? AND ? GROUP BY loss_reason ORDER BY c DESC LIMIT 10', [fromDt, toDt])
    res.json({ success: true, from, to, funil, rotting, perdas })
  } catch (e) { console.error('dashboard crmintel error', e); res.status(500).json({ success: false, error: 'Erro interno' }) }
})


  // Aba Meta Ads - Graph API direta, cruzado com deals do proprio CRM (nao Pipedrive)
  app.get('/api/crm/ui/dashboard/metaads', auth, requireAdmin, async (req, res) => {
    try {
      const to = req.query.to || new Date().toISOString().slice(0, 10);
      const from = req.query.from || (function(){
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().slice(0, 10);
      })();
    const { fromDt, toDt } = brRangeToUtc(from, to);
      const insights = await metaAdsService.getInsights(from, to);
      const byCampaign = {};
      insights.forEach(function(r) {
        const k = r.campaign_name || 'Sem nome';
        if (!byCampaign[k]) byCampaign[k] = { campaign_name: k, spend: 0, impressions: 0, clicks: 0 };
        byCampaign[k].spend += r.spend;
        byCampaign[k].impressions += r.impressions;
        byCampaign[k].clicks += r.clicks;
      });
      const [dealRows] = await pool.query(
        "SELECT campanha, " +
      "SUM(CASE WHEN CONVERT_TZ(add_date,'+00:00','-03:00') BETWEEN ? AND ? THEN 1 ELSE 0 END) leads, " +
      "SUM(CASE WHEN status='won' AND CONVERT_TZ(won_date,'+00:00','-03:00') BETWEEN ? AND ? THEN 1 ELSE 0 END) vendas, " +
      "SUM(CASE WHEN status='won' AND CONVERT_TZ(won_date,'+00:00','-03:00') BETWEEN ? AND ? THEN value ELSE 0 END) receita " +
      "FROM deals WHERE pipeline_id=1 AND (tintim_source_raw='Meta Ads' OR (tintim_source_raw IS NULL AND (origem LIKE '%Instagram%' OR plataforma LIKE '%Instagram%' OR ((origem LIKE '%Meta%' OR origem LIKE '%Facebook%' OR plataforma LIKE '%Meta%' OR plataforma LIKE '%Facebook%') AND origem NOT LIKE '%rganico%' AND plataforma NOT LIKE '%rganico%')))) AND (CONVERT_TZ(add_date,'+00:00','-03:00') BETWEEN ? AND ? OR (status='won' AND CONVERT_TZ(won_date,'+00:00','-03:00') BETWEEN ? AND ?)) GROUP BY campanha",
      [fromDt, toDt, fromDt, toDt, fromDt, toDt, fromDt, toDt, fromDt, toDt]
      );
      const dealMap = {};
      dealRows.forEach(function(r) { dealMap[r.campanha || 'Sem campanha'] = r; });
      const campaignNames = Object.keys(byCampaign);
      Object.keys(dealMap).forEach(function(k) { if (campaignNames.indexOf(k) === -1) campaignNames.push(k); });
      const merged = campaignNames.map(function(name) {
        const c2 = byCampaign[name] || { campaign_name: name, spend: 0, impressions: 0, clicks: 0 };
        const d = dealMap[name] || { leads: 0, vendas: 0, receita: 0 };
        const leads = Number(d.leads || 0);
        const vendas = Number(d.vendas || 0);
        const receita = Number(d.receita || 0);
        return {
          campanha: name,
          spend: c2.spend || 0,
          impressions: c2.impressions || 0,
          clicks: c2.clicks || 0,
          leads: leads,
          vendas: vendas,
          receita: receita,
          cpl: leads ? (c2.spend || 0) / leads : null,
          roas: (c2.spend || 0) ? receita / (c2.spend || 0) : null
        };
      }).sort(function(a, b) { return (b.spend || 0) - (a.spend || 0); });
      const totalSpend = merged.reduce(function(s, r) { return s + (r.spend || 0); }, 0);
      const totalLeads = merged.reduce(function(s, r) { return s + (r.leads || 0); }, 0);
      const totalVendas = merged.reduce(function(s, r) { return s + (r.vendas || 0); }, 0);
      const totalReceita = merged.reduce(function(s, r) { return s + (r.receita || 0); }, 0);
      res.json({ success: true, from: from, to: to, totalSpend: totalSpend, totalLeads: totalLeads, totalVendas: totalVendas, totalReceita: totalReceita, campanhas: merged });
    } catch (e) {
      console.error('[dashboard/metaads] erro', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Aba Google Ads - cache local alimentado pelo Google Ads Script (igual Command Center), cruzado com deals do CRM
  // Aba Campanhas - drilldown de negocios por campanha
  app.get('/api/crm/ui/dashboard/campaigns/drilldown', auth, requireAdmin, async (req, res) => {
    try {
      const campanha = String(req.query.campanha || '');
      const metric = String(req.query.metric || 'leads');
      const to = req.query.to || new Date().toISOString().slice(0, 10);
      const from = req.query.from || to;
      const isSemCampanha = campanha === '(sem campanha)' || campanha === '';
      const isVendaMetric = (metric === 'vendas' || metric === 'receita');
      const dateField = isVendaMetric ? 'won_date' : 'add_date';
      const { fromDt, toDt } = brRangeToUtc(from, to);
    const params = [fromDt, toDt];
      let sql = "SELECT id, title, value, status, add_date, won_date FROM deals WHERE pipeline_id=1 AND " + dateField + " BETWEEN ? AND ?";
      if (isSemCampanha) { sql += " AND (campanha IS NULL OR campanha = '')"; } else { sql += ' AND campanha = ?'; params.push(campanha); }
      if (isVendaMetric) { sql += " AND status='won'"; }
      sql += ' ORDER BY ' + dateField + ' DESC LIMIT 200';
      const [rows] = await pool.query(sql, params);
      res.json({ success: true, deals: rows });
    } catch (e) {
      console.error('campaigns drilldown error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  // Aba Criativos - drilldown de negocios por criativo/palavra-chave
  app.get('/api/crm/ui/dashboard/creatives/drilldown', auth, requireAdmin, async (req, res) => {
    try {
      const criativo = String(req.query.criativo || '');
      const metric = String(req.query.metric || 'leads');
      const to = req.query.to || new Date().toISOString().slice(0, 10);
      const from = req.query.from || to;
      const isSemCriativo = criativo === '(sem criativo)' || criativo === '';
      const isVendaMetric = (metric === 'vendas' || metric === 'receita');
      const dateField = isVendaMetric ? 'won_date' : 'add_date';
      const { fromDt, toDt } = brRangeToUtc(from, to);
    const params = [fromDt, toDt];
      let sql = "SELECT id, title, value, status, add_date, won_date FROM deals WHERE pipeline_id=1 AND " + dateField + " BETWEEN ? AND ?";
      if (isSemCriativo) {
        sql += " AND (criativo IS NULL OR criativo = '') AND (palavra_chave IS NULL OR palavra_chave = '')";
      } else {
        sql += " AND (criativo = ? OR (COALESCE(criativo,'') = '' AND palavra_chave = ?))";
        params.push(criativo, criativo);
      }
      if (isVendaMetric) { sql += " AND status='won'"; }
      sql += ' ORDER BY ' + dateField + ' DESC LIMIT 200';
      const [rows] = await pool.query(sql, params);
      res.json({ success: true, deals: rows });
    } catch (e) {
      console.error('creatives drilldown error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  // Aba Meta Ads - drilldown de negocios por campanha (fonte Meta/Instagram/Facebook)
  app.get('/api/crm/ui/dashboard/metaads/drilldown', auth, requireAdmin, async (req, res) => {
    try {
      const campanha = String(req.query.campanha || '');
      const metric = String(req.query.metric || 'leads');
      const to = req.query.to || new Date().toISOString().slice(0, 10);
      const from = req.query.from || to;
      const isSemCampanha = campanha === 'Sem campanha' || campanha === '';
      const isVendaMetric = (metric === 'vendas' || metric === 'receita');
      const dateField = isVendaMetric ? 'won_date' : 'add_date';
      const { fromDt, toDt } = brRangeToUtc(from, to);
    const params = [fromDt, toDt];
      let sql = "SELECT id, title, value, status, add_date, won_date FROM deals WHERE pipeline_id=1 AND (origem LIKE '%Instagram%' OR plataforma LIKE '%Instagram%' OR ((origem LIKE '%Meta%' OR origem LIKE '%Facebook%' OR plataforma LIKE '%Meta%' OR plataforma LIKE '%Facebook%') AND origem NOT LIKE '%rganico%' AND plataforma NOT LIKE '%rganico%')) AND " + dateField + " BETWEEN ? AND ?";
      if (isSemCampanha) { sql += " AND (campanha IS NULL OR campanha = '')"; } else { sql += ' AND campanha = ?'; params.push(campanha); }
      if (isVendaMetric) { sql += " AND status='won'"; }
      sql += ' ORDER BY ' + dateField + ' DESC LIMIT 200';
      const [rows] = await pool.query(sql, params);
      res.json({ success: true, deals: rows });
    } catch (e) {
      console.error('metaads drilldown error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  app.get('/api/crm/ui/dashboard/googleads/drilldown', auth, requireAdmin, async (req, res) => {
  try {
    const campanha = String(req.query.campanha || '');
    const metric = String(req.query.metric || 'leads');
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const from = req.query.from || to;
    const isSemCampanha = campanha === 'Sem campanha' || campanha === '';
    const isVendaMetric = (metric === 'vendas' || metric === 'receita');
    const dateField = isVendaMetric ? 'won_date' : 'add_date';
    const { fromDt, toDt } = brRangeToUtc(from, to);
    const params = [fromDt, toDt];
    let sql = "SELECT id, title, value, status, add_date, won_date FROM deals WHERE pipeline_id=1 AND (tintim_source_raw='Google Ads' OR (tintim_source_raw IS NULL AND (origem LIKE '%Google%' OR plataforma LIKE '%Google%'))) AND " + dateField + " BETWEEN ? AND ?";
    if (isSemCampanha) { sql += " AND (campanha IS NULL OR campanha = '')"; } else { sql += ' AND campanha = ?'; params.push(campanha); }
    if (isVendaMetric) { sql += " AND status='won'"; }
    sql += ' ORDER BY ' + dateField + ' DESC LIMIT 200';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, deals: rows });
  } catch (e) {
    console.error('googleads drilldown error', e);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

  // Aba Executivo - drilldown de leads (negocios criados no periodo, card LEADS)
  app.get('/api/crm/ui/dashboard/leads/drilldown', auth, requireAdmin, async (req, res) => {
    try {
      const now = new Date();
      const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const to = req.query.to || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const { fromDt, toDt } = brRangeToUtc(from, to);
      const [rows] = await pool.query(
        "SELECT d.id AS dealId, COALESCE(p.name, d.title) AS patientName, d.origem AS origem, d.owner_name AS ownerName, " +
        "DATE_FORMAT(CONVERT_TZ(d.add_date,'+00:00','-03:00'), '%d/%m/%Y %H:%i') AS addDateBr " +
        "FROM deals d LEFT JOIN patients p ON p.id = d.patient_id " +
        "WHERE d.pipeline_id = 1 AND d.add_date BETWEEN ? AND ? AND (d.campanha IS NULL OR LOWER(TRIM(d.campanha)) <> 'ja e paciente') " +
        "ORDER BY d.add_date DESC",
        [fromDt, toDt]
      );
      res.json({ success: true, rows });
    } catch (e) {
      console.error('leads drilldown error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  // Aba Executivo - drilldown de qualificados (negocios que atingiram estagio qualificado no periodo, card QUALIFICADOS)
  app.get('/api/crm/ui/dashboard/qualificados/drilldown', auth, requireAdmin, async (req, res) => {
    try {
      const now = new Date();
      const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const to = req.query.to || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const { fromDt, toDt } = brRangeToUtc(from, to);
      const [rows] = await pool.query(
        "SELECT d.id AS dealId, COALESCE(p.name, d.title) AS patientName, d.origem AS origem, d.owner_name AS ownerName, " +
        "DATE_FORMAT(CONVERT_TZ(d.add_date,'+00:00','-03:00'), '%d/%m/%Y %H:%i') AS addDateBr " +
        "FROM deals d LEFT JOIN patients p ON p.id = d.patient_id JOIN stages s ON s.id = d.stage_id " +
        "WHERE d.pipeline_id = 1 AND s.sort >= 9 AND d.add_date BETWEEN ? AND ? AND (d.campanha IS NULL OR LOWER(TRIM(d.campanha)) <> 'ja e paciente') " +
        "ORDER BY d.add_date DESC",
        [fromDt, toDt]
      );
      res.json({ success: true, rows });
    } catch (e) {
      console.error('qualificados drilldown error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  // Aba Executivo - drilldown de receita (negocios ganhos que compoem a receita do periodo, card RECEITA)
  app.get('/api/crm/ui/dashboard/orcamento/drilldown', auth, requireAdmin, async (req, res) => {
    try {
      const now = new Date();
      const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const to = req.query.to || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const { fromDt, toDt } = brRangeToUtc(from, to);
      const [rows] = await pool.query(
        "SELECT a.deal_id AS dealId, COALESCE(p.name, d.title) AS patientName, d.origem AS origem, d.owner_name AS ownerName, a.amount AS value, " +
        "DATE_FORMAT(CONVERT_TZ(a.created_at,'+00:00','-03:00'), '%d/%m/%Y %H:%i') AS addDateBr " +
        "FROM activities a LEFT JOIN deals d ON d.id = a.deal_id LEFT JOIN patients p ON p.id = a.patient_id " +
        "WHERE a.type = \"Orcamento Gerado\" AND a.created_at BETWEEN ? AND ? " +
        "ORDER BY a.created_at DESC",
        [fromDt, toDt]
      );
      res.json({ success: true, rows });
    } catch (e) {
      console.error('orcamento drilldown error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  // Aba Executivo - drilldown de consultas agendadas (activities tipo Agendou no periodo, card CONSULTAS AGENDADAS)
  app.get('/api/crm/ui/dashboard/agendadas/drilldown', auth, requireAdmin, async (req, res) => {
    try {
      const now = new Date();
      const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const to = req.query.to || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const { fromDt, toDt } = brRangeToUtc(from, to);
      const [rows] = await pool.query(
        "SELECT a.id AS activityId, COALESCE(p.name, d.title) AS patientName, d.origem AS origem, u.name AS ownerName, " +
        "DATE_FORMAT(CONVERT_TZ(a.created_at,'+00:00','-03:00'), '%d/%m/%Y %H:%i') AS addDateBr " +
        "FROM activities a LEFT JOIN deals d ON d.id = a.deal_id LEFT JOIN patients p ON p.id = a.patient_id LEFT JOIN users u ON u.id = a.user_id " +
        "WHERE a.type = \"Agendou\" AND a.created_at BETWEEN ? AND ? " +
        "ORDER BY a.created_at DESC",
        [fromDt, toDt]
      );
      res.json({ success: true, rows });
    } catch (e) {
      console.error('agendadas drilldown error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  // Aba Executivo - drilldown de consultas comparecidas (activities tipo Compareceu no periodo, card CONSULTAS COMPARECIDAS)
  app.get('/api/crm/ui/dashboard/comparecidas/drilldown', auth, requireAdmin, async (req, res) => {
    try {
      const now = new Date();
      const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const to = req.query.to || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const { fromDt, toDt } = brRangeToUtc(from, to);
      const [rows] = await pool.query(
        "SELECT a.id AS activityId, COALESCE(p.name, d.title) AS patientName, d.origem AS origem, u.name AS ownerName, " +
        "DATE_FORMAT(CONVERT_TZ(a.created_at,'+00:00','-03:00'), '%d/%m/%Y %H:%i') AS addDateBr " +
        "FROM activities a LEFT JOIN deals d ON d.id = a.deal_id LEFT JOIN patients p ON p.id = a.patient_id LEFT JOIN users u ON u.id = a.user_id " +
        "WHERE a.type = \"Compareceu\" AND a.created_at BETWEEN ? AND ? " +
        "ORDER BY a.created_at DESC",
        [fromDt, toDt]
      );
      res.json({ success: true, rows });
    } catch (e) {
      console.error('comparecidas drilldown error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  // Aba Executivo - drilldown de faltas no periodo (activities tipo Faltou no periodo, card FALTARAM NO PERIODO)
  app.get('/api/crm/ui/dashboard/faltaram/drilldown', auth, requireAdmin, async (req, res) => {
    try {
      const now = new Date();
      const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const to = req.query.to || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const { fromDt, toDt } = brRangeToUtc(from, to);
      const [rows] = await pool.query(
        "SELECT a.id AS activityId, COALESCE(p.name, d.title) AS patientName, d.origem AS origem, u.name AS ownerName, " +
        "DATE_FORMAT(CONVERT_TZ(a.created_at,'+00:00','-03:00'), '%d/%m/%Y %H:%i') AS addDateBr " +
        "FROM activities a LEFT JOIN deals d ON d.id = a.deal_id LEFT JOIN patients p ON p.id = a.patient_id LEFT JOIN users u ON u.id = a.user_id " +
        "WHERE a.type = \"Faltou\" AND a.created_at BETWEEN ? AND ? " +
        "ORDER BY a.created_at DESC",
        [fromDt, toDt]
      );
      res.json({ success: true, rows });
    } catch (e) {
      console.error('faltaram drilldown error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

app.get('/api/crm/ui/dashboard/googleads', auth, requireAdmin, async (req, res) => {
    try {
      const to = req.query.to || new Date().toISOString().slice(0, 10);
      const from = req.query.from || (function(){
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().slice(0, 10);
      })();
    const { fromDt, toDt } = brRangeToUtc(from, to);
      const cache = googleAdsCacheReader.getCampaignsForRange(from, to);
      const [dealRows] = await pool.query(
        "SELECT campanha, " +
      "SUM(CASE WHEN CONVERT_TZ(add_date,'+00:00','-03:00') BETWEEN ? AND ? THEN 1 ELSE 0 END) leads, " +
      "SUM(CASE WHEN status='won' AND CONVERT_TZ(won_date,'+00:00','-03:00') BETWEEN ? AND ? THEN 1 ELSE 0 END) vendas, " +
      "SUM(CASE WHEN status='won' AND CONVERT_TZ(won_date,'+00:00','-03:00') BETWEEN ? AND ? THEN value ELSE 0 END) receita " +
      "FROM deals WHERE pipeline_id=1 AND (tintim_source_raw='Google Ads' OR (tintim_source_raw IS NULL AND (origem LIKE '%Google%' OR plataforma LIKE '%Google%'))) AND (CONVERT_TZ(add_date,'+00:00','-03:00') BETWEEN ? AND ? OR (status='won' AND CONVERT_TZ(won_date,'+00:00','-03:00') BETWEEN ? AND ?)) GROUP BY campanha",
      [fromDt, toDt, fromDt, toDt, fromDt, toDt, fromDt, toDt, fromDt, toDt]
      );
      const dealMap = {};
      dealRows.forEach(function(r) { dealMap[r.campanha || 'Sem campanha'] = r; });
      const cacheByName = {};
      (cache.campaigns || []).forEach(function(c2) { cacheByName[c2.campaign_name] = c2; });
      const allNames = (cache.campaigns || []).map(function(c2) { return c2.campaign_name; });
      Object.keys(dealMap).forEach(function(k) { if (allNames.indexOf(k) === -1) allNames.push(k); });
      const merged = allNames.map(function(name) {
        const c2 = cacheByName[name] || { campaign_name: name, status: null, cost: 0, impressions: 0, clicks: 0, conversions: 0 };
        const d = dealMap[name] || { leads: 0, vendas: 0, receita: 0 };
        const leads = Number(d.leads || 0);
        const vendas = Number(d.vendas || 0);
        const receita = Number(d.receita || 0);
        const cost = Number(c2.cost || 0);
        return {
          campanha: name,
          status: c2.status,
          spend: cost,
          impressions: Number(c2.impressions || 0),
          clicks: Number(c2.clicks || 0),
          conversions: Number(c2.conversions || 0),
          leads: leads,
          vendas: vendas,
          receita: receita,
          cpl: leads ? cost / leads : null,
          roas: cost ? receita / cost : null
        };
      }).sort(function(a, b) { return (b.spend || 0) - (a.spend || 0); });
      const totalSpend = merged.reduce(function(s, r) { return s + (r.spend || 0); }, 0);
      const totalLeads = merged.reduce(function(s, r) { return s + (r.leads || 0); }, 0);
      const totalVendas = merged.reduce(function(s, r) { return s + (r.vendas || 0); }, 0);
      const totalReceita = merged.reduce(function(s, r) { return s + (r.receita || 0); }, 0);
      res.json({ success: true, updatedAt: cache.updatedAt, from: from, to: to, totalSpend: totalSpend, totalLeads: totalLeads, totalVendas: totalVendas, totalReceita: totalReceita, campanhas: merged });
    } catch (e) {
      console.error('[dashboard/googleads] erro', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });



  function requireOwner(req, res) {
    if (false) {
      res.status(403).json({ success: false, error: 'Acesso restrito ao administrador principal' })
      return false
    }
    return true
  }

  app.get('/api/crm/ui/admin/users', auth, requireAdmin, async (req, res) => {
    if (!requireOwner(req, res)) return
    try {
      const [rows] = await pool.query('SELECT id, name, email, role, active, must_reset_password, created_at FROM users ORDER BY id')
      res.json({ success: true, users: rows })
    } catch (e) {
      console.error('admin users list error', e)
      res.status(500).json({ success: false, error: 'Erro interno' })
    }
  })

  app.post('/api/crm/ui/admin/users', auth, requireAdmin, async (req, res) => {
    if (!requireOwner(req, res)) return
    try {
      const { name, email, role, tempPassword } = req.body || {}
      if (!name || !email || !role) return res.status(400).json({ success: false, error: 'Informe nome, email e papel' })
      const validRoles = ['admin', 'sdr', 'closer', 'recepcao', 'marketing']
      if (!validRoles.includes(role)) return res.status(400).json({ success: false, error: 'Papel invalido' })
      const cleanEmail = String(email).toLowerCase().trim()
      const pass = tempPassword || '123'
      const hash = await bcrypt.hash(String(pass), 10)
      const [r] = await pool.query('INSERT INTO users (name, email, password_hash, role, active, must_reset_password) VALUES (?,?,?,?,1,1)', [name, cleanEmail, hash, role])
      res.json({ success: true, id: r.insertId, tempPassword: pass })
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, error: 'E-mail ja esta em uso' })
      console.error('admin users create error', e)
      res.status(500).json({ success: false, error: 'Erro interno' })
    }
  })

  app.patch('/api/crm/ui/admin/users/:id', auth, requireAdmin, async (req, res) => {
    if (!requireOwner(req, res)) return
    try {
      const id = parseInt(req.params.id)
      const { name, email, role, active } = req.body || {}
      const validRoles = ['admin', 'sdr', 'closer', 'recepcao', 'marketing']
      if (role !== undefined && !validRoles.includes(role)) return res.status(400).json({ success: false, error: 'Papel invalido' })
      const fields = []
      const vals = []
      if (name !== undefined) { fields.push('name = ?'); vals.push(name) }
      if (email !== undefined) { fields.push('email = ?'); vals.push(String(email).toLowerCase().trim()) }
      if (role !== undefined) { fields.push('role = ?'); vals.push(role) }
      if (active !== undefined) { fields.push('active = ?'); vals.push(active ? 1 : 0) }
      if (!fields.length) return res.status(400).json({ success: false, error: 'Nada para atualizar' })
      vals.push(id)
      await pool.query('UPDATE users SET ' + fields.join(', ') + ' WHERE id = ?', vals)
      res.json({ success: true })
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, error: 'E-mail ja esta em uso' })
      console.error('admin users update error', e)
      res.status(500).json({ success: false, error: 'Erro interno' })
    }
  })

  app.post('/api/crm/ui/admin/users/:id/reset-password', auth, requireAdmin, async (req, res) => {
    if (!requireOwner(req, res)) return
    try {
      const id = parseInt(req.params.id)
      const pass = (req.body && req.body.tempPassword) || '123'
      const hash = await bcrypt.hash(String(pass), 10)
      await pool.query('UPDATE users SET password_hash = ?, must_reset_password = 1 WHERE id = ?', [hash, id])
      res.json({ success: true, tempPassword: pass })
    } catch (e) {
      console.error('admin users reset-password error', e)
      res.status(500).json({ success: false, error: 'Erro interno' })
    }
  })

  app.delete('/api/crm/ui/admin/users/:id', auth, requireAdmin, async (req, res) => {
    if (!requireOwner(req, res)) return
    try {
      const id = parseInt(req.params.id)
      if (id === 1) return res.status(400).json({ success: false, error: 'Nao e possivel desativar o administrador principal' })
      await pool.query('UPDATE users SET active = 0 WHERE id = ?', [id])
      res.json({ success: true })
    } catch (e) {
      console.error('admin users deactivate error', e)
      res.status(500).json({ success: false, error: 'Erro interno' })
    }
  })

  app.get('/api/crm/ui/duplicates', auth, async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT p.phone, p.name AS patient_name, d.id AS deal_id, d.patient_id, d.title, d.owner_name,
                d.add_date, d.value, d.pipeline_id, d.stage_id, s.label AS stage_label
         FROM deals d
         JOIN patients p ON p.id = d.patient_id
         LEFT JOIN stages s ON s.id = d.stage_id
         WHERE d.status = 'open' AND p.phone IS NOT NULL AND p.phone <> ''
           AND p.phone IN (
             SELECT p2.phone FROM deals d2 JOIN patients p2 ON p2.id = d2.patient_id
             WHERE d2.status = 'open' AND p2.phone IS NOT NULL AND p2.phone <> ''
             GROUP BY p2.phone HAVING COUNT(*) > 1
           )
         ORDER BY p.phone, d.add_date DESC`
      );
      const clusters = {};
      for (const r of rows) {
        if (!clusters[r.phone]) clusters[r.phone] = { phone: r.phone, patientName: r.patient_name, deals: [] };
        clusters[r.phone].deals.push({
          id: r.deal_id, patientId: r.patient_id, title: r.title, owner: r.owner_name || 'Sem dono',
          addDate: r.add_date, value: r.value, pipelineId: r.pipeline_id, stage: r.stage_label || '-'
        });
      }
      res.json({ success: true, clusters: Object.values(clusters) });
    } catch (e) {
      console.error('duplicates list error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  app.post('/api/crm/ui/duplicates/resolve', auth, async (req, res) => {
    const { keepDealId, dropDealIds } = req.body || {};
    if (!keepDealId || !Array.isArray(dropDealIds) || !dropDealIds.length) {
      return res.status(400).json({ success: false, error: 'keepDealId e dropDealIds sao obrigatorios' });
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const id of dropDealIds) {
        await conn.query('UPDATE deals SET status = "lost", lost_date = NOW(), loss_reason = ? WHERE id = ? AND status = "open"', ['duplicado', id]);
        await conn.query(
          'INSERT INTO activities (deal_id, patient_id, user_id, type, content) SELECT id, patient_id, ?, "system", ? FROM deals WHERE id = ?',
          [(req.user && req.user.id) || null, 'Marcado como duplicado via ferramenta de duplicidade. Negocio mantido: #' + keepDealId, id]
        );
      }
      await conn.commit();
      res.json({ success: true, resolved: dropDealIds.length });
    } catch (e) {
      await conn.rollback();
      console.error('duplicates resolve error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    } finally {
      conn.release();
    }
  });

  app.get('/api/crm/ui/check-phone', auth, async (req, res) => {
  try {
    const rawPhone = req.query.phone || '';
    const np = normalizePhoneBR(rawPhone);
    if (!np) return res.json({ success: true, exists: false, deals: [] });
    const last8 = np.slice(-8);
    const [rows] = await pool.query(
      `SELECT p.id AS patient_id, p.phone, p.name AS patient_name, d.id AS deal_id, d.title, d.status, d.add_date, s.label AS stage_label
       FROM patients p
       JOIN deals d ON d.patient_id = p.id
       LEFT JOIN stages s ON s.id = d.stage_id
       WHERE p.phone IS NOT NULL AND p.phone <> '' AND p.phone LIKE CONCAT('%', ?, '%')
       ORDER BY d.add_date DESC`,
      [last8]
    );
    const matched = rows.filter(function(r){ return normalizePhoneBR(r.phone) === np; });
    if (!matched.length) return res.json({ success: true, exists: false, deals: [] });
    const seenPatients = {};
    matched.forEach(function(r){ seenPatients[r.patient_id] = r.patient_name; });
    const deals = matched.map(function(r){
      return {
        id: r.deal_id,
        patientId: r.patient_id,
        patientName: r.patient_name,
        title: r.title,
        status: r.status,
        stage: r.stage_label || '-',
        addDate: r.add_date
      };
    });
    res.json({ success: true, exists: true, patients: Object.keys(seenPatients).map(function(id){ return { id: Number(id), name: seenPatients[id] }; }), deals: deals });
  } catch (e) {
    console.error('check-phone error', e);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});
app.get('/api/crm/ui/users', auth, async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT id, name FROM users ORDER BY name')
      res.json({ success: true, users: rows })
    } catch (e) {
      console.error('users list error', e)
      res.status(500).json({ success: false, error: 'Erro interno' })
    }
  });


app.get('/api/crm/ui/backlog-priority', async (req, res) => {
try {
const [rows] = await pool.query('SELECT item_num, status FROM backlog_priority')
res.json({ success: true, overrides: rows })
} catch (e) {
console.error('backlog-priority list error', e)
res.status(500).json({ success: false, error: 'Erro interno' })
}
});
app.post('/api/crm/ui/backlog-priority/:num', async (req, res) => {
try {
const num = parseInt(req.params.num, 10)
const status = req.body && req.body.status
if (!num || !['normal','prioritario','excluido'].includes(status)) {
return res.status(400).json({ success: false, error: 'Parametros invalidos' })
}
await pool.query('INSERT INTO backlog_priority (item_num, status) VALUES (?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)', [num, status])
res.json({ success: true, item_num: num, status })
} catch (e) {
console.error('backlog-priority upsert error', e)
res.status(500).json({ success: false, error: 'Erro interno' })
}
});


// ---------------- AGENDA VISUAL (calendar_events + Google Calendar sync) ----------------
const gcalSvc = require('./google-calendar-service');

function formatNaive(d) {
  if (!d) return null;
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt.getTime())) return null;
  const pad = function(n){ return String(n).padStart(2,'0'); };
  return dt.getFullYear() + '-' + pad(dt.getMonth()+1) + '-' + pad(dt.getDate()) + 'T' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
}

function toMysqlDatetime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const pad = function(n){ return String(n).padStart(2,'0'); };
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

async function syncEventToGoogle(row) {
  if (!row.dentist_user_id) return null;
  const tokenRow = await gcalSvc.getTokenRow(row.dentist_user_id);
  if (!tokenRow) return null;
  const gEvent = {
    summary: row.title,
    description: row.description || undefined,
    start: { dateTime: formatNaive(row.start_at), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: formatNaive(row.end_at), timeZone: 'America/Sao_Paulo' },
    status: row.status === 'cancelled' ? 'cancelled' : 'confirmed'
  };
  if (row.google_event_id) {
    return gcalSvc.updateEvent(row.dentist_user_id, row.google_event_id, gEvent);
  }
  return gcalSvc.insertEvent(row.dentist_user_id, gEvent);
}

const STATUS_COLORS = { confirmed: { bg: '#22c55e', border: '#16a34a' }, attended: { bg: '#d4af37', border: '#b8960c' }, no_show: { bg: '#ec4899', border: '#db2777' }, cancelled: { bg: '#ef4444', border: '#dc2626' }, rescheduled: { bg: '#94a3b8', border: '#64748b' } };
const ALLOWED_STATUS = new Set(['scheduled', 'confirmed', 'attended', 'no_show', 'cancelled', 'rescheduled']);
const ALLOWED_LIKELIHOOD = new Set(['quente', 'morno', 'frio']);

const DEAL_STAGE_SKEY_BY_EVENT_STATUS = { scheduled: 'agendamento', attended: 'comparecimento', no_show: 'nao-compareceu', cancelled: 'cancelou' };
const AGENDA_STAGE_ID_CACHE = {};
async function resolveInboundStageBySkey(skey) {
  if (AGENDA_STAGE_ID_CACHE[skey]) return AGENDA_STAGE_ID_CACHE[skey];
  const [[row]] = await pool.query('SELECT id, pipeline_id FROM stages WHERE skey = ? AND pipeline_id = 1 LIMIT 1', [skey]);
  if (row) AGENDA_STAGE_ID_CACHE[skey] = row;
  return row || null;
}
async function syncDealStageFromAgenda(dealId, eventStatus) {
  try {
    if (!dealId) return;
    const targetSkey = DEAL_STAGE_SKEY_BY_EVENT_STATUS[eventStatus];
    if (!targetSkey) return;
    const stage = await resolveInboundStageBySkey(targetSkey);
    if (!stage) return;
    const [[deal]] = await pool.query('SELECT id, stage_id FROM deals WHERE id = ?', [dealId]);
    if (!deal || deal.stage_id === stage.id) return;
    await pool.query('UPDATE deals SET stage_id = ?, pipeline_id = ?, stage_entered_at = NOW() WHERE id = ?', [stage.id, stage.pipeline_id, dealId]);
    try {
      await pool.query('INSERT INTO stage_history (deal_id, from_stage_id, to_stage_id, changed_by_user_id) VALUES (?, ?, ?, NULL)', [dealId, deal.stage_id, stage.id]);
    } catch (e2) { console.error('stage_history insert (agenda sync) error', e2); }
    console.log('[dealsync] syncDealStageFromAgenda: deal ' + dealId + ' -> stage ' + stage.id + ' (' + targetSkey + ')');
  } catch (e) {
    console.error('syncDealStageFromAgenda error', e);
  }
}
app.get('/api/crm/ui/calendar-events', auth, async (req, res) => {
  try {
    const start = req.query.start ? toMysqlDatetime(req.query.start) : null;
    const end = req.query.end ? toMysqlDatetime(req.query.end) : null;
    const dentistUserId = parseInt(req.query.dentistUserId, 10) || req.user.id;
    const params = [dentistUserId];
    let sql = "SELECT ce.*, d.owner_name AS deal_owner, p.name AS patient_name FROM calendar_events ce LEFT JOIN deals d ON d.id = ce.deal_id LEFT JOIN patients p ON p.id = d.patient_id WHERE ce.dentist_user_id = ? ";
    if (start) { sql += ' AND ce.end_at >= ?'; params.push(start); }
    if (end) { sql += ' AND ce.start_at <= ?'; params.push(end); }
    sql += ' ORDER BY ce.start_at ASC';
    const [rows] = await pool.query(sql, params);
    const events = rows.map(function(r) {
      return {
        id: r.id,
        title: r.title + (r.patient_name ? ' - ' + r.patient_name : ''),
        start: formatNaive(r.start_at),
        end: formatNaive(r.end_at),
          backgroundColor: (STATUS_COLORS[r.status] || {}).bg,
          borderColor: (STATUS_COLORS[r.status] || {}).border,
        extendedProps: {
          dealId: r.deal_id,
          dentistUserId: r.dentist_user_id,
          description: r.description,
          status: r.status,
          googleEventId: r.google_event_id,
          patientName: r.patient_name,
            cancelReason: r.cancel_reason,
            attendanceLikelihood: r.attendance_likelihood,
            rescheduledToId: r.rescheduled_to_id
        }
      };
    });
    res.json({ success: true, events: events });
  } catch (e) {
    console.error('calendar-events list error', e);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

app.post('/api/crm/ui/calendar-events', auth, async (req, res) => {
  try {
    const body = req.body || {};
    const title = (body.title || '').toString().trim();
    const dentistUserId = JESSICA_USER_ID; // Dra. Jessica - avaliadora padrao fixa (ignora body.dentistUserId e req.user.id)
    const dealId = body.dealId ? parseInt(body.dealId, 10) : null;
    const attendanceLikelihood = ALLOWED_LIKELIHOOD.has(body.attendanceLikelihood) ? body.attendanceLikelihood : null;
    const description = body.description ? String(body.description) : null;
    const startAt = toMysqlDatetime(body.startAt);
    const endAt = toMysqlDatetime(body.endAt);
    if (!title) return res.status(400).json({ success: false, error: 'Titulo obrigatorio' });
    if (!startAt || !endAt) return res.status(400).json({ success: false, error: 'Horario invalido' });
    if (new Date(endAt) <= new Date(startAt)) return res.status(400).json({ success: false, error: 'Horario de fim deve ser depois do inicio' });
    const [result] = await pool.query(
      'INSERT INTO calendar_events (deal_id, dentist_user_id, title, description, start_at, end_at, status, attendance_likelihood, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [dealId, dentistUserId, title, description, startAt, endAt, 'scheduled', attendanceLikelihood, req.user.id]
    );
    const [[row]] = await pool.query('SELECT * FROM calendar_events WHERE id = ?', [result.insertId]);
    await syncDealStageFromAgenda(row.deal_id, row.status);
    try {
      const gRes = await syncEventToGoogle(row);
      if (gRes && gRes.id) {
        await pool.query('UPDATE calendar_events SET google_event_id = ? WHERE id = ?', [gRes.id, row.id]);
        row.google_event_id = gRes.id;
      }
    } catch (syncErr) {
      console.error('calendar-events google sync (create) error', syncErr.data || syncErr.message || syncErr);
    }
    res.json({ success: true, event: row });
  } catch (e) {
    console.error('calendar-events create error', e);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

app.patch('/api/crm/ui/calendar-events/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [[existing]] = await pool.query('SELECT * FROM calendar_events WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Compromisso nao encontrado' });
    const body = req.body || {};
    const title = body.title !== undefined ? String(body.title).trim() : existing.title;
    const description = body.description !== undefined ? String(body.description) : existing.description;
    const startAt = body.startAt !== undefined ? toMysqlDatetime(body.startAt) : existing.start_at;
    const endAt = body.endAt !== undefined ? toMysqlDatetime(body.endAt) : existing.end_at;
    const dealId = body.dealId !== undefined ? (body.dealId ? parseInt(body.dealId, 10) : null) : existing.deal_id;
    const dentistUserId = JESSICA_USER_ID; // Dra. Jessica - avaliadora padrao fixa (ignora body.dentistUserId)
    const status = (body.status !== undefined && ALLOWED_STATUS.has(String(body.status))) ? String(body.status) : existing.status;
    const cancelReason = body.cancelReason !== undefined ? String(body.cancelReason) : existing.cancel_reason;
    const attendanceLikelihood = body.attendanceLikelihood !== undefined ? (ALLOWED_LIKELIHOOD.has(body.attendanceLikelihood) ? body.attendanceLikelihood : null) : existing.attendance_likelihood;
    const rescheduledToId = body.rescheduledToId !== undefined ? (body.rescheduledToId ? parseInt(body.rescheduledToId, 10) : null) : existing.rescheduled_to_id;
    if (!title) return res.status(400).json({ success: false, error: 'Titulo obrigatorio' });
    if (!startAt || !endAt) return res.status(400).json({ success: false, error: 'Horario invalido' });
    if (new Date(endAt) <= new Date(startAt)) return res.status(400).json({ success: false, error: 'Horario de fim deve ser depois do inicio' });
    await pool.query(
      'UPDATE calendar_events SET title=?, description=?, start_at=?, end_at=?, deal_id=?, dentist_user_id=?, status=?, cancel_reason=?, attendance_likelihood=?, rescheduled_to_id=? WHERE id=?',
      [title, description, startAt, endAt, dealId, dentistUserId, status, cancelReason, attendanceLikelihood, rescheduledToId, id]
    );
    const [[row]] = await pool.query('SELECT * FROM calendar_events WHERE id = ?', [id]);
    if (status !== existing.status) { await syncDealStageFromAgenda(row.deal_id, status); }
    try {
      const gRes = await syncEventToGoogle(row);
      if (gRes && gRes.id && gRes.id !== row.google_event_id) {
        await pool.query('UPDATE calendar_events SET google_event_id = ? WHERE id = ?', [gRes.id, row.id]);
        row.google_event_id = gRes.id;
      }
    } catch (syncErr) {
      console.error('calendar-events google sync (update) error', syncErr.data || syncErr.message || syncErr);
    }
    res.json({ success: true, event: row });
  } catch (e) {
    console.error('calendar-events update error', e);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

app.delete('/api/crm/ui/calendar-events/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [[existing]] = await pool.query('SELECT * FROM calendar_events WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Compromisso nao encontrado' });
    if (existing.google_event_id) {
      try { await gcalSvc.deleteEvent(existing.dentist_user_id, existing.google_event_id); }
      catch (delErr) { console.error('calendar-events google delete error', delErr.data || delErr.message || delErr); }
    }
    await pool.query("UPDATE calendar_events SET status = 'cancelled' WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (e) {
    console.error('calendar-events delete error', e);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});


  // ---- Comando Central: Robo de IA x Chatbot de Cadencias (2026-07-30) ----

// ---- Handoff: notificacao real de transferencia para atendimento humano ----
// So aparece enquanto resolved_at for NULL. So e marcado como resolvido quando a
// propria owner manda uma mensagem manual de verdade pro lead (nunca por timeout).
app.get('/api/crm/ui/handoff-alerts', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ha.id, ha.conversation_id, ha.deal_id, ha.patient_id, ha.phone, ha.lead_name, ha.created_at, d.owner_name
       FROM handoff_alerts ha
       LEFT JOIN deals d ON d.id = ha.deal_id
       WHERE ha.resolved_at IS NULL
       ORDER BY ha.created_at DESC`
    )
    res.json({ success: true, alerts: rows })
  } catch (e) {
    console.error('handoff-alerts list error', e.message)
    res.status(500).json({ success: false, error: 'Erro interno' })
  }
})

  app.get('/api/crm/ui/whatsapp-numbers', auth, async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT id, connection_key AS session_name, label, phone_number, status, ai_enabled, chatbot_enabled, is_primary FROM whatsapp_connections ORDER BY is_primary DESC, id');
      res.json({ success: true, numbers: rows });
    } catch (e) {
      console.error('whatsapp-numbers list error', e.message);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  app.post('/api/crm/ui/whatsapp-numbers/:id/toggle-ai', auth, async (req, res) => {
    try {
      const enabled = !!(req.body || {}).enabled;
      await pool.query('UPDATE whatsapp_connections SET ai_enabled = ? WHERE id = ?', [enabled ? 1 : 0, req.params.id]);
      res.json({ success: true, ai_enabled: enabled });
    } catch (e) {
      console.error('toggle-ai number error', e.message);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  app.post('/api/crm/ui/whatsapp-numbers/:id/toggle-chatbot', auth, async (req, res) => {
    try {
      const enabled = !!(req.body || {}).enabled;
      await pool.query('UPDATE whatsapp_connections SET chatbot_enabled = ? WHERE id = ?', [enabled ? 1 : 0, req.params.id]);
      res.json({ success: true, chatbot_enabled: enabled });
    } catch (e) {
      console.error('toggle-chatbot number error', e.message);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  app.get('/api/crm/ui/global-toggles', auth, async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT config_key, config_value FROM chatbot_ai_config WHERE config_key IN ('ai_globally_enabled','chatbot_globally_enabled')");
      const map = {}; rows.forEach(r => { map[r.config_key] = r.config_value; });
      res.json({
        success: true,
        ai_globally_enabled: map.ai_globally_enabled !== 'false',
        chatbot_globally_enabled: map.chatbot_globally_enabled !== 'false'
      });
    } catch (e) {
      console.error('global-toggles get error', e.message);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  app.post('/api/crm/ui/global-toggles/ai', auth, async (req, res) => {
    try {
      const enabled = !!(req.body || {}).enabled;
      const value = enabled ? 'true' : 'false';
      await pool.query("INSERT INTO chatbot_ai_config (config_key, config_value) VALUES ('ai_globally_enabled', ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)", [value]);
      res.json({ success: true, ai_globally_enabled: enabled });
    } catch (e) {
      console.error('global toggle ai error', e.message);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  app.post('/api/crm/ui/global-toggles/chatbot', auth, async (req, res) => {
    try {
      const enabled = !!(req.body || {}).enabled;
      const value = enabled ? 'true' : 'false';
      await pool.query("INSERT INTO chatbot_ai_config (config_key, config_value) VALUES ('chatbot_globally_enabled', ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)", [value]);
      res.json({ success: true, chatbot_globally_enabled: enabled });
    } catch (e) {
      console.error('global toggle chatbot error', e.message);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  app.post('/api/crm/ui/conversations/:id/toggle-cadence', auth, async (req, res) => {
    try {
      const enabled = !!(req.body || {}).enabled;
      await pool.query('UPDATE whatsapp_conversations SET cadence_enabled = ? WHERE id = ?', [enabled ? 1 : 0, req.params.id]);
      res.json({ success: true, cadence_enabled: enabled });
    } catch (e) {
      console.error('toggle-cadence error', e.message);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

// ---- Patch: graficos de horario SDR (WhatsApp + ligacoes atendidas) ----
app.get('/api/crm/ui/dashboard/sdrs/whatsapp-hours', auth, async (req, res) => {
  try {
    const from = req.query.from || brTodayStr();
    const to = req.query.to || brTodayStr();
    const { fromDt, toDt } = brRangeToUtc(from, to);
    const [rows] = await pool.query(
      "SELECT COALESCE(d.owner_name,'Sem SDR') AS ownerName, HOUR(DATE_SUB(wm.created_at, INTERVAL 3 HOUR)) AS hourBr, COUNT(*) AS cnt " +
      "FROM whatsapp_messages wm " +
      "JOIN whatsapp_conversations wc ON wc.id = wm.conversation_id " +
      "LEFT JOIN deals d ON d.id = wc.deal_id " +
      "WHERE wm.direction = 'in' AND wm.created_at BETWEEN ? AND ? " +
      "GROUP BY ownerName, hourBr",
      [fromDt, toDt]
    );
    res.json({ success: true, rows });
  } catch (e) {
    console.error('sdrs whatsapp-hours error', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/crm/ui/conversations/:id/resolve', auth, async (req, res) => {
  try {
    const resolved = (req.body || {}).resolved !== false;
    if (resolved) {
      await pool.query('UPDATE whatsapp_conversations SET resolved_at = NOW() WHERE id = ?', [req.params.id]);
    } else {
      await pool.query('UPDATE whatsapp_conversations SET resolved_at = NULL WHERE id = ?', [req.params.id]);
    }
    res.json({ success: true, resolved });
  } catch (e) {
    console.error('resolve-conversation error', e.message);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

app.post('/api/crm/ui/conversations/get-or-create', auth, async (req, res) => {
  try {
    const raw = (req.body || {}).phone;
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return res.status(400).json({ success: false, error: 'Telefone invalido' });
    const normalized = '+' + (digits.startsWith('55') ? digits : '55' + digits);
    const [existing] = await pool.query('SELECT id FROM whatsapp_conversations WHERE phone = ? ORDER BY last_message_at DESC, id DESC LIMIT 1', [normalized]);
    if (existing.length) return res.json({ success: true, id: existing[0].id, created: false });
    const [[conn]] = await pool.query("SELECT id FROM whatsapp_connections WHERE status = 'connected' ORDER BY updated_at DESC LIMIT 1");
    const connectionId = conn ? conn.id : null;
    const [r] = await pool.query(
      'INSERT INTO whatsapp_conversations (phone, contact_name, ai_enabled, status, last_message_at, connection_id) VALUES (?, NULL, 1, "open", NOW(), ?)',
      [normalized, connectionId]
    );
    res.json({ success: true, id: r.insertId, created: true });
  } catch (e) {
    console.error('conversations/get-or-create error', e.message);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

app.get('/api/crm/ui/dashboard/sdrs/calls-hours', auth, async (req, res) => {
  try {
    const from = req.query.from || brTodayStr();
    const to = req.query.to || brTodayStr();
    const { fromDt, toDt } = brRangeToUtc(from, to);
    const [rows] = await pool.query(
      "SELECT COALESCE(a.user_name,'Sem SDR') AS ownerName, HOUR(DATE_SUB(a.created_at, INTERVAL 3 HOUR)) AS hourBr, COUNT(*) AS cnt " +
      "FROM activities a " +
      "WHERE a.type = 'Ligação Atendida' AND a.created_at BETWEEN ? AND ? " +
      "GROUP BY ownerName, hourBr",
      [fromDt, toDt]
    );
    res.json({ success: true, rows });
  } catch (e) {
    console.error('sdrs calls-hours error', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});


// ---- Patch: analise agregada de resposta/continuidade + insight IA ----
async function computeResponseAnalysis(fromDt, toDt) {
  const [msgs] = await pool.query(
    "SELECT conversation_id, direction, created_at FROM whatsapp_messages WHERE created_at BETWEEN ? AND ? ORDER BY conversation_id, created_at ASC",
    [fromDt, toDt]
  );
  const byConv = {};
  msgs.forEach(function(m){
    if (!byConv[m.conversation_id]) byConv[m.conversation_id] = [];
    byConv[m.conversation_id].push(m);
  });
  const hourBuckets = {};
  for (let h = 0; h < 24; h++) hourBuckets[h] = { inbound: 0, responses: 0, sumResponseMin: 0, continued: 0, stalled: 0, unanswered: 0 };
  let totalInbound = 0, totalAnswered = 0, totalContinued = 0, totalStalled = 0, totalUnanswered = 0, sumResponseMin = 0;

  Object.keys(byConv).forEach(function(convId){
    const list = byConv[convId];
    for (let i = 0; i < list.length; i++) {
      if (list[i].direction !== "in") continue;
      const t = new Date(list[i].created_at).getTime();
      const hourBr = new Date(t - BR_OFFSET_MS).getUTCHours();
      totalInbound++;
      hourBuckets[hourBr].inbound++;
      let j = -1;
      for (let k = i + 1; k < list.length; k++) {
        if (list[k].direction === "out") { j = k; break; }
      }
      if (j === -1) {
        totalUnanswered++;
        hourBuckets[hourBr].unanswered++;
        continue;
      }
      const tReply = new Date(list[j].created_at).getTime();
      const responseMin = (tReply - t) / 60000;
      totalAnswered++;
      sumResponseMin += responseMin;
      hourBuckets[hourBr].responses++;
      hourBuckets[hourBr].sumResponseMin += responseMin;
      let continued = false;
      for (let k = j + 1; k < list.length; k++) {
        if (list[k].direction === "in") { continued = true; break; }
      }
      if (continued) { totalContinued++; hourBuckets[hourBr].continued++; }
      else { totalStalled++; hourBuckets[hourBr].stalled++; }
    }
  });

  const byHour = [];
  for (let h = 0; h < 24; h++) {
    const b = hourBuckets[h];
    byHour.push({
      hour: h,
      inbound: b.inbound,
      avgResponseMin: b.responses ? Math.round((b.sumResponseMin / b.responses) * 10) / 10 : null,
      continued: b.continued,
      stalled: b.stalled,
      unanswered: b.unanswered
    });
  }

  return {
    byHour: byHour,
    totals: {
      conversations: Object.keys(byConv).length,
      inboundMessages: totalInbound,
      answered: totalAnswered,
      unanswered: totalUnanswered,
      continued: totalContinued,
      stalled: totalStalled,
      avgResponseMin: totalAnswered ? Math.round((sumResponseMin / totalAnswered) * 10) / 10 : null
    }
  };
}

app.get('/api/crm/ui/dashboard/sdrs/response-analysis', auth, async (req, res) => {
  try {
    const from = req.query.from || brTodayStr();
    const to = req.query.to || brTodayStr();
    const { fromDt, toDt } = brRangeToUtc(from, to);
    const analysis = await computeResponseAnalysis(fromDt, toDt);
    res.json({ success: true, analysis: analysis });
  } catch (e) {
    console.error('sdrs response-analysis error', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

async function getSdrInsightCache(periodKey) {
  const [rows] = await pool.query('SELECT insight_text, stats_json, generated_at FROM sdr_insight_cache WHERE period_key = ? LIMIT 1', [periodKey]);
  return (rows && rows[0]) ? rows[0] : null;
}
async function upsertSdrInsightCache(periodKey, from, to, insightText, statsObj) {
  await pool.query(
    'INSERT INTO sdr_insight_cache (period_key, period_from, period_to, insight_text, stats_json, generated_at) VALUES (?, ?, ?, ?, ?, NOW()) ' +
    'ON DUPLICATE KEY UPDATE insight_text = VALUES(insight_text), stats_json = VALUES(stats_json), generated_at = NOW()',
    [periodKey, from, to, insightText, JSON.stringify(statsObj || {})]
  );
}
function brDateStrFromDate(d) {
  return new Date(new Date(d).getTime() - BR_OFFSET_MS).toISOString().slice(0,10);
}
app.get('/api/crm/ui/dashboard/sdrs/ai-insight', auth, function(req, res) { return runAiInsight(req, res, false); });
app.post('/api/crm/ui/dashboard/sdrs/ai-insight/refazer', auth, function(req, res) { return runAiInsight(req, res, true); });
async function runAiInsight(req, res, forceRefresh) {
  try {
const from = req.query.from || brTodayStr();
const to = req.query.to || brTodayStr();
const periodKey = from + '|' + to;
const todayBr = brTodayStr();
const periodFinished = to < todayBr;
if (!forceRefresh) {
  const cachedRow = await getSdrInsightCache(periodKey);
  if (cachedRow) {
    const generatedDateBr = brDateStrFromDate(cachedRow.generated_at);
    const sameDay = generatedDateBr === todayBr;
    if (periodFinished || sameDay) {
      var cachedStats;
      try { cachedStats = cachedRow.stats_json ? JSON.parse(cachedRow.stats_json) : undefined; } catch (parseErr) { cachedStats = undefined; }
      return res.json({ success: true, insight: cachedRow.insight_text, cached: true, generatedAt: cachedRow.generated_at, stats: cachedStats });
    }
  }
}
    const { fromDt, toDt } = brRangeToUtc(from, to);

    const analysis = await computeResponseAnalysis(fromDt, toDt);

    const [callRows] = await pool.query(
      "SELECT HOUR(DATE_SUB(a.created_at, INTERVAL 3 HOUR)) AS hourBr, COUNT(*) AS cnt " +
      "FROM activities a WHERE a.type = 'Ligação Atendida' AND a.created_at BETWEEN ? AND ? " +
      "GROUP BY hourBr",
      [fromDt, toDt]
    );

    const [convRow] = await pool.query(
      "SELECT MIN(created_at) AS minD, MAX(created_at) AS maxD FROM whatsapp_messages WHERE created_at BETWEEN ? AND ?",
      [fromDt, toDt]
    );
    const minD = convRow && convRow[0] && convRow[0].minD;
    const maxD = convRow && convRow[0] && convRow[0].maxD;
    const daysOfHistory = (minD && maxD) ? Math.max(1, Math.ceil((new Date(maxD) - new Date(minD)) / 86400000) + 1) : 0;

    const topInboundHours = analysis.byHour
      .filter(function(h){ return h.inbound > 0; })
      .sort(function(a,b){ return b.inbound - a.inbound; })
      .slice(0, 5)
      .map(function(h){ return h.hour + 'h (' + h.inbound + ' msgs)'; })
      .join(', ');

    const topCallHours = (callRows || [])
      .sort(function(a,b){ return b.cnt - a.cnt; })
      .slice(0, 5)
      .map(function(r){ return r.hourBr + 'h (' + r.cnt + ' ligações)'; })
      .join(', ');

    const slowHours = analysis.byHour
      .filter(function(h){ return h.avgResponseMin !== null; })
      .sort(function(a,b){ return b.avgResponseMin - a.avgResponseMin; })
      .slice(0, 5)
      .map(function(h){ return h.hour + 'h (' + h.avgResponseMin + ' min)'; })
      .join(', ');

    const context = [
      'Período analisado: ' + from + ' a ' + to + '.',
      'Amostra de WhatsApp: ' + daysOfHistory + ' dias de histórico, ' + analysis.totals.conversations + ' conversas, ' + analysis.totals.inboundMessages + ' mensagens recebidas de leads.',
      'Horários de pico de mensagens recebidas (leads): ' + (topInboundHours || 'sem dados suficientes') + '.',
      'Horários de pico de ligações atendidas: ' + (topCallHours || 'sem dados suficientes') + '.',
      'Tempo médio de resposta da equipe: ' + (analysis.totals.avgResponseMin !== null ? analysis.totals.avgResponseMin + ' minutos' : 'sem dados suficientes') + '.',
      'Horários com resposta mais lenta: ' + (slowHours || 'sem dados suficientes') + '.',
      'Do total de ' + analysis.totals.answered + ' mensagens respondidas, ' + analysis.totals.continued + ' tiveram continuidade da conversa (lead respondeu de novo) e ' + analysis.totals.stalled + ' pararam após a resposta da equipe (lead não respondeu mais).',
      'Mensagens de leads que nunca receberam resposta da equipe: ' + analysis.totals.unanswered + '.'
    ].join('\n');

    const systemPrompt = 'Você é um especialista em inbound marketing e em agendamentos para clínicas de estética facial e odontologia high-ticket. Você está analisando os dados operacionais reais de uma clínica (Vivera Orofacial) para o dono do negócio. Escreva uma análise estratégica em texto corrido, em português do Brasil, com tom consultivo e direto (não seja uma lista fria de tópicos, escreva como uma leitura de especialista). Comente os horários de pico de entrada de mensagens e de ligações atendidas, relacione isso com o tempo de resposta da equipe, e comente se há indício de que demora na resposta está associada a conversas que morrem (lead para de responder). Dê recomendações práticas de estratégia (ex: escalas de horário, alertas de resposta rápida, priorização). Se a amostra de dados for pequena (poucos dias de histórico), deixe isso explícito no texto e module a confiança das conclusões de acordo — não afirme padrões fortes com poucos dados. Não invente números que não foram fornecidos.';

    const apiKey = process.env.OPENAI_API_KEY;
    let insightText = null;
    if (apiKey) {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Dados agregados:\n' + context + '\n\nEscreva a análise agora.' }
          ],
          temperature: 0.4
        })
      });
      const data = await resp.json();
      insightText = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    }
    if (!insightText) {
      insightText = 'Não foi possível gerar a análise por IA no momento. Dados agregados:\n' + context;
    }

const statsObj = { analysis: analysis, topInboundHours: topInboundHours, topCallHours: topCallHours, daysOfHistory: daysOfHistory };
await upsertSdrInsightCache(periodKey, from, to, insightText, statsObj);
res.json({ success: true, insight: insightText, cached: false, forced: !!forceRefresh, stats: statsObj });
  } catch (e) {
    console.error('sdrs ai-insight error', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

  // ================= Publico (audiencias para Google Ads Customer Match / Meta Custom Audiences) =================
  function publicoNormalizePhoneBR(phone) {
    if (!phone) return '';
    let digits = String(phone).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length <= 11) digits = '55' + digits;
    return '+' + digits;
  }
  function publicoNormalizeEmail(email) {
    if (!email) return '';
    return String(email).trim().toLowerCase();
  }
  const PUBLICO_FINANCEIRO_REGEX = /financ|caro|dinheiro|condi[c\u00e7][a\u00e3]o|financiamento/i;
  const PUBLICO_DESQUALIFICADO_REGEX = /desqualific/i;
  const PUBLICO_NAO_RESPONDEU_REGEX = /n[a\u00e3]o respond|nao responde/i;
  const PUBLICO_MORA_LONGE_REGEX = /distante|mora longe|more longe/i;
  const PUBLICO_INBOUND_PIPELINE_ID = 1;

  const PUBLICO_CRITERIA_DEFS = [
    { key: 'nunca_compareceu', label: 'Nunca compareceu' },
    { key: 'financeiro', label: 'Motivo financeiro' },
    { key: 'desqualificado', label: 'Desqualificado' },
    { key: 'sem_orcamento', label: 'Nao compareceu e nao fez orcamento' },
    { key: 'orcamento_financeiro', label: 'Orcamento feito, perdido por falta de dinheiro' },
    { key: 'nao_respondeu', label: 'Nunca respondeu' },
    { key: 'mora_longe', label: 'Mora longe / lead distante' }
  ];

  const PUBLICO_INCLUSAO_CRITERIA_DEFS = [
  { key: 'compareceu', label: 'Compareceu' },
  { key: 'fechou', label: 'Fechou (Ganho)' },
  { key: 'qualificado', label: 'Qualificado' },
  { key: 'em_negociacao', label: 'Em negociacao' }
];

async function buildPublicoLists() {
    const [lostDeals] = await pool.query(
      "SELECT d.id AS dealId, d.patient_id AS patientId, d.loss_reason_id AS lossReasonId, " +
      "d.loss_reason AS lossReason, " +
      "p.name AS name, p.phone AS phone, p.email AS email, " +
      "EXISTS(SELECT 1 FROM activities a WHERE a.deal_id=d.id AND a.type='Compareceu') AS compareceu, " +
      "EXISTS(SELECT 1 FROM activities a WHERE a.deal_id=d.id AND a.type='Orcamento Gerado') AS orcamentoFeito, " +
      "EXISTS(SELECT 1 FROM deal_labels dl JOIN labels l ON l.id=dl.label_id WHERE dl.deal_id=d.id AND l.name='Obje\u00e7\u00e3o financeira') AS temLabelFinanceiro " +
      "FROM deals d JOIN patients p ON p.id = d.patient_id " +
      "WHERE d.status='lost' AND d.pipeline_id=" + PUBLICO_INBOUND_PIPELINE_ID
    );

    const [wonOrAttendedDeals] = await pool.query(
  "SELECT d.id AS dealId, d.patient_id AS patientId, d.status AS status, " +
  "p.name AS name, p.phone AS phone, p.email AS email, " +
  "EXISTS(SELECT 1 FROM activities a WHERE a.deal_id=d.id AND a.type='Compareceu') AS compareceu, " +
  "s.sort AS stageSort, s.skey AS stageSkey, qs.sort AS qualStageSort " +
  "FROM deals d " +
  "JOIN patients p ON p.id = d.patient_id " +
  "LEFT JOIN stages s ON s.id = d.stage_id " +
  "LEFT JOIN stages qs ON qs.pipeline_id = d.pipeline_id AND qs.skey = 'qualificado' " +
  "WHERE d.status='won' " +
  "OR EXISTS (SELECT 1 FROM activities a WHERE a.deal_id=d.id AND a.type='Compareceu') " +
  "OR (d.status='open' AND s.sort IS NOT NULL AND qs.sort IS NOT NULL AND s.sort >= qs.sort) " +
  "OR (d.status='open' AND (s.skey = 'negociacao' OR s.skey = 'em-negociacao'))"
);

    const inclusionMap = new Map();
for (const row of wonOrAttendedDeals) {
  const key = row.patientId;
  if (!inclusionMap.has(key)) {
    inclusionMap.set(key, { patientId: row.patientId, name: row.name, phone: row.phone, email: row.email, reasons: new Set(), deals: new Set(), criterios: {} });
  }
  const entry = inclusionMap.get(key);
  entry.deals.add(row.dealId);

  const isFechou = row.status === 'won';
  const isCompareceu = !!row.compareceu;
  const isQualificado = row.status === 'open' && row.stageSort != null && row.qualStageSort != null && row.stageSort >= row.qualStageSort;
  const isEmNegociacao = row.status === 'open' && (row.stageSkey === 'negociacao' || row.stageSkey === 'em-negociacao');

  const rowCriterios = { compareceu: isCompareceu, fechou: isFechou, qualificado: isQualificado, em_negociacao: isEmNegociacao };
  for (const def of PUBLICO_INCLUSAO_CRITERIA_DEFS) {
    if (rowCriterios[def.key]) {
      entry.criterios[def.key] = true;
      entry.reasons.add(def.label);
    }
  }
}

const exclusionMap = new Map();
    for (const row of lostDeals) {
      const lossText = (row.lossReason || '').toString();
      const isFinanceiro = [17, 21, 22].indexOf(row.lossReasonId) > -1 || PUBLICO_FINANCEIRO_REGEX.test(lossText) || !!row.temLabelFinanceiro;
      const isDesqualificado = row.lossReasonId === 9 || PUBLICO_DESQUALIFICADO_REGEX.test(lossText);
      const isNaoRespondeu = PUBLICO_NAO_RESPONDEU_REGEX.test(lossText);
      const isMoraLonge = PUBLICO_MORA_LONGE_REGEX.test(lossText);

      const criterios = {
        nunca_compareceu: !row.compareceu,
        financeiro: isFinanceiro,
        desqualificado: isDesqualificado,
        sem_orcamento: !row.compareceu && !row.orcamentoFeito,
        orcamento_financeiro: !!row.orcamentoFeito && isFinanceiro,
        nao_respondeu: isNaoRespondeu,
        mora_longe: isMoraLonge
      };

      const key = row.patientId;
      if (!exclusionMap.has(key)) {
        exclusionMap.set(key, { patientId: row.patientId, name: row.name, phone: row.phone, email: row.email, reasons: new Set(), deals: new Set(), criterios: {} });
      }
      const entry = exclusionMap.get(key);
      entry.deals.add(row.dealId);
      for (const def of PUBLICO_CRITERIA_DEFS) {
        if (criterios[def.key]) {
          entry.criterios[def.key] = true;
          entry.reasons.add(def.label);
        }
      }
    }

    const toRows = (map) => Array.from(map.values()).map(e => ({
      patientId: e.patientId,
      name: e.name || '',
      phone: publicoNormalizePhoneBR(e.phone) || '',
      email: publicoNormalizeEmail(e.email) || '',
      dealCount: e.deals.size,
      reasons: Array.from(e.reasons).join('; '),
      criterios: e.criterios || null
    }));

    return { exclusion: toRows(exclusionMap), inclusion: toRows(inclusionMap), criteriaDefs: PUBLICO_CRITERIA_DEFS, inclusionCriteriaDefs: PUBLICO_INCLUSAO_CRITERIA_DEFS };
  }

  function publicoToCsv(rows) {
  const header = 'Phone,Email,Name,Motivo\n';
  const lines = rows.map(r => {
    const phone = publicoNormalizePhoneBR(r.phone) || '';
    const email = publicoNormalizeEmail(r.email) || '';
    const name = (r.name || '').replace(/"/g, '""');
    const motivo = (r.reasons || '').replace(/"/g, '""');
    return '"' + phone + '","' + email + '","' + name + '","' + motivo + '"';
  });
  return header + lines.join('\n');
}

app.get('/api/crm/ui/dashboard/publico/exclusao', auth, requireAdmin, async (req, res) => {
    try {
      const { exclusion, criteriaDefs } = await buildPublicoLists();
      const selected = (req.query.criterios || '').split(',').map(s => s.trim()).filter(Boolean);
      const filtered = selected.length ? exclusion.filter(r => r.criterios && selected.some(k => r.criterios[k])) : exclusion;
      res.json({ success: true, rows: filtered, total: filtered.length, criteria: criteriaDefs });
    } catch (e) {
      console.error('publico exclusao error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  app.get('/api/crm/ui/dashboard/publico/inclusao', auth, requireAdmin, async (req, res) => {
  try {
    const { inclusion, inclusionCriteriaDefs } = await buildPublicoLists();
    const selected = (req.query.criterios ? String(req.query.criterios).split(',').map(s => s.trim()).filter(Boolean) : null);
    const rows = selected && selected.length ? inclusion.filter(r => r.criterios && selected.some(k => r.criterios[k])) : inclusion;
    res.json({ success: true, total: rows.length, rows, criteria: inclusionCriteriaDefs });
  } catch (e) {
    console.error('publico inclusao error', e);
    res.status(500).json({ success: false, error: String(e) });
  }
});

app.get('/api/crm/ui/dashboard/publico/exclusao.csv', auth, requireAdmin, async (req, res) => {
    try {
      const { exclusion } = await buildPublicoLists();
      const selected = (req.query.criterios || '').split(',').map(s => s.trim()).filter(Boolean);
      const filtered = selected.length ? exclusion.filter(r => r.criterios && selected.some(k => r.criterios[k])) : exclusion;
      const csv = publicoToCsv(filtered);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="publico_exclusao.csv"');
      res.send('' + csv);
    } catch (e) {
      console.error('publico exclusao csv error', e);
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  });

  app.get('/api/crm/ui/dashboard/publico/inclusao.csv', auth, requireAdmin, async (req, res) => {
  try {
    const { inclusion } = await buildPublicoLists();
    const selected = (req.query.criterios ? String(req.query.criterios).split(',').map(s => s.trim()).filter(Boolean) : null);
    const rows = selected && selected.length ? inclusion.filter(r => r.criterios && selected.some(k => r.criterios[k])) : inclusion;
    const csv = publicoToCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inclusao.csv"');
    res.send('' + csv);
  } catch (e) {
    console.error('publico inclusao csv error', e);
    res.status(500).json({ success: false, error: String(e) });
  }
});
};
