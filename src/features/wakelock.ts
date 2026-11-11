import { effect, signal } from '@preact/signals';
import { settings } from '../state/settings';
import { active } from '../state/workout';

/**
 * Screen Wake Lock во время тренировки.
 * iOS Safari: поддерживается с 16.4, в установленном PWA — стабильно с iOS 18.4.
 * На более старых версиях запрос падает — ловим ошибку и показываем статус в настройках.
 */
export type WakeStatus = 'unsupported' | 'off' | 'on' | 'error';

export const wakeSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
export const wakeStatus = signal<WakeStatus>(wakeSupported ? 'off' : 'unsupported');

let sentinel: WakeLockSentinel | null = null;
let pending = false;

async function acquire(): Promise<void> {
  if (!wakeSupported || sentinel || pending || document.visibilityState !== 'visible') return;
  pending = true;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    wakeStatus.value = 'on';
    sentinel.addEventListener('release', () => {
      sentinel = null;
      if (wakeStatus.value === 'on') wakeStatus.value = 'off';
    });
  } catch (e) {
    console.warn('[wakelock]', e);
    wakeStatus.value = 'error';
  } finally {
    pending = false;
  }
}

async function release(): Promise<void> {
  const s = sentinel;
  sentinel = null;
  if (wakeSupported) wakeStatus.value = 'off';
  try {
    await s?.release();
  } catch {
    /* ignore */
  }
}

const wanted = () => !!active.value && settings.value.wakeLock;

export function installWakeLock(): void {
  if (!wakeSupported) return;
  effect(() => {
    if (wanted()) void acquire();
    else void release();
  });
  // Система снимает блокировку при сворачивании — запрашиваем заново
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wanted()) void acquire();
  });
}
