import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fresh, onboard } from './helpers';

test.skip(({ browserName }) => browserName !== 'webkit', 'iPhone projects');

async function axe(page: Page, where: string): Promise<string[]> {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
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
