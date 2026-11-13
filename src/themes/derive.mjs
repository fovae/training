/**
 * Вывод токенов тем. Используется vite.config.ts (CSS тем и превью), scripts/theme-check.mjs
 * (контраст) и scripts/themes-sheet.mjs. В бандл приложения не попадает.
 *
 * Цветные тёмные темы «по рецепту» (образец — Pine Dusk): из четырёх цветов владельца — фон,
 * акцент 1, акцент 2, поверхность — выводятся все остальные токены (docs/ARCHITECTURE.md, «Темы»):
 *  soft  = поверхность + 5% белого (поля ввода, сегменты)
 *  line  = поверхность + 10% белого (обводки)
 *  ink   = белый с 8% фона (основной текст, нейтральный)
 *  muted = белый с 34% фона (второстепенный текст, неактивные вкладки)
 *  chart = [акцент 1, акцент 2]
 *  дни   = 7 точек на отрезке акцент 1 → акцент 2 (заливки чипов, точки); цветной текст дня —
 *          тот же цвет, при нехватке контраста (AA на фоне, карточке, soft и подкраске)
 *          осветлённый белым ровно настолько, насколько нужно
 *  главная карточка и крупные акцентные элементы = градиент акцент 1 → акцент 2 (135°)
 *  текст на заливке и градиенте = фон темы; кнопка на градиенте — фон темы, текст — акцент 1
 *  активная вкладка = акцент 1 (цветной текст первого дня)
 *  ошибки: danger #ff8f8f / dangerFill #c62828 — общие для тёмных тем
 * Классические темы и «Градиент» записаны в themes.json целиком; им добавляются только значения
 * по умолчанию (белый текст на заливках, белая кнопка на цветной карточке).
 */

/** @param {string} h */
const rgb = (h) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16));
/** @param {number[]} c */
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** color-mix(in srgb, a p, b) — p от 0 до 1 */
export function mix(a, b, p) {
  const x = rgb(a);
  const y = rgb(b);
  return hex(x.map((v, i) => v * p + y[i] * (1 - p)));
}

export function lum(h) {
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = rgb(h).map((v) => f(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Осветляет цвет текста, пока он не наберёт AA (с запасом 0.1) на всех поверхностях */
export function liftInk(c, surfaces, min = 4.6) {
  for (let p = 0; p <= 1; p += 0.01) {
    const x = mix('#ffffff', c, p);
    if (surfaces.every((s) => contrast(x, typeof s === 'function' ? s(x) : s) >= min)) return x;
  }
  return '#ffffff';
}

const CLASSIC_EXTRA = { onFill: '#ffffff', cardBtn: '#ffffff', cardBtnInk: '#16161a' };

/** Полный набор токенов темы из рецепта */
export function fromRecipe(r) {
  const { bg, accent1: a1, accent2: a2, surface } = r;
  const soft = mix('#ffffff', surface, 0.05);
  return {
    scheme: 'dark',
    recipe: { bg, accent1: a1, accent2: a2, surface },
    bg,
    card: surface,
    soft,
    line: mix('#ffffff', surface, 0.1),
    ink: mix('#ffffff', bg, 0.92),
    muted: mix('#ffffff', bg, 0.66),
    danger: '#ff8f8f',
    dangerFill: '#c62828',
    chart: [a1, a2],
    grad: [a1, a2],
    onFill: bg,
    cardBtn: bg,
    cardBtnInk: a1,
    days: Array.from({ length: 7 }, (_, i) => {
      const c = mix(a2, a1, i / 6);
      return { c, fill: c, ink: liftInk(c, [bg, surface, soft, mix(c, surface, 0.14)]) };
    }),
  };
}

/** Все темы с выведенными токенами (классические — как записаны, плюс значения по умолчанию) */
export function resolveThemes(json) {
  const out = {};
  for (const [id, t] of Object.entries(json.themes)) {
    out[id] = t.recipe ? fromRecipe(t.recipe) : { ...CLASSIC_EXTRA, ...t };
  }
  return out;
}

/** Градиент главной карточки дня i (0–6): [начало, конец]; у тем без градиента оба цвета равны */
export function headGradient(t, i) {
  const d = t.days[i];
  return t.grad ?? [d.fill, d.fill2 ?? d.fill];
}

/** Немного цветов темы для превью в настройках: фон, поверхность, текст, градиент, два акцента */
export function previewOf(t) {
  return {
    bg: t.bg,
    card: t.card,
    ink: t.ink,
    head: headGradient(t, 0),
    acc: t.recipe ? [t.recipe.accent1, t.recipe.accent2] : [t.days[0].c, t.days[1].c],
  };
}
