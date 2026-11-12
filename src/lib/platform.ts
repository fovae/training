/**
 * Определение платформы и браузера. Чистые функции без глобалов браузера —
 * тестируются на списке User-Agent (tests/e2e/platform.unit.spec.ts).
 */

export type Platform = 'ios' | 'android' | 'desktop';

export type Browser =
  | 'safari'
  | 'chrome'
  | 'edge'
  | 'firefox'
  | 'samsung'
  /** Встроенный браузер приложения (Instagram, Telegram…) — установка из него невозможна */
  | 'in-app'
  | 'other';

export interface DeviceInfo {
  ua: string;
  /** navigator.platform — только для журнала: на решение не влияет */
  platform?: string;
  maxTouchPoints?: number;
}

const IN_APP =
  /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|Telegram|TikTok|musical_ly|BytedanceWebview|Snapchat|Pinterest|LinkedInApp|Twitter|GSA\/|MicroMessenger|WhatsApp|Gmail|; wv\)/;

/**
 * Строгое правило, проверки строго в таком порядке:
 *  1. в UA есть «Android»                              → Android;
 *  2. иначе в UA есть iPhone|iPad|iPod                  → iOS;
 *  3. иначе в UA есть «Macintosh» и maxTouchPoints > 1 → iOS (iPadOS в режиме «как Mac»);
 *  4. иначе                                             → 'desktop': инструкции установки нет.
 * navigator.platform сам по себе ничего не решает: Android-браузер с «MacIntel» и касанием —
 * всё равно Android.
 */
export function detectPlatform({ ua, maxTouchPoints = 0 }: DeviceInfo): Platform {
  if (/Android/.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Macintosh/.test(ua) && maxTouchPoints > 1) return 'ios';
  return 'desktop';
}

export function detectBrowser(ua: string, p: Platform = detectPlatform({ ua })): Browser {
  if (IN_APP.test(ua)) return 'in-app';
  if (p === 'ios') {
    // Все браузеры iOS на WebKit, различаются меткой
    if (/CriOS/.test(ua)) return 'chrome';
    if (/EdgiOS/.test(ua)) return 'edge';
    if (/FxiOS/.test(ua)) return 'firefox';
    if (/OPiOS|YaBrowser|DuckDuckGo|Brave/.test(ua)) return 'other';
    if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'safari';
    // WKWebView без метки Safari — встроенный браузер
    return 'in-app';
  }
  if (/SamsungBrowser/.test(ua)) return 'samsung';
  if (/EdgA|Edg\//.test(ua)) return 'edge';
  if (/Firefox|FxiOS/.test(ua)) return 'firefox';
  if (/OPR\/|YaBrowser|UCBrowser|MiuiBrowser|HuaweiBrowser/.test(ua)) return 'other';
  if (/Chrome\//.test(ua)) return 'chrome';
  return 'other';
}

/**
 * Версия Safari (= мажорная версия iOS для Safari: «Version/26.0»).
 * С iOS 26 номер iOS в UA заморожен на 18_x, поэтому смотрим на Version/.
 * null — не Safari или версия неизвестна (Chrome на iOS и т. п.).
 */
export function safariVersion(ua: string): number | null {
  const m = /Version\/(\d+)/.exec(ua);
  return m && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua) ? Number(m[1]) : null;
}

export const isMobile = (p: Platform): boolean => p !== 'desktop';

export interface StandaloneEnv {
  matchMedia: (q: string) => { matches: boolean };
  navigatorStandalone?: boolean | undefined;
}

/** Открыто как установленное приложение (с экрана «Домой») */
export function isStandaloneEnv(env: StandaloneEnv): boolean {
  return (
    env.navigatorStandalone === true ||
    ['standalone', 'fullscreen', 'minimal-ui'].some((m) => env.matchMedia(`(display-mode: ${m})`).matches)
  );
}
