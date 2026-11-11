import { effect, signal } from '@preact/signals';

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  units: 'kg' | 'lb';
  /** Отдых в базовых упражнениях, сек (программа: 2–3 мин) */
  restBase: number;
  /** Отдых в изоляции, сек (программа: 60–120 с) */
  restIso: number;
  sound: boolean;
  wakeLock: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  units: 'kg',
  restBase: 150,
  restIso: 90,
  sound: true,
  wakeLock: true,
};

const KEY = 'tp-settings';

function load(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    return sanitize(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function sanitize(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const num = (v: unknown, d: number, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d;
  return {
    theme: r.theme === 'light' || r.theme === 'dark' ? r.theme : 'system',
    units: r.units === 'lb' ? 'lb' : 'kg',
    restBase: num(r.restBase, DEFAULT_SETTINGS.restBase, 15, 600),
    restIso: num(r.restIso, DEFAULT_SETTINGS.restIso, 15, 600),
    sound: typeof r.sound === 'boolean' ? r.sound : DEFAULT_SETTINGS.sound,
    wakeLock: typeof r.wakeLock === 'boolean' ? r.wakeLock : DEFAULT_SETTINGS.wakeLock,
  };
}

export const settings = signal<Settings>(load());

export function updateSettings(patch: Partial<Settings>): void {
  settings.value = { ...settings.value, ...patch };
}

effect(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings.value));
  } catch {
    /* приватный режим — настройки живут до перезапуска */
  }
});

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
