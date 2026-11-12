import data from './themes.json';
import { THEMES, type ThemeId } from '../types';

/** Метаданные тем для выбора в настройках и мета-тега theme-color (цвета — themes.json) */
interface ThemeData {
  scheme: 'light' | 'dark';
  bg: string;
  card: string;
  ink: string;
  days: { c: string; fill: string; fill2?: string }[];
}
const T = (data as unknown as { themes: Record<string, ThemeData> }).themes;

export const THEME_OPTIONS: ThemeId[] = ['auto', ...THEMES];

/** Тема, которая сейчас на экране (для «Авто» — по системной теме) */
export const resolveTheme = (id: ThemeId, systemDark: boolean): Exclude<ThemeId, 'auto'> =>
  id === 'auto' ? (systemDark ? 'classic-dark' : 'classic-light') : id;

export const themeData = (id: Exclude<ThemeId, 'auto'>): ThemeData => T[id] ?? T['classic-orange']!;

/** Цвет системных панелей (theme-color) — фон темы */
export const themeColor = (id: Exclude<ThemeId, 'auto'>): string => themeData(id).bg;
