import { expect, test } from '@playwright/test';
import {
  DURATION_CONSTANTS,
  calibrationFactor,
  estimateDay,
  estimateItems,
  estimateRemaining,
  roundMinutes,
  sessionActualSec,
  type DurationExercise,
  type DurationItem,
  type SessionLike,
} from '../../src/lib/duration';

/** Оценка длительности тренировки (src/lib/duration.ts): модель, диапазон, калибровка по истории */

const COMPOUND_BB: DurationExercise = {
  type: 'compound',
  metric: 'weight_reps',
  equipment: ['barbell', 'bench'],
};
const COMPOUND_DB: DurationExercise = {
  type: 'compound',
  metric: 'weight_reps',
  equipment: ['dumbbell', 'bench'],
};
const ISO_DB: DurationExercise = { type: 'isolation', metric: 'weight_reps', equipment: ['dumbbell'] };
const ISO_CABLE: DurationExercise = { type: 'isolation', metric: 'weight_reps', equipment: ['cable'] };
const ISO_ARM: DurationExercise = { ...ISO_DB, per: 'arm' };
const PLANK: DurationExercise = { type: 'isolation', metric: 'time', equipment: ['bodyweight'] };

const item = (
  ex: DurationExercise,
  sets: number,
  rmin = 8,
  rmax = 12,
  extra: Partial<DurationItem> = {},
) => ({
  ex,
  sets,
  repsMin: rmin,
  repsMax: rmax,
  restSec: ex.type === 'compound' ? 150 : 90,
  ...extra,
});

/** Грудь + бицепс: 6 упражнений, 3–4 подхода по 8–12, отдых по умолчанию (150 / 90 с) */
const CHEST_BICEPS: DurationItem[] = [
  item(COMPOUND_BB, 4),
  item(COMPOUND_DB, 4),
  item(ISO_CABLE, 3),
  item(ISO_DB, 3),
  item(ISO_ARM, 3),
  item(ISO_CABLE, 3),
];

test('realistic day: chest + biceps, 6 exercises → about an hour, as a range', () => {
  const e = estimateItems(CHEST_BICEPS);
  expect(e.typicalMin).toBeGreaterThanOrEqual(45);
  expect(e.typicalMin).toBeLessThanOrEqual(70);
  expect(e.minMin).toBeLessThan(e.typicalMin);
  expect(e.maxMin).toBeGreaterThan(e.typicalMin);
  // части складываются в typical
  const p = e.parts;
  expect(p.work + p.rest + p.setup + p.warmup + p.transitions).toBeCloseTo(e.sec.typical, 5);
  expect(p.warmup).toBeGreaterThan(0);
  // прежняя модель давала около 25 минут — новая не меньше чем в полтора раза больше
  expect(e.typicalMin).toBeGreaterThanOrEqual(40);
});

test('tiny day does not drop to zero and does not blow up; empty day is zero', () => {
  const e = estimateItems([item(ISO_DB, 1, 10, 10)]);
  expect(e.typicalMin).toBe(5);
  expect(e.minMin).toBe(5);
  expect(e.maxMin).toBeLessThanOrEqual(15);
  expect(estimateItems([]).typicalMin).toBe(0);
});

test('per arm, timed exercises and optional items land in the right bounds', () => {
  const one = estimateItems([item(ISO_DB, 3)]).parts.work;
  const arm = estimateItems([item(ISO_ARM, 3)]).parts.work;
  expect(arm).toBeCloseTo(one * 2, 5);
  // планка 3 × 30–60 с — по заданному времени, без темпа повторов
  expect(estimateItems([item(PLANK, 3, 30, 60)]).parts.work).toBeCloseTo(3 * 45, 5);
  // необязательные — не в typical и min, но в max
  const base = estimateItems(CHEST_BICEPS);
  const withOpt = estimateItems([...CHEST_BICEPS, item(ISO_DB, 3, 8, 12, { optional: true })]);
  expect(withOpt.typicalMin).toBe(base.typicalMin);
  expect(withOpt.sec.min).toBeCloseTo(base.sec.min, 5);
  expect(withOpt.sec.max).toBeGreaterThan(base.sec.max);
});

test('monotonic: more sets or exercises never shorten the estimate', () => {
  let prev = 0;
  for (let sets = 1; sets <= 6; sets++) {
    const s = estimateItems([item(COMPOUND_BB, sets), item(ISO_DB, 3)]).sec.typical;
    expect(s).toBeGreaterThan(prev);
    prev = s;
  }
  prev = 0;
  for (let n = 1; n <= CHEST_BICEPS.length; n++) {
    const s = estimateItems(CHEST_BICEPS.slice(0, n)).sec.typical;
    expect(s).toBeGreaterThan(prev);
    prev = s;
  }
});

test('warm-up only before a heavy first exercise, more for beginners; pace adjusts everything', () => {
  expect(estimateItems([item(ISO_CABLE, 3)]).parts.warmup).toBe(0);
  const first = estimateItems([item(COMPOUND_BB, 3)], { level: 'first' }).parts.warmup;
  const vet = estimateItems([item(COMPOUND_BB, 3)], { level: 'veteran' }).parts.warmup;
  expect(first).toBeGreaterThan(vet);
  const normal = estimateItems(CHEST_BICEPS).sec.typical;
  expect(estimateItems(CHEST_BICEPS, { pace: 'slow' }).sec.typical).toBeCloseTo(
    normal * DURATION_CONSTANTS.pace.slow,
    5,
  );
  expect(estimateItems(CHEST_BICEPS, { pace: 'fast' }).sec.typical).toBeLessThan(normal);
});

test('rounding: typical to nearest 5, upper bound up, never below 5', () => {
  expect(roundMinutes(61 * 60, 'nearest')).toBe(60);
  expect(roundMinutes(63 * 60, 'nearest')).toBe(65);
  expect(roundMinutes(61 * 60, 'up')).toBe(65);
  expect(roundMinutes(64 * 60, 'down')).toBe(60);
  expect(roundMinutes(30, 'down')).toBe(5);
});

test('estimateDay takes a plan day with its own lookup', () => {
  const day = {
    items: [
      { exerciseId: 'a', sets: 4, repsMin: 8, repsMax: 12 },
      { exerciseId: 'b', sets: 3, repsMin: 10, repsMax: 15, optional: true },
    ],
  };
  const find = (id: string) => (id === 'a' ? COMPOUND_BB : ISO_DB);
  const e = estimateDay(day, { find, restFor: (ex) => (ex?.type === 'compound' ? 150 : 90) });
  expect(e.typicalMin).toBe(estimateItems([item(COMPOUND_BB, 4)]).typicalMin);
  expect(estimateRemaining([item(ISO_DB, 2)])).toBeGreaterThan(0);
});

// ---------- калибровка ----------

const T0 = Date.parse('2026-11-01T10:00:00Z');
/** Тренировка длиной `min` минут, все подходы отмечены равномерно */
function session(day: number, min: number, opts: { done?: boolean } = {}): SessionLike {
  const start = T0 + day * 86400000;
  const sets = 10;
  return {
    startedAt: new Date(start).toISOString(),
    endedAt: new Date(start + min * 60000).toISOString(),
    entries: [
      {
        exerciseId: 'x',
        sets: Array.from({ length: sets }, (_, i) => ({
          done: opts.done ?? true,
          reps: 10,
          doneAt: new Date(start + ((i + 1) * min * 60000) / (sets + 1)).toISOString(),
        })),
      },
    ],
  };
}
/** Модель предсказывает 40 минут на любую тренировку */
const predict40 = () => 40 * 60;

test('calibration: empty history = 1; systematic 1.5 pulls the estimate there with enough history', () => {
  expect(calibrationFactor([], predict40)).toEqual({ factor: 1, n: 0 });
  const many = Array.from({ length: 8 }, (_, i) => session(i, 60));
  const c = calibrationFactor(many, predict40);
  expect(c.n).toBe(8);
  expect(c.factor).toBeCloseTo(1.5, 5);
  const base = estimateItems(CHEST_BICEPS).sec.typical;
  expect(estimateItems(CHEST_BICEPS, { calibration: c.factor }).sec.typical).toBeCloseTo(base * 1.5, 5);
});

test('calibration: 1–2 workouts shift weakly; clamp holds; only the last 8 count', () => {
  const one = calibrationFactor([session(0, 60)], predict40).factor;
  const two = calibrationFactor([session(0, 60), session(1, 60)], predict40).factor;
  expect(one).toBeCloseTo(1 + 0.5 * (1 / 5), 5);
  expect(two).toBeCloseTo(1 + 0.5 * (2 / 5), 5);
  // очень медленно (×4) — не больше верхней границы
  const slow = Array.from({ length: 6 }, (_, i) => session(i, 160));
  expect(calibrationFactor(slow, predict40).factor).toBeCloseTo(DURATION_CONSTANTS.calibration.clamp[1], 5);
  // старые тренировки за пределами окна не влияют
  const old = Array.from({ length: 10 }, (_, i) => session(i, 160));
  const recent = Array.from({ length: 8 }, (_, i) => session(20 + i, 40));
  expect(calibrationFactor([...old, ...recent], predict40).factor).toBeCloseTo(1, 5);
});

test('calibration ignores junk: forgotten, too short, paused, unfinished, no sets done', () => {
  const good = Array.from({ length: 5 }, (_, i) => session(i, 60));
  const forgot = session(10, 400); // 6,5 ч — забыли завершить
  const short = session(11, 3);
  const noSets = session(12, 60, { done: false });
  const paused = session(13, 120);
  paused.entries[0]!.sets.forEach((s, i) => {
    s.doneAt = new Date(Date.parse(paused.startedAt) + (i < 5 ? i : 80 + i) * 60000).toISOString();
  });
  const late = session(14, 120);
  late.entries[0]!.sets.forEach((s, i) => {
    s.doneAt = new Date(Date.parse(late.startedAt) + (i + 1) * 3 * 60000).toISOString();
  });
  expect(sessionActualSec(forgot)).toBeNull();
  expect(sessionActualSec(short)).toBeNull();
  expect(sessionActualSec(noSets)).toBeNull();
  expect(sessionActualSec({ ...good[0]!, endedAt: undefined })).toBeNull();
  expect(sessionActualSec(paused)).toBeNull();
  expect(sessionActualSec(late)).toBeNull();
  expect(sessionActualSec(good[0]!)).toBe(3600);
  const c = calibrationFactor([...good, forgot, short, noSets, paused, late], predict40);
  expect(c.n).toBe(5);
  expect(c.factor).toBeCloseTo(1.5, 5);
});
