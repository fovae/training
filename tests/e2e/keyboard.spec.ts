import { expect, test, type Locator, type Page } from '@playwright/test';
import { fresh, onboard } from './helpers';

/**
 * Экранная клавиатура (src/lib/keyboard.ts). Клавиатуру имитируем, как её видит браузер телефона:
 * visualViewport становится ниже на её высоту, окно (innerHeight) прежнее (iOS Safari и PWA).
 * Поле и кнопка подтверждения должны целиком оставаться в видимой части над клавиатурой.
 */
const KB = 320;

async function fakeViewport(page: Page) {
  await page.addInitScript(() => {
    const vv = new EventTarget();
    let kb = 0;
    const box = {
      height: () => innerHeight - kb,
      width: () => innerWidth,
      zero: () => 0,
      one: () => 1,
    };
    Object.defineProperties(vv, {
      height: { get: box.height },
      width: { get: box.width },
      offsetTop: { get: box.zero },
      offsetLeft: { get: box.zero },
      pageTop: { get: () => scrollY },
      pageLeft: { get: box.zero },
      scale: { get: box.one },
    });
    Object.defineProperty(window, 'visualViewport', { get: () => vv, configurable: true });
    (window as unknown as { __kb: (px: number) => void }).__kb = (px) => {
      kb = px;
      vv.dispatchEvent(new Event('resize'));
    };
  });
}

const openKeyboard = (page: Page) =>
  page.evaluate((px) => (window as unknown as { __kb: (px: number) => void }).__kb(px), KB);

/** Элемент целиком в видимой части окна над клавиатурой */
async function expectVisibleAboveKeyboard(page: Page, ...els: Locator[]) {
  const visible = (await page.evaluate(() => innerHeight)) - KB;
  for (const el of els) {
    await expect
      .poll(
        async () => {
          const b = await el.boundingBox();
          return !!b && b.y >= 0 && b.y + b.height <= visible + 1;
        },
        { message: String(el) },
      )
      .toBe(true);
  }
}

test.beforeEach(async ({ page }) => {
  await fakeViewport(page);
  await fresh(page);
  await onboard(page);
});

test('weight and reps: field stays above the keyboard; Enter goes weight → reps → next set; nav hides', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Start workout' }).click();
  const w1 = page.getByLabel('Incline dumbbell press, set 1: weight, kg');
  const r1 = page.getByLabel('Incline dumbbell press, set 1: reps');
  const w2 = page.getByLabel('Incline dumbbell press, set 2: weight, kg');
  // последний подход на экране — ниже середины: открываем клавиатуру у поля внизу
  const lastSet = page.getByLabel('Incline dumbbell press, set 3: reps');
  await lastSet.focus();
  await openKeyboard(page);
  await expect(page.locator('html')).toHaveAttribute('data-kb', '');
  await expectVisibleAboveKeyboard(
    page,
    lastSet,
    page.getByRole('button', { name: 'Incline dumbbell press, set 3: done' }),
  );
  // нижняя панель не перекрывает поле: спрятана и не принимает нажатия
  await expect(page.locator('.nav')).toHaveCSS('pointer-events', 'none');

  await w1.focus();
  await expectVisibleAboveKeyboard(page, w1);
  await w1.fill('20');
  await w1.press('Enter');
  await expect(r1).toBeFocused();
  await expect(r1).toHaveAttribute('enterkeyhint', 'next');
  await r1.fill('10');
  await r1.press('Enter');
  await expect(w2).toBeFocused();
  await expect(lastSet).toHaveAttribute('enterkeyhint', 'done');
  await lastSet.focus();
  await lastSet.press('Enter');
  await expect(lastSet).not.toBeFocused();
});

test('rename day: the dialog with the field and Save sits above the keyboard', async ({ page }) => {
  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  await page
    .getByRole('button', { name: /^Day actions: / })
    .first()
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Rename' }).click();
  const field = page.getByRole('textbox', { name: 'Day name' });
  await expect(field).toBeFocused();
  await openKeyboard(page);
  await expectVisibleAboveKeyboard(page, field, page.getByRole('button', { name: 'Save' }));
});

test('exercise search in the picker sheet: search field visible above the keyboard', async ({ page }) => {
  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  await page.getByRole('button', { name: 'Add exercise' }).first().click();
  const sheet = page.getByRole('dialog');
  const search = sheet.getByRole('searchbox');
  await search.focus();
  await openKeyboard(page);
  await search.fill('curl');
  await expectVisibleAboveKeyboard(page, search);
  // лист не выше видимой части окна (высота листа подстраивается под клавиатуру — ждём, пока встанет)
  const visible = (await page.evaluate(() => innerHeight)) - KB;
  await expect
    .poll(async () => {
      const box = await sheet.boundingBox();
      return box ? box.y + box.height : Infinity;
    })
    .toBeLessThanOrEqual(visible + 1);
});

test('dumbbells: ×2 by default, L & R gives two fields above the keyboard; alternating odd total asks', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Start workout' }).click();
  const card = page.getByRole('article', { name: 'Incline dumbbell press' });
  await expect(card.getByRole('radio', { name: '× 2' })).toHaveAttribute('aria-checked', 'true');
  await card.getByRole('radio', { name: 'L & R' }).click();
  const l3 = card.getByLabel('Incline dumbbell press, set 3: left dumbbell, kg');
  const r3 = card.getByLabel('Incline dumbbell press, set 3: right dumbbell, kg');
  await l3.focus();
  await openKeyboard(page);
  await expectVisibleAboveKeyboard(
    page,
    l3,
    r3,
    card.getByRole('button', { name: 'Incline dumbbell press, set 3: done' }),
  );
  await l3.fill('20');
  await l3.press('Enter');
  await expect(r3).toBeFocused();
  await r3.fill('22');
  await r3.press('Enter');
  await expect(card.getByLabel('Incline dumbbell press, set 3: reps')).toBeFocused();

  // «по очереди»: общий счёт 15 — приложение спрашивает, какая сторона сделала больше
  const push = page.getByRole('article', { name: 'Single-arm cable pushdown' });
  await push.getByRole('radio', { name: 'Total' }).click();
  const total1 = push.getByLabel('Single-arm cable pushdown, set 1: reps in total, both sides');
  await total1.fill('15');
  await total1.press('Tab');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Left 8, right 7' }).click();
  await expect(push.locator('.set-hint').first()).toHaveText('15 total = 8 left + 7 right');
  await total1.fill('16');
  await total1.press('Tab');
  await expect(push.locator('.set-hint').first()).toHaveText('16 total = 8 per arm');
});
