#!/usr/bin/env node
/**
 * Генерирует иконки и iOS splash-экраны из assets-src/icon.svg.
 *   npm run assets
 * Результат кладётся в public/icons и public/splash и коммитится в репозиторий.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { IOS_DEVICES, splashName, BRAND } from './ios-devices.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = await readFile(root + 'assets-src/icon.svg', 'utf8');
await mkdir(root + 'public/icons', { recursive: true });
await mkdir(root + 'public/splash', { recursive: true });

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png({ compressionLevel: 9 });

// Иконки: квадратные, без прозрачности (iOS заливает прозрачное чёрным)
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon-180.png', 180],
]) {
  await png(src, size)
    .flatten({ background: BRAND.accent })
    .toFile(root + 'public/icons/' + name);
}

// Maskable: уменьшаем рисунок до безопасной зоны (~80%), фон — на весь квадрат
const maskable = src.replace(
  /<g transform="rotate\(-30 512 512\)"/,
  '<g transform="translate(512 512) scale(.82) translate(-512 -512) rotate(-30 512 512)"',
);
await png(maskable, 512).toFile(root + 'public/icons/maskable-512.png');

// favicon.svg — со скруглёнными углами
const favicon = src
  .replace(
    '<rect width="1024" height="1024" fill="url(#g)"/>',
    '<rect width="1024" height="1024" rx="230" fill="url(#g)"/>',
  )
  .replace('<circle cx="900" cy="130" r="360" fill="#fff" opacity=".12"/>', '');
await writeFile(root + 'public/icons/favicon.svg', favicon);

// Splash-экраны: фон темы, иконка со скруглением и подпись
const iconInner = src.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

function splashSvg(W, H, theme) {
  const c = BRAND[theme];
  const s = Math.round(Math.min(W, H) * 0.26);
  const x = Math.round((W - s) / 2);
  const y = Math.round(H / 2 - s * 0.75);
  const fs = Math.round(s * 0.2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${c.bg}"/>
  <defs><clipPath id="r"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.225}"/></clipPath></defs>
  <g clip-path="url(#r)"><svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 1024 1024">${iconInner}</svg></g>
  <text x="${W / 2}" y="${y + s + fs * 2}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700" font-size="${fs}" fill="${c.ink}" letter-spacing="-0.5">Тренировки</text>
</svg>`;
}

let n = 0;
for (const d of IOS_DEVICES) {
  for (const theme of ['light', 'dark']) {
    const W = d.w * d.dpr;
    const H = d.h * d.dpr;
    await sharp(Buffer.from(splashSvg(W, H, theme)))
      .png({ compressionLevel: 9, palette: true })
      .toFile(root + 'public/splash/' + splashName(d, theme));
    n++;
  }
}

console.log(`✓ icons: 5, splash screens: ${n}`);
