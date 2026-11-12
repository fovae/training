import { expect, test } from '@playwright/test';
import { EXERCISES } from '../../src/data/catalog';
import { fresh, kv, onboard } from './helpers';

/** Этап 3А: база ~120 упражнений, штанга, шаблоны, документы */

const BENCH = 'Barbell bench press';

test('library: 120 exercises, search and filters by muscle and equipment stay fast', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Exercises' }).click();
  await expect(page.getByText(`${EXERCISES.length} exercises`)).toBeVisible();
  expect(EXERCISES.length).toBeGreaterThanOrEqual(115);

  const count = (f: (e: (typeof EXERCISES)[number]) => boolean) => EXERCISES.filter(f).length;
  const search = page.getByRole('searchbox');
  // Поиск: несколько слов в любом порядке
  await search.fill('squat');
  await expect(page.locator('.lib-card')).toHaveCount(EXERCISES.filter((e) => /squat/.test(e.id)).length);
  await search.fill('press barbell');
  await expect(page.getByRole('link', { name: new RegExp(BENCH) })).toBeVisible();
  await expect(page.getByRole('link', { name: /Leg press/ })).toHaveCount(0);
  await search.fill('');

  // Фильтры: мышца × оборудование
  const t0 = Date.now();
  await page.getByLabel('Muscle', { exact: true }).selectOption('quads');
  await page.getByLabel('Equipment').selectOption('barbell');
  const want = count(
    (e) =>
      (e.primaryMuscles.includes('quads') || e.secondaryMuscles.includes('quads')) &&
      e.equipment.includes('barbell'),
  );
  await expect(page.locator('.lib-card')).toHaveCount(want);
  expect(Date.now() - t0).toBeLessThan(3000);
  for (const name of ['Barbell back squat', 'Front squat']) await expect(page.getByText(name)).toBeVisible();
  // Новые мышцы и оборудование в фильтрах
  await page.getByLabel('Muscle', { exact: true }).selectOption('adductors');
  await page.getByLabel('Equipment').selectOption('');
  await expect(page.locator('.lib-card')).toHaveCount(
    count((e) => e.primaryMuscles.includes('adductors') || e.secondaryMuscles.includes('adductors')),
  );
  await page.getByLabel('Muscle', { exact: true }).selectOption('');
  await page.getByLabel('Equipment').selectOption('jump-rope');
  await expect(page.locator('.lib-card')).toHaveCount(1);
  // Ярлыков «дом» и «зал» нет
  for (const opt of await page.getByLabel('Equipment').locator('option').allTextContents())
    expect(opt).not.toMatch(/home|gym|дом|зал/i);

  // Карточка нового упражнения: схема, мышцы, техника, ошибки, безопасность
  await page.getByLabel('Equipment').selectOption('');
  await search.fill('deadlift');
  await page.getByRole('link', { name: /^Deadlift/ }).click();
  await expect(page.getByRole('heading', { name: 'Deadlift', level: 1 })).toBeVisible();
  await expect(page.locator('.pic svg')).toBeVisible();
  await expect(page.locator('.cues li')).toHaveCount(4 + 3);
  await expect(page.getByText('Safety.')).toBeVisible();
  await expect(page.locator('.note.warn')).toContainText(/collars/);
});

test('library in Russian: search, no English names, new filters translated', async ({ page }) => {
  await fresh(page);
  await onboard(page, { lang: 'ru' });
  await page.getByRole('link', { name: 'Упражнения' }).click();
  await page.getByRole('searchbox').fill('Присед');
  await expect(page.getByRole('link', { name: /Приседания со штангой на спине/ })).toBeVisible();
  await page.getByRole('searchbox').fill('ягодичный мостик');
  await expect(page.locator('.lib-card')).toHaveCount(2);
  await page.getByRole('searchbox').fill('');
  const opts = await page.getByLabel('Оборудование').locator('option').allTextContents();
  expect(opts).toContain('Скакалка');
  const muscles = await page.getByLabel('Мышцы', { exact: true }).locator('option').allTextContents();
  for (const m of ['Приводящие бедра', 'Отводящие бедра', 'Сгибатели бедра']) expect(muscles).toContain(m);
  // Названия на карточках — по-русски (латиница только в аббревиатурах)
  const names = await page.locator('.lib-txt b').allTextContents();
  expect(names.length).toBe(EXERCISES.length);
  for (const n of names) expect(n, n).toMatch(/[а-яё]/i);
});

test('add a new exercise to the plan and log it in a workout', async ({ page }) => {
  await fresh(page);
  await onboard(page, { start: 'Empty days', days: 1 });
  await page.getByRole('button', { name: 'Add exercise' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add exercise' });
  await sheet.getByLabel('Equipment').selectOption('barbell');
  await sheet.getByRole('button', { name: new RegExp(BENCH) }).click();
  await sheet.getByLabel('Equipment').selectOption('');
  await sheet.getByRole('searchbox').fill('plank');
  await sheet.getByRole('button', { name: /^Plank/ }).click();
  await sheet.getByRole('button', { name: /Done · 2 added/ }).click();
  await expect(page.locator('.item')).toHaveCount(2);
  await expect(page.locator('.item').first()).toContainText('3 × 6–10');
  await expect(page.locator('.item').nth(1)).toContainText('3 × 20–45 s');

  await page.getByRole('link', { name: 'Today' }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByLabel(`${BENCH}, set 1: weight, kg`).fill('60');
  await page.getByLabel(`${BENCH}, set 1: reps`).fill('8');
  await page.getByRole('button', { name: `${BENCH}, set 1: done` }).click();
  await expect
    .poll(
      async () =>
        (await kv<{ entries: { exerciseId: string; sets: { done: boolean }[] }[] }>(page, 'activeSession'))
          ?.entries[0],
    )
    .toMatchObject({
      exerciseId: 'barbell-bench-press',
      sets: [{ done: true }, { done: false }, { done: false }],
    });
  // Упражнение на время — поле секунд
  await expect(page.getByLabel('Plank, set 1: seconds')).toBeVisible();
});

test('templates: upper/lower 4 days; beginners get simpler exercises and fewer sets', async ({ page }) => {
  await fresh(page);
  await onboard(page, { start: /Upper and lower/ });
  await expect(page.getByRole('tab')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Upper body · 1' })).toBeVisible();
  await expect(page.getByText(BENCH).first()).toBeVisible();
  const plan = await kv<{ days: { items: { exerciseId: string; targetWeightKg?: number }[] }[] }>(
    page,
    'plan',
  );
  expect(plan!.days.flatMap((d) => d.items).every((i) => i.targetWeightKg === undefined)).toBe(true);

  await fresh(page);
  await onboard(page, { start: /Push, pull, legs/, level: "I'm a beginner, this is my first time" });
  await expect(page.getByRole('tab')).toHaveCount(3);
  const p2 = await kv<{ days: { items: { exerciseId: string; sets: number }[] }[] }>(page, 'plan');
  const ids = p2!.days.flatMap((d) => d.items.map((i) => i.exerciseId));
  expect(ids).not.toContain('back-squat');
  expect(ids).toContain('goblet-squat');
  expect(Math.max(...p2!.days.flatMap((d) => d.items.map((i) => i.sets)))).toBeLessThanOrEqual(2);
});

test('barbell weight warning: off in production, on with the test flag', async ({ page }) => {
  await fresh(page);
  await onboard(page, { start: 'Empty days', days: 1 });
  await page.getByRole('button', { name: 'Add exercise' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add exercise' });
  await sheet.getByRole('searchbox').fill('deadlift');
  await sheet.getByRole('button', { name: /^Deadlift/ }).click();
  await sheet.getByRole('button', { name: /Done · 1 added/ }).click();
  await page.getByRole('link', { name: 'Today' }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  const w = page.getByLabel('Deadlift, set 1: weight, kg');
  // Боевая сборка: таблица штанги ждёт подтверждения владельца — предупреждения нет
  await w.fill('900');
  await w.blur();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  // Тестовый режим: порог 80 кг × (5,14 + 4,52) / 2 × 1,15 ≈ 444 кг
  await page.evaluate(() => localStorage.setItem('tp-test-flags', 'barbell-limits'));
  const w2 = page.getByLabel('Deadlift, set 2: weight, kg');
  await w2.fill('400');
  await w2.blur();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await w2.fill('500');
  await w2.blur();
  await expect(page.getByRole('alertdialog', { name: 'This is a very heavy weight' })).toBeVisible();
});

test('legal documents: contents without double numbering, numbers aligned, no gap issues', async ({
  page,
}) => {
  await fresh(page);
  await page.evaluate(() => localStorage.setItem('tp-boot', JSON.stringify({ locale: 'ru' })));
  await page.goto('./#/legal/terms');
  await page.reload();
  await expect(page.locator('.toc')).toBeVisible();
  await expect(page.locator('.toc ol')).toHaveCount(0);
  const links = page.locator('.toc-link');
  const n = await links.count();
  expect(n).toBeGreaterThanOrEqual(10);
  // Номер только один: «1.» в своей колонке, текст без номера
  await expect(links.first().locator('.toc-n')).toHaveText('1.');
  await expect(links.first()).not.toContainText('1. 1.');
  // «10.» и «1.» заканчиваются на одной вертикали
  const right = async (i: number) => {
    const b = await links.nth(i).locator('.toc-n').boundingBox();
    return b!.x + b!.width;
  };
  const r1 = await right(0);
  const r10 = await right(9);
  const b0 = (await links.nth(0).boundingBox())!;
  const b9 = (await links.nth(9).boundingBox())!;
  if (Math.abs(b0.x - b9.x) < 2) expect(Math.abs(r1 - r10)).toBeLessThan(1.5);
  // Плашка «только на английском» не прилипает к документу
  const note = (await page.locator('.legal > .note').boundingBox())!;
  const doc = (await page.locator('.legal .prose').boundingBox())!;
  expect(doc.y - (note.y + note.height)).toBeGreaterThanOrEqual(8);
});
