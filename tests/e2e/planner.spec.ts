import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fresh, onboard, openSettings } from './helpers';

/** Помощник «Подбор плана»: мастер, предпросмотр, замена, закрепление, применение с отменой */

/** Ничего не выходит за край листа по горизонтали */
const noOverflow = (page: Page) =>
  page.evaluate(() => {
    const body = document.querySelector('.sheet-body')!;
    const bad = [...document.querySelectorAll('.sheet *')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
    });
    return {
      scroll: body.scrollWidth <= body.clientWidth + 1,
      bad: bad.map((el) => el.className).slice(0, 5),
    };
  });

async function walkToPreview(page: Page, w = 390) {
  const sheet = page.getByRole('dialog', { name: 'Plan builder' });
  await expect(sheet).toBeVisible();
  const steps = [
    'What to focus on',
    'Where you train',
    'Days per week',
    'Time per workout',
    'Level and limits',
  ];
  for (const [i, title] of steps.entries()) {
    await expect(sheet.getByRole('heading', { name: title })).toBeVisible();
    if (i === 0) {
      await sheet.getByRole('button', { name: 'Biceps' }).click();
      await sheet.getByRole('button', { name: 'Chest' }).click();
      await expect(sheet.getByRole('button', { name: 'Biceps' })).toHaveAttribute('aria-pressed', 'true');
    }
    if (i === 3) await sheet.getByRole('radio', { name: '45' }).click();
    if (i === 4) await sheet.getByRole('button', { name: 'with jumps' }).click();
    expect(await noOverflow(page), `${w}px, ${title}`).toEqual({ scroll: true, bad: [] });
    await sheet.getByRole('button', { name: i === 4 ? 'Build' : 'Next' }).click();
  }
  await expect(sheet.getByRole('heading', { name: 'Your draft plan' })).toBeVisible();
  return sheet;
}

test('wizard builds a draft; replace, pin, rebuild; apply replaces the plan with undo', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  await openSettings(page, 'training');
  await page.getByRole('button', { name: 'Assistant Build a plan' }).click();
  const sheet = await walkToPreview(page);

  await expect(
    sheet.getByText('A selection made by fixed rules, not a personal recommendation.', { exact: false }),
  ).toBeVisible();
  const days = sheet.locator('.planner-day');
  // дней — как в текущем плане (после онбординга «Сплит 3+1» — 4)
  await expect(days).toHaveCount(4);
  await expect(days.first()).toContainText('Whole body A');
  await expect(days.first()).toContainText(/about .+ \(\d+–\d+ min\)/);
  await expect(days.first()).toContainText('warm-up');

  // заменить: список похожих, одно нажатие — замена
  const first = days.first().locator('.planner-items > li').nth(1);
  const before = await first.locator('b').textContent();
  await first.getByRole('button', { name: 'Replace' }).click();
  const alt = first.locator('.planner-alt button').first();
  const altName = await alt.textContent();
  await alt.click();
  await expect(first.locator('b')).toHaveText(altName!);
  expect(altName).not.toBe(before);

  // закрепить — и пересобрать: закреплённое остаётся
  await first.getByRole('button', { name: `Keep ${altName} when rebuilding` }).click();
  await sheet.getByRole('button', { name: 'Rebuild', exact: true }).click();
  await expect(days.first()).toContainText(altName!);

  // a11y предпросмотра
  const axe = await new AxeBuilder({ page })
    .include('.sheet')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // применить: в плане уже есть упражнения — спросить; «Заменить план» с отменой
  await sheet.getByRole('button', { name: 'Use this plan' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace plan' }).click();
  await expect(page.getByText('Plan updated')).toBeVisible();
  await expect(page.getByRole('tab', { name: /Day 1 Whole body A/ })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(4);
  // план правится как обычно
  await expect(page.getByRole('button', { name: 'Add exercise' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('tab', { name: /Whole body A/ })).toHaveCount(0);
});

for (const w of [375, 430]) {
  test(`wizard layout at ${w}px: nothing sticks out of the sheet`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 800 });
    await fresh(page);
    await onboard(page);
    await openSettings(page, 'training');
    await page.getByRole('button', { name: 'Assistant Build a plan' }).click();
    await walkToPreview(page, w);
    expect(await noOverflow(page)).toEqual({ scroll: true, bad: [] });
  });
}

test('onboarding: «Plan builder» card above templates opens the wizard after setup', async ({ page }) => {
  await fresh(page);
  await onboard(page, { start: 'Plan builder' });
  await expect(page.getByRole('dialog', { name: 'Plan builder' })).toBeVisible();
});

test('3.20: day menu keeps off the edge; active segment text is readable; no 4-group limit', async ({
  page,
}) => {
  await fresh(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  // план собран — карточки помощника на экране нет, он в настройках и в меню дня
  await expect(page.locator('.screen.plan .planner-box')).toHaveCount(0);

  // меню «…» дня: «Отмена» не прилипает к низу и бокам экрана
  await page.locator('.dayhead-more').click();
  const cancel = page.locator('.action-sheet .as-cancel');
  await expect(cancel).toBeVisible();
  await page.waitForTimeout(400);
  const r = (await cancel.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(vp.height - (r.y + r.height)).toBeGreaterThanOrEqual(12);
  expect(r.x).toBeGreaterThanOrEqual(6);
  expect(vp.width - (r.x + r.width)).toBeGreaterThanOrEqual(6);
  await cancel.click();

  // выбранная плашка переключателя в мастере: текст отличается от фона
  await openSettings(page, 'training');
  await page.getByRole('button', { name: 'Assistant Build a plan' }).click();
  const sheet = page.getByRole('dialog', { name: 'Plan builder' });
  await sheet.getByRole('button', { name: 'Next' }).click();
  for (const place of ['Home', 'Gym', 'Outdoors']) {
    const opt = sheet.getByRole('radio', { name: place });
    if (!(await opt.count())) continue;
    await opt.click();
    const [fg, bg] = await opt.evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.color, s.backgroundColor];
    });
    expect(fg, place).not.toBe(bg);
    // у каждого места — «Популярное», не больше 5 плашек
    const n = await sheet.locator('.planner-sec').first().locator('.pick').count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(5);
  }
  // ограничения в 4 группы больше нет
  await sheet.getByRole('button', { name: 'Back' }).click();
  for (const g of ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'])
    await sheet.getByRole('button', { name: g, exact: true }).click();
  await expect(sheet.locator('.pick.on')).toHaveCount(5);
  await expect(sheet.locator('.pick:disabled')).toHaveCount(0);
});

test('3.20: empty day — offer to build just that day; «Not now» hides it; day menu builds a day', async ({
  page,
}) => {
  await fresh(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  // новый пустой день — карточка «Собрать этот день?» под тренировкой дня
  await page.getByRole('button', { name: 'Add day' }).click();
  const offer = page.getByRole('region', { name: 'Build this day?' });
  await expect(offer).toBeVisible();
  await offer.getByRole('button', { name: 'Build the day' }).click();
  const sheet = page.getByRole('dialog', { name: 'Build a day' });
  // без шага «дни»: 5 шагов
  await expect(sheet.getByText('Step 1 of 5')).toBeVisible();
  await sheet.getByRole('button', { name: 'Chest', exact: true }).click();
  await sheet.getByRole('button', { name: 'Biceps', exact: true }).click();
  for (let k = 0; k < 3; k++) await sheet.getByRole('button', { name: 'Next' }).click();
  await sheet.getByRole('button', { name: 'Build' }).click();
  await expect(sheet.locator('.planner-day')).toHaveCount(1);
  await expect(sheet.locator('.planner-day h3')).toHaveText('Chest + Biceps');
  await sheet.getByRole('button', { name: 'Use this plan' }).click();
  await expect(page.getByText('Day built')).toBeVisible();
  // день заполнен — карточки нет, остальные дни не тронуты
  await expect(offer).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Day 5 Chest \+ Biceps/ })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(5);

  // ещё один пустой день — «Не сейчас» прячет карточку, подсказка — где искать помощника
  await page.getByRole('button', { name: 'Add day' }).click();
  await expect(offer).toBeVisible();
  await offer.getByRole('button', { name: 'Not now' }).click();
  await expect(offer).toHaveCount(0);
  await expect(page.getByText('The assistant is always at hand', { exact: false })).toBeVisible();

  // меню «…» дня: «Помощник: собрать день»; занятый день — спросить про замену
  await page.getByRole('tab', { name: /Day 1/ }).click();
  await page.locator('.dayhead-more').click();
  await page.getByRole('button', { name: 'Assistant: build the day' }).click();
  for (let k = 0; k < 3; k++) await sheet.getByRole('button', { name: 'Next' }).click();
  await sheet.getByRole('button', { name: 'Build' }).click();
  await sheet.getByRole('button', { name: 'Use this plan' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace plan' }).click();
  await expect(page.getByText('Day built')).toBeVisible();
});

test('3.20: rules — four cards; can be hidden in Settings; stop signs stay at the bottom', async ({
  page,
}) => {
  await fresh(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  await expect(page.locator('.rules .rule')).toHaveCount(4);
  await expect(page.locator('.stop-note')).toBeVisible();
  await openSettings(page, 'tips');
  await page.getByRole('switch', { name: 'Rules on the Plan screen' }).click();
  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  await expect(page.locator('.rules')).toHaveCount(0);
  await expect(page.locator('.stop-note')).toBeVisible();
});

test('3.22: wizard sheet does not jump — top edge stays put across steps and picks', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Assistant Build a plan' }).click();
  const sheet = page.getByRole('dialog', { name: 'Plan builder' });
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(600);
  const top = async () => Math.round((await sheet.boundingBox())!.y);
  const t0 = await top();
  // отметки на шаге «фокус»: плашки не меняют ширину, лист не двигается
  const chest = sheet.getByRole('button', { name: 'Chest', exact: true });
  const w0 = (await chest.boundingBox())!.width;
  await chest.click();
  expect(Math.round((await chest.boundingBox())!.width)).toBe(Math.round(w0));
  await sheet.getByRole('button', { name: 'Biceps', exact: true }).click();
  expect(await top()).toBe(t0);
  // шаг «место»: «Дом» добавляет «Популярное», инвентарь меняется — верх на месте
  await sheet.getByRole('button', { name: 'Next' }).click();
  expect(await top()).toBe(t0);
  await sheet.getByRole('radio', { name: 'Home' }).click();
  expect(await top()).toBe(t0);
  await sheet.getByRole('button', { name: 'Dumbbells + bench' }).click();
  await sheet.getByRole('radio', { name: 'Gym' }).click();
  expect(await top()).toBe(t0);
  for (let k = 0; k < 3; k++) {
    await sheet.getByRole('button', { name: 'Next' }).click();
    expect(await top()).toBe(t0);
  }
  await sheet.getByRole('button', { name: 'Build' }).click();
  expect(await top()).toBe(t0);
});
