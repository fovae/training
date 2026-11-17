import { signal } from '@preact/signals';
import { TOUR_VERSION } from '../lib/tour';
import { plannerOpen } from './planner';
import { settings, updateSettings } from './settings';
import { go } from './ui';

/**
 * Тур (3.24): открыт ли и как закрывается. Показ сразу после онбординга решает App.tsx
 * (shouldShowTour); «Показать тур» — в «Настройки → О приложении».
 */
export const tourOpen = signal(false);

export const openTour = () => (tourOpen.value = true);

/** Закрыть тур (любым способом): запомнить версию и — если не открыт помощник — на «Сегодня» */
export function finishTour(): void {
  if (!tourOpen.value) return;
  // сначала отметка «видел» — иначе автопоказ (App.tsx) открыл бы тур снова
  if ((settings.value.tourSeen ?? 0) < TOUR_VERSION) updateSettings({ tourSeen: TOUR_VERSION });
  tourOpen.value = false;
  // онбординг со стартом «Подбор плана»: под туром уже открыт помощник — остаёмся с ним
  if (!plannerOpen.value) go('today');
  requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
}
