import type { Settings } from '../types';

/** Напоминание «Сохрани копию» — отдельно от формата копии (тот грузится лениво). */

export const REMIND_EVERY_DAYS = 7;
export const REMIND_SNOOZE_DAYS = 3;
const DAY = 86_400_000;

/**
 * Плашка «Сохрани копию»: с последней копии прошло ≥ 7 дней (или копии не было, а завершённые
 * тренировки есть), и её не закрывали последние 3 дня.
 */
export function backupReminderDue(
  s: Pick<Settings, 'lastBackupAt' | 'backupReminderDismissedAt'>,
  sessions: number,
  now: number,
): boolean {
  const last = s.lastBackupAt ? Date.parse(s.lastBackupAt) : NaN;
  const due = Number.isFinite(last) ? now - last >= REMIND_EVERY_DAYS * DAY : sessions > 0;
  if (!due) return false;
  const dismissed = s.backupReminderDismissedAt ? Date.parse(s.backupReminderDismissedAt) : NaN;
  return !(Number.isFinite(dismissed) && now - dismissed < REMIND_SNOOZE_DAYS * DAY);
}
