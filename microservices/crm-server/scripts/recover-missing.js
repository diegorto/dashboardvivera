require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const CODE = process.env.TINTIM_ACCOUNT_CODE;
const TOKEN = process.env.TINTIM_ACCOUNT_TOKEN;
const SECRET = process.env.TINTIM_WEBHOOK_SECRET;
const phones = fs.readFileSync('/tmp/missing_phones2.txt', 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function run() {
  let created = 0, notfound = 0, errors = 0, skipped = 0;
  const log = [];
  for (const phone of phones) {
    if (!/^55\d{10,11}$/.test(phone)) { skipped++; log.push(phone + ' SKIP_INVALID'); continue; }
    try {
      const r = await fetch(`https://s.tintim.app/api/v1/${CODE}/lead/${phone}?token=${TOKEN}`);
      if (r.status === 404) { notfound++; log.push(phone + ' NOTFOUND'); await sleep(200); continue; }
      const lead = await r.json();
      if (!lead || (!lead.phone && !lead.name)) { notfound++; log.push(phone + ' EMPTY'); await sleep(200); continue; }
      const payload = Object.assign({}, lead, { event_type: 'lead.create' });
      const r2 = await fetch('https://crm.viveraorofacial.com.br:8443/api/crm/webhooks/tintim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': SECRET },
        body: JSON.stringify(payload)
      });
      const res2 = await r2.json().catch(() => ({}));
      if (r2.ok && res2.success) { created++; log.push(phone + ' OK patientId=' + res2.patientId + ' created=' + res2.created); }
      else { errors++; log.push(phone + ' WEBHOOK_ERR ' + JSON.stringify(res2)); }
    } catch (e) { errors++; log.push(phone + ' ERR ' + e.message); }
    await sleep(350);
  }
  fs.writeFileSync('/tmp/recover_log.txt', log.join('\n'));
  console.log(JSON.stringify({ total: phones.length, created, notfound, errors, skipped }));
}
run();
