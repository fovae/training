import { expect, test } from '@playwright/test';

/** Манифест и ссылки на иконки в <head>: всё отвечает, размеры совпадают с заявленными */
test('manifest is valid, every icon link responds, apple-touch-icon is present', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifestUrl = new URL(href!, page.url());
  const res = await request.get(manifestUrl.href);
  expect(res.ok()).toBe(true);
  const m = (await res.json()) as {
    name: string;
    short_name: string;
    start_url: string;
    scope: string;
    display: string;
    theme_color: string;
    background_color: string;
    icons: { src: string; sizes: string; type: string; purpose?: string }[];
  };
  expect(m.name).toBe('Simple Training');
  expect(m.short_name.length).toBeLessThanOrEqual(12);
  expect(m.display).toBe('standalone');
  expect(m.start_url.startsWith(m.scope)).toBe(true);
  // Тема по умолчанию — «Авто»: цвета манифеста — фон Classic Light
  expect(m.theme_color.toLowerCase()).toBe('#f6f6f7');
  expect(m.background_color.toLowerCase()).toBe('#f6f6f7');

  expect(m.icons.map((i) => [i.sizes, i.purpose]).sort()).toEqual(
    [
      ['192x192', 'any'],
      ['512x512', 'any'],
      ['512x512', 'maskable'],
    ].sort(),
  );
  // размер PNG читаем из заголовка IHDR
  const pngSize = (b: Buffer) => `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
  for (const icon of m.icons) {
    const r = await request.get(new URL(icon.src, manifestUrl).href);
    expect(r.ok(), icon.src).toBe(true);
    expect(r.headers()['content-type']).toContain('image/png');
    expect(icon.type).toBe('image/png');
    expect(pngSize(await r.body()), icon.src).toBe(icon.sizes);
  }
  expect(m.icons.map((i) => i.src).sort()).toEqual([
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-512.png',
  ]);

  const links = await page.$$eval('link[rel="icon"], link[rel="apple-touch-icon"]', (ls) =>
    ls.map((l) => ({ rel: l.getAttribute('rel')!, href: (l as HTMLLinkElement).href })),
  );
  expect(links.map((l) => l.rel).sort()).toEqual(['apple-touch-icon', 'icon', 'icon']);
  for (const l of links) {
    const r = await request.get(l.href);
    expect(r.ok(), l.href).toBe(true);
  }
  const touch = await request.get(links.find((l) => l.rel === 'apple-touch-icon')!.href);
  expect(pngSize(await touch.body())).toBe('180x180');
});
