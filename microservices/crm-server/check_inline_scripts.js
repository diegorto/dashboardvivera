const fs = require('fs');
const html = fs.readFileSync('public/agenda-visual.html', 'utf8');
const re = new RegExp('<script(?![^>]*src)[^>]*>([\\s\\S]*?)<\\/script>', 'g');
let m, i = 0, errors = 0;
while ((m = re.exec(html))) {
  i++;
  try { new Function(m[1]); } catch (e) { errors++; console.log('SYNTAX ERROR in block ' + i + ': ' + e.message); }
}
console.log('Checked ' + i + ' inline script blocks, ' + errors + ' errors.');
