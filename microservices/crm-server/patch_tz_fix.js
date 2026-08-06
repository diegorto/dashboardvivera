const fs = require('fs');
const file = 'crm-ui-api.js';
let src = fs.readFileSync(file, 'utf8');

const anchor0 = "function toMysqlDatetime(iso) {";
if ((src.split(anchor0).length - 1) !== 1) { console.error('ANCHOR0_NOT_UNIQUE'); process.exit(1); }
const helper = "function formatNaive(d) {\n  if (!d) return null;\n  const dt = (d instanceof Date) ? d : new Date(d);\n  if (isNaN(dt.getTime())) return null;\n  const pad = function(n){ return String(n).padStart(2,'0'); };\n  return dt.getFullYear() + '-' + pad(dt.getMonth()+1) + '-' + pad(dt.getDate()) + 'T' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());\n}\n\n" + anchor0;
src = src.replace(anchor0, helper);

const anchor1 = 'start: r.start_at,\n        end: r.end_at,';
if ((src.split(anchor1).length - 1) !== 1) { console.error('ANCHOR1_NOT_UNIQUE'); process.exit(1); }
src = src.replace(anchor1, 'start: formatNaive(r.start_at),\n        end: formatNaive(r.end_at),');

const anchor2 = "start: { dateTime: new Date(row.start_at).toISOString(), timeZone: 'America/Sao_Paulo' },\n    end: { dateTime: new Date(row.end_at).toISOString(), timeZone: 'America/Sao_Paulo' },";
if ((src.split(anchor2).length - 1) !== 1) { console.error('ANCHOR2_NOT_UNIQUE'); process.exit(1); }
src = src.replace(anchor2, "start: { dateTime: formatNaive(row.start_at), timeZone: 'America/Sao_Paulo' },\n    end: { dateTime: formatNaive(row.end_at), timeZone: 'America/Sao_Paulo' },");

fs.writeFileSync(file, src);
console.log('TZ_FIX_PATCH_OK');
