import { computed, signal } from '@preact/signals';
import {
  detectBrowser,
  detectPlatform,
  isMobile,
  isStandaloneEnv,
  safariVersion,
  type Browser,
  type Platform,
} from '../lib/platform';

/**
 * Установка приложения и экран установки («install gate», docs/CONCEPT.md → «Экран установки»).
 *
 * На iPhone данные вкладки Safari и установленного приложения хранятся раздельно, а Safari может
 * стирать данные вкладки. Поэтому на телефоне вне установленного приложения сначала показываем
 * инструкцию по установке, и только потом онбординг.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const ua = navigator.userAgent;

export const platform: Platform = detectPlatform({
  ua,
  platform: navigator.platform,
  maxTouchPoints: navigator.maxTouchPoints,
});
export const browser: Browser = detectBrowser(ua, platform);
export const iosSafariVersion = safariVersion(ua);

export const isStandalone = (): boolean =>
  isStandaloneEnv({
    matchMedia: (q) => matchMedia(q),
    navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
  });

// ---------- Chrome / Edge: системный диалог установки ----------

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
    // Установили прямо с экрана установки — сразу финальное сообщение
    if (gate.value === 'gate') markInstalled();
  });
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | null> {
  const p = installPrompt.value;
  if (!p) return null;
  await p.prompt();
  const { outcome } = await p.userChoice;
  installPrompt.value = null;
  return outcome;
}

// ---------- экран установки ----------

/** Ключи localStorage. SKIP_KEY ставит и «Продолжить в браузере», и тесты. */
export const SKIP_KEY = 'tp-install-skip';
export const CLAIM_KEY = 'tp-install-claimed';
export const SKIP_DAYS = 7;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, v: string | null): void {
  try {
    if (v == null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {
    /* приватный режим — просто не запомним */
  }
}

/** «Продолжить в браузере» нажимали меньше 7 дней назад */
export function skippedRecently(now = Date.now()): boolean {
  const t = Date.parse(read(SKIP_KEY) ?? '');
  return Number.isFinite(t) && now - t < SKIP_DAYS * 86_400_000 && t <= now + 60_000;
}

/**
 * 'gate' — инструкция, 'done' — «Готово! Открой с экрана Домой», 'off' — обычное приложение.
 * Показываем только на телефоне и только вне установленного приложения.
 */
function initialGate(): 'gate' | 'done' | 'off' {
  if (!isMobile(platform) || isStandalone()) return 'off';
  if (read(CLAIM_KEY)) return 'done';
  return skippedRecently() ? 'off' : 'gate';
}

export const gate = signal<'gate' | 'done' | 'off'>(initialGate());
/** Экран открыт вручную из настроек — его можно закрыть */
export const gateManual = signal(false);
export const gateVisible = computed(() => gate.value !== 'off');

export function markInstalled(): void {
  write(CLAIM_KEY, new Date().toISOString());
  gate.value = 'done';
}

export function continueInBrowser(): void {
  write(SKIP_KEY, new Date().toISOString());
  write(CLAIM_KEY, null);
  gate.value = 'off';
  gateManual.value = false;
}

/** «Показать инструкцию снова» с финального экрана или из настроек */
export function showInstructions(manual = false): void {
  write(CLAIM_KEY, null);
  gateManual.value = manual;
  gate.value = 'gate';
}

export function closeManualGate(): void {
  gateManual.value = false;
  gate.value = 'off';
}
