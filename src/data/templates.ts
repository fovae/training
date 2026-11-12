import type { Day, Level, Plan, PlanItem, Weekday } from '../types';
import { findExercise } from './exercises';

/**
 * Стартовые шаблоны плана (этап 3А). Без «целей» (похудение, масса) и обещаний результата:
 * только структура недели. Подставляются упражнения из базы, подходы и повторы — по уровню,
 * вес не подставляется никогда.
 * «Сплит 3+1» — программа владельца из первой версии приложения, всегда 4 дня.
 * Шаблоны этапа 1 («Всё тело», «Поддержание формы», «Рост силы») заменены новыми; уже собранные
 * из них планы не меняются (шаблон нужен только в момент сборки плана).
 */

export type TemplateId = 'full-body-3' | 'upper-lower-4' | 'ppl-3' | 'light-2' | 'split31';

type Row = [exerciseId: string, sets: number, repsMin: number, repsMax: number, extra?: Partial<PlanItem>];

interface TemplateDay {
  labelKey: string;
  rows: Row[];
}

export interface Template {
  id: TemplateId;
  nameKey: string;
  descKey: string;
  /** Фиксированное число дней; иначе чередование pattern под выбранное число */
  fixedDays?: number;
  /** Подстраивать под уровень (у «Сплит 3+1» — нет: это личная программа владельца) */
  byLevel?: boolean;
  pattern: TemplateDay[];
}

const opt = { optional: true };

export const TEMPLATES: Template[] = [
  {
    id: 'full-body-3',
    nameKey: 'tpl.full-body-3.name',
    descKey: 'tpl.full-body-3.desc',
    fixedDays: 3,
    byLevel: true,
    pattern: [
      {
        labelKey: 'tpl.full-body-3.d1',
        rows: [
          ['goblet-squat', 3, 8, 12],
          ['flat-press', 3, 8, 12],
          ['lat-pulldown', 3, 8, 12],
          ['glute-bridge', 2, 12, 15],
          ['plank', 2, 20, 40],
        ],
      },
      {
        labelKey: 'tpl.full-body-3.d2',
        rows: [
          ['leg-press', 3, 10, 12],
          ['seated-shoulder-press', 2, 8, 12],
          ['seated-cable-row', 3, 8, 12],
          ['leg-curl', 2, 10, 15],
          ['dead-bug', 2, 8, 12],
        ],
      },
      {
        labelKey: 'tpl.full-body-3.d3',
        rows: [
          ['db-romanian-deadlift', 3, 8, 12],
          ['incline-db-press', 3, 8, 12],
          ['one-arm-db-row', 3, 8, 12],
          ['lateral-raise', 2, 10, 15],
          ['bird-dog', 2, 8, 12],
        ],
      },
    ],
  },
  {
    id: 'upper-lower-4',
    nameKey: 'tpl.upper-lower-4.name',
    descKey: 'tpl.upper-lower-4.desc',
    fixedDays: 4,
    byLevel: true,
    pattern: [
      {
        labelKey: 'tpl.upper-lower-4.d1',
        rows: [
          ['barbell-bench-press', 3, 6, 10],
          ['barbell-row', 3, 6, 10],
          ['seated-shoulder-press', 3, 8, 12],
          ['lat-pulldown', 3, 8, 12],
          ['db-curl', 2, 10, 12],
          ['rope-pushdown', 2, 10, 12],
        ],
      },
      {
        labelKey: 'tpl.upper-lower-4.d2',
        rows: [
          ['back-squat', 3, 5, 8],
          ['romanian-deadlift', 3, 6, 10],
          ['leg-curl', 3, 10, 15],
          ['calf-raise', 3, 12, 15],
          ['plank', 2, 20, 45],
        ],
      },
      {
        labelKey: 'tpl.upper-lower-4.d3',
        rows: [
          ['incline-db-press', 3, 8, 12],
          ['seated-cable-row', 3, 8, 12],
          ['lateral-raise', 3, 10, 15],
          ['face-pull', 3, 12, 15],
          ['hammer-curl', 2, 10, 12],
          ['overhead-db-extension', 2, 10, 12],
        ],
      },
      {
        labelKey: 'tpl.upper-lower-4.d4',
        rows: [
          ['leg-press', 3, 10, 12],
          ['bulgarian-split-squat', 3, 8, 12],
          ['barbell-hip-thrust', 3, 8, 12],
          ['seated-leg-curl', 3, 10, 15],
          ['seated-calf-raise', 3, 12, 15],
          ['hanging-knee-raise', 2, 10, 15],
        ],
      },
    ],
  },
  {
    id: 'ppl-3',
    nameKey: 'tpl.ppl-3.name',
    descKey: 'tpl.ppl-3.desc',
    fixedDays: 3,
    byLevel: true,
    pattern: [
      {
        labelKey: 'tpl.ppl-3.d1',
        rows: [
          ['barbell-bench-press', 3, 6, 10],
          ['seated-shoulder-press', 3, 8, 12],
          ['incline-db-press', 3, 8, 12],
          ['lateral-raise', 3, 10, 15],
          ['rope-pushdown', 3, 10, 12],
        ],
      },
      {
        labelKey: 'tpl.ppl-3.d2',
        rows: [
          ['lat-pulldown', 3, 8, 12],
          ['barbell-row', 3, 6, 10],
          ['face-pull', 3, 12, 15],
          ['barbell-curl', 3, 8, 12],
          ['hammer-curl', 2, 10, 12],
        ],
      },
      {
        labelKey: 'tpl.ppl-3.d3',
        rows: [
          ['back-squat', 3, 5, 8],
          ['romanian-deadlift', 3, 6, 10],
          ['leg-press', 3, 10, 12],
          ['leg-curl', 3, 10, 15],
          ['calf-raise', 3, 12, 15],
        ],
      },
    ],
  },
  {
    id: 'light-2',
    nameKey: 'tpl.light-2.name',
    descKey: 'tpl.light-2.desc',
    fixedDays: 2,
    byLevel: true,
    pattern: [
      {
        labelKey: 'tpl.light-2.d1',
        rows: [
          ['goblet-squat', 2, 10, 12],
          ['incline-push-up', 2, 8, 15],
          ['seated-cable-row', 2, 10, 12],
          ['glute-bridge', 2, 12, 15],
          ['plank', 2, 20, 40],
        ],
      },
      {
        labelKey: 'tpl.light-2.d2',
        rows: [
          ['leg-press', 2, 10, 12],
          ['seated-shoulder-press', 2, 10, 12],
          ['lat-pulldown', 2, 10, 12],
          ['bird-dog', 2, 8, 12],
          ['cat-cow', 1, 30, 60],
        ],
      },
    ],
  },
  {
    id: 'split31',
    nameKey: 'tpl.split31.name',
    descKey: 'tpl.split31.desc',
    fixedDays: 4,
    pattern: [
      {
        labelKey: 'tpl.split31.d1',
        rows: [
          ['incline-db-press', 3, 8, 12],
          ['flat-press', 3, 8, 12],
          ['high-to-low-cable-fly', 3, 10, 15],
          ['rope-pushdown', 3, 10, 12],
          ['overhead-cable-extension', 3, 10, 12],
          ['single-arm-pushdown', 2, 10, 12, opt],
        ],
      },
      {
        labelKey: 'tpl.split31.d2',
        rows: [
          ['lat-pulldown', 3, 8, 12],
          ['seated-cable-row', 3, 8, 12],
          ['chest-supported-db-row', 3, 8, 12],
          ['incline-db-curl', 3, 8, 12],
          ['preacher-curl', 3, 8, 12],
          ['hammer-curl', 2, 10, 12],
          ['wrist-curl', 2, 12, 15],
          ['reverse-wrist-curl', 2, 12, 15],
        ],
      },
      {
        labelKey: 'tpl.split31.d3',
        rows: [
          ['seated-shoulder-press', 3, 8, 12],
          ['lateral-raise', 3, 10, 15],
          ['reverse-pec-deck', 3, 10, 15],
          ['db-shrug', 3, 10, 12],
          ['incline-y-raise', 2, 12, 15],
        ],
      },
      {
        labelKey: 'tpl.split31.d4',
        rows: [
          ['cable-crunch', 3, 12, 15],
          ['hanging-knee-raise', 3, 10, 15],
          ['side-plank', 2, 20, 40],
          ['pallof-press', 2, 10, 12],
          ['dead-bug', 2, 8, 12],
          ['leg-press', 2, 10, 12, opt],
          ['leg-curl', 2, 10, 15, opt],
          ['calf-raise', 2, 12, 15, opt],
        ],
      },
    ],
  },
];

export const findTemplate = (id: string): Template | undefined => TEMPLATES.find((t) => t.id === id);

/** Дни недели по умолчанию для N тренировок: равномерно, с отдыхом между ними */
export const DEFAULT_WEEKDAYS: Record<number, Weekday[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export const dayId = (i: number): string => `day-${i + 1}`;

/**
 * Для новичков («первый раз», «несколько раз») тяжёлые упражнения со штангой и сложные
 * упражнения с собственным весом заменяются более простыми вариантами из базы.
 */
export const EASIER: Record<string, string> = {
  'back-squat': 'goblet-squat',
  'barbell-bench-press': 'flat-press',
  'barbell-row': 'chest-supported-db-row',
  'romanian-deadlift': 'db-romanian-deadlift',
  'barbell-hip-thrust': 'glute-bridge',
  'bulgarian-split-squat': 'db-lunge',
  'barbell-curl': 'db-curl',
  'hanging-knee-raise': 'dead-bug',
  'pull-up': 'lat-pulldown',
};

/** Подходы по уровню: «первый раз» — на один меньше (не меньше 2), «несколько раз» — до 3 */
export function setsFor(sets: number, level: Level | null | undefined): number {
  if (level === 'first') return Math.max(Math.min(sets, 2), sets - 1);
  if (level === 'few') return Math.min(sets, 3);
  return sets;
}

function itemsOf(rows: Row[], level: Level | null | undefined, byLevel: boolean): PlanItem[] {
  const beginner = byLevel && (level === 'first' || level === 'few');
  const seen = new Set<string>();
  return rows
    .map(([id, sets, repsMin, repsMax, extra]): Row => [
      beginner ? (EASIER[id] ?? id) : id,
      sets,
      repsMin,
      repsMax,
      extra,
    ])
    .filter(([id]) => findExercise(id) && !seen.has(id) && !!seen.add(id))
    .map(([exerciseId, sets, repsMin, repsMax, extra]) => ({
      exerciseId,
      sets: byLevel ? setsFor(sets, level) : sets,
      repsMin,
      repsMax,
      ...extra,
    }));
}

/**
 * Собирает план. ids дней — day-1…day-N: в «Сплит 3+1» они совпадают с id дней
 * первой версии приложения, поэтому старая история остаётся привязана к своим дням.
 */
export function buildPlan(opts: {
  templateId?: string | null;
  days: number;
  mode: Plan['mode'];
  level?: Level | null;
}): Plan {
  const tpl = opts.templateId ? findTemplate(opts.templateId) : undefined;
  const n = Math.min(7, Math.max(1, tpl?.fixedDays ?? Math.round(opts.days)));
  const weekdays = DEFAULT_WEEKDAYS[n]!;
  const days: Day[] = Array.from({ length: n }, (_, i) => {
    const td = tpl?.pattern[i % tpl.pattern.length];
    const day: Day = { id: dayId(i), items: td ? itemsOf(td.rows, opts.level, !!tpl?.byLevel) : [] };
    if (td) day.labelKey = td.labelKey;
    if (opts.mode === 'weekdays') day.weekday = weekdays[i]!;
    return day;
  });
  const plan: Plan = { mode: opts.mode, days };
  if (tpl) plan.templateId = tpl.id;
  return plan;
}
