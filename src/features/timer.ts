import { computed, effect, signal } from '@preact/signals';
import { settings } from '../state/settings';
import { beep } from './audio';

/**
 * Таймер отдыха. Считается от меток времени (Date.now()), а не тиками —
 * поэтому не сбивается, когда iOS замораживает свёрнутое приложение.
 */
export interface RestTimer {
  endAt: number;
  total: number;
  /** Если на паузе — сколько мс оставалось */
  pausedLeft: number | null;
  label: string;
  fired: boolean;
}

const KEY = 'tp-timer';

function restore(): RestTimer | null {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) ?? 'null') as RestTimer | null;
    // Давно закончившийся таймер не восстанавливаем
    if (t && (t.pausedLeft != null || t.endAt > Date.now() - 60_000)) return t;
  } catch {
    /* ignore */
  }
  return null;
}

export const timer = signal<RestTimer | null>(restore());
export const now = signal(Date.now());
/** Короткая вспышка по окончании отдыха */
export const flash = signal(0);

effect(() => {
  try {
    if (timer.value) localStorage.setItem(KEY, JSON.stringify(timer.value));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
});

export const remainingMs = computed(() => {
  const t = timer.value;
  if (!t) return 0;
  return t.pausedLeft ?? Math.max(0, t.endAt - now.value);
});

let iv: number | null = null;
let doneTimeout: number | null = null;

function tick(): void {
  now.value = Date.now();
  const t = timer.value;
  if (!t || t.pausedLeft != null || t.fired) return;
  if (t.endAt <= now.value) {
    timer.value = { ...t, fired: true };
    // Сигнал только если отдых закончился недавно (а не час назад в фоне)
    if (now.value - t.endAt < 30_000) signalDone();
    if (doneTimeout) clearTimeout(doneTimeout);
    doneTimeout = window.setTimeout(() => {
      if (timer.value?.fired) timer.value = null;
    }, 4000);
  }
}

function signalDone(): void {
  if (settings.value.sound) beep();
  try {
    // Vibration API на iOS отсутствует — только feature detection
    if ('vibrate' in navigator) navigator.vibrate([180, 80, 180]);
  } catch {
    /* ignore */
  }
  flash.value++;
}

effect(() => {
  const running = !!timer.value;
  if (running && iv == null) iv = window.setInterval(tick, 250);
  if (!running && iv != null) {
    clearInterval(iv);
    iv = null;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') tick();
});

export function startRest(sec: number, label = ''): void {
  const ms = sec * 1000;
  timer.value = { endAt: Date.now() + ms, total: ms, pausedLeft: null, label, fired: false };
  now.value = Date.now();
}

export function adjustRest(deltaSec: number): void {
  const t = timer.value;
  if (!t || t.fired) return;
  const d = deltaSec * 1000;
  if (t.pausedLeft != null) {
    const left = Math.max(1000, t.pausedLeft + d);
    timer.value = { ...t, pausedLeft: left, total: Math.max(t.total, left) };
  } else {
    const endAt = Math.max(Date.now() + 1000, t.endAt + d);
    timer.value = { ...t, endAt, total: Math.max(t.total, endAt - Date.now()) };
  }
  now.value = Date.now();
}

export function togglePause(): void {
  const t = timer.value;
  if (!t || t.fired) return;
  if (t.pausedLeft != null) {
    timer.value = { ...t, endAt: Date.now() + t.pausedLeft, pausedLeft: null };
  } else {
    timer.value = { ...t, pausedLeft: Math.max(0, t.endAt - Date.now()) };
  }
  now.value = Date.now();
}

export function stopRest(): void {
  timer.value = null;
}
