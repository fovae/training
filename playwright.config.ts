import { defineConfig, devices } from '@playwright/test';

/**
 * E2E на эмуляции iPhone (WebKit — движок Safari) и Pixel (Chromium).
 * locale ru-RU специально: приложение не должно подставлять язык телефона.
 * Новее iPhone 17 Pro Max пресетов в Playwright пока нет — у iPhone 18 Pro Max тот же экран 440×956.
 * Тесты гоняются на production-сборке (vite preview), чтобы работал service worker.
 */
const iphones = ['iPhone 11', 'iPhone 13', 'iPhone 15 Pro Max', 'iPhone 17 Pro Max'] as const;

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
    ...iphones.map((name) => ({
      name,
      testIgnore: /(offline|desktop)\.spec\.ts/,
      use: { ...devices[name], browserName: 'webkit' as const },
    })),
    {
      // Android: Chromium с эмуляцией Pixel
      name: 'Pixel 7',
      testIgnore: /(offline|desktop|a11y)\.spec\.ts/,
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
