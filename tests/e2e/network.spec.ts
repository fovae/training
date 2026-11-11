import { expect, test } from '@playwright/test';
import { fresh, onboard } from './helpers';

/** Приложение не обращается к чужим доменам и не содержит внешних ссылок, кроме mailto контакта */
test('no third-party requests and no external links', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const foreign: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return;
    if (u.origin !== origin) foreign.push(r.url());
  });

  await fresh(page);
  await onboard(page);
  const hrefs = new Set<string>();
  const collect = async () => {
    for (const h of await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')!)))
      hrefs.add(h);
  };
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.locator('details.tech summary').first().click();
  await collect();
  for (const route of [
    '#/plan',
    '#/library',
    '#/library/side-plank',
    '#/history',
    '#/settings',
    '#/legal/privacy',
    '#/legal/terms',
  ]) {
    await page.goto('./' + route);
    await page.waitForSelector('main .screen');
    await collect();
  }
  await page.waitForLoadState('networkidle');

  expect(foreign).toEqual([]);
  const bad = [...hrefs].filter((h) => !h.startsWith('#') && h !== 'mailto:fovae.work@gmail.com');
  expect(bad).toEqual([]);
  expect(hrefs).toContain('mailto:fovae.work@gmail.com');
  await expect(page.getByText('Created by Fovae & Claude')).toBeVisible();
});
