import { findExercise } from '../data/exercises';
import type { Session, SessionSet, Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

/**
 * Чистые функции миграции данных. Используются в upgrade() IndexedDB и в импорте файлов
 * старого формата. Каждая версия схемы — отдельная функция, старые не удаляются.
 */

// ---------- схема v1 (первая версия приложения «Сплит 3+1») ----------

export interface V1Set {
  weight: number | null;
  reps: number | null;
  done: boolean;
  doneAt?: number;
}
export interface V1Exercise {
  exId: string;
  skipped: boolean;
  sets: V1Set[];
}
export interface V1Workout {
  id: string;
  dayId: string;
  startedAt: number;
  finishedAt: number | null;
  exercises: V1Exercise[];
}
export interface V1Settings {
  theme?: string;
  units?: string;
  restBase?: number;
  restIso?: number;
  sound?: boolean;
  wakeLock?: boolean;
}

const iso = (ms: number): string => new Date(ms).toISOString();
const okNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function v1Set(s: V1Set, isTime: boolean): SessionSet {
  const out: SessionSet = { done: s.done === true };
  if (okNum(s.weight)) out.weightKg = s.weight;
  // В v1 секунды планки хранились в поле reps
  if (okNum(s.reps)) {
    if (isTime) out.seconds = s.reps;
    else out.reps = s.reps;
  }
  if (okNum(s.doneAt)) out.doneAt = iso(s.doneAt);
  return out;
}

/** Тренировка v1 → Session. Ничего не выбрасываем: незнакомые упражнения тоже переносим. */
export function migrateWorkoutV1(w: V1Workout): Session {
  const s: Session = {
    id: w.id,
    dayId: w.dayId,
    startedAt: iso(w.startedAt),
    entries: (w.exercises ?? []).map((e) => {
      const isTime = findExercise(e.exId)?.metric === 'time';
      const entry: Session['entries'][number] = {
        exerciseId: e.exId,
        sets: (e.sets ?? []).map((x) => v1Set(x, isTime)),
      };
      if (e.skipped) entry.skipped = true;
      return entry;
    }),
  };
  if (okNum(w.finishedAt)) s.endedAt = iso(w.finishedAt);
  return s;
}

export function migrateSettingsV1(raw: V1Settings | null | undefined): Settings {
  const r = raw ?? {};
  const sec = (v: unknown, d: number) => (okNum(v) ? Math.min(600, Math.max(15, Math.round(v))) : d);
  return {
    ...DEFAULT_SETTINGS,
    theme: r.theme === 'light' || r.theme === 'dark' ? r.theme : 'system',
    restBaseSec: sec(r.restBase, DEFAULT_SETTINGS.restBaseSec),
    restIsoSec: sec(r.restIso, DEFAULT_SETTINGS.restIsoSec),
    sound: typeof r.sound === 'boolean' ? r.sound : DEFAULT_SETTINGS.sound,
    wakeLock: typeof r.wakeLock === 'boolean' ? r.wakeLock : DEFAULT_SETTINGS.wakeLock,
  };
}

/**
 * Что знаем о пользователе v1 до онбординга: единицы и язык старого интерфейса.
 * Онбординг подставляет это в поля, профиль создаёт сам пользователь.
 */
export interface LegacyPrefs {
  units: 'metric' | 'imperial';
  locale: string;
  workouts: number;
}

export function legacyPrefsV1(raw: V1Settings | null | undefined, workouts: number): LegacyPrefs {
  return { units: raw?.units === 'lb' ? 'imperial' : 'metric', locale: 'ru', workouts };
}
