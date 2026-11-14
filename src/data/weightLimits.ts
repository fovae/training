import type { Sex } from '../types';

/**
 * Пороги предупреждения о нереальном весе (docs/WEIGHT_LIMITS.md — источники и расчёт).
 *
 * Две модели:
 *  - «ratio» (standards-elite): порог = отношение × (1 + запас) × множитель уровня × вес тела.
 *    Отношение — максимум «нагрузка / вес тела» по таблице стандартов (для гантелей — на ОДНУ гантель).
 *  - «class-record» (присед, жим лёжа, становая): порог = рекорд весовой категории пользователя
 *    × (1 + запас) × множитель уровня. Категория — ближайшая сверху по весу тела (IPF), выше
 *    последней границы — категория «+».
 * Предупреждаем только выше порога. Упражнения без подтверждённых данных в таблицу не входят.
 *
 * Добавить упражнение: запись сюда + строка в WEIGHT_LIMITS.md.
 */

interface LimitBase {
  exerciseId: string;
  /** На одну гантель (иначе — общий вес снаряда) */
  perDumbbell: boolean;
  source: string;
  /** Дата данных источника */
  sourceDate: string;
  /**
   * Ждёт подтверждения владельца (штанга, этап 3А): в боевой сборке не действует, пока
   * BARBELL_LIMITS_APPROVED = false. В тестах включается флагом (см. pendingLimitsEnabled).
   */
  pending?: boolean;
}

export interface RatioLimit extends LimitBase {
  basis: 'standards-elite';
  /** Максимальное отношение к весу тела (до запаса) */
  male: number;
  female: number;
}

/** Рекорд весовой категории: upTo — верхняя граница категории, кг (null — категория «+») */
export interface ClassRecord {
  upTo: number | null;
  kg: number;
}

export interface ClassLimit extends LimitBase {
  basis: 'class-record';
  /** Категории по возрастанию, последняя — «+» (upTo: null) */
  classes: { male: ClassRecord[]; female: ClassRecord[] };
}

export type WeightLimit = RatioLimit | ClassLimit;

/**
 * Пороги для штанги (этап 3А): таблица в docs/WEIGHT_LIMITS.md подтверждена владельцем 2026-11-14 —
 * предупреждения включены в боевой сборке.
 */
export const BARBELL_LIMITS_APPROVED = true;

/** Тестовый режим: localStorage['tp-test-flags'] содержит «barbell-limits» (ставят e2e-тесты) */
export const TEST_FLAGS_KEY = 'tp-test-flags';
export function pendingLimitsEnabled(): boolean {
  if (BARBELL_LIMITS_APPROVED) return true;
  try {
    return (globalThis.localStorage?.getItem(TEST_FLAGS_KEY) ?? '').split(',').includes('barbell-limits');
  } catch {
    return false;
  }
}

/**
 * Запас над источником. Для таблиц стандартов (уровень Elite — это не рекорд) берём +50%,
 * для мировых рекордов будет достаточно +15% (минимум по ТЗ).
 */
export const LIMIT_MARGIN: Record<WeightLimit['basis'], number> = {
  'standards-elite': 0.5,
  'class-record': 0.15,
};

const SL = (slug: string) => `Strength Level, ${slug} (kg), «Elite» по весу тела`;
const SL_DATE = '2026-03-05';
const OPL = 'OpenIPF + OpenPowerlifting (IPF classes), rank 1, max(без экипировки, однослойная экипировка)';
const OPL_DATE = '2026-11-12';

/**
 * Рекорды по категориям IPF (кг). Мужчины 59…120, 120+; женщины 47…84, 84+.
 * Для каждой категории — наибольшее из «без экипировки» (raw / raw+wraps) и «однослойная
 * экипировка» (single-ply), Full Power и All Events. Атлеты, даты и страницы — docs/WEIGHT_LIMITS.md.
 */
// prettier-ignore
const CLASS_RECORDS: Record<'back-squat' | 'barbell-bench-press' | 'deadlift', ClassLimit['classes']> = {
  'back-squat': {
    male: [{ upTo: 59, kg: 300 }, { upTo: 66, kg: 326.5 }, { upTo: 74, kg: 370 }, { upTo: 83, kg: 396 }, { upTo: 93, kg: 423 }, { upTo: 105, kg: 467.2 }, { upTo: 120, kg: 487.5 }, { upTo: null, kg: 544.3 }],
    female: [{ upTo: 47, kg: 210 }, { upTo: 52, kg: 232.5 }, { upTo: 57, kg: 260 }, { upTo: 63, kg: 262.5 }, { upTo: 69, kg: 264 }, { upTo: 76, kg: 310 }, { upTo: 84, kg: 311 }, { upTo: null, kg: 335 }],
  },
  'barbell-bench-press': {
    male: [{ upTo: 59, kg: 240 }, { upTo: 66, kg: 260 }, { upTo: 74, kg: 305 }, { upTo: 83, kg: 322.5 }, { upTo: 93, kg: 362.5 }, { upTo: 105, kg: 376 }, { upTo: 120, kg: 410 }, { upTo: null, kg: 508 }],
    female: [{ upTo: 47, kg: 141 }, { upTo: 52, kg: 170.5 }, { upTo: 57, kg: 169 }, { upTo: 63, kg: 185 }, { upTo: 69, kg: 190 }, { upTo: 76, kg: 205 }, { upTo: 84, kg: 229 }, { upTo: null, kg: 250 }],
  },
  'deadlift': {
    male: [{ upTo: 59, kg: 303 }, { upTo: 66, kg: 345 }, { upTo: 74, kg: 365 }, { upTo: 83, kg: 405 }, { upTo: 93, kg: 413 }, { upTo: 105, kg: 447.5 }, { upTo: 120, kg: 472.5 }, { upTo: null, kg: 492.5 }],
    female: [{ upTo: 47, kg: 212.5 }, { upTo: 52, kg: 220.5 }, { upTo: 57, kg: 240 }, { upTo: 63, kg: 245.5 }, { upTo: 69, kg: 260 }, { upTo: 76, kg: 291.5 }, { upTo: 84, kg: 291 }, { upTo: null, kg: 297.5 }],
  },
};

/** Отношения посчитаны как max(Elite / вес тела) по строкам таблиц (самый лёгкий вес тела) */
export const WEIGHT_LIMITS: WeightLimit[] = [
  {
    exerciseId: 'incline-db-press',
    male: 0.84,
    female: 0.675,
    perDumbbell: true,
    basis: 'standards-elite',
    source: SL('incline-dumbbell-bench-press'),
    sourceDate: SL_DATE,
  },
  {
    exerciseId: 'chest-supported-db-row',
    male: 1.04,
    female: 0.825,
    perDumbbell: true,
    basis: 'standards-elite',
    source: SL('dumbbell-row'),
    sourceDate: SL_DATE,
  },
  {
    exerciseId: 'incline-db-curl',
    male: 0.64,
    female: 0.5,
    perDumbbell: true,
    basis: 'standards-elite',
    source: SL('dumbbell-curl'),
    sourceDate: SL_DATE,
  },
  {
    exerciseId: 'hammer-curl',
    male: 0.6,
    female: 0.45,
    perDumbbell: true,
    basis: 'standards-elite',
    source: SL('hammer-curl'),
    sourceDate: SL_DATE,
  },
  {
    exerciseId: 'lateral-raise',
    male: 0.52,
    female: 0.375,
    perDumbbell: true,
    basis: 'standards-elite',
    source: SL('dumbbell-lateral-raise'),
    sourceDate: SL_DATE,
  },
  {
    exerciseId: 'db-shrug',
    male: 1.2,
    female: 1.075,
    perDumbbell: true,
    basis: 'standards-elite',
    source: SL('dumbbell-shrug'),
    sourceDate: SL_DATE,
  },
  {
    exerciseId: 'wrist-curl',
    male: 0.9,
    female: 0.8,
    perDumbbell: true,
    basis: 'standards-elite',
    source: SL('dumbbell-wrist-curl'),
    sourceDate: SL_DATE,
  },
  {
    exerciseId: 'reverse-wrist-curl',
    male: 0.72,
    female: 0.625,
    perDumbbell: true,
    basis: 'standards-elite',
    source: SL('dumbbell-reverse-wrist-curl'),
    sourceDate: SL_DATE,
  },
  // ---------- штанга (этап 3А), ждёт подтверждения владельца ----------
  // Силовое троеборье: рекорд категории пользователя, запас +15%
  ...(['back-squat', 'barbell-bench-press', 'deadlift'] as const).map((id): ClassLimit => ({
    exerciseId: id,
    basis: 'class-record',
    classes: CLASS_RECORDS[id],
    perDumbbell: false,
    source: OPL,
    sourceDate: OPL_DATE,
    pending: true,
  })),
  // Остальное со штангой: федеративных рекордов нет — стандарты Strength Level (Elite), запас +50%
  {
    exerciseId: 'overhead-press',
    male: 1.34, // 67 / 50
    female: 1.125, // 45 / 40
    perDumbbell: false,
    basis: 'standards-elite',
    source: SL('shoulder-press'),
    sourceDate: SL_DATE,
    pending: true,
  },
  {
    exerciseId: 'barbell-row',
    male: 1.88, // 94 / 50
    female: 1.625, // 65 / 40
    perDumbbell: false,
    basis: 'standards-elite',
    source: SL('bent-over-row'),
    sourceDate: SL_DATE,
    pending: true,
  },
  {
    exerciseId: 'barbell-hip-thrust',
    male: 3.86, // 193 / 50
    female: 4.35, // 174 / 40
    perDumbbell: false,
    basis: 'standards-elite',
    source: SL('hip-thrust'),
    sourceDate: SL_DATE,
    pending: true,
  },
  {
    exerciseId: 'barbell-curl',
    male: 1.16, // 58 / 50
    female: 0.95, // 38 / 40
    perDumbbell: false,
    basis: 'standards-elite',
    source: SL('barbell-curl'),
    sourceDate: '2026-03-10',
    pending: true,
  },
  {
    exerciseId: 'romanian-deadlift',
    male: 2.8, // 140 / 50
    female: 2.525, // 101 / 40
    perDumbbell: false,
    basis: 'standards-elite',
    source: SL('romanian-deadlift'),
    sourceDate: SL_DATE,
    pending: true,
  },
];

const INDEX = new Map(WEIGHT_LIMITS.map((w) => [w.exerciseId, w]));

/**
 * Порог упражнения; undefined — данных нет (или строка ждёт подтверждения владельца).
 * includePending — для тестов и документации.
 */
export const findWeightLimit = (
  exerciseId: string,
  opts: { includePending?: boolean } = {},
): WeightLimit | undefined => {
  const lim = INDEX.get(exerciseId);
  if (lim?.pending && !opts.includePending && !pendingLimitsEnabled()) return undefined;
  return lim;
};

/** Отношение для пола (модель ratio); «не указан» — среднее мужского и женского */
export function ratioFor(limit: RatioLimit, sex: Sex | undefined): number {
  if (sex === 'male') return limit.male;
  if (sex === 'female') return limit.female;
  return (limit.male + limit.female) / 2;
}

/**
 * Рекорд категории для веса тела: ближайшая граница сверху, выше последней — категория «+».
 * Берём максимум по этой и всем более лёгким категориям: человек из лёгкой категории мог бы
 * выступать и в более тяжёлой, поэтому порог с ростом веса не уменьшается.
 */
export function classRecordFor(classes: ClassRecord[], bodyWeightKg: number): number {
  let best = 0;
  for (const c of classes) {
    best = Math.max(best, c.kg);
    if (c.upTo == null || bodyWeightKg <= c.upTo) return best;
  }
  return best;
}

/** Порог до запаса и множителя уровня, кг. «Пол не указан»: ratio — среднее, class-record — меньший. */
export function baseLimitKg(limit: WeightLimit, bodyWeightKg: number, sex: Sex | undefined): number {
  if (limit.basis === 'standards-elite') return ratioFor(limit, sex) * bodyWeightKg;
  const m = classRecordFor(limit.classes.male, bodyWeightKg);
  const f = classRecordFor(limit.classes.female, bodyWeightKg);
  return sex === 'male' ? m : sex === 'female' ? f : Math.min(m, f);
}
