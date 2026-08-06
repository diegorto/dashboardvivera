const fs = require('fs');
const file = 'public/detail.html';
const src = fs.readFileSync(file, 'utf8');
const lines = src.split('\n');

function findLine(needle) {
  const idx = lines.findIndex(l => l.indexOf(needle) !== -1);
  if (idx === -1) { console.log('NOT_FOUND: ' + needle); process.exit(1); }
  return idx;
}

const idxPageSubHtml = findLine('<p class="page-sub" id="pageSub"');
const idxPageSubJs = findLine("document.getElementById('pageSub').textContent");
const idxLoadDealFn = findLine('async function loadDeal() {');
const idxSecondDCL = findLine('document.addEventListener("DOMContentLoaded"');

const ownerHtml = '        <div id="ownerRow" style="display:flex;align-items:center;gap:6px;margin-top:6px;">\n' +
'          <span style="font-size:12px;color:#666;">Dono do negocio:</span>\n' +
'          <span id="ownerBadge" style="font-weight:600;font-size:13px;">-</span>\n' +
'          <button type="button" class="btn" id="changeOwnerBtn" style="font-size:11px;padding:2px 10px;">Trocar</button>\n' +
'        </div>\n' +
'        <div id="ownerPopover" style="display:none;align-items:center;gap:6px;margin-top:6px;">\n' +
'          <select class="input" id="ownerSelect" style="font-size:13px;padding:4px 8px;max-width:200px;"></select>\n' +
'          <button type="button" class="btn" id="ownerCancelBtn">Cancelar</button>\n' +
'          <button type="button" class="btn btn-primary" id="ownerSaveBtn">Confirmar</button>\n' +
'        </div>';

const ownerJsCall = "    updateOwnerUI();";

const ownerFn = 'function updateOwnerUI() {\n' +
'  const badge = document.getElementById(\'ownerBadge\');\n' +
'  if (badge) badge.textContent = (currentDeal && currentDeal.owner_name) ? currentDeal.owner_name : \'Sem dono\';\n' +
'}\n';

const ownerBlock = 'document.addEventListener(\'DOMContentLoaded\', function() {\n' +
'  const changeOwnerBtn = document.getElementById(\'changeOwnerBtn\');\n' +
'  const ownerPopover = document.getElementById(\'ownerPopover\');\n' +
'  const ownerSelect = document.getElementById(\'ownerSelect\');\n' +
'  const ownerCancelBtn = document.getElementById(\'ownerCancelBtn\');\n' +
'  const ownerSaveBtn = document.getElementById(\'ownerSaveBtn\');\n' +
'  if (changeOwnerBtn) {\n' +
'    changeOwnerBtn.addEventListener(\'click\', async () => {\n' +
'      const users = await _ensureUsersLoaded();\n' +
'      ownerSelect.innerHTML = \'\';\n' +
'      users.forEach(u => {\n' +
'        const opt = document.createElement(\'option\');\n' +
'        opt.value = u.id;\n' +
'        opt.textContent = u.name;\n' +
'        if (currentDeal && currentDeal.sdr_user_id === u.id) opt.selected = true;\n' +
'        ownerSelect.appendChild(opt);\n' +
'      });\n' +
'      ownerPopover.style.display = \'flex\';\n' +
'    });\n' +
'  }\n' +
'  if (ownerCancelBtn) {\n' +
'    ownerCancelBtn.addEventListener(\'click\', () => { ownerPopover.style.display = \'none\'; });\n' +
'  }\n' +
'  if (ownerSaveBtn) {\n' +
'    ownerSaveBtn.addEventListener(\'click\', async () => {\n' +
'      const sel = ownerSelect.options[ownerSelect.selectedIndex];\n' +
'      if (!sel) return;\n' +
'      const newOwnerName = sel.textContent;\n' +
'      const currentOwnerName = (currentDeal && currentDeal.owner_name) ? currentDeal.owner_name : \'sem dono\';\n' +
'      if (!confirm(\'Trocar o dono do negocio de "\' + currentOwnerName + \'" para "\' + newOwnerName + \'"?\')) return;\n' +
'      try {\n' +
'        await api(\'/api/crm/deals/\' + dealId + \'/owner\', { method: \'PATCH\', body: JSON.stringify({ userId: parseInt(sel.value, 10) }) });\n' +
'        showToast(\'Dono do negocio atualizado.\', \'success\');\n' +
'        ownerPopover.style.display = \'none\';\n' +
'        await loadDeal();\n' +
'      } catch (err) {\n' +
'        showToast(err.message, \'error\');\n' +
'      }\n' +
'    });\n' +
'  }\n' +
'});\n';

// Insert from bottom to top so earlier indices stay valid
lines.splice(idxSecondDCL, 0, ownerBlock);
lines.splice(idxLoadDealFn, 0, ownerFn);
lines.splice(idxPageSubJs + 1, 0, ownerJsCall);
lines.splice(idxPageSubHtml + 1, 0, ownerHtml);

fs.writeFileSync(file, lines.join('\n'));
console.log('OK', idxPageSubHtml, idxPageSubJs, idxLoadDealFn, idxSecondDCL);
