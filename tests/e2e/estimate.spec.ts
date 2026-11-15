import { expect, test } from '@playwright/test';
import { fresh, onboard } from './helpers';

/** Оценка длительности тренировки: диапазон в шапке дня, расшифровка, «Мой темп» (src/lib/duration.ts) */
test('day estimate: range on Today and Plan, breakdown on tap, "My pace" changes it', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  const est = page.locator('.dayhead .help-txt');
  await expect(est).toHaveText(/^about .+ \(\d+–\d+ min\)$/);
  const before = await est.textContent();

  // расшифровка по нажатию: части в минутах, закрывается Escape
  await est.click();
  const tip = page.locator('.help-tip');
  await expect(tip).toContainText('Estimated duration');
  await expect(tip).toContainText('Rest');
  await expect(tip).toContainText('Moving between exercises');
  await page.keyboard.press('Escape');
  await expect(tip).toHaveCount(0);

  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  await expect(page.locator('.dayhead .help-txt').first()).toHaveText(/^about .+ \(\d+–\d+ min\)$/);

  // «Мой темп: медленнее» — оценка растёт
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('radiogroup', { name: 'My pace' }).getByRole('radio', { name: 'Slower' }).click();
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(est).not.toHaveText(before!);
  const num = (s: string | null) => Number(/\((\d+)–/.exec(s ?? '')?.[1]);
  expect(num(await est.textContent())).toBeGreaterThan(num(before));
  await est.click();
  await expect(page.locator('.help-tip')).toContainText('My pace: Slower');
});
