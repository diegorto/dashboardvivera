const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'public', 'detail.html');
const backup = file + '.bak_agendarconsulta_' + Date.now();
const original = fs.readFileSync(file, 'utf8');
fs.writeFileSync(backup, original);

let content = original;

function assertUnique(str, label) {
  const count = content.split(str).length - 1;
  if (count !== 1) { throw new Error(label + ' nao e unico no arquivo (count=' + count + ')'); }
}

// 1) Botao 'Agendar consulta' ao lado dos botoes existentes
const buttonAnchor = '<button class="btn btn-primary" id="openScheduleActivityBtn" type="button" style="font-size:12px;">+ Agendar atividade</button>';
assertUnique(buttonAnchor, 'buttonAnchor');

const newButton = '\n<button class="btn" id="openScheduleConsultBtn" type="button" style="font-size:12px;background:#dcfce7;border-color:#16a34a;color:#15803d;display:inline-flex;align-items:center;gap:6px;">' +
'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>' +
'<span>Agendar consulta</span></button>';

content = content.replace(buttonAnchor, buttonAnchor + newButton);

// 2) Modal 'Agendar consulta' (mesmo padrao visual dos outros modais: .modal-overlay/.modal-box)
const modalAnchor = '<div class="modal-overlay" id="callAnsweredModal" style="display:none;">';
assertUnique(modalAnchor, 'modalAnchor');

const newModal = '\n<div class="modal-overlay" id="consultScheduleModal" style="display:none;">\n' +
'<div class="modal-box" style="max-width:540px;">\n' +
'<div class="section-title">Agendar consulta</div>\n' +
'<div id="consultDealHeader" style="font-size:13px;color:#666;margin:-8px 0 16px;"></div>\n' +
'<div class="field">\n<label>Dia da semana</label>\n<div id="consultWeekdayPicker" style="display:flex;gap:6px;flex-wrap:wrap;"></div>\n</div>\n' +
'<div class="field">\n<label>Horarios disponiveis</label>\n<div id="consultSlotsContainer" style="max-height:320px;overflow-y:auto;">\n<p style="font-size:13px;color:#888;margin:8px 0;">Selecione um dia da semana acima para ver os horarios disponiveis.</p>\n</div>\n</div>\n' +
'<div class="stage-popover-actions">\n<button class="btn" id="consultCancelBtn">Cancelar</button>\n</div>\n' +
'</div>\n</div>\n';

content = content.replace(modalAnchor, newModal + modalAnchor);

// 3) Script com a logica de dias/horarios/criacao do compromisso, reaproveitando api()/showToast()/getUser()/currentDeal ja definidos em app.js e no proprio detail.html
const scriptAnchor = '</body>';
assertUnique(scriptAnchor, 'scriptAnchor');

const newScript = `
<script>
(function () {
  var CONSULT_BUSINESS_START_HOUR = 9;
  var CONSULT_BUSINESS_END_HOUR = 18;
  var CONSULT_SLOT_MINUTES = 30;
  var WEEKDAYS = [
    { label: 'Seg', dow: 1 },
    { label: 'Ter', dow: 2 },
    { label: 'Qua', dow: 3 },
    { label: 'Qui', dow: 4 },
    { label: 'Sex', dow: 5 }
  ];
  var selectedWeekdayDow = null;
  function pad2(n) { return String(n).padStart(2, '0'); }
  function toLocalNaive(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':00';
  }
  function fmtDateShort(d) {
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1);
  }
  function fmtWeekdayDate(d) {
    var weekNames = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
    return weekNames[d.getDay()] + ' ' + fmtDateShort(d);
  }
  function nextOccurrences(dow, count) {
    var results = [];
    var cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    if (cursor.getDay() === dow) {
      var now = new Date();
      var lastSlotStart = new Date(cursor);
      lastSlotStart.setHours(CONSULT_BUSINESS_END_HOUR, 0, 0, 0);
      lastSlotStart.setMinutes(lastSlotStart.getMinutes() - CONSULT_SLOT_MINUTES);
      if (now > lastSlotStart) { cursor.setDate(cursor.getDate() + 1); }
    } else {
      cursor.setDate(cursor.getDate() + 1);
    }
    while (results.length < count) {
      if (cursor.getDay() === dow) {
        results.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 7);
      } else {
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return results;
  }
  function buildDaySlots(dateAtMidnight) {
    var slots = [];
    var isToday = (new Date()).toDateString() === dateAtMidnight.toDateString();
    var now = new Date();
    var cursor = new Date(dateAtMidnight);
    cursor.setHours(CONSULT_BUSINESS_START_HOUR, 0, 0, 0);
    var end = new Date(dateAtMidnight);
    end.setHours(CONSULT_BUSINESS_END_HOUR, 0, 0, 0);
    while (cursor < end) {
      var slotStart = new Date(cursor);
      var slotEnd = new Date(cursor.getTime() + CONSULT_SLOT_MINUTES * 60000);
      if (!(isToday && slotStart <= now)) {
        slots.push({ start: slotStart, end: slotEnd });
      }
      cursor = slotEnd;
    }
    return slots;
  }
  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && aEnd > bStart;
  }
  async function fetchBusyEvents(dentistUserId, rangeStart, rangeEnd) {
    var params = new URLSearchParams({
      start: toLocalNaive(rangeStart),
      end: toLocalNaive(rangeEnd),
      dentistUserId: dentistUserId
    });
    var data = await api('/api/crm/ui/calendar-events?' + params.toString());
    return (data.events || []).map(function (ev) {
      return { start: new Date(ev.start), end: new Date(ev.end) };
    });
  }
  function renderDealHeader() {
    var el = document.getElementById('consultDealHeader');
    if (!el) return;
    if (!currentDeal) { el.textContent = ''; return; }
    var patient = currentDeal.patient_name || 'Paciente';
    el.textContent = patient + ' · Negocio #' + currentDeal.id + ' · Consulta · ' + CONSULT_SLOT_MINUTES + ' min';
  }
  function renderWeekdayPicker() {
    var wrap = document.getElementById('consultWeekdayPicker');
    if (!wrap) return;
    wrap.innerHTML = WEEKDAYS.map(function (w) {
      var active = (selectedWeekdayDow === w.dow);
      return '<button type="button" class="btn consult-weekday-btn" data-dow="' + w.dow + '" style="padding:6px 14px;border-radius:999px;' +
        (active ? 'background:#16a34a;border-color:#16a34a;color:#fff;' : 'background:#fff;') + '">' + w.label + '</button>';
    }).join('');
    wrap.querySelectorAll('.consult-weekday-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedWeekdayDow = parseInt(btn.getAttribute('data-dow'), 10);
        renderWeekdayPicker();
        loadSlotsForSelectedWeekday();
      });
    });
  }
  async function loadSlotsForSelectedWeekday() {
    var container = document.getElementById('consultSlotsContainer');
    if (!container || selectedWeekdayDow === null) return;
    container.innerHTML = '<p style="font-size:13px;color:#888;margin:8px 0;">Carregando horarios...</p>';
    try {
      var dates = nextOccurrences(selectedWeekdayDow, 4);
      var dentistUserId = (getUser() && getUser().id) || null;
      var rangeStart = new Date(dates[0]);
      var rangeEnd = new Date(dates[dates.length - 1]);
      rangeEnd.setHours(23, 59, 59, 999);
      var busy = await fetchBusyEvents(dentistUserId, rangeStart, rangeEnd);
      var html = '';
      dates.forEach(function (date, idx) {
        var slots = buildDaySlots(date).filter(function (slot) {
          return !busy.some(function (b) { return overlaps(slot.start, slot.end, b.start, b.end); });
        });
        var isNearest = (idx === 0);
        html += '<div style="margin-bottom:14px;">';
        html += '<div style="font-size:12px;font-weight:600;margin-bottom:6px;' + (isNearest ? 'color:#16a34a;' : 'color:#555;') + '">' + fmtWeekdayDate(date) + (isNearest ? ' (mais proximo)' : '') + '</div>';
        if (!slots.length) {
          html += '<div style="font-size:12px;color:#999;">Sem horarios livres neste dia.</div>';
        } else {
          html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
          slots.forEach(function (slot) {
            var iso = toLocalNaive(slot.start);
            var label = pad2(slot.start.getHours()) + ':' + pad2(slot.start.getMinutes());
            html += '<button type="button" class="btn consult-slot-btn" data-start="' + iso + '" style="padding:6px 10px;font-size:12px;' +
              (isNearest ? 'background:#dcfce7;border-color:#16a34a;color:#15803d;' : 'background:#fff;') + '">' + label + '</button>';
          });
          html += '</div>';
        }
        html += '</div>';
      });
      container.innerHTML = html || '<p style="font-size:13px;color:#888;">Nenhum horario disponivel.</p>';
      container.querySelectorAll('.consult-slot-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { bookSlot(btn.getAttribute('data-start')); });
      });
    } catch (e) {
      container.innerHTML = '<p style="font-size:13px;color:#e5484d;">Erro ao carregar horarios: ' + (e.message || e) + '</p>';
    }
  }
  async function bookSlot(startIso) {
    if (!currentDeal) return;
    var start = new Date(startIso);
    var end = new Date(start.getTime() + CONSULT_SLOT_MINUTES * 60000);
    var dentistUserId = (getUser() && getUser().id) || null;
    var title = 'Consulta - ' + (currentDeal.patient_name || currentDeal.title || ('Negocio #' + currentDeal.id));
    try {
      await api('/api/crm/ui/calendar-events', {
        method: 'POST',
        body: JSON.stringify({
          title: title,
          description: null,
          startAt: toLocalNaive(start),
          endAt: toLocalNaive(end),
          dentistUserId: dentistUserId,
          dealId: currentDeal.id
        })
      });
      var modalEl = document.getElementById('consultScheduleModal');
      if (modalEl) modalEl.style.display = 'none';
      showToast('Consulta agendada para ' + fmtDateShort(start) + ' as ' + pad2(start.getHours()) + ':' + pad2(start.getMinutes()) + '.', 'success');
      if (typeof loadDeal === 'function') { await loadDeal(); }
    } catch (e) {
      showToast(e.message || 'Erro ao agendar consulta', 'error');
    }
  }
  document.addEventListener('DOMContentLoaded', function () {
    var openBtn = document.getElementById('openScheduleConsultBtn');
    var cancelBtn = document.getElementById('consultCancelBtn');
    var modal = document.getElementById('consultScheduleModal');
    if (openBtn) {
      openBtn.addEventListener('click', function () {
        selectedWeekdayDow = null;
        renderDealHeader();
        renderWeekdayPicker();
        var cont = document.getElementById('consultSlotsContainer');
        if (cont) cont.innerHTML = '<p style="font-size:13px;color:#888;margin:8px 0;">Selecione um dia da semana acima para ver os horarios disponiveis.</p>';
        if (modal) modal.style.display = 'flex';
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () { if (modal) modal.style.display = 'none'; });
    }
  });
})();
</script>
`;

content = content.replace(scriptAnchor, newScript + scriptAnchor);

fs.writeFileSync(file, content);
console.log('OK - patched detail.html. Backup em ' + backup);
