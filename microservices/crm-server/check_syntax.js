const fs = require('fs');
const html = fs.readFileSync('public/detail.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (!m) { console.log('NO_MATCH'); process.exit(1); }
try {
  new Function(m[1]);
  console.log('SYNTAX_OK');
} catch (e) {
  console.log('SYNTAX_ERROR: ' + e.message);
}
