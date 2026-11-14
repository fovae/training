import { findExercise } from '../data/exercises';
import { fmtNum, has, t, weekdayShort } from '../i18n';
import { fmtDuration, fmtRest, fmtTimeRange } from '../lib/format';
import { dayIndex, findDay, shownWeekday } from '../state/plan';
import { restFor } from '../state/session';
import type { Day, Exercise, Muscle, PlanItem } from '../types';

/** Переведённые подписи, общие для экранов */

export const exName = (id: string): string => (has(`ex.${id}.name`) ? t(`ex.${id}.name`) : id);

export const muscleName = (m: Muscle): string => t(`muscle.${m}`);

export const dayNumber = (id: string): string => t('day.n', { n: dayIndex(id) + 1 });

/** Название дня: своё → из шаблона → по главным мышцам → «Пустой день» */
export function dayTitle(day: Day | undefined): string {
  if (!day) return t('day.unknown');
  if (day.label) return day.label;
  if (day.labelKey && has(day.labelKey)) return t(day.labelKey);
  const groups: string[] = [];
  for (const item of day.items) {
    const ex = findExercise(item.exerciseId);
    const g = ex ? t(`category.${ex.category}`) : null;
    if (g && !groups.includes(g)) groups.push(g);
  }
  return groups.length ? groups.slice(0, 3).join(' + ') : t('day.empty');
}

export const dayTitleById = (id: string): string => dayTitle(findDay(id));

export function dayEyebrow(day: Day): string {
  const parts = [dayNumber(day.id)];
  const w = shownWeekday(day);
  if (w != null) parts.push(weekdayShort(w));
  return parts.join(' · ');
}

/** «3 × 8–12», «2 × 20–40 с», «на руку» */
export function schemeText(item: PlanItem, ex: Exercise | undefined): string {
  const range =
    ex?.metric === 'time'
      ? fmtTimeRange(item.repsMin, item.repsMax)
      : item.repsMin === item.repsMax
        ? fmtNum(item.repsMin)
        : `${fmtNum(item.repsMin)}–${fmtNum(item.repsMax)}`;
  const per = ex?.per ? ' ' + t(`per.${ex.per}`) : '';
  return `${fmtNum(item.sets)} × ${range}${per}`;
}

export const restText = (item: PlanItem, ex: Exercise | undefined): string => fmtRest(restFor(ex, item));

export const dayMeta = (day: Day): string => {
  const sets = day.items.reduce((a, i) => a + i.sets, 0);
  return `${t('plan.exercisesCount', { count: day.items.length })} · ${t('plan.setsCount', { count: sets })}`;
};

/**
 * Примерная длительность тренировки дня: работа в подходах (по повторам ~4 с, упражнения на время —
 * по заданному времени; «на каждую сторону» — вдвое), отдых между подходами (таймер отдыха) и ~1 мин
 * на переход к следующему упражнению. Округление до 5 минут. Необязательные упражнения не считаем.
 */
export function dayMinutes(day: Day): number {
  let sec = 0;
  const items = day.items.filter((i) => !i.optional);
  for (const item of items) {
    const ex = findExercise(item.exerciseId);
    const avg = (item.repsMin + item.repsMax) / 2;
    const work = (ex?.metric === 'time' ? avg : Math.max(20, avg * 4)) * (ex?.per === 'side' ? 2 : 1);
    sec += item.sets * work + Math.max(0, item.sets - 1) * restFor(ex, item) + 60;
  }
  return items.length ? Math.max(5, Math.round(sec / 300) * 5) : 0;
}

/** «примерно 45 мин» — или пусто, если в дне нет упражнений */
export const dayEstimate = (day: Day): string => {
  const min = dayMinutes(day);
  return min ? t('today.approx', { time: fmtDuration(min * 60000) }) : '';
};
