import { computed } from '@preact/signals';
import type { PlanItem } from '../types';
import { history } from '../state/session';
import { profile, settings, updateSettings } from '../state/settings';
import { tipsFor, type Advice } from './rules';

/**
 * Связка правил (rules.ts — чистые функции) с состоянием приложения.
 * Все советы выключаются одним переключателем settings.tipsEnabled.
 */
export type { Advice } from './rules';

/** Советы на день (или идущую тренировку): не больше двух, закрытые не повторяются 14 дней */
export function dayTips(
  dayId: string,
  items: PlanItem[],
  opts: { withRecovery?: boolean; beforeIso?: string } = {},
): Advice[] {
  const s = settings.value;
  const before = opts.beforeIso;
  return tipsFor({
    dayId,
    items,
    history: before ? history.value.filter((x) => x.startedAt < before) : history.value,
    level: profile.value?.level,
    now: Date.now(),
    tipState: s.tipState,
    enabled: s.tipsEnabled,
    withRecovery: !!opts.withRecovery,
  });
}

export function dismissTip(id: string): void {
  updateSettings({
    tipState: { ...settings.value.tipState, [id]: { dismissedAt: new Date().toISOString() } },
  });
}

export const tipsEnabled = computed(() => settings.value.tipsEnabled);
