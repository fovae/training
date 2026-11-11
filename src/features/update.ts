import { signal } from '@preact/signals';

/**
 * Обновления приложения (registerType: 'prompt').
 * Новая версия сервис-воркера ждёт, пока пользователь не нажмёт «Обновить».
 * Во время активной тренировки тост не показывается — см. UpdateToast.
 */
export const needRefresh = signal(false);
export const offlineReady = signal(false);

let doUpdate: ((reload?: boolean) => Promise<void>) | null = null;

export async function initSW(): Promise<void> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  // Регистрируем после загрузки и в простое: прекэш не конкурирует с первым рендером
  if (document.readyState !== 'complete')
    await new Promise((r) => addEventListener('load', r, { once: true }));
  await new Promise<void>((r) =>
    'requestIdleCallback' in window ? requestIdleCallback(() => r(), { timeout: 3000 }) : setTimeout(r, 1500),
  );
  const { registerSW } = await import('virtual:pwa-register');
  doUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh.value = true;
    },
    onOfflineReady() {
      offlineReady.value = true;
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      // Проверяем обновления при возвращении в приложение и раз в час
      const check = () => {
        if (navigator.onLine) void reg.update().catch(() => undefined);
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      setInterval(check, 60 * 60 * 1000);
    },
  });
}

export async function applyUpdate(): Promise<void> {
  needRefresh.value = false;
  if (doUpdate) await doUpdate(true);
  else location.reload();
}
