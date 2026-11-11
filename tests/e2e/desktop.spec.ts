import { expect, test } from '@playwright/test';
import { fresh, onboard } from './helpers';

test('desktop: side navigation, columns, keyboard', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  await page.goto('./#/plan');
  const nav = page.getByRole('navigation', { name: 'Sections' });
  const box = await nav.boundingBox();
  expect(box?.height).toBeGreaterThan(500);
  expect(box?.width).toBeLessThan(300);

  // Стрелки меняют день
  await page.locator('body').click({ position: { x: 600, y: 5 } });
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Day 2/ })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: /Day 1/ })).toHaveAttribute('aria-selected', 'true');

  // Упражнения минимум в 2 колонки
  await page.getByRole('link', { name: 'Today' }).click();
  await page.waitForSelector('.ex-grid .ex');
  const cols = await page.$eval(
    '.ex-grid',
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
  );
  expect(cols).toBeGreaterThanOrEqual(2);

  // Пробел во время тренировки запускает и ставит на паузу таймер
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.locator('h1').first().click();
  await page.keyboard.press('Space');
  await expect(page.getByRole('region', { name: 'Rest timer' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Resume rest' })).toBeVisible();
});
