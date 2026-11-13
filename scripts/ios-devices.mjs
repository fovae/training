// Портретные разрешения экранов iPhone 11 – iPhone 18 Pro Max.
// Пиксели сверены с официальными спецификациями Apple (support.apple.com / apple.com/*/specs),
// CSS-размеры = пиксели / devicePixelRatio. Используются и генератором splash-экранов,
// и плагином, который вставляет <link rel="apple-touch-startup-image"> в index.html.
//
// Неизвестные размеры (новые модели, складной iPhone и т.п.) получают фолбэк:
// iOS показывает background_color из манифеста, а приложение рисует свой лёгкий
// стартовый экран (#boot в index.html) того же цвета.

/** @type {{ w: number; h: number; dpr: number; models: string }[]} */
export const IOS_DEVICES = [
  { w: 414, h: 896, dpr: 2, models: 'iPhone 11, XR' },
  { w: 375, h: 812, dpr: 3, models: 'iPhone 11 Pro, 12 mini, 13 mini' },
  { w: 414, h: 896, dpr: 3, models: 'iPhone 11 Pro Max' },
  { w: 390, h: 844, dpr: 3, models: 'iPhone 12, 12 Pro, 13, 13 Pro, 14, 16e, 17e' },
  { w: 428, h: 926, dpr: 3, models: 'iPhone 12 Pro Max, 13 Pro Max, 14 Plus' },
  { w: 393, h: 852, dpr: 3, models: 'iPhone 14 Pro, 15, 15 Pro, 16' },
  { w: 430, h: 932, dpr: 3, models: 'iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus' },
  { w: 402, h: 874, dpr: 3, models: 'iPhone 16 Pro, 17, 17 Pro, 18 Pro' },
  { w: 420, h: 912, dpr: 3, models: 'iPhone Air' },
  { w: 440, h: 956, dpr: 3, models: 'iPhone 16 Pro Max, 17 Pro Max, 18 Pro Max' },
];

export const splashName = (d, theme) => `splash-${d.w * d.dpr}x${d.h * d.dpr}-${theme}.png`;

export const splashMedia = (d, theme) =>
  `(device-width: ${d.w}px) and (device-height: ${d.h}px) and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: portrait) and (prefers-color-scheme: ${theme})`;

/** Фон заставок и манифеста — фон темы по умолчанию («Авто»: Classic Light / Classic Dark) */
export const BRAND = {
  light: { bg: '#F6F6F7' },
  dark: { bg: '#111114' },
};
