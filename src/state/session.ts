import { computed, signal } from '@preact/signals';
import * as store from '../db';
import { findExercise } from '../data/exercises';
import type { Exercise, PlanItem, Session, SessionEntry, SessionSet } from '../types';
import { compact, ms, uid, weekStart } from '../lib/format';
import { findDay, plan, todayWeekday } from './plan';
import { settings } from './settings';

/** Текущая (незавершённая) тренировка */
export const active = signal<Session | null>(null);
/** Завершённые тренировки, новые первыми */
export const history = signal<Session[]>([]);
export const loadError = signal(false);

export async function loadSessions(): Promise<void> {
  const [a, h] = await Promise.all([store.getActive(), store.listSessions()]);
  active.value = a;
  history.value = h;
}

// ---------- какой день сегодня ----------

/**
 * Предложение на сегодня.
 * Цикл: следующий день после последней завершённой тренировки.
 * Дни недели: день, назначенный на сегодня; если такого нет — null (день отдыха).
 */
export const suggestedDayId = computed<string | null>(() => {
  const p = plan.value;
  if (!p?.days.length) return null;
  if (p.mode === 'weekdays') {
    const w = todayWeekday();
    return p.days.find((d) => d.weekday === w)?.id ?? null;
  }
  const last = history.value[0]?.dayId;
  const i = last ? p.days.findIndex((d) => d.id === last) : -1;
  return p.days[(i + 1) % p.days.length]!.id;
});

/** Ближайший тренировочный день по дням недели (для экрана «день отдыха») */
export const nextWeekdayDayId = computed<string | null>(() => {
  const p = plan.value;
  if (!p || p.mode !== 'weekdays') return null;
  const today = todayWeekday();
  for (let k = 1; k <= 7; k++) {
    const w = (today + k) % 7;
    const d = p.days.find((x) => x.weekday === w);
    if (d) return d.id;
  }
  return null;
});

export const weekCount = computed(() => {
  const from = weekStart();
  return history.value.filter((s) => ms(s.endedAt) >= from).length;
});

// ---------- прошлые результаты ----------

export function lastPerformance(exId: string, beforeIso?: string): SessionEntry | null {
  for (const s of history.value) {
    if (beforeIso && s.startedAt >= beforeIso) continue;
    const e = s.entries.find((x) => x.exerciseId === exId);
    if (e && !e.skipped && e.sets.some((x) => x.done)) return e;
  }
  return null;
}

/** Цель упражнения в дне: из плана, иначе — по умолчанию из библиотеки */
export function targetFor(dayId: string, exId: string): PlanItem {
  const item = findDay(dayId)?.items.find((i) => i.exerciseId === exId);
  if (item) return item;
  const ex = findExercise(exId);
  return { exerciseId: exId, ...(ex?.defaults ?? { sets: 3, repsMin: 8, repsMax: 12 }) };
}

export function restFor(ex: Exercise | undefined, item?: PlanItem): number {
  if (item?.restSec) return item.restSec;
  const s = settings.value;
  return ex?.type === 'compound' ? s.restBaseSec : s.restIsoSec;
}

function prefillSets(item: PlanItem): SessionSet[] {
  const ex = findExercise(item.exerciseId);
  const done = lastPerformance(item.exerciseId)?.sets.filter((s) => s.done) ?? [];
  return Array.from({ length: item.sets }, (_, i) => {
    const src = done[i] ?? done[done.length - 1];
    const s: SessionSet = { done: false };
    const w = src?.weightKg ?? item.targetWeightKg;
    if (w != null && ex?.metric !== 'time') s.weightKg = w;
    if (ex?.metric === 'time') {
      if (src?.seconds != null) s.seconds = src.seconds;
    } else if (src?.reps != null) s.reps = src.reps;
    return s;
  });
}

// ---------- статистика ----------

export function sessionVolume(s: Session): number {
  let v = 0;
  for (const e of s.entries) {
    if (e.skipped || findExercise(e.exerciseId)?.metric === 'time') continue;
    for (const x of e.sets) if (x.done && x.weightKg && x.reps) v += x.weightKg * x.reps;
  }
  return Math.round(v);
}

export function entryState(e: SessionEntry): 'done' | 'skipped' | 'progress' | 'todo' {
  if (e.skipped) return 'skipped';
  const n = e.sets.filter((s) => s.done).length;
  if (n === 0) return 'todo';
  return n >= e.sets.length ? 'done' : 'progress';
}

export const activeProgress = computed(() => {
  const s = active.value;
  if (!s) return { done: 0, total: 0 };
  return {
    done: s.entries.filter((e) => entryState(e) === 'done' || e.skipped).length,
    total: s.entries.length,
  };
});

/** Расчётный 1ПМ (Эпли) — для графика «лучший подход» */
export const e1rm = (weight: number, reps: number): number => (reps <= 1 ? weight : weight * (1 + reps / 30));

export interface ExercisePoint {
  t: number;
  top: number;
  best: number;
  bestSet: { weight: number; reps: number };
}

export function exerciseSeries(exId: string): ExercisePoint[] {
  const pts: ExercisePoint[] = [];
  for (const s of history.value) {
    const e = s.entries.find((x) => x.exerciseId === exId);
    if (!e || e.skipped) continue;
    const sets = e.sets.filter((x) => x.done && (x.reps || x.seconds));
    if (!sets.length) continue;
    let top = 0;
    let best = 0;
    let bestSet = { weight: 0, reps: 0 };
    for (const x of sets) {
      const wt = x.weightKg ?? 0;
      const r = x.reps ?? x.seconds ?? 0;
      top = Math.max(top, wt);
      const est = e1rm(wt, r);
      if (est > best || !bestSet.reps) {
        best = est;
        bestSet = { weight: wt, reps: r };
      }
    }
    pts.push({ t: ms(s.startedAt), top, best, bestSet });
  }
  return pts.reverse();
}

// ---------- действия с активной тренировкой ----------

async function persist(s: Session | null): Promise<void> {
  try {
    await store.saveActive(s);
  } catch (e) {
    console.error('[session] save failed', e);
  }
}

function mutate(fn: (s: Session) => void): void {
  const cur = active.value;
  if (!cur) return;
  const next = structuredClone(cur);
  fn(next);
  active.value = next;
  void persist(next);
}

export function startSession(dayId: string): void {
  // Двойное быстрое нажатие «Начать»: второй вызов приходит до перерисовки — не создаём вторую сессию
  if (active.value) return;
  const day = findDay(dayId);
  if (!day) return;
  const s: Session = {
    id: uid(),
    dayId: day.id,
    startedAt: new Date().toISOString(),
    entries: day.items.map((item) => ({ exerciseId: item.exerciseId, sets: prefillSets(item) })),
  };
  active.value = s;
  void persist(s);
}

export function updateSet(entryIdx: number, setIdx: number, patch: Partial<SessionSet>): void {
  mutate((s) => {
    const e = s.entries[entryIdx];
    const x = e?.sets[setIdx];
    if (!e || !x) return;
    e.sets[setIdx] = compact({ ...x, ...patch });
  });
}

/** true — подход только что отмечен выполненным */
export function toggleSetDone(entryIdx: number, setIdx: number): boolean {
  let nowDone = false;
  mutate((s) => {
    const e = s.entries[entryIdx];
    const x = e?.sets[setIdx];
    if (!e || !x) return;
    x.done = !x.done;
    nowDone = x.done;
    if (x.done) {
      x.doneAt = new Date().toISOString();
      delete e.skipped;
      // Пустые поля следующего подхода подхватывают только что введённые значения
      const nx = e.sets[setIdx + 1];
      if (nx && !nx.done) {
        if (nx.weightKg == null && x.weightKg != null) nx.weightKg = x.weightKg;
        if (nx.reps == null && x.reps != null) nx.reps = x.reps;
        if (nx.seconds == null && x.seconds != null) nx.seconds = x.seconds;
      }
    } else delete x.doneAt;
  });
  return nowDone;
}

export function toggleSkip(entryIdx: number): void {
  mutate((s) => {
    const e = s.entries[entryIdx];
    if (!e) return;
    if (e.skipped) delete e.skipped;
    else e.skipped = true;
  });
}

/** Порядок упражнений в идущей тренировке */
export function moveEntry(entryIdx: number, dir: -1 | 1): void {
  mutate((s) => {
    const j = entryIdx + dir;
    if (j < 0 || j >= s.entries.length) return;
    [s.entries[entryIdx], s.entries[j]] = [s.entries[j]!, s.entries[entryIdx]!];
  });
}

/** Убрать упражнение из идущей тренировки (при удалении из плана) */
export function removeEntry(entryIdx: number): void {
  mutate((s) => {
    s.entries.splice(entryIdx, 1);
  });
}

export function addSet(entryIdx: number): void {
  mutate((s) => {
    const e = s.entries[entryIdx];
    if (!e) return;
    const last = e.sets[e.sets.length - 1];
    const next: SessionSet = { done: false };
    if (last?.weightKg != null) next.weightKg = last.weightKg;
    if (last?.reps != null) next.reps = last.reps;
    if (last?.seconds != null) next.seconds = last.seconds;
    e.sets.push(next);
  });
}

export function removeSet(entryIdx: number): void {
  mutate((s) => {
    const e = s.entries[entryIdx];
    if (e && e.sets.length > 1) e.sets.pop();
  });
}

const cleanNote = (v: string): string | undefined => v.trim().slice(0, 1000) || undefined;

export function setEntryNote(entryIdx: number, note: string): void {
  mutate((s) => {
    const e = s.entries[entryIdx];
    if (!e) return;
    const v = cleanNote(note);
    if (v) e.note = v;
    else delete e.note;
  });
}

export function setSessionNote(note: string): void {
  mutate((s) => {
    const v = cleanNote(note);
    if (v) s.note = v;
    else delete s.note;
  });
}

export async function finishSession(): Promise<Session | null> {
  const cur = active.value;
  if (!cur) return null;
  const done: Session = { ...structuredClone(cur), endedAt: new Date().toISOString() };
  await store.commitActive(done);
  active.value = null;
  history.value = [done, ...history.value];
  return done;
}

export async function cancelSession(): Promise<void> {
  active.value = null;
  await persist(null);
}

export async function removeSession(id: string): Promise<void> {
  await store.deleteSession(id);
  history.value = history.value.filter((s) => s.id !== id);
}
