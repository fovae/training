import type { Day, Plan, PlanItem, Weekday } from '../types';
import { findExercise } from './exercises';

/**
 * Стартовые шаблоны плана. Без «целей» (похудение, масса): только структура недели.
 * Простые шаблоны чередуют дни A/B под любое число дней 1–7.
 * «Сплит 3+1» — программа владельца из первой версии приложения, всегда 4 дня.
 */

export type TemplateId = 'full-body' | 'maintenance' | 'strength' | 'split31';

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
  pattern: TemplateDay[];
}

const opt = { optional: true };

export const TEMPLATES: Template[] = [
  {
    id: 'full-body',
    nameKey: 'tpl.full-body.name',
    descKey: 'tpl.full-body.desc',
    pattern: [
      {
        labelKey: 'tpl.day.a',
        rows: [
          ['leg-press', 3, 8, 12],
          ['flat-press', 3, 8, 12],
          ['lat-pulldown', 3, 8, 12],
          ['seated-shoulder-press', 2, 8, 12],
          ['cable-crunch', 2, 12, 15],
        ],
      },
      {
        labelKey: 'tpl.day.b',
        rows: [
          ['leg-curl', 3, 10, 15],
          ['incline-db-press', 3, 8, 12],
          ['seated-cable-row', 3, 8, 12],
          ['lateral-raise', 2, 10, 15],
          ['dead-bug', 2, 8, 12],
        ],
      },
    ],
  },
  {
    id: 'maintenance',
    nameKey: 'tpl.maintenance.name',
    descKey: 'tpl.maintenance.desc',
    pattern: [
      {
        labelKey: 'tpl.day.a',
        rows: [
          ['leg-press', 2, 10, 12],
          ['flat-press', 2, 10, 12],
          ['lat-pulldown', 2, 10, 12],
          ['side-plank', 2, 20, 40],
        ],
      },
      {
        labelKey: 'tpl.day.b',
        rows: [
          ['leg-curl', 2, 10, 15],
          ['seated-shoulder-press', 2, 10, 12],
          ['seated-cable-row', 2, 10, 12],
          ['pallof-press', 2, 10, 12],
        ],
      },
    ],
  },
  {
    id: 'strength',
    nameKey: 'tpl.strength.name',
    descKey: 'tpl.strength.desc',
    pattern: [
      {
        labelKey: 'tpl.day.a',
        rows: [
          ['leg-press', 4, 6, 8, { restSec: 180 }],
          ['flat-press', 4, 6, 8, { restSec: 180 }],
          ['seated-cable-row', 4, 6, 8, { restSec: 180 }],
          ['hanging-knee-raise', 3, 10, 15],
        ],
      },
      {
        labelKey: 'tpl.day.b',
        rows: [
          ['incline-db-press', 4, 6, 8, { restSec: 180 }],
          ['lat-pulldown', 4, 6, 8, { restSec: 180 }],
          ['seated-shoulder-press', 3, 6, 8, { restSec: 180 }],
          ['leg-curl', 3, 8, 10],
          ['calf-raise', 3, 10, 12],
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

function itemsOf(rows: Row[]): PlanItem[] {
  return rows
    .filter(([id]) => findExercise(id))
    .map(([exerciseId, sets, repsMin, repsMax, extra]) => ({ exerciseId, sets, repsMin, repsMax, ...extra }));
}

/**
 * Собирает план. ids дней — day-1…day-N: в «Сплит 3+1» они совпадают с id дней
 * первой версии приложения, поэтому старая история остаётся привязана к своим дням.
 */
export function buildPlan(opts: { templateId?: string | null; days: number; mode: Plan['mode'] }): Plan {
  const tpl = opts.templateId ? findTemplate(opts.templateId) : undefined;
  const n = Math.min(7, Math.max(1, tpl?.fixedDays ?? Math.round(opts.days)));
  const weekdays = DEFAULT_WEEKDAYS[n]!;
  const days: Day[] = Array.from({ length: n }, (_, i) => {
    const td = tpl?.pattern[i % tpl.pattern.length];
    const day: Day = { id: dayId(i), items: td ? itemsOf(td.rows) : [] };
    if (td) day.labelKey = td.labelKey;
    if (opts.mode === 'weekdays') day.weekday = weekdays[i]!;
    return day;
  });
  const plan: Plan = { mode: opts.mode, days };
  if (tpl) plan.templateId = tpl.id;
  return plan;
}

export function templateDayCount(t: Template, wanted: number): number {
  return t.fixedDays ?? wanted;
}
