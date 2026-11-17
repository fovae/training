import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { allExercises, findExercise, loadCatalog } from '../../src/data/exercises';
import {
  GROUPS,
  GROUP_MUSCLES,
  RESTRICTION_TAGS,
  ROLE_EXCEPTIONS,
  SPLITS,
  SUBSTITUTES,
  WARMUPS,
  available,
  roleOf,
  type Group,
} from '../../src/data/planner';
import {
  DEFAULT_ANSWERS,
  MINUTES,
  buildDraft,
  chooseSplit,
  draftToDays,
  groupOf,
  sanitizeAnswers,
  similar,
  type Answers,
  type PlannerCtx,
} from '../../src/lib/planner';
import type { Equipment } from '../../src/types';

/** Помощник «Подбор плана» (src/lib/planner): данные, выбор сплита, подбор, бюджет времени */

let ctx: PlannerCtx;
test.beforeAll(async () => {
  await loadCatalog();
  ctx = { exercises: allExercises(), restFor: (e) => (e.type === 'compound' ? 150 : 90) };
});

const A = (p: Partial<Answers>): Answers => ({ ...DEFAULT_ANSWERS, ...p });
const ids = (d: ReturnType<typeof buildDraft>) => d.days.flatMap((x) => x.items.map((i) => i.exerciseId));
const ex = (id: string) => findExercise(id)!;
const groupsIn = (d: ReturnType<typeof buildDraft>) =>
  new Set(d.days.flatMap((x) => x.items.filter((i) => !i.optional).map((i) => i.group)));

test('planner data is consistent with the catalog', () => {
  const lists = [
    ...Object.keys(ROLE_EXCEPTIONS),
    ...Object.values(RESTRICTION_TAGS).flat(),
    ...Object.values(WARMUPS).flat(),
    ...Object.keys(SUBSTITUTES),
    ...Object.values(SUBSTITUTES).flat(),
  ];
  for (const id of lists) expect(findExercise(id), id).toBeTruthy();
  // у каждого упражнения есть роль и инвентарь; у каждой группы есть упражнения в зале
  for (const e of allExercises()) {
    expect(roleOf(e), e.id).toBeTruthy();
    expect(e.equipment.length, e.id).toBeGreaterThan(0);
  }
  for (const g of GROUPS)
    expect(
      allExercises().some((e) => groupOf(e) === g),
      g,
    ).toBe(true);
  // разминки — растяжки и подвижность
  for (const id of Object.values(WARMUPS).flat()) expect(roleOf(ex(id)), id).toBe('warmup');
  // все мышцы каталога разложены по группам (кроме сгибателей бедра — их нет среди приоритетов)
  const covered = new Set(Object.values(GROUP_MUSCLES).flat());
  for (const e of allExercises())
    for (const m of e.primaryMuscles) if (m !== 'hip-flexors') expect(covered.has(m), m).toBe(true);
  // сплиты — от 1 до 7 дней, в каждом дне есть группы
  for (const s of Object.values(SPLITS)) {
    expect(s.days.length).toBeGreaterThanOrEqual(1);
    expect(s.days.length).toBeLessThanOrEqual(7);
    for (const d of s.days) expect(d.groups.length).toBeGreaterThan(0);
  }
});

test('split choice follows the approved rules', () => {
  const id = (p: Partial<Answers>) => chooseSplit(A(p)).split.id;
  expect(id({ days: 1, minutes: 30 })).toBe('full-1-short');
  expect(id({ days: 1, minutes: 75 })).toBe('full-1-long');
  expect(id({ days: 3 })).toBe('full-3');
  // 1–2 приоритета на 2–4 дня — всё тело + акцент
  expect(id({ full: false, priorities: ['biceps', 'forearms'], days: 3 })).toBe('accent-3');
  expect(id({ full: false, priorities: ['biceps'], days: 2 })).toBe('accent-2');
  // 3–4 приоритета: опытным — раздельные дни, новичкам на 3 дня — всё тело
  const four: Group[] = ['forearms', 'biceps', 'chest', 'quads'];
  expect(id({ full: false, priorities: ['back', 'biceps', 'chest'], days: 3 })).toBe('abl-3');
  expect(id({ full: false, priorities: ['back', 'biceps', 'chest'], days: 3, level: 'first' })).toBe(
    'full-3',
  );
  expect(id({ full: false, priorities: four, days: 4 })).toBe('bro-4');
  expect(id({ days: 7 })).toBe('ppl-7');
  expect(chooseSplit(A({ days: 6 })).warnings.map((w) => w.key)).toContain('recovery');
  // приоритеты из всех разделов — это всё тело, с подсказкой
  const all = chooseSplit(A({ full: false, priorities: ['chest', 'biceps', 'quads', 'abs'], days: 3 }));
  expect(all.split.id).toBe('full-3');
  expect(all.warnings.map((w) => w.key)).toContain('spread');
});

test('no limit on priorities: 5+ groups build a valid plan that covers them', () => {
  // без ограничения в 4 группы (3.20): шесть групп верха и рук — раздельные дни, все группы в плане
  const six: Group[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms'];
  const a = A({ full: false, priorities: six, days: 3, minutes: 60 });
  expect(chooseSplit(a).split.id).toBe('abl-3');
  const d = buildDraft(a, ctx);
  for (const g of six) expect(groupsIn(d).has(g), g).toBe(true);
  // все группы сразу — всё тело, без падений и в пределах времени
  const every = A({ full: false, priorities: [...GROUPS], days: 4, minutes: 45 });
  expect(chooseSplit(every).split.id).toBe('ul-4');
  expect(chooseSplit(every).warnings.map((w) => w.key)).toContain('spread');
  for (const day of buildDraft(every, ctx).days) expect(day.estimate.typicalMin).toBeLessThanOrEqual(45);
  // сохранённые ответы не обрезаются до 4
  expect(sanitizeAnswers({ priorities: six }).priorities).toEqual(six);
});

test('deterministic; rebuild gives another valid plan; pins survive', () => {
  const a = A({ full: false, priorities: ['chest', 'back', 'biceps'], days: 3 });
  const one = buildDraft(a, ctx);
  expect(buildDraft(a, ctx)).toEqual(one);
  const two = buildDraft(a, ctx, 1);
  expect(ids(two)).not.toEqual(ids(one));
  expect(buildDraft(a, ctx, 1)).toEqual(two);
  // закреплённое упражнение остаётся в своём дне
  const pin = { ...one.days[0]!.items.find((x) => !x.optional && !x.warmup)!, pinned: true };
  const re = buildDraft(a, ctx, 2, [[pin]]);
  expect(re.days[0]!.items.map((x) => x.exerciseId)).toContain(pin.exerciseId);
  // порядок каталога не влияет
  const rev = buildDraft(a, { ...ctx, exercises: [...ctx.exercises].reverse() });
  expect(ids(rev)).toEqual(ids(one));
});

test('coverage, equipment, no duplicates; weight is never set', () => {
  const a = A({ full: false, priorities: ['forearms', 'biceps', 'chest', 'quads'], days: 3, minutes: 60 });
  const d = buildDraft(a, ctx);
  for (const g of a.priorities) expect(groupsIn(d).has(g), g).toBe(true);
  for (const day of d.days) {
    const list = day.items.map((x) => x.exerciseId);
    expect(new Set(list).size, day.key).toBe(list.length);
  }
  // в доме с гантелями — только то, что делается с гантелями, скамьёй или без снаряда
  const home = A({ place: 'home', equipment: ['dumbbell', 'bench'], days: 2 });
  const have = new Set<Equipment>(['bodyweight', 'dumbbell', 'bench']);
  for (const id of ids(buildDraft(home, ctx))) expect(available(ex(id), have), id).toBe(true);
  for (const day of draftToDays(d, 'cycle'))
    for (const it of day.items) expect(it.targetWeightKg).toBeUndefined();
});

test('time budget: typical estimate fits the chosen time on a grid of answers', () => {
  const equipments: Equipment[][] = [DEFAULT_ANSWERS.equipment, ['dumbbell', 'bench'], []];
  for (const minutes of MINUTES)
    for (const days of [1, 2, 3, 4, 5, 6, 7])
      for (const level of ['first', 'intermediate'] as const)
        for (const equipment of equipments) {
          const d = buildDraft(A({ minutes, days, level, equipment }), ctx);
          for (const day of d.days) {
            expect(
              day.estimate.typicalMin,
              `${minutes} мин, ${days} дн., ${level}, ${equipment.join('+')}`,
            ).toBeLessThanOrEqual(minutes + 5);
            expect(day.items.filter((x) => !x.optional).length).toBeGreaterThan(0);
          }
        }
});

test('more time never gives fewer exercises or sets', () => {
  for (const pr of [[], ['biceps', 'chest']] as Group[][]) {
    let prev = { n: 0, sets: 0 };
    for (const minutes of MINUTES) {
      const d = buildDraft(A({ minutes, full: !pr.length, priorities: pr, days: 3 }), ctx);
      const main = d.days.flatMap((x) => x.items.filter((i) => !i.optional));
      const cur = { n: main.length, sets: main.reduce((s, i) => s + i.sets, 0) };
      expect(cur.n, `${minutes}`).toBeGreaterThanOrEqual(prev.n);
      expect(cur.sets, `${minutes}`).toBeGreaterThanOrEqual(prev.sets);
      prev = cur;
    }
  }
});

test('scenarios: home without gear + back, 1 day 30 min, 7 days, warm-up optional', () => {
  // дом без инвентаря, приоритет спина — честная подсказка про инвентарь или упражнения с весом тела
  const bare = buildDraft(
    A({ place: 'home', equipment: [], full: false, priorities: ['back'], days: 2 }),
    ctx,
  );
  const backDone = groupsIn(bare).has('back');
  if (!backDone) expect(bare.warnings.map((w) => w.key)).toContain('needsEquipment');
  for (const id of ids(bare)) expect(available(ex(id), new Set<Equipment>(['bodyweight'])), id).toBe(true);
  // 1 день, 30 минут — короткое всё тело
  const short = buildDraft(A({ days: 1, minutes: 30 }), ctx);
  expect(short.days).toHaveLength(1);
  expect(short.days[0]!.estimate.typicalMin).toBeLessThanOrEqual(35);
  // 7 дней — с лёгким днём и предупреждением о восстановлении
  const seven = buildDraft(A({ days: 7 }), ctx);
  expect(seven.days).toHaveLength(7);
  expect(seven.days[6]!.key).toBe('light');
  expect(seven.warnings.map((w) => w.key)).toContain('recovery');
  // разминка — одна строка «по желанию» в начале дня: не в typical, но в верхней границе
  const day = buildDraft(A({ days: 3 }), ctx).days[0]!;
  expect(day.items[0]!.warmup).toBe(true);
  expect(day.items[0]!.optional).toBe(true);
  expect(day.items.filter((x) => x.warmup)).toHaveLength(1);
});

test('restrictions really exclude tagged exercises', () => {
  const restrict = Object.keys(RESTRICTION_TAGS) as (keyof typeof RESTRICTION_TAGS)[];
  for (const r of restrict) {
    for (const days of [1, 3, 5]) {
      const d = buildDraft(A({ days, restrict: [r] }), ctx);
      for (const id of ids(d)) expect(RESTRICTION_TAGS[r], `${r}: ${id}`).not.toContain(id);
    }
  }
});

test('replace: similar exercises keep the group and respect equipment', () => {
  const a = A({ place: 'home', equipment: ['dumbbell', 'bench'] });
  const list = similar('incline-db-press', a, ctx);
  expect(list.length).toBeGreaterThan(0);
  for (const e of list) {
    expect(groupOf(e)).toBe('chest');
    expect(available(e, new Set<Equipment>(['bodyweight', 'dumbbell', 'bench'])), e.id).toBe(true);
  }
  expect(similar('no-such-exercise', a, ctx)).toEqual([]);
});

test('saved answers are sanitized; unknown ids in the catalog do not crash', () => {
  expect(sanitizeAnswers(null)).toEqual(DEFAULT_ANSWERS);
  const s = sanitizeAnswers({
    priorities: ['chest', 'wings', 'chest'],
    minutes: 33,
    days: 9,
    equipment: ['laser'],
  });
  expect(s.priorities).toEqual(['chest']);
  expect(s.minutes).toBe(DEFAULT_ANSWERS.minutes);
  expect(s.days).toBe(DEFAULT_ANSWERS.days);
  expect(s.equipment).toEqual([]);
  // каталог без части упражнений — сборка не падает
  const small = { ...ctx, exercises: ctx.exercises.filter((_, i) => i % 3) };
  expect(() => buildDraft(A({ days: 4 }), small)).not.toThrow();
});

test('day names and warnings have texts in every locale', () => {
  const keys = [
    ...new Set(Object.values(SPLITS).flatMap((s) => s.days.map((d) => `day.${d.key}`))),
    ...GROUPS.map((g) => `group.${g}`),
  ];
  for (const lang of ['en', 'ru']) {
    const ui = JSON.parse(
      readFileSync(new URL(`../../src/i18n/locales/${lang}/ui.json`, import.meta.url), 'utf8'),
    );
    for (const k of keys) {
      const v = k
        .split('.')
        .reduce((o: Record<string, unknown> | undefined, p) => o?.[p] as never, ui.planner);
      expect(typeof v, `${lang}: planner.${k}`).toBe('string');
    }
  }
});

test('a single narrow priority is never dropped for lack of time (accent goes first)', () => {
  for (const minutes of MINUTES)
    for (const days of [2, 3, 4])
      for (const g of ['biceps', 'forearms', 'calves', 'triceps'] as Group[]) {
        const d = buildDraft(A({ full: false, priorities: [g], days, minutes }), ctx);
        expect(
          d.warnings.map((w) => w.key),
          `${g} ${days}×${minutes}`,
        ).not.toContain('missing');
        for (const day of d.days)
          expect(
            day.items.some((x) => !x.optional && x.group === g),
            `${g} ${days}×${minutes} ${day.key}`,
          ).toBe(true);
      }
});
