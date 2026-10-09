// Optional art export. Run with a Node runtime that provides sharp in NODE_PATH.
// AI generated source layers live in docs/assets/b09-layer-source; this step only
// removes low-alpha generation halos and registers them to the shared canvas.
const sharp = require('sharp');
const path = require('node:path');
const fs = require('node:fs');

const WIDTH = 1024, HEIGHT = 1536;
const source = path.resolve(__dirname, '../../docs/assets/b09-layer-source');
const output = path.resolve(__dirname, '../src/assets/character');
fs.mkdirSync(output, { recursive: true });

const art = [
  ['body', 'layer-body', 1, 0, 0],
  ['outfit-base', 'layer-outfit-base', 1, 0, 0],
  ['outfit-mint', 'layer-outfit-mint', 1, 0, 0],
  ['outfit-peach', 'layer-outfit-peach', .85, 77, 220],
  ['hair-classic-back', 'layer-hair-classic-back', .82, 92, -103],
  ['hair-classic-front', 'layer-hair-classic-front', 1, 0, 0],
  ['hair-bob-back', 'layer-hair-bob-back', .8, 102, -141],
  ['hair-bob-front', 'layer-hair-bob-front', .8, 102, -141],
  ['hair-pony-back', 'layer-hair-pony-back', .72, 143, -75],
  ['hair-pony-front', 'layer-hair-pony-front', .72, 143, -75],
  ['glasses-round', 'layer-glasses-round', .49, 261, 64],
  ['glasses-square', 'layer-glasses-square', .48, 266, 161],
];

async function registered(input, scale, left, top) {
  const width = Math.round(WIDTH * scale), height = Math.round(HEIGHT * scale);
  const resized = await sharp(path.join(source, `${input}.png`))
    .resize(width, height, { kernel: 'nearest' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = resized.data;
  // The original artwork uses opaque pixel edges. Drop faint image-generation
  // glow without changing colors or redrawing any part of the supplied art.
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = pixels[i] >= 180 ? 255 : 0;
  const sourceImage = await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const cropLeft = Math.max(0, -left), cropTop = Math.max(0, -top);
  const cropWidth = Math.min(width - cropLeft, WIDTH - Math.max(0, left));
  const cropHeight = Math.min(height - cropTop, HEIGHT - Math.max(0, top));
  const visible = await sharp(sourceImage).extract({ left: cropLeft, top: cropTop,
    width: cropWidth, height: cropHeight }).png().toBuffer();
  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: '#00000000' } })
    .composite([{ input: visible, left: Math.max(0, left), top: Math.max(0, top) }]).png().toBuffer();
}

async function hairThumbnail(hair) {
  const back = fs.readFileSync(path.join(output, `layer-hair-${hair}-back.png`));
  const front = fs.readFileSync(path.join(output, `layer-hair-${hair}-front.png`));
  const merged = await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: '#00000000' } })
    .composite([{ input: back }, { input: front }]).png().toBuffer();
  await sharp(merged).extract({ left: 50, top: 0, width: 924, height: 820 })
    .resize(256, 256, { fit: 'contain', background: '#00000000' })
    .png().toFile(path.join(output, `thumb-hair-${hair}.png`));
}

async function glassesThumbnail(kind) {
  const input = path.join(output, `layer-glasses-${kind}.png`);
  await sharp(input).extract({ left: 280, top: 325, width: 464, height: 200 })
    .resize(256, 256, { fit: 'contain', background: '#00000000' })
    .png().toFile(path.join(output, `thumb-glasses-${kind}.png`));
}

(async () => {
  for (const [input, name, scale, left, top] of art)
    fs.writeFileSync(path.join(output, `${name}.png`), await registered(input, scale, left, top));
  for (const hair of ['classic', 'bob', 'pony']) await hairThumbnail(hair);
  for (const glasses of ['round', 'square']) await glassesThumbnail(glasses);
  const noGlasses = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" shape-rendering="crispEdges"><circle cx="128" cy="128" r="82" fill="none" stroke="#4b335c" stroke-width="13"/><path d="M69 187 187 69" stroke="#4b335c" stroke-width="13"/></svg>`;
  await sharp(Buffer.from(noGlasses)).png().toFile(path.join(output, 'thumb-glasses-none.png'));
  console.log('Registered 12 transparent layers and 6 selection thumbnails.');
})().catch(error => { console.error(error); process.exitCode = 1; });
