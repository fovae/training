import type { Session, Settings } from '../types';

/**
 * Напоминание «Сохрани копию» (0.1.0) — отдельно от формата копии (тот грузится лениво).
 * Не навязываем: плашка появляется один раз на каждую 7-ю тренировку после последней копии
 * (7, 14, 21…). «Позже» или следующая тренировка — плашка уходит до следующей семёрки;
 * «Не напоминать» — выключает совсем (включается обратно в настройках, раздел «Данные»).
 */
export const REMIND_EVERY = 7;

const end = (s: Pick<Session, 'startedAt' | 'endedAt'>) => Date.parse(s.endedAt ?? s.startedAt);

export function backupReminderDue(
  s: Pick<Settings, 'lastBackupAt' | 'backupReminderDismissedAt' | 'backupReminderOff'>,
  sessions: readonly Pick<Session, 'startedAt' | 'endedAt'>[],
): boolean {
  if (s.backupReminderOff) return false;
  const last = s.lastBackupAt ? Date.parse(s.lastBackupAt) : -Infinity;
  const ends = sessions.map(end).filter((t) => Number.isFinite(t) && t > last);
  if (ends.length === 0 || ends.length % REMIND_EVERY !== 0) return false;
  const dismissed = s.backupReminderDismissedAt ? Date.parse(s.backupReminderDismissedAt) : -Infinity;
  return !(dismissed >= Math.max(...ends));
}
