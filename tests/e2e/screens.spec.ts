import { expect, test, type Page } from '@playwright/test';
import { fresh, onboard } from './helpers';

/**
 * Скриншотные проверки: 375×667, 390×844, 430×932, светлая и тёмная темы.
 * Скриншоты сохраняются в отчёт (attachments) для просмотра глазами; автоматически
 * проверяем отсутствие горизонтального скролла и обрезанного текста.
 * Плюс русская версия: ни одной английской строки интерфейса на всех экранах.
 */

test.beforeEach(({ browserName }, info) => {
  test.skip(browserName !== 'webkit' || info.project.name !== 'iPhone 11', 'один проект');
});

const SIZES = [
  [375, 667],
  [390, 844],
  [430, 932],
] as const;

/** Текст, который вылез за свою коробку (кроме элементов с многоточием по дизайну) */
async function clipped(page: Page): Promise<string[]> {
  return page.$$eval(
    'h1, h2, h3, .btn, .seg-btn, .choice-txt b, .pill, .chip, .ttl, .ex-name, .card-t, .row-main b, .link-btn, .ig-txt p',
    (els) =>
      els
        .filter((e) => {
          const el = e as HTMLElement;
          if (!el.offsetParent) return false;
          const cs = getComputedStyle(el);
          if (cs.textOverflow === 'ellipsis') return false;
          return el.scrollWidth > el.clientWidth + 1;
        })
        .map((e) => (e.textContent ?? '').trim().slice(0, 40)),
  );
}

async function check(page: Page, name: string) {
  await page.waitForSelector('main .screen');
  await page.waitForTimeout(150);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow, name).toBeLessThanOrEqual(0);
  expect(await clipped(page), name).toEqual([]);
  await test
    .info()
    .attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`screens at 375/390/430, ${scheme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    for (const [w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      await fresh(page, { gate: true });
      await check(page, `${w}x${h}-${scheme}-install`);
      await fresh(page);
      await check(page, `${w}x${h}-${scheme}-onboarding`);
      await onboard(page, { lang: 'ru' });
      for (const r of ['today', 'plan', 'library', 'library/barbell-hip-thrust', 'settings']) {
        await page.goto('./#/' + r);
        await check(page, `${w}x${h}-${scheme}-${r}`);
      }
    }
  });
}

/** Английские слова, допустимые на русском экране: названия, бренды, термины (cookie, IP), язык «English» */
const ALLOWED = new Set(
  'simple training fovae claude safari iphone ipad android chrome edge firefox samsung internet ios icloud json github pages reverse pec deck dead bug sole trader work gmail com english cookie ip drive'.split(
    ' ',
  ),
);

async function englishWords(page: Page): Promise<string[]> {
  const text = await page.evaluate(() => document.querySelector('main')!.innerText);
  const stripped = text
    .replace(/«[^»]*»/g, ' ')
    // ответственное лицо — как в документах, на английском
    .replace('Fovae, a project of Vladyslav N.', ' '); // системные пункты меню — в кавычках, на английском по ТЗ
  return [...new Set(stripped.match(/[A-Za-z]{2,}/g) ?? [])].filter((w) => !ALLOWED.has(w.toLowerCase()));
}

test('Russian: no English UI strings on any screen', async ({ page }) => {
  test.setTimeout(120_000);
  const found: Record<string, string[]> = {};
  const scan = async (name: string) => {
    await page.waitForSelector('main .screen');
    const w = await englishWords(page);
    if (w.length) found[name] = w;
  };
  // Экран установки (iPhone и Android)
  await fresh(page, { gate: true });
  await page.evaluate(() => localStorage.setItem('tp-boot', JSON.stringify({ locale: 'ru' })));
  await page.reload();
  await scan('install-ios');
  // Онбординг по шагам
  await fresh(page);
  await page.getByRole('radio', { name: 'Русский' }).click();
  for (const step of ['lang', 'terms', 'profile', 'level']) {
    await scan('onb-' + step);
    if (step === 'terms') await page.getByRole('checkbox').check();
    if (step === 'profile') {
      await page.getByLabel('Вес тела, кг').fill('80');
      await page.getByLabel('Рост, см').fill('180');
    }
    if (step === 'level') await page.getByRole('radio', { name: 'Опытный' }).click();
    await page.getByRole('button', { name: 'Далее' }).click();
  }
  await scan('onb-plan');
  await page.getByRole('radio', { name: /Сплит 3\+1/ }).click();
  await page.getByRole('button', { name: 'Начать' }).click();
  // Все экраны приложения
  for (const r of [
    'today',
    'plan',
    'library',
    'library/dead-bug',
    'library/back-squat',
    'library/face-pull',
    'library/doorway-chest-stretch',
    'history',
    'settings',
  ]) {
    await page.goto('./#/' + r);
    if (r === 'plan') {
      await page.waitForSelector('.item summary');
      await page.locator('.item summary').first().click();
    }
    await scan(r);
  }
  await page.goto('./#/today');
  await page.getByRole('button', { name: 'Начать тренировку' }).click();
  await page.locator('.set-done').first().click();
  await scan('workout');
  expect(found).toEqual({});
});
