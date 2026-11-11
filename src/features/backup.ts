import { signal } from '@preact/signals';
import * as store from '../db';
import type { BackupFile, SetEntry, Workout } from '../db/types';
import { sanitize, settings } from '../state/settings';
import { active, history, reloadAll } from '../state/workout';

export const BACKUP_SCHEMA = 1;

export function buildBackup(): BackupFile {
  return {
    app: 'training-pwa',
    schema: BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    appVersion: __APP_VERSION__,
    workouts: history.value,
    active: active.value,
    settings: settings.value,
  };
}

/**
 * Экспорт: на iPhone — через share sheet (Сохранить в Файлы / AirDrop / Telegram),
 * если он недоступен — обычное скачивание файла.
 */
export async function exportData(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const json = JSON.stringify(buildBackup(), null, 2);
  const name = `training-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (coarse && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Резервная копия тренировок' });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
      // иначе — пробуем скачивание
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

// ---------- импорт ----------

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const numOrNull = (v: unknown): number | null => (isNum(v) && v >= 0 ? v : null);

function cleanSet(s: unknown): SetEntry | null {
  if (!s || typeof s !== 'object') return null;
  const r = s as Record<string, unknown>;
  const out: SetEntry = { weight: numOrNull(r.weight), reps: numOrNull(r.reps), done: r.done === true };
  if (isNum(r.doneAt)) out.doneAt = r.doneAt;
  return out;
}

function cleanWorkout(w: unknown): Workout | null {
  if (!w || typeof w !== 'object') return null;
  const r = w as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.dayId !== 'string' || !isNum(r.startedAt)) return null;
  if (!Array.isArray(r.exercises)) return null;
  return {
    id: r.id,
    dayId: r.dayId,
    startedAt: r.startedAt,
    finishedAt: isNum(r.finishedAt) ? r.finishedAt : null,
    exercises: r.exercises.flatMap((e) => {
      if (!e || typeof e !== 'object') return [];
      const x = e as Record<string, unknown>;
      if (typeof x.exId !== 'string' || !Array.isArray(x.sets)) return [];
      return [
        {
          exId: x.exId,
          skipped: x.skipped === true,
          sets: x.sets.map(cleanSet).filter((s): s is SetEntry => s !== null),
        },
      ];
    }),
  };
}

export interface ParsedBackup {
  workouts: Workout[];
  active: Workout | null;
  settings: ReturnType<typeof sanitize> | null;
  exportedAt: string | null;
}

/** Проверяет и нормализует файл. Бросает Error с понятным текстом. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Файл не похож на JSON.');
  }
  const r = raw as Partial<BackupFile> | null;
  if (!r || r.app !== 'training-pwa' || !Array.isArray(r.workouts)) {
    throw new Error('Это не резервная копия этого приложения.');
  }
  if (!isNum(r.schema) || r.schema > BACKUP_SCHEMA) {
    throw new Error('Копия сделана более новой версией приложения. Сначала обнови приложение.');
  }
  // Здесь будут миграции формата: if (r.schema < 2) { ... }
  const workouts = r.workouts
    .map(cleanWorkout)
    .filter((w): w is Workout => w !== null && w.finishedAt !== null);
  const act = cleanWorkout(r.active);
  return {
    workouts,
    active: act && act.finishedAt === null ? act : null,
    settings: r.settings ? sanitize(r.settings) : null,
    exportedAt: typeof r.exportedAt === 'string' ? r.exportedAt : null,
  };
}

export async function applyBackup(b: ParsedBackup): Promise<void> {
  await store.replaceAll(b.workouts, b.active);
  if (b.settings) settings.value = b.settings;
  await reloadAll();
}

export function readFile(file: File): Promise<string> {
  return file.text();
}

// ---------- постоянное хранилище ----------

export type PersistStatus = 'unsupported' | 'persisted' | 'not-persisted' | 'unknown';
export const persistStatus = signal<PersistStatus>('unknown');

export async function checkPersist(): Promise<void> {
  if (!navigator.storage?.persisted) {
    persistStatus.value = 'unsupported';
    return;
  }
  try {
    persistStatus.value = (await navigator.storage.persisted()) ? 'persisted' : 'not-persisted';
  } catch {
    persistStatus.value = 'unknown';
  }
}

export async function requestPersist(): Promise<void> {
  if (!navigator.storage?.persist) {
    persistStatus.value = 'unsupported';
    return;
  }
  try {
    persistStatus.value = (await navigator.storage.persist()) ? 'persisted' : 'not-persisted';
  } catch {
    persistStatus.value = 'unknown';
  }
}

export async function resetAll(): Promise<void> {
  await store.clearAll();
  await reloadAll();
}
