const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const processor = require('./processor');
const photosClient = require('../googlePhotos/photosClient');
const { DATA_DIR } = require('../config');

const COMPOSITES_DIR = path.join(DATA_DIR, 'composites');
if (!fs.existsSync(COMPOSITES_DIR)) fs.mkdirSync(COMPOSITES_DIR, { recursive: true });

const TARGET_HEIGHT = 900;
const LABEL_HEIGHT = 60;

function dateOnly(iso) {
  return (iso || '').slice(0, 10);
}

// Dentro de um grupo de fotos do mesmo dia, pega a de maior nota de qualidade
// (nitidez + brilho equilibrado + olhos abertos).
function bestOf(entries) {
  return entries.reduce((best, e) => (!best || e.qualityScore > best.qualityScore ? e : best), null);
}

// Escolhe a melhor foto do dia mais antigo ("antes") e do dia mais recente ("depois").
function pickBeforeAfter(entries) {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => new Date(a.creationTime) - new Date(b.creationTime));
  const firstDay = dateOnly(sorted[0].creationTime);
  const lastDay = dateOnly(sorted[sorted.length - 1].creationTime);
  if (firstDay === lastDay) return null; // sem intervalo de tempo real pra comparar

  const firstDayEntries = sorted.filter((e) => dateOnly(e.creationTime) === firstDay);
  const lastDayEntries = sorted.filter((e) => dateOnly(e.creationTime) === lastDay);

  return { before: bestOf(firstDayEntries), after: bestOf(lastDayEntries) };
}

function labelSvg(text, width) {
  return Buffer.from(
    `<svg width="${width}" height="${LABEL_HEIGHT}">
      <rect width="100%" height="100%" fill="#111"/>
      <text x="50%" y="50%" font-family="sans-serif" font-size="28" fill="#fff"
        text-anchor="middle" dominant-baseline="middle">${text}</text>
    </svg>`
  );
}

// Baixa, equaliza (auto-contraste/brilho) e redimensiona uma foto pra altura padrao.
async function prepareImage(entry) {
  const mediaItem = await photosClient.getMediaItem(entry.photoId);
  const bytes = await photosClient.downloadPhotoBytes(mediaItem.baseUrl);
  return sharp(bytes)
    .rotate() // aplica orientacao EXIF antes de qualquer coisa
    .resize({ height: TARGET_HEIGHT })
    .normalize() // equaliza contraste/brilho pra ficar comparavel entre fotos de dias diferentes
    .jpeg({ quality: 90 })
    .toBuffer();
}

// Monta a imagem final lado a lado (antes | depois), com legendas e datas.
async function buildBeforeAfter(patientId, pose) {
  const entries = processor.getPatientTimeline(patientId, pose);
  const pair = pickBeforeAfter(entries);
  if (!pair) return null;

  const [beforeBuf, afterBuf] = await Promise.all([
    prepareImage(pair.before),
    prepareImage(pair.after),
  ]);

  const beforeMeta = await sharp(beforeBuf).metadata();
  const afterMeta = await sharp(afterBuf).metadata();
  const halfWidth = Math.max(beforeMeta.width, afterMeta.width);
  const totalWidth = halfWidth * 2;
  const totalHeight = TARGET_HEIGHT + LABEL_HEIGHT;

  const beforeLabel = `Antes - ${dateOnly(pair.before.creationTime)}`;
  const afterLabel = `Depois - ${dateOnly(pair.after.creationTime)}`;

  const composite = await sharp({
    create: { width: totalWidth, height: totalHeight, channels: 3, background: '#fff' },
  })
    .composite([
      { input: beforeBuf, left: Math.round((halfWidth - beforeMeta.width) / 2), top: LABEL_HEIGHT },
      { input: afterBuf, left: halfWidth + Math.round((halfWidth - afterMeta.width) / 2), top: LABEL_HEIGHT },
      { input: labelSvg(beforeLabel, halfWidth), left: 0, top: 0 },
      { input: labelSvg(afterLabel, halfWidth), left: halfWidth, top: 0 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

  const fileName = `${patientId}-${pose || 'todas'}.jpg`;
  fs.writeFileSync(path.join(COMPOSITES_DIR, fileName), composite);

  return { fileName, before: pair.before, after: pair.after };
}

module.exports = { buildBeforeAfter, COMPOSITES_DIR };
