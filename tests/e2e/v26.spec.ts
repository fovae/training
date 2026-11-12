import { writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { buildBackup } from '../../src/backup/format';
import { buildPlan } from '../../src/data/templates';
import { loadCatalog } from '../../src/data/exercises';
import { DEFAULT_SETTINGS, type Profile } from '../../src/types';
import { fresh, kv, onboard } from './helpers';

/** v2.6: меню действий на карточках, без свайпа дней, восстановление в онбординге, кнопки внизу */

const INCLINE = 'Incline dumbbell press';

test.beforeAll(() => loadCatalog());

/** Кнопка «Actions: …» видна только в фокусе — нажимаем с клавиатуры, как VoiceOver / Tab */
async function actions(page: Page, name: string) {
  const b = page.getByRole('button', { name });
  await b.focus();
  await page.keyboard.press('Enter');
}

/** Свайп пальцем по элементу (Chromium: есть конструктор Touch) */
async function swipe(page: Page, el: Locator, dx: number, hold = 0) {
  // В центр экрана: внизу могут быть уведомления («Удалено»), они перехватили бы касание
  await el.evaluate((n) => n.scrollIntoView({ block: 'center' }));
  const b = (await el.boundingBox())!;
  const x0 = b.x + b.width * 0.7;
  const y0 = b.y + Math.min(30, b.height / 2);
  await page.evaluate(
    async ([x0, y0, dx, hold]) => {
      const target = document.elementFromPoint(x0, y0)!;
      const mk = (x: number) => new Touch({ identifier: 1, target, clientX: x, clientY: y0 });
      const fire = (type: string, x: number) =>
        target.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: type === 'touchend' ? [] : [mk(x)],
            changedTouches: [mk(x)],
          }),
        );
      fire('touchstart', x0);
      if (hold) await new Promise((r) => setTimeout(r, hold));
      const steps = 6;
      for (let i = 1; i <= steps && dx; i++) {
        fire('touchmove', x0 + (dx * i) / steps);
        await new Promise((r) => setTimeout(r, 16));
      }
      fire('touchend', x0 + dx);
    },
    [x0, y0, dx, hold] as const,
  );
}

test('plan: swipe left shows Delete; delete asks «Delete?»; long press opens the full menu', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'синтетические касания — Chromium (Pixel)');
  await fresh(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Plan' }).click();
  const items = page.locator('.item');
  const first = items.first();
  await expect(first).toContainText(INCLINE);
  const n = await items.count();

  // Свайп влево — выезжает «Delete», карточка сдвинута
  await swipe(page, first.locator('summary'), -160);
  await expect(first.locator('.swipe-row')).toHaveClass(/open/);
  const del = first.getByRole('button', { name: 'Delete', exact: true });
  await expect(del).toBeVisible();
  // Свайп вправо — прячет
  await swipe(page, first.locator('summary'), 160);
  await expect(first.locator('.swipe-row')).not.toHaveClass(/open/);

  // Снова открыть и удалить — сначала вопрос «Удалить?», «Cancel» ничего не удаляет
  await swipe(page, first.locator('summary'), -160);
  await del.click();
  const dlg = page.getByRole('alertdialog');
  await expect(dlg).toContainText(`Remove «${INCLINE}» from the plan?`);
  await dlg.getByRole('button', { name: 'Cancel' }).click();
  await expect(items).toHaveCount(n);
  await swipe(page, first.locator('summary'), -160);
  await del.click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(items).toHaveCount(n - 1);
  await expect(items.first()).not.toContainText(INCLINE);

  // Долгое нажатие — меню снизу: Move up / Move down / Delete + Cancel
  const top = (await items.first().locator('.item-main b').textContent())!;
  await swipe(page, items.first().locator('summary'), 0, 650);
  const menu = page.getByRole('dialog', { name: top });
  await expect(menu.locator('.as-btn')).toHaveText(['Move up', 'Move down', 'Delete', 'Cancel']);
  await expect(menu.getByRole('button', { name: 'Move up' })).toBeDisabled();
  await menu.getByRole('button', { name: 'Move down' }).click();
  await expect(items.nth(1).locator('.item-main b')).toHaveText(top);
  // Долгое нажатие не открыло пункт (клик после него проглочен)
  await expect(items.nth(1).locator('details')).not.toHaveAttribute('open', '');
});

test('menu is reachable without touch: right click and the hidden «Actions» button', async ({
  page,
  browserName,
}) => {
  await fresh(page);
  await onboard(page);
  await page.getByRole('link', { name: 'Plan' }).click();
  const menu = page.getByRole('dialog', { name: INCLINE });
  // Правый клик (ПК, трекпад iPad). В эмуляции Android Chromium contextmenu от мыши не приходит.
  if (browserName === 'webkit') {
    await page.locator('.item summary').first().click({ button: 'right' });
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
  }
  // Клавиатура / VoiceOver: кнопка «Actions: …» в каждой карточке
  await actions(page, `Actions: ${INCLINE}`);
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: 'Cancel' }).click();
});

test('today: menu with skip, move, remove from plan; history: delete asks first', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByLabel(`${INCLINE}, set 1: weight, kg`).fill('20');
  await page.getByLabel(`${INCLINE}, set 1: reps`).fill('10');
  await page.getByRole('button', { name: `${INCLINE}, set 1: done` }).click();
  await page.getByRole('button', { name: 'Skip rest' }).click();
  const card2 = page.locator('.ex-grid > .swipe-row').nth(1);
  const name2 = (await card2.locator('.ex-name').textContent())!.replace(/^\d+\.\s*/, '');
  await actions(page, `Actions: ${name2}`);
  const menu = page.getByRole('dialog', { name: name2 });
  await expect(menu.locator('.as-btn')).toHaveText([
    'Skip today',
    'Move up',
    'Move down',
    'Remove from plan',
    'Cancel',
  ]);
  await menu.getByRole('button', { name: 'Skip today' }).click();
  await expect(card2.locator('.ex')).toHaveClass(/skipped/);
  // Выше — второе упражнение становится первым в тренировке
  await actions(page, `Actions: ${name2}`);
  await page.getByRole('dialog', { name: name2 }).getByRole('button', { name: 'Move up' }).click();
  await expect(page.locator('.ex-grid > .swipe-row').first().locator('.ex-name')).toContainText(name2);

  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('link', { name: 'History' }).click();
  const rows = page.locator('.list .swipe-row');
  await expect(rows).toHaveCount(1);
  const title = (await rows.first().locator('.row-main b').textContent())!;
  await actions(page, `Actions: ${title}`);
  await page.getByRole('dialog', { name: title }).getByRole('button', { name: 'Delete' }).click();
  const dlg = page.getByRole('alertdialog');
  await expect(dlg).toContainText('Delete this workout?');
  await dlg.getByRole('button', { name: 'Cancel' }).click();
  await expect(rows).toHaveCount(1);
  await actions(page, `Actions: ${title}`);
  await page.getByRole('dialog', { name: title }).getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(rows).toHaveCount(0);
});

test('swipe no longer switches days on Today', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'синтетические касания — Chromium (Pixel)');
  await fresh(page);
  await onboard(page);
  const sel = page.locator('[role="tab"][aria-selected="true"]');
  const before = await sel.textContent();
  await swipe(page, page.locator('.dayhead'), -200);
  await swipe(page, page.locator('.dayhead'), 200);
  await expect(sel).toHaveText(before!);
});

test('onboarding: «I have a file» on the profile step restores everything and records acceptance', async ({
  page,
}, info) => {
  const profile: Profile = {
    weightKg: 77,
    heightCm: 181,
    level: 'veteran',
    units: 'metric',
    locale: 'en',
    adult16Confirmed: true,
    confirmedAt: '2026-01-01T00:00:00.000Z',
    legalAccepted: null,
  };
  const file = await buildBackup(
    {
      profile,
      plan: buildPlan({ templateId: 'split31', days: 4, mode: 'cycle' }),
      settings: { ...DEFAULT_SETTINGS, theme: 'classic-dark' },
      sessions: [
        {
          id: 'r1',
          dayId: 'day-1',
          startedAt: '2026-11-10T08:00:00.000Z',
          endedAt: '2026-11-10T09:00:00.000Z',
          entries: [{ exerciseId: 'incline-db-press', sets: [{ weightKg: 22, reps: 10, done: true }] }],
        },
      ],
    },
    '2.5.0',
  );
  const path = info.outputPath('copy.json');
  writeFileSync(path, JSON.stringify(file));

  await fresh(page);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();
  await expect(page.getByText('Have a backup file?')).toBeVisible();
  await page.getByTestId('onb-import-input').setInputFiles(path);
  const dlg = page.getByRole('alertdialog');
  await expect(dlg).toContainText('Restore from the copy?');
  await expect(dlg).toContainText('1 workout');
  await dlg.getByRole('button', { name: 'Restore' }).click();
  // Сразу в приложение, без повторного заполнения и без «We updated our documents»
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'We updated our documents' })).toHaveCount(0);
  const p = await kv<Profile>(page, 'profile');
  expect(p).toMatchObject({ weightKg: 77, heightCm: 181, level: 'veteran' });
  expect(p!.legalAccepted).not.toBeNull();
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.locator('.list .swipe-row')).toHaveCount(1);
});

test('onboarding: Back / Next always sit at the bottom of the screen', async ({ page }) => {
  await fresh(page);
  const vh = page.viewportSize()!.height;
  const bottom = async () => {
    const b = (await page.locator('.ob-actions').boundingBox())!;
    return b.y + b.height;
  };
  // Короткий шаг (язык) — панель у нижнего края, а не сразу под списком
  expect(Math.abs((await bottom()) - vh)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Next' }).click();
  expect(Math.abs((await bottom()) - vh)).toBeLessThanOrEqual(1);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Next' }).click();
  expect(Math.abs((await bottom()) - vh)).toBeLessThanOrEqual(1);
  await page.getByLabel('Body weight, kg').fill('80');
  await page.getByLabel('Height, cm').fill('180');
  await page.getByRole('button', { name: 'Next' }).click();
  // Уровень: длинный шаг — после прокрутки до конца панель всё равно у нижнего края
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  expect(Math.abs((await bottom()) - vh)).toBeLessThanOrEqual(1);
});

test('status bar area: «Skip to content» is fully hidden until focused', async ({ page }) => {
  await fresh(page);
  await onboard(page);
  const link = page.locator('.skip-link');
  const b = (await link.boundingBox())!;
  expect(b.width * b.height).toBeLessThanOrEqual(1);
  await link.focus();
  await expect(link).toBeFocused();
  const f = (await link.boundingBox())!;
  expect(f.width).toBeGreaterThan(40);
  expect(f.y).toBeGreaterThanOrEqual(0);
});
