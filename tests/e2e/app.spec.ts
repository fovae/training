import { expect, test, type Page } from '@playwright/test';

test.skip(({ browserName }) => browserName !== 'webkit', 'iPhone-проекты');

async function fresh(page: Page) {
  await page.goto('./');
  await page.evaluate(async () => {
    localStorage.clear();
    // Отмечаем, что подсказка установки уже была — чтобы не мешала
    localStorage.setItem('tp-flag-ios-hint-shown', '1');
    await new Promise<void>((res) => {
      const r = indexedDB.deleteDatabase('training-pwa');
      r.onsuccess = r.onerror = r.onblocked = () => res();
    });
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Начать тренировку' })).toBeVisible();
}

test('загрузка: таб-бар, следующая тренировка, safe area meta', async ({ page }) => {
  await fresh(page);
  await expect(page.getByRole('navigation', { name: 'Разделы' })).toBeVisible();
  for (const t of ['Сегодня', 'Программа', 'История', 'Настройки'])
    await expect(page.getByRole('link', { name: t })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Грудь + трицепс' })).toBeVisible();
  await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content', /viewport-fit=cover/);
  await expect(page.locator('link[rel=manifest]')).toHaveCount(1);
  // Нет горизонтального скролла
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // Тач-цели ≥ 44pt
  const small = await page.$$eval('.nav-item, .seg-btn, .set-done, .btn', (els) =>
    els.filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent),
  );
  expect(small).toEqual([]);
});

test('программа: все 4 дня и схемы перенесены', async ({ page }) => {
  await fresh(page);
  await page.getByRole('link', { name: 'Программа' }).click();
  await expect(page.getByRole('heading', { name: 'Тренировочная программа' })).toBeVisible();
  const counts: Record<string, number> = { 'День 1': 6, 'День 2': 8, 'День 3': 5, 'День 4': 8 };
  for (const [day, n] of Object.entries(counts)) {
    await page.getByRole('tab', { name: new RegExp(day) }).click();
    await expect(page.locator('article.ex')).toHaveCount(n);
    await expect(page.locator('article.ex .pic svg')).toHaveCount(n);
  }
  await expect(page.getByText('Стоп-сигналы.')).toBeVisible();
});

test('проход тренировки: подходы, таймер, завершение, история, предзаполнение', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: 'Начать тренировку' }).click();
  await expect(page.getByText('Идёт тренировка')).toBeVisible();

  const name = 'Жим гантелей на наклонной скамье';
  for (let i = 1; i <= 3; i++) {
    await page.getByLabel(`${name}, подход ${i}: вес, кг`).fill('22,5');
    await page.getByLabel(`${name}, подход ${i}: повторы`).fill('12');
    await page.getByRole('button', { name: `${name}, подход ${i}: выполнен` }).click();
  }
  // Таймер отдыха появился (базовое упражнение — 2:30 по умолчанию)
  const timer = page.getByRole('region', { name: 'Таймер отдыха' });
  await expect(timer).toBeVisible();
  await expect(timer.getByRole('timer')).toHaveText(/2:(2\d|30)/);
  await page.getByRole('button', { name: 'Пропустить отдых' }).click();
  await expect(timer).toBeHidden();

  // Сессия переживает перезапуск
  await page.reload();
  await expect(page.getByText('Идёт тренировка')).toBeVisible();
  await expect(page.getByLabel(`${name}, подход 1: вес, кг`)).toHaveValue('22,5');

  await page.getByRole('button', { name: 'Завершить', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Завершить' }).click();
  await expect(page.getByText('Тренировка сохранена')).toBeVisible();

  // Следующая по циклу — День 2
  await expect(page.getByRole('heading', { name: 'Спина + бицепс + предплечья' })).toBeVisible();

  // История
  await page.getByRole('link', { name: 'История' }).click();
  await expect(page.locator('.week-big')).toContainText('1');
  await expect(page.getByRole('link', { name: /Грудь \+ трицепс/ })).toBeVisible();
  await expect(page.getByText('Пора добавить вес')).toBeVisible();

  // Предзаполнение и подсказка прогрессии на Дне 1
  await page.getByRole('link', { name: 'Сегодня' }).click();
  await page.getByRole('tab', { name: /День 1/ }).click();
  await expect(page.getByText('Пора добавить вес').first()).toBeVisible();
  await page.getByRole('button', { name: 'Начать тренировку' }).click();
  await expect(page.getByLabel(`${name}, подход 2: вес, кг`)).toHaveValue('22,5');
  await expect(page.getByLabel(`${name}, подход 2: повторы`)).toHaveValue('12');
});

test('таймер считается от времени и подаёт сигнал', async ({ page }) => {
  await page.clock.install();
  await fresh(page);
  await page.getByRole('button', { name: 'Начать тренировку' }).click();
  const name = 'Сведение блоков сверху вниз';
  await page.getByLabel(`${name}, подход 1: повторы`).fill('15');
  await page.getByRole('button', { name: `${name}, подход 1: выполнен` }).click();
  const timer = page.getByRole('region', { name: 'Таймер отдыха' });
  await expect(timer.getByRole('timer')).toHaveText('1:30');
  await page.getByRole('button', { name: 'Плюс 15 секунд' }).click();
  await expect(timer.getByRole('timer')).toHaveText('1:45');
  await page.getByRole('button', { name: 'Минус 15 секунд' }).click();
  await page.clock.fastForward('01:31');
  await expect(timer.getByRole('timer')).toHaveText('Пора!');
  await expect(page.locator('.flash')).toBeVisible();
});

test('настройки: экспорт и импорт JSON', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: 'Начать тренировку' }).click();
  const name = 'Жим гантелей на наклонной скамье';
  await page.getByLabel(`${name}, подход 1: вес, кг`).fill('20');
  await page.getByLabel(`${name}, подход 1: повторы`).fill('10');
  await page.getByRole('button', { name: `${name}, подход 1: выполнен` }).click();
  await page.getByRole('button', { name: 'Завершить', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Завершить' }).click();

  await page.getByRole('link', { name: 'Настройки' }).click();
  // В тесте share sheet недоступен — проверяем скачивание
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт JSON' }).click();
  const file = await dl;
  const path = await file.path();
  expect(file.suggestedFilename()).toMatch(/^training-backup-\d{4}-\d{2}-\d{2}\.json$/);

  // Сброс
  await page.getByRole('button', { name: 'Сбросить все данные' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить всё' }).click();
  await page.getByRole('link', { name: 'История' }).click();
  await expect(page.getByText('Здесь появятся завершённые тренировки')).toBeVisible();

  // Импорт
  await page.getByRole('link', { name: 'Настройки' }).click();
  await page.getByTestId('import-input').setInputFiles(path);
  await expect(page.getByRole('alertdialog')).toContainText('1 тренировка');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Заменить' }).click();
  await expect(page.getByText('Данные восстановлены')).toBeVisible();
  await page.getByRole('link', { name: 'История' }).click();
  await expect(page.getByRole('link', { name: /Грудь \+ трицепс/ })).toBeVisible();
});

test('тема переключается вручную и меняет theme-color', async ({ page }) => {
  await fresh(page);
  await page.getByRole('link', { name: 'Настройки' }).click();
  await page.getByRole('radio', { name: 'Тёмная' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name=theme-color]').first()).toHaveAttribute('content', '#111114');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(17, 17, 20)');
});
