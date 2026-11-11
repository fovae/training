import { expect, test } from '@playwright/test';
import { fresh, onboard } from './helpers';

test('works offline after the first visit (incl. language packs and font)', async ({ page, context }) => {
  await fresh(page);
  await onboard(page, { lang: 'ru' });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Начать тренировку' })).toBeVisible();
  await page.getByRole('link', { name: 'Упражнения' }).click();
  await expect(page.locator('.lib-card .pic svg').first()).toBeVisible();
  // Другой язык тоже из кэша
  await page.getByRole('link', { name: 'Настройки' }).click();
  await page.getByLabel('Язык').selectOption('en');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  const fontOk = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('16px "Manrope Variable"', 'Тест Test');
  });
  expect(fontOk).toBe(true);
  await context.setOffline(false);
});
