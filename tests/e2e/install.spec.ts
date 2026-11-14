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
  // IntersectionObserver под нагрузкой иногда пропускает кадр — подталкиваем, пока не появятся кнопки
  await expect(async () => {
    await page.evaluate(() => {
      scrollBy(0, -40);
      scrollTo(0, document.documentElement.scrollHeight);
    });
    await expect(page.locator('.ig-actions')).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
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

test('iOS: ?ios=27 / ?ios=26 force the instruction; without it Version/ from UA decides', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'webkit', 'iPhone projects');
  const errors: string[] = [];
  // «Importing a module script failed» — переход page.goto прерывает догрузку модуля прошлой страницы,
  // это не ошибка приложения
  page.on('pageerror', (e) => {
    if (!/Importing a module script failed/.test(e.message)) errors.push(e.message);
  });
  // ошибки скриптов; сетевые сообщения WebKit о загрузке ресурсов (service worker, ленивые картинки) не считаем
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|service ?worker/i.test(m.text())) errors.push(m.text());
  });
  await fresh(page, { gate: true });
  // Инструкция 2 (iOS 27+): ≡ → Share → View More → Add to Home Screen → подтвердить → Домой
  await page.goto('./?ios=27');
  await expect(title(page)).toBeVisible();
  await expect(page.locator('.ig-step')).toHaveCount(6);
  await expect(page.getByText(/three lines \(≡\)/)).toBeVisible();
  await expect(page.getByText(/“View More”/)).toBeVisible();
  await expect(page.locator('.ig-step img')).toHaveCount(4);
  // Инструкция 1 (младше 27) — как была
  await page.goto('./?ios=26');
  await expect(title(page)).toBeVisible();
  await expect(page.getByText(/three lines/)).toHaveCount(0);
  await expect(page.locator('.ig-step img')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('iOS: Safari Version/27 in UA picks instruction 2', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'iPhone projects');
  await page.addInitScript(() => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1';
    Object.defineProperty(navigator, 'userAgent', { get: () => ua });
  });
  await fresh(page, { gate: true });
  await expect(page.locator('.ig-step')).toHaveCount(6);
  await expect(page.getByText(/“View More”/)).toBeVisible();
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

test('Android UA with MacIntel + touch: Android steps only, no iOS text', async ({ page }) => {
  await page.addInitScript(() => {
    const a =
      'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';
    Object.defineProperty(navigator, 'userAgent', { get: () => a });
    Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
  });
  await fresh(page, { gate: true });
  await expect(title(page)).toBeVisible();
  const text = await page.locator('.install-gate').innerText();
  expect(text).toContain('Open the browser menu');
  for (const s of ['Open as Web App', 'Add to Home Screen', 'Safari', 'iPhone', '“Share”'])
    expect(text, s).not.toContain(s);
});

test('every install step is fully visible and not covered (scroll hint / sticky buttons)', async ({
  page,
}) => {
  await fresh(page, { gate: true });
  await expect(title(page)).toBeVisible();
  const steps = page.locator('.ig-step');
  const n = await steps.count();
  expect(n).toBeGreaterThanOrEqual(4);
  const check = async () => {
    for (let i = 0; i < n; i++) {
      const step = steps.nth(i);
      await step.scrollIntoViewIfNeeded();
      for (const part of ['.ig-num', '.ig-txt p', '.ig-scenes figure']) {
        const el = step.locator(part).first();
        await expect(el).toBeInViewport({ ratio: 1 });
        // Сверху ничего не лежит: точка в центре принадлежит самому шагу
        const free = await el.evaluate((node) => {
          const r = node.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20));
          return !!hit && (node === hit || node.contains(hit) || hit.contains(node));
        });
        expect(free, `step ${i + 1} ${part}`).toBe(true);
      }
    }
  };
  await check(); // до прокрутки до конца (подсказка «Прокрути вниз»)
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(installed(page)).toBeVisible();
  await check(); // после: появилась липкая панель кнопок
});
