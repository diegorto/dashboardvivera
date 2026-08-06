const fs = require('fs');
const files = ['public/agenda.html','public/board.html','public/dashboard.html','public/detail.html','public/duplicados.html','public/index.html','public/stalled.html'];
const anchorA = '<a href="agenda.html" data-match="agenda.html">Atividades</a>';
const newLink = ' <a href="agenda-visual.html" data-match="agenda-visual.html">Agenda (Calendário)</a>';
files.forEach(function(f) {
  let src = fs.readFileSync(f, 'utf8');
  const count = src.split(anchorA).length - 1;
  if (count !== 1) { console.error('SKIP (anchor not unique) ' + f + ' count=' + count); return; }
  src = src.replace(anchorA, anchorA + newLink);
  fs.writeFileSync(f, src);
  console.log('OK ' + f);
});

const pf = 'public/pessoas.html';
let psrc = fs.readFileSync(pf, 'utf8');
const anchorB = '<a href="agenda.html">Atividades</a>';
const countB = psrc.split(anchorB).length - 1;
if (countB === 1) {
  psrc = psrc.replace(anchorB, anchorB + ' <a href="agenda-visual.html">Agenda (Calendário)</a>');
  fs.writeFileSync(pf, psrc);
  console.log('OK ' + pf);
} else {
  console.error('SKIP (anchor not unique) ' + pf + ' count=' + countB);
}
