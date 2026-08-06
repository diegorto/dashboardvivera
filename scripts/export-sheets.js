#!/usr/bin/env node
'use strict';

const fs = require('fs');
const mysql = require('mysql2/promise');
const { google } = require('googleapis');

const ENV_FILE = '/root/dashboardvivera-prod/microservices/crm-server/.env';
const KEY_FILE = '/root/dashboardvivera-prod/microservices/crm-server/.google-sheets-service-account.json';
const SPREADSHEET_ID = '1X6T5NCZnywg6mNRBhFK-nSIdOXUEs0ROpIQ-9dnCOAs';
const MAX_DAY_TABS = 30;
const TABLES = [
  { name: 'deals', label: 'DEALS' },
  { name: 'patients', label: 'PATIENTS' },
  { name: 'activities', label: 'ACTIVITIES' },
];

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function loadEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  content.split('\n').forEach((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  });
  return env;
}

function getBrasiliaParts() {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const map = {};
  parts.forEach((p) => { if (p.type !== 'literal') map[p.type] = p.value; });
  return map;
}

function formatCell(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

async function main() {
  const env = loadEnv(ENV_FILE);
  const parts = getBrasiliaParts();
  const tabName = `${parts.day}-${parts.month}-${parts.year}`;
  const timestamp = `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;

  log(`Iniciando export para Google Sheets - aba "${tabName}"`);

  const conn = await mysql.createConnection({
    host: env.CRM_DB_HOST,
    user: env.CRM_DB_USER,
    password: env.CRM_DB_PASSWORD,
    database: env.CRM_DB_NAME,
  });

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const values = [];
  for (const table of TABLES) {
    const [rows] = await conn.query(`SELECT * FROM \`${table.name}\``);
    const [cols] = await conn.query(`SHOW COLUMNS FROM \`${table.name}\``);
    const columnNames = cols.map((c) => c.Field);

    values.push([`=== ${table.label} — ${rows.length} registro(s) — snapshot ${timestamp} (America/Sao_Paulo) ===`]);
    values.push(columnNames);
    for (const row of rows) {
      values.push(columnNames.map((c) => formatCell(row[c])));
    }
    values.push([]);
    log(`${table.label}: ${rows.length} registros lidos`);
  }

  await conn.end();

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: 'sheets.properties' });
  const existing = meta.data.sheets.find((s) => s.properties.title === tabName);

  if (existing) {
    log(`Aba "${tabName}" ja existe (id ${existing.properties.sheetId}) - limpando antes de reescrever`);
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${tabName}'`,
    });
  } else {
    log(`Criando aba "${tabName}"`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${tabName}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });

  log(`Dados gravados na aba "${tabName}" (${values.length} linhas)`);

  const meta2 = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: 'sheets.properties' });
  const dateTabPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
  const dateTabs = meta2.data.sheets
    .map((s) => s.properties)
    .filter((p) => dateTabPattern.test(p.title))
    .map((p) => {
      const m = p.title.match(dateTabPattern);
      const d = m[1]; const mo = m[2]; const y = m[3];
      return { sheetId: p.sheetId, title: p.title, date: new Date(`${y}-${mo}-${d}T00:00:00`) };
    })
    .sort((a, b) => a.date - b.date);

  if (dateTabs.length > MAX_DAY_TABS) {
    const toDelete = dateTabs.slice(0, dateTabs.length - MAX_DAY_TABS);
    log(`Rotacao: removendo ${toDelete.length} aba(s) antiga(s): ${toDelete.map((t) => t.title).join(', ')}`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: toDelete.map((t) => ({ deleteSheet: { sheetId: t.sheetId } })),
      },
    });
  }

  log('Export para Google Sheets concluido.');
}

main().catch((err) => {
  console.error(`[${new Date().toISOString()}] ERRO no export para Sheets:`, err && err.message ? err.message : err);
  process.exit(1);
});
