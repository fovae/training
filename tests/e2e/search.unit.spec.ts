import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  allExercises,
  exerciseSearchFields,
  filterExercises,
  findExercise,
  loadCatalog,
} from '../../src/data/exercises';
import { editDistance, stem, swapLayout } from '../../src/data/search';
import type { Equipment, Muscle } from '../../src/types';

/** Поиск упражнений: синонимы, сленг, словоформы, опечатки, раскладка — на русском и английском. */

const json = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
type Lang = 'ru' | 'en';
const names = {
  en: json('../../src/i18n/locales/en/exercises.json').ex as Record<string, { name: string }>,
  ru: json('../../src/i18n/locales/ru/exercises.json').ex as Record<string, { name: string }>,
};
const ui = {
  en: json('../../src/i18n/locales/en/ui.json'),
  ru: json('../../src/i18n/locales/ru/ui.json'),
};

test.beforeAll(async () => {
  await loadCatalog();
});

function search(lang: Lang, query: string, list = allExercises()): string[] {
  const fields = exerciseSearchFields(lang, {
    name: (id) => names[lang][id]!.name,
    muscle: (m: Muscle) => ui[lang].muscle[m],
    equip: (q: Equipment) => ui[lang].equip[q],
  });
  return filterExercises(list, { query }, fields, lang).map((e) => e.id);
}

/** id должен быть среди первых top результатов */
function expectTop(lang: Lang, query: string, id: string, top = 3) {
  const got = search(lang, query);
  const at = got.indexOf(id);
  expect(at, `«${query}» → ${id}; первые: ${got.slice(0, 6).join(', ')}`).toBeGreaterThanOrEqual(0);
  expect(at, `«${query}» → ${id}; первые: ${got.slice(0, 6).join(', ')}`).toBeLessThan(top);
}

test('helpers: stem, edit distance, keyboard layout', () => {
  expect(stem('молотки')).toBe(stem('молотка'));
  expect(stem('curls')).toBe('curl');
  expect(editDistance('бицпес', 'бицепс')).toBe(1);
  expect(editDistance('squta', 'squat')).toBe(1);
  expect(swapLayout('ghbctl')).toBe('присед');
  expect(swapLayout('ыйгфе')).toBe('squat');
  expect(swapLayout('123')).toBeNull();
});

test('Russian: slang and gym names', () => {
  const cases: [string, string][] = [
    ['молотки', 'hammer-curl'],
    ['молоток', 'hammer-curl'],
    ['жим от груди', 'barbell-bench-press'],
    ['жим лежа', 'barbell-bench-press'],
    ['становуха', 'deadlift'],
    ['румынка', 'romanian-deadlift'],
    ['бабочка', 'pec-deck'],
    ['французский жим', 'skull-crusher'],
    ['гиперэкстензия', 'back-extension'],
    ['гравитрон', 'assisted-pull-up'],
    ['армейский жим', 'overhead-press'],
    ['шраги', 'db-shrug'],
    ['хип траст', 'barbell-hip-thrust'],
    ['болгарка', 'bulgarian-split-squat'],
    ['брусья', 'chest-dip'],
    ['австралийские подтягивания', 'inverted-row'],
    ['берпи', 'burpee'],
    ['планка', 'plank'],
    ['фейспул', 'face-pull'],
    ['кроссовер', 'high-to-low-cable-fly'],
    ['протяжка', 'upright-row'],
    ['гакк', 'hack-squat'],
    ['велик', 'stationary-bike'],
    ['орбитрек', 'elliptical'],
    ['пистолетик', 'assisted-pistol-squat'],
    ['скакалка', 'jump-rope'],
    ['верхний блок', 'lat-pulldown'],
    ['махи в стороны', 'lateral-raise'],
    ['hammer curl', 'hammer-curl'],
    ['pec deck', 'pec-deck'],
  ];
  for (const [q, id] of cases) expectTop('ru', q, id);
});

test('Russian: word forms, typos, wrong layout', () => {
  const cases: [string, string][] = [
    ['молотковый', 'hammer-curl'],
    ['приседание со штангой', 'back-squat'],
    ['подтягивание', 'pull-up'],
    ['жим лёжа', 'barbell-bench-press'],
    ['жим лижа', 'barbell-bench-press'],
    ['становая тяго', 'deadlift'],
    ['подтягиваня', 'pull-up'],
    ['гиперэкстезия', 'back-extension'],
    ['румынская тяга', 'romanian-deadlift'],
    ['бицепс штанга', 'barbell-curl'],
    ['zujlbxysq vjcnbr', 'glute-bridge'],
    ['vjkjnrb', 'hammer-curl'],
  ];
  for (const [q, id] of cases) expectTop('ru', q, id, 5);
});

test('Russian: muscles and equipment as words', () => {
  const biceps = search('ru', 'бицуха');
  expect(biceps.length).toBeGreaterThan(5);
  expect(biceps.slice(0, 10)).toContain('barbell-curl');
  expect(search('ru', 'турник')).toContain('pull-up');
  expect(search('ru', 'ягодицы резинка')).toContain('lateral-band-walk');
  // предлог в запросе не мешает
  expect(search('ru', 'подъем на носки').slice(0, 3)).toContain('calf-raise');
});

test('English: slang, word forms, typos', () => {
  const cases: [string, string][] = [
    ['hammers', 'hammer-curl'],
    ['ohp', 'overhead-press'],
    ['rdl', 'romanian-deadlift'],
    ['skullcrusher', 'skull-crusher'],
    ['butterfly', 'pec-deck'],
    ['pushups', 'push-up'],
    ['pullups', 'pull-up'],
    ['chinups', 'chin-up'],
    ['bench', 'barbell-bench-press'],
    ['bench press', 'barbell-bench-press'],
    ['military press', 'overhead-press'],
    ['hip thrusts', 'barbell-hip-thrust'],
    ['benhc press', 'barbell-bench-press'],
    ['deadlfit', 'deadlift'],
    ['squta', 'back-squat'],
    ['lat pull down', 'lat-pulldown'],
    ['farmers walk', 'farmer-carry'],
    ['stairmaster', 'stair-climber'],
  ];
  for (const [q, id] of cases) expectTop('en', q, id, 5);
});

test('precision: unrelated words do not match, all words count', () => {
  expect(search('ru', 'абракадабра')).toEqual([]);
  expect(search('en', 'zzzz')).toEqual([]);
  // «press barbell» — без жима ногами
  expect(search('en', 'press barbell')).not.toContain('leg-press');
  expect(search('ru', 'жим ногами')[0]).toBe('leg-press');
  // пустой запрос — весь каталог по порядку
  expect(search('ru', '  ')).toEqual(allExercises().map((e) => e.id));
});

// ---------- уровни: запрос называет мышцу, группу мышц или инвентарь ----------

const ex = (id: string) => findExercise(id)!;
const isPrimary = (id: string, ms: readonly Muscle[]) => ex(id).primaryMuscles.some((m) => ms.includes(m));

/** Все упражнения, где мышца основная, стоят одним блоком в начале — выше любых других */
function expectPrimaryFirst(lang: Lang, query: string, ms: readonly Muscle[]): string[] {
  const got = search(lang, query);
  const firstOther = got.findIndex((id) => !isPrimary(id, ms));
  const block = firstOther < 0 ? got : got.slice(0, firstOther);
  const msg = `«${query}»: первые ${got.slice(0, 8).join(', ')}`;
  expect(block.length, msg).toBeGreaterThanOrEqual(3);
  const late = got.slice(block.length).filter((id) => isPrimary(id, ms));
  expect(late, msg).toEqual([]);
  // все упражнения каталога на эту мышцу нашлись
  const all = allExercises()
    .filter((e) => isPrimary(e.id, ms))
    .map((e) => e.id);
  expect([...block].sort(), msg).toEqual(all.sort());
  return block;
}

const BACK: Muscle[] = ['lats', 'upper-back', 'traps', 'lower-back'];
const DELTS: Muscle[] = ['front-delts', 'side-delts', 'rear-delts'];

test('muscle queries: exercises where the muscle is primary always come first', () => {
  const cases: [Lang, string, Muscle[]][] = [
    ['ru', 'бицепс', ['biceps']],
    ['ru', 'спина', BACK],
    ['ru', 'грудь', ['chest']],
    ['ru', 'трицепс', ['triceps']],
    ['ru', 'плечи', DELTS],
    ['ru', 'пресс', ['abs']],
    ['ru', 'ягодицы', ['glutes']],
    ['ru', 'квадрицепс', ['quads']],
    ['en', 'biceps', ['biceps']],
    ['en', 'back', BACK],
    ['en', 'chest', ['chest']],
    ['en', 'triceps', ['triceps']],
    ['en', 'shoulders', DELTS],
    ['en', 'abs', ['abs']],
    ['en', 'glutes', ['glutes']],
    ['en', 'quads', ['quads']],
    // английские названия мышц понимаются и в русском интерфейсе
    ['ru', 'biceps', ['biceps']],
  ];
  for (const [lang, q, ms] of cases) expectPrimaryFirst(lang, q, ms);
  // внутри блока сначала те, где мышца главная (первая в основных)
  const b = search('ru', 'бицепс');
  const main = b.findIndex((id) => ex(id).primaryMuscles[0] !== 'biceps');
  expect(b.slice(main).filter((id) => ex(id).primaryMuscles[0] === 'biceps')).toEqual([]);
});

test('"бицепс бедра" (hamstrings) and "бицепс" (biceps) do not mix', () => {
  const ham = expectPrimaryFirst('ru', 'бицепс бедра', ['hamstrings']);
  expect(ham.some((id) => isPrimary(id, ['biceps']))).toBe(false);
  const bi = expectPrimaryFirst('ru', 'бицепс', ['biceps']);
  expect(bi.some((id) => isPrimary(id, ['hamstrings']))).toBe(false);
  expectPrimaryFirst('en', 'hamstrings', ['hamstrings']);
});

test('muscle + equipment: primary muscle with that equipment, then with other equipment, then the rest', () => {
  const cases: [Lang, string, Muscle[], Equipment][] = [
    ['ru', 'бицепс гантели', ['biceps'], 'dumbbell'],
    ['ru', 'спина турник', BACK, 'pullup-bar'],
    ['ru', 'грудь штанга', ['chest'], 'barbell'],
    ['en', 'biceps dumbbell', ['biceps'], 'dumbbell'],
  ];
  for (const [lang, q, ms, eq] of cases) {
    const got = search(lang, q);
    const rank = (id: string) => (isPrimary(id, ms) ? (ex(id).equipment.includes(eq) ? 0 : 1) : 2);
    const ranks = got.map(rank);
    expect(ranks[0], q).toBe(0);
    expect(ranks, `«${q}»: ${got.slice(0, 8).join(', ')}`).toEqual([...ranks].sort((a, b) => a - b));
  }
});

test('word forms, slang, prefix, typo and wrong layout give the same primary block', () => {
  const base = new Set(expectPrimaryFirst('ru', 'бицепс', ['biceps']));
  for (const q of [
    'бицепсы',
    'бицепса',
    'на бицепс',
    'бицуха',
    'бицеп',
    'бицэпс',
    'biceps',
    'bicep',
    'bbwtgc',
  ]) {
    expect(new Set(expectPrimaryFirst('ru', q, ['biceps'])), q).toEqual(base);
  }
});

test('exercise names are not affected by tiers: exact name and phrase on top', () => {
  expectTop('ru', 'молотки', 'hammer-curl', 1);
  expectTop('ru', 'жим лёжа', 'barbell-bench-press', 1);
  expectTop('ru', 'присед', 'back-squat', 3);
  // инвентарь, который одновременно название упражнения
  expectTop('ru', 'кроссовер', 'high-to-low-cable-fly', 1);
  expectTop('ru', 'брусья', 'chest-dip', 1);
  expectTop('en', 'bench', 'barbell-bench-press', 1);
});

test('order is deterministic and does not depend on the order of the list', () => {
  const shuffled = [...allExercises()].reverse();
  const mixed = allExercises()
    .filter((_, i) => i % 2)
    .concat(allExercises().filter((_, i) => !(i % 2)));
  for (const [lang, q] of [
    ['ru', 'бицепс'],
    ['ru', 'спина турник'],
    ['ru', 'подтягивание'],
    ['en', 'squat'],
    ['en', 'back'],
  ] as [Lang, string][]) {
    const a = search(lang, q);
    expect(search(lang, q), q).toEqual(a);
    expect(search(lang, q, shuffled), q).toEqual(a);
    expect(search(lang, q, mixed), q).toEqual(a);
  }
});

test('search over the whole catalog fits in a frame', () => {
  search('ru', 'бицепс');
  const t0 = performance.now();
  for (const q of ['б', 'би', 'биц', 'бице', 'бицеп', 'бицепс', 'бицепс г', 'бицепс гантели'])
    search('ru', q);
  expect((performance.now() - t0) / 8).toBeLessThan(16);
});
