import { expect, test, type Page } from '@playwright/test';

/**
 * Миграция v2 → v3 → v4 на фикстуре в формате этапа 1 (у владельца уже стоит v2):
 * IndexedDB 'training-pwa' v2: sessions + kv(profile, plan, settings, activeSession),
 * плюс остатки v1 (хранилище workouts, kv.legacyPrefs), которые v3 удаляет.
 * Ниже — v3 → v4 (релиз 3.0): сохранённая тема переводится в новый набор, данные на месте.
 */
const PLAN = {
  mode: 'cycle',
  templateId: 'split31',
  days: [
    {
      id: 'day-1',
      labelKey: 'tpl.split31.d1',
      items: [{ exerciseId: 'incline-db-press', sets: 3, repsMin: 8, repsMax: 12 }],
    },
    {
      id: 'day-2',
      labelKey: 'tpl.split31.d2',
      items: [{ exerciseId: 'lat-pulldown', sets: 3, repsMin: 8, repsMax: 12 }],
    },
  ],
};
const PROFILE = {
  weightKg: 80,
  heightCm: 180,
  level: 'veteran',
  units: 'metric',
  locale: 'ru',
  adult16Confirmed: true,
  confirmedAt: '2026-11-11T10:00:00.000Z',
};
const SETTINGS = {
  theme: 'dark',
  tipsEnabled: true,
  restBaseSec: 180,
  restIsoSec: 75,
  sound: false,
  wakeLock: true,
};
const SESSIONS = [
  {
    id: 's1',
    dayId: 'day-1',
    startedAt: '2026-11-10T08:00:00.000Z',
    endedAt: '2026-11-10T09:00:00.000Z',
    note: 'Хорошо пошло',
    entries: [{ exerciseId: 'incline-db-press', sets: [{ weightKg: 22.5, reps: 12, done: true }] }],
  },
];

test('v2 data survives the upgrade to the current schema; documents must be accepted', async ({ page }) => {
  await page.goto('./robots.txt'); // тот же origin без приложения — база не создаётся раньше времени
  await page.evaluate(
    async ({ plan, profile, settings, sessions }) => {
      localStorage.clear();
      localStorage.setItem('tp-install-skip', new Date().toISOString());
      localStorage.setItem('tp-boot', JSON.stringify({ locale: 'ru', theme: 'dark' }));
      await new Promise<void>((res) => {
        const r = indexedDB.deleteDatabase('training-pwa');
        r.onsuccess = r.onerror = r.onblocked = () => res();
      });
      await new Promise<void>((res, rej) => {
        const req = indexedDB.open('training-pwa', 2);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore('kv');
          const s = db.createObjectStore('sessions', { keyPath: 'id' });
          s.createIndex('by-started', 'startedAt');
          s.createIndex('by-day', 'dayId');
          db.createObjectStore('workouts', { keyPath: 'id' }); // остаток v1
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['kv', 'sessions', 'workouts'], 'readwrite');
          const kv = tx.objectStore('kv');
          kv.put(profile, 'profile');
          kv.put(plan, 'plan');
          kv.put(settings, 'settings');
          kv.put({ units: 'metric', locale: 'ru', workouts: 1 }, 'legacyPrefs');
          for (const x of sessions) tx.objectStore('sessions').put(x);
          tx.objectStore('workouts').put({ id: 'old' });
          tx.oncomplete = () => {
            db.close();
            res();
          };
          tx.onerror = () => rej(tx.error);
        };
        req.onerror = () => rej(req.error);
      });
    },
    { plan: PLAN, profile: PROFILE, settings: SETTINGS, sessions: SESSIONS },
  );

  await page.goto('./');
  // Профиль v2 без принятия документов — просим принять текущие версии
  await expect(page.getByRole('heading', { name: 'Мы обновили документы' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await page.getByRole('button', { name: 'Принять' }).click();
  await expect(page.getByRole('heading', { name: 'Следующая по циклу' })).toBeVisible();

  // Тема v2 «dark» → classic-dark, настройки отдыха и звук сохранились
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'classic-dark');
  await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Базовые упражнения' }).locator('output')).toHaveText('3:00');
  await expect(page.getByRole('switch', { name: 'Звук' })).toHaveAttribute('aria-checked', 'false');

  // История на месте, заметка видна целиком
  await page.getByRole('link', { name: 'История' }).click();
  await page.getByRole('link', { name: /Грудь \+ трицепс/ }).click();
  await expect(page.getByText('Хорошо пошло')).toBeVisible();

  // Текущая схема: остатки v1 удалены, принятие записано
  const db = await page.evaluate(
    () =>
      new Promise<{ version: number; stores: string[]; legacy: unknown; accepted: unknown }>((res) => {
        const r = indexedDB.open('training-pwa');
        r.onsuccess = () => {
          const d = r.result;
          const kv = d.transaction('kv').objectStore('kv');
          const a = kv.get('legacyPrefs');
          const p = kv.get('profile');
          p.onsuccess = () =>
            res({
              version: d.version,
              stores: [...d.objectStoreNames],
              legacy: a.result ?? null,
              accepted: (p.result as { legalAccepted: unknown }).legalAccepted,
            });
        };
      }),
  );
  expect(db.version).toBe(4);
  expect(db.stores.sort()).toEqual(['kv', 'sessions']);
  expect(db.legacy).toBeNull();
  expect(db.accepted).toMatchObject({ privacy: '1.2', terms: '1.0' });
});

// ---------- v3 → v4 (релиз 3.0): новый набор тем ----------

const PROFILE_V3 = {
  ...PROFILE,
  locale: 'en',
  legalAccepted: { privacy: '1.2', terms: '1.0', at: '2026-11-12T10:00:00.000Z' },
};
const SETTINGS_V3 = {
  theme: 'classic-orange',
  tipsEnabled: false,
  restBaseSec: 180,
  restIsoSec: 75,
  sound: false,
  wakeLock: true,
  tipState: {},
  weightWarningIgnored: ['hammer-curl'],
};

/** База версии 3 (приложение 2.3–2.6) с данными; settings: null — настройки ни разу не сохранялись */
async function seedV3(page: Page, settings: Record<string, unknown> | null, boot: Record<string, unknown>) {
  await page.goto('./robots.txt');
  await page.evaluate(
    async ({ plan, profile, settings, sessions, boot }) => {
      localStorage.clear();
      localStorage.setItem('tp-install-skip', new Date().toISOString());
      localStorage.setItem('tp-boot', JSON.stringify(boot));
      await new Promise<void>((res) => {
        const r = indexedDB.deleteDatabase('training-pwa');
        r.onsuccess = r.onerror = r.onblocked = () => res();
      });
      await new Promise<void>((res, rej) => {
        const req = indexedDB.open('training-pwa', 3);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore('kv');
          const s = db.createObjectStore('sessions', { keyPath: 'id' });
          s.createIndex('by-started', 'startedAt');
          s.createIndex('by-day', 'dayId');
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['kv', 'sessions'], 'readwrite');
          const kv = tx.objectStore('kv');
          kv.put(profile, 'profile');
          kv.put(plan, 'plan');
          if (settings) kv.put(settings, 'settings');
          for (const x of sessions) tx.objectStore('sessions').put(x);
          tx.oncomplete = () => {
            db.close();
            res();
          };
          tx.onerror = () => rej(tx.error);
        };
        req.onerror = () => rej(req.error);
      });
    },
    { plan: PLAN, profile: PROFILE_V3, settings, sessions: SESSIONS, boot },
  );
}

const dbState = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ version: number; settings: Record<string, unknown> | null; sessions: number }>((res) => {
        const r = indexedDB.open('training-pwa');
        r.onsuccess = () => {
          const d = r.result;
          const tx = d.transaction(['kv', 'sessions']);
          const s = tx.objectStore('kv').get('settings');
          const n = tx.objectStore('sessions').count();
          tx.oncomplete = () => {
            d.close();
            res({
              version: d.version,
              settings: (s.result as Record<string, unknown>) ?? null,
              sessions: n.result,
            });
          };
        };
      }),
  );

test('v3 → v4: saved classic-orange becomes Gradient, other settings and history stay', async ({ page }) => {
  await seedV3(page, SETTINGS_V3, { locale: 'en', theme: 'classic-orange' });
  await page.goto('./');
  // тема применена до загрузки приложения (загрузочный скрипт) и после неё — та же
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'gradient');
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'gradient');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
    'rgb(243, 241, 236)',
  );

  const db = await dbState(page);
  expect(db.version).toBe(4);
  expect(db.settings).toEqual({ ...SETTINGS_V3, theme: 'gradient', motion: 'system' });
  expect(db.sessions).toBe(1);

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(
    page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Gradient', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('group', { name: 'Compound exercises' }).locator('output')).toHaveText('3:00');
  await expect(page.getByRole('switch', { name: 'Sound' })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.locator('.list .row').first()).toBeVisible();
});

for (const [from, to] of [
  ['blue', 'slate-blue'],
  ['violet', 'violet-dusk'],
  ['green', 'pine-dusk'],
  ['rose', 'rose-dusk'],
  ['gradient-1', 'gradient'],
  ['gradient-2', 'golden-hour'],
  ['classic-light', 'classic-light'],
  ['monochrome', 'monochrome'],
] as const) {
  test(`v3 → v4: saved theme ${from} → ${to}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'iPhone 11', 'одного проекта достаточно');
    await seedV3(page, { ...SETTINGS_V3, theme: from }, { locale: 'en', theme: from });
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-theme', to);
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', to);
    expect((await dbState(page)).settings).toMatchObject({ theme: to, restBaseSec: 180 });
  });
}

test('v3 → v4: theme was never chosen (no saved settings) → Auto, the new default', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await seedV3(page, null, { locale: 'en' });
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'auto');
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'auto');
  // «Авто» при тёмной системной теме — Classic Dark
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(17, 17, 20)');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(
    page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Auto', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  expect((await dbState(page)).sessions).toBe(1);
});
