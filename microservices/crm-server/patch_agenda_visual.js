const fs = require('fs');
const file = 'public/agenda-visual.html';
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

// 1. Insert new HTML block (likelihood selector + quick status actions) before the existing button row
replaceOnce(
  '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">',
  '<div class="modal-field">\n          <label>Probabilidade de comparecimento</label>\n          <div style="display:flex;gap:8px;" id="evLikelihoodGroup">\n            <button type="button" class="btn likelihood-btn" data-val="quente" onclick="selectLikelihood(\'quente\')">Quente</button>\n            <button type="button" class="btn likelihood-btn" data-val="morno" onclick="selectLikelihood(\'morno\')">Morno</button>\n            <button type="button" class="btn likelihood-btn" data-val="frio" onclick="selectLikelihood(\'frio\')">Frio</button>\n          </div>\n        </div>\n        <div id="evQuickStatusRow" style="display:none;border-top:1px solid #eee;margin-top:10px;padding-top:10px;">\n          <label style="display:block;margin-bottom:6px;font-size:13px;color:#666;">Status rapido</label>\n          <div style="display:flex;flex-wrap:wrap;gap:8px;">\n            <button type="button" class="btn" style="background:#22c55e;border-color:#16a34a;color:#fff;" onclick="setQuickStatus(\'confirmed\')">Confirmado</button>\n            <button type="button" class="btn" style="background:#d4af37;border-color:#b8960c;color:#fff;" onclick="setQuickStatus(\'attended\')">Compareceu</button>\n            <button type="button" class="btn" style="background:#ec4899;border-color:#db2777;color:#fff;" onclick="setQuickStatus(\'no_show\')">Faltou</button>\n            <button type="button" class="btn" onclick="startReschedule()">Reagendou</button>\n          </div>\n        </div>\n        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">',
  'insert likelihood + quick status HTML block'
);

// 2. Repurpose the old delete button as "Cancelou" (keeps existing show/hide wiring intact)
replaceOnce(
  '<button class="btn" id="evDeleteBtn" style="display:none;color:#c0392b;" onclick="deleteEvent()">Cancelar compromisso</button>',
  '<button class="btn" id="evDeleteBtn" style="display:none;color:#fff;background:#ef4444;border-color:#dc2626;" onclick="openCancelReasonModal()">Cancelou</button>',
  'repurpose evDeleteBtn as Cancelou trigger'
);

// 3. Add cancel-reason modal + likelihood button base styles right after the existing event modal markup
replaceOnce(
  '<script src="app.js"></script>',
  '<div class="modal-overlay" id="cancelReasonModalOverlay" style="display:none;">\n  <div class="modal-box" style="width:420px;max-width:92vw;">\n    <h3>Cancelar compromisso</h3>\n    <div class="modal-field">\n      <label>Motivo do cancelamento</label>\n      <textarea class="input" id="cancelReasonText" rows="3" placeholder="Descreva o motivo..."></textarea>\n    </div>\n    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">\n      <button class="btn" onclick="closeCancelReasonModal()">Voltar</button>\n      <button class="btn btn-primary" style="background:#dc2626;border-color:#dc2626;" onclick="confirmCancelEvent()">Confirmar cancelamento</button>\n    </div>\n  </div>\n</div>\n<style>.likelihood-btn{background:#fff;color:#333;}</style>\n<script src="app.js"></script>',
  'insert cancel-reason modal markup'
);

fs.writeFileSync(file, content);
console.log('DONE part 1 - patched HTML (' + changes + ' changes). Backup: ' + backup);
