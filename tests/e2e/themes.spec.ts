import { expect, test, type Page } from '@playwright/test';
import { fresh, kv, onboard } from './helpers';

/**
 * Темы (релиз 3.0): 12 пунктов — «Авто» и 11 тем. Название в настройках, id, фон темы.
 * Фон «Авто» зависит от системной темы.
 */
const THEMES: [name: string, id: string, bg: string | null][] = [
  ['Auto', 'auto', null],
  ['Classic Light', 'classic-light', '#f6f6f7'],
  ['Classic Dark', 'classic-dark', '#111114'],
  ['Monochrome', 'monochrome', '#f4f4f4'],
  ['Gradient', 'gradient', '#f3f1ec'],
  ['Pine Dusk', 'pine-dusk', '#14201c'],
  ['Golden Hour', 'golden-hour', '#211e16'],
  ['Violet Dusk', 'violet-dusk', '#19151f'],
  ['Rose Dusk', 'rose-dusk', '#1f1519'],
  ['Slate Blue', 'slate-blue', '#121722'],
  ['Sun Paper', 'sun-paper', '#f7f3e8'],
  ['Coffee Dusk', 'coffee-dusk', '#211913'],
];
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
const bodyBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const themeColors = (page: Page) =>
  page.$$eval('meta[name="theme-color"]', (ms) =>
    ms.map((m) => (m as HTMLMetaElement).content.toLowerCase()),
  );

test('new user gets Auto; Auto follows the system light / dark theme without a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await fresh(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'auto');
  expect(await bodyBg(page)).toBe(rgb('#f6f6f7'));
  await onboard(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'auto');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const picker = page.getByRole('radiogroup', { name: 'Theme' });
  await expect(picker.getByRole('radio')).toHaveCount(12);
  await expect(picker.getByRole('radio', { name: 'Auto', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  // тема не сохраняется как выбранная, пока её не выбрали
  expect((await kv<{ theme?: string }>(page, 'settings'))?.theme ?? 'auto').toBe('auto');

  // системная тема меняется — приложение перекрашивается сразу
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => bodyBg(page)).toBe(rgb('#111114'));
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => bodyBg(page)).toBe(rgb('#f6f6f7'));
  // theme-color: свой цвет для светлой и для тёмной системной темы
  expect(await themeColors(page)).toEqual(['#f6f6f7', '#111114']);
  expect(
    await page.$$eval('meta[name="theme-color"]', (ms) => ms.map((m) => m.getAttribute('media'))),
  ).toEqual(['(prefers-color-scheme: light)', '(prefers-color-scheme: dark)']);
});

test('all 12 themes: names, apply, checkmark, theme-color, persist after reload', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await fresh(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const picker = page.getByRole('radiogroup', { name: 'Theme' });
  expect(await picker.getByRole('radio').allTextContents()).toEqual(THEMES.map(([name]) => name));

  for (const [name, id, bg] of THEMES) {
    const radio = page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name, exact: true });
    await radio.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    await expect(radio).toHaveAttribute('aria-checked', 'true');
    // галочка только у выбранной темы
    await expect(page.locator('.tp.on .tp-check')).toHaveCount(1);
    await expect(page.locator('.tp.on')).toHaveAttribute('data-theme-id', id);
    const want = rgb(bg ?? '#f6f6f7');
    await expect.poll(() => bodyBg(page)).toBe(want);
    expect(await themeColors(page)).toEqual(bg ? [bg, bg] : ['#f6f6f7', '#111114']);

    await expect.poll(async () => (await kv<{ theme: string }>(page, 'settings'))?.theme).toBe(id);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    await expect(
      page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name, exact: true }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(await bodyBg(page)).toBe(want);
    expect(await themeColors(page)).toEqual(bg ? [bg, bg] : ['#f6f6f7', '#111114']);
  }
});

test('Russian theme names', async ({ page }, info) => {
  test.skip(info.project.name !== 'iPhone 11', 'одного проекта достаточно');
  await fresh(page);
  await onboard(page, { lang: 'ru' });
  await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  expect(await page.getByRole('radiogroup', { name: 'Тема' }).getByRole('radio').allTextContents()).toEqual([
    'Авто',
    'Классика светлая',
    'Классика тёмная',
    'Монохром',
    'Градиент',
    'Хвойный сумрак',
    'Морская ночь',
    'Фиалковый сумрак',
    'Розовый сумрак',
    'Серо-синяя',
    'Бирюзовая ночь',
    'Багровая ночь',
  ]);
});

/**
 * Нет вспышки чужого цвета при запуске: фон каждого кадра с самого начала — фон сохранённой темы.
 * Скрипт-наблюдатель ставится до скриптов страницы и записывает фон <html> на каждом кадре.
 */
test('no flash of a foreign colour at start: the first frames already use the saved theme', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await fresh(page);
  await onboard(page);
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __bg: string[] }).__bg = seen;
    const tick = () => {
      const c = getComputedStyle(document.documentElement).backgroundColor;
      if (seen[seen.length - 1] !== c) seen.push(c);
      if (seen.length < 50 && performance.now() < 20000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  for (const [, id, bg] of THEMES) {
    for (const scheme of bg ? (['light'] as const) : (['light', 'dark'] as const)) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.evaluate(
        (theme) =>
          new Promise<void>((res) => {
            localStorage.setItem('tp-boot', JSON.stringify({ locale: 'en', theme }));
            const r = indexedDB.open('training-pwa');
            r.onsuccess = () => {
              const store = r.result.transaction('kv', 'readwrite').objectStore('kv');
              const g = store.get('settings');
              g.onsuccess = () => {
                store.put({ ...(g.result as object), theme }, 'settings').onsuccess = () => {
                  r.result.close();
                  res();
                };
              };
            };
          }),
        id,
      );
      await page.reload();
      await expect(page.getByRole('navigation')).toBeVisible();
      await page.waitForTimeout(150);
      const want = rgb(bg ?? (scheme === 'dark' ? '#111114' : '#f6f6f7'));
      const seen = await page.evaluate(() => (window as unknown as { __bg: string[] }).__bg);
      // до загрузки стилей фон прозрачный (кадров ещё нет) — это не цвет темы
      const colours = seen.filter((c) => c !== 'rgba(0, 0, 0, 0)');
      // каждый записанный кадр — цвет сохранённой темы (на медленной машине кадров может не быть)
      expect(
        colours.filter((c) => c !== want),
        `${id} / ${scheme}`,
      ).toEqual([]);
      expect(
        await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor),
        `${id} / ${scheme}`,
      ).toBe(want);
    }
  }
});

test.describe('boot script', () => {
  // без service worker: иначе скрипты приложения придут из его кэша мимо page.route
  test.use({ serviceWorkers: 'block' });

  test('first frame without the app script: theme comes from the boot script alone', async ({ page }) => {
    await fresh(page);
    // приложение не загрузится — остаётся только index.html: загрузочный скрипт и стили
    await page.route(/\/assets\/.*\.js$/, (r) => r.abort());
    for (const [id, bg] of [
      ['pine-dusk', '#14201c'],
      ['coffee-dusk', '#211913'],
      ['crimson-night', '#211913'],
      ['gradient', '#f3f1ec'],
      // удалённые темы прошлых версий — сразу в новом цвете
      ['classic-orange', '#f3f1ec'],
      ['blue', '#121722'],
      ['gradient-2', '#121b22'],
      // неизвестное значение — «Авто»
      ['neon', '#f6f6f7'],
    ] as const) {
      await page.evaluate((theme) => localStorage.setItem('tp-boot', JSON.stringify({ theme })), id);
      await page.reload();
      await expect(page.locator('#boot')).toBeAttached();
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), id).toBe(
        rgb(bg),
      );
    }
  });
});
