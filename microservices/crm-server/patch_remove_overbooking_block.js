const fs = require('fs');
const file = 'public/detail.html';
const backup = file + '.bak_removeoverbookingblock_' + Date.now();
fs.copyFileSync(file, backup);
let content = fs.readFileSync(file, 'utf8');

const oldStr = "var slots = buildDaySlots(date).filter(function (slot) {\n                    return !busy.some(function (b) { return overlaps(slot.start, slot.end, b.start, b.end); });\n                });";
const oldStrAlt = "var slots = buildDaySlots(date).filter(function (slot) {\n                return !busy.some(function (b) { return overlaps(slot.start, slot.end, b.start, b.end); });\n            });";
let matched = null;
if (content.indexOf(oldStr) !== -1) matched = oldStr;
else if (content.indexOf(oldStrAlt) !== -1) matched = oldStrAlt;

if (!matched) {
  // fallback: line-based replace, tolerant of whitespace
  const lines = content.split('\n');
  let idx = lines.findIndex(function(l){ return l.indexOf('buildDaySlots(date).filter(function (slot) {') !== -1; });
  if (idx === -1) throw new Error('ANCHOR NOT FOUND (line scan)');
  // find the matching close for this filter call: next line has overlaps(), the line after has closing '});'
  if (lines[idx+1].indexOf('overlaps(slot.start') === -1) throw new Error('UNEXPECTED STRUCTURE at line ' + (idx+2));
  const indent = lines[idx].match(/^(\s*)/)[1];
  lines[idx] = indent + 'var slots = buildDaySlots(date); // overbooking allowed - trava removida a pedido do Diego (2026-07-28)';
  lines.splice(idx+1, 2); // remove the two lines (overlaps check + closing '});')
  content = lines.join('\n');
} else {
  content = content.replace(matched, 'var slots = buildDaySlots(date); // overbooking allowed - trava removida a pedido do Diego (2026-07-28)');
}

fs.writeFileSync(file, content);
console.log('DONE - patched detail.html. Backup: ' + backup);
