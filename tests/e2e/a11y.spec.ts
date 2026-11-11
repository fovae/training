import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.skip(({ browserName }) => browserName !== 'webkit', 'iPhone-проекты');

for (const scheme of ['light', 'dark'] as const) {
  test(`доступность (axe, WCAG AA), тема: ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto('./');
    await page.evaluate(() => localStorage.setItem('tp-flag-ios-hint-shown', '1'));
    for (const route of ['#/today', '#/program', '#/history', '#/settings']) {
      await page.goto('./' + route);
      await page.waitForSelector('main .screen');
      // Во время тренировки тоже: поля ввода, отмеченные подходы
      if (route === '#/today' && (await page.getByRole('button', { name: 'Начать тренировку' }).count())) {
        await page.getByRole('button', { name: 'Начать тренировку' }).click();
        await page.locator('.set-done').first().click();
        await page.waitForTimeout(400); // дождаться анимации появления таймера
      }
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      const issues = r.violations.map(
        (v) => `${route} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
      );
      expect(issues).toEqual([]);
    }
  });
}
