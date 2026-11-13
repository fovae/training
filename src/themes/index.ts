import meta from 'virtual:themes-meta';
import { THEMES, type ThemeId } from '../types';

/** Метаданные тем для выбора в настройках и мета-тега theme-color (цвета — themes.json) */
export type ThemeMeta = (typeof meta)[string];

export const THEME_OPTIONS: ThemeId[] = ['auto', ...THEMES];

/** Тема, которая сейчас на экране (для «Авто» — по системной теме) */
export const resolveTheme = (id: ThemeId, systemDark: boolean): Exclude<ThemeId, 'auto'> =>
  id === 'auto' ? (systemDark ? 'classic-dark' : 'classic-light') : id;

export const themeData = (id: Exclude<ThemeId, 'auto'>): ThemeMeta => meta[id] ?? meta['classic-light']!;

/** Цвет системных панелей (theme-color) — фон темы */
export const themeColor = (id: Exclude<ThemeId, 'auto'>): string => themeData(id).bg;
