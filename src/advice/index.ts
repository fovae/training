import { findExercise } from '../data/exercises';
import type { PlanItem } from '../types';
import { lastPerformance } from '../state/session';
import { settings } from '../state/settings';

/**
 * Советы по правилам, офлайн (docs/CONCEPT.md, раздел 7).
 *
 * Этап 1: только точка расширения и одно правило, которое уже было в первой версии
 * (подсказка прогрессии). Правила этапа 2 (снижение нагрузки, нереалистичный вес,
 * опечатка ×10, восстановление 48 ч, подсказки по уровню) добавляются сюда новыми
 * функциями Rule без изменений в интерфейсе.
 */
export interface Advice {
  id: string;
  kind: 'progression' | 'deload' | 'unrealistic' | 'typo' | 'recovery' | 'technique';
  /** Ключ словаря и параметры */
  textKey: string;
  params?: Record<string, string | number>;
  /** Можно закрыть (предупреждения) */
  dismissible?: boolean;
}

export type Rule = (ctx: { item: PlanItem }) => Advice | null;

/** Верх диапазона во всех рабочих подходах прошлой тренировки */
const progression: Rule = ({ item }) => {
  const ex = findExercise(item.exerciseId);
  if (!ex || ex.metric !== 'weight_reps') return null;
  const done = lastPerformance(item.exerciseId)?.sets.filter((s) => s.done) ?? [];
  if (done.length < item.sets) return null;
  const ok = done.slice(0, item.sets).every((s) => (s.reps ?? 0) >= item.repsMax);
  return ok
    ? { id: `progression:${item.exerciseId}`, kind: 'progression', textKey: 'advice.progression' }
    : null;
};

const RULES: Rule[] = [progression];

export function adviceFor(item: PlanItem): Advice[] {
  if (!settings.value.tipsEnabled) return [];
  return RULES.map((r) => r({ item })).filter((a): a is Advice => a !== null);
}
