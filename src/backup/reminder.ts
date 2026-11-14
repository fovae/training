import type { Settings } from '../types';

/** Напоминание «Сохрани копию» — отдельно от формата копии (тот грузится лениво). */

export const REMIND_EVERY_DAYS = 14;
/** Закрытое напоминание не показывается до следующего срока — тоже 14 дней */
export const REMIND_SNOOZE_DAYS = 14;
const DAY = 86_400_000;

/**
 * Плашка «Обнови копию»: с последнего подтверждённого экспорта прошло ≥ 14 дней (или экспорта не было,
 * а сохранить уже есть что — завершённые тренировки), и её не закрывали последние 14 дней.
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
