const fs = require('fs');
const file = 'crm-ui-api.js';
const backup = file + '.bak_statusfeatures_' + Date.now();
fs.copyFileSync(file, backup);
let content = fs.readFileSync(file, 'utf8');
let changes = 0;

function replaceOnce(oldStr, newStr, label) {
  const count = content.split(oldStr).length - 1;
  if (count === 0) { throw new Error('ANCHOR NOT FOUND: ' + label); }
  if (count !== 1) { throw new Error('ANCHOR NOT UNIQUE (' + count + 'x): ' + label); }
  content = content.replace(oldStr, newStr);
  changes++;
  console.log('OK: ' + label);
}

replaceOnce(
  "AND ce.status <> 'cancelled'",
  "",
  "GET where clause - show all statuses (history)"
);

replaceOnce(
  "app.get('/api/crm/ui/calendar-events', auth, async (req, res) => {",
  "const STATUS_COLORS = { confirmed: { bg: '#22c55e', border: '#16a34a' }, attended: { bg: '#d4af37', border: '#b8960c' }, no_show: { bg: '#ec4899', border: '#db2777' }, cancelled: { bg: '#ef4444', border: '#dc2626' }, rescheduled: { bg: '#94a3b8', border: '#64748b' } };\nconst ALLOWED_STATUS = new Set(['confirmed', 'attended', 'no_show', 'cancelled', 'rescheduled']);\nconst ALLOWED_LIKELIHOOD = new Set(['quente', 'morno', 'frio']);\napp.get('/api/crm/ui/calendar-events', auth, async (req, res) => {",
  "insert STATUS_COLORS / ALLOWED_STATUS / ALLOWED_LIKELIHOOD consts"
);

replaceOnce(
  "end: formatNaive(r.end_at),",
  "end: formatNaive(r.end_at),\n          backgroundColor: (STATUS_COLORS[r.status] || {}).bg,\n          borderColor: (STATUS_COLORS[r.status] || {}).border,",
  "GET events map - add color fields"
);

replaceOnce(
  "patientName: r.patient_name\n",
  "patientName: r.patient_name,\n            cancelReason: r.cancel_reason,\n            attendanceLikelihood: r.attendance_likelihood,\n            rescheduledToId: r.rescheduled_to_id\n",
  "GET extendedProps - add new fields"
);

replaceOnce(
  "const dealId = body.dealId ? parseInt(body.dealId, 10) : null;",
  "const dealId = body.dealId ? parseInt(body.dealId, 10) : null;\n    const attendanceLikelihood = ALLOWED_LIKELIHOOD.has(body.attendanceLikelihood) ? body.attendanceLikelihood : null;",
  "POST - attendanceLikelihood var"
);

replaceOnce(
  "'INSERT INTO calendar_events (deal_id, dentist_user_id, title, description, start_at, end_at, status, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',",
  "'INSERT INTO calendar_events (deal_id, dentist_user_id, title, description, start_at, end_at, status, attendance_likelihood, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',",
  "POST - insert SQL"
);

replaceOnce(
  "[dealId, dentistUserId, title, description, startAt, endAt, 'confirmed', req.user.id]",
  "[dealId, dentistUserId, title, description, startAt, endAt, 'confirmed', attendanceLikelihood, req.user.id]",
  "POST - insert params"
);

replaceOnce(
  "const status = body.status !== undefined ? String(body.status) : existing.status;",
  "const status = (body.status !== undefined && ALLOWED_STATUS.has(String(body.status))) ? String(body.status) : existing.status;\n    const cancelReason = body.cancelReason !== undefined ? String(body.cancelReason) : existing.cancel_reason;\n    const attendanceLikelihood = body.attendanceLikelihood !== undefined ? (ALLOWED_LIKELIHOOD.has(body.attendanceLikelihood) ? body.attendanceLikelihood : null) : existing.attendance_likelihood;\n    const rescheduledToId = body.rescheduledToId !== undefined ? (body.rescheduledToId ? parseInt(body.rescheduledToId, 10) : null) : existing.rescheduled_to_id;",
  "PATCH - new field vars"
);

replaceOnce(
  "'UPDATE calendar_events SET title=?, description=?, start_at=?, end_at=?, deal_id=?, dentist_user_id=?, status=? WHERE id=?',",
  "'UPDATE calendar_events SET title=?, description=?, start_at=?, end_at=?, deal_id=?, dentist_user_id=?, status=?, cancel_reason=?, attendance_likelihood=?, rescheduled_to_id=? WHERE id=?',",
  "PATCH - update SQL"
);

replaceOnce(
  "[title, description, startAt, endAt, dealId, dentistUserId, status, id]",
  "[title, description, startAt, endAt, dealId, dentistUserId, status, cancelReason, attendanceLikelihood, rescheduledToId, id]",
  "PATCH - update params"
);

fs.writeFileSync(file, content);
console.log('DONE - patched crm-ui-api.js (' + changes + ' changes). Backup: ' + backup);
