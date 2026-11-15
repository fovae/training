import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fresh, onboard } from './helpers';

/** Помощник «Собрать за меня»: мастер, предпросмотр, замена, закрепление, применение с отменой */

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
  const sheet = page.getByRole('dialog', { name: 'Build it for me' });
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
  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  await page.getByRole('button', { name: 'Build a plan' }).click();
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
    await page.getByRole('link', { name: 'Plan', exact: true }).click();
    await page.getByRole('button', { name: 'Build a plan' }).click();
    await walkToPreview(page, w);
    expect(await noOverflow(page)).toEqual({ scroll: true, bad: [] });
  });
}

test('onboarding: «Build it for me» card above templates opens the wizard after setup', async ({ page }) => {
  await fresh(page);
  await onboard(page, { start: 'Build it for me' });
  await expect(page.getByRole('dialog', { name: 'Build it for me' })).toBeVisible();
});
