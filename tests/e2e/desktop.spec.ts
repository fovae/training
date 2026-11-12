import { expect, test } from '@playwright/test';
import { fresh, onboard } from './helpers';

test('desktop: no install gate; install row in About when the browser offers it', async ({ page }) => {
  await fresh(page, { gate: true });
  await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Install Simple Training' })).toHaveCount(0);
  await onboard(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const about = page.locator('.about');
  await expect(about.getByRole('button', { name: 'Install app' })).toHaveCount(0);
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    e.prompt = async () => undefined;
    e.userChoice = Promise.resolve({ outcome: 'dismissed' });
    dispatchEvent(e);
  });
  await expect(about.getByRole('button', { name: 'Install app' })).toBeVisible();
});

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
