import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { allExercises, exerciseSearchFields, filterExercises, loadCatalog } from '../../src/data/exercises';
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

function search(lang: Lang, query: string): string[] {
  const fields = exerciseSearchFields(lang, {
    name: (id) => names[lang][id]!.name,
    muscle: (m: Muscle) => ui[lang].muscle[m],
    equip: (q: Equipment) => ui[lang].equip[q],
  });
  return filterExercises(allExercises(), { query }, fields, lang).map((e) => e.id);
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
