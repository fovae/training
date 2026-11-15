import { expect, test } from '@playwright/test';
import { allExercises, findExercise, loadCatalog } from '../../src/data/exercises';
import {
  SINGLE_DUMBBELL,
  countModeOf,
  defaultLoad,
  loadModes,
  setTopWeightKg,
  setVolumeKg,
  splitTotal,
  totalReps,
} from '../../src/lib/dumbbell';
import { exerciseRecords, sessionVolumeKg } from '../../src/lib/stats';
import type { Session } from '../../src/types';

/** Гантели «×2 / Л и П» и счёт «по очереди на каждую руку» (src/lib/dumbbell.ts) */

test.beforeAll(async () => {
  await loadCatalog();
});

test('alternating count: 16 in total = 8 per arm = one set; odd count is never rounded silently', () => {
  expect(splitTotal(16)).toEqual({ left: 8, right: 8 });
  expect(splitTotal(15)).toEqual({ odd: [8, 7] });
  expect(splitTotal(1)).toEqual({ odd: [1, 0] });
  expect(totalReps({ reps: 8 })).toBe(16);
  expect(totalReps({ reps: 8, repsR: 7 })).toBe(15);
  expect(totalReps({})).toBeUndefined();
  // «всего» — только у упражнений на руку / сторону
  expect(countModeOf({ per: 'arm' }, 'total')).toBe('total');
  expect(countModeOf({}, 'total')).toBe('side');
  expect(countModeOf({ per: 'side' }, undefined)).toBe('side');
});

test('weight modes per exercise: one dumbbell has none, pairs ×2, one-arm L & R, mixed — one weight', () => {
  const ex = (id: string) => findExercise(id)!;
  expect(loadModes(ex('goblet-squat'))).toBeNull();
  expect(loadModes(ex('barbell-bench-press'))).toBeNull();
  expect(loadModes(ex('db-curl'))).toEqual(['x2', 'lr']);
  expect(defaultLoad(ex('db-curl'))).toBe('x2');
  expect(defaultLoad(ex('incline-db-press'))).toBe('x2');
  expect(defaultLoad(ex('one-arm-db-row'))).toBe('lr');
  expect(loadModes(ex('flat-press'))).toEqual(['one', 'x2', 'lr']);
  expect(defaultLoad(ex('flat-press'))).toBe('one');
  // список «одна гантель» — только существующие упражнения с гантелями
  for (const id of SINGLE_DUMBBELL) expect(findExercise(id)?.equipment, id).toContain('dumbbell');
  // у каждого упражнения с гантелями режим определён без исключений
  for (const e of allExercises()) expect(() => defaultLoad(e), e.id).not.toThrow();
});

test('volume and records: ×2 counts both dumbbells, L & R each side, old records unchanged', () => {
  expect(setVolumeKg({ done: true, weightKg: 12, reps: 10 })).toBe(120);
  expect(setVolumeKg({ done: true, weightKg: 12, reps: 10, load: 'x2' })).toBe(240);
  expect(setVolumeKg({ done: true, weightKg: 12, weightRKg: 10, reps: 10, load: 'lr' })).toBe(220);
  expect(setVolumeKg({ done: true, weightKg: 12, reps: 8, repsR: 7, load: 'lr' })).toBe(12 * 8 + 12 * 7);
  expect(setTopWeightKg({ done: true, weightKg: 12, weightRKg: 14, load: 'lr' })).toBe(14);
  const s: Session = {
    id: 's1',
    dayId: 'day-1',
    startedAt: '2026-11-01T10:00:00Z',
    endedAt: '2026-11-01T11:00:00Z',
    entries: [
      {
        exerciseId: 'db-curl',
        sets: [
          { done: true, weightKg: 10, reps: 10 },
          { done: true, weightKg: 12, reps: 10, load: 'x2' },
          { done: true, weightKg: 12, weightRKg: 14, reps: 8, load: 'lr' },
        ],
      },
    ],
  };
  expect(sessionVolumeKg(s)).toBe(100 + 240 + 12 * 8 + 14 * 8);
  const r = exerciseRecords([s], 'db-curl');
  // рекорд веса — одна гантель (тяжёлая из двух), не сумма
  expect(r.maxWeight?.value).toBe(14);
  expect(r.maxSetVolume?.value).toBe(240);
});
