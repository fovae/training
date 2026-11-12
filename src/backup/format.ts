import * as v from 'valibot';
import { migrateSettingsV2 } from '../db/migrations';
import { DEFAULT_SETTINGS, THEMES, type Plan, type Profile, type Session, type Settings } from '../types';

/**
 * Формат копии (docs/BACKUP.md). Чистые функции — без DOM и IndexedDB, покрыты юнит-тестами.
 *
 * {
 *   app: 'simple-training', schemaVersion: 3, createdAt: ISO, appVersion,
 *   data: { profile, plan, sessions, settings },
 *   checksum: 'sha256:<hex>' — SHA-256 от canonical(data)
 * }
 * Файл не шифруется (так и написано в Terms, раздел 7). Защита при восстановлении — строгая проверка.
 */

export const BACKUP_APP = 'simple-training';
export const BACKUP_SCHEMA = 3;
/** Максимальный размер файла копии */
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export interface BackupData {
  profile: Profile | null;
  plan: Plan | null;
  sessions: Session[];
  settings: Settings;
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  createdAt: string;
  appVersion: string;
  data: BackupData;
  checksum: string;
}

// ---------- каноническая сериализация и контрольная сумма ----------

/**
 * Каноническая строка: JSON без пробелов, ключи объектов отсортированы по коду символа
 * (рекурсивно), порядок массивов сохраняется, undefined и функции пропускаются, числа — как
 * в JSON.stringify. Одинаковые данные всегда дают одну и ту же строку.
 */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value))
    return '[' + value.map((x) => (x === undefined ? 'null' : canonical(x))).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined && typeof obj[k] !== 'function')
    .sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}';
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Настройки без временных значений (что показано, когда закрыто напоминание) */
export function persistentSettings(s: Settings): Settings {
  const out: Settings = { ...s, tipState: {} };
  delete out.backupReminderDismissedAt;
  delete out.lastBackupAt;
  return out;
}

export async function buildBackup(
  data: BackupData,
  appVersion: string,
  now = new Date(),
): Promise<BackupFile> {
  const clean: BackupData = { ...data, settings: persistentSettings(data.settings) };
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA,
    createdAt: now.toISOString(),
    appVersion,
    data: clean,
    checksum: 'sha256:' + (await sha256(canonical(clean))),
  };
}

export const backupFileName = (now = new Date()): string =>
  `simple-training-backup-${now.toISOString().slice(0, 10)}.json`;

// ---------- строгая схема ----------

/** Управляющие символы недопустимы (в заметках разрешены перевод строки и табуляция) */
const hasControl = (s: string, multiline: boolean): boolean => {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if ((c < 32 || c === 127) && !(multiline && (c === 9 || c === 10 || c === 13))) return true;
  }
  return false;
};
const text = (max: number, multiline = false) =>
  v.pipe(
    v.string(),
    v.maxLength(max),
    v.check((s) => !hasControl(s, multiline)),
  );
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(100), v.regex(/^[\w.:-]+$/));
const iso = v.pipe(v.string(), v.maxLength(40), v.isoTimestamp());
const num = (min: number, max: number) => v.pipe(v.number(), v.finite(), v.minValue(min), v.maxValue(max));
const int = (min: number, max: number) => v.pipe(num(min, max), v.integer());

const SetSchema = v.strictObject({
  weightKg: v.optional(num(0, 2000)),
  reps: v.optional(int(0, 10000)),
  seconds: v.optional(int(0, 86400)),
  done: v.boolean(),
  doneAt: v.optional(iso),
});
const EntrySchema = v.strictObject({
  exerciseId: id,
  skipped: v.optional(v.boolean()),
  note: v.optional(text(1000, true)),
  sets: v.pipe(v.array(SetSchema), v.maxLength(50)),
});
const SessionSchema = v.strictObject({
  id,
  dayId: id,
  startedAt: iso,
  endedAt: v.optional(iso),
  note: v.optional(text(1000, true)),
  entries: v.pipe(v.array(EntrySchema), v.maxLength(60)),
});
const ItemSchema = v.strictObject({
  exerciseId: id,
  sets: int(1, 10),
  // повторы до 600 или секунды до 3 часов (упражнения на время)
  repsMin: int(1, 10_800),
  repsMax: int(1, 10_800),
  targetWeightKg: v.optional(num(0, 2000)),
  restSec: v.optional(int(0, 600)),
  optional: v.optional(v.boolean()),
});
const DaySchema = v.strictObject({
  id,
  label: v.optional(text(40)),
  labelKey: v.optional(v.pipe(v.string(), v.regex(/^tpl\.[\w.-]{1,60}$/))),
  weekday: v.optional(v.picklist([0, 1, 2, 3, 4, 5, 6] as const)),
  items: v.pipe(v.array(ItemSchema), v.maxLength(60)),
});
const PlanSchema = v.strictObject({
  mode: v.picklist(['weekdays', 'cycle'] as const),
  days: v.pipe(v.array(DaySchema), v.minLength(1), v.maxLength(7)),
  templateId: v.optional(v.pipe(v.string(), v.regex(/^[\w-]{1,40}$/))),
});
const ProfileSchema = v.strictObject({
  weightKg: num(20, 400),
  heightCm: num(80, 260),
  name: v.optional(text(40)),
  age: v.optional(int(16, 120)),
  sex: v.optional(v.picklist(['male', 'female', 'unspecified'] as const)),
  level: v.picklist(['first', 'few', 'intermediate', 'veteran'] as const),
  units: v.picklist(['metric', 'imperial'] as const),
  locale: v.pipe(v.string(), v.regex(/^[a-z]{2}(-[A-Za-z]{2,4})?$/)),
  adult16Confirmed: v.literal(true),
  confirmedAt: iso,
  legalAccepted: v.nullable(v.strictObject({ privacy: text(20), terms: text(20), at: iso })),
});
const SettingsSchema = v.strictObject({
  theme: v.picklist(['auto', ...THEMES] as const),
  tipsEnabled: v.boolean(),
  restBaseSec: int(15, 600),
  restIsoSec: int(15, 600),
  sound: v.boolean(),
  wakeLock: v.boolean(),
  lastBackupAt: v.optional(iso),
  backupReminderDismissedAt: v.optional(iso),
  tipState: v.record(v.pipe(v.string(), v.maxLength(120)), v.strictObject({ dismissedAt: iso })),
  weightWarningIgnored: v.pipe(v.array(id), v.maxLength(500)),
});
const DataSchema = v.strictObject({
  profile: v.nullable(ProfileSchema),
  plan: v.nullable(PlanSchema),
  sessions: v.pipe(v.array(SessionSchema), v.maxLength(20000)),
  settings: SettingsSchema,
});
const FileSchema = v.strictObject({
  app: v.literal(BACKUP_APP),
  schemaVersion: v.literal(BACKUP_SCHEMA),
  createdAt: iso,
  appVersion: text(20),
  data: DataSchema,
  checksum: v.pipe(v.string(), v.regex(/^sha256:[0-9a-f]{64}$/)),
});

// ---------- чтение файла ----------

export type BackupError = 'too-big' | 'not-json' | 'foreign' | 'newer' | 'invalid' | 'checksum';

export class BackupReadError extends Error {
  constructor(public code: BackupError) {
    super(code);
  }
}

export interface ParsedBackup {
  data: BackupData;
  createdAt: string | null;
  appVersion: string | null;
  schemaVersion: number;
}

/** Копии этапа 1 (app 'training-pwa', schema 2) — переводим в текущий формат */
function fromV2(r: Record<string, unknown>): ParsedBackup {
  const settings = migrateSettingsV2(r.settings ?? DEFAULT_SETTINGS);
  const candidate = {
    profile: null,
    plan: r.plan ?? null,
    sessions: Array.isArray(r.sessions) ? r.sessions.filter((s) => (s as Session)?.endedAt) : [],
    settings: { ...settings, tipState: {} },
  };
  const res = v.safeParse(DataSchema, candidate);
  if (!res.success) throw new BackupReadError('invalid');
  return {
    data: res.output as BackupData,
    createdAt: typeof r.exportedAt === 'string' ? r.exportedAt : null,
    appVersion: typeof r.appVersion === 'string' ? r.appVersion.slice(0, 20) : null,
    schemaVersion: 2,
  };
}

/** Строгая проверка: размер, JSON, приложение, версия схемы, структура, контрольная сумма */
export async function parseBackup(textContent: string, byteSize = textContent.length): Promise<ParsedBackup> {
  if (byteSize > MAX_BACKUP_BYTES) throw new BackupReadError('too-big');
  let raw: unknown;
  try {
    raw = JSON.parse(textContent);
  } catch {
    throw new BackupReadError('not-json');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BackupReadError('foreign');
  const r = raw as Record<string, unknown>;
  if (r.app === 'training-pwa' && r.schema === 2) return fromV2(r);
  if (r.app !== BACKUP_APP) throw new BackupReadError('foreign');
  if (typeof r.schemaVersion !== 'number') throw new BackupReadError('invalid');
  if (r.schemaVersion > BACKUP_SCHEMA) throw new BackupReadError('newer');
  const res = v.safeParse(FileSchema, raw);
  if (!res.success) throw new BackupReadError('invalid');
  const file = res.output as BackupFile;
  const sum = 'sha256:' + (await sha256(canonical(file.data)));
  if (sum !== file.checksum) throw new BackupReadError('checksum');
  return {
    data: file.data,
    createdAt: file.createdAt,
    appVersion: file.appVersion,
    schemaVersion: file.schemaVersion,
  };
}

export interface BackupSummary {
  sessions: number;
  from: string | null;
  to: string | null;
  locale: string | null;
  appVersion: string | null;
}

export function summarize(p: ParsedBackup): BackupSummary {
  const dates = p.data.sessions.map((s) => s.startedAt).sort();
  return {
    sessions: p.data.sessions.length,
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
    locale: p.data.profile?.locale ?? null,
    appVersion: p.appVersion,
  };
}

export { backupReminderDue, REMIND_EVERY_DAYS, REMIND_SNOOZE_DAYS } from './reminder';
