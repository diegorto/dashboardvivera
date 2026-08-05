const pool = require('./db');

(async () => {
  try {
    const [[row]] = await pool.query('SELECT config_value FROM chatbot_ai_config WHERE id=2');
    const orig = row.config_value;

    const anchor = 'sempre R$590.\n\nQualquer OUTRO procedimento';
    const count = orig.split(anchor).length - 1;
    if (count !== 1) {
      console.log('ANCHOR_COUNT_' + count + '_ABORTING');
      process.exit(1);
    }

    const newParagraph = 'COMO EXPLICAR O EXOJET (resposta breve, só quando perguntarem diretamente\n"o que é o Exojet" ou similar): o Exojet promove uma regeneração da pele\natravés da revitalização das próprias células que produzem colágeno.\nAtualmente a Vivera trabalha com uma edição especial de GHK-Cu associada\nao DNA de salmão e ao exossomo, que potencializam de forma acelerada a\nmelhora da textura da pele. Resultado: pacientes que fazem com\nregularidade estão abandonando a maquiagem corretiva do dia a dia. Essa\nexplicação deve ser sempre breve e direta — nunca vire uma aula técnica;\nse fizer sentido, continue a investigação logo em seguida.';

    const replacement = 'sempre R$590.\n\n' + newParagraph + '\n\nQualquer OUTRO procedimento';

    const updated = orig.replace(anchor, replacement);

    if (process.argv[2] === '--dry-run') {
      console.log('DRY_RUN_OK anchorCount=' + count + ' origLen=' + orig.length + ' newLen=' + updated.length);
      console.log('--- PREVIEW START ---');
      console.log(updated.substring(orig.indexOf(anchor) - 50, orig.indexOf(anchor) + replacement.length + 50));
      console.log('--- PREVIEW END ---');
      process.exit(0);
    }

    const [result] = await pool.query('UPDATE chatbot_ai_config SET config_value = ? WHERE id = 2', [updated]);
    console.log('UPDATE_OK affectedRows=' + result.affectedRows + ' origLen=' + orig.length + ' newLen=' + updated.length);
    process.exit(0);
  } catch (e) {
    console.log('ERR:' + e.message);
    process.exit(1);
  }
})();
