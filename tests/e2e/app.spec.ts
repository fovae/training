import { expect, test } from '@playwright/test';
import { fresh, onboard } from './helpers';

const INCLINE = 'Incline dumbbell press';

test('onboarding: English by default, gentle validation, back steps', async ({ page }) => {
  await fresh(page);
  // Язык телефона (ru-RU в конфиге) не подставляется
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Next' }).click();
  // Без галочки 16+ дальше нельзя — с понятным сообщением
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Please confirm that you are 16 or older')).toBeVisible();
  await page.getByRole('checkbox', { name: 'I am 16 or older' }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  // Вес и рост обязательны, остальное — нет
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Enter your body weight.')).toBeVisible();
  await expect(page.getByText('Enter your height.')).toBeVisible();
  await page.getByLabel('Body weight, kg').fill('72.5');
  await page.getByLabel('Height, cm').fill('176');
  await page.getByLabel('Age').fill('12');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Age should be a number from 16 to 100')).toBeVisible();
  await page.getByLabel('Age').fill('');
  await page.getByRole('radio', { name: 'Prefer not to say' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  // Назад и снова вперёд — значения сохранились
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByLabel('Body weight, kg')).toHaveValue('72.5');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('radio', { name: "I'm a beginner, this is my first time" }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('radio', { name: /Full body/ }).click();
  await page.getByRole('button', { name: 'Start training' }).click();
  await expect(page.getByRole('heading', { name: 'Workout A' })).toBeVisible();
  // Значения в настройках
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByLabel('Body weight, kg')).toHaveValue('72.5');
  await expect(page.getByLabel('Level', { exact: true })).toHaveValue('first');
});

test('layout: tab bar, safe area meta, no horizontal scroll, 44pt targets', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  for (const t of ['Today', 'Plan', 'Exercises', 'History', 'Settings'])
    await expect(page.getByRole('link', { name: t, exact: true })).toBeVisible();
  await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content', /viewport-fit=cover/);
  await expect(page.locator('meta[name=author]')).toHaveAttribute('content', 'Fovae & Claude');
  for (const tab of ['today', 'plan', 'library', 'settings']) {
    await page.goto('./#/' + tab);
    await page.waitForSelector('main .screen');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, tab).toBeLessThanOrEqual(0);
    const small = await page.$$eval('.nav-item, .seg-btn, .set-done, .btn, .choice', (els) =>
      els.filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent),
    );
    expect(small, tab).toEqual([]);
  }
});

test('language switch applies to the whole UI at once', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Language').selectOption('ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByRole('heading', { name: 'Настройки', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Упражнения' })).toBeVisible();
  await page.getByRole('link', { name: 'Упражнения' }).click();
  await expect(page.getByRole('link', { name: /Жим гантелей на наклонной скамье/ })).toBeVisible();
  // После перезагрузки язык сохраняется
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Упражнения', level: 1 })).toBeVisible();
});

test('plan editor: empty days, picker with search and filters, edit, reorder, copy, clear', async ({
  page,
}) => {
  await fresh(page);
  await onboard(page, { start: 'Empty days', days: 2 });
  // Пустой план — сразу на вкладку «План»
  await expect(page.getByRole('heading', { name: 'Plan', level: 1 })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(2);

  await page.getByRole('button', { name: 'Add exercise' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add exercise' });
  await sheet.getByRole('searchbox').fill('press');
  await expect(sheet.getByRole('button', { name: /Leg press/ })).toBeVisible();
  await sheet.getByRole('searchbox').fill('');
  await sheet.getByLabel('Muscle').selectOption('triceps');
  await sheet.getByLabel('Equipment').selectOption('cable');
  await expect(sheet.getByText('3 exercises')).toBeVisible();
  await sheet.getByRole('button', { name: /Rope triceps pushdown/ }).click();
  await sheet.getByLabel('Muscle').selectOption('');
  await sheet.getByLabel('Equipment').selectOption('');
  await sheet.getByRole('searchbox').fill('incline dumbbell press');
  await sheet.getByRole('button', { name: new RegExp(INCLINE) }).click();
  await sheet.getByRole('button', { name: /Done · 2 added/ }).click();
  await expect(sheet).toBeHidden();

  const items = page.locator('.item');
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText('Rope triceps pushdown');
  // Порядок
  await items.nth(1).locator('summary').click();
  await page.getByRole('button', { name: `Move ${INCLINE} up` }).click();
  await expect(items.first()).toContainText(INCLINE);
  // Подходы, повторы, вес, отдых, «необязательное»
  await items.first().locator('summary').click();
  await page.getByRole('button', { name: `${INCLINE}: sets: more` }).click();
  await page.getByLabel(`${INCLINE}: minimum`).fill('6');
  await page.getByLabel(`${INCLINE}: minimum`).blur();
  await page.getByLabel(`${INCLINE}: working weight, kg`).fill('20');
  await page.getByLabel(`${INCLINE}: working weight, kg`).blur();
  await page.getByLabel(`${INCLINE}: rest`).selectOption('180');
  await page.getByRole('switch', { name: `${INCLINE}: optional` }).click();
  await expect(items.first()).toContainText('4 × 6–12 · 3:00 · optional');

  // Копировать в день 2, затем очистить день 1
  await page.getByRole('button', { name: 'Copy to…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Day 2/ }).click();
  await page.getByRole('button', { name: 'Clear' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Clear' }).click();
  await expect(items).toHaveCount(0);
  await page.getByRole('tab', { name: /Day 2/ }).click();
  await expect(items).toHaveCount(2);

  // До 7 дней, потом кнопка пропадает; режим «дни недели»
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Add day' }).click();
  await expect(page.getByRole('tab')).toHaveCount(7);
  await expect(page.getByRole('button', { name: 'Add day' })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Weekdays' }).click();
  await expect(page.getByLabel('Day of week')).toBeVisible();

  // План переживает перезагрузку
  await page.reload();
  await expect(page.getByRole('tab')).toHaveCount(7);
});

test('workout: sets, timer, notes, reload, finish, history, prefill', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout in progress' })).toBeVisible();

  for (let i = 1; i <= 3; i++) {
    await page.getByLabel(`${INCLINE}, set ${i}: weight, kg`).fill('22.5');
    await page.getByLabel(`${INCLINE}, set ${i}: reps`).fill('12');
    await page.getByRole('button', { name: `${INCLINE}, set ${i}: done` }).click();
  }
  const timer = page.getByRole('region', { name: 'Rest timer' });
  await expect(timer).toBeVisible();
  await expect(timer.getByRole('timer')).toHaveText(/2:(2\d|30)/);
  await page.getByRole('button', { name: 'Skip rest' }).click();
  await expect(timer).toBeHidden();

  // Пропуск необязательного и заметки
  await page
    .getByRole('article', { name: 'Single-arm cable pushdown' })
    .getByRole('button', { name: 'Skip' })
    .click();
  await page.getByRole('article', { name: INCLINE }).getByRole('button', { name: 'Note' }).click();
  await page.getByLabel(`Note: ${INCLINE}`).fill('Felt strong');
  await page.getByLabel(`Note: ${INCLINE}`).blur();
  await page.getByLabel('Workout note').fill('Good session');
  await page.getByLabel('Workout note').blur();

  // Тренировка переживает перезапуск
  await page.reload();
  await expect(page.getByText('Workout in progress')).toBeVisible();
  await expect(page.getByLabel(`${INCLINE}, set 1: weight, kg`)).toHaveValue('22.5');
  await expect(page.getByLabel(`Note: ${INCLINE}`)).toHaveValue('Felt strong');

  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText('Workout saved')).toBeVisible();
  // Следующая по циклу — день 2
  await expect(page.getByRole('heading', { name: 'Back + biceps + forearms' })).toBeVisible();

  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.locator('.week-big')).toContainText('1');
  await page.getByRole('link', { name: /Chest \+ triceps/ }).click();
  await expect(page.getByText('Good session')).toBeVisible();
  await expect(page.getByText('Felt strong')).toBeVisible();
  await expect(page.getByText('22.5×12 · 22.5×12 · 22.5×12')).toBeVisible();

  // Предзаполнение и подсказка прогрессии на дне 1
  await page.getByRole('link', { name: 'Today' }).click();
  await page.getByRole('tab', { name: /Day 1/ }).click();
  await expect(page.getByText('If you like, you can add a little weight').first()).toBeVisible();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByLabel(`${INCLINE}, set 2: weight, kg`)).toHaveValue('22.5');
  await expect(page.getByLabel(`${INCLINE}, set 2: reps`)).toHaveValue('12');
});

test('timer counts from timestamps and signals the end', async ({ page }) => {
  await page.clock.install();
  await fresh(page);
  await onboard(page);
  await page.getByRole('button', { name: 'Start workout' }).click();
  const name = 'High-to-low cable fly';
  await page.getByLabel(`${name}, set 1: reps`).fill('15');
  await page.getByRole('button', { name: `${name}, set 1: done` }).click();
  const timer = page.getByRole('region', { name: 'Rest timer' });
  const clock = timer.getByRole('timer');
  // Часы в тесте идут по-настоящему, а CI-раннер может быть медленным — сверяем относительно
  const secs = async () => {
    const [m, s] = (await clock.textContent())!.split(':').map(Number);
    return m! * 60 + s!;
  };
  await expect(clock).toHaveText(/^1:(2\d|30)$/); // изоляция — 90 с по умолчанию
  const before = await secs();
  await page.getByRole('button', { name: 'Plus 15 seconds' }).click();
  await expect.poll(secs).toBeGreaterThanOrEqual(before + 10);
  expect(await secs()).toBeLessThanOrEqual(before + 15);
  await page.getByRole('button', { name: 'Minus 15 seconds' }).click();
  // ровно до конца отдыха: сигнал подаётся, только если отдых закончился < 30 с назад
  await page.clock.fastForward((await secs()) * 1000 + 1000);
  await expect(clock).toHaveText('Go!');
  await expect(page.locator('.flash')).toBeVisible();
});

test('weekdays mode: today follows the day of the week', async ({ page }) => {
  // 2026-11-11 — среда (weekday 2)
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00'));
  await fresh(page);
  await onboard(page, { start: /Full body/, mode: 'Weekdays', days: 2 }); // пн и чт
  await expect(page.getByRole('heading', { name: 'Rest day' })).toBeVisible();
  await page.getByRole('button', { name: 'Train anyway' }).click();
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
});

test('settings: export and import JSON, reset returns to onboarding', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByLabel(`${INCLINE}, set 1: weight, kg`).fill('20');
  await page.getByLabel(`${INCLINE}, set 1: reps`).fill('10');
  await page.getByRole('button', { name: `${INCLINE}, set 1: done` }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Finish' }).click();

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const file = await dl;
  const path = await file.path();
  expect(file.suggestedFilename()).toMatch(/^training-backup-\d{4}-\d{2}-\d{2}\.json$/);

  await page.getByRole('button', { name: 'Delete all data' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete everything' }).click();
  await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible();

  await onboard(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByTestId('import-input').setInputFiles(path);
  await expect(page.getByRole('alertdialog')).toContainText('1 workout');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByText('Data restored')).toBeVisible();
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByRole('link', { name: /Chest \+ triceps/ })).toBeVisible();
});

test('theme switch changes theme-color', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name=theme-color]').first()).toHaveAttribute('content', '#111114');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(17, 17, 20)');
});

test('library: search, filters and full card', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Exercises' }).click();
  await expect(page.getByText('27 exercises')).toBeVisible();
  await page.getByLabel('Equipment').selectOption('bodyweight');
  await expect(page.locator('.lib-card')).toHaveCount(3);
  await page.getByLabel('Equipment').selectOption('');
  await page.getByRole('searchbox').fill('plank');
  await page.getByRole('link', { name: /Side plank/ }).click();
  await expect(page.getByRole('heading', { name: 'Side plank' })).toBeVisible();
  for (const h of ['Technique', 'Common mistakes'])
    await expect(page.getByRole('heading', { name: h })).toBeVisible();
  await expect(page.getByText('Safety.')).toBeVisible();
  await expect(page.locator('.pic svg')).toBeVisible();
});
