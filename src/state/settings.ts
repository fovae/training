import { computed, effect, signal } from '@preact/signals';
import * as store from '../db';
import { saveBoot } from '../i18n';
import { compact } from '../lib/format';
import { migrateTheme } from '../db/migrations';
import { DEFAULT_SETTINGS, type Profile, type Settings } from '../types';

// ---------- настройки ----------

export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const num = (v: unknown, d: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(600, Math.max(15, Math.round(v))) : d;
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const iso = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
  const tips: Settings['tipState'] = {};
  if (r.tipState && typeof r.tipState === 'object') {
    for (const [k, v] of Object.entries(r.tipState as Record<string, unknown>)) {
      const d = (v as { dismissedAt?: unknown } | null)?.dismissedAt;
      if (k.length <= 120 && iso(d)) tips[k] = { dismissedAt: d as string };
    }
  }
  const out: Settings = {
    theme: migrateTheme(r.theme),
    motion: r.motion === 'on' || r.motion === 'off' ? r.motion : 'system',
    tipsEnabled: bool(r.tipsEnabled, DEFAULT_SETTINGS.tipsEnabled),
    restBaseSec: num(r.restBaseSec, DEFAULT_SETTINGS.restBaseSec),
    restIsoSec: num(r.restIsoSec, DEFAULT_SETTINGS.restIsoSec),
    sound: bool(r.sound, DEFAULT_SETTINGS.sound),
    wakeLock: bool(r.wakeLock, DEFAULT_SETTINGS.wakeLock),
    tipState: tips,
    weightWarningIgnored: Array.isArray(r.weightWarningIgnored)
      ? [
          ...new Set(
            r.weightWarningIgnored.filter((x): x is string => typeof x === 'string' && x.length <= 100),
          ),
        ]
      : [],
  };
  if (iso(r.lastBackupAt)) out.lastBackupAt = r.lastBackupAt as string;
  if (iso(r.backupReminderDismissedAt)) out.backupReminderDismissedAt = r.backupReminderDismissedAt as string;
  return out;
}

export const settings = signal<Settings>({ ...DEFAULT_SETTINGS });
let settingsLoaded = false;
/** Настройки прочитаны из базы. До этого тему держит загрузочный скрипт index.html (tp-boot). */
export const settingsReady = signal(false);

export function updateSettings(patch: Partial<Settings>): void {
  settings.value = { ...settings.value, ...patch };
}

effect(() => {
  const s = settings.value;
  if (!settingsLoaded) return;
  saveBoot({ theme: s.theme, motion: s.motion });
  void store.saveSettings(s).catch((e) => console.error('[settings] save failed', e));
});

// ---------- профиль ----------

export const profile = signal<Profile | null>(null);

/** Единицы до появления профиля (онбординг) */
export const draftUnits = signal<Profile['units']>('metric');
export const units = computed(() => profile.value?.units ?? draftUnits.value);

export async function saveProfile(p: Profile): Promise<void> {
  profile.value = p;
  await store.saveProfile(p);
}

export function updateProfile(patch: Partial<Profile>): void {
  const cur = profile.value;
  if (!cur) return;
  const next = compact({ ...cur, ...patch });
  void saveProfile(next).catch((e) => console.error('[profile] save failed', e));
}

export async function loadSettingsAndProfile(): Promise<void> {
  const [s, p] = await Promise.all([store.getSettings(), store.getProfile()]);
  settings.value = sanitizeSettings(s);
  profile.value = p;
  settingsLoaded = true;
  settingsReady.value = true;
}
