const fs = require('fs');
function patchFile(file, edits) {
  const backup = file + '.bak_lastreplylabel_' + Date.now();
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

patchFile('public/detail.html', [
  [
    '<div id="daysSinceContact" style="margin-top:10px;padding:8px 10px;border-radius:8px;background:#fee2e2;font-size:13px;font-weight:700;text-align:center;"></div>',
    (content, idx, anchor) => {
      const insertPos = idx + anchor.length;
      const addition = '\n            <div id="lastReplyLabel" style="margin-top:6px;padding:6px 10px;border-radius:8px;background:#f1f5f9;font-size:12px;font-weight:600;text-align:center;color:#475569;"></div>';
      return content.slice(0, insertPos) + addition + content.slice(insertPos);
    },
    'detail.html: insert lastReplyLabel div after daysSinceContact badge'
  ],
  [
    'function renderDaysSinceContact() {',
    (content, idx) => {
      const addition = "function renderLastReplyLabel() {\n        var el = document.getElementById('lastReplyLabel');\n        if (!el) return;\n        var iso = currentDeal && currentDeal.last_inbound_at;\n        if (!iso) {\n          el.textContent = 'Nunca respondeu';\n          el.style.background = '#fee2e2';\n          el.style.color = '#dc2626';\n          return;\n        }\n        var BR_OFFSET_MS = 3 * 60 * 60 * 1000;\n        var d = new Date(new Date(iso).getTime() - BR_OFFSET_MS);\n        var pad = function (n) { return String(n).padStart(2, '0'); };\n        var formatted = pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());\n        el.textContent = 'Ultima resposta: ' + formatted;\n        el.style.background = '#dcfce7';\n        el.style.color = '#16a34a';\n      }\n\n      ";
      return content.slice(0, idx) + addition + content.slice(idx);
    },
    'detail.html: insert renderLastReplyLabel() before renderDaysSinceContact()'
  ],
  [
    'renderDaysSinceContact();',
    (content, idx, anchor) => {
      const insertPos = idx + anchor.length;
      const addition = '\n      renderLastReplyLabel();';
      return content.slice(0, insertPos) + addition + content.slice(insertPos);
    },
    'detail.html: insert renderLastReplyLabel() call after renderDaysSinceContact()'
  ]
]);
