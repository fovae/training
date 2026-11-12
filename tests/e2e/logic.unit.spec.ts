import { expect, test } from '@playwright/test';
import {
  MAX_TIPS_PER_SESSION,
  TIP_SNOOZE_DAYS,
  deload,
  isSnoozed,
  lightStart,
  progression,
  recovery,
  tipsFor,
} from '../../src/advice/rules';
import { LEVELS, WEIGHT_LIMIT_MULTIPLIER, levelBehavior } from '../../src/advice/levels';
import { TYPO_FACTOR, checkWeight, weightLimitKg } from '../../src/advice/weight';
import { LIMIT_MARGIN, WEIGHT_LIMITS, findWeightLimit, ratioFor } from '../../src/data/weightLimits';
import { findExercise, loadCatalog } from '../../src/data/exercises';
import { needsAcceptanceFor } from '../../src/content/legal/acceptance';
import { exerciseRecords, weeklyStats } from '../../src/lib/stats';
import { migrateProfileV2, migrateSettingsV2, migrateThemeV2 } from '../../src/db/migrations';
import type { PlanItem, Session, SessionSet } from '../../src/types';

test.beforeAll(() => loadCatalog());

const H = 3_600_000;
const NOW = Date.parse('2026-11-12T12:00:00Z');
const item = (exerciseId: string, sets = 3, repsMin = 8, repsMax = 12): PlanItem => ({
  exerciseId,
  sets,
  repsMin,
  repsMax,
});
let n = 0;
/** Тренировка, закончившаяся hoursAgo часов назад */
function session(
  hoursAgo: number,
  exerciseId: string,
  sets: Partial<SessionSet>[],
  skipped = false,
): Session {
  const end = new Date(NOW - hoursAgo * H).toISOString();
  return {
    id: 's' + n++,
    dayId: 'day-1',
    startedAt: new Date(NOW - hoursAgo * H - H).toISOString(),
    endedAt: end,
    entries: [
      { exerciseId, ...(skipped ? { skipped: true } : {}), sets: sets.map((x) => ({ done: true, ...x })) },
    ],
  };
}
const reps = (...r: number[]) => r.map((x) => ({ weightKg: 20, reps: x }));

test.describe('advice rules', () => {
  test('progression: top of range in all working sets', () => {
    const it = item('incline-db-press');
    expect(progression(it, [session(72, it.exerciseId, reps(12, 12, 12))])).not.toBeNull();
    expect(progression(it, [session(72, it.exerciseId, reps(12, 12, 11))])).toBeNull();
    // меньше подходов, чем в плане, — нет совета
    expect(progression(it, [session(72, it.exerciseId, reps(12, 12))])).toBeNull();
    // 1 подход в плане — граничный случай
    expect(progression(item('incline-db-press', 1), [session(72, it.exerciseId, reps(12))])).not.toBeNull();
    // упражнение на время — не про вес
    expect(
      progression(item('side-plank', 2, 20, 40), [
        session(72, 'side-plank', [{ seconds: 40 }, { seconds: 40 }]),
      ]),
    ).toBeNull();
    // пропущенное упражнение не считается
    expect(progression(it, [session(72, it.exerciseId, reps(12, 12, 12), true)])).toBeNull();
  });

  test('deload: 2 sessions in a row mostly below the range', () => {
    const it = item('lat-pulldown');
    const low = () => session(100, it.exerciseId, reps(6, 7, 9));
    expect(deload(it, [low(), low()])).not.toBeNull();
    expect(deload(it, [low()])).toBeNull();
    expect(deload(it, [low(), session(200, it.exerciseId, reps(10, 10, 10))])).toBeNull();
    // половина подходов ниже — ещё не «большинство»
    expect(
      deload(it, [session(1, it.exerciseId, reps(7, 9)), session(2, it.exerciseId, reps(7, 9))]),
    ).toBeNull();
    // единицы измерения не важны: правило по повторам, вес хранится в кг
    expect(deload(it, [session(1, it.exerciseId, [{ weightKg: 45.359, reps: 5 }]), low()])).not.toBeNull();
  });

  test('light start: beginners only, only without history', () => {
    const it = item('hammer-curl');
    expect(lightStart(it, [], 'first')).not.toBeNull();
    expect(lightStart(it, [], 'few')).not.toBeNull();
    expect(lightStart(it, [], 'intermediate')).toBeNull();
    expect(lightStart(it, [session(10, it.exerciseId, reps(10))], 'first')).toBeNull();
  });

  test('recovery: same primary muscle < 48 h ago', () => {
    const day = [item('incline-db-press')]; // грудь
    expect(recovery('day-1', day, [session(20, 'flat-press', reps(10))], NOW)?.muscles).toEqual(['chest']);
    expect(recovery('day-1', day, [session(49, 'flat-press', reps(10))], NOW)).toBeNull();
    expect(recovery('day-1', day, [session(20, 'leg-press', reps(10))], NOW)).toBeNull();
  });

  test('tipsFor: max 2, priority, snooze 14 days, global switch', () => {
    const items = [
      item('incline-db-press'),
      item('lat-pulldown'),
      item('hammer-curl'),
      item('lateral-raise'),
    ];
    const hist = [
      session(20, 'flat-press', reps(10)), // восстановление (грудь)
      session(30, 'lat-pulldown', reps(6, 6, 6)),
      session(40, 'lat-pulldown', reps(6, 6, 6)), // снижение нагрузки
      session(50, 'incline-db-press', reps(12, 12, 12)), // прогрессия
    ];
    const ctx = {
      dayId: 'day-1',
      items,
      history: hist,
      level: 'first' as const,
      now: NOW,
      tipState: {},
      enabled: true,
      withRecovery: true,
    };
    const tips = tipsFor(ctx);
    expect(tips).toHaveLength(MAX_TIPS_PER_SESSION);
    expect(tips.map((t) => t.kind)).toEqual(['recovery', 'deload']);
    // закрытый совет не возвращается 14 дней, потом снова можно
    const dismissed = { 'recovery:day-1': { dismissedAt: new Date(NOW - 2 * 86_400_000).toISOString() } };
    expect(tipsFor({ ...ctx, tipState: dismissed }).map((t) => t.kind)).toEqual(['deload', 'progression']);
    expect(
      isSnoozed(
        'x',
        { x: { dismissedAt: new Date(NOW - (TIP_SNOOZE_DAYS + 1) * 86_400_000).toISOString() } },
        NOW,
      ),
    ).toBe(false);
    // выключатель — ни одного совета и ни одного «восстановления»
    expect(tipsFor({ ...ctx, enabled: false })).toEqual([]);
  });
});

test.describe('levels', () => {
  test('behaviour by level', () => {
    expect(LEVELS.first.techniqueOpen && LEVELS.few.techniqueOpen).toBe(true);
    expect(LEVELS.intermediate.techniqueOpen || LEVELS.veteran.techniqueOpen).toBe(false);
    expect(LEVELS.first.askWeightOnAdd).toBe(false);
    expect(LEVELS.veteran.askWeightOnAdd).toBe(true);
    expect(LEVELS.few.showTargetWeight).toBe(false);
    expect(levelBehavior(undefined)).toEqual(LEVELS.intermediate);
    expect(WEIGHT_LIMIT_MULTIPLIER).toEqual({ first: 0.6, few: 0.8, intermediate: 1, veteran: 1 });
  });
});

test.describe('weight limits', () => {
  test('table: only dumbbell exercises with confirmed data, margin ≥ 15%', () => {
    for (const w of WEIGHT_LIMITS) {
      const ex = findExercise(w.exerciseId)!;
      expect(ex, w.exerciseId).toBeTruthy();
      expect(
        ex.equipment.some((q) => q === 'machine' || q === 'cable'),
        w.exerciseId,
      ).toBe(false);
      expect(w.male).toBeGreaterThan(w.female);
    }
    for (const m of Object.values(LIMIT_MARGIN)) expect(m).toBeGreaterThanOrEqual(0.15);
    // станки, блоки и смешанное оборудование — без предупреждений
    for (const id of ['leg-press', 'lat-pulldown', 'flat-press', 'seated-shoulder-press', 'calf-raise'])
      expect(findWeightLimit(id), id).toBeUndefined();
  });

  test('threshold by sex, level and body weight', () => {
    const lim = findWeightLimit('incline-db-press')!;
    expect(ratioFor(lim, 'unspecified')).toBeCloseTo((lim.male + lim.female) / 2);
    const male = weightLimitKg('incline-db-press', 80, 'male', 'veteran')!;
    expect(male).toBeCloseTo(0.84 * 1.5 * 80); // 100.8 кг на гантель
    expect(weightLimitKg('incline-db-press', 80, 'male', 'first')!).toBeCloseTo(male * 0.6);
    expect(weightLimitKg('lat-pulldown', 80, 'male', 'veteran')).toBeNull();
  });

  test('check: unrealistic, normal, ignored, typo', () => {
    const base = {
      exerciseId: 'incline-db-press',
      bodyWeightKg: 80,
      sex: 'male' as const,
      level: 'intermediate' as const,
      lastWeightKg: null,
      ignored: [],
    };
    expect(checkWeight({ ...base, weightKg: 30 })).toBeNull();
    expect(checkWeight({ ...base, weightKg: 150 })?.kind).toBe('unrealistic');
    expect(checkWeight({ ...base, weightKg: 150, ignored: ['incline-db-press'] })).toBeNull();
    // нет данных — нет предупреждения даже на огромном весе
    expect(checkWeight({ ...base, exerciseId: 'leg-press', weightKg: 900 })).toBeNull();
    // опечатка: ≥ 8× прошлой записи, предложение — в 10 раз меньше
    expect(checkWeight({ ...base, weightKg: 225, lastWeightKg: 22.5 })).toEqual({
      kind: 'typo',
      suggestionKg: 22.5,
    });
    expect(checkWeight({ ...base, weightKg: 22.5 * (TYPO_FACTOR - 1), lastWeightKg: 22.5 })?.kind).not.toBe(
      'typo',
    );
    // без прошлой записи проверки опечатки нет
    expect(checkWeight({ ...base, exerciseId: 'leg-press', weightKg: 500, lastWeightKg: null })).toBeNull();
  });
});

test.describe('legal acceptance', () => {
  const meta = { privacy: { version: '1.2' }, terms: { version: '1.0' } };
  test('accept again when any version grows', () => {
    expect(needsAcceptanceFor(null, meta)).toBe(true);
    expect(needsAcceptanceFor({ privacy: '1.2', terms: '1.0', at: 'x' }, meta)).toBe(false);
    expect(needsAcceptanceFor({ privacy: '1.1', terms: '1.0', at: 'x' }, meta)).toBe(true);
    expect(needsAcceptanceFor({ privacy: '1.2', terms: '0.9', at: 'x' }, meta)).toBe(true);
  });
});

test.describe('migration v2 → v3', () => {
  test('settings and profile', () => {
    expect(migrateThemeV2('light')).toBe('classic-orange');
    expect(migrateThemeV2('dark')).toBe('classic-dark');
    expect(migrateThemeV2('system')).toBe('auto');
    expect(migrateThemeV2('nonsense')).toBe('classic-orange');
    const s = migrateSettingsV2({ theme: 'dark', restBaseSec: 180, sound: false });
    expect(s).toMatchObject({
      theme: 'classic-dark',
      restBaseSec: 180,
      sound: false,
      tipState: {},
      weightWarningIgnored: [],
    });
    expect(migrateProfileV2({ weightKg: 80 })).toMatchObject({ weightKg: 80, legalAccepted: null });
    expect(migrateProfileV2(null)).toBeNull();
  });
});

test.describe('stats', () => {
  test('weekly counts and records', () => {
    const now = Date.parse('2026-11-12T12:00:00');
    const mk = (iso: string, w: number, r: number): Session => ({
      id: iso,
      dayId: 'd',
      startedAt: iso,
      endedAt: iso,
      entries: [{ exerciseId: 'incline-db-press', sets: [{ done: true, weightKg: w, reps: r }] }],
    });
    const list = [
      mk('2026-11-11T10:00:00', 20, 10),
      mk('2026-11-10T10:00:00', 25, 6),
      mk('2026-11-03T10:00:00', 22, 12),
    ];
    const weeks = weeklyStats(list, now, 10);
    expect(weeks).toHaveLength(10);
    expect(weeks[9]!.workouts).toBe(2);
    expect(weeks[9]!.volumeKg).toBe(20 * 10 + 25 * 6);
    expect(weeks[8]!.workouts).toBe(1);
    const r = exerciseRecords(list, 'incline-db-press');
    expect(r.maxWeight?.value).toBe(25);
    expect(r.maxReps?.value).toBe(12);
    expect(r.maxSetVolume?.value).toBe(22 * 12);
  });
});
