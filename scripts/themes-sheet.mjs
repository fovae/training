#!/usr/bin/env node
/**
 * Контактный лист тем → docs/review/themes.html (+ картинки в docs/review/themes/).
 * Запуск: npm run themes:sheet (сначала собирает приложение).
 *
 * Для каждого из 12 пунктов («Авто» и 11 тем) снимает настоящие экраны собранного приложения:
 *   главный экран («Сегодня») на 375×667, 390×844 и 430×932 — с главной карточкой и нижней панелью;
 *   список упражнений и лист подтверждения — на 390×844.
 * «Авто» снимается дважды: при светлой и при тёмной системной теме.
 * Лист нужен владельцу для просмотра; в сборку приложения не попадает.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { preview } from 'vite';
import { resolveThemes } from '../src/themes/derive.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const OUT = root + 'docs/review/themes/';
const json = (p) => readFile(root + p, 'utf8').then(JSON.parse);
const themes = resolveThemes(await json('src/themes/themes.json'));
const en = (await json('src/i18n/locales/en/ui.json')).theme;
const ru = (await json('src/i18n/locales/ru/ui.json')).theme;

/** Пункты листа: «Авто» — два раза (светлая и тёмная система) */
const ITEMS = [
  { id: 'auto', scheme: 'light', note: 'системная тема светлая → Classic Light' },
  { id: 'auto', scheme: 'dark', note: 'системная тема тёмная → Classic Dark' },
  ...Object.keys(themes).map((id) => ({ id, scheme: themes[id].scheme, note: '' })),
];
const VIEWPORTS = [
  [375, 667],
  [390, 844],
  [430, 932],
];

const server = await preview({ root, preview: { port: 4188, strictPort: true }, logLevel: 'error' });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'en-US',
  reducedMotion: 'reduce',
  serviceWorkers: 'block',
});
const page = await ctx.newPage();

// Онбординг: английский, шаблон «Сплит 3+1»
await page.goto(base);
await page.evaluate(() => localStorage.setItem('tp-install-skip', new Date().toISOString()));
await page.reload();
const next = () => page.getByRole('button', { name: 'Next' }).click();
await page.getByRole('heading', { name: 'Language' }).waitFor();
await next();
await page.getByRole('checkbox').check();
await next();
await page.getByLabel('Body weight, kg').fill('80');
await page.getByLabel('Height, cm').fill('180');
await next();
await page.getByRole('radio', { name: 'Intermediate' }).click();
await next();
await page.getByRole('radio', { name: /Split 3\+1/ }).click();
await page.getByRole('button', { name: 'Start training' }).click();
await page.getByRole('navigation').waitFor();

async function setTheme(theme) {
  await page.evaluate(
    (theme) =>
      new Promise((res) => {
        localStorage.setItem('tp-boot', JSON.stringify({ locale: 'en', theme }));
        const r = indexedDB.open('training-pwa');
        r.onsuccess = () => {
          const kv = r.result.transaction('kv', 'readwrite').objectStore('kv');
          const g = kv.get('settings');
          g.onsuccess = () => {
            kv.put({ ...(g.result ?? {}), theme }, 'settings').onsuccess = () => {
              r.result.close();
              res();
            };
          };
        };
      }),
    theme,
  );
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
let bytes = 0;
async function shot(name) {
  const png = await page.screenshot({ type: 'png' });
  const webp = await sharp(png).webp({ quality: 72, effort: 6 }).toBuffer();
  bytes += webp.length;
  await writeFile(OUT + name + '.webp', webp);
  return `themes/${name}.webp`;
}

const rows = [];
for (const it of ITEMS) {
  const key = it.id === 'auto' ? `auto-${it.scheme}` : it.id;
  await page.emulateMedia({ colorScheme: it.scheme, reducedMotion: 'reduce' });
  await setTheme(it.id);
  const imgs = [];
  for (const [w, h] of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(base + '#/today');
    await page.reload();
    await page.getByRole('button', { name: 'Start workout' }).waitFor();
    // браузер при перезагрузке возвращает прежнюю прокрутку — снимаем с самого верха
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    imgs.push({ src: await shot(`${key}-today-${w}`), w, h, label: `Главный экран · ${w}×${h}` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '#/library');
  await page.locator('.lib-card').first().waitFor();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  imgs.push({ src: await shot(`${key}-library`), w: 390, h: 844, label: 'Список упражнений · 390×844' });

  // Лист подтверждения: идёт тренировка, отмечен подход → «Завершить»
  await page.goto(base + '#/today');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.locator('.set-done').first().click();
  await page.getByRole('button', { name: 'Skip rest' }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('alertdialog').waitFor();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  imgs.push({ src: await shot(`${key}-confirm`), w: 390, h: 844, label: 'Лист подтверждения · 390×844' });
  await page.getByRole('alertdialog').getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Cancel workout' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Start workout' }).waitFor();

  rows.push({ ...it, key, imgs });
}
await browser.close();
await server.close();

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const chips = (id) => {
  const t = themes[id];
  if (!t) return '';
  const list = t.recipe
    ? [
        ['фон', t.recipe.bg],
        ['акцент 1', t.recipe.accent1],
        ['акцент 2', t.recipe.accent2],
        ['поверхность', t.recipe.surface],
      ]
    : [
        ['фон', t.bg],
        ['поверхность', t.card],
        ['акцент', t.days[0].fill],
        ...(t.days[0].fill2 ? [['градиент до', t.days[0].fill2]] : []),
      ];
  return list
    .map(
      ([n, c]) =>
        `<span class="chip"><i style="background:${c}"></i>${n} <code>${c.toUpperCase()}</code></span>`,
    )
    .join('');
};

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Simple Training — темы (контактный лист)</title>
<!-- Собирается скриптом: npm run themes:sheet. Не редактировать руками. В сборку приложения не попадает. -->
<style>
  body { margin: 0; font: 15px/1.5 system-ui, -apple-system, sans-serif; color: #16161a; background: #ececef; }
  header { padding: 24px 24px 8px; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  p { margin: 0; color: #5e5f66; }
  nav { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 24px; }
  nav a { padding: 4px 12px; border-radius: 999px; background: #fff; color: inherit; text-decoration: none; font-size: 13px; font-weight: 600; }
  section { margin: 16px 24px; padding: 16px; border-radius: 16px; background: #fff; }
  h2 { margin: 0; font-size: 18px; }
  h2 small { font-weight: 500; color: #5e5f66; font-size: 13px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 12px; }
  .chip { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #5e5f66; }
  .chip i { width: 16px; height: 16px; border-radius: 4px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); }
  code { font-size: 12px; }
  .row { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; align-items: flex-start; }
  figure { margin: 0; flex: none; }
  figure img { display: block; border-radius: 12px; box-shadow: 0 0 0 1px rgba(0,0,0,.1); height: auto; }
  figcaption { margin-top: 4px; font-size: 12px; color: #5e5f66; }
</style>
</head>
<body>
<header>
  <h1>Темы Simple Training — 12 пунктов</h1>
  <p>Настоящие экраны приложения: главный экран (375×667, 390×844, 430×932), список упражнений и лист подтверждения с нижней панелью. Пересобрать: <code>npm run themes:sheet</code>. Цвета — <code>src/themes/themes.json</code>, итоговая таблица — <code>docs/ARCHITECTURE.md</code>.</p>
</header>
<nav>${rows.map((r) => `<a href="#${r.key}">${esc(en[r.id])}${r.id === 'auto' ? (r.scheme === 'dark' ? ' · dark' : ' · light') : ''}</a>`).join('')}</nav>
${rows
  .map(
    (r) => `<section id="${r.key}">
  <h2>${esc(en[r.id])} / ${esc(ru[r.id])} <small><code>${r.id}</code>${r.note ? ' · ' + esc(r.note) : ''}</small></h2>
  <div class="chips">${chips(r.id === 'auto' ? (r.scheme === 'dark' ? 'classic-dark' : 'classic-light') : r.id)}</div>
  <div class="row">
${r.imgs
  .map(
    (i) =>
      `    <figure><img src="${i.src}" width="${Math.round(i.w * 0.72)}" height="${Math.round(i.h * 0.72)}" loading="lazy" alt="${esc(en[r.id])}: ${esc(i.label)}" /><figcaption>${esc(i.label)}</figcaption></figure>`,
  )
  .join('\n')}
  </div>
</section>`,
  )
  .join('\n')}
</body>
</html>
`;
await writeFile(root + 'docs/review/themes.html', html);
console.log(
  `themes:sheet — ${rows.length} пунктов (12 тем, «Авто» дважды), ${rows.length * 5} картинок, ${(bytes / 1024 / 1024).toFixed(1)} МБ → docs/review/themes.html`,
);
