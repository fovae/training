import { expect, test } from '@playwright/test';
import { DB, kv } from './helpers';

/**
 * 0.1.0 — публичный релиз: данные тестовых версий не переносятся (решение владельца).
 * index.html очищает localStorage без метки эпохи tp-epoch, src/db удаляет прежнюю базу training-pwa.
 */
test('test-version data is wiped on the first start of 0.1.0: old DB deleted, storage cleared', async ({
  page,
}) => {
  await page.goto('./');
  await page.locator('#boot').waitFor({ state: 'detached' });
  // состояние телефона с тестовой версией: прежняя база с профилем и планом, зеркало настроек
  await page.evaluate(async () => {
    localStorage.removeItem('tp-epoch');
    localStorage.setItem('tp-boot', JSON.stringify({ theme: 'classic-dark', locale: 'ru' }));
    localStorage.setItem('tp-install-skip', new Date().toISOString());
    await new Promise<void>((res, rej) => {
      const r = indexedDB.open('training-pwa', 5);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('kv');
        r.result.createObjectStore('sessions', { keyPath: 'id' });
      };
      r.onerror = () => rej(r.error);
      r.onsuccess = () => {
        const tx = r.result.transaction('kv', 'readwrite');
        tx.objectStore('kv').put({ weightKg: 80, heightCm: 180 }, 'profile');
        tx.oncomplete = () => {
          r.result.close();
          res();
        };
      };
    });
  });
  await page.reload();
  // с нуля: тема «Авто», язык не русский, экран установки (пропуск тоже стёрт)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'auto');
  expect(await page.evaluate(() => localStorage.getItem('tp-epoch'))).toBe('1');
  expect(await page.evaluate(() => localStorage.getItem('tp-install-skip'))).toBeNull();
  await expect
    .poll(() => page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name)))
    .not.toContain('training-pwa');
  expect(await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))).toContain(DB);
  expect(await kv(page, 'profile')).toBeNull();
  // второй запуск ничего не стирает: метка уже стоит
  await page.evaluate(() => localStorage.setItem('tp-install-skip', new Date().toISOString()));
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('tp-install-skip'))).not.toBeNull();
});
