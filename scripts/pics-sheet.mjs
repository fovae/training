#!/usr/bin/env node
/**
 * Контактный лист схем упражнений: одна HTML-страница со всеми схемами и названиями (en / ru),
 * чтобы владелец просмотрел всю базу за пять минут.
 *
 *   npm run pics:sheet            → docs/review/pictograms.html
 *
 * Страница самодостаточная (стили внутри, без внешних запросов) и в бандл не попадает.
 * Схемы берутся из того же кода, что и в приложении (src/data/catalog), через Vite SSR.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const root = new URL('..', import.meta.url).pathname;
const out = root + 'docs/review/pictograms.html';

const server = await createServer({
  root,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
});
let cat;
try {
  cat = await server.ssrLoadModule('/src/data/catalog/index.ts');
} finally {
  await server.close();
}

const dict = (lang) =>
  JSON.parse(readFileSync(`${root}src/i18n/locales/${lang}/exercises.json`, 'utf8')).ex ?? {};
const en = dict('en');
const ru = dict('ru');
const ui = JSON.parse(readFileSync(`${root}src/i18n/locales/en/ui.json`, 'utf8'));
const BASE_IDS = new Set(cat.BASE_IDS);

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const groups = new Map();
for (const e of cat.EXERCISES) {
  if (!groups.has(e.category)) groups.set(e.category, []);
  groups.get(e.category).push(e);
}

const total = cat.EXERCISES.length;
const added = cat.EXERCISES.filter((e) => !BASE_IDS.has(e.id)).length;
let n = 0;
const sections = [...groups]
  .map(([category, list]) => {
    const cards = list
      .map((e) => {
        n++;
        const svg = cat.picMarkup(e.pictogram) ?? '<p class="miss">NO PICTURE</p>';
        const isNew = !BASE_IDS.has(e.id);
        return `<figure class="card${isNew ? ' new' : ''}" id="${esc(e.id)}">
  <div class="pic">${svg}</div>
  <figcaption>
    <span class="num">${n}</span>${isNew ? '<span class="badge">new</span>' : ''}
    <b>${esc(en[e.id]?.name ?? '— no en name —')}</b>
    <span class="ru">${esc(ru[e.id]?.name ?? '— нет ru —')}</span>
    <code>${esc(e.id)} · ${esc(e.pictogram)}</code>
    <span class="eq">${e.equipment.map((q) => esc(ui.equip?.[q] ?? q)).join(', ')}</span>
  </figcaption>
</figure>`;
      })
      .join('\n');
    return `<section><h2>${esc(ui.category?.[category] ?? category)} <small>${list.length}</small></h2><div class="grid">${cards}</div></section>`;
  })
  .join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Simple Training — exercise pictograms</title>
<style>
:root{--bg:#f3f1ec;--card:#fff;--soft:#f7f6f2;--line:#e7e4dd;--ink:#16161a;--muted:#6b6b73;--accent:#e5603f}
@media (prefers-color-scheme:dark){:root{--bg:#0b0b0d;--card:#18181c;--soft:#202026;--line:#2c2c33;--ink:#f2f2f4;--muted:#a3a3ad}}
*{box-sizing:border-box}
body{margin:0;padding:24px 16px 48px;background:var(--bg);color:var(--ink);font:14px/1.4 system-ui,-apple-system,sans-serif}
header{max-width:1200px;margin:0 auto 8px}
h1{margin:0 0 4px;font-size:22px}
h2{max-width:1200px;margin:28px auto 10px;font-size:17px}
h2 small{color:var(--muted);font-weight:600}
.lead{color:var(--muted);margin:0}
.grid{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.card{margin:0;background:var(--card);border-radius:14px;padding:8px 8px 10px;border:2px solid transparent}
.card.new{border-color:color-mix(in srgb,var(--accent) 30%,transparent)}
figcaption{display:grid;gap:2px;padding:6px 4px 0}
figcaption b{font-size:14px}
.ru,.eq{color:var(--muted);font-size:13px}
code{font-size:11px;color:var(--muted)}
.num{float:right;color:var(--muted);font-size:12px}
.badge{justify-self:start;font-size:10px;font-weight:800;text-transform:uppercase;color:var(--accent)}
.miss{color:#c00;font-weight:800}
/* схемы — те же правила, что в src/styles/components.css */
.pic{background:var(--soft);border-radius:10px;height:150px;display:grid;place-items:center;overflow:hidden}
.pic svg{width:100%;height:100%;max-height:170px}
.pic polyline{fill:none;stroke:var(--accent);stroke-width:7;stroke-linecap:round;stroke-linejoin:round}
.pic circle{fill:var(--accent)}
.pic .far polyline{opacity:.45}
.pic .ghost{opacity:.22}
.pic .eq line,.pic .eq polygon,.pic .eq rect{stroke:var(--muted);stroke-width:3;stroke-linecap:round;fill:none;opacity:.55}
.pic .eq .pad{stroke-width:7;opacity:.4}
.pic .eq .padfill{fill:var(--muted);opacity:.3;stroke:none}
.pic .eq .bg{stroke-width:2;opacity:.3;stroke-dasharray:4 4}
.pic .floor{stroke:var(--line);stroke-width:2}
.pic .cable{stroke:var(--muted);stroke-width:1.5;opacity:.7}
.pic .cable.g{opacity:.25}
.pic .db line{stroke:var(--ink);stroke-width:3;opacity:.8}
.pic .db rect{fill:var(--ink);opacity:.8}
.pic .mv{stroke:var(--ink);stroke-width:2;stroke-dasharray:3 4;opacity:.55}
.pic .ahp{fill:var(--ink);opacity:.55}
.pic .bb rect{fill:var(--soft);stroke:var(--ink);stroke-width:3;opacity:.85}
.pic .bb .hub{fill:var(--ink);stroke:none}
.pic .kb path{fill:none;stroke:var(--ink);stroke-width:2.5;opacity:.8}
.pic .kb rect,.pic .bbf rect{fill:var(--ink);opacity:.8}
.pic .bbf line{stroke:var(--ink);stroke-width:3;opacity:.8}
.pic .band{stroke:var(--muted);stroke-width:2;stroke-dasharray:2 3;opacity:.8}
.pic .rope{fill:none;stroke:var(--ink);stroke-width:1.5;opacity:.6}
</style>
</head>
<body>
<header>
<h1>Exercise pictograms · ${total}</h1>
<p class="lead">${added} new in stage 3A (orange frame) · bright figure — end position, pale — start, dashed arrow — direction of movement. Generated by <code>npm run pics:sheet</code>; not part of the app bundle.</p>
</header>
${sections}
</body>
</html>
`;

mkdirSync(root + 'docs/review', { recursive: true });
writeFileSync(out, html);
console.log(`pics:sheet — ${total} exercises (${added} new) → docs/review/pictograms.html`);
