const fs = require('fs');

function patchFile(file, edits) {
  const backup = file + '.bak_lastreply_' + Date.now();
  fs.copyFileSync(file, backup);
  let content = fs.readFileSync(file, 'utf8');
  edits.forEach(([anchor, insertFn, label]) => {
    const count = content.split(anchor).length - 1;
    if (count !== 1) throw new Error('ANCHOR NOT UNIQUE (' + count + 'x): ' + label);
    const idx = content.indexOf(anchor);
    content = insertFn(content, idx, anchor);
    console.log('OK: ' + label);
  });
  fs.writeFileSync(file, content);
  console.log('WROTE: ' + file + ' (backup: ' + backup + ')');
}

patchFile('server.js', [
  [
    "const nextBy = Object.fromEntries(actRows.map(r => [r.deal_id, r.next_due]))",
    (content, idx, anchor) => {
      const insertPos = idx + anchor.length;
      const addition = "\n  const [lastReplyRows] = await pool.query(\n    `SELECT wc.deal_id AS deal_id, MAX(wm.created_at) AS last_inbound_at\n     FROM whatsapp_conversations wc\n     JOIN whatsapp_messages wm ON wm.conversation_id = wc.id\n     WHERE wc.deal_id IN (?) AND wm.direction = 'in'\n     GROUP BY wc.deal_id`, [ids])\n  const lastReplyBy = Object.fromEntries(lastReplyRows.map(r => [r.deal_id, r.last_inbound_at]))";
      return content.slice(0, insertPos) + addition + content.slice(insertPos);
    },
    'server.js: insert lastReplyRows batch query in attachCardExtras'
  ],
  [
    "next_activity_at: nextDue, activity_status: activityStatus",
    (content, idx, anchor) => {
      const replacement = anchor + ", last_inbound_at: lastReplyBy[d.id] || null";
      return content.slice(0, idx) + replacement + content.slice(idx + anchor.length);
    },
    'server.js: add last_inbound_at field to card object'
  ]
]);

patchFile('public/board.html', [
  [
    "function formatElapsed(dateStr) {",
    (content, idx) => {
      const addition = "function formatLastReply(iso) {\n        if (!iso) return 'nunca respondeu';\n        const d = new Date(iso);\n        return 'Respondeu: ' + d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });\n      }\n\n      ";
      return content.slice(0, idx) + addition + content.slice(idx);
    },
    'board.html: insert formatLastReply() before formatElapsed()'
  ],
  [
    '<div class="board-card-total-days"',
    (content, idx) => {
      const addition = '<div class="board-card-last-reply" style="font-size:11px;color:#888;margin-bottom:2px;">${formatLastReply(deal.last_inbound_at)}</div>\n        ';
      return content.slice(0, idx) + addition + content.slice(idx);
    },
    'board.html: insert last-reply div above total-days div'
  ]
]);
