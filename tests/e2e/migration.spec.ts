import { expect, test } from '@playwright/test';

/**
 * Миграция v1 → v2 на фикстуре в формате первой версии приложения:
 * IndexedDB 'training-pwa' v1 (workouts + kv.activeWorkout) и настройки в localStorage 'tp-settings'.
 */
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1, 8); // 1 октября 2026

const V1_WORKOUTS = [
  {
    id: 'w1',
    dayId: 'day-1',
    startedAt: T0,
    finishedAt: T0 + 3_600_000,
    exercises: [
      {
        exId: 'incline-db-press',
        skipped: false,
        sets: [
          { weight: 22.5, reps: 12, done: true, doneAt: T0 + 600_000 },
          { weight: 22.5, reps: 11, done: true },
          { weight: null, reps: null, done: false },
        ],
      },
      { exId: 'single-arm-pushdown', skipped: true, sets: [{ weight: null, reps: null, done: false }] },
    ],
  },
  {
    id: 'w2',
    dayId: 'day-4',
    startedAt: T0 + 2 * DAY,
    finishedAt: T0 + 2 * DAY + 2_400_000,
    exercises: [
      // В v1 секунды планки лежали в reps
      { exId: 'side-plank', skipped: false, sets: [{ weight: null, reps: 35, done: true }] },
      { exId: 'cable-crunch', skipped: false, sets: [{ weight: 30, reps: 15, done: true }] },
    ],
  },
];

const V1_ACTIVE = {
  id: 'w3',
  dayId: 'day-2',
  startedAt: Date.now() - 600_000,
  finishedAt: null,
  exercises: [{ exId: 'lat-pulldown', skipped: false, sets: [{ weight: 50, reps: 10, done: true }] }],
};

test('v1 data survives the upgrade: history, active workout, settings, plan', async ({ page }) => {
  await page.goto('./robots.txt'); // тот же origin, но без приложения — чтобы оно не создало базу v2
  await page.evaluate(
    async ({ workouts, active }) => {
      localStorage.clear();
      localStorage.setItem(
        'tp-settings',
        JSON.stringify({
          theme: 'dark',
          units: 'kg',
          restBase: 180,
          restIso: 75,
          sound: false,
          wakeLock: true,
        }),
      );
      localStorage.setItem('tp-flag-ios-hint-shown', '1');
      await new Promise<void>((res) => {
        const r = indexedDB.deleteDatabase('training-pwa');
        r.onsuccess = r.onerror = r.onblocked = () => res();
      });
      await new Promise<void>((res, rej) => {
        const req = indexedDB.open('training-pwa', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          const w = db.createObjectStore('workouts', { keyPath: 'id' });
          w.createIndex('by-started', 'startedAt');
          w.createIndex('by-day', 'dayId');
          db.createObjectStore('kv');
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['workouts', 'kv'], 'readwrite');
          for (const x of workouts) tx.objectStore('workouts').put(x);
          tx.objectStore('kv').put(active, 'activeWorkout');
          tx.oncomplete = () => {
            db.close();
            res();
          };
          tx.onerror = () => rej(tx.error);
        };
        req.onerror = () => rej(req.error);
      });
    },
    { workouts: V1_WORKOUTS, active: V1_ACTIVE },
  );

  await page.goto('./');
  // Владелец v1 видит онбординг на русском (как был старый интерфейс), тема сохранилась
  await expect(page.getByRole('heading', { name: 'Язык' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByLabel('Вес тела, кг').fill('80');
  await page.getByLabel('Рост, см').fill('180');
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByRole('radio', { name: 'Опытный' }).click();
  await page.getByRole('button', { name: 'Далее' }).click();
  // По умолчанию — оставить текущий план
  const keep = page.getByRole('radio', { name: /Оставить мой текущий план/ });
  await expect(keep).toHaveAttribute('aria-checked', 'true');
  await expect(keep).toContainText('2 сохранённые тренировки');
  await page.getByRole('button', { name: 'Начать' }).click();

  // Прерванная тренировка продолжается
  await expect(page.getByRole('heading', { name: 'Идёт тренировка' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Спина + бицепс + предплечья' })).toBeVisible();
  await expect(page.getByLabel('Тяга верхнего блока к груди, подход 1: вес, кг')).toHaveValue('50');

  // Настройки отдыха перенесены
  await page.getByRole('link', { name: 'Настройки' }).click();
  await expect(page.getByRole('group', { name: 'Базовые упражнения' }).locator('output')).toHaveText('3:00');
  await expect(page.getByRole('group', { name: 'Изоляция' }).locator('output')).toHaveText('1:15');
  await expect(page.getByRole('switch', { name: 'Звук' })).toHaveAttribute('aria-checked', 'false');

  // История: обе тренировки, подходы и пропуск на месте, секунды планки — секунды
  await page.getByRole('link', { name: 'История' }).click();
  await expect(page.locator('.list .row[href*="workout"]')).toHaveCount(2);
  await page.getByRole('link', { name: /Грудь \+ трицепс/ }).click();
  await expect(page.getByText('22,5×12 · 22,5×11')).toBeVisible();
  await expect(page.locator('.detail li', { hasText: 'Одноручное' })).toContainText('пропущено');
  await page.goBack();
  await page.getByRole('link', { name: /Пресс \+ кор \+ ноги/ }).click();
  await expect(page.locator('.detail li', { hasText: 'Боковая планка' })).toContainText('35 с');

  // Старое хранилище v1 оставлено как страховочная копия
  const v1Count = await page.evaluate(
    () =>
      new Promise<number>((res) => {
        const r = indexedDB.open('training-pwa');
        r.onsuccess = () => {
          const q = r.result.transaction('workouts').objectStore('workouts').count();
          q.onsuccess = () => res(q.result);
        };
      }),
  );
  expect(v1Count).toBe(2);
});
