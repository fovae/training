#!/usr/bin/env node
/**
 * Проверка контраста WCAG AA для всех тем (src/themes/themes.json). Падает, если пара не проходит.
 *  Текст (≥ 4.5:1): ink и muted на bg/card/soft; цветной текст дней (ink) на bg/card/soft;
 *    белый текст на заливках дней (fill и fill2 градиента) и на danger-fill; danger на bg/card.
 *  Элементы интерфейса и графики (≥ 3:1): декоративный цвет дня (c) и цвета графиков на card и bg.
 * Запуск: npm run theme:check
 */
import { readFileSync } from 'node:fs';

const { themes } = JSON.parse(readFileSync(new URL('../src/themes/themes.json', import.meta.url), 'utf8'));
const EXPECTED = [
  'classic-orange',
  'classic-light',
  'classic-dark',
  'monochrome',
  'blue',
  'violet',
  'green',
  'rose',
  'gradient-1',
  'gradient-2',
];

function lum(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** color-mix(in srgb, a p%, b) — для подкрашенных поверхностей (плашки, активная вкладка) */
const mix = (a, b, p) => {
  const ch = (h, i) => parseInt(h.replace('#', '').slice(i, i + 2), 16);
  return (
    '#' +
    [0, 2, 4]
      .map((i) => Math.round(ch(a, i) * p + ch(b, i) * (1 - p)))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
};
/** Самая сильная подкраска цветом дня под цветным текстом — 14% поверх карточки (плашки, вкладка; в CSS 12–13%) */
const TINT = 0.14;

const errors = [];
let pairs = 0;
const need = (theme, what, fg, bg, min) => {
  pairs++;
  const c = contrast(fg, bg);
  if (c < min) errors.push(`${theme}: ${what} ${fg} на ${bg} = ${c.toFixed(2)} (нужно ≥ ${min})`);
};

for (const id of EXPECTED) if (!themes[id]) errors.push(`нет темы ${id}`);
for (const [id, t] of Object.entries(themes)) {
  const surfaces = { bg: t.bg, card: t.card, soft: t.soft };
  for (const [sn, s] of Object.entries(surfaces)) {
    need(id, `текст на ${sn}`, t.ink, s, 4.5);
    need(id, `второстепенный текст на ${sn}`, t.muted, s, 4.5);
  }
  need(id, 'danger на bg', t.danger, t.bg, 4.5);
  need(id, 'danger на card', t.danger, t.card, 4.5);
  need(id, 'белый на danger-fill', '#ffffff', t.dangerFill, 4.5);
  if (t.days?.length !== 7) errors.push(`${id}: нужно 7 цветов дней`);
  t.days.forEach((d, i) => {
    const n = `день ${i + 1}`;
    for (const [sn, s] of Object.entries(surfaces)) need(id, `${n}: цветной текст на ${sn}`, d.ink, s, 4.5);
    need(id, `${n}: белый на заливке`, '#ffffff', d.fill, 4.5);
    need(id, `${n}: цветной текст на подкраске (card)`, d.ink, mix(d.c, t.card, TINT), 4.5);
    if (d.fill2) need(id, `${n}: белый на градиенте (2-й цвет)`, '#ffffff', d.fill2, 4.5);
    need(id, `${n}: декор на card`, d.c, t.card, 3);
  });
  t.chart.forEach((c, i) => {
    need(id, `график ${i + 1} на card`, c, t.card, 3);
    need(id, `график ${i + 1} на bg`, c, t.bg, 3);
  });
  // Монохром: дни различимы без цвета — заливки должны отличаться по яркости
  if (id === 'monochrome') {
    const ls = t.days.map((d) => lum(d.fill));
    if (new Set(ls.map((l) => l.toFixed(3))).size !== 7)
      errors.push('monochrome: заливки дней должны различаться');
  }
}

if (errors.length) {
  console.error(`theme:check — ошибок: ${errors.length}\n` + errors.map((e) => '  • ' + e).join('\n'));
  process.exit(1);
}
console.log(`theme:check — OK: ${Object.keys(themes).length} тем, ${pairs} пар цветов (WCAG AA)`);
