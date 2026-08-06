const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'server.js');
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP = FILE + '.bak_activitiesusername_' + ts;

const src = fs.readFileSync(FILE, 'utf8');
fs.writeFileSync(BACKUP, src);
console.log('Backup written to', BACKUP);

const lines = src.split('\n');

function assertLine(idx, mustInclude, label) {
  const line = lines[idx];
  if (line === undefined || line.indexOf(mustInclude) === -1) {
    throw new Error('Assertion failed for ' + label + ' at line ' + (idx + 1) + '. Got: ' + JSON.stringify(line));
  }
}

assertLine(1079, "const [result] = await pool.query(", 'insert open (1080)');
assertLine(1080, "INSERT INTO activities (deal_id, patient_id, user_id, type, content, due_at, subject, duration)", 'insert columns (1081)');
assertLine(1081, "assignedUserId || req.user.id, type || 'note'", 'insert values (1082)');

const replacement = [
"    const finalUserId = assignedUserId || req.user.id",
"    let finalUserName = req.user.name || null",
"    try {",
"      const [[uRow]] = await pool.query('SELECT name FROM users WHERE id = ?', [finalUserId])",
"      if (uRow && uRow.name) finalUserName = uRow.name",
"    } catch (userLookupErr) { console.error('activities user_name lookup error', userLookupErr.message) }",
"    const [result] = await pool.query(",
"      'INSERT INTO activities (deal_id, patient_id, user_id, user_name, type, content, due_at, subject, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',",
"      [dealId || null, pid, finalUserId, finalUserName, type || 'note', finalContent, dueAt || null, subject || null, duration || null])"
];

const newLines = [].concat(lines.slice(0, 1079), replacement, lines.slice(1082));

fs.writeFileSync(FILE, newLines.join('\n'));
console.log('Patched', FILE, '- old lines', lines.length, 'new lines', newLines.length);
