const fs = require('fs');
const file = 'server.js';
const src = fs.readFileSync(file, 'utf8');
const anchor = "app.get('/api/crm/professionals'";
const idx = src.indexOf(anchor);
if (idx === -1) { console.log('ANCHOR_NOT_FOUND'); process.exit(1); }
const newRoute = `
app.patch('/api/crm/deals/:id/owner', auth, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    const dealId = parseInt(req.params.id, 10)
    const { userId } = req.body || {}
    if (!userId) return res.status(400).json({ success: false, error: 'userId obrigatorio' })
    const [[deal]] = await conn.query('SELECT id, owner_name, sdr_user_id, patient_id FROM deals WHERE id = ?', [dealId])
    if (!deal) return res.status(404).json({ success: false, error: 'Negocio nao encontrado' })
    const [[newOwner]] = await conn.query('SELECT id, name FROM users WHERE id = ? AND active = 1', [userId])
    if (!newOwner) return res.status(400).json({ success: false, error: 'Usuario invalido' })
    if (deal.sdr_user_id === newOwner.id) return res.json({ success: true, unchanged: true })
    await conn.beginTransaction()
    await conn.query('UPDATE deals SET owner_name = ?, sdr_user_id = ? WHERE id = ?', [newOwner.name, newOwner.id, dealId])
    await conn.query('INSERT INTO ownership_history (deal_id, from_owner, to_owner, from_user_id, to_user_id, changed_by_user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [dealId, deal.owner_name, newOwner.name, deal.sdr_user_id, newOwner.id, req.user.id])
    await conn.query('INSERT INTO activities (deal_id, patient_id, user_id, type, content) VALUES (?, ?, ?, ?, ?)',
      [dealId, deal.patient_id, req.user.id, 'owner_change', 'Dono do negocio alterado de "' + (deal.owner_name || 'sem dono') + '" para "' + newOwner.name + '"'])
    await conn.commit()
    res.json({ success: true, ownerName: newOwner.name })
  } catch (e) {
    try { await conn.rollback() } catch (e2) {}
    console.error('owner change error', e)
    res.status(500).json({ success: false, error: 'Erro ao alterar dono do negocio' })
  } finally {
    conn.release()
  }
})

`;
const out = src.slice(0, idx) + newRoute + src.slice(idx);
fs.writeFileSync(file, out);
console.log('OK inserted at', idx);
