import { expect, test } from '@playwright/test';
import {
  MAX_TIPS_PER_SESSION,
  TIP_SNOOZE_DAYS,
  deload,
  isSnoozed,
  lightStart,
  progression,
  RECOVERY_GROUP,
  recovery,
  tipsFor,
} from '../../src/advice/rules';
import { LEVELS, WEIGHT_LIMIT_MULTIPLIER, levelBehavior } from '../../src/advice/levels';
import { TYPO_FACTOR, checkWeight, weightLimitKg } from '../../src/advice/weight';
import {
  BARBELL_LIMITS_APPROVED,
  LIMIT_MARGIN,
  classRecordFor,
  type ClassLimit,
  type RatioLimit,
  TEST_FLAGS_KEY,
  WEIGHT_LIMITS,
  findWeightLimit,
  ratioFor,
} from '../../src/data/weightLimits';
import { MUSCLES, allExercises, findExercise, loadCatalog } from '../../src/data/exercises';
import { needsAcceptanceFor } from '../../src/content/legal/acceptance';
import { EASIER, TEMPLATES, buildPlan, setsFor } from '../../src/data/templates';
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

  test('recovery: new muscles and exercises (stage 3A table)', () => {
    // Таблица покрывает каждую мышцу базы
    for (const m of MUSCLES) expect(RECOVERY_GROUP[m], m).toBeTruthy();
    for (const e of allExercises())
      for (const m of e.primaryMuscles) expect(RECOVERY_GROUP[m], `${e.id}: ${m}`).toBeTruthy();
    // Присед вчера → гоблет-присед сегодня: квадрицепсы и ягодицы
    const legs = [item('goblet-squat')];
    expect(recovery('day-1', legs, [session(20, 'back-squat', reps(5))], NOW)?.muscles?.sort()).toEqual([
      'glutes',
      'quads',
    ]);
    // Становая вчера → румынская тяга сегодня: задняя поверхность бедра и ягодицы
    expect(
      recovery(
        'day-1',
        [item('romanian-deadlift')],
        [session(30, 'deadlift', reps(5))],
        NOW,
      )?.muscles?.sort(),
    ).toEqual(['glutes', 'hamstrings']);
    // Разведение ног в тренажёре (отводящие) считается как ягодицы
    expect(
      recovery('day-1', [item('barbell-hip-thrust')], [session(10, 'hip-abduction', reps(15))], NOW)?.muscles,
    ).toEqual(['glutes']);
    // Сведение (приводящие) и сумо-присед
    expect(
      recovery('day-1', [item('db-sumo-squat')], [session(10, 'hip-adduction', reps(15))], NOW)?.muscles,
    ).toEqual(['adductors']);
    // Подтягивания вчера → тяга штанги сегодня: широчайшие
    expect(
      recovery('day-1', [item('barbell-row')], [session(20, 'pull-up', [{ reps: 8 }])], NOW)?.muscles,
    ).toContain('lats');
    // Растяжка, ходьба, скакалка, планка — не нагрузка для правила
    for (const easy of ['hamstring-stretch', 'treadmill-walk', 'jump-rope', 'plank', 'wall-sit'])
      expect(
        recovery(
          'day-1',
          [item('romanian-deadlift'), item('back-squat'), item('crunch')],
          [session(5, easy, [{ seconds: 30 }])],
          NOW,
        ),
        easy,
      ).toBeNull();
    // …и в плане на сегодня тоже не вызывают совета
    expect(recovery('day-1', [item('hamstring-stretch')], [session(5, 'deadlift', reps(5))], NOW)).toBeNull();
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
  test('table: only free-weight exercises with confirmed data, margin ≥ 15%', () => {
    for (const w of WEIGHT_LIMITS) {
      const ex = findExercise(w.exerciseId)!;
      expect(ex, w.exerciseId).toBeTruthy();
      expect(
        ex.equipment.some((q) => q === 'machine' || q === 'cable'),
        w.exerciseId,
      ).toBe(false);
      if (w.basis === 'standards-elite') {
        expect(w.male, w.exerciseId).toBeGreaterThan(0);
        expect(w.female, w.exerciseId).toBeGreaterThan(0);
      } else {
        // Категории IPF: мужчины 59…120 и 120+, женщины 47…84 и 84+
        expect(w.classes.male.map((c) => c.upTo)).toEqual([59, 66, 74, 83, 93, 105, 120, null]);
        expect(w.classes.female.map((c) => c.upTo)).toEqual([47, 52, 57, 63, 69, 76, 84, null]);
        for (const c of [...w.classes.male, ...w.classes.female]) expect(c.kg).toBeGreaterThan(50);
      }
      expect(w.source.length).toBeGreaterThan(10);
      expect(w.sourceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Гантели — на одну гантель, штанга — общий вес
      expect(w.perDumbbell, w.exerciseId).toBe(ex.equipment.includes('dumbbell'));
    }
    for (const m of Object.values(LIMIT_MARGIN)) expect(m).toBeGreaterThanOrEqual(0.15);
    // станки, блоки и смешанное оборудование — без предупреждений
    for (const id of ['leg-press', 'lat-pulldown', 'flat-press', 'seated-shoulder-press', 'calf-raise'])
      expect(findWeightLimit(id), id).toBeUndefined();
  });

  test('threshold by sex, level and body weight', () => {
    const lim = findWeightLimit('incline-db-press') as RatioLimit;
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

test.describe('weight limits: barbell (stage 3A)', () => {
  const BARBELL = [
    'back-squat',
    'barbell-bench-press',
    'deadlift',
    'overhead-press',
    'barbell-row',
    'barbell-hip-thrust',
    'barbell-curl',
    'romanian-deadlift',
  ];
  const withFlag = <T>(fn: () => T): T => {
    const g = globalThis as { localStorage?: unknown };
    const prev = g.localStorage;
    g.localStorage = { getItem: (k: string) => (k === TEST_FLAGS_KEY ? 'other,barbell-limits' : null) };
    try {
      return fn();
    } finally {
      g.localStorage = prev;
    }
  };
  const check = (exerciseId: string, sex: 'male' | 'female' | 'unspecified', bw: number, weightKg: number) =>
    checkWeight({
      exerciseId,
      weightKg,
      bodyWeightKg: bw,
      sex,
      level: 'intermediate',
      lastWeightKg: null,
      ignored: [],
    });

  test('rows exist, wait for the owner, off in production until approved', () => {
    expect(BARBELL_LIMITS_APPROVED).toBe(false);
    for (const id of BARBELL) {
      const lim = findWeightLimit(id, { includePending: true });
      expect(lim, id).toBeTruthy();
      expect(lim!.pending, id).toBe(true);
      expect(findWeightLimit(id), id).toBeUndefined();
      expect(weightLimitKg(id, 80, 'male', 'veteran'), id).toBeNull();
      expect(check(id, 'male', 80, 2000)).toBeNull();
    }
    for (const id of ['back-squat', 'barbell-bench-press', 'deadlift'])
      expect(findWeightLimit(id, { includePending: true })!.basis, id).toBe('class-record');
  });

  test('class model: nearest class rounding up, "+" above the top, record × 1.15 × level', () => {
    const dl = findWeightLimit('deadlift', { includePending: true }) as ClassLimit;
    // 80 кг → категория 83, 83 кг → 83, 83,1 → 93, 130 → 120+
    expect(classRecordFor(dl.classes.male, 80)).toBe(405);
    expect(classRecordFor(dl.classes.male, 83)).toBe(405);
    expect(classRecordFor(dl.classes.male, 83.1)).toBe(413);
    expect(classRecordFor(dl.classes.male, 130)).toBe(492.5);
    // Легче первой категории — первая категория
    expect(classRecordFor(dl.classes.female, 40)).toBe(212.5);
    // Порог не уменьшается с весом: у женщин 84 (291) меньше, чем 76 (291,5) — берём 291,5
    expect(classRecordFor(dl.classes.female, 80)).toBe(291.5);
    withFlag(() => {
      expect(weightLimitKg('deadlift', 80, 'male', 'intermediate')).toBeCloseTo(405 * 1.15);
      expect(weightLimitKg('deadlift', 80, 'male', 'few')).toBeCloseTo(405 * 1.15 * 0.8);
      expect(weightLimitKg('deadlift', 80, 'male', 'first')).toBeCloseTo(405 * 1.15 * 0.6);
      // «Пол не указан» — меньшая из двух колонок
      expect(weightLimitKg('deadlift', 80, 'unspecified', 'intermediate')).toBeCloseTo(291.5 * 1.15);
      expect(weightLimitKg('back-squat', 60, 'unspecified', 'intermediate')).toBeCloseTo(
        Math.min(326.5, 262.5) * 1.15,
      );
      // Порог выше рекорда категории не меньше чем на 15%
      for (const id of ['back-squat', 'barbell-bench-press', 'deadlift'] as const) {
        const lim = findWeightLimit(id) as ClassLimit;
        for (const sex of ['male', 'female'] as const)
          for (const c of lim.classes[sex]) {
            const bw = c.upTo ?? 150;
            expect(weightLimitKg(id, bw, sex, 'veteran')!).toBeGreaterThanOrEqual(c.kg * 1.15 - 1e-9);
          }
      }
    });
  });

  test('owner examples (intermediate level)', () => {
    withFlag(() => {
      // мужчина 80 кг, становая 200 кг → без предупреждения
      expect(check('deadlift', 'male', 80, 200)).toBeNull();
      // мужчина 80 кг, присед 513 кг → предупреждение (порог 396 × 1,15 = 455,4)
      expect(check('back-squat', 'male', 80, 513)?.kind).toBe('unrealistic');
      // женщина 60 кг, жим лёжа 80 кг → без предупреждения
      expect(check('barbell-bench-press', 'female', 60, 80)).toBeNull();
    });
  });

  // Пример владельца «женщина 50 кг, становая 250 кг → предупреждение» по заданной модели не
  // выполняется: категория 52 кг, рекорд 220,5 кг × 1,15 = 253,6 кг > 250. Нужна правка модели или
  // примера — вопрос владельцу (docs/WEIGHT_LIMITS.md). Тест фиксирует фактическое поведение.
  test('owner example: female 50 kg, deadlift 250 kg — model gives 253.6 kg threshold (open question)', () => {
    withFlag(() => {
      expect(weightLimitKg('deadlift', 50, 'female', 'intermediate')).toBeCloseTo(220.5 * 1.15);
      expect(check('deadlift', 'female', 50, 250)).toBeNull();
      expect(check('deadlift', 'female', 50, 254)?.kind).toBe('unrealistic');
    });
  });

  test('other barbell exercises keep Strength Level Elite +50%; typo check works for barbell', () => {
    withFlag(() => {
      expect(weightLimitKg('overhead-press', 80, 'female', 'first')).toBeCloseTo(1.125 * 1.5 * 0.6 * 80);
      expect(weightLimitKg('barbell-hip-thrust', 80, 'male', 'veteran')).toBeCloseTo(3.86 * 1.5 * 80);
      const lim = weightLimitKg('romanian-deadlift', 80, 'male', 'intermediate')!;
      expect(check('romanian-deadlift', 'male', 80, lim)).toBeNull();
      expect(check('romanian-deadlift', 'male', 80, lim + 1)?.kind).toBe('unrealistic');
      expect(
        checkWeight({
          exerciseId: 'deadlift',
          weightKg: 1000,
          bodyWeightKg: 80,
          sex: 'male',
          level: 'intermediate',
          lastWeightKg: 100,
          ignored: [],
        }),
      ).toEqual({ kind: 'typo', suggestionKg: 100 });
    });
  });

  test('no data — no warning (null) for other barbell and new exercises', () => {
    withFlag(() => {
      for (const id of [
        'front-squat',
        'incline-barbell-press',
        'close-grip-bench-press',
        'skull-crusher',
        'upright-row',
        't-bar-row',
        'reverse-curl',
        'kettlebell-swing',
        'goblet-squat',
        'hack-squat',
        'push-up',
      ])
        expect(weightLimitKg(id, 80, 'male', 'veteran'), id).toBeNull();
    });
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

test.describe('templates (stage 3A)', () => {
  test('four new templates + Split 3+1; only exercises from the base; no weight', () => {
    expect(TEMPLATES.map((x) => x.id)).toEqual([
      'full-body-3',
      'upper-lower-4',
      'ppl-3',
      'light-2',
      'split31',
    ]);
    const days: Record<string, number> = {
      'full-body-3': 3,
      'upper-lower-4': 4,
      'ppl-3': 3,
      'light-2': 2,
      split31: 4,
    };
    for (const tpl of TEMPLATES) {
      for (const level of ['first', 'few', 'intermediate', 'veteran'] as const) {
        const plan = buildPlan({ templateId: tpl.id, days: 5, mode: 'cycle', level });
        expect(plan.days.length, tpl.id).toBe(days[tpl.id]);
        for (const d of plan.days) {
          expect(d.items.length, `${tpl.id} ${d.id}`).toBeGreaterThan(0);
          for (const it of d.items) {
            expect(findExercise(it.exerciseId), it.exerciseId).toBeTruthy();
            expect(it.targetWeightKg, 'вес не подставляется').toBeUndefined();
            expect(it.sets).toBeGreaterThanOrEqual(1);
            expect(it.repsMin).toBeLessThanOrEqual(it.repsMax);
          }
          // без дублей в одном дне
          expect(new Set(d.items.map((i) => i.exerciseId)).size).toBe(d.items.length);
        }
      }
    }
  });

  test('levels: fewer sets and simpler exercises for beginners', () => {
    const vet = buildPlan({ templateId: 'ppl-3', days: 3, mode: 'cycle', level: 'veteran' });
    const first = buildPlan({ templateId: 'ppl-3', days: 3, mode: 'cycle', level: 'first' });
    const few = buildPlan({ templateId: 'ppl-3', days: 3, mode: 'cycle', level: 'few' });
    const ids = (p: typeof vet) => p.days.flatMap((d) => d.items.map((i) => i.exerciseId));
    expect(ids(vet)).toContain('back-squat');
    expect(ids(first)).not.toContain('back-squat');
    expect(ids(first)).toContain('goblet-squat');
    expect(ids(few)).toContain('flat-press');
    for (const id of ids(first)) expect(Object.keys(EASIER), id).not.toContain(id);
    const sets = (p: typeof vet) => p.days.flatMap((d) => d.items.map((i) => i.sets));
    expect(Math.max(...sets(first))).toBeLessThanOrEqual(3);
    expect(sets(first).reduce((a, b) => a + b)).toBeLessThan(sets(vet).reduce((a, b) => a + b));
    expect(setsFor(3, 'first')).toBe(2);
    expect(setsFor(4, 'first')).toBe(3);
    expect(setsFor(1, 'first')).toBe(1);
    expect(setsFor(4, 'few')).toBe(3);
    expect(setsFor(4, 'veteran')).toBe(4);
    // «Сплит 3+1» — личная программа, не подстраивается
    const s1 = buildPlan({ templateId: 'split31', days: 4, mode: 'cycle', level: 'first' });
    const s2 = buildPlan({ templateId: 'split31', days: 4, mode: 'cycle', level: 'veteran' });
    expect(s1).toEqual(s2);
  });
});
