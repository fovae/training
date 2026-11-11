import { computed, effect, signal } from '@preact/signals';
import * as store from '../db';
import { saveBoot } from '../i18n';
import { compact } from '../lib/format';
import { DEFAULT_SETTINGS, type Profile, type Settings } from '../types';

// ---------- настройки ----------

export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const num = (v: unknown, d: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(600, Math.max(15, Math.round(v))) : d;
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const out: Settings = {
    theme: r.theme === 'light' || r.theme === 'dark' ? r.theme : 'system',
    tipsEnabled: bool(r.tipsEnabled, DEFAULT_SETTINGS.tipsEnabled),
    restBaseSec: num(r.restBaseSec, DEFAULT_SETTINGS.restBaseSec),
    restIsoSec: num(r.restIsoSec, DEFAULT_SETTINGS.restIsoSec),
    sound: bool(r.sound, DEFAULT_SETTINGS.sound),
    wakeLock: bool(r.wakeLock, DEFAULT_SETTINGS.wakeLock),
  };
  if (typeof r.lastBackupAt === 'string') out.lastBackupAt = r.lastBackupAt;
  return out;
}

export const settings = signal<Settings>({ ...DEFAULT_SETTINGS });
let settingsLoaded = false;

export function updateSettings(patch: Partial<Settings>): void {
  settings.value = { ...settings.value, ...patch };
}

effect(() => {
  const s = settings.value;
  if (!settingsLoaded) return;
  saveBoot({ theme: s.theme });
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
}

// ---------- маленькие флаги UI (localStorage) ----------

export const flags = {
  get(name: string): boolean {
    try {
      return localStorage.getItem('tp-flag-' + name) === '1';
    } catch {
      return false;
    }
  },
  set(name: string, v = true): void {
    try {
      if (v) localStorage.setItem('tp-flag-' + name, '1');
      else localStorage.removeItem('tp-flag-' + name);
    } catch {
      /* ignore */
    }
  },
};
