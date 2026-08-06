const pool = require('./db');

async function main() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [missingAgendou] = await conn.query(
      `SELECT d.id, d.stage_id, d.stage_entered_at, d.status, d.won_date
       FROM deals d
       WHERE d.pipeline_id=1 AND d.stage_id>=10
       AND NOT EXISTS (SELECT 1 FROM activities a WHERE a.deal_id=d.id AND a.type='Agendou')`
    );
    let agendouInserted = 0, agendouSkipped = 0;
    for (const d of missingAgendou) {
      let dt = d.stage_entered_at;
      if (d.status === 'won' && d.stage_id < 10 && d.won_date) dt = d.won_date;
      if (!dt) { agendouSkipped++; continue; }
      await conn.query(
        `INSERT INTO activities (deal_id, type, content, done, created_at, done_at) VALUES (?, 'Agendou', ?, 1, ?, ?)`,
        [d.id, 'Agendamento (registro retroativo reconstruido pela etapa do funil - backfill 2026-07-21)', dt, dt]
      );
      agendouInserted++;
    }

    const [missingCompareceu] = await conn.query(
      `SELECT d.id, d.stage_id, d.stage_entered_at, d.status, d.won_date
       FROM deals d
       WHERE d.pipeline_id=1 AND (d.stage_id>=13 OR d.status='won')
       AND NOT EXISTS (SELECT 1 FROM activities a WHERE a.deal_id=d.id AND a.type='Compareceu')`
    );
    let compareceuInserted = 0, compareceuSkipped = 0;
    for (const d of missingCompareceu) {
      let dt = d.stage_entered_at;
      if (d.status === 'won' && d.stage_id < 13 && d.won_date) dt = d.won_date;
      if (!dt) { compareceuSkipped++; continue; }
      await conn.query(
        `INSERT INTO activities (deal_id, type, content, done, created_at, done_at) VALUES (?, 'Compareceu', ?, 1, ?, ?)`,
        [d.id, 'Comparecimento (registro retroativo reconstruido pela etapa do funil - backfill 2026-07-21)', dt, dt]
      );
      compareceuInserted++;
    }

    await conn.commit();
    console.log('AGENDOU_INSERTED', agendouInserted, 'SKIPPED', agendouSkipped);
    console.log('COMPARECEU_INSERTED', compareceuInserted, 'SKIPPED', compareceuSkipped);
  } catch (e) {
    await conn.rollback();
    console.error('ERROR_ROLLED_BACK', e.message);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}
main();
