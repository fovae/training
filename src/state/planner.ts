import { signal } from '@preact/signals';
import { allExercises, findExercise } from '../data/exercises';
import { roleOf } from '../data/planner';
import {
  DEFAULT_ANSWERS,
  buildDraft,
  draftToDays,
  sanitizeAnswers,
  type Answers,
  type Draft,
  type DraftItem,
  type PlannerCtx,
} from '../lib/planner';
import { estimateItems } from '../lib/duration';
import { setsFor } from '../data/templates';
import type { Plan } from '../types';
import { calibration } from './estimate';
import { MAX_DAYS, plan, setPlan } from './plan';
import { restFor } from './session';
import { profile, settings, updateSettings } from './settings';

/**
 * Состояние помощника «Собрать за меня» (алгоритм — src/lib/planner, экран — ui/components/Planner.tsx).
 * Последние ответы сохраняются в настройках (Settings.planner): «повторить с теми же ответами».
 */
export const plannerOpen = signal(false);
export const answers = signal<Answers>(DEFAULT_ANSWERS);
export const draft = signal<Draft | null>(null);

export function plannerCtx(): PlannerCtx {
  return {
    exercises: allExercises(),
    restFor: (e) => restFor(e),
    estimate: {
      level: answers.value.level,
      pace: settings.value.pace ?? 'normal',
      calibration: calibration.value.factor,
    },
  };
}

/** Открыть мастер: прошлые ответы, уровень из профиля, число дней и режим — из плана (или seed) */
export function openPlanner(seed: Partial<Answers> = {}): void {
  const saved = settings.value.planner;
  const base = sanitizeAnswers(saved ?? null);
  const p = plan.value;
  answers.value = {
    ...base,
    ...(saved ? {} : { level: profile.value?.level ?? base.level }),
    ...(!saved && p?.days.length ? { days: p.days.length, mode: p.mode } : {}),
    ...seed,
  };
  draft.value = null;
  plannerOpen.value = true;
}

export const closePlanner = () => {
  plannerOpen.value = false;
};

/** Собрать черновик (seed — номер попытки; закреплённые упражнения остаются в своих днях) */
export function buildPlanDraft(seed = 0): void {
  const pins = draft.value?.days.map((d) => d.items.filter((x) => x.pinned)) ?? [];
  // закрепления действуют, пока ответы не изменились (тот же сплит и число дней)
  draft.value = buildDraft(answers.value, plannerCtx(), seed, seed ? pins : []);
  updateSettings({ planner: { ...answers.value } });
}

export const rebuildDraft = () => buildPlanDraft((draft.value?.seed ?? 0) + 1);

function editDay(di: number, fn: (items: DraftItem[]) => DraftItem[]): void {
  const d = draft.value;
  if (!d?.days[di]) return;
  const days = d.days.map((day, i) => {
    if (i !== di) return day;
    const items = fn(day.items);
    const ctx = plannerCtx();
    const est = estimateItems(
      items.map((it) => {
        const ex = findExercise(it.exerciseId);
        return {
          ex,
          sets: it.sets,
          repsMin: it.repsMin,
          repsMax: it.repsMax,
          restSec: ex ? ctx.restFor(ex) : 90,
          optional: it.optional,
        };
      }),
      ctx.estimate,
    );
    return { ...day, items, estimate: est };
  });
  draft.value = { ...d, days };
}

export const togglePin = (di: number, ii: number) =>
  editDay(di, (items) => items.map((x, i) => (i === ii ? { ...x, pinned: !x.pinned } : x)));

/** Заменить упражнение черновика: схема — по новому упражнению и уровню; закрепление сохраняется */
export function replaceDraftItem(di: number, ii: number, exerciseId: string): void {
  const e = findExercise(exerciseId);
  if (!e) return;
  editDay(di, (items) =>
    items.map((x, i) => {
      if (i !== ii) return x;
      const iso = roleOf(e) === 'isolation';
      const sets0 = iso ? Math.min(e.defaults.sets, 3) : Math.max(2, e.defaults.sets);
      return {
        ...x,
        exerciseId,
        sets: x.optional
          ? Math.min(2, setsFor(sets0, answers.value.level))
          : setsFor(sets0, answers.value.level),
        repsMin: e.defaults.repsMin,
        repsMax: e.defaults.repsMax,
      };
    }),
  );
}

/** В плане уже есть упражнения — нужно спросить «заменить / добавить дни» */
export const planHasItems = () => !!plan.value?.days.some((d) => d.items.length);

/**
 * Применить черновик. replace — новый план целиком; add — дни добавляются к плану (до 7).
 * Возвращает прежний план для «Отменить» и сколько дней не поместилось.
 */
export async function applyDraft(how: 'replace' | 'add'): Promise<{ prev: Plan | null; dropped: number }> {
  const d = draft.value;
  const prev = plan.value ? structuredClone(plan.value) : null;
  if (!d) return { prev, dropped: 0 };
  const mode = how === 'add' && prev ? prev.mode : answers.value.mode;
  let next: Plan;
  let dropped = 0;
  if (how === 'add' && prev) {
    const room = Math.max(0, MAX_DAYS - prev.days.length);
    dropped = Math.max(0, d.days.length - room);
    const used = new Set(prev.days.map((x) => x.id));
    const ids: string[] = [];
    for (let i = 1; ids.length < room && i <= 99; i++) if (!used.has(`day-${i}`)) ids.push(`day-${i}`);
    const add = draftToDays({ ...d, days: d.days.slice(0, room) }, mode, 0, ids);
    next = { ...prev, days: [...prev.days, ...add] };
  } else next = { mode, days: draftToDays(d, mode) };
  await setPlan(next);
  updateSettings({ planner: { ...answers.value } });
  plannerOpen.value = false;
  return { prev, dropped };
}

export async function undoApply(prev: Plan | null): Promise<void> {
  if (prev) await setPlan(prev);
}
