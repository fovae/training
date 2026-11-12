import { computed, signal } from '@preact/signals';
import * as store from '../db';
import { findExercise } from '../data/exercises';
import { DEFAULT_WEEKDAYS } from '../data/templates';
import type { Day, Plan, PlanItem, Weekday } from '../types';
import { compact, uid } from '../lib/format';

/** План пользователя. null — ещё не создан (онбординг). */
export const plan = signal<Plan | null>(null);

export const MAX_DAYS = 7;

export async function loadPlan(): Promise<void> {
  plan.value = await store.getPlan();
}

export async function setPlan(p: Plan): Promise<void> {
  plan.value = p;
  await store.savePlan(p);
}

function mutate(fn: (p: Plan) => void): void {
  const cur = plan.value;
  if (!cur) return;
  const next = structuredClone(cur);
  fn(next);
  plan.value = next;
  void store.savePlan(next).catch((e) => console.error('[plan] save failed', e));
}

/**
 * День недели дня — только в режиме «Дни недели». В цикле назначения хранятся,
 * но не показываются: при возврате в «Дни недели» вернутся прежние дни.
 */
export const shownWeekday = (d: Day): Weekday | undefined =>
  plan.value?.mode === 'weekdays' ? d.weekday : undefined;

export const findDay = (id: string): Day | undefined => plan.value?.days.find((d) => d.id === id);
export const dayIndex = (id: string): number => plan.value?.days.findIndex((d) => d.id === id) ?? -1;

/** Цвет дня: 4 цвета оригинала по кругу */
export const dayColor = (id: string): 'c1' | 'c2' | 'c3' | 'c4' => {
  const i = Math.max(0, dayIndex(id));
  return (['c1', 'c2', 'c3', 'c4'] as const)[i % 4]!;
};

// ---------- режим и дни ----------

export function setMode(mode: Plan['mode']): void {
  mutate((p) => {
    p.mode = mode;
    if (mode === 'weekdays') assignMissingWeekdays(p);
  });
}

function assignMissingWeekdays(p: Plan): void {
  const used = new Set<number>();
  const defaults = DEFAULT_WEEKDAYS[p.days.length] ?? [];
  for (const d of p.days) {
    if (d.weekday != null && !used.has(d.weekday)) used.add(d.weekday);
    else delete d.weekday;
  }
  p.days.forEach((d, i) => {
    if (d.weekday != null) return;
    const pref = defaults[i];
    const free =
      pref != null && !used.has(pref) ? pref : ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).find((w) => !used.has(w));
    if (free != null) {
      d.weekday = free;
      used.add(free);
    }
  });
}

export function setWeekday(dayId: string, w: Weekday): void {
  mutate((p) => {
    const day = p.days.find((d) => d.id === dayId);
    if (!day) return;
    const other = p.days.find((d) => d.id !== dayId && d.weekday === w);
    // Меняем местами, чтобы один день недели не достался двум тренировкам
    if (other) {
      if (day.weekday != null) other.weekday = day.weekday;
      else delete other.weekday;
    }
    day.weekday = w;
  });
}

/** Новые дни получают уникальный id, чтобы не подхватить историю удалённого дня */
const newDayId = (): string => `day-${uid().slice(0, 8)}`;

export function addDay(items: PlanItem[] = []): string | null {
  let id: string | null = null;
  mutate((p) => {
    if (p.days.length >= MAX_DAYS) return;
    id = newDayId();
    p.days.push({ id, items: structuredClone(items) });
    if (p.mode === 'weekdays') assignMissingWeekdays(p);
  });
  return id;
}

export function removeDay(dayId: string): void {
  mutate((p) => {
    if (p.days.length <= 1) return;
    p.days = p.days.filter((d) => d.id !== dayId);
  });
}

export function renameDay(dayId: string, label: string): void {
  mutate((p) => {
    const day = p.days.find((d) => d.id === dayId);
    if (!day) return;
    const v = label.trim().slice(0, 40);
    if (v) day.label = v;
    else delete day.label;
    // Своё название заменяет название из шаблона
    delete day.labelKey;
  });
}

export function clearDay(dayId: string): void {
  mutate((p) => {
    const day = p.days.find((d) => d.id === dayId);
    if (day) day.items = [];
  });
}

/** Копирует упражнения дня в другой день (заменяет) */
export function copyDayTo(fromId: string, toId: string): void {
  mutate((p) => {
    const from = p.days.find((d) => d.id === fromId);
    const to = p.days.find((d) => d.id === toId);
    if (from && to && from !== to) to.items = structuredClone(from.items);
  });
}

export function moveDay(dayId: string, dir: -1 | 1): void {
  mutate((p) => {
    const i = p.days.findIndex((d) => d.id === dayId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= p.days.length) return;
    [p.days[i], p.days[j]] = [p.days[j]!, p.days[i]!];
  });
}

// ---------- упражнения дня ----------

export function addItem(dayId: string, exerciseId: string): void {
  const ex = findExercise(exerciseId);
  if (!ex) return;
  mutate((p) => {
    const day = p.days.find((d) => d.id === dayId);
    if (!day) return;
    day.items.push({
      exerciseId,
      sets: ex.defaults.sets,
      repsMin: ex.defaults.repsMin,
      repsMax: ex.defaults.repsMax,
    });
  });
}

export function updateItem(dayId: string, idx: number, patch: Partial<PlanItem>): void {
  mutate((p) => {
    const item = p.days.find((d) => d.id === dayId)?.items[idx];
    if (!item) return;
    const items = p.days.find((d) => d.id === dayId)!.items;
    const next = compact({ ...item, ...patch });
    items[idx] = next;
    next.sets = clampInt(next.sets, 1, 10);
    next.repsMin = clampInt(next.repsMin, 1, 600);
    next.repsMax = clampInt(Math.max(next.repsMax, next.repsMin), 1, 600);
  });
}

export function moveItem(dayId: string, idx: number, dir: -1 | 1): void {
  mutate((p) => {
    const items = p.days.find((d) => d.id === dayId)?.items;
    const j = idx + dir;
    if (!items || j < 0 || j >= items.length) return;
    [items[idx], items[j]] = [items[j]!, items[idx]!];
  });
}

export function removeItem(dayId: string, idx: number): PlanItem | null {
  let removed: PlanItem | null = null;
  mutate((p) => {
    const items = p.days.find((d) => d.id === dayId)?.items;
    if (items) removed = items.splice(idx, 1)[0] ?? null;
  });
  return removed;
}

export function insertItem(dayId: string, idx: number, item: PlanItem): void {
  mutate((p) => {
    const items = p.days.find((d) => d.id === dayId)?.items;
    if (items) items.splice(Math.min(idx, items.length), 0, item);
  });
}

const clampInt = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(Number.isFinite(v) ? v : min)));

// ---------- производные ----------

export const daySetCount = (d: Day): number => d.items.reduce((a, i) => a + i.sets, 0);

/** Сегодняшний день недели 0 = пн … 6 = вс */
export const todayWeekday = (now = new Date()): Weekday => ((now.getDay() + 6) % 7) as Weekday;

export const planDays = computed(() => plan.value?.days ?? []);
