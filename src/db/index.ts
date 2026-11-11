import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Workout } from './types';

/**
 * IndexedDB журнала.
 *
 * Версионирование: при изменении структуры увеличь DB_VERSION и добавь новый `case`
 * в upgrade() — шаги выполняются последовательно от старой версии к новой, поэтому
 * старая история у пользователя не теряется. Никогда не удаляй существующие case.
 */
export const DB_NAME = 'training-pwa';
export const DB_VERSION = 1;

interface TrainingDB extends DBSchema {
  workouts: {
    key: string;
    value: Workout;
    indexes: { 'by-started': number; 'by-day': string };
  };
  kv: {
    key: string;
    value: unknown;
  };
}

let dbp: Promise<IDBPDatabase<TrainingDB>> | null = null;

export function db(): Promise<IDBPDatabase<TrainingDB>> {
  dbp ??= openDB<TrainingDB>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion) {
      // Намеренный fallthrough: каждая миграция применяется по порядку.
      switch (oldVersion) {
        case 0: {
          const w = database.createObjectStore('workouts', { keyPath: 'id' });
          w.createIndex('by-started', 'startedAt');
          w.createIndex('by-day', 'dayId');
          database.createObjectStore('kv');
        }
        // case 1: { ...миграция на версию 2... }
      }
    },
    blocked() {
      // Открыта старая вкладка с прежней версией БД.
      console.warn('[db] upgrade blocked by another tab');
    },
    blocking() {
      // Новая версия приложения хочет обновить БД — отпускаем соединение.
      void dbp?.then((d) => d.close());
      dbp = null;
    },
  });
  return dbp;
}

const ACTIVE_KEY = 'activeWorkout';

export async function getActive(): Promise<Workout | null> {
  return ((await (await db()).get('kv', ACTIVE_KEY)) as Workout | undefined) ?? null;
}

export async function saveActive(w: Workout | null): Promise<void> {
  const d = await db();
  if (w) await d.put('kv', w, ACTIVE_KEY);
  else await d.delete('kv', ACTIVE_KEY);
}

/** Завершённые тренировки, новые первыми */
export async function listWorkouts(): Promise<Workout[]> {
  const all = await (await db()).getAllFromIndex('workouts', 'by-started');
  return all.reverse();
}

export async function putWorkout(w: Workout): Promise<void> {
  await (await db()).put('workouts', w);
}

export async function deleteWorkout(id: string): Promise<void> {
  await (await db()).delete('workouts', id);
}

/** Атомарно завершает активную тренировку: запись в журнал + очистка активной. */
export async function commitActive(w: Workout): Promise<void> {
  const d = await db();
  const tx = d.transaction(['workouts', 'kv'], 'readwrite');
  await Promise.all([tx.objectStore('workouts').put(w), tx.objectStore('kv').delete(ACTIVE_KEY), tx.done]);
}

export async function replaceAll(workouts: Workout[], active: Workout | null): Promise<void> {
  const d = await db();
  const tx = d.transaction(['workouts', 'kv'], 'readwrite');
  const ws = tx.objectStore('workouts');
  await ws.clear();
  for (const w of workouts) await ws.put(w);
  if (active) await tx.objectStore('kv').put(active, ACTIVE_KEY);
  else await tx.objectStore('kv').delete(ACTIVE_KEY);
  await tx.done;
}

export async function clearAll(): Promise<void> {
  const d = await db();
  const tx = d.transaction(['workouts', 'kv'], 'readwrite');
  await Promise.all([tx.objectStore('workouts').clear(), tx.objectStore('kv').clear(), tx.done]);
}
