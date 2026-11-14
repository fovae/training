import { expect, test } from '@playwright/test';
import { fresh, onboard } from './helpers';

/**
 * Установленное приложение на iPhone (запуск с экрана «Домой»). Сам сбой iOS (окно короче экрана,
 * системное размытие под статус-баром) в эмуляции не воспроизводится — проверяем, что стоят
 * условия, при которых iOS его не даёт: страница не короче экрана и сплошная полоса у верхнего края.
 */
test.describe('installed app (navigator.standalone)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { get: () => true, configurable: true });
    });
  });

  test('page is at least as tall as the screen (100lvh), without extra scroll; nav sits at the bottom', async ({
    page,
  }) => {
    await fresh(page);
    await expect(page.locator('html')).toHaveAttribute('data-standalone', '');
    // до приложения (экран загрузки) и на коротком экране онбординга — правило уже действует
    const m = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden';
      document.body.appendChild(probe);
      const lvh = probe.offsetHeight;
      probe.remove();
      return {
        lvh,
        inner: innerHeight,
        min: getComputedStyle(document.documentElement).minHeight,
        html: document.documentElement.getBoundingClientRect().height,
      };
    });
    // правило действует (WebKit отдаёт min-height с процентами формулой, Chromium — числом)
    expect(m.min).not.toMatch(/^(0px|auto)$/);
    expect(m.html).toBeGreaterThanOrEqual(m.lvh - 1);

    await onboard(page);
    // «Сегодня» с пустым местом внизу: страница не длиннее окна (нет лишней прокрутки), панель на месте
    await page.getByRole('link', { name: 'History' }).click();
    await expect(page.locator('.screen.history')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight))
      .toBeLessThanOrEqual(1);
    const g = await page.evaluate(() => {
      const nav = document.querySelector('.nav')!.getBoundingClientRect();
      return {
        inner: innerHeight,
        scrollH: document.documentElement.scrollHeight,
        navBottom: nav.bottom,
      };
    });
    expect(g.scrollH).toBeLessThanOrEqual(g.inner + 1);
    // капсула у нижнего края: отступ 10 px (без «чёлки») и не выше
    expect(g.inner - g.navBottom).toBeGreaterThanOrEqual(6);
    expect(g.inner - g.navBottom).toBeLessThanOrEqual(34);
  });

  test('status bar strip: solid page colour, no gradient, takes hits (iOS skips its edge blur)', async ({
    page,
  }) => {
    await fresh(page);
    const shim = page.locator('.status-shim');
    await expect(shim).toHaveCount(1);
    const s = await shim.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        position: cs.position,
        top: cs.top,
        bgImage: cs.backgroundImage,
        bg: cs.backgroundColor,
        pe: cs.pointerEvents,
        backdrop: cs.getPropertyValue('-webkit-backdrop-filter') || cs.getPropertyValue('backdrop-filter'),
        pageBg: getComputedStyle(document.body).backgroundColor,
        width: el.getBoundingClientRect().width,
        vw: innerWidth,
      };
    });
    expect(s.position).toBe('fixed');
    expect(s.top).toBe('0px');
    expect(s.bgImage).toBe('none');
    expect(s.bg).toBe(s.pageBg);
    expect(s.pe).not.toBe('none');
    expect(['', 'none']).toContain(s.backdrop);
    expect(s.width).toBe(s.vw);
  });
});

test('browser tab (not installed): page height is not forced', async ({ page }) => {
  await fresh(page);
  await expect(page.locator('html')).not.toHaveAttribute('data-standalone', '');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).minHeight)).toMatch(/^(0px|auto)$/);
});
