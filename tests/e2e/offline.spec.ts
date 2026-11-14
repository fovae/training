import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { fresh, onboard, choose } from './helpers';

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
  await choose(page.getByLabel('Язык'), 'en');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  const fontOk = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('16px "Manrope Variable"', 'Тест Test');
  });
  expect(fontOk).toBe(true);
  await context.setOffline(false);
});

test('update: installed old version gets "Update available", never during a workout', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // Идёт тренировка
  await page.getByRole('button', { name: 'Start workout' }).click();

  // «Новая версия» на сервере: другой sw.js в dist, как после деплоя (и сразу вернуть как было)
  const swPath = new URL('../../dist/sw.js', import.meta.url);
  const original = readFileSync(swPath, 'utf8');
  try {
    writeFileSync(swPath, original + '\n// next version\n');
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
    });
    await expect
      .poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting))
      .toBe(true);
  } finally {
    writeFileSync(swPath, original);
  }
  // Во время тренировки плашки нет
  await page.waitForTimeout(500);
  await expect(page.getByText('An update is available')).toHaveCount(0);

  // Завершили — плашка появилась, «Update» перезагружает на новую версию
  await page.getByLabel('Incline dumbbell press, set 1: reps').fill('10');
  await page.getByRole('button', { name: 'Incline dumbbell press, set 1: done' }).click();
  await page.getByRole('button', { name: 'Skip rest' }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Finish' }).click();
  const toast = page.getByRole('status').filter({ hasText: 'An update is available' });
  await expect(toast).toBeVisible();
  await Promise.all([page.waitForEvent('load'), toast.getByRole('button', { name: 'Update' }).click()]);
  await expect(page.getByRole('heading', { name: 'Back + biceps + forearms' })).toBeVisible();
  expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(
    false,
  );
  // Данные на месте
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByRole('link', { name: /Chest \+ triceps/ })).toBeVisible();
});
