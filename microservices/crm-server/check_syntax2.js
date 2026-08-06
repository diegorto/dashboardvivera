const fs = require('fs');
const html = fs.readFileSync('public/detail.html', 'utf8');
const parts = html.split('<script>');
let target = null;
for (const p of parts) {
  if (p.indexOf('schedSaveBtn') !== -1) { target = p.split('</script>')[0]; break; }
}
if (!target) { console.log('NO_MATCH'); process.exit(1); }
try {
  new Function(target);
  console.log('SYNTAX_OK, length=' + target.length);
} catch (e) {
  console.log('SYNTAX_ERROR: ' + e.message);
}
