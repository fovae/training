import { LIMIT_MARGIN, findWeightLimit, ratioFor } from '../data/weightLimits';
import type { Level, Sex } from '../types';
import { WEIGHT_LIMIT_MULTIPLIER } from './levels';

/**
 * Проверки введённого веса (docs/CONCEPT.md, раздел 7, пункт 3). Не блокируют ввод:
 * человек может сказать «Всё верно». Не совет о весе тела — только о весе снаряда.
 */

/** Во сколько раз больше прошлой записи считать возможной опечаткой */
export const TYPO_FACTOR = 8;

export interface WeightCheckInput {
  exerciseId: string;
  /** Введённый вес снаряда, кг */
  weightKg: number;
  bodyWeightKg: number | undefined;
  sex: Sex | undefined;
  level: Level | undefined;
  /** Прошлая максимальная запись по упражнению, кг */
  lastWeightKg: number | null;
  ignored: string[];
}

export type WeightCheck =
  { kind: 'typo'; suggestionKg: number } | { kind: 'unrealistic'; limitKg: number } | null;

/** Порог для упражнения; null — подтверждённых данных нет, предупреждения нет */
export function weightLimitKg(
  exerciseId: string,
  bodyWeightKg: number | undefined,
  sex: Sex | undefined,
  level: Level | undefined,
): number | null {
  const lim = findWeightLimit(exerciseId);
  if (!lim || !bodyWeightKg || bodyWeightKg <= 0) return null;
  const mult = WEIGHT_LIMIT_MULTIPLIER[level ?? 'intermediate'];
  return ratioFor(lim, sex) * (1 + LIMIT_MARGIN[lim.basis]) * mult * bodyWeightKg;
}

/** Похоже на лишний ноль: предлагаем вес в 10 раз меньше, округлённый до 0,5 */
const suggest = (kg: number) => Math.round((kg / 10) * 2) / 2;

export function checkWeight(i: WeightCheckInput): WeightCheck {
  if (!(i.weightKg > 0)) return null;
  if (i.lastWeightKg && i.lastWeightKg > 0 && i.weightKg >= i.lastWeightKg * TYPO_FACTOR)
    return { kind: 'typo', suggestionKg: suggest(i.weightKg) };
  if (i.ignored.includes(i.exerciseId)) return null;
  const limit = weightLimitKg(i.exerciseId, i.bodyWeightKg, i.sex, i.level);
  if (limit != null && i.weightKg > limit) return { kind: 'unrealistic', limitKg: limit };
  return null;
}
