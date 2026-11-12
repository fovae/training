import { findExercise } from '../data/exercises';
import type { Level, Muscle, PlanItem, Session, SessionEntry, TipMark } from '../types';
import { levelBehavior } from './levels';

/**
 * Советы по правилам, офлайн, без ИИ (docs/CONCEPT.md, раздел 7). Чистые функции:
 * данные → список советов, без побочных эффектов. Никогда не про вес тела, питание и внешность.
 */

export type AdviceKind = 'recovery' | 'deload' | 'progression' | 'light-start';

export interface Advice {
  /** Ключ для tipState: `${kind}:${exerciseId|day}` */
  id: string;
  kind: AdviceKind;
  exerciseId?: string;
  /** Ключ словаря */
  textKey: string;
  /** Для «восстановления» — мышцы, которые нагружались < 48 ч назад */
  muscles?: Muscle[];
}

/** Порядок важности: при лимите «2 совета за тренировку» остаются самые полезные */
export const PRIORITY: Record<AdviceKind, number> = {
  recovery: 0,
  deload: 1,
  progression: 2,
  'light-start': 3,
};

export const MAX_TIPS_PER_SESSION = 2;
export const TIP_SNOOZE_DAYS = 14;
export const RECOVERY_HOURS = 48;
/** Сколько тренировок подряд ниже нижней границы нужно для совета «уменьшить вес» */
export const DELOAD_SESSIONS = 2;

const ms = (iso: string | undefined) => (iso ? Date.parse(iso) : 0);

/**
 * Таблица соответствия для правила восстановления: мышца из базы → группа, по которой
 * сравниваем «сегодня» и «последние 48 часов». Тип Record<Muscle, …> заставляет добавить сюда
 * каждую новую мышцу. Мелкие соседние группы объединены, чтобы совет звучал понятно.
 */
export const RECOVERY_GROUP: Record<Muscle, Muscle> = {
  chest: 'chest',
  lats: 'lats',
  'upper-back': 'upper-back',
  traps: 'traps',
  'front-delts': 'front-delts',
  'side-delts': 'side-delts',
  'rear-delts': 'rear-delts',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  abs: 'abs',
  obliques: 'obliques',
  'deep-core': 'deep-core',
  'lower-back': 'lower-back',
  'hip-flexors': 'hip-flexors',
  quads: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  adductors: 'adductors',
  abductors: 'glutes',
  calves: 'calves',
};

/**
 * Что считается нагрузкой для восстановления: растяжка и разминка — нет; упражнения на время
 * (планка, ходьба, скакалка, удержания) — тоже нет: это не силовая нагрузка на мышцу.
 */
export function countsForRecovery(ex: { category: string; metric: string } | undefined): boolean {
  return !!ex && ex.category !== 'mobility' && ex.metric !== 'time';
}

const loadGroups = (exerciseId: string): Muscle[] => {
  const ex = findExercise(exerciseId);
  return countsForRecovery(ex) ? ex!.primaryMuscles.map((m) => RECOVERY_GROUP[m]) : [];
};

/** Записи упражнения в истории с выполненными подходами, новые первыми */
export function performances(history: Session[], exerciseId: string, beforeIso?: string): SessionEntry[] {
  const out: SessionEntry[] = [];
  for (const s of history) {
    if (beforeIso && s.startedAt >= beforeIso) continue;
    const e = s.entries.find((x) => x.exerciseId === exerciseId);
    if (e && !e.skipped && e.sets.some((x) => x.done)) out.push(e);
  }
  return out;
}

const repsOf = (e: SessionEntry, time: boolean) =>
  e.sets.filter((x) => x.done).map((x) => (time ? x.seconds : x.reps) ?? 0);

/** Прогрессия: в прошлый раз во всех рабочих подходах — верх диапазона */
export function progression(item: PlanItem, history: Session[]): Advice | null {
  const ex = findExercise(item.exerciseId);
  if (!ex || ex.metric !== 'weight_reps') return null;
  const last = performances(history, item.exerciseId)[0];
  if (!last) return null;
  const reps = repsOf(last, false);
  if (reps.length < item.sets) return null;
  if (!reps.slice(0, item.sets).every((r) => r >= item.repsMax)) return null;
  return {
    id: `progression:${item.exerciseId}`,
    kind: 'progression',
    exerciseId: item.exerciseId,
    textKey: 'advice.progression',
  };
}

/**
 * Снижение нагрузки: DELOAD_SESSIONS тренировок подряд большинство подходов ниже нижней границы.
 * Только для упражнений с весом снаряда.
 */
export function deload(item: PlanItem, history: Session[]): Advice | null {
  const ex = findExercise(item.exerciseId);
  if (!ex || ex.metric !== 'weight_reps') return null;
  const recent = performances(history, item.exerciseId).slice(0, DELOAD_SESSIONS);
  if (recent.length < DELOAD_SESSIONS) return null;
  const below = (e: SessionEntry) => {
    const reps = repsOf(e, false);
    return reps.length > 0 && reps.filter((r) => r < item.repsMin).length * 2 > reps.length;
  };
  if (!recent.every(below)) return null;
  return {
    id: `deload:${item.exerciseId}`,
    kind: 'deload',
    exerciseId: item.exerciseId,
    textKey: 'advice.deload',
  };
}

/** Новичкам: «начни с лёгкого веса», если упражнение ещё ни разу не выполнялось */
export function lightStart(
  item: PlanItem,
  history: Session[],
  level: Level | null | undefined,
): Advice | null {
  if (!levelBehavior(level).lightStartTip) return null;
  const ex = findExercise(item.exerciseId);
  if (!ex || ex.metric !== 'weight_reps') return null;
  if (performances(history, item.exerciseId).length) return null;
  return {
    id: `light-start:${item.exerciseId}`,
    kind: 'light-start',
    exerciseId: item.exerciseId,
    textKey: 'advice.lightStart',
  };
}

/** Восстановление: основные мышцы дня нагружались меньше 48 часов назад */
export function recovery(dayId: string, items: PlanItem[], history: Session[], now: number): Advice | null {
  const today = new Set(items.flatMap((i) => loadGroups(i.exerciseId)));
  if (!today.size) return null;
  const hit = new Set<Muscle>();
  for (const s of history) {
    const end = ms(s.endedAt ?? s.startedAt);
    if (now - end >= RECOVERY_HOURS * 3_600_000) break; // история — новые первыми
    if (now < end) continue;
    for (const e of s.entries) {
      if (e.skipped || !e.sets.some((x) => x.done)) continue;
      for (const m of loadGroups(e.exerciseId)) if (today.has(m)) hit.add(m);
    }
  }
  if (!hit.size) return null;
  return { id: `recovery:${dayId}`, kind: 'recovery', textKey: 'advice.recovery', muscles: [...hit] };
}

export interface TipContext {
  dayId: string;
  items: PlanItem[];
  history: Session[];
  level: Level | null | undefined;
  now: number;
  tipState: Record<string, TipMark>;
  enabled: boolean;
  /** Учитывать восстановление (только при старте/во время тренировки) */
  withRecovery?: boolean;
}

/** Закрытый совет не повторяется TIP_SNOOZE_DAYS дней */
export const isSnoozed = (id: string, state: Record<string, TipMark>, now: number): boolean => {
  const at = ms(state[id]?.dismissedAt);
  return at > 0 && now - at < TIP_SNOOZE_DAYS * 86_400_000;
};

/** Советы на тренировку: все правила → без закрытых → по важности → не больше двух */
export function tipsFor(ctx: TipContext): Advice[] {
  if (!ctx.enabled) return [];
  const all: Advice[] = [];
  if (ctx.withRecovery) {
    const r = recovery(ctx.dayId, ctx.items, ctx.history, ctx.now);
    if (r) all.push(r);
  }
  for (const item of ctx.items) {
    const a =
      deload(item, ctx.history) ?? progression(item, ctx.history) ?? lightStart(item, ctx.history, ctx.level);
    if (a) all.push(a);
  }
  return all
    .filter((a) => !isSnoozed(a.id, ctx.tipState, ctx.now))
    .sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])
    .slice(0, MAX_TIPS_PER_SESSION);
}
