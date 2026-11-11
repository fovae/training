import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { buildPlan } from '../data/templates';
import type { Plan, Profile, Session, Settings } from '../types';
import {
  legacyPrefsV1,
  migrateSettingsV1,
  migrateWorkoutV1,
  type LegacyPrefs,
  type V1Settings,
  type V1Workout,
} from './migrations';

/**
 * IndexedDB. Версии схемы:
 *  v1 — первая версия: workouts + kv(activeWorkout); настройки в localStorage 'tp-settings'.
 *  v2 — этап 1: sessions + kv(profile, plan, settings, activeSession).
 *
 * При изменении структуры увеличь DB_VERSION и добавь шаг в upgrade(). Шаги идут
 * по порядку от старой версии к новой. Старые шаги не удаляются.
 * Хранилище v1 `workouts` оставлено как есть — страховочная копия старых данных.
 */
export const DB_NAME = 'training-pwa';
export const DB_VERSION = 2;

type KvKey = 'profile' | 'plan' | 'settings' | 'activeSession' | 'legacyPrefs' | 'activeWorkout';

interface TrainingDB extends DBSchema {
  sessions: {
    key: string;
    value: Session;
    indexes: { 'by-started': string; 'by-day': string };
  };
  kv: { key: KvKey; value: unknown };
  /** v1, только чтение */
  workouts: { key: string; value: V1Workout; indexes: { 'by-started': number; 'by-day': string } };
}

function readV1Settings(): V1Settings | null {
  try {
    return JSON.parse(localStorage.getItem('tp-settings') ?? 'null') as V1Settings | null;
  } catch {
    return null;
  }
}

let dbp: Promise<IDBPDatabase<TrainingDB>> | null = null;

export function db(): Promise<IDBPDatabase<TrainingDB>> {
  dbp ??= openDB<TrainingDB>(DB_NAME, DB_VERSION, {
    async upgrade(database, oldVersion, _newVersion, tx) {
      const createSessions = () => {
        const s = database.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('by-started', 'startedAt');
        s.createIndex('by-day', 'dayId');
      };

      if (oldVersion < 1) {
        // Новая установка
        database.createObjectStore('kv');
        createSessions();
        return;
      }

      if (oldVersion < 2) {
        // v1 → v2: переносим историю, текущую тренировку и настройки. Ничего не удаляем.
        createSessions();
        const kv = tx.objectStore('kv');
        const sessions = tx.objectStore('sessions');
        const old = await tx.objectStore('workouts').getAll();
        for (const w of old) {
          if (w.finishedAt == null) continue;
          await sessions.put(migrateWorkoutV1(w));
        }
        const act = (await kv.get('activeWorkout')) as V1Workout | undefined;
        if (act) await kv.put(migrateWorkoutV1(act), 'activeSession');
        // План владельца — «Сплит 3+1», дни day-1…day-4 совпадают со старыми id
        await kv.put(buildPlan({ templateId: 'split31', days: 4, mode: 'cycle' }), 'plan');
        const v1s = readV1Settings();
        await kv.put(migrateSettingsV1(v1s), 'settings');
        await kv.put(legacyPrefsV1(v1s, old.length), 'legacyPrefs');
      }
    },
    blocked() {
      console.warn('[db] upgrade blocked by another tab');
    },
    blocking() {
      void dbp?.then((d) => d.close());
      dbp = null;
    },
  });
  return dbp;
}

async function kvGet<T>(key: KvKey): Promise<T | null> {
  return ((await (await db()).get('kv', key)) as T | undefined) ?? null;
}
async function kvPut(key: KvKey, v: unknown): Promise<void> {
  const d = await db();
  if (v == null) await d.delete('kv', key);
  else await d.put('kv', v, key);
}

export const getProfile = () => kvGet<Profile>('profile');
export const saveProfile = (p: Profile) => kvPut('profile', p);
export const getPlan = () => kvGet<Plan>('plan');
export const savePlan = (p: Plan) => kvPut('plan', p);
export const getSettings = () => kvGet<Settings>('settings');
export const saveSettings = (s: Settings) => kvPut('settings', s);
export const getLegacyPrefs = () => kvGet<LegacyPrefs>('legacyPrefs');
export const getActive = () => kvGet<Session>('activeSession');
export const saveActive = (s: Session | null) => kvPut('activeSession', s);

/** Завершённые тренировки, новые первыми */
export async function listSessions(): Promise<Session[]> {
  const all = await (await db()).getAllFromIndex('sessions', 'by-started');
  return all.reverse();
}

export async function putSession(s: Session): Promise<void> {
  await (await db()).put('sessions', s);
}

export async function deleteSession(id: string): Promise<void> {
  await (await db()).delete('sessions', id);
}

/** Атомарно: запись в журнал + очистка активной */
export async function commitActive(s: Session): Promise<void> {
  const d = await db();
  const tx = d.transaction(['sessions', 'kv'], 'readwrite');
  await Promise.all([
    tx.objectStore('sessions').put(s),
    tx.objectStore('kv').delete('activeSession'),
    tx.done,
  ]);
}

export async function replaceSessions(list: Session[], active: Session | null): Promise<void> {
  const d = await db();
  const tx = d.transaction(['sessions', 'kv'], 'readwrite');
  const ss = tx.objectStore('sessions');
  await ss.clear();
  for (const s of list) await ss.put(s);
  if (active) await tx.objectStore('kv').put(active, 'activeSession');
  else await tx.objectStore('kv').delete('activeSession');
  await tx.done;
}

/** Полный сброс: журнал, профиль, план, настройки. Страховочная копия v1 тоже удаляется. */
export async function clearAll(): Promise<void> {
  const d = await db();
  const stores = [...d.objectStoreNames] as ('sessions' | 'kv' | 'workouts')[];
  const tx = d.transaction(stores, 'readwrite');
  await Promise.all([...stores.map((s) => tx.objectStore(s).clear()), tx.done]);
}
