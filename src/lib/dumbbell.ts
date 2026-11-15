import type { Exercise, SessionSet } from '../types';

/**
 * Гантели и подходы «на руку» (docs/ARCHITECTURE.md, «Гантели и стороны»). Чистые функции.
 *
 * Вес в подходе — всегда вес ОДНОЙ гантели (так считались и прежние записи, и пороги
 * docs/WEIGHT_LIMITS.md). Режим веса записывается в подход (SessionSet.load):
 *  - нет поля — как до 3.17: один вес (штанга, тренажёр, одна гантель); объём = вес × повторы;
 *  - 'x2'  — по гантели в каждой руке одного веса («12 × 2»); объём = вес × 2 × повторы;
 *  - 'lr'  — левая (weightKg) и правая (weightRKg) отдельно; объём = Л × повторы Л + П × повторы П.
 * Повторы у упражнений «на руку / на сторону» (Exercise.per) — НА СТОРОНУ: reps — левая (или обе),
 * repsR — правая, если отличается. «По очереди, общий счёт» — только способ ввода: 16 всего →
 * 8 на руку; нечётный счёт (15) приложение не округляет, а спрашивает, какая сторона сделала больше.
 * Режим ввода (load и счёт) запоминается для упражнения в Settings.exerciseModes.
 */

export type LoadMode = 'one' | 'x2' | 'lr';
export type CountMode = 'side' | 'total';

/** Упражнения с одной гантелью (обеими руками или одна гантель на всё упражнение) — без «×2» */
export const SINGLE_DUMBBELL = new Set([
  'db-pullover',
  'goblet-squat',
  'db-sumo-squat',
  'overhead-db-extension',
  'russian-twist',
  'db-hip-thrust',
  'kettlebell-deadlift',
  'kettlebell-halo',
  'suitcase-carry',
  'single-leg-calf-raise',
]);

/** Нет гантелей или одна гантель — режима нет (null). Иначе — доступные режимы веса. */
export function loadModes(ex: Pick<Exercise, 'id' | 'equipment' | 'metric'> | undefined): LoadMode[] | null {
  if (!ex || ex.metric !== 'weight_reps' || !ex.equipment.includes('dumbbell') || SINGLE_DUMBBELL.has(ex.id))
    return null;
  // гантели или другой снаряд (тренажёр, блок, штанга, гиря) — можно записать и одним весом
  const mixed = ex.equipment.some((q) => q !== 'dumbbell' && q !== 'bench' && q !== 'bodyweight');
  return mixed ? ['one', 'x2', 'lr'] : ['x2', 'lr'];
}

/**
 * Режим по умолчанию: «на руку» по одной гантели (тяга одной рукой, концентрированный подъём) —
 * две гантели отдельно; парные гантели — «×2»; гантели или тренажёр — один вес.
 */
export function defaultLoad(ex: Pick<Exercise, 'id' | 'equipment' | 'metric' | 'per'> | undefined): LoadMode {
  const m = loadModes(ex);
  if (!m) return 'one';
  if (m.includes('one')) return 'one';
  return ex?.per === 'arm' ? 'lr' : 'x2';
}

/** Общий счёт «по очереди» → повторы на сторону; нечётный — два варианта на выбор */
export function splitTotal(total: number): { left: number; right: number } | { odd: [number, number] } {
  const n = Math.max(0, Math.round(total));
  if (n % 2 === 0) return { left: n / 2, right: n / 2 };
  return { odd: [Math.ceil(n / 2), Math.floor(n / 2)] };
}

/** Счёт: «всего» возможен только у упражнений «на руку / сторону» */
export const countModeOf = (
  ex: Pick<Exercise, 'per'> | undefined,
  saved: CountMode | undefined,
): CountMode => (ex?.per && saved === 'total' ? 'total' : 'side');

/** Общий счёт подхода (обе стороны) — для поля в режиме «всего» */
export const totalReps = (s: Pick<SessionSet, 'reps' | 'repsR'>): number | undefined =>
  s.reps == null ? undefined : s.reps + (s.repsR ?? s.reps);

/** Объём подхода (вес × повторы) по режиму; прежние записи — как раньше */
export function setVolumeKg(s: SessionSet): number {
  const w = s.weightKg ?? 0;
  const reps = s.reps ?? 0;
  if (s.load === 'x2') return w * 2 * reps;
  if (s.load === 'lr') return w * reps + (s.weightRKg ?? w) * (s.repsR ?? reps);
  return w * reps;
}

/** Вес одной гантели для рекордов и проверки веса: тяжёлая из двух */
export const setTopWeightKg = (s: SessionSet): number => Math.max(s.weightKg ?? 0, s.weightRKg ?? 0);
