// usage: node montage.mjs out.png img1 img2 ... (in a row, each scaled to height 900)
import sharp from 'sharp';
const [out, ...ins] = process.argv.slice(2);
const H = Number(process.env.H || 900);
const bufs = [];
let x = 0; const comps = [];
for (const f of ins) {
  const b = await sharp(f).resize({ height: H }).png().toBuffer();
  const m = await sharp(b).metadata();
  comps.push({ input: b, left: x, top: 0 }); x += m.width + 12;
}
await sharp({ create: { width: x, height: H, channels: 3, background: '#888' } }).composite(comps).png().toFile(out);
