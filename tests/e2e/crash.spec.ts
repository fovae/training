import { expect, test } from '@playwright/test';
import { DB, fresh, onboard } from './helpers';

/** 0.1.0: сбой отрисовки экрана — запасной экран вместо пустого (components/ErrorBoundary.tsx) */
test('a broken record crashes only its screen: fallback with Restart, tabs keep working', async ({
  page,
}) => {
  await fresh(page);
  await onboard(page);
  // повреждённая запись (entries: null) — экран «История» не может её отрисовать
  await page.evaluate(
    (name) =>
      new Promise<void>((res) => {
        const r = indexedDB.open(name);
        r.onsuccess = () => {
          const tx = r.result.transaction('sessions', 'readwrite');
          tx.objectStore('sessions').put({
            id: 'broken',
            dayId: 'day-1',
            startedAt: new Date(Date.now() - 3600_000).toISOString(),
            endedAt: new Date().toISOString(),
            entries: null,
          });
          tx.oncomplete = () => {
            r.result.close();
            res();
          };
        };
      }),
    DB,
  );
  await page.reload();
  await page.getByRole('link', { name: 'History' }).click();
  const crash = page.getByRole('alert').filter({ hasText: 'Something went wrong' });
  await expect(crash).toBeVisible();
  await expect(crash.getByRole('button', { name: 'Restart' })).toBeVisible();
  await expect(crash.getByRole('button', { name: 'Save a copy' })).toBeVisible();
  // вкладки на месте: экран, не зависящий от журнала, открывается
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(crash).toHaveCount(0);
  await expect(page.locator('.settings')).toBeVisible();
});
