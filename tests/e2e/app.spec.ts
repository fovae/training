import { expect, test } from '@playwright/test';
import { EXERCISES } from '../../src/data/catalog';
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
  await expect(page.getByText('To continue, confirm that you are at least 16')).toBeVisible();
  await page.getByRole('checkbox', { name: /I am at least 16 years old and I accept/ }).check();
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
  await expect(page.getByRole('heading', { name: 'Full body · 1' })).toBeVisible();
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
  const gap = await page.evaluate(
    () =>
      document.querySelector('.ex-grid')!.getBoundingClientRect().top -
      document.querySelector('.dayhead')!.getBoundingClientRect().bottom,
  );
  expect(gap, 'dayhead → cards').toBeGreaterThanOrEqual(16);
  for (const tab of ['today', 'plan', 'library', 'settings']) {
    await page.goto('./#/' + tab);
    await page.waitForSelector('main .screen');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, tab).toBeLessThanOrEqual(0);
    const small = await page.$$eval('.nav-item, .seg-btn, .set-done, .btn, .choice', (els) =>
      els.filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => e.textContent),
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
  // имя кнопки — «название + мышцы»: «Leg press Quads…», а не «Leg press calf raise…»
  await expect(sheet.getByRole('button', { name: /^Leg press [A-Z]/ })).toBeVisible();
  await sheet.getByRole('searchbox').fill('');
  await sheet.getByLabel('Muscle').selectOption('triceps');
  await sheet.getByLabel('Equipment').selectOption('cable');
  const tricepsCable = EXERCISES.filter(
    (e) =>
      (e.primaryMuscles.includes('triceps') || e.secondaryMuscles.includes('triceps')) &&
      e.equipment.includes('cable'),
  ).length;
  await expect(sheet.getByText(`${tricepsCable} exercises`)).toBeVisible();
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
  // Средний уровень: последнее добавленное упражнение сразу открыто, курсор в весе (уровень ТЗ этапа 2)
  await expect(items.nth(1).locator('details')).toHaveAttribute('open', '');
  await expect(page.getByLabel(`${INCLINE}: working weight, kg`)).toBeFocused();
  // Порядок
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
  // Переключателя расписания на экране плана нет — он в настройках
  await expect(page.getByRole('radio', { name: 'Weekdays' })).toHaveCount(0);
  // Карточка расписания — в самом низу экрана, ниже правил
  const card = page.getByRole('region', { name: 'Schedule: Cycle' });
  await expect(card).toBeVisible();
  const order = await page.evaluate(() => {
    const main = document.querySelector('main .screen')!;
    const kids = [...main.children];
    const rules = kids.findIndex((k) => k.querySelector('.rules'));
    const sched = kids.findIndex((k) => k.classList.contains('schedule-card'));
    return { rules, sched, last: kids.length - 1 };
  });
  expect(order.sched).toBeGreaterThan(order.rules);
  expect(order.sched).toBe(order.last);
  await card.getByRole('link', { name: 'Change in Settings' }).click();
  await expect(page).toHaveURL(/#\/settings\/schedule$/);
  await expect(page.locator('#schedule')).toBeInViewport();
  await page.getByRole('link', { name: 'Plan', exact: true }).click();

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
  await onboard(page, { start: /Light maintenance/, mode: 'Weekdays' }); // 2 дня: пн и чт
  await expect(page.getByRole('heading', { name: 'Rest day' })).toBeVisible();
  await page.getByRole('button', { name: 'Train anyway' }).click();
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
});

test('backup: save a copy (download fallback), delete all data, restore, undo', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByLabel(`${INCLINE}, set 1: weight, kg`).fill('20');
  await page.getByLabel(`${INCLINE}, set 1: reps`).fill('10');
  await page.getByRole('button', { name: `${INCLINE}, set 1: done` }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Finish' }).click();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  // Подписи из Terms и Privacy — буквально: «Settings → About», «Settings → Delete all data»
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
  await expect(page.getByText('not saved yet')).toBeVisible();
  // Нет системного «Поделиться» с файлом — обычная загрузка
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save a copy' }).click();
  const file = await dl;
  const path = await file.path();
  expect(file.suggestedFilename()).toMatch(/^simple-training-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.getByText('not saved yet')).toHaveCount(0);

  await page.getByRole('button', { name: 'Delete all data' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('cannot be undone');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete everything' }).click();
  await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible();

  await onboard(page, { start: /Full body/ });
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByTestId('import-input').setInputFiles(path);
  const dlg = page.getByRole('alertdialog');
  await expect(dlg).toContainText('1 workout');
  await expect(dlg).toContainText('Replace current data?');
  await dlg.getByRole('button', { name: 'Replace current data' }).click();
  await expect(page.getByText('Data restored')).toBeVisible();
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByRole('link', { name: /Chest \+ triceps/ })).toBeVisible();

  // Откат восстановления — до следующего изменения данных
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Undo restore' }).click();
  await expect(page.getByText('Restore undone')).toBeVisible();
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByText('Finished workouts will appear here')).toBeVisible();
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByRole('heading', { name: 'Full body · 1' })).toBeVisible();
});

test('library: search, filters and full card', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Exercises' }).click();
  await expect(page.getByText(`${EXERCISES.length} exercises`)).toBeVisible();
  await page.getByLabel('Equipment').selectOption('bodyweight');
  await expect(page.locator('.lib-card')).toHaveCount(
    EXERCISES.filter((e) => e.equipment.includes('bodyweight')).length,
  );
  await page.getByLabel('Equipment').selectOption('');
  await page.getByRole('searchbox').fill('plank');
  await page.getByRole('link', { name: /Side plank/ }).click();
  await expect(page.getByRole('heading', { name: 'Side plank' })).toBeVisible();
  for (const h of ['Technique', 'Common mistakes'])
    await expect(page.getByRole('heading', { name: h })).toBeVisible();
  await expect(page.getByText('Safety.')).toBeVisible();
  await expect(page.locator('.pic svg')).toBeVisible();
});

test('schedule switch lives in Settings; weekday labels follow the mode', async ({ page }) => {
  await fresh(page);
  await onboard(page); // Сплит 3+1, цикл
  const switchTo = async (btn: string) => {
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: btn }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Switch' }).click();
  };
  const weekdayMarks = () => page.locator('.seg .seg-num', { hasText: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/ });

  // Цикл: нет подписей дней недели
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByRole('tab', { name: 'Day 1', exact: true })).toBeVisible();
  await expect(weekdayMarks()).toHaveCount(0);

  // Дни недели: подписи появились, выбираем свой день для дня 1
  await switchTo('Switch to weekdays');
  await page.getByRole('link', { name: 'Plan' }).click();
  await expect(page.getByRole('region', { name: 'Schedule: Weekdays' })).toBeVisible();
  await page.getByLabel('Day of week').selectOption('5'); // суббота
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(weekdayMarks()).toHaveCount(4);
  await expect(page.getByRole('tab', { name: 'Day 1, Sat' })).toBeVisible();

  // Обратно в цикл: подписи пропали везде (баг: оставались)
  await switchTo('Switch to cycle');
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(weekdayMarks()).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Day 1', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Plan' }).click();
  await expect(page.locator('.days .num', { hasText: '·' })).toHaveCount(0);
  await expect(page.getByLabel('Day of week')).toHaveCount(0);

  // Снова дни недели: выбранная суббота сохранилась
  await switchTo('Switch to weekdays');
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByRole('tab', { name: 'Day 1, Sat' })).toBeVisible();
});

test('new profile: no "Keep my current plan" (only for v1 data)', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Body weight, kg').fill('70');
  await page.getByLabel('Height, cm').fill('170');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('radio', { name: 'Intermediate' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('radio', { name: /Keep my current plan/ })).toHaveCount(0);
  const first = page.getByRole('radiogroup', { name: 'Start with' }).getByRole('radio').first();
  await expect(first).toContainText('Empty days');
  await expect(first).toHaveAttribute('aria-checked', 'true');
  // Выбор расписания и числа дней — прямо в онбординге
  await expect(page.getByRole('radio', { name: 'Cycle' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('group', { name: 'Workouts per week' }).locator('output')).toHaveText('3');
});

test('onboarding: Next is full width without Back; last step clears the bottom bar', async ({ page }) => {
  // вёрстку меряем в покое, без анимации появления
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fresh(page);
  const next = page.getByRole('button', { name: 'Next' });
  const bar = await page.locator('.ob-actions').boundingBox();
  const btn = await next.boundingBox();
  expect(btn!.width).toBeGreaterThan(bar!.width - 2 * 40);
  await next.click();
  await page.getByRole('checkbox').check();
  await next.click();
  await page.getByLabel('Body weight, kg').fill('70');
  await page.getByLabel('Height, cm').fill('170');
  await next.click();
  // Шаг 4: отступ между вводным абзацем и первой карточкой
  const lead = await page.locator('.onboarding section > p').first().boundingBox();
  const choice = await page.locator('.choice').first().boundingBox();
  expect(choice!.y - (lead!.y + lead!.height)).toBeGreaterThanOrEqual(12);
  await page.getByRole('radio', { name: 'Intermediate' }).click();
  await next.click();
  // Шаг 5: последняя подпись при прокрутке до конца не закрыта панелью
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  const note = await page.getByText('Everything can be edited later').boundingBox();
  const panel = await page.locator('.ob-actions').boundingBox();
  expect(note!.y + note!.height).toBeLessThanOrEqual(panel!.y - 8);
});

test('inputs: numeric keyboards, enterkeyhint, no autocomplete, font ≥ 16px', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Body weight, kg')).toHaveAttribute('inputmode', 'decimal');
  await expect(page.getByLabel('Height, cm')).toHaveAttribute('inputmode', 'decimal');
  await expect(page.getByLabel('Age', { exact: true })).toHaveAttribute('inputmode', 'numeric');
  await page.getByRole('link', { name: 'Today' }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByLabel(`${INCLINE}, set 1: weight, kg`)).toHaveAttribute('inputmode', 'decimal');
  await expect(page.getByLabel(`${INCLINE}, set 1: reps`)).toHaveAttribute('inputmode', 'numeric');
  for (const route of ['#/today', '#/settings', '#/plan', '#/library']) {
    await page.goto('./' + route);
    await page.waitForSelector('main .screen');
    if (route === '#/plan') await page.locator('.item summary').first().click();
    const bad = await page.$$eval('input:not([type=checkbox]):not([type=file]), select, textarea', (els) =>
      els
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .map((e) => {
          const el = e as HTMLInputElement;
          const fs = parseFloat(getComputedStyle(el).fontSize);
          // Атрибуты, а не DOM-свойства: WebKit под Linux не знает el.enterKeyHint
          const numeric = ['decimal', 'numeric'].includes(el.getAttribute('inputmode') ?? '');
          const issues = [];
          if (fs < 16) issues.push(`font ${fs}`);
          if (numeric && !el.getAttribute('enterkeyhint')) issues.push('no enterkeyhint');
          if (numeric && el.getAttribute('autocomplete') !== 'off') issues.push('autocomplete');
          return issues.length ? `${el.getAttribute('aria-label') ?? el.id}: ${issues.join(', ')}` : '';
        })
        .filter(Boolean),
    );
    expect(bad, route).toEqual([]);
  }
});

test('exercise picker: focus stays inside, Escape closes, Close does not cover the list', async ({
  page,
}) => {
  await fresh(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  const open = page.getByRole('button', { name: 'Add exercise' });
  await open.click();
  const sheet = page.getByRole('dialog', { name: 'Add exercise' });
  await expect(sheet.getByRole('searchbox')).toBeFocused();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true);
  }
  // Последний пункт списка можно прокрутить выше нижней кнопки
  const last = sheet.locator('.pick-list li').last();
  await last.scrollIntoViewIfNeeded();
  const lb = await last.boundingBox();
  const fb = await sheet.locator('.sheet-f').boundingBox();
  expect(lb!.y + lb!.height).toBeLessThanOrEqual(fb!.y + 1);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(open).toBeFocused();
});
