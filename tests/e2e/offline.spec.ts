import { expect, test } from '@playwright/test';

test('после первого открытия работает офлайн', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Начать тренировку' })).toBeVisible();
  // Ждём, пока service worker установится и возьмёт страницу под контроль
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Начать тренировку' })).toBeVisible();
  await page.getByRole('link', { name: 'Программа' }).click();
  await expect(page.locator('article.ex .pic svg').first()).toBeVisible();
  // Шрифт Manrope из кэша
  const fontOk = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('16px "Manrope Variable"', 'Тест');
  });
  expect(fontOk).toBe(true);

  // Демонстрация без сети — понятное сообщение
  await page.getByRole('tab', { name: /День 1/ }).click();
  await page
    .getByRole('link', { name: /Демонстрация техники/ })
    .first()
    .click();
  await expect(page.getByText('Нет интернета')).toBeVisible();
  await context.setOffline(false);
});
