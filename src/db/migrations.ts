import { DEFAULT_SETTINGS, THEMES, type Profile, type Settings, type ThemeId } from '../types';

/**
 * Чистые функции миграции данных по версиям схемы. Используются в upgrade() IndexedDB
 * и при восстановлении копии старой версии. Старые шаги не удаляются (кроме v1 — данные v1
 * владелец переносит вручную, поддержка снята на этапе 2).
 *
 *  v2 — этап 1: Settings.theme 'system' | 'light' | 'dark', у профиля нет legalAccepted.
 *  v3 — этап 2: 10 тем + 'auto', tipState, weightWarningIgnored, напоминание о копии,
 *       Profile.legalAccepted.
 *  v4 — релиз 3.0: новый набор тем (11 + 'auto'), Settings.motion.
 */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Удалённые и старые темы → текущие (решение владельца, релиз 3.0).
 *  v2: light / dark / system. v3: classic-orange стала «Градиент», прежние цветные и градиентные
 *  темы заменены тёмными темами «по рецепту». ember — промежуточная тема, не дошедшая до релиза.
 * Должно совпадать с картой в загрузочном скрипте index.html (tp-boot) — это проверяет юнит-тест.
 */
export const THEME_MIGRATION: Readonly<Record<string, ThemeId>> = {
  light: 'gradient',
  dark: 'classic-dark',
  system: 'auto',
  'classic-orange': 'gradient',
  'gradient-1': 'gradient',
  ember: 'gradient',
  blue: 'slate-blue',
  violet: 'violet-dusk',
  green: 'pine-dusk',
  rose: 'rose-dusk',
  'gradient-2': 'ocean-night',
};

/**
 * Сохранённая тема → действующая. Действующие темы и «Авто» не меняются; неизвестное значение и
 * отсутствие значения (тему не выбирали) → «Авто», тема по умолчанию.
 */
export function migrateTheme(theme: unknown): ThemeId {
  if (typeof theme === 'string' && Object.hasOwn(THEME_MIGRATION, theme)) return THEME_MIGRATION[theme]!;
  return (THEMES as readonly string[]).includes(theme as string) || theme === 'auto'
    ? (theme as ThemeId)
    : DEFAULT_SETTINGS.theme;
}

export function migrateSettingsV2(raw: unknown): Settings {
  const r = isObj(raw) ? raw : {};
  return {
    ...DEFAULT_SETTINGS,
    ...(r as Partial<Settings>),
    theme: migrateTheme(r.theme),
    tipState: isObj(r.tipState) ? (r.tipState as Settings['tipState']) : {},
    weightWarningIgnored: Array.isArray(r.weightWarningIgnored)
      ? (r.weightWarningIgnored as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
  };
}

/**
 * Настройки v3 → v4 (релиз 3.0): тема переводится по THEME_MIGRATION, появляется «Анимации»
 * («как в системе»). Остальные поля не трогаем.
 */
export function migrateSettingsV3(raw: unknown): Settings {
  const r = isObj(raw) ? raw : {};
  return {
    ...DEFAULT_SETTINGS,
    ...(r as Partial<Settings>),
    theme: migrateTheme(r.theme),
    motion: r.motion === 'on' || r.motion === 'off' ? r.motion : 'system',
  };
}

/** Профиль v2 → v3: документы ещё не приняты — приложение попросит принять при запуске */
export function migrateProfileV2(raw: unknown): Profile | null {
  if (!isObj(raw)) return null;
  const p = raw as unknown as Profile;
  return { ...p, legalAccepted: isObj(raw.legalAccepted) ? p.legalAccepted : null };
}
