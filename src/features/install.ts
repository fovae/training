import { signal } from '@preact/signals';
import { flags } from '../state/settings';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const ua = navigator.userAgent;

export const isStandalone = (): boolean =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

/** Только «настоящий» Safari: в Chrome/Firefox/Edge на iOS нет пункта «На экран Домой» в том же виде */
export const isIOSSafari =
  isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|GSA|Instagram|FBAN|FBAV/.test(ua);

/** Подсказка для iOS показывается один раз и только в Safari вне standalone */
export const iosHintVisible = signal(false);

export function initIosHint(): void {
  if (isIOSSafari && !isStandalone() && !flags.get('ios-hint-shown')) {
    iosHintVisible.value = true;
    flags.set('ios-hint-shown');
  }
}

export function dismissIosHint(): void {
  iosHintVisible.value = false;
  flags.set('ios-hint-shown');
}

// ---------- Chrome / Edge ----------

export const installPrompt = signal<BeforeInstallPromptEvent | null>(null);
export const installed = signal(isStandalone());

export function initInstallPrompt(): void {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt.value = e as BeforeInstallPromptEvent;
  });
  addEventListener('appinstalled', () => {
    installPrompt.value = null;
    installed.value = true;
  });
}

export async function promptInstall(): Promise<void> {
  const p = installPrompt.value;
  if (!p) return;
  await p.prompt();
  await p.userChoice;
  installPrompt.value = null;
}
