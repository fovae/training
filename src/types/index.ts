/**
 * Схема данных (docs/CONCEPT.md, раздел 5). Всё хранится только на устройстве.
 * Вес всегда в килограммах, рост в сантиметрах: единицы меняются только при показе.
 * Расширения сверх концепта помечены «ext».
 */

export type Level = 'first' | 'few' | 'intermediate' | 'veteran';
export type Sex = 'male' | 'female' | 'unspecified';
export type Units = 'metric' | 'imperial';

/** Принятые версии юридических документов (версии — из метаданных файлов src/content/legal) */
export interface LegalAcceptance {
  privacy: string;
  terms: string;
  /** ISO */
  at: string;
}

export interface Profile {
  weightKg: number;
  heightCm: number;
  name?: string;
  age?: number;
  sex?: Sex;
  level: Level;
  units: Units;
  locale: string;
  adult16Confirmed: true;
  /** ISO. Дату рождения не храним. */
  confirmedAt: string;
  /** null — документы ещё не приняты (или профиль из версии без принятия) */
  legalAccepted: LegalAcceptance | null;
}

/** 0 = понедельник … 6 = воскресенье */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface PlanItem {
  exerciseId: string;
  sets: number;
  /** Для упражнений на время — секунды */
  repsMin: number;
  repsMax: number;
  targetWeightKg?: number;
  restSec?: number;
  optional?: boolean;
}

export interface Day {
  id: string;
  /** Своё название дня (пишет пользователь) */
  label?: string;
  /** ext: ключ словаря для названия из шаблона — переводится при смене языка */
  labelKey?: string;
  weekday?: Weekday;
  items: PlanItem[];
}

export interface Plan {
  mode: 'weekdays' | 'cycle';
  /** 1..7 */
  days: Day[];
  /** ext: шаблон, из которого собран план (для подписи) */
  templateId?: string;
}

export interface SessionSet {
  weightKg?: number;
  reps?: number;
  seconds?: number;
  done: boolean;
  /** ext: когда отмечен, ISO */
  doneAt?: string;
}

export interface SessionEntry {
  exerciseId: string;
  skipped?: boolean;
  note?: string;
  sets: SessionSet[];
}

export interface Session {
  id: string;
  dayId: string;
  /** ISO */
  startedAt: string;
  endedAt?: string;
  note?: string;
  entries: SessionEntry[];
}

export const THEMES = [
  'classic-orange',
  'classic-light',
  'classic-dark',
  'monochrome',
  'blue',
  'violet',
  'green',
  'rose',
  'gradient-1',
  'gradient-2',
] as const;
/** 'auto' — по системе: classic-light / classic-dark */
export type ThemeId = (typeof THEMES)[number] | 'auto';

/** Когда совет закрыли (ключ — `${правило}:${упражнение}`) */
export interface TipMark {
  dismissedAt: string;
}

export interface Settings {
  theme: ThemeId;
  tipsEnabled: boolean;
  restBaseSec: number;
  restIsoSec: number;
  sound: boolean;
  wakeLock: boolean;
  /** ISO, последняя сохранённая копия */
  lastBackupAt?: string;
  /** ISO, когда закрыли напоминание о копии */
  backupReminderDismissedAt?: string;
  tipState: Record<string, TipMark>;
  /** id упражнений с «Больше не предупреждать» о весе */
  weightWarningIgnored: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'classic-orange',
  tipsEnabled: true,
  restBaseSec: 150,
  restIsoSec: 90,
  sound: true,
  wakeLock: true,
  tipState: {},
  weightWarningIgnored: [],
};

// ---------- библиотека упражнений (раздел 6) ----------

export type Muscle =
  | 'chest'
  | 'lats'
  | 'upper-back'
  | 'traps'
  | 'front-delts'
  | 'side-delts'
  | 'rear-delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'deep-core'
  | 'lower-back'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves';

export type Equipment =
  | 'bodyweight'
  | 'dumbbell'
  | 'barbell'
  | 'machine'
  | 'cable'
  | 'kettlebell'
  | 'band'
  | 'bench'
  | 'pullup-bar'
  | 'dip-station';

export type Category = 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'legs';

export interface Exercise {
  /** Стабильный id. Никогда не меняется и не переиспользуется: по нему хранится история. */
  id: string;
  nameKey: string;
  category: Category;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  equipment: Equipment[];
  /** compound — отдых «базовый», isolation — «изоляция» */
  type: 'compound' | 'isolation';
  metric: 'weight_reps' | 'reps' | 'time';
  levelHint: 'beginner' | 'intermediate' | 'advanced';
  /** Ключ схемы из src/pics/defs.ts */
  pictogram: string;
  descriptionKey: string;
  cueKeys: string[];
  mistakeKeys: string[];
  safetyKey: string;
  /** ext: подход выполняется на каждую руку или сторону */
  per?: 'arm' | 'side';
  /** ext: схема по умолчанию при добавлении в план */
  defaults: { sets: number; repsMin: number; repsMax: number };
}
