const pool = require('./db');
async function main() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[before]] = await conn.query('SELECT id, status, value, won_date FROM deals WHERE id = 1750');
    console.log('BEFORE', JSON.stringify(before));

    await conn.query("UPDATE deals SET status = 'won', value = 3248.00 WHERE id = 1750");

    const noteContent = 'Correcao manual: negocio restaurado para Ganho R$ 3.248,00. O status e valor haviam sido zerados por um processo desconhecido as 05:10 UTC de 21/07/2026 (fora do fluxo normal do app - sem atividade registrada para essa alteracao). Confirmado com Diego que a paciente Maria Aparecida fechou em 20/07/2026.';
    await conn.query(
      "INSERT INTO activities (deal_id, patient_id, user_id, type, content, created_at) SELECT id, patient_id, NULL, 'Correcao Sistema', ?, NOW() FROM deals WHERE id = 1750",
      [noteContent]
    );

    const oppContent = 'Orcamento gerado: R$ 3.248,00 (registro retroativo - correcao)';
    await conn.query(
      "INSERT INTO activities (deal_id, patient_id, user_id, type, content, amount, created_at) SELECT id, patient_id, NULL, 'Orcamento Gerado', ?, 3248.00, '2026-07-20 20:45:00' FROM deals WHERE id = 1750",
      [oppContent]
    );

    await conn.commit();

    const [[after]] = await pool.query('SELECT id, status, value, won_date FROM deals WHERE id = 1750');
    console.log('AFTER', JSON.stringify(after));
    console.log('RESTORE_OK');
  } catch (e) {
    await conn.rollback();
    console.error('ROLLBACK', e.message);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}
main();
