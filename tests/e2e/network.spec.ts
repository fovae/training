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
  const external: string[] = [];
  const collect = async () => {
    const links = await page.$$eval('a[href]', (as) =>
      as.map((a) => ({
        href: a.getAttribute('href')!,
        inLegal: !!a.closest('.legal .prose'),
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel') ?? '',
      })),
    );
    for (const l of links) {
      // Единственное исключение — внешние https-ссылки в тексте Privacy и Terms
      if (l.href.startsWith('https:')) {
        if (!l.inLegal || l.target !== '_blank' || !/noopener/.test(l.rel) || !/noreferrer/.test(l.rel))
          external.push(l.href);
        continue;
      }
      hrefs.add(l.href);
    }
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
    '#/legal/licenses',
  ]) {
    await page.goto('./' + route);
    await page.waitForSelector('main .screen');
    if (route.startsWith('#/legal/') && route !== '#/legal/licenses') await page.waitForSelector('.prose h2');
    await collect();
  }
  await page.waitForLoadState('networkidle');

  expect(foreign).toEqual([]);
  expect(external).toEqual([]);
  const bad = [...hrefs].filter((h) => !h.startsWith('#') && h !== 'mailto:fovae.work@gmail.com');
  expect(bad).toEqual([]);
  expect(hrefs).toContain('mailto:fovae.work@gmail.com');
  await page.goto('./#/settings');
  await expect(page.getByText('Created by Fovae & Claude')).toBeVisible();
  await expect(page.getByText('Fovae, a project of Vladyslav N.')).toBeVisible();
});
