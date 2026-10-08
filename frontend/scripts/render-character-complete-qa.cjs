const sharp = require('sharp');
const path = require('node:path');

const output = process.argv[2];
if (!output) throw new Error('Pass an output PNG path');
const root = path.resolve(__dirname, '../src/assets/character');
const outfits = ['base', 'mint', 'peach'];
const hairs = ['classic', 'bob', 'pony'];
const glasses = ['none', 'round', 'square'];
const cellWidth = 256, cellHeight = 384;

(async () => {
  const cells = [];
  for (const outfit of outfits) for (const hair of hairs) for (const glassesItem of glasses) {
    const file = path.join(root, `character-${outfit}-${hair}-${glassesItem}.png`);
    cells.push(await sharp(file).resize(cellWidth, cellHeight).png().toBuffer());
  }
  const composites = cells.map((input, index) => ({ input,
    left: index % 9 * cellWidth, top: Math.floor(index / 9) * cellHeight }));
  await sharp({ create: { width: cellWidth * 9, height: cellHeight * 3,
    channels: 4, background: '#f7f1fc' } }).composite(composites).png().toFile(output);
  console.log(`Rendered ${cells.length} complete combinations to ${output}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
