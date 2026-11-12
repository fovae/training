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
];

const INDEX = new Map(WEIGHT_LIMITS.map((w) => [w.exerciseId, w]));
export const findWeightLimit = (exerciseId: string): WeightLimit | undefined => INDEX.get(exerciseId);

/** Отношение для пола; «не указан» — среднее мужского и женского */
export function ratioFor(limit: WeightLimit, sex: Sex | undefined): number {
  if (sex === 'male') return limit.male;
  if (sex === 'female') return limit.female;
  return (limit.male + limit.female) / 2;
}
