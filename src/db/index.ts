import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Plan, Profile, Session, Settings } from '../types';
import { migrateProfileV2, migrateSettingsV2, migrateSettingsV3 } from './migrations';

/**
 * IndexedDB. Версии схемы:
 *  v2 — этап 1: sessions + kv(profile, plan, settings, activeSession).
 *  v3 — этап 2: новые поля настроек и профиля (см. migrations.ts); удалены остатки v1
 *       (хранилище workouts, kv.legacyPrefs, kv.activeWorkout).
 *  v4 — релиз 3.0: новый набор тем (сохранённая тема переводится по карте), настройка «Анимации».
 *  v5 — 3.3: локальные точки восстановления (хранилище restorePoints, не больше трёх). Перед каждым
 *       обновлением схемы данные сохраняются точкой «перед обновлением» — до шагов миграции.
 *
 * При изменении структуры увеличь DB_VERSION и добавь шаг `if (oldVersion < N)` в upgrade().
 * Шаги идут по порядку от старой версии к новой. Старые шаги не удаляются.
 */
export const DB_NAME = 'training-pwa';
export const DB_VERSION = 5;

/** Снимок данных перед восстановлением из копии — для «Отменить восстановление» */
export interface RestoreSnapshot {
  takenAt: string;
  profile: Profile | null;
  plan: Plan | null;
  settings: Settings | null;
  active: Session | null;
  sessions: Session[];
}

type KvKey = 'profile' | 'plan' | 'settings' | 'activeSession' | 'restoreSnapshot';

/**
 * Локальная точка восстановления: полные данные приложения на момент перед рискованной операцией.
 * Хранится в этом же IndexedDB — защищает от ошибок импорта и обновления, но не от потери или
 * очистки устройства (для этого — внешняя копия-файл). Не больше MAX_RESTORE_POINTS, старые удаляются.
 */
export type RestoreReason = 'upgrade' | 'import' | 'restore';
export interface RestorePoint {
  id: string;
  takenAt: string;
  reason: RestoreReason;
  /** Версия схемы IndexedDB, в которой сняты данные (при восстановлении — миграция до текущей) */
  dbVersion: number;
  data: FullData;
}
export const MAX_RESTORE_POINTS = 3;

interface TrainingDB extends DBSchema {
  sessions: {
    key: string;
    value: Session;
    indexes: { 'by-started': string; 'by-day': string };
  };
  kv: { key: KvKey; value: unknown };
  restorePoints: { key: string; value: RestorePoint };
}

let dbp: Promise<IDBPDatabase<TrainingDB>> | null = null;

export function db(): Promise<IDBPDatabase<TrainingDB>> {
  dbp ??= openDB<TrainingDB>(DB_NAME, DB_VERSION, {
    async upgrade(database, oldVersion, _newVersion, tx) {
      const names = database.objectStoreNames as unknown as DOMStringList;
      if (!names.contains('kv')) database.createObjectStore('kv');
      if (!names.contains('sessions')) {
        const s = database.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('by-started', 'startedAt');
        s.createIndex('by-day', 'dayId');
      }
      if (!names.contains('restorePoints')) database.createObjectStore('restorePoints', { keyPath: 'id' });
      if (oldVersion < 1) return; // новая установка

      // Перед любым обновлением схемы — точка восстановления с данными ДО миграции (v2+)
      if (oldVersion >= 2) {
        const kv = tx.objectStore('kv');
        const data: FullData = {
          profile: ((await kv.get('profile')) as Profile | undefined) ?? null,
          plan: ((await kv.get('plan')) as Plan | undefined) ?? null,
          settings: ((await kv.get('settings')) as Settings | undefined) ?? null,
          active: ((await kv.get('activeSession')) as Session | undefined) ?? null,
          sessions: await tx.objectStore('sessions').getAll(),
        };
        const points = tx.objectStore('restorePoints');
        // снимок «Отменить восстановление» прежних версий тоже становится точкой
        const undo = (await kv.get('restoreSnapshot')) as RestoreSnapshot | undefined;
        if (undo && oldVersion < 5) {
          const { takenAt, ...rest } = undo;
          await points.put({ id: 'p-' + Date.parse(takenAt), takenAt, reason: 'import', dbVersion: oldVersion, data: rest });
        }
        const now = new Date().toISOString();
        await points.put({ id: 'p-' + Date.now(), takenAt: now, reason: 'upgrade', dbVersion: oldVersion, data });
        const all = (await points.getAll()).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
        for (const old of all.slice(0, Math.max(0, all.length - MAX_RESTORE_POINTS))) await points.delete(old.id);
      }

      if (oldVersion < 3) {
        // v2 → v3: новые поля настроек и профиля; остатки v1 больше не нужны
        if (names.contains('workouts')) database.deleteObjectStore('workouts' as never);
        const kv = tx.objectStore('kv');
        const s = await kv.get('settings');
        if (s !== undefined) await kv.put(migrateSettingsV2(s), 'settings');
        const p = migrateProfileV2(await kv.get('profile'));
        if (p) await kv.put(p, 'profile');
        for (const k of ['legacyPrefs', 'activeWorkout'] as unknown as KvKey[]) await kv.delete(k);
      }

      if (oldVersion < 4) {
        // v3 → v4: удалённые темы → новые; настроек нет (тему не выбирали) — останется «Авто»
        const kv = tx.objectStore('kv');
        const s = await kv.get('settings');
        if (s !== undefined) await kv.put(migrateSettingsV3(s), 'settings');
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

/**
 * Любое изменение данных (профиль, план, тренировки) делает откат восстановления невозможным:
 * снимок удаляется, а интерфейс узнаёт об этом через onDataChange.
 */
let dataChanged: () => void = () => undefined;
export const onDataChange = (fn: () => void) => (dataChanged = fn);
async function touched(): Promise<void> {
  dataChanged();
  await (await db()).delete('kv', 'restoreSnapshot');
}

export const getProfile = () => kvGet<Profile>('profile');
export const saveProfile = async (p: Profile) => {
  await kvPut('profile', p);
  await touched();
};
export const getPlan = () => kvGet<Plan>('plan');
export const savePlan = async (p: Plan) => {
  await kvPut('plan', p);
  await touched();
};
export const getSettings = () => kvGet<Settings>('settings');
export const saveSettings = (s: Settings) => kvPut('settings', s);
export const getActive = () => kvGet<Session>('activeSession');
export const saveActive = async (s: Session | null) => {
  await kvPut('activeSession', s);
  await touched();
};
export const getRestoreSnapshot = () => kvGet<RestoreSnapshot>('restoreSnapshot');
export const dropRestoreSnapshot = () => kvPut('restoreSnapshot', null);

/** Завершённые тренировки, новые первыми */
export async function listSessions(): Promise<Session[]> {
  const all = await (await db()).getAllFromIndex('sessions', 'by-started');
  return all.reverse();
}

export async function deleteSession(id: string): Promise<void> {
  await (await db()).delete('sessions', id);
  await touched();
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
  await touched();
}

export interface FullData {
  profile: Profile | null;
  plan: Plan | null;
  settings: Settings | null;
  active: Session | null;
  sessions: Session[];
}

/**
 * Заменяет все данные одной транзакцией (всё или ничего).
 * snapshot — снимок прежних данных для отката; null — удалить снимок.
 */
export async function replaceAll(data: FullData, snapshot: RestoreSnapshot | null): Promise<void> {
  const d = await db();
  const tx = d.transaction(['sessions', 'kv'], 'readwrite');
  const ss = tx.objectStore('sessions');
  const kv = tx.objectStore('kv');
  await ss.clear();
  for (const s of data.sessions) await ss.put(s);
  const put = (k: KvKey, v: unknown) => (v == null ? kv.delete(k) : kv.put(v, k));
  await put('profile', data.profile);
  await put('plan', data.plan);
  await put('settings', data.settings);
  await put('activeSession', data.active);
  await put('restoreSnapshot', snapshot);
  await tx.done;
}

export async function readAll(): Promise<FullData> {
  const [profile, plan, settings, active, sessions] = await Promise.all([
    getProfile(),
    getPlan(),
    getSettings(),
    getActive(),
    listSessions(),
  ]);
  return { profile, plan, settings, active, sessions };
}

/** Полный сброс: журнал, профиль, план, настройки и локальные точки восстановления — удаляется всё */
export async function clearAll(): Promise<void> {
  const d = await db();
  const tx = d.transaction(['sessions', 'kv', 'restorePoints'], 'readwrite');
  await Promise.all([
    tx.objectStore('sessions').clear(),
    tx.objectStore('kv').clear(),
    tx.objectStore('restorePoints').clear(),
    tx.done,
  ]);
}

// ---------- локальные точки восстановления ----------

/** Точки, новые первыми */
export async function listRestorePoints(): Promise<RestorePoint[]> {
  const all = await (await db()).getAll('restorePoints');
  return all.sort((a, b) => b.takenAt.localeCompare(a.takenAt));
}

export const getRestorePoint = async (id: string): Promise<RestorePoint | null> =>
  (await (await db()).get('restorePoints', id)) ?? null;

/** Сохраняет текущие данные точкой восстановления; самые старые сверх трёх удаляются */
export async function addRestorePoint(reason: RestoreReason, data?: FullData): Promise<void> {
  const snap = data ?? (await readAll());
  const d = await db();
  const tx = d.transaction('restorePoints', 'readwrite');
  const st = tx.objectStore('restorePoints');
  const takenAt = new Date().toISOString();
  await st.put({ id: 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), takenAt, reason, dbVersion: DB_VERSION, data: snap });
  const all = (await st.getAll()).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  for (const old of all.slice(0, Math.max(0, all.length - MAX_RESTORE_POINTS))) await st.delete(old.id);
  await tx.done;
}

/** Данные точки, снятой в старой схеме, — к текущей (те же шаги, что в upgrade()) */
export function upgradePointData(p: RestorePoint): FullData {
  const d = structuredClone(p.data);
  if (p.dbVersion < 3) {
    if (d.settings) d.settings = migrateSettingsV2(d.settings) as Settings;
    d.profile = (migrateProfileV2(d.profile) as Profile | null) ?? d.profile;
  }
  if (p.dbVersion < 4 && d.settings) d.settings = migrateSettingsV3(d.settings) as Settings;
  return d;
}
