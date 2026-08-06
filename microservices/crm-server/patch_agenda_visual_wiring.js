const fs = require('fs');
const file = 'public/agenda-visual.html';
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
  "select: function(info) { openEventModal({ start: info.start, end: info.end }); calendar.unselect(); },",
  "select: function(info) { if (reschedulingEvent) { completeReschedule(info.start, info.end); calendar.unselect(); return; } openEventModal({ start: info.start, end: info.end }); calendar.unselect(); },",
  "select handler - reschedule aware"
);

replaceOnce(
  "openEventModal({ start: start, end: end });",
  "if (reschedulingEvent) { completeReschedule(start, end); return; } openEventModal({ start: start, end: end });",
  "dateClick handler - reschedule aware"
);

replaceOnce(
  "eventResize: function(info) { persistEventMove(info.event); }",
  "eventResize: function(info) { persistEventMove(info.event); },\n      eventContent: renderEventContent",
  "register eventContent renderer"
);

replaceOnce(
  "document.getElementById('evDeleteBtn').style.display = 'inline-block';",
  "document.getElementById('evDeleteBtn').style.display = 'inline-block';\n      document.getElementById('evQuickStatusRow').style.display = 'block';\n      selectedLikelihood = (ev.extendedProps && ev.extendedProps.attendanceLikelihood) || null;\n      renderLikelihoodButtons();",
  "openEventModal existing branch - quick status + likelihood"
);

replaceOnce(
  "document.getElementById('evDeleteBtn').style.display = 'none';",
  "document.getElementById('evDeleteBtn').style.display = 'none';\n      document.getElementById('evQuickStatusRow').style.display = 'none';\n      selectedLikelihood = null;\n      renderLikelihoodButtons();",
  "openEventModal new branch - hide quick status + reset likelihood"
);

replaceOnce(
  "dealId: selectedDealId\n",
  "dealId: selectedDealId,\n      attendanceLikelihood: selectedLikelihood\n",
  "submitEvent payload - attendanceLikelihood"
);

fs.writeFileSync(file, content);
console.log('DONE part 3 - wiring (' + changes + ' changes).');
