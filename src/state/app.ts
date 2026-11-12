import { computed, signal } from '@preact/signals';
import { bootLocale, isSupported, setLocale } from '../i18n';
import { loadCatalog } from '../data/exercises';
import { loadPlan } from './plan';
import { loadSessions, loadError } from './session';
import { loadSettingsAndProfile, profile } from './settings';

export const booted = signal(false);

/** Онбординг нужен, пока нет профиля */
export const needsOnboarding = computed(() => booted.value && !profile.value);

export async function initApp(): Promise<void> {
  const localeP = setLocale(bootLocale());
  try {
    await Promise.all([loadCatalog(), loadSettingsAndProfile(), loadPlan(), loadSessions()]);
  } catch (e) {
    console.error(e);
    loadError.value = true;
  }
  await localeP;
  const want = profile.value?.locale;
  if (isSupported(want) && want !== document.documentElement.lang) await setLocale(want);
  booted.value = true;
}
