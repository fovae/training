import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fresh, onboard } from './helpers';

test.skip(({ browserName }) => browserName !== 'webkit', 'iPhone projects');

async function axe(page: Page, where: string): Promise<string[]> {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  if (process.env.AXE_DEBUG)
    for (const v of r.violations)
      console.log(where, v.id, v.nodes[0]?.target.join(' '), v.nodes[0]?.any[0]?.message);
  return r.violations.map((v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`accessibility (axe, WCAG AA), theme: ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await fresh(page);
    const issues: string[] = [];
    issues.push(...(await axe(page, 'onboarding')));
    await onboard(page);
    for (const route of [
      '#/today',
      '#/plan',
      '#/library',
      '#/library/lat-pulldown',
      '#/library/back-squat',
      '#/library/hip-flexor-stretch',
      '#/history',
      '#/settings',
      '#/legal/privacy',
    ]) {
      await page.goto('./' + route);
      await page.waitForSelector('main .screen');
      if (route === '#/today') {
        await page.getByRole('button', { name: 'Start workout' }).click();
        await page.locator('.set-done').first().click();
        await page.waitForTimeout(400);
      }
      if (route === '#/plan') await page.locator('.item summary').first().click();
      issues.push(...(await axe(page, route)));
    }
    await page.goto('./#/plan');
    await page.getByRole('button', { name: 'Add exercise' }).click();
    issues.push(...(await axe(page, 'picker')));
    expect(issues).toEqual([]);
  });
}

const THEMES = [
  'auto',
  'classic-light',
  'classic-dark',
  'monochrome',
  'gradient',
  'pine-dusk',
  'ocean-night',
  'violet-dusk',
  'rose-dusk',
  'slate-blue',
  'teal-night',
  'crimson-night',
];

test('accessibility in every theme on key screens', async ({ page }, info) => {
  test.skip(info.project.name !== 'iPhone 11', 'один проект — 12 тем × 7 экранов');
  test.setTimeout(360_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fresh(page);
  await onboard(page);
  // История, чтобы были графики и записи
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.locator('.set-done').first().click();
  await page.getByRole('button', { name: 'Skip rest' }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Finish' }).click();
  const issues: string[] = [];
  for (const th of THEMES) {
    await page.evaluate(
      (theme) =>
        new Promise<void>((res) => {
          const r = indexedDB.open('training-pwa');
          r.onsuccess = () => {
            const kv = r.result.transaction('kv', 'readwrite').objectStore('kv');
            const g = kv.get('settings');
            g.onsuccess = () => {
              kv.put({ ...g.result, theme }, 'settings').onsuccess = () => {
                r.result.close();
                res();
              };
            };
          };
        }),
      th,
    );
    // как приложение: зеркало темы для отрисовки без мигания
    await page.evaluate(
      (theme) => localStorage.setItem('tp-boot', JSON.stringify({ locale: 'en', theme })),
      th,
    );
    for (const route of [
      '#/today',
      '#/plan',
      '#/library',
      '#/library/barbell-hip-thrust',
      '#/history',
      '#/settings',
      '#/legal/terms',
    ]) {
      await page.goto('./' + route);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', th);
      await page.waitForSelector('main .screen');
      if (route === '#/legal/terms') await page.waitForSelector('.prose h2');
      issues.push(...(await axe(page, `${th} ${route}`)));
    }
  }
  expect(issues).toEqual([]);
});
