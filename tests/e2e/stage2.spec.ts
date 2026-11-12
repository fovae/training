import { writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { buildBackup } from '../../src/backup/format';
import { DEFAULT_SETTINGS } from '../../src/types';
import { fresh, kv, onboard } from './helpers';

const INCLINE = 'Incline dumbbell press';

/** Одна тренировка дня 1 (Сплит 3+1): первые подходы жима с заданными повторами */
async function doWorkout(page: Page, reps: number, weight = '20') {
  await page.getByRole('link', { name: 'Today' }).click();
  await page.getByRole('tab', { name: /Day 1/ }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  for (let i = 1; i <= 3; i++) {
    await page.getByLabel(`${INCLINE}, set ${i}: weight, kg`).fill(weight);
    await page.getByLabel(`${INCLINE}, set ${i}: reps`).fill(String(reps));
    await page.getByRole('button', { name: `${INCLINE}, set ${i}: done` }).click();
  }
  await page.getByRole('button', { name: 'Skip rest' }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText('Workout saved')).toBeVisible();
}

test('levels: beginners see technique open and the light-start tip; experienced do not', async ({ page }) => {
  await fresh(page);
  await onboard(page, { level: "I'm a beginner, this is my first time" });
  const card = page.getByRole('article', { name: INCLINE });
  await expect(card.locator('details.tech')).toHaveAttribute('open', '');
  await expect(card.getByText('start with a light weight')).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Level', { exact: true }).selectOption('veteran');
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(card.locator('details.tech')).not.toHaveAttribute('open', '');
  await expect(page.getByText('start with a light weight')).toHaveCount(0);
});

test('weight warning: unrealistic weight on a confirmed exercise; normal values pass; "don\'t warn again"', async ({
  page,
}) => {
  await fresh(page);
  await onboard(page); // 80 кг, пол не указан, средний уровень → порог ≈ 91 кг на гантель
  await page.getByRole('button', { name: 'Start workout' }).click();
  const w1 = page.getByLabel(`${INCLINE}, set 1: weight, kg`);

  // Обычный вес — без окна
  await w1.fill('24');
  await w1.blur();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);

  // Нереальный — окно, «Исправить» возвращает прежнее значение
  await w1.fill('150');
  await w1.blur();
  const dlg = page.getByRole('alertdialog', { name: 'This is a very heavy weight' });
  await expect(dlg).toContainText('at your own risk');
  await dlg.getByRole('button', { name: 'Fix' }).click();
  await expect(w1).toHaveValue('24');

  // «Всё верно» — вес сохраняется
  await w1.fill('150');
  await w1.blur();
  await dlg.getByRole('button', { name: "That's right" }).click();
  await expect
    .poll(
      async () =>
        (await kv<{ entries: { sets: { weightKg?: number }[] }[] }>(page, 'activeSession'))?.entries[0]
          ?.sets[0]?.weightKg,
    )
    .toBe(150);
  await page.reload();
  await expect(page.getByLabel(`${INCLINE}, set 1: weight, kg`)).toHaveValue('150');

  // «Больше не предупреждать по этому упражнению»
  const w2 = page.getByLabel(`${INCLINE}, set 2: weight, kg`);
  await w2.fill('160');
  await w2.blur();
  await dlg.getByRole('checkbox').check();
  await dlg.getByRole('button', { name: "That's right" }).click();
  const w3 = page.getByLabel(`${INCLINE}, set 3: weight, kg`);
  await w3.fill('170');
  await w3.blur();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);

  // Станок (жим ногами) — данных нет, предупреждения нет даже на 900 кг
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByText('Weight warnings are off for 1 exercise')).toBeVisible();
});

test('typo check: 8× the last record suggests the value', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  await doWorkout(page, 10, '20');
  await page.getByRole('link', { name: 'Today' }).click();
  await page.getByRole('tab', { name: /Day 1/ }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  const w = page.getByLabel(`${INCLINE}, set 1: weight, kg`);
  await w.fill('200');
  await w.blur();
  const dlg = page.getByRole('alertdialog', { name: 'Did you mean 20 kg?' });
  await dlg.getByRole('button', { name: 'Fix' }).click();
  await expect(w).toHaveValue('20');
});

test('tips: progression shows after top reps, can be dismissed, switch turns all tips off', async ({
  page,
}) => {
  await fresh(page);
  await onboard(page);
  await doWorkout(page, 12);
  await page.getByRole('link', { name: 'Today' }).click();
  await page.getByRole('tab', { name: /Day 1/ }).click();
  const tip = page.getByRole('note').filter({ hasText: 'you can add a little weight' });
  await expect(tip).toHaveCount(1);
  // Итог тренировки: «На следующий раз»
  await page.getByRole('link', { name: 'History' }).click();
  await page.getByRole('link', { name: /Chest \+ triceps/ }).click();
  await expect(page.getByRole('heading', { name: 'For next time' })).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('switch', { name: 'Show tips' }).click();
  await page.getByRole('link', { name: 'Today' }).click();
  await page.getByRole('tab', { name: /Day 1/ }).click();
  await expect(tip).toHaveCount(0);

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('switch', { name: 'Show tips' }).click();
  await page.getByRole('link', { name: 'Today' }).click();
  await page.getByRole('tab', { name: /Day 1/ }).click();
  await tip.getByRole('button', { name: 'Hide this tip' }).click();
  await expect(tip).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('note').filter({ hasText: 'you can add a little weight' })).toHaveCount(0);
});

test('backup via the share sheet; reminder every 7 days with a fake clock', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-12T10:00:00') });
  await fresh(page);
  await onboard(page);
  await doWorkout(page, 10);
  // Тренировки есть, копии не было — напоминание
  await page.getByRole('link', { name: 'Today' }).click();
  const reminder = page.getByRole('complementary', { name: 'Backup reminder' });
  await expect(reminder).toContainText("Save a copy so you don't lose your progress");
  // Закрыли — нет 3 дня
  await reminder.getByRole('button', { name: 'Remind me later' }).click();
  await expect(reminder).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await kv<{ backupReminderDismissedAt?: string }>(page, 'settings'))?.backupReminderDismissedAt,
    )
    .toBeTruthy();
  await page.clock.setFixedTime(new Date('2026-11-14T10:00:00'));
  await page.reload();
  await expect(reminder).toHaveCount(0);
  await page.clock.setFixedTime(new Date('2026-11-15T11:00:00'));
  await page.reload();
  await expect(reminder).toBeVisible();

  // «Сохранить копию» через системное меню «Поделиться» (подмена navigator.share)
  await page.evaluate(() => {
    const w = window as unknown as { __shared?: string };
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', {
      value: async (d: { files: File[] }) => {
        w.__shared = `${d.files[0]!.name}|${d.files[0]!.type}`;
      },
      configurable: true,
    });
  });
  await reminder.getByRole('button', { name: 'Save a copy' }).click();
  await expect(page.getByText('Copy ready')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __shared?: string }).__shared)).toBe(
    'simple-training-backup-2026-11-15.json|application/json',
  );
  await expect(reminder).toHaveCount(0);
  await expect
    .poll(async () => (await kv<{ lastBackupAt?: string }>(page, 'settings'))?.lastBackupAt)
    .toMatch(/^2026-11-15/);
  // Через 7 дней — снова
  await page.clock.setFixedTime(new Date('2026-11-22T12:00:00'));
  // за 10 дней истёк и недельный пропуск экрана установки — ставим заново
  await page.evaluate(() => localStorage.setItem('tp-install-skip', new Date().toISOString()));
  await page.reload();
  await expect(reminder).toBeVisible();
});

test('restore: strings with <script> and <img onerror> are shown as text', async ({ page }, info) => {
  await fresh(page);
  await onboard(page);
  const evil = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';
  const file = await buildBackup(
    {
      profile: null,
      plan: null,
      settings: { ...DEFAULT_SETTINGS },
      sessions: [
        {
          id: 'x1',
          dayId: 'day-1',
          startedAt: '2026-11-10T08:00:00.000Z',
          endedAt: '2026-11-10T09:00:00.000Z',
          note: evil,
          entries: [
            { exerciseId: 'incline-db-press', note: evil, sets: [{ weightKg: 20, reps: 10, done: true }] },
          ],
        },
      ],
    },
    '2.3.0',
  );
  const path = info.outputPath('evil.json');
  writeFileSync(path, JSON.stringify(file));
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByTestId('import-input').setInputFiles(path);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace current data' }).click();
  await page.getByRole('link', { name: 'History' }).click();
  await page.locator('a.row[href*="workout"]').first().click();
  await expect(page.getByText(evil).first()).toBeVisible();
  expect(await page.locator('main img').count()).toBe(0);
  expect(await page.locator('main script').count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();

  // Битая контрольная сумма — вежливый отказ
  const broken = { ...file, checksum: 'sha256:' + '0'.repeat(64) };
  writeFileSync(path, JSON.stringify(broken));
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByTestId('import-input').setInputFiles(path);
  await expect(page.getByText('checksum mismatch')).toBeVisible();
});

test('legal: documents accepted in onboarding; a new version asks again; licences open from About', async ({
  page,
}) => {
  await fresh(page);
  await onboard(page);
  // Принятые версии — из метаданных документов
  const accepted = () =>
    page.evaluate(
      () =>
        new Promise<{ privacy: string; terms: string } | null>((res) => {
          const r = indexedDB.open('training-pwa');
          r.onsuccess = () => {
            const g = r.result.transaction('kv').objectStore('kv').get('profile');
            g.onsuccess = () =>
              res((g.result as { legalAccepted: { privacy: string; terms: string } }).legalAccepted);
          };
        }),
    );
  expect(await accepted()).toMatchObject({ privacy: '1.2', terms: '1.0' });

  // Как будто раньше была принята Privacy 1.1 — после запуска просим принять снова
  await page.evaluate(
    () =>
      new Promise<void>((res) => {
        const r = indexedDB.open('training-pwa');
        r.onsuccess = () => {
          const kv = r.result.transaction('kv', 'readwrite').objectStore('kv');
          const g = kv.get('profile');
          g.onsuccess = () => {
            const p = g.result as { legalAccepted: { privacy: string } };
            p.legalAccepted.privacy = '1.1';
            kv.put(p, 'profile').onsuccess = () => res();
          };
        };
      }),
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'We updated our documents' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  // Читать можно без принятия
  await page.getByRole('link', { name: /Terms of Use/ }).click();
  await expect(page.getByRole('heading', { name: 'Terms of Use', level: 1 })).toBeVisible();
  await expect(page.getByText('Version 1.0, updated 12 November 2026')).toBeVisible();
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'We updated our documents' })).toBeVisible();
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'We updated our documents' })).toHaveCount(0);

  // Документ: оглавление, внешние ссылки — в новой вкладке с noopener noreferrer
  await page.goto('./#/legal/privacy');
  await expect(page.getByRole('navigation', { name: 'Contents' })).toBeVisible();
  const gh = page.getByRole('link', { name: 'GitHub’s Privacy Statement' });
  await expect(gh).toHaveAttribute('target', '_blank');
  await expect(gh).toHaveAttribute('rel', 'noopener noreferrer');

  // Лицензии — из «About», собраны при сборке
  await page.goto('./#/settings');
  await page.getByRole('link', { name: 'Open-source licences' }).click();
  for (const name of ['preact', '@fontsource-variable/manrope', 'idb', 'workbox-precaching'])
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByText(/OFL-1\.1/)).toBeVisible();
});

test('Russian: legal documents open in English with a notice', async ({ page }) => {
  await fresh(page);
  await onboard(page, { lang: 'ru' });
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.goto('./#/legal/terms');
  await expect(page).toHaveURL(/#\/legal\/terms$/);
  // текст документа — отдельный чанк
  await expect(page.getByRole('heading', { name: 'Terms of Use', level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Юридические документы пока доступны только на английском')).toBeVisible();
});
