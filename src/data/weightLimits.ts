import type { Sex } from '../types';

/**
 * Пороги предупреждения о нереальном весе (docs/WEIGHT_LIMITS.md — источники и расчёт).
 *
 * ratio — максимальное отношение нагрузки к весу тела по источнику (для гантелей — на ОДНУ гантель).
 * Порог = ratio × (1 + запас) × множитель уровня × вес тела. Предупреждаем только выше порога.
 * Упражнения без подтверждённых данных (станки, блоки, тренажёры, смешанное оборудование)
 * в таблицу не входят — для них предупреждения нет.
 *
 * Чтобы добавить упражнение (например, штангу на этапе 3): запись сюда + строка в WEIGHT_LIMITS.md.
 */

export interface WeightLimit {
  exerciseId: string;
  /** Максимальное отношение к весу тела (до запаса) */
  male: number;
  female: number;
  /** На одну гантель */
  perDumbbell: boolean;
  basis: 'standards-elite' | 'world-record';
  source: string;
  /** Дата данных источника */
  sourceDate: string;
  /**
   * Ждёт подтверждения владельца (штанга, этап 3А): в боевой сборке не действует, пока
   * BARBELL_LIMITS_APPROVED = false. В тестах включается флагом (см. pendingLimitsEnabled).
   */
  pending?: boolean;
}

/**
 * Пороги для штанги (этап 3А) — после подтверждения владельцем таблицы в docs/WEIGHT_LIMITS.md
 * поменять на true. Это единственная строка, которую нужно изменить.
 */
export const BARBELL_LIMITS_APPROVED = false;

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
  'world-record': 0.15,
};

const SL = (slug: string) => `Strength Level, ${slug} (kg), «Elite» по весу тела`;
const SL_DATE = '2026-03-05';
const OPL =
  'OpenPowerlifting / OpenIPF, records (rank 1, full power), max(рекорд / верхняя граница категории)';
const OPL_DATE = '2026-11-12';

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
  // Силовое троеборье: опубликованные рекорды, запас +15%
  {
    exerciseId: 'back-squat',
    male: 5.58, // 290 кг / 52 кг (openpowerlifting.org/records)
    female: 4.64, // 260 кг / 56 кг (openpowerlifting.org/records/women)
    perDumbbell: false,
    basis: 'world-record',
    source: OPL,
    sourceDate: OPL_DATE,
    pending: true,
  },
  {
    exerciseId: 'barbell-bench-press',
    male: 3.41, // 177,5 кг / 52 кг
    female: 2.37, // 132,5 кг / 56 кг
    perDumbbell: false,
    basis: 'world-record',
    source: OPL,
    sourceDate: OPL_DATE,
    pending: true,
  },
  {
    exerciseId: 'deadlift',
    male: 5.14, // 303 кг / 59 кг (openipf.org/records)
    female: 4.52, // 212,5 кг / 47 кг (openipf.org/records/women)
    perDumbbell: false,
    basis: 'world-record',
    source: OPL,
    sourceDate: OPL_DATE,
    pending: true,
  },
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

/** Отношение для пола; «не указан» — среднее мужского и женского */
export function ratioFor(limit: WeightLimit, sex: Sex | undefined): number {
  if (sex === 'male') return limit.male;
  if (sex === 'female') return limit.female;
  return (limit.male + limit.female) / 2;
}
