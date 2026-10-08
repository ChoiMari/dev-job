// Optional art export. Run with a Node runtime that provides sharp in NODE_PATH.
// The source files are complete imagegen edits, one per outfit/hair/glasses tuple.
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '../../docs/assets/b09-complete-source');
const output = path.resolve(__dirname, '../src/assets/character');
const outfits = ['base', 'mint', 'peach'];
const hairs = ['classic', 'bob', 'pony'];
const glasses = ['none', 'round', 'square'];
fs.mkdirSync(output, { recursive: true });

async function exportAppearance(name) {
  const file = path.join(source, `${name}.png`);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 1024 || info.height !== 1536 || info.channels !== 4)
    throw new Error(`Unexpected canvas: ${name}`);
  // Remove faint transparent backdrop left by image generation. Preserve the
  // finished character pixels; no layer composition is used in the UI.
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= 180 ? 255 : 0;
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png().toFile(path.join(output, `${name}.png`));
}

async function thumbnail(name, crop, destination) {
  await sharp(path.join(output, `${name}.png`)).extract(crop)
    .resize(256, 256, { fit: 'contain', background: '#00000000' })
    .png().toFile(path.join(output, destination));
}

(async () => {
  for (const outfit of outfits) for (const hair of hairs) for (const glassesItem of glasses)
    await exportAppearance(`character-${outfit}-${hair}-${glassesItem}`);
  for (const hair of hairs)
    await thumbnail(`character-base-${hair}-none`, { left: 155, top: 35, width: 714, height: 650 }, `thumb-hair-${hair}.png`);
  for (const glassesItem of glasses)
    await thumbnail(`character-base-classic-${glassesItem}`, { left: 250, top: 250, width: 524, height: 380 }, `thumb-glasses-${glassesItem}.png`);
  console.log('Exported 27 complete characters and 6 matching selection thumbnails.');
})().catch(error => { console.error(error); process.exitCode = 1; });
