import type { Equipment, Exercise, Level } from '../types';

/**
 * Оценка длительности тренировки (docs/ARCHITECTURE.md, «Оценка времени»). Чистые функции без UI и
 * состояния: план, «Сегодня» и будущий конструктор плана передают упражнения и настройки сами.
 *
 * Слой 1 — модель: работа (повторы × темп или заданное время, обе стороны у «на руку/сторону») +
 * отдых по таймеру с надбавкой на поздний старт + накладные на подход (встать, поменять вес,
 * записать) + разминка перед первым базовым упражнением со свободным весом + переходы между
 * упражнениями. Три сценария: min (быстро, по таймеру), typical (реалистично, с запасом),
 * max (медленно + необязательные упражнения).
 * Слой 2 — личный коэффициент по истории (calibrationFactor) и ручной «Мой темп» поверх.
 */

/** Все числа модели — здесь; секунды, если не сказано иначе */
export const DURATION_CONSTANTS = {
  /** Темп одного повтора: контролируемый, ~4–5 с у базовых */
  tempo: { compound: 4.5, isolation: 4, bodyweight: 3.5 },
  /** Подход не короче — даже из 3 повторов (занять положение, выдохнуть) */
  minWorkSec: 20,
  /** Реальный отдых длиннее таймера: подход начинают не по сигналу */
  restOverrun: 0.15,
  /** Накладные на каждый подход: занять позицию, поменять вес, записать результат */
  setup: { free: 30, machine: 25, bodyweight: 15, time: 10 },
  /** Разминка и подводящие подходы перед первым упражнением дня, если оно базовое со свободным весом */
  warmupSec: 300,
  /** Разминка по уровню: новичку нужно больше времени на подготовку */
  warmupByLevel: { first: 1.3, few: 1.15, intermediate: 1, veteran: 0.85 } as Record<Level, number>,
  /** Переход к упражнению: найти снаряд, сменить блины; к первому — дольше (раздевалка, свободный снаряд) */
  transition: { first: 180, next: 75 },
  /** Сценарии диапазона — множители к частям оценки */
  scenario: {
    min: { tempo: 0.85, restOverrun: 0, setup: 0.6, warmup: 0.5, transition: 0.6 },
    typical: { tempo: 1, restOverrun: 1, setup: 1, warmup: 1, transition: 1 },
    max: { tempo: 1.15, restOverrun: 2.3, setup: 1.4, warmup: 1.3, transition: 1.5 },
  },
  /** «Мой темп» в настройках — поправка поверх калибровки */
  pace: { slow: 1.15, normal: 1, fast: 0.87 },
  /** Калибровка по истории */
  calibration: {
    /** Сколько последних подходящих тренировок берём */
    window: 8,
    /** Коэффициент не выходит за эти границы */
    clamp: [0.8, 1.8] as const,
    /** С этого числа тренировок — полное влияние; меньше — пропорционально слабее */
    fullAt: 5,
    /** Тренировки короче и длиннее этого (мин) — мусор: случайный запуск или забыли завершить */
    minMin: 5,
    maxMin: 180,
    /** Пауза между отметками подходов длиннее этого (мин) — ушёл, тренировку не берём */
    maxGapMin: 30,
  },
  /** Округление показа, мин */
  roundMin: 5,
} as const;

export type Pace = keyof typeof DURATION_CONSTANTS.pace;
type Scenario = keyof typeof DURATION_CONSTANTS.scenario;

/** Что нужно знать об упражнении */
export type DurationExercise = Pick<Exercise, 'type' | 'metric' | 'equipment' | 'per'>;

/** Одно упражнение дня; restSec — отдых между подходами по таймеру (restFor) */
export interface DurationItem {
  ex: DurationExercise | undefined;
  sets: number;
  /** Повторы (или секунды у упражнений на время) — на сторону у «на руку/сторону» */
  repsMin: number;
  repsMax: number;
  restSec: number;
  optional?: boolean;
}

export interface EstimateOptions {
  level?: Level;
  pace?: Pace;
  /** Личный коэффициент по истории; 1 — без поправки */
  calibration?: number;
}

/** Части оценки (typical), секунды — для расшифровки */
export interface DurationParts {
  work: number;
  rest: number;
  setup: number;
  warmup: number;
  transitions: number;
}

export interface Estimate {
  /** Минуты, округлённые: min — к меньшему, typical — к ближайшему, max — к большему */
  minMin: number;
  typicalMin: number;
  maxMin: number;
  /** Без округления, секунды */
  sec: { min: number; typical: number; max: number };
  parts: DurationParts;
}

const FREE: Equipment[] = ['barbell', 'dumbbell', 'kettlebell'];
const MACHINE: Equipment[] = ['machine', 'cable'];

const isFree = (ex: DurationExercise | undefined) => !!ex?.equipment.some((q) => FREE.includes(q));

function setupKind(ex: DurationExercise | undefined): keyof typeof DURATION_CONSTANTS.setup {
  if (ex?.metric === 'time') return 'time';
  if (isFree(ex)) return 'free';
  if (ex?.equipment.some((q) => MACHINE.includes(q))) return 'machine';
  return 'bodyweight';
}

function tempoOf(ex: DurationExercise | undefined): number {
  const c = DURATION_CONSTANTS.tempo;
  if (ex && !isFree(ex) && !ex.equipment.some((q) => MACHINE.includes(q))) return c.bodyweight;
  return ex?.type === 'compound' ? c.compound : c.isolation;
}

/** Части одного упражнения в сценарии (без разминки и переходов), секунды */
export function itemSeconds(
  item: DurationItem,
  scenario: Scenario = 'typical',
): Omit<DurationParts, 'warmup' | 'transitions'> {
  const C = DURATION_CONSTANTS;
  const k = C.scenario[scenario];
  const sets = Math.max(0, item.sets);
  if (!sets) return { work: 0, rest: 0, setup: 0 };
  const avg = (item.repsMin + item.repsMax) / 2;
  const sides = item.ex?.per ? 2 : 1;
  const perSet =
    item.ex?.metric === 'time'
      ? avg * sides
      : Math.max(C.minWorkSec, avg * tempoOf(item.ex) * k.tempo * sides);
  return {
    work: sets * perSet,
    rest: (sets - 1) * item.restSec * (1 + C.restOverrun * k.restOverrun),
    setup: sets * C.setup[setupKind(item.ex)] * k.setup,
  };
}

function partsOf(items: DurationItem[], scenario: Scenario, level: Level | undefined): DurationParts {
  const C = DURATION_CONSTANTS;
  const k = C.scenario[scenario];
  const p: DurationParts = { work: 0, rest: 0, setup: 0, warmup: 0, transitions: 0 };
  items.forEach((it, i) => {
    const s = itemSeconds(it, scenario);
    p.work += s.work;
    p.rest += s.rest;
    p.setup += s.setup;
    p.transitions += (i === 0 ? C.transition.first : C.transition.next) * k.transition;
  });
  const first = items[0]?.ex;
  if (first?.type === 'compound' && isFree(first))
    p.warmup = C.warmupSec * C.warmupByLevel[level ?? 'intermediate'] * k.warmup;
  return p;
}

const sum = (p: DurationParts) => p.work + p.rest + p.setup + p.warmup + p.transitions;

/** Округление показа: не ниже шага, без ложной точности */
export function roundMinutes(sec: number, mode: 'down' | 'nearest' | 'up'): number {
  const step = DURATION_CONSTANTS.roundMin;
  const m = sec / 60 / step;
  const r = mode === 'down' ? Math.floor(m) : mode === 'up' ? Math.ceil(m) : Math.round(m);
  return Math.max(step, r * step);
}

/**
 * Оценка списка упражнений (день плана, остаток тренировки, черновик конструктора).
 * typical и min — без необязательных; max — с ними. Пустой список — нули.
 */
export function estimateItems(items: DurationItem[], opts: EstimateOptions = {}): Estimate {
  const main = items.filter((i) => !i.optional && i.sets > 0);
  const all = items.filter((i) => i.sets > 0);
  if (!main.length && !all.length)
    return {
      minMin: 0,
      typicalMin: 0,
      maxMin: 0,
      sec: { min: 0, typical: 0, max: 0 },
      parts: { work: 0, rest: 0, setup: 0, warmup: 0, transitions: 0 },
    };
  const f = DURATION_CONSTANTS.pace[opts.pace ?? 'normal'] * (opts.calibration ?? 1);
  const base = main.length ? main : all;
  const parts = partsOf(base, 'typical', opts.level);
  const typical = sum(parts) * f;
  const min = sum(partsOf(base, 'min', opts.level)) * f;
  const max = sum(partsOf(all, 'max', opts.level)) * f;
  const typicalMin = roundMinutes(typical, 'nearest');
  const step = DURATION_CONSTANTS.roundMin;
  return {
    minMin: Math.min(roundMinutes(min, 'down'), Math.max(step, typicalMin - step)),
    typicalMin,
    maxMin: Math.max(roundMinutes(max, 'up'), typicalMin + step),
    sec: { min, typical, max },
    parts: {
      work: parts.work * f,
      rest: parts.rest * f,
      setup: parts.setup * f,
      warmup: parts.warmup * f,
      transitions: parts.transitions * f,
    },
  };
}

// ---------- слой 2: личный коэффициент по истории ----------

export interface SessionLike {
  startedAt: string;
  endedAt?: string;
  entries: {
    exerciseId: string;
    skipped?: boolean;
    sets: { done: boolean; reps?: number; seconds?: number; doneAt?: string }[];
  }[];
}

/**
 * Реальная длительность тренировки для калибровки, секунды; null — не брать: не завершена, короче
 * 5 мин или дольше 3 ч, нет выполненных подходов, пауза между отметками подходов больше 30 мин
 * (ушёл и вернулся) или тренировку завершили через 30+ мин после последнего подхода (забыли).
 * Незавершённые подходы не мешают: предсказание строится по выполненным (sessionItems).
 */
export function sessionActualSec(s: SessionLike): number | null {
  const C = DURATION_CONSTANTS.calibration;
  if (!s.endedAt) return null;
  const start = Date.parse(s.startedAt);
  const end = Date.parse(s.endedAt);
  const sec = (end - start) / 1000;
  if (!(sec >= C.minMin * 60 && sec <= C.maxMin * 60)) return null;
  const done = s.entries.flatMap((e) => (e.skipped ? [] : e.sets.filter((x) => x.done)));
  if (!done.length) return null;
  const marks = done
    .map((x) => (x.doneAt ? Date.parse(x.doneAt) : NaN))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (marks.length) {
    const gap = C.maxGapMin * 60000;
    const points = [start, ...marks, end];
    for (let i = 1; i < points.length; i++) if (points[i]! - points[i - 1]! > gap) return null;
  }
  return sec;
}

/** Выполненный состав тренировки как список упражнений для модели */
export function sessionItems(
  s: SessionLike,
  find: (id: string) => DurationExercise | undefined,
  restFor: (ex: DurationExercise | undefined) => number,
): DurationItem[] {
  const out: DurationItem[] = [];
  for (const e of s.entries) {
    if (e.skipped) continue;
    const done = e.sets.filter((x) => x.done);
    if (!done.length) continue;
    const ex = find(e.exerciseId);
    const vals = done.map((x) => (ex?.metric === 'time' ? x.seconds : x.reps) ?? 0).filter((v) => v > 0);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 10;
    out.push({ ex, sets: done.length, repsMin: avg, repsMax: avg, restSec: restFor(ex) });
  }
  return out;
}

export interface Calibration {
  /** Коэффициент к оценке (1 — без поправки) */
  factor: number;
  /** Сколько тренировок вошло */
  n: number;
}

/**
 * Коэффициент «реально / предсказано» по последним тренировкам: медиана последних `window`
 * подходящих, в пределах clamp, с усадкой к 1 при малой истории (n / fullAt). Пустая история — 1.
 * `predictSec` — предсказание базовой модели (typical, без темпа и калибровки) для тренировки.
 */
export function calibrationFactor(
  sessions: SessionLike[],
  predictSec: (s: SessionLike) => number,
): Calibration {
  const C = DURATION_CONSTANTS.calibration;
  const ratios: number[] = [];
  const sorted = [...sessions]
    .filter((s) => s.endedAt)
    .sort((a, b) => Date.parse(b.endedAt!) - Date.parse(a.endedAt!));
  for (const s of sorted) {
    if (ratios.length >= C.window) break;
    const actual = sessionActualSec(s);
    if (actual == null) continue;
    const pred = predictSec(s);
    if (pred > 0) ratios.push(actual / pred);
  }
  if (!ratios.length) return { factor: 1, n: 0 };
  ratios.sort((a, b) => a - b);
  const mid = ratios.length / 2;
  const median = ratios.length % 2 ? ratios[Math.floor(mid)]! : (ratios[mid - 1]! + ratios[mid]!) / 2;
  const clamped = Math.min(C.clamp[1], Math.max(C.clamp[0], median));
  const w = Math.min(ratios.length, C.fullAt) / C.fullAt;
  return { factor: 1 + (clamped - 1) * w, n: ratios.length };
}

/**
 * Точка расширения для «осталось примерно» во время тренировки: оценка оставшихся подходов
 * (items — то, что ещё не сделано) без разминки и с обычными переходами. Сейчас — по модели и
 * личному коэффициенту; позже можно взять реальный темп по отметкам уже сделанных подходов.
 */
export function estimateRemaining(items: DurationItem[], opts: EstimateOptions = {}): number {
  const f = DURATION_CONSTANTS.pace[opts.pace ?? 'normal'] * (opts.calibration ?? 1);
  const C = DURATION_CONSTANTS;
  let sec = 0;
  items.forEach((it, i) => {
    if (it.sets <= 0) return;
    const s = itemSeconds(it);
    sec += s.work + s.rest + s.setup + (i === 0 ? 0 : C.transition.next);
  });
  return sec * f;
}

/** План дня → оценка. find и restFor передаёт вызывающий (состояние, тест, конструктор плана) */
export function estimateDay<
  I extends { exerciseId: string; sets: number; repsMin: number; repsMax: number; optional?: boolean },
>(
  day: { items: I[] },
  ctx: {
    find: (id: string) => DurationExercise | undefined;
    restFor: (ex: DurationExercise | undefined, item: I) => number;
  },
  opts: EstimateOptions = {},
): Estimate {
  return estimateItems(
    day.items.map((it) => {
      const ex = ctx.find(it.exerciseId);
      return {
        ex,
        sets: it.sets,
        repsMin: it.repsMin,
        repsMax: it.repsMax,
        restSec: ctx.restFor(ex, it),
        optional: it.optional,
      };
    }),
    opts,
  );
}
