const pool = require('./db');

const BR_OFFSET_MS = 3 * 60 * 60 * 1000;
function brDayStartUtc(dateStr) {
  return new Date(new Date(dateStr + 'T00:00:00.000Z').getTime() + BR_OFFSET_MS);
}
function brRangeToUtc(fromDate, toDate) {
  const fromUtc = brDayStartUtc(fromDate);
  const toUtc = new Date(brDayStartUtc(toDate).getTime() + 24*60*60*1000 - 1000);
  const fmt = d => d.toISOString().slice(0,19).replace('T',' ');
  return { fromDt: fmt(fromUtc), toDt: fmt(toUtc) };
}

async function main() {
  const { fromDt, toDt } = brRangeToUtc('2026-07-20', '2026-07-20');
  console.log('RANGE', fromDt, toDt);

  console.log('\n=== RAW ORCAMENTO GERADO ACTIVITIES (any pipeline) for Agda/Helenice, Jul20 BRT ===');
  const [acts] = await pool.query(
    `SELECT a.id, a.deal_id, d.owner_name, d.pipeline_id, d.title, a.amount, a.created_at, a.content
     FROM activities a JOIN deals d ON d.id = a.deal_id
     WHERE a.type = 'Orcamento Gerado' AND d.owner_name IN ('Agda','Helenice')
     AND a.created_at BETWEEN ? AND ?
     ORDER BY d.owner_name, a.deal_id, a.created_at`,
    [fromDt, toDt]
  );
  acts.forEach(r => console.log(r.owner_name, '| pipeline', r.pipeline_id, '| deal', r.deal_id, '|', r.title, '| R$', r.amount, '|', r.created_at, '|', (r.content||'').substring(0,60)));
  console.log('count:', acts.length);

  console.log('\n=== RAW WON DEALS (any pipeline) for Agda/Helenice, won_date Jul20 BRT ===');
  const [won] = await pool.query(
    `SELECT id, owner_name, pipeline_id, title, value, won_date, add_date
     FROM deals
     WHERE owner_name IN ('Agda','Helenice') AND status='won'
     AND won_date BETWEEN ? AND ?
     ORDER BY owner_name, won_date`,
    [fromDt, toDt]
  );
  won.forEach(r => console.log(r.owner_name, '| pipeline', r.pipeline_id, '| deal', r.id, '|', r.title, '| R$', r.value, '| won_date', r.won_date, '| add_date', r.add_date));
  console.log('count:', won.length);

  console.log('\n=== pipelines table ===');
  const [pls] = await pool.query('SELECT id, slug, name, active FROM pipelines ORDER BY id');
  pls.forEach(p => console.log(p.id, p.slug, p.name, 'active:', p.active));

  process.exit(0);
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
