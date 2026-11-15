import { computed } from '@preact/signals';
import { findExercise } from '../data/exercises';
import { calibrationFactor, estimateDay, estimateItems, sessionItems, type Estimate } from '../lib/duration';
import type { Day } from '../types';
import { history, restFor } from './session';
import { profile, settings } from './settings';

/**
 * Оценка длительности с настройками и историей пользователя (модель — src/lib/duration.ts).
 * Личный коэффициент не хранится: считается из истории на лету и пересчитывается сам после каждой
 * завершённой тренировки (computed от history и настроек) — нечего мигрировать и нечему устаревать.
 */
export const calibration = computed(() => {
  if (settings.value.useHistory === false) return { factor: 1, n: 0 };
  const level = profile.value?.level;
  return calibrationFactor(
    history.value,
    (s) =>
      estimateItems(
        sessionItems(s, findExercise, (ex) => restFor(ex)),
        { level },
      ).sec.typical,
  );
});

/** Оценка дня плана: модель + «Мой темп» + личный коэффициент */
export function estimateForDay(day: Day): Estimate {
  return estimateDay(
    day,
    { find: findExercise, restFor: (ex, item) => restFor(ex, item) },
    {
      level: profile.value?.level,
      pace: settings.value.pace ?? 'normal',
      calibration: calibration.value.factor,
    },
  );
}
