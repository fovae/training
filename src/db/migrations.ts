import { DEFAULT_SETTINGS, THEMES, type Profile, type Settings, type ThemeId } from '../types';

/**
 * Чистые функции миграции данных по версиям схемы. Используются в upgrade() IndexedDB
 * и при восстановлении копии старой версии. Старые шаги не удаляются (кроме v1 — данные v1
 * владелец переносит вручную, поддержка снята на этапе 2).
 *
 *  v2 — этап 1: Settings.theme 'system' | 'light' | 'dark', у профиля нет legalAccepted.
 *  v3 — этап 2: 10 тем + 'auto', tipState, weightWarningIgnored, напоминание о копии,
 *       Profile.legalAccepted.
 */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Тема v2 → v3. Светлая v2 — это классическая оранжевая, тёмная — классическая тёмная. */
export function migrateThemeV2(theme: unknown): ThemeId {
  if (theme === 'light') return 'classic-orange';
  if (theme === 'dark') return 'classic-dark';
  if (theme === 'system') return 'auto';
  return (THEMES as readonly string[]).includes(theme as string) || theme === 'auto'
    ? (theme as ThemeId)
    : DEFAULT_SETTINGS.theme;
}

export function migrateSettingsV2(raw: unknown): Settings {
  const r = isObj(raw) ? raw : {};
  return {
    ...DEFAULT_SETTINGS,
    ...(r as Partial<Settings>),
    theme: migrateThemeV2(r.theme),
    tipState: isObj(r.tipState) ? (r.tipState as Settings['tipState']) : {},
    weightWarningIgnored: Array.isArray(r.weightWarningIgnored)
      ? (r.weightWarningIgnored as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
  };
}

/** Профиль v2 → v3: документы ещё не приняты — приложение попросит принять при запуске */
export function migrateProfileV2(raw: unknown): Profile | null {
  if (!isObj(raw)) return null;
  const p = raw as unknown as Profile;
  return { ...p, legalAccepted: isObj(raw.legalAccepted) ? p.legalAccepted : null };
}
