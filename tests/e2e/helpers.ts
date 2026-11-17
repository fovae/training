import { expect, type Locator, type Page } from '@playwright/test';

/** Ключ «Продолжить в браузере» (src/features/install.ts) — тесты обходят экран установки так же */
export const SKIP_KEY = 'tp-install-skip';

/** Чистый старт: без базы и localStorage, экран установки пропущен. */
export async function fresh(
  page: Page,
  opts: {
    gate?: boolean;
    /**
     * «Анимации» в настройках. С 3.15 у нового пользователя они включены ('default'). Тесты по умолчанию
     * ставят «как в системе», как было раньше: так emulateMedia({ reducedMotion: 'reduce' }) выключает
     * анимации и вёрстка меряется в покое.
     */
    motion?: 'system' | 'default';
    /** Показывать ли тур после онбординга (3.24). По умолчанию тесты его пропускают */
    tour?: boolean;
  } = {},
): Promise<void> {
  await page.goto('./');
  await page.evaluate(async (skip) => {
    localStorage.clear();
    if (skip) localStorage.setItem('tp-install-skip', new Date().toISOString());
    await new Promise<void>((res) => {
      const r = indexedDB.deleteDatabase('training-pwa');
      r.onsuccess = r.onerror = r.onblocked = () => res();
    });
  }, !opts.gate);
  await page.reload();
  if (opts.motion === 'default') return;
  // приложение создало базу — записываем выбор и перезагружаем
  await page.locator('#boot').waitFor({ state: 'detached' });
  await page.evaluate(
    (tour) =>
      new Promise<void>((res, rej) => {
        const boot = JSON.parse(localStorage.getItem('tp-boot') || '{}') as object;
        localStorage.setItem('tp-boot', JSON.stringify({ ...boot, motion: 'system' }));
        const r = indexedDB.open('training-pwa');
        r.onerror = () => rej(r.error);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction('kv', 'readwrite');
          tx.objectStore('kv').put(
            tour ? { motion: 'system' } : { motion: 'system', tourSeen: 99 },
            'settings',
          );
          tx.oncomplete = () => {
            db.close();
            res();
          };
          tx.onerror = () => rej(tx.error);
        };
      }),
    !!opts.tour,
  );
  await page.reload();
  // заставка холодного старта (3.23) держится ~1,4 с поверх экрана — тесты начинают после неё
  await page.locator('#boot').waitFor({ state: 'detached' });
}

export interface OnboardOpts {
  /** 'en' (по умолчанию) или 'ru' */
  lang?: 'en' | 'ru';
  /** Название варианта старта плана, как на экране */
  start?: string | RegExp;
  mode?: 'Fixed weekdays' | 'In order';
  days?: number;
  /** Подпись уровня, как на экране (по умолчанию — средний) */
  level?: string;
  /** Не закрывать тур после онбординга (тесты самого тура) */
  keepTour?: boolean;
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
  await page.getByRole('radio', { name: o.level ?? L.level }).click();
  await page.getByRole('button', { name: L.next }).click();
  if (o.mode) await page.getByRole('radio', { name: o.mode }).click();
  if (o.days) {
    const out = page.getByRole('group', { name: 'Workouts per week' }).locator('output');
    const inc = page.getByRole('button', { name: 'Workouts per week: more' });
    const dec = page.getByRole('button', { name: 'Workouts per week: less' });
    while (Number(await out.textContent()) < o.days) await inc.click();
    while (Number(await out.textContent()) > o.days) await dec.click();
  }
  // «Подбор плана» — отдельная карточка над шаблонами (3.18)
  if (o.start === 'Plan builder') await page.getByRole('button', { name: /^Plan builder/ }).click();
  else await page.getByRole('radio', { name: o.start ?? /Split 3\+1|Сплит 3\+1/ }).click();
  await page.getByRole('button', { name: L.finish }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  // тур (3.24): тесты, в чьих настройках он не отмечен (сброс данных, motion 'default'), — закрываем
  if (!o.keepTour && (await tourSeen(page)) < 1) await page.locator('.tour-skip').click();
}

/** Какая версия тура отмечена в настройках (IndexedDB) */
export const tourSeen = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      new Promise<number>((res) => {
        const r = indexedDB.open('training-pwa');
        r.onerror = () => res(0);
        r.onsuccess = () => {
          const q = r.result.transaction('kv').objectStore('kv').get('settings');
          q.onsuccess = () => {
            res((q.result as { tourSeen?: number } | undefined)?.tourSeen ?? 0);
            r.result.close();
          };
          q.onerror = () => res(0);
        };
      }),
  );

/** Значение из IndexedDB kv (для ожидания записи перед перезагрузкой страницы) */
export function kv<T = unknown>(page: Page, key: string): Promise<T | null> {
  return page.evaluate(
    (k) =>
      new Promise<T | null>((res) => {
        const r = indexedDB.open('training-pwa');
        r.onsuccess = () => {
          const db = r.result;
          const g = db.transaction('kv').objectStore('kv').get(k);
          g.onsuccess = () => {
            db.close();
            res((g.result as T | undefined) ?? null);
          };
        };
      }),
    key,
  );
}

/**
 * Выбор в своём выпадающем списке (src/ui/components/Select.tsx) — вместо selectOption у <select>:
 * нажать на поле, затем на пункт; ждёт, пока список закроется.
 */
export async function choose(field: Locator, v: string | { index: number }): Promise<void> {
  const page = field.page();
  await field.click();
  const list = page.locator('.select-layer:not(.leaving) .select-list');
  const opt =
    typeof v === 'string'
      ? list.locator(`[role="option"][data-value="${v}"]`)
      : list.getByRole('option').nth(v.index);
  await opt.click();
  await expect(page.locator('.select-layer')).toHaveCount(0);
}

/** Подписи пунктов выпадающего списка: открыть, прочитать, закрыть по Escape */
export async function optionTexts(field: Locator): Promise<string[]> {
  const page = field.page();
  await field.click();
  const opts = page.locator('.select-layer:not(.leaving) .select-list [role="option"]');
  await expect(opts.first()).toBeVisible();
  const texts = (await opts.allTextContents()).map((x) => x.trim());
  await page.keyboard.press('Escape');
  await expect(page.locator('.select-layer')).toHaveCount(0);
  return texts;
}

/**
 * Настройки (3.22) — один экран-список, как в iOS. section — где на экране нужный пункт (для чтения
 * теста); тема открывается листом: openThemes.
 */
export async function openSettings(
  page: Page,
  section?: 'training' | 'tips' | 'look' | 'data' | 'about',
): Promise<void> {
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  if (section) await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
}

/** Лист выбора темы в настройках (строка «Тема» / «Theme») */
export async function openThemes(page: Page): Promise<void> {
  await page.locator('.settings button.ir[aria-haspopup="dialog"]', { hasText: /^(Theme|Тема)/ }).click();
  await expect(page.locator('.sheet .tp, .sheet [role="radiogroup"]').first()).toBeVisible();
}

/** Закрыть тур (тесты с собственными данными без отметки tourSeen: миграции) */
export async function skipTour(page: Page): Promise<void> {
  await page.locator('.tour-skip').click();
  await expect(page.locator('.tour')).toHaveCount(0);
}
