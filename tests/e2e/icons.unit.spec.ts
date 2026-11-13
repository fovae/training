import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';

/**
 * Иконки приложения (npm run icons → public/icons). Одна иконка на все темы: светлая подложка,
 * тёмная гантель. Полный квадрат без чёрных углов и без прозрачности (iOS скругляет сама).
 */
const root = fileURLToPath(new URL('../../', import.meta.url));
const ICONS = root + 'public/icons/';
const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

async function pixels(file: string) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => {
    const i = (y * info.width + x) * info.channels;
    return luma(data[i]!, data[i + 1]!, data[i + 2]!);
  };
  return { info, at };
}

const SQUARE: [string, number][] = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
];

for (const [name, size] of SQUARE) {
  test(`${name}: ${size}×${size}, full square, no transparency, no black corners`, async () => {
    const { info, at } = await pixels(ICONS + name);
    expect([info.width, info.height]).toEqual([size, size]);
    expect(info.channels).toBe(3);
    const e = size - 1;
    const inset = Math.round(size * 0.04);
    for (const [x, y, nx, ny] of [
      [0, 0, inset, inset],
      [e, 0, e - inset, inset],
      [0, e, inset, e - inset],
      [e, e, e - inset, e - inset],
    ] as const) {
      // угол светлый и почти не отличается от соседней подложки
      expect(at(x, y), `corner ${x},${y}`).toBeGreaterThan(200);
      expect(Math.abs(at(x, y) - at(nx, ny)), `corner ${x},${y} vs backdrop`).toBeLessThanOrEqual(4);
    }
    // гантель на месте: в центре тёмный гриф
    expect(at(size >> 1, size >> 1)).toBeLessThan(90);
  });
}

/** Самая дальняя от центра тёмная точка и центр bounding box тёмного объекта, в долях стороны */
async function dumbbell(name: string) {
  const { info, at } = await pixels(ICONS + name);
  const s = info.width;
  let far = 0;
  let [x0, y0, x1, y1] = [s, s, 0, 0];
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      if (at(x, y) >= 110) continue;
      far = Math.max(far, Math.hypot(x + 0.5 - s / 2, y + 0.5 - s / 2));
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  return { far: far / s, cx: (x0 + x1 + 1) / 2 / s, cy: (y0 + y1 + 1) / 2 / s, w: (x1 - x0 + 1) / s };
}

test('dumbbell is centred by its bounding box and larger than in the source', async () => {
  const d = await dumbbell('icon-512.png');
  expect(Math.abs(d.cx - 0.5)).toBeLessThan(0.006);
  expect(Math.abs(d.cy - 0.5)).toBeLessThan(0.006);
  // в исходнике гантель занимает ~64% ширины; в иконке — на 10–15% больше
  const src = await sharp(root + 'design/icon-source.png').metadata();
  expect(src.width).toBe(src.height);
  expect(d.w).toBeGreaterThan(0.64 * 1.1 - 0.01);
  expect(d.w).toBeLessThan(0.64 * 1.15 + 0.01);
});

test('maskable: the whole dumbbell is inside the central 80% circle (safe zone)', async () => {
  const d = await dumbbell('icon-maskable-512.png');
  expect(d.far).toBeGreaterThan(0.2);
  expect(d.far).toBeLessThanOrEqual(0.4);
});

test('favicons exist; favicon.ico holds 16, 32 and 48', () => {
  const ico = readFileSync(ICONS + 'favicon.ico');
  expect(ico.readUInt16LE(2)).toBe(1);
  const n = ico.readUInt16LE(4);
  expect(Array.from({ length: n }, (_, i) => ico.readUInt8(6 + i * 16))).toEqual([16, 32, 48]);
  const svg = readFileSync(ICONS + 'favicon.svg', 'utf8');
  expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 512 512">/);
  expect(svg).not.toMatch(/<script|<image|href="http/);
});

test('the old orange icon is gone from public/, its source is kept in design/archive', () => {
  expect(readdirSync(ICONS).sort()).toEqual([
    'apple-touch-icon.png',
    'favicon.ico',
    'favicon.svg',
    'icon-192.png',
    'icon-512.png',
    'icon-maskable-512.png',
  ]);
  expect(existsSync(root + 'design/archive/icon-orange.svg')).toBe(true);
  expect(existsSync(root + 'design/icon-source.png')).toBe(true);
  expect(readFileSync(ICONS + 'favicon.svg', 'utf8')).not.toMatch(/#EE7150|#D9502F|#E5603F/i);
});
