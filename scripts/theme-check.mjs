#!/usr/bin/env node
/**
 * Проверка контраста WCAG AA для всех тем (src/themes/themes.json; цветные тёмные темы выводятся
 * из рецепта в src/themes/derive.mjs). «Авто» — это classic-light / classic-dark, отдельных цветов
 * у неё нет. Падает, если пара не проходит.
 *  Текст (≥ 4.5:1):
 *    основной и второстепенный на bg / card / soft (второстепенный — это и неактивные вкладки);
 *    основной текст на подкрашенной карточке (советы, отмеченный подход), второстепенный — на
 *      плашке предупреждения (10% цвета первого дня);
 *    цветной текст дней на bg / card / soft и на подкраске цветом дня (он же — кольцо фокуса);
 *    текст на заливке дня и на обоих концах градиента главной карточки и крупных кнопок;
 *    кнопка на цветной карточке; активная вкладка; danger на bg / card и на своей подкраске;
 *    белый на danger-fill; кнопки свайп-действий; тост; основной текст на выделении (::selection).
 *  Элементы интерфейса и графики (≥ 3:1): декоративный цвет дня на card, цвета графиков на card и bg.
 * Запуск: npm run theme:check (--table — итоговые цвета для docs/ARCHITECTURE.md)
 */
import { readFileSync } from 'node:fs';
import { contrast, headGradient, mix, resolveThemes } from '../src/themes/derive.mjs';

const themes = resolveThemes(
  JSON.parse(readFileSync(new URL('../src/themes/themes.json', import.meta.url), 'utf8')),
);
/** Порядок — как в настройках (src/types → THEMES) */
export const EXPECTED = [
  'classic-light',
  'classic-dark',
  'monochrome',
  'gradient',
  'pine-dusk',
  'golden-hour',
  'violet-dusk',
  'rose-dusk',
  'slate-blue',
  'sun-paper',
  'coffee-dusk',
];

/** Самая сильная подкраска цветом под текстом — 14% поверх карточки (плашки, вкладка; в CSS 8–13%) */
const TINT = 0.14;

const errors = [];
let pairs = 0;
const need = (theme, what, fg, bg, min) => {
  pairs++;
  const c = contrast(fg, bg);
  if (c < min) errors.push(`${theme}: ${what} — ${c.toFixed(2)}:1 (нужно ${min}:1) [${fg} на ${bg}]`);
};

for (const id of EXPECTED) if (!themes[id]) errors.push(`нет темы ${id}`);
for (const id of Object.keys(themes)) if (!EXPECTED.includes(id)) errors.push(`лишняя тема ${id}`);
if (Object.keys(themes).join() !== EXPECTED.filter((id) => themes[id]).join())
  errors.push('порядок тем в themes.json не совпадает с порядком в настройках');

for (const [id, t] of Object.entries(themes)) {
  const surfaces = { bg: t.bg, card: t.card, soft: t.soft };
  for (const [sn, s] of Object.entries(surfaces)) {
    need(id, `основной текст на ${sn}`, t.ink, s, 4.5);
    need(id, `второстепенный текст на ${sn}`, t.muted, s, 4.5);
  }
  need(id, 'danger на bg', t.danger, t.bg, 4.5);
  need(id, 'danger на card', t.danger, t.card, 4.5);
  need(id, 'danger на своей подкраске (card)', t.danger, mix(t.danger, t.card, 0.09), 4.5);
  need(id, 'белый на danger-fill', '#ffffff', t.dangerFill, 4.5);
  need(id, 'кнопка свайп-действия (bg на muted)', t.bg, t.muted, 4.5);
  need(id, 'тост (bg на ink)', t.bg, t.ink, 4.5);
  need(id, 'кнопка на цветной карточке', t.cardBtnInk, t.cardBtn, 4.5);
  if (t.grad) need(id, 'активная вкладка (акцент 1) на card', t.days[0].ink, t.card, 4.5);
  if (t.days?.length === 7)
    need(id, 'второстепенный текст на плашке предупреждения', t.muted, mix(t.days[0].c, t.card, 0.1), 4.5);
  if (t.days?.length !== 7) {
    errors.push(`${id}: нужно 7 цветов дней`);
    continue;
  }
  t.days.forEach((d, i) => {
    const n = `день ${i + 1}`;
    const tint = mix(d.c, t.card, TINT);
    for (const [sn, s] of Object.entries(surfaces)) need(id, `${n}: цветной текст на ${sn}`, d.ink, s, 4.5);
    need(id, `${n}: цветной текст на подкраске (card)`, d.ink, tint, 4.5);
    need(id, `${n}: основной текст на подкраске (card)`, t.ink, tint, 4.5);
    need(id, `${n}: текст на заливке`, t.onFill, d.fill, 4.5);
    headGradient(t, i).forEach((c, j) =>
      need(id, `${n}: текст на градиенте (${j ? 'конец' : 'начало'})`, t.onFill, c, 4.5),
    );
    need(id, `${n}: декор на card`, d.c, t.card, 3);
    // выделение текста (base.css, ::selection): 30% заливки дня поверх карточки, основной текст
    need(id, `${n}: текст на выделении`, t.ink, mix(d.fill, t.card, 0.3), 4.5);
  });
  t.chart.forEach((c, i) => {
    need(id, `график ${i + 1} на card`, c, t.card, 3);
    need(id, `график ${i + 1} на bg`, c, t.bg, 3);
  });
}

if (errors.length) {
  console.error(`theme:check — ${errors.length} проблем(ы):\n  ` + errors.join('\n  '));
  process.exit(1);
}

if (process.argv.includes('--table')) {
  console.log(
    '| Тема | Фон | Акцент 1 | Акцент 2 | Поверхность | Текст | Второст. | Активная вкладка | Текст на градиенте |',
  );
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const [id, t] of Object.entries(themes)) {
    const [a1, a2] = t.recipe ? [t.recipe.accent1, t.recipe.accent2] : headGradient(t, 0);
    console.log(
      `| ${id} | ${t.bg} | ${a1} | ${a2} | ${t.card} | ${t.ink} | ${t.muted} | ${t.grad ? t.days[0].ink : t.days[0].ink + ' (цвет дня)'} | ${t.onFill} |`,
    );
  }
}
console.log(
  `theme:check — OK: ${Object.keys(themes).length} тем + «Авто» (12 пунктов), ${pairs} пар цветов (WCAG AA)`,
);
