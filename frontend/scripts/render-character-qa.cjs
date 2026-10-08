const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.join(__dirname, '../src/assets/character');
const output = process.argv[2];
if (!output) throw new Error('Pass an output PNG path');
const outfits = ['base', 'mint', 'peach'];
const hairs = ['classic', 'bob', 'pony'];
const glasses = ['none', 'round', 'square'];
const width = 1024, height = 1536, cellWidth = 256, cellHeight = 384;
const png = name => fs.readFileSync(path.join(root, `${name}.png`));
const render = async names => {
  const layers = names.map(name => ({ input: png(name), left: 0, top: 0 }));
  const full = await sharp({ create: { width, height, channels: 4, background: '#ffffff00' } })
    .composite(layers).png().toBuffer();
  return sharp(full).resize(cellWidth, cellHeight, { kernel: 'nearest' }).png().toBuffer();
};

(async () => {
  const cells = [];
  for (const outfit of outfits) for (const hair of hairs) for (const glassesItem of glasses) {
    const names = [`layer-hair-${hair}-back`, 'layer-body', `layer-outfit-${outfit}`,
      `layer-hair-${hair}-front`, ...(glassesItem === 'none' ? [] : [`layer-glasses-${glassesItem}`])];
    cells.push(await render(names));
  }
  const sheetWidth = cellWidth * 9, sheetHeight = cellHeight * 3;
  const composites = cells.map((input, index) => ({
    input, left: (index % 9) * cellWidth, top: Math.floor(index / 9) * cellHeight,
  }));
  await sharp({ create: { width: sheetWidth, height: sheetHeight, channels: 4, background: '#f7f1fc' } })
    .composite(composites).png().toFile(output);
  console.log(`Rendered ${cells.length} combinations to ${output}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
