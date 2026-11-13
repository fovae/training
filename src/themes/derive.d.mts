export interface ThemeDay {
  c: string;
  fill: string;
  fill2?: string;
  ink: string;
}
export interface ThemeRecipe {
  bg: string;
  accent1: string;
  accent2: string;
  surface: string;
}
export interface ThemeDef {
  scheme: 'light' | 'dark';
  recipe?: ThemeRecipe;
  bg: string;
  card: string;
  soft: string;
  line: string;
  ink: string;
  muted: string;
  danger: string;
  dangerFill: string;
  chart: string[];
  /** Градиент главной карточки для всех дней (темы по рецепту) */
  grad?: [string, string];
  /** Текст на заливках дней и градиенте */
  onFill: string;
  /** Кнопка на цветной карточке: фон и текст */
  cardBtn: string;
  cardBtnInk: string;
  days: ThemeDay[];
}
export declare function mix(a: string, b: string, p: number): string;
export declare function lum(h: string): number;
export declare function contrast(a: string, b: string): number;
export declare function liftInk(c: string, surfaces: string[], min?: number): string;
export declare function fromRecipe(r: ThemeRecipe): ThemeDef;
export declare function resolveThemes(json: unknown): Record<string, ThemeDef>;
export declare function headGradient(t: ThemeDef, day: number): [string, string];
export interface ThemePreview {
  bg: string;
  card: string;
  ink: string;
  head: [string, string];
  acc: [string, string];
}
export declare function previewOf(t: ThemeDef): ThemePreview;
