import { computed, signal } from '@preact/signals';
import * as store from '../db';
import type { BackupSummary, ParsedBackup } from '../backup/format';
import { backupReminderDue } from '../backup/reminder';

/** Формат копии и строгая схема (valibot) грузятся отдельным чанком — только при сохранении/восстановлении */
const format = () => import('../backup/format');
import { setLocale, t } from '../i18n';
import { loadPlan } from '../state/plan';
import { history, loadSessions } from '../state/session';
import { loadSettingsAndProfile, profile, settings, updateSettings } from '../state/settings';

/**
 * «Сохранить копию» и «Восстановить из копии» (формат — src/backup/format.ts, docs/BACKUP.md).
 * Копия через системное меню «Поделиться» (файл), запасной путь — обычная загрузка файла.
 */

export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

export async function saveCopy(): Promise<SaveResult> {
  const { buildBackup, backupFileName } = await format();
  const d = await store.readAll();
  const file = await buildBackup(
    { profile: d.profile, plan: d.plan, sessions: d.sessions, settings: settings.value },
    __APP_VERSION__,
  );
  const name = backupFileName();
  const blob = new File([JSON.stringify(file, null, 2)], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  let result: SaveResult | null = null;
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [blob] })) {
    try {
      await nav.share({ files: [blob], title: t('backup.shareTitle') });
      result = 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
      // Файл не приняли — скачиваем
    }
  }
  if (!result) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    result = 'downloaded';
  }
  updateSettings({ lastBackupAt: new Date().toISOString() });
  return result;
}

// ---------- восстановление ----------

export interface ReadyRestore {
  parsed: ParsedBackup;
  summary: BackupSummary;
}

/** Читает и проверяет файл. Бросает Error с понятным текстом (только текст, без HTML). */
export async function readBackupFile(file: File): Promise<ReadyRestore> {
  const { parseBackup, summarize, BackupReadError } = await format();
  try {
    const parsed = await parseBackup(file.size > 10 * 1024 * 1024 ? '' : await file.text(), file.size);
    return { parsed, summary: summarize(parsed) };
  } catch (e) {
    const code = e instanceof BackupReadError ? e.code : 'invalid';
    throw new Error(t(`backup.err.${code}`), { cause: e });
  }
}

/** Есть снимок для «Отменить восстановление» (до следующего изменения данных) */
export const undoAvailable = signal(false);

async function reloadState(): Promise<void> {
  await Promise.all([loadSettingsAndProfile(), loadPlan(), loadSessions()]);
  const loc = profile.value?.locale;
  if (loc) await setLocale(loc);
}

/** Заменить данные одной транзакцией, сохранив снимок прежних для отката */
export async function applyRestore(r: ReadyRestore): Promise<void> {
  const cur = await store.readAll();
  const snapshot: store.RestoreSnapshot = { takenAt: new Date().toISOString(), ...cur };
  const d = r.parsed.data;
  await store.replaceAll(
    {
      // Копия без профиля (старый формат) — оставляем текущий профиль
      profile: d.profile ?? cur.profile,
      plan: d.plan ?? cur.plan,
      settings: { ...d.settings, lastBackupAt: settings.value.lastBackupAt ?? d.settings.lastBackupAt },
      active: null,
      sessions: d.sessions,
    },
    snapshot,
  );
  await reloadState();
  undoAvailable.value = true;
}

export async function undoRestore(): Promise<boolean> {
  const snap = await store.getRestoreSnapshot();
  if (!snap) {
    undoAvailable.value = false;
    return false;
  }
  await store.replaceAll(
    {
      profile: snap.profile,
      plan: snap.plan,
      settings: snap.settings,
      active: snap.active,
      sessions: snap.sessions,
    },
    null,
  );
  await reloadState();
  undoAvailable.value = false;
  return true;
}

export async function initUndo(): Promise<void> {
  store.onDataChange(() => (undoAvailable.value = false));
  undoAvailable.value = !!(await store.getRestoreSnapshot());
}

// ---------- напоминание ----------

export const reminderDue = computed(() =>
  backupReminderDue(settings.value, history.value.length, Date.now()),
);

export function dismissReminder(): void {
  updateSettings({ backupReminderDismissedAt: new Date().toISOString() });
}

// ---------- постоянное хранилище ----------

export type PersistStatus = 'unsupported' | 'persisted' | 'not-persisted' | 'unknown';
export const persistStatus = signal<PersistStatus>('unknown');

export async function checkPersist(): Promise<void> {
  if (!navigator.storage?.persisted) {
    persistStatus.value = 'unsupported';
    return;
  }
  try {
    persistStatus.value = (await navigator.storage.persisted()) ? 'persisted' : 'not-persisted';
  } catch {
    persistStatus.value = 'unknown';
  }
}

export async function requestPersist(): Promise<void> {
  if (!navigator.storage?.persist) {
    persistStatus.value = 'unsupported';
    return;
  }
  try {
    persistStatus.value = (await navigator.storage.persist()) ? 'persisted' : 'not-persisted';
  } catch {
    persistStatus.value = 'unknown';
  }
}

/** «Delete all data»: удаляет всё, приложение возвращается к онбордингу */
export async function resetAll(): Promise<void> {
  await store.clearAll();
  undoAvailable.value = false;
  await reloadState();
}
