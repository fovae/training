import { expect, test } from '@playwright/test';

test('ПК: боковая навигация, колонки, клавиатура', async ({ page }) => {
  await page.goto('./#/program');
  const nav = page.getByRole('navigation', { name: 'Разделы' });
  const box = await nav.boundingBox();
  expect(box?.height).toBeGreaterThan(500); // вертикальная боковая панель
  expect(box?.width).toBeLessThan(300);

  // Упражнения минимум в 2 колонки
  const cols = await page.$eval(
    '.ex-grid',
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
  );
  expect(cols).toBeGreaterThanOrEqual(2);

  // Стрелки меняют день
  await page.locator('body').click({ position: { x: 600, y: 5 } });
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /День 2/ })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: /День 1/ })).toHaveAttribute('aria-selected', 'true');

  // Пробел во время тренировки запускает и ставит на паузу таймер
  await page.getByRole('link', { name: 'Сегодня' }).click();
  await page.getByRole('button', { name: 'Начать тренировку' }).click();
  await page.locator('h1').first().click();
  await page.keyboard.press('Space');
  await expect(page.getByRole('region', { name: 'Таймер отдыха' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Продолжить отдых' })).toBeVisible();
});
