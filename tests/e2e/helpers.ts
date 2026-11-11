import { expect, type Page } from '@playwright/test';

/** Чистый старт: без базы и localStorage. Подсказка установки iOS отмечена как показанная. */
export async function fresh(page: Page): Promise<void> {
  await page.goto('./');
  await page.evaluate(async () => {
    localStorage.clear();
    localStorage.setItem('tp-flag-ios-hint-shown', '1');
    await new Promise<void>((res) => {
      const r = indexedDB.deleteDatabase('training-pwa');
      r.onsuccess = r.onerror = r.onblocked = () => res();
    });
  });
  await page.reload();
}

export interface OnboardOpts {
  /** 'en' (по умолчанию) или 'ru' */
  lang?: 'en' | 'ru';
  /** Название варианта старта плана, как на экране */
  start?: string | RegExp;
  mode?: 'Weekdays' | 'Cycle';
  days?: number;
}

/** Проходит онбординг на английском (или выбирает русский на первом шаге) */
export async function onboard(page: Page, o: OnboardOpts = {}): Promise<void> {
  const ru = o.lang === 'ru';
  const L = ru
    ? { next: 'Далее', w: 'Вес тела, кг', h: 'Рост, см', level: 'Средний уровень', finish: 'Начать' }
    : {
        next: 'Next',
        w: 'Body weight, kg',
        h: 'Height, cm',
        level: 'Intermediate',
        finish: 'Start training',
      };
  await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible();
  if (ru) await page.getByRole('radio', { name: 'Русский' }).click();
  await page.getByRole('button', { name: L.next }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: L.next }).click();
  await page.getByLabel(L.w).fill('80');
  await page.getByLabel(L.h).fill('180');
  await page.getByRole('button', { name: L.next }).click();
  await page.getByRole('radio', { name: L.level }).click();
  await page.getByRole('button', { name: L.next }).click();
  if (o.mode) await page.getByRole('radio', { name: o.mode }).click();
  if (o.days) {
    const out = page.getByRole('group', { name: 'Workouts per week' }).locator('output');
    const inc = page.getByRole('button', { name: 'Workouts per week: more' });
    const dec = page.getByRole('button', { name: 'Workouts per week: less' });
    while (Number(await out.textContent()) < o.days) await inc.click();
    while (Number(await out.textContent()) > o.days) await dec.click();
  }
  await page.getByRole('radio', { name: o.start ?? /Split 3\+1|Сплит 3\+1/ }).click();
  await page.getByRole('button', { name: L.finish }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
}
