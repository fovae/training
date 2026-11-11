import { signal } from '@preact/signals';
import * as store from '../db';
import { migrateSettingsV1, migrateWorkoutV1, type V1Settings, type V1Workout } from '../db/migrations';
import { t } from '../i18n';
import type { Plan, Session, SessionEntry, SessionSet, Settings } from '../types';
import { loadSessions } from '../state/session';
import { plan, setPlan } from '../state/plan';
import { profile, sanitizeSettings, settings } from '../state/settings';

/**
 * Экспорт и импорт JSON — как в первой версии, на новой схеме.
 * Полноценный бэкап (кнопка «Сохранить копию», напоминание, SHA-256, строгая схема) — этап 2.
 * Импорт принимает и файлы первой версии (schema 1) — они мигрируются.
 */
export const BACKUP_SCHEMA = 2;

export interface BackupFile {
  app: 'training-pwa';
  schema: number;
  exportedAt: string;
  appVersion: string;
  sessions: Session[];
  active: Session | null;
  plan: Plan | null;
  settings: Settings;
}

export function buildBackup(sessions: Session[], active: Session | null): BackupFile {
  return {
    app: 'training-pwa',
    schema: BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    appVersion: __APP_VERSION__,
    sessions,
    active,
    plan: plan.value,
    settings: settings.value,
  };
}

/** Профиль в файл не кладём: он вводится заново и не нужен для истории */
export async function exportData(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const [sessions, active] = await Promise.all([store.listSessions(), store.getActive()]);
  const json = JSON.stringify(buildBackup(sessions, active), null, 2);
  const name = `training-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (coarse && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: t('backup.shareTitle') });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
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

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const str = (v: unknown, max = 1000): string | undefined =>
  typeof v === 'string' && v.trim() ? v.slice(0, max) : undefined;

function cleanSet(s: unknown): SessionSet | null {
  if (!s || typeof s !== 'object') return null;
  const r = s as Record<string, unknown>;
  const out: SessionSet = { done: r.done === true };
  if (isNum(r.weightKg)) out.weightKg = r.weightKg;
  if (isNum(r.reps)) out.reps = r.reps;
  if (isNum(r.seconds)) out.seconds = r.seconds;
  if (isIso(r.doneAt)) out.doneAt = r.doneAt;
  return out;
}

function cleanSession(v: unknown): Session | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.dayId !== 'string' || !isIso(r.startedAt)) return null;
  if (!Array.isArray(r.entries)) return null;
  const s: Session = {
    id: r.id.slice(0, 100),
    dayId: r.dayId.slice(0, 100),
    startedAt: r.startedAt,
    entries: r.entries.flatMap((e): SessionEntry[] => {
      if (!e || typeof e !== 'object') return [];
      const x = e as Record<string, unknown>;
      if (typeof x.exerciseId !== 'string' || !Array.isArray(x.sets)) return [];
      const entry: SessionEntry = {
        exerciseId: x.exerciseId.slice(0, 100),
        sets: x.sets.map(cleanSet).filter((q): q is SessionSet => q !== null),
      };
      if (x.skipped === true) entry.skipped = true;
      const note = str(x.note);
      if (note) entry.note = note;
      return [entry];
    }),
  };
  if (isIso(r.endedAt)) s.endedAt = r.endedAt;
  const note = str(r.note);
  if (note) s.note = note;
  return s;
}

function cleanPlan(v: unknown): Plan | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (!Array.isArray(r.days) || !r.days.length) return null;
  const days = r.days.slice(0, 7).flatMap((d): Plan['days'] => {
    if (!d || typeof d !== 'object') return [];
    const x = d as Record<string, unknown>;
    if (typeof x.id !== 'string' || !Array.isArray(x.items)) return [];
    const day: Plan['days'][number] = {
      id: x.id.slice(0, 100),
      items: x.items.flatMap((i) => {
        if (!i || typeof i !== 'object') return [];
        const it = i as Record<string, unknown>;
        if (typeof it.exerciseId !== 'string' || !isNum(it.sets) || !isNum(it.repsMin) || !isNum(it.repsMax))
          return [];
        const item: Plan['days'][number]['items'][number] = {
          exerciseId: it.exerciseId.slice(0, 100),
          sets: Math.min(10, Math.max(1, Math.round(it.sets))),
          repsMin: Math.round(it.repsMin),
          repsMax: Math.round(it.repsMax),
        };
        if (isNum(it.targetWeightKg)) item.targetWeightKg = it.targetWeightKg;
        if (isNum(it.restSec)) item.restSec = Math.min(600, Math.round(it.restSec));
        if (it.optional === true) item.optional = true;
        return [item];
      }),
    };
    const label = str(x.label, 40);
    if (label) day.label = label;
    if (typeof x.labelKey === 'string' && /^tpl\.[\w.-]+$/.test(x.labelKey)) day.labelKey = x.labelKey;
    if (isNum(x.weekday) && x.weekday <= 6) day.weekday = Math.round(x.weekday) as 0;
    return [day];
  });
  if (!days.length) return null;
  return { mode: r.mode === 'weekdays' ? 'weekdays' : 'cycle', days };
}

export interface ParsedBackup {
  sessions: Session[];
  active: Session | null;
  plan: Plan | null;
  settings: Settings | null;
  exportedAt: string | null;
}

/** Проверяет и нормализует файл. Бросает Error с понятным текстом. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(t('backup.errNotJson'));
  }
  const r = raw as Record<string, unknown> | null;
  if (!r || r.app !== 'training-pwa') throw new Error(t('backup.errForeign'));
  if (!isNum(r.schema) || r.schema > BACKUP_SCHEMA) throw new Error(t('backup.errNewer'));
  const exportedAt = isIso(r.exportedAt) ? r.exportedAt : null;

  if (r.schema < 2) {
    // Файл первой версии приложения
    if (!Array.isArray(r.workouts)) throw new Error(t('backup.errForeign'));
    const conv = (w: unknown) => {
      if (!w || typeof w !== 'object') return null;
      const x = w as V1Workout;
      if (typeof x.id !== 'string' || typeof x.dayId !== 'string' || !isNum(x.startedAt)) return null;
      return cleanSession(
        migrateWorkoutV1({ ...x, exercises: Array.isArray(x.exercises) ? x.exercises : [] }),
      );
    };
    const sessions = r.workouts.map(conv).filter((s): s is Session => !!s?.endedAt);
    const act = conv(r.active);
    return {
      sessions,
      active: act && !act.endedAt ? act : null,
      plan: null,
      settings: r.settings ? migrateSettingsV1(r.settings as V1Settings) : null,
      exportedAt,
    };
  }

  if (!Array.isArray(r.sessions)) throw new Error(t('backup.errForeign'));
  const sessions = r.sessions.map(cleanSession).filter((s): s is Session => !!s?.endedAt);
  const act = cleanSession(r.active);
  return {
    sessions,
    active: act && !act.endedAt ? act : null,
    plan: cleanPlan(r.plan),
    settings: r.settings ? sanitizeSettings(r.settings) : null,
    exportedAt,
  };
}

export async function applyBackup(b: ParsedBackup): Promise<void> {
  await store.replaceSessions(b.sessions, b.active);
  if (b.plan) await setPlan(b.plan);
  if (b.settings) settings.value = b.settings;
  await loadSessions();
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

/** Сброс: удаляет всё, приложение возвращается к онбордингу */
export async function resetAll(): Promise<void> {
  await store.clearAll();
  profile.value = null;
  plan.value = null;
  await loadSessions();
}
