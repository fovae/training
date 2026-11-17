import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fresh, onboard, tourSeen } from './helpers';

/** Тур после онбординга (3.24, ui/tour/Tour.tsx): 5 «историй», жесты и кнопки, пауза, условия показа */

const tour = (page: Page) => page.getByRole('dialog');
const heading = (page: Page) => page.locator('#tour-h');
const TITLES = [
  'Your plan is ready',
  'Log your sets',
  'Timer and tips',
  'Exercises and history',
  'Your data stays with you',
];

/** Ничего не выходит за края тура; кнопки внизу и текст — целиком на экране */
const overflow = (page: Page) =>
  page.evaluate(() => {
    const box = document.querySelector('.tour')!.getBoundingClientRect();
    const out = [...document.querySelectorAll('.tour *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1);
      })
      .map((el) => el.className);
    for (const s of ['.tour-f .btn.primary', '.tour-b', '.tour-h']) {
      const r = document.querySelector(s)!.getBoundingClientRect();
      if (r.bottom > innerHeight + 1 || r.top < 0) out.push('off-screen ' + s);
    }
    return out.slice(0, 5);
  });

test('shown once after onboarding: 5 slides, buttons, skip → Today; not shown again', async ({ page }) => {
  // без анимаций — без автоперехода: порядок слайдов проверяется кнопками
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fresh(page, { tour: true });
  await onboard(page, { keepTour: true });
  await expect(tour(page)).toBeVisible();
  await expect(heading(page)).toHaveText(TITLES[0]!);
  // слайд 1: реальные дни плана («Сплит 3+1»), вкладка «План» подсвечена
  await expect(page.locator('.tm-day')).toHaveCount(4);
  await expect(page.locator('.tm-day').first()).toContainText('Chest');
  await expect(page.locator('.tour-b')).toContainText('“Plan”');
  await expect(page.locator('.tour .sr-only')).toHaveText('Slide 1 of 5');
  // «Назад» на первом слайде скрыта
  await expect(tour(page).getByRole('button', { name: 'Back' })).toBeHidden();
  for (let i = 1; i < 5; i++) {
    await tour(page).getByRole('button', { name: 'Next' }).click();
    await expect(heading(page)).toHaveText(TITLES[i]!);
  }
  await expect(page.locator('.tour .sr-only')).toHaveText('Slide 5 of 5');
  // последний: вместо «Далее» — «К тренировке»
  await expect(tour(page).getByRole('button', { name: 'Next' })).toHaveCount(0);
  await tour(page).getByRole('button', { name: 'Back' }).click();
  await expect(heading(page)).toHaveText(TITLES[3]!);
  await tour(page).getByRole('button', { name: 'Skip' }).click();
  await expect(tour(page)).toHaveCount(0);
  await expect(page).toHaveURL(/#\/today$/);
  expect(await tourSeen(page)).toBe(1);
  await page.reload();
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.locator('.tour')).toHaveCount(0);
});

test('taps: right half → next, left edge → back; Escape closes; «Start training» on the last', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fresh(page, { tour: true });
  await onboard(page, { keepTour: true });
  const box = (await page.locator('.tour').boundingBox())!;
  const tap = (fx: number) => page.mouse.click(box.x + box.width * fx, box.y + box.height * 0.45);
  await tap(0.8);
  await expect(heading(page)).toHaveText(TITLES[1]!);
  await tap(0.1);
  await expect(heading(page)).toHaveText(TITLES[0]!);
  await page.keyboard.press('ArrowRight');
  await expect(heading(page)).toHaveText(TITLES[1]!);
  await page.keyboard.press('Escape');
  await expect(tour(page)).toHaveCount(0);
  // «Показать тур» в настройках → до конца и «К тренировке»
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Show the tour' }).click();
  await expect(heading(page)).toHaveText(TITLES[0]!);
  for (let i = 1; i < 5; i++) await page.keyboard.press('ArrowRight');
  await tour(page).getByRole('button', { name: 'Start training' }).click();
  await expect(tour(page)).toHaveCount(0);
  await expect(page).toHaveURL(/#\/today$/);
});

test('autoplay like stories: advances by itself; pause holds it; back turns it off', async ({ page }) => {
  test.setTimeout(60_000);
  await fresh(page, { tour: true, motion: 'default' });
  await onboard(page, { keepTour: true });
  await expect(heading(page)).toHaveText(TITLES[0]!);
  // сам переходит на второй слайд (5,5 с)
  await expect(heading(page)).toHaveText(TITLES[1]!, { timeout: 8000 });
  // пробел — пауза: стоим дольше слайда
  await page.keyboard.press('Space');
  await expect(page.locator('.tour.paused')).toBeVisible();
  await page.waitForTimeout(6500);
  await expect(heading(page)).toHaveText(TITLES[1]!);
  await page.keyboard.press('Space');
  // «назад» — автопереход выключается до конца тура
  await page.keyboard.press('ArrowLeft');
  await expect(heading(page)).toHaveText(TITLES[0]!);
  await page.waitForTimeout(6500);
  await expect(heading(page)).toHaveText(TITLES[0]!);
});

test('animations off: no autoplay, mocks in their final state, manual paging works', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fresh(page, { tour: true });
  await onboard(page, { keepTour: true });
  await expect(page.locator('.tour-bar i.run')).toHaveCount(0);
  await page.waitForTimeout(6500);
  await expect(heading(page)).toHaveText(TITLES[0]!);
  await tour(page).getByRole('button', { name: 'Next' }).click();
  // поля подхода уже заполнены, «готово» нажато — без движения
  expect(
    await page
      .locator('.tm-type')
      .first()
      .evaluate((el) => getComputedStyle(el).opacity),
  ).toBe('1');
});

test('a11y and layout: no violations, nothing sticks out at 375 / 430 in all six languages', async ({
  page,
}) => {
  test.setTimeout(120_000);
  for (const [w, h, lang] of [
    [375, 667, 'en'],
    [430, 932, 'ru'],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await fresh(page, { tour: true });
    await onboard(page, { keepTour: true, lang });
    await expect(tour(page)).toBeVisible();
    for (let i = 0; i < 5; i++) {
      expect(await overflow(page), `${w} ${lang} slide ${i + 1}`).toEqual([]);
      if (i === 0) {
        // после проявления слайда: на середине fade-in текст полупрозрачный
        await page.waitForTimeout(1200);
        const axe = await new AxeBuilder({ page })
          .include('.tour')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(axe.violations.map((v) => v.id)).toEqual([]);
      }
      if (i < 4) await page.keyboard.press('ArrowRight');
    }
    // заголовок и подпись — не меньше 16 px
    const sizes = await page.evaluate(() =>
      ['.tour-h', '.tour-b'].map((s) => parseFloat(getComputedStyle(document.querySelector(s)!).fontSize)),
    );
    for (const s of sizes) expect(s).toBeGreaterThanOrEqual(16);
    await page.keyboard.press('Escape');
  }
  // остальные языки: самые длинные слова (польский, украинский, испанский, итальянский)
  await page.setViewportSize({ width: 375, height: 667 });
  for (const code of ['es', 'it', 'pl', 'uk']) {
    await page.locator('nav a[href="#/settings"]').click();
    await page.locator('.settings .select-btn').click();
    await page.locator(`.select-list [lang="${code}"]`).click();
    await page
      .locator('.settings button.ir', { hasText: /tour|Показать|Ver el|Mostra|Pokaż|Показати/i })
      .click();
    await expect(tour(page)).toBeVisible();
    for (let i = 0; i < 5; i++) {
      expect(await overflow(page), `${code} slide ${i + 1}`).toEqual([]);
      if (i < 4) await page.keyboard.press('ArrowRight');
    }
    await page.keyboard.press('Escape');
  }
});
