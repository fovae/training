import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { fresh, onboard } from './helpers';

/**
 * 0.1.0 — хостинг на Cloudflare Pages (vite.config.ts, hosting): dist/_headers с CSP и кэшем,
 * публичная сборка без комментариев и карт исходников. Приложение должно работать под этой CSP:
 * заголовок подставляется в ответы preview-сервера так же, как его отдаст Cloudflare.
 */
const dist = new URL('../../dist/', import.meta.url);
const headers = () => readFileSync(new URL('_headers', dist), 'utf8');
const csp = () => /Content-Security-Policy: (.+)/.exec(headers())![1]!;

test('build output: headers, redirects, no comments or source maps, new domain', () => {
  const h = headers();
  expect(csp()).toContain("default-src 'self'");
  expect(csp()).toContain("frame-ancestors 'none'");
  expect(csp()).not.toMatch(/script-src[^;]*unsafe-inline/);
  expect(csp()).not.toMatch(/https?:\/\//);
  for (const rule of [
    '/assets/*',
    '/sw.js',
    '/index.html',
    'X-Content-Type-Options: nosniff',
    'Referrer-Policy',
  ])
    expect(h).toContain(rule);
  expect(h).toMatch(/\/sw\.js\n\s+Cache-Control: no-cache/);
  expect(h).toMatch(/\/assets\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
  expect(readFileSync(new URL('_redirects', dist), 'utf8')).toContain('/training/* /:splat  301');
  const html = readFileSync(new URL('index.html', dist), 'utf8');
  expect(html).not.toContain('<!--');
  expect(html).toContain('<link rel="canonical" href="https://simpletraining.app/"');
  expect(html).toContain('content="https://simpletraining.app/og-image.png"');
  expect(html).not.toContain('fovae.github.io');
  const assets = readdirSync(new URL('assets/', dist));
  expect(assets.filter((f) => f.endsWith('.map'))).toEqual([]);
  expect(readdirSync(dist).filter((f) => f.endsWith('.md'))).toEqual([]);
  const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', dist), 'utf8')) as {
    scope: string;
    start_url: string;
  };
  expect(manifest.scope).toBe('/');
  expect(manifest.start_url).toBe('/#/today');
});

test.describe('under the production CSP', () => {
  // без service worker: ответы должны проходить через page.route, чтобы получить заголовок
  test.use({ serviceWorkers: 'block' });

  test('the app starts, onboards and works with no CSP violations', async ({ page }) => {
    // upgrade-insecure-requests на http://localhost переводит запросы на https — в проде сайт и так https
    const policy = csp().replace(/;\s*upgrade-insecure-requests/, '');
    await page.route('**/*', async (route) => {
      const res = await route.fetch();
      const type = res.headers()['content-type'] ?? '';
      if (!type.includes('text/html')) return route.fulfill({ response: res });
      await route.fulfill({
        response: res,
        headers: { ...res.headers(), 'content-security-policy': policy },
      });
    });
    await page.addInitScript(() => {
      const w = window as unknown as { __csp: string[] };
      w.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) =>
        w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
      );
    });
    await fresh(page);
    await onboard(page);
    // главные экраны: схема упражнения (SVG), темы, история
    for (const tab of ['plan', 'library', 'history', 'settings', 'today'])
      await page.locator(`nav a[href="#/${tab}"]`).click();
    await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
    // загрузочный скрипт применил тему до приложения — его хэш в CSP совпадает
    await expect(page.locator('html')).toHaveAttribute('data-theme', /.+/);
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  });
});
