import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { SKIP_KEY, fresh } from './helpers';

/** Экран установки на телефоне вне установленного приложения (iPhone — WebKit, Android — Pixel/Chromium) */

const title = (page: Page) => page.getByRole('heading', { name: 'Install Simple Training', level: 1 });
const installed = (page: Page) => page.getByRole('button', { name: "I've installed it" });
const cont = (page: Page) => page.getByRole('button', { name: 'Continue in browser' });

async function scrollToEnd(page: Page) {
  // Прокручиваем шагами, как человек, — IntersectionObserver должен увидеть якорь в конце
  for (let i = 0; i < 40; i++) {
    const done = await page.evaluate(() => {
      scrollBy(0, innerHeight * 0.8);
      return innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
    });
    if (done) break;
  }
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
}

test('mobile outside the installed app: gate first, no close, buttons only after scrolling', async ({
  page,
  browserName,
  baseURL,
}) => {
  const foreign: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['data:', 'blob:'].includes(u.protocol) && u.origin !== new URL(baseURL!).origin)
      foreign.push(r.url());
  });
  await fresh(page, { gate: true });
  await expect(title(page)).toBeVisible();
  await expect(title(page)).toBeFocused();
  // Ни онбординга, ни таб-бара, ни крестика
  await expect(page.getByRole('heading', { name: 'Language' })).toHaveCount(0);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /close|закрыть/i })).toHaveCount(0);
  // Только своя платформа: инструкций другой ОС нет даже в DOM, переключателя платформ нет
  await expect(page.getByRole('radio', { name: 'Android' })).toHaveCount(0);
  const html = await page.content();
  if (browserName === 'webkit') {
    expect(html).toContain('Open as Web App');
    expect(html).not.toContain('Open the browser menu');
  } else {
    expect(html).toContain('Open the browser menu');
    expect(html).not.toContain('Open as Web App');
    for (const b of ['Edge', 'Samsung', 'Firefox']) expect(html).not.toContain(b);
  }
  await expect(page.getByText('Fill in your profile in the installed app')).toBeVisible();
  await expect(page.locator('.ig-step')).not.toHaveCount(0);
  await expect(page.locator('.ig-step svg text')).toHaveCount(0); // без текста внутри SVG

  // Кнопок нет, пока не прокрутили до конца; есть подсказка
  await expect(installed(page)).toHaveCount(0);
  await expect(cont(page)).toHaveCount(0);
  await expect(page.locator('.ig-scroll-hint')).toBeVisible();
  await scrollToEnd(page);
  await expect(installed(page)).toBeVisible();
  await expect(installed(page)).toBeFocused();
  await expect(cont(page)).toBeVisible();

  // «Я установил» — не в онбординг, а финальное сообщение; оно же после перезагрузки
  await installed(page).click();
  await expect(page.getByRole('heading', { name: 'Done!' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Done!' })).toBeVisible();
  await page.getByRole('button', { name: 'Show the instructions again' }).click();
  await expect(title(page)).toBeVisible();
  expect(foreign).toEqual([]);
});

test('"Continue in browser" leads to onboarding and is remembered for 7 days', async ({ page }) => {
  await fresh(page, { gate: true });
  await scrollToEnd(page);
  await cont(page).click();
  await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible();
  // Через 8 дней экран снова показывается
  await page.evaluate(
    (k) => localStorage.setItem(k, new Date(Date.now() - 8 * 86_400_000).toISOString()),
    SKIP_KEY,
  );
  await page.reload();
  await expect(title(page)).toBeVisible();
});

test('installed app (standalone): no gate', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { get: () => true, configurable: true });
  });
  await fresh(page, { gate: true });
  await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible();
  await expect(title(page)).toHaveCount(0);
});

test('legal pages open without the gate', async ({ page }) => {
  await fresh(page, { gate: true });
  await page.goto('./#/legal/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeVisible();
  await expect(title(page)).toHaveCount(0);
});

test('Android: beforeinstallprompt shows the Install button; accepting shows Done', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Android (Pixel)');
  await fresh(page, { gate: true });
  await expect(title(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Install app' })).toHaveCount(0);
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    e.prompt = async () => {
      (window as unknown as { __prompted: boolean }).__prompted = true;
    };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    dispatchEvent(e);
  });
  const btn = page.getByRole('button', { name: 'Install app' });
  await expect(btn).toBeVisible();
  // Кнопка — сверху, над шагами
  const b = await btn.boundingBox();
  const s = await page.locator('.ig-step').first().boundingBox();
  expect(b!.y).toBeLessThan(s!.y);
  await btn.click();
  expect(await page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted)).toBe(true);
  await expect(page.getByRole('heading', { name: 'Done!' })).toBeVisible();
});

test('Android: appinstalled event switches to Done', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Android (Pixel)');
  await fresh(page, { gate: true });
  await expect(title(page)).toBeVisible();
  await page.evaluate(() => dispatchEvent(new Event('appinstalled')));
  await expect(page.getByRole('heading', { name: 'Done!' })).toBeVisible();
});

test('gate in Russian, platform switch, axe', async ({ page, browserName }) => {
  await fresh(page, { gate: true });
  await page.evaluate(() => localStorage.setItem('tp-boot', JSON.stringify({ locale: 'ru' })));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Установи Simple Training' })).toBeVisible();
  await expect(page.locator('.ig-step').first()).toBeVisible();
  if (browserName === 'webkit') {
    for (const scheme of ['light', 'dark'] as const) {
      // Тему задаём до загрузки — иначе axe меряет цвета посреди CSS-перехода
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Установи Simple Training' })).toBeVisible();
      await scrollToEnd(page);
      await expect(page.getByRole('button', { name: 'Я установил(а) приложение' })).toBeVisible();
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(
        r.violations.map((v) => `${scheme} ${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`),
      ).toEqual([]);
    }
  }
});

test('iPad (MacIntel + touch) is treated as iOS', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'iPhone projects');
  await page.addInitScript(() => {
    const mac =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
    Object.defineProperty(navigator, 'userAgent', { get: () => mac });
    Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
  });
  await fresh(page, { gate: true });
  await expect(title(page)).toBeVisible();
  expect(await page.content()).toContain('Open as Web App');
});

test('iOS in-app browser: one line "Open this link in Safari"', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'iPhone projects');
  await page.addInitScript(() => {
    const ig =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0.0.0';
    Object.defineProperty(navigator, 'userAgent', { get: () => ig });
  });
  await fresh(page, { gate: true });
  await expect(page.locator('.ig-step')).toHaveCount(1);
  await expect(page.getByText('Open this link in Safari.')).toBeVisible();
});
