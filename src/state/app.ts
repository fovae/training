import { computed, signal } from '@preact/signals';
import * as store from '../db';
import type { LegacyPrefs } from '../db/migrations';
import { bootLocale, isSupported, setLocale } from '../i18n';
import { loadPlan } from './plan';
import { loadSessions, loadError } from './session';
import { draftUnits, loadSettingsAndProfile, profile } from './settings';

export const booted = signal(false);
/** Данные первой версии приложения (если были) — для подсказок в онбординге */
export const legacy = signal<LegacyPrefs | null>(null);

/** Онбординг нужен, пока нет профиля (план уже может быть — после миграции) */
export const needsOnboarding = computed(() => booted.value && !profile.value);

export async function initApp(): Promise<void> {
  // Пользователь v1 впервые открывает новую версию: подставим русский, как было в старом интерфейсе
  const firstRun = !hasBoot();
  const localeP = setLocale(bootLocale());
  try {
    await Promise.all([loadSettingsAndProfile(), loadPlan(), loadSessions()]);
    legacy.value = profile.value ? null : await store.getLegacyPrefs();
  } catch (e) {
    console.error(e);
    loadError.value = true;
  }
  await localeP;
  const want = profile.value?.locale ?? (legacy.value && firstRun ? legacy.value.locale : null);
  if (isSupported(want) && want !== document.documentElement.lang) await setLocale(want);
  if (legacy.value) draftUnits.value = legacy.value.units;
  booted.value = true;
}

function hasBoot(): boolean {
  try {
    return !!localStorage.getItem('tp-boot');
  } catch {
    return false;
  }
}
