#!/usr/bin/env node
/**
 * Иконки приложения и iOS splash-экраны из design/icon-source.png. Запуск: npm run icons
 * Результат (public/icons, public/splash, design/icon-1024.png) коммитится в репозиторий.
 * Повторный запуск на том же исходнике даёт те же файлы.
 *
 * Что делает с исходником (плоская тёмная гантель на светлой подложке, по углам — чёрные поля от
 * бывшего скругления):
 *  1. Находит чёрные углы (заливка от четырёх углов по тёмным пикселям) и закрашивает их цветом
 *     подложки — получается цельный квадрат без чёрного и без прозрачности.
 *  2. Вырезает гантель вместе с мягкой тенью: подложка приближается гладкой поверхностью
 *     (квадратичная аппроксимация по чистым участкам), непрозрачность = насколько пиксель темнее неё.
 *  3. Увеличивает гантель (ICON.scale) и ставит центр её bounding box (без тени) в центр холста.
 *  4. Кладёт на ровный фон: ICON.bgTop → ICON.bgBottom (сейчас чисто белый).
 *  5. Maskable: гантель уменьшена так, чтобы вся целиком была в центральном круге 80%.
 *  6. Проверяет результат (углы не чёрные, квадрат, maskable в круге) и падает при ошибке.
 * Иконка одна на все темы.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { IOS_DEVICES, splashName, BRAND } from './ios-devices.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const SRC = root + 'design/icon-source.png';
const ICONS = root + 'public/icons/';
const SPLASH = root + 'public/splash/';

export const ICON = {
  /** Фон: чисто белый (можно задать вертикальный градиент) */
  bgTop: '#FFFFFF',
  bgBottom: '#FFFFFF',
  /** Гантель крупнее исходной на 12% (ТЗ: 10–15%) */
  scale: 1.12,
  /** Безопасная зона maskable: центральный круг, доля стороны */
  safe: 0.8,
  /** Maskable: гантель целиком в круге такого диаметра (доля стороны) — с запасом до края зоны */
  maskFill: 0.64,
  /** Радиус скругления iOS, доля стороны (для favicon и заставок) */
  iosRadius: 0.2237,
};
const MASTER = 1024;

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lumaOf = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// ---------- чтение исходника ----------

const { data: src, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
if (W !== H) throw new Error(`icons: исходник должен быть квадратным, а он ${W}×${H}`);
const N = W * H;
const L = new Float32Array(N);
for (let i = 0; i < N; i++) L[i] = lumaOf(src[i * 3], src[i * 3 + 1], src[i * 3 + 2]);

/** Яркость подложки — медиана по картинке (подложка занимает больше половины площади) */
const hist = new Uint32Array(256);
for (let i = 0; i < N; i++) hist[Math.round(L[i])]++;
let acc = 0;
let bgMedian = 255;
for (let v = 0; v < 256; v++) {
  acc += hist[v];
  if (acc >= N / 2) {
    bgMedian = v;
    break;
  }
}
const NOT_BG = bgMedian * 0.8;

// ---------- 1. чёрные углы ----------

/** Квадратное расширение маски на r пикселей (два прохода с накопленными суммами) */
function dilate(mask, r) {
  const tmp = new Uint8Array(N);
  const out = new Uint8Array(N);
  const pass = (from, to, len, stride, lines, lineStride) => {
    const pre = new Uint32Array(len + 1);
    for (let l = 0; l < lines; l++) {
      const base = l * lineStride;
      for (let k = 0; k < len; k++) pre[k + 1] = pre[k] + from[base + k * stride];
      for (let k = 0; k < len; k++) {
        const a = Math.max(0, k - r);
        const b = Math.min(len, k + r + 1);
        to[base + k * stride] = pre[b] - pre[a] > 0 ? 1 : 0;
      }
    }
  };
  pass(mask, tmp, W, 1, H, W);
  pass(tmp, out, H, W, W, 1);
  return out;
}

const corner = new Uint8Array(N);
{
  const stack = [0, W - 1, (H - 1) * W, N - 1];
  while (stack.length) {
    const i = stack.pop();
    if (corner[i] || L[i] >= NOT_BG) continue;
    corner[i] = 1;
    const x = i % W;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (i >= W) stack.push(i - W);
    if (i < N - W) stack.push(i + W);
  }
}
let cornerPx = 0;
for (let i = 0; i < N; i++) cornerPx += corner[i];
// радиус бывшего скругления — по верхней строке (для отчёта)
let cornerRadius = 0;
while (cornerRadius < W && corner[cornerRadius]) cornerRadius++;
const cornerWide = dilate(corner, 3);

// ---------- 2. подложка: гладкая поверхность по чистым участкам ----------

const dark = new Uint8Array(N);
for (let i = 0; i < N; i++) dark[i] = !cornerWide[i] && L[i] < NOT_BG ? 1 : 0;
const nearDark = dilate(dark, Math.round(W * 0.06));
const nearCorner = dilate(corner, Math.round(W * 0.02));

/** Решение системы 6×6 методом Гаусса */
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}
const basis = (x, y) => {
  const u = x / W - 0.5;
  const v = y / H - 0.5;
  return [1, u, v, u * u, u * v, v * v];
};
/** Коэффициенты поверхности для каждого канала; второй проход отбрасывает выбросы */
function fitBg() {
  let coef = null;
  for (let iter = 0; iter < 2; iter++) {
    const A = Array.from({ length: 6 }, () => new Float64Array(6));
    const B = [new Float64Array(6), new Float64Array(6), new Float64Array(6)];
    const edge = Math.round(W * 0.05);
    for (let y = edge; y < H - edge; y += 3) {
      for (let x = edge; x < W - edge; x += 3) {
        const i = y * W + x;
        if (nearDark[i] || nearCorner[i]) continue;
        const f = basis(x, y);
        if (coef) {
          let off = 0;
          for (let c = 0; c < 3; c++) {
            let v = 0;
            for (let k = 0; k < 6; k++) v += coef[c][k] * f[k];
            off = Math.max(off, Math.abs(v - src[i * 3 + c]));
          }
          if (off > 5) continue;
        }
        for (let a = 0; a < 6; a++) {
          for (let b = 0; b < 6; b++) A[a][b] += f[a] * f[b];
          for (let c = 0; c < 3; c++) B[c][a] += f[a] * src[i * 3 + c];
        }
      }
    }
    coef = B.map((b) =>
      solve(
        A.map((r) => [...r]),
        [...b],
      ),
    );
  }
  return coef;
}
const bgCoef = fitBg();
const bgAt = (x, y) => {
  const f = basis(x, y);
  return bgCoef.map((c) => {
    let v = 0;
    for (let k = 0; k < 6; k++) v += c[k] * f[k];
    return Math.min(255, Math.max(0, v));
  });
};

// Цельный квадрат: углы закрашены цветом подложки. Проверка — чёрного не осталось.
const squared = Buffer.from(src);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!cornerWide[i]) continue;
    const c = bgAt(x, y);
    squared[i * 3] = Math.round(c[0]);
    squared[i * 3 + 1] = Math.round(c[1]);
    squared[i * 3 + 2] = Math.round(c[2]);
  }
}
for (const [x, y] of [
  [0, 0],
  [W - 1, 0],
  [0, H - 1],
  [W - 1, H - 1],
]) {
  const i = (y * W + x) * 3;
  if (lumaOf(squared[i], squared[i + 1], squared[i + 2]) < NOT_BG)
    throw new Error(`icons: угол (${x}, ${y}) остался тёмным после заливки`);
}

// ---------- 3. гантель с тенью: слой RGBA ----------

/** Цвет гантели — медиана самых тёмных пикселей */
const inkSamples = [[], [], []];
for (let i = 0; i < N; i += 7) {
  if (dark[i] && L[i] < NOT_BG * 0.45) for (let c = 0; c < 3; c++) inkSamples[c].push(src[i * 3 + c]);
}
if (inkSamples[0].length < 500) throw new Error('icons: не нашёл тёмный объект в исходнике');
const ink = inkSamples.map((s) => s.sort((a, b) => a - b)[s.length >> 1]);
const inkL = lumaOf(...ink);

const alphaRaw = new Float32Array(N);
let bx0 = W;
let by0 = H;
let bx1 = 0;
let by1 = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (cornerWide[i]) continue;
    const b = lumaOf(...bgAt(x, y));
    const a = clamp01((b - L[i]) / (b - inkL));
    alphaRaw[i] = a;
    // bounding box самой гантели (без тени): плотные пикселы
    if (a >= 0.6) {
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
    }
  }
}
const cx = (bx0 + bx1 + 1) / 2;
const cy = (by0 + by1 + 1) / 2;
/** Самая дальняя от центра точка гантели — для безопасной зоны maskable */
let rMax = 0;
for (let y = by0; y <= by1; y++) {
  for (let x = bx0; x <= bx1; x++) {
    if (alphaRaw[y * W + x] < 0.6) continue;
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > rMax) rMax = d;
  }
}

// Слой: вокруг гантели оставляем поле под тень, дальше — прозрачно (там только шум подложки)
const pad = Math.round(W * 0.09);
const lx0 = Math.max(0, bx0 - pad);
const ly0 = Math.max(0, by0 - pad);
const lx1 = Math.min(W - 1, bx1 + pad);
const ly1 = Math.min(H - 1, by1 + pad);
const LW = lx1 - lx0 + 1;
const LH = ly1 - ly0 + 1;
const layer = Buffer.alloc(LW * LH * 4);
for (let y = ly0; y <= ly1; y++) {
  for (let x = lx0; x <= lx1; x++) {
    const i = y * W + x;
    const raw = alphaRaw[i];
    // шум подложки (до ~2%) убираем, слабую тень оставляем; к краю слоя тень плавно сходит на нет
    const edge = Math.min(x - lx0, lx1 - x, y - ly0, ly1 - y) / (pad * 0.5);
    const a = raw * smooth(0.02, 0.07, raw) * (raw < 0.6 ? clamp01(edge) : 1);
    const o = ((y - ly0) * LW + (x - lx0)) * 4;
    // плотные пикселы — исходный цвет (сохраняем рисунок), полупрозрачные — цвет гантели
    const keep = smooth(0.6, 0.9, raw);
    const b = bgAt(x, y);
    for (let c = 0; c < 3; c++) {
      const un = raw > 0.5 ? (src[i * 3 + c] - b[c] * (1 - raw)) / raw : ink[c];
      layer[o + c] = Math.round(Math.min(255, Math.max(0, ink[c] * (1 - keep) + un * keep)));
    }
    layer[o + 3] = Math.round(a * 255);
  }
}
const layerPng = await sharp(layer, { raw: { width: LW, height: LH, channels: 4 } })
  .png()
  .toBuffer();

// ---------- 4. сборка: фон + гантель по центру ----------

/** Ровный фон size×size: вертикальный градиент */
function background(size) {
  const top = hexRgb(ICON.bgTop);
  const bot = hexRgb(ICON.bgBottom);
  const buf = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    const t = size > 1 ? y / (size - 1) : 0;
    const row = top.map((v, c) => Math.round(v + (bot[c] - v) * t));
    for (let x = 0; x < size; x++) buf.set(row, (y * size + x) * 3);
  }
  return sharp(buf, { raw: { width: size, height: size, channels: 3 } });
}

/** Мастер-картинка size×size; scale — размер гантели относительно исходника */
async function compose(size, scale) {
  const k = (size / W) * scale;
  const w = Math.round(LW * k);
  const h = Math.round(LH * k);
  const obj = await sharp(layerPng).resize(w, h, { kernel: 'lanczos3', fit: 'fill' }).png().toBuffer();
  const left = Math.round(size / 2 - (cx - lx0) * (w / LW));
  const top = Math.round(size / 2 - (cy - ly0) * (h / LH));
  // слой может выходить за холст — обрезаем
  const ex = { left: Math.max(0, -left), top: Math.max(0, -top) };
  const cw = Math.min(w - ex.left, size - Math.max(0, left));
  const ch = Math.min(h - ex.top, size - Math.max(0, top));
  const cut = await sharp(obj)
    .extract({ ...ex, width: cw, height: ch })
    .png()
    .toBuffer();
  return background(size)
    .composite([{ input: cut, left: Math.max(0, left), top: Math.max(0, top) }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const maskScale = Math.min(ICON.scale, ((ICON.maskFill / 2) * W) / rMax);
const master = await compose(MASTER, ICON.scale);
const masterMask = await compose(MASTER, maskScale);

const resized = (buf, size) =>
  sharp(buf).resize(size, size, { kernel: 'lanczos3' }).removeAlpha().png({ compressionLevel: 9 });

/** Скругление как у iOS — для favicon и заставок (там иконку никто не скругляет за нас) */
async function rounded(buf, size) {
  const r = Math.round(size * ICON.iosRadius);
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}"/></svg>`,
  );
  return sharp(await resized(buf, size).toBuffer())
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

await mkdir(ICONS, { recursive: true });
await mkdir(SPLASH, { recursive: true });

const files = {};
for (const [name, size, from] of [
  ['apple-touch-icon.png', 180, master],
  ['icon-192.png', 192, master],
  ['icon-512.png', 512, master],
  ['icon-maskable-512.png', 512, masterMask],
]) {
  files[name] = await resized(from, size).toBuffer();
  await writeFile(ICONS + name, files[name]);
}
await writeFile(root + 'design/icon-1024.png', await resized(master, MASTER).toBuffer());

// favicon.ico: 16, 32, 48 (PNG внутри контейнера ICO), со скруглением
{
  const sizes = [16, 32, 48];
  const pngs = [];
  for (const s of sizes) pngs.push(await rounded(master, s));
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(sizes.length, 4);
  let offset = head.length;
  sizes.forEach((s, i) => {
    const e = 6 + i * 16;
    head.writeUInt8(s, e);
    head.writeUInt8(s, e + 1);
    head.writeUInt8(0, e + 2);
    head.writeUInt8(0, e + 3);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(pngs[i].length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += pngs[i].length;
  });
  await writeFile(ICONS + 'favicon.ico', Buffer.concat([head, ...pngs]));
}

// favicon.svg: контур гантели обводится по маске (marching squares) — вектор, чёткий в любом размере
{
  const G = 256;
  const k = (G / W) * ICON.scale;
  const gw = Math.round(LW * k);
  const gh = Math.round(LH * k);
  const small = await sharp(layerPng)
    .resize(gw, gh, { kernel: 'lanczos3', fit: 'fill' })
    .extractChannel(3)
    .raw()
    .toBuffer();
  const ox = Math.round(G / 2 - (cx - lx0) * (gw / LW));
  const oy = Math.round(G / 2 - (cy - ly0) * (gh / LH));
  const grid = new Float32Array(G * G);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const X = x + ox;
      const Y = y + oy;
      if (X > 0 && Y > 0 && X < G - 1 && Y < G - 1) grid[Y * G + X] = small[y * gw + x] / 255;
    }
  }
  const ISO = 0.6;
  const at = (x, y) => grid[y * G + x];
  // точки пересечения контура с рёбрами сетки: h — горизонтальное ребро, v — вертикальное
  const hPt = (x, y) => [x + (ISO - at(x, y)) / (at(x + 1, y) - at(x, y)), y];
  const vPt = (x, y) => [x, y + (ISO - at(x, y)) / (at(x, y + 1) - at(x, y))];
  const links = new Map();
  const link = (a, b) => {
    for (const [p, q] of [
      [a, b],
      [b, a],
    ]) {
      if (!links.has(p)) links.set(p, []);
      links.get(p).push(q);
    }
  };
  for (let y = 0; y < G - 1; y++) {
    for (let x = 0; x < G - 1; x++) {
      const tl = at(x, y) >= ISO;
      const tr = at(x + 1, y) >= ISO;
      const br = at(x + 1, y + 1) >= ISO;
      const bl = at(x, y + 1) >= ISO;
      const T = `h:${x}:${y}`;
      const B = `h:${x}:${y + 1}`;
      const Lk = `v:${x}:${y}`;
      const R = `v:${x + 1}:${y}`;
      const cross = [];
      if (tl !== tr) cross.push(T);
      if (tr !== br) cross.push(R);
      if (br !== bl) cross.push(B);
      if (bl !== tl) cross.push(Lk);
      if (cross.length === 2) link(cross[0], cross[1]);
      else if (cross.length === 4) {
        // седло: соединяем так, чтобы тёмные углы не слипались
        if (tl) {
          link(T, R);
          link(B, Lk);
        } else {
          link(T, Lk);
          link(R, B);
        }
      }
    }
  }
  const pt = (key) => {
    const [kind, x, y] = key.split(':');
    return kind === 'h' ? hPt(+x, +y) : vPt(+x, +y);
  };
  /** Упрощение ломаной (Рамер — Дуглас — Пекер) */
  const simplify = (pts, eps) => {
    if (pts.length < 3) return pts;
    const [a, b] = [pts[0], pts[pts.length - 1]];
    let best = 0;
    let idx = 0;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / len;
      if (d > best) {
        best = d;
        idx = i;
      }
    }
    if (best <= eps) return [a, b];
    return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
  };
  const seen = new Set();
  const S = 512 / G;
  const paths = [];
  for (const start of [...links.keys()].sort()) {
    if (seen.has(start)) continue;
    const loop = [];
    let prev = null;
    let cur = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      loop.push(pt(cur));
      const next = links.get(cur).find((n) => n !== prev && !seen.has(n));
      prev = cur;
      cur = next;
    }
    if (loop.length < 12) continue;
    const half = loop.length >> 1;
    const simple = [
      ...simplify(loop.slice(0, half + 1), 0.22).slice(0, -1),
      ...simplify([...loop.slice(half), loop[0]], 0.22).slice(0, -1),
    ];
    paths.push('M' + simple.map(([x, y]) => `${(x * S).toFixed(1)} ${(y * S).toFixed(1)}`).join('L') + 'Z');
  }
  const hex = '#' + ink.map((v) => v.toString(16).padStart(2, '0')).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ICON.bgTop}"/><stop offset="1" stop-color="${ICON.bgBottom}"/></linearGradient><path id="d" d="${paths.join('')}"/></defs>
<rect width="512" height="512" rx="${Math.round(512 * ICON.iosRadius)}" fill="url(#b)"/>
<use href="#d" transform="translate(5 8)" opacity=".12"/>
<use href="#d" fill="${hex}"/>
</svg>
`;
  await writeFile(ICONS + 'favicon.svg', svg);
}

// ---------- 5. splash-экраны: фон темы по умолчанию и иконка со скруглением ----------

let splashes = 0;
for (const d of IOS_DEVICES) {
  for (const theme of ['light', 'dark']) {
    const SW = d.w * d.dpr;
    const SH = d.h * d.dpr;
    const s = Math.round(Math.min(SW, SH) * 0.26);
    const icon = await rounded(master, s);
    await sharp({ create: { width: SW, height: SH, channels: 3, background: BRAND[theme].bg } })
      .composite([{ input: icon, left: Math.round((SW - s) / 2), top: Math.round(SH / 2 - s * 0.62) }])
      .png({ compressionLevel: 9, palette: true, colours: 128, dither: 0 })
      .toFile(SPLASH + splashName(d, theme));
    splashes++;
  }
}

// ---------- 6. проверка результата ----------

async function check(name, buf, size) {
  const { data, info: m } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  if (m.width !== size || m.height !== size) throw new Error(`${name}: размер ${m.width}×${m.height}`);
  if (m.channels !== 3) throw new Error(`${name}: есть прозрачность`);
  const lum = (x, y) => {
    const i = (y * size + x) * 3;
    return lumaOf(data[i], data[i + 1], data[i + 2]);
  };
  const e = size - 1;
  for (const [x, y, nx, ny] of [
    [0, 0, 6, 6],
    [e, 0, e - 6, 6],
    [0, e, 6, e - 6],
    [e, e, e - 6, e - 6],
  ]) {
    if (lum(x, y) < 200 || Math.abs(lum(x, y) - lum(nx, ny)) > 4)
      throw new Error(`${name}: угол (${x}, ${y}) не цвета подложки`);
  }
  // самая дальняя от центра тёмная точка, доля стороны
  let far = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (lum(x, y) < 110) far = Math.max(far, Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2));
    }
  }
  return far / size;
}
const report = {};
for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
]) {
  report[name] = await check(name, await readFile(ICONS + name), size);
}
if (report['icon-maskable-512.png'] > ICON.safe / 2)
  throw new Error(
    `maskable: гантель выходит за круг 80% (${(report['icon-maskable-512.png'] * 200).toFixed(1)}%)`,
  );

console.log(
  [
    `icons: исходник ${W}×${H}, чёрные углы — ${((cornerPx / N) * 100).toFixed(1)}% площади (радиус ≈ ${cornerRadius}px), залиты`,
    `  гантель в исходнике: ${bx1 - bx0 + 1}×${by1 - by0 + 1}px, центр смещён на (${(cx - W / 2).toFixed(1)}, ${(cy - H / 2).toFixed(1)})px → по центру, ×${ICON.scale}`,
    `  maskable: ×${maskScale.toFixed(3)}, гантель в круге ${(report['icon-maskable-512.png'] * 200).toFixed(1)}% (предел ${ICON.safe * 100}%)`,
    `  public/icons: apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png, favicon.ico, favicon.svg`,
    `  design/icon-1024.png · splash: ${splashes}`,
  ].join('\n'),
);
