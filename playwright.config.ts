import { defineConfig, devices } from '@playwright/test';

/**
 * E2E на эмуляции iPhone (WebKit — движок Safari) и Pixel (Chromium).
 * locale ru-RU специально: приложение не должно подставлять язык телефона.
 * iPhone 17 Pro Max (440×956) временно убран из матрицы: тест «Назад» на нём расходится на ~18 px.
 * Тесты гоняются на production-сборке (vite preview), чтобы работал service worker.
 */
const ALL_IPHONES = ['iPhone 11', 'iPhone 13', 'iPhone 15 Pro Max'] as const;
/**
 * На CI по умолчанию — сокращённая матрица (самый маленький и самый большой iPhone).
 * Полная: локально или в CI с FULL_MATRIX=1 (workflow_dispatch → full).
 */
const full = !process.env.CI || process.env.FULL_MATRIX === '1';
const iphones = full ? ALL_IPHONES : (['iPhone 11', 'iPhone 15 Pro Max'] as const);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // WebKit на CI-раннере в разы медленнее локального — длинным сценариям нужен запас
  timeout: process.env.CI ? 90_000 : 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'retain-on-failure',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
  },
  projects: [
    {
      // Чистые функции без браузера (src/lib/platform.ts и т. п.)
      name: 'unit',
      testMatch: /\.unit\.spec\.ts/,
    },
    ...iphones.map((name) => ({
      name,
      testIgnore: /(offline|desktop|\.unit)\.spec\.ts/,
      use: { ...devices[name], browserName: 'webkit' as const },
    })),
    {
      // Android: Chromium с эмуляцией Pixel
      name: 'Pixel 7',
      testIgnore: /(offline|desktop|a11y|\.unit)\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
    {
      // Service worker + офлайн надёжнее всего проверяются в Chromium; viewport как у iPhone
      name: 'offline-chromium',
      testMatch: /offline\.spec\.ts/,
      use: { ...devices['Pixel 7'], viewport: { width: 402, height: 874 } },
    },
    {
      name: 'desktop',
      testMatch: /desktop\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
