import { expect, test } from '@playwright/test';
import { detectBrowser, detectPlatform, isStandaloneEnv, safariVersion } from '../../src/lib/platform';

const UA = {
  iphoneSafari26:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  iphoneSafari17:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1',
  iphoneFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/144.0 Mobile/15E148 Safari/605.1.15',
  iphoneEdge:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 EdgiOS/141.0.3537.71 Mobile/15E148 Safari/605.1.15',
  iphoneInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0.0.0 (iPhone16,2; iOS 18_6; en_US)',
  iphoneFacebook:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/520.0.0.0;FBBV/1;FBDV/iPhone16,2;FBMD/iPhone;FBSN/iOS;FBSV/18.6]',
  iphoneTelegram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/12.0',
  iphoneTikTok:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_41.0.0 JsSdk/2.0 BytedanceWebview/d8a21c6',
  iphoneLine:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/15.0.0',
  iphoneWebView:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  ipadSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 15; SM-S931B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  androidEdge:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36 EdgA/142.0.0.0',
  androidFirefox: 'Mozilla/5.0 (Android 15; Mobile; rv:144.0) Gecko/144.0 Firefox/144.0',
  androidWebView:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.0.0 Mobile Safari/537.36',
  androidInstagram:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.0.0 Mobile Safari/537.36 Instagram 400.0.0.0.0 Android',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  winChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  winEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
};

test('platform', () => {
  for (const k of ['iphoneSafari26', 'iphoneChrome', 'iphoneInstagram', 'iphoneWebView'] as const)
    expect(detectPlatform({ ua: UA[k] }), k).toBe('ios');
  // iPadOS выдаёт себя за Mac — отличаем по сенсорному экрану
  expect(detectPlatform({ ua: UA.ipadSafari, platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios');
  expect(detectPlatform({ ua: UA.macSafari, platform: 'MacIntel', maxTouchPoints: 0 })).toBe('desktop');
  for (const k of ['androidChrome', 'androidSamsung', 'androidFirefox', 'androidWebView'] as const)
    expect(detectPlatform({ ua: UA[k] }), k).toBe('android');
  for (const k of ['winChrome', 'winEdge'] as const) expect(detectPlatform({ ua: UA[k] }), k).toBe('desktop');
});

test('browser', () => {
  const cases: [keyof typeof UA, string][] = [
    ['iphoneSafari26', 'safari'],
    ['iphoneSafari17', 'safari'],
    ['iphoneChrome', 'chrome'],
    ['iphoneFirefox', 'firefox'],
    ['iphoneEdge', 'edge'],
    ['iphoneInstagram', 'in-app'],
    ['iphoneFacebook', 'in-app'],
    ['iphoneTelegram', 'in-app'],
    ['iphoneTikTok', 'in-app'],
    ['iphoneLine', 'in-app'],
    ['iphoneWebView', 'in-app'],
    ['androidChrome', 'chrome'],
    ['androidSamsung', 'samsung'],
    ['androidEdge', 'edge'],
    ['androidFirefox', 'firefox'],
    ['androidWebView', 'in-app'],
    ['androidInstagram', 'in-app'],
    ['winChrome', 'chrome'],
    ['winEdge', 'edge'],
  ];
  for (const [k, want] of cases) expect(detectBrowser(UA[k]), k).toBe(want);
});

test('safari version (iOS 26 freezes OS version in UA)', () => {
  expect(safariVersion(UA.iphoneSafari26)).toBe(26);
  expect(safariVersion(UA.iphoneSafari17)).toBe(17);
  expect(safariVersion(UA.iphoneChrome)).toBeNull();
  expect(safariVersion(UA.iphoneEdge)).toBeNull();
  expect(safariVersion(UA.iphoneInstagram)).toBeNull();
});

test('standalone detection', () => {
  const mm = (on: string[]) => (q: string) => ({ matches: on.some((m) => q.includes(m)) });
  expect(isStandaloneEnv({ matchMedia: mm([]) })).toBe(false);
  expect(isStandaloneEnv({ matchMedia: mm([]), navigatorStandalone: true })).toBe(true);
  for (const m of ['standalone', 'fullscreen', 'minimal-ui'])
    expect(isStandaloneEnv({ matchMedia: mm([m]) }), m).toBe(true);
});
