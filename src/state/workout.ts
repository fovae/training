import { computed, signal } from '@preact/signals';
import * as store from '../db';
import type { SetEntry, Workout, WorkoutExercise } from '../db/types';
import { PROGRAM, dayExercises, findDay, findExercise, nextDayId } from '../data/program';
import type { Exercise } from '../data/types';
import { uid, weekStart } from '../lib/format';

/** Текущая (незавершённая) тренировка */
export const active = signal<Workout | null>(null);
/** Завершённые тренировки, новые первыми */
export const history = signal<Workout[]>([]);
export const loaded = signal(false);
export const loadError = signal<string | null>(null);

export async function initWorkouts(): Promise<void> {
  try {
    const [a, h] = await Promise.all([store.getActive(), store.listWorkouts()]);
    active.value = a;
    history.value = h;
  } catch (e) {
    console.error(e);
    loadError.value =
      'Не удалось открыть хранилище. Возможно, включён приватный режим — журнал не будет сохраняться.';
  } finally {
    loaded.value = true;
  }
}

/** Следующая тренировка по циклу — после последней завершённой */
export const suggestedDayId = computed(() => nextDayId(history.value[0]?.dayId));

export const weekCount = computed(() => {
  const from = weekStart();
  return history.value.filter((w) => (w.finishedAt ?? 0) >= from).length;
});

// ---------- анализ прошлых результатов ----------

export function lastPerformance(exId: string, before?: number): WorkoutExercise | null {
  for (const w of history.value) {
    if (before && w.startedAt >= before) continue;
    const e = w.exercises.find((x) => x.exId === exId);
    if (e && !e.skipped && e.sets.some((s) => s.done)) return e;
  }
  return null;
}

/**
 * Правило прогрессии из программы: «Сделал верх диапазона во всех подходах чисто —
 * добавь немного веса». Проверяем все рабочие подходы прошлой тренировки.
 */
export function progressionReady(ex: Exercise): boolean {
  const last = lastPerformance(ex.id);
  if (!last) return false;
  const done = last.sets.filter((s) => s.done);
  if (done.length < ex.sets) return false;
  return done.slice(0, ex.sets).every((s) => (s.reps ?? 0) >= ex.reps[1]);
}

function prefillSets(ex: Exercise): SetEntry[] {
  const last = lastPerformance(ex.id);
  const done = last?.sets.filter((s) => s.done) ?? [];
  return Array.from({ length: ex.sets }, (_, i) => {
    const src = done[i] ?? done[done.length - 1];
    return { weight: src?.weight ?? null, reps: src?.reps ?? null, done: false };
  });
}

// ---------- статистика ----------

export function workoutVolume(w: Workout): number {
  let v = 0;
  for (const e of w.exercises) {
    if (e.skipped) continue;
    if (findExercise(e.exId)?.ex.unit === 'sec') continue;
    for (const s of e.sets) if (s.done && s.weight && s.reps) v += s.weight * s.reps;
  }
  return Math.round(v);
}

export function exerciseState(e: WorkoutExercise): 'done' | 'skipped' | 'progress' | 'todo' {
  if (e.skipped) return 'skipped';
  const n = e.sets.filter((s) => s.done).length;
  if (n === 0) return 'todo';
  return n >= e.sets.length ? 'done' : 'progress';
}

export const activeProgress = computed(() => {
  const w = active.value;
  if (!w) return { done: 0, total: 0 };
  return {
    done: w.exercises.filter((e) => exerciseState(e) === 'done' || e.skipped).length,
    total: w.exercises.length,
  };
});

/** Расчётный 1ПМ (Эпли) — для графика «лучший подход» */
export const e1rm = (weight: number, reps: number): number => (reps <= 1 ? weight : weight * (1 + reps / 30));

export interface ExercisePoint {
  t: number;
  top: number; // рабочий (максимальный) вес, кг
  best: number; // лучший подход, расч. 1ПМ, кг
  bestSet: { weight: number; reps: number };
}

export function exerciseSeries(exId: string): ExercisePoint[] {
  const pts: ExercisePoint[] = [];
  for (const w of history.value) {
    const e = w.exercises.find((x) => x.exId === exId);
    if (!e || e.skipped) continue;
    const sets = e.sets.filter((s) => s.done && s.reps);
    if (!sets.length) continue;
    let top = 0;
    let best = 0;
    let bestSet = { weight: 0, reps: 0 };
    for (const s of sets) {
      const wt = s.weight ?? 0;
      const r = s.reps ?? 0;
      top = Math.max(top, wt);
      const est = e1rm(wt, r);
      if (est > best) {
        best = est;
        bestSet = { weight: wt, reps: r };
      }
    }
    pts.push({ t: w.startedAt, top, best, bestSet });
  }
  return pts.reverse();
}

// ---------- действия с активной тренировкой ----------

async function persist(w: Workout | null): Promise<void> {
  try {
    await store.saveActive(w);
  } catch (e) {
    console.error('[workout] save failed', e);
  }
}

function mutate(fn: (w: Workout) => void): Workout | null {
  const cur = active.value;
  if (!cur) return null;
  const next: Workout = structuredClone(cur);
  fn(next);
  active.value = next;
  void persist(next);
  return next;
}

export function startWorkout(dayId: string): void {
  const day = findDay(dayId) ?? PROGRAM[0]!;
  const w: Workout = {
    id: uid(),
    dayId: day.id,
    startedAt: Date.now(),
    finishedAt: null,
    exercises: dayExercises(day).map((ex) => ({ exId: ex.id, skipped: false, sets: prefillSets(ex) })),
  };
  active.value = w;
  void persist(w);
}

export function updateSet(exIdx: number, setIdx: number, patch: Partial<SetEntry>): void {
  mutate((w) => {
    const s = w.exercises[exIdx]?.sets[setIdx];
    if (s) Object.assign(s, patch);
  });
}

/** Возвращает true, если подход только что отмечен выполненным */
export function toggleSetDone(exIdx: number, setIdx: number): boolean {
  let nowDone = false;
  mutate((w) => {
    const e = w.exercises[exIdx];
    const s = e?.sets[setIdx];
    if (!e || !s) return;
    s.done = !s.done;
    nowDone = s.done;
    if (s.done) {
      s.doneAt = Date.now();
      e.skipped = false;
      // Пустые поля следующего подхода подхватывают только что введённые значения
      const nx = e.sets[setIdx + 1];
      if (nx && !nx.done) {
        nx.weight ??= s.weight;
        nx.reps ??= s.reps;
      }
    } else delete s.doneAt;
  });
  return nowDone;
}

export function toggleSkip(exIdx: number): void {
  mutate((w) => {
    const e = w.exercises[exIdx];
    if (e) e.skipped = !e.skipped;
  });
}

export function addSet(exIdx: number): void {
  mutate((w) => {
    const e = w.exercises[exIdx];
    if (!e) return;
    const last = e.sets[e.sets.length - 1];
    e.sets.push({ weight: last?.weight ?? null, reps: last?.reps ?? null, done: false });
  });
}

export function removeSet(exIdx: number): void {
  mutate((w) => {
    const e = w.exercises[exIdx];
    if (e && e.sets.length > 1) e.sets.pop();
  });
}

export async function finishWorkout(): Promise<Workout | null> {
  const cur = active.value;
  if (!cur) return null;
  const done: Workout = { ...structuredClone(cur), finishedAt: Date.now() };
  await store.commitActive(done);
  active.value = null;
  history.value = [done, ...history.value];
  return done;
}

export async function cancelWorkout(): Promise<void> {
  active.value = null;
  await persist(null);
}

export async function removeWorkout(id: string): Promise<void> {
  await store.deleteWorkout(id);
  history.value = history.value.filter((w) => w.id !== id);
}

export async function reloadAll(): Promise<void> {
  const [a, h] = await Promise.all([store.getActive(), store.listWorkouts()]);
  active.value = a;
  history.value = h;
}
