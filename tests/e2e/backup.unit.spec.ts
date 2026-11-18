import { expect, test } from '@playwright/test';
import {
  BACKUP_SCHEMA,
  MAX_BACKUP_BYTES,
  backupFileName,
  buildBackup,
  canonical,
  parseBackup,
  sha256,
  summarize,
  type BackupData,
} from '../../src/backup/format';
import { backupReminderDue } from '../../src/backup/reminder';
import { DEFAULT_SETTINGS } from '../../src/types';

const DAY = 86_400_000;
const data = (): BackupData => ({
  profile: {
    weightKg: 80,
    heightCm: 180,
    level: 'intermediate',
    units: 'metric',
    locale: 'ru',
    adult16Confirmed: true,
    confirmedAt: '2026-11-01T10:00:00.000Z',
    legalAccepted: { privacy: '1.2', terms: '1.0', at: '2026-11-01T10:00:00.000Z' },
  },
  plan: {
    mode: 'cycle',
    days: [{ id: 'day-1', items: [{ exerciseId: 'incline-db-press', sets: 3, repsMin: 8, repsMax: 12 }] }],
  },
  sessions: [
    {
      id: 's1',
      dayId: 'day-1',
      startedAt: '2026-11-02T10:00:00.000Z',
      endedAt: '2026-11-02T11:00:00.000Z',
      note: 'Felt good\nline two',
      entries: [{ exerciseId: 'incline-db-press', sets: [{ weightKg: 22.5, reps: 10, done: true }] }],
    },
  ],
  settings: {
    ...DEFAULT_SETTINGS,
    tipState: { 'progression:x': { dismissedAt: '2026-11-01T10:00:00.000Z' } },
  },
});

test('canonical: stable key order, arrays kept, undefined dropped', () => {
  expect(canonical({ b: 1, a: [3, { d: undefined, c: 'x' }] })).toBe('{"a":[3,{"c":"x"}],"b":1}');
  expect(canonical({ a: 1, b: 2 })).toBe(canonical({ b: 2, a: 1 }));
});

test('round trip: build → parse, checksum, summary, temporary settings dropped', async () => {
  const file = await buildBackup(data(), '2.3.0', new Date('2026-11-12T09:00:00Z'));
  expect(file.schemaVersion).toBe(BACKUP_SCHEMA);
  expect(file.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
  expect(file.data.settings.tipState).toEqual({});
  // одно постоянное имя; дата и версия схемы — внутри JSON
  expect(backupFileName()).toBe('simple-training-backup.json');
  expect(file.createdAt).toBe('2026-11-12T09:00:00.000Z');
  const text = JSON.stringify(file, null, 2);
  const parsed = await parseBackup(text);
  expect(parsed.data.sessions[0]!.note).toBe('Felt good\nline two');
  expect(summarize(parsed)).toEqual({
    sessions: 1,
    from: '2026-11-02T10:00:00.000Z',
    to: '2026-11-02T10:00:00.000Z',
    locale: 'ru',
    appVersion: '2.3.0',
  });
});

test('rejects: broken checksum, foreign, newer schema, too big, not JSON, bad ranges', async () => {
  const file = await buildBackup(data(), '2.3.0');
  const bad = structuredClone(file);
  bad.data.sessions[0]!.entries[0]!.sets[0]!.reps = 11; // данные изменены, сумма — нет
  await expect(parseBackup(JSON.stringify(bad))).rejects.toMatchObject({ code: 'checksum' });
  await expect(parseBackup(JSON.stringify({ ...file, app: 'other' }))).rejects.toMatchObject({
    code: 'foreign',
  });
  await expect(
    parseBackup(JSON.stringify({ ...file, schemaVersion: BACKUP_SCHEMA + 1 })),
  ).rejects.toMatchObject({
    code: 'newer',
  });
  await expect(parseBackup('x', MAX_BACKUP_BYTES + 1)).rejects.toMatchObject({ code: 'too-big' });
  await expect(parseBackup('{not json')).rejects.toMatchObject({ code: 'not-json' });
  const range = structuredClone(file);
  range.data.profile!.weightKg = 5000;
  await expect(parseBackup(JSON.stringify(range))).rejects.toMatchObject({ code: 'invalid' });
  const extra = structuredClone(file) as unknown as Record<string, unknown>;
  (extra.data as Record<string, unknown>).evil = 1;
  await expect(parseBackup(JSON.stringify(extra))).rejects.toMatchObject({ code: 'invalid' });
  const ctrl = structuredClone(file);
  ctrl.data.sessions[0]!.note = 'a\u0000b';
  await expect(parseBackup(JSON.stringify(ctrl))).rejects.toMatchObject({ code: 'invalid' });
});

test('HTML-like strings are kept as plain text data (rendering is text-only)', async () => {
  const d = data();
  d.sessions[0]!.note = '<script>alert(1)</script><img src=x onerror=alert(1)>';
  const file = await buildBackup(d, '2.3.0');
  const parsed = await parseBackup(JSON.stringify(file));
  expect(parsed.data.sessions[0]!.note).toBe(d.sessions[0]!.note);
});

test('0.1.0: copies of test versions (old schemas, training-pwa) are not read; optional fields round-trip', async () => {
  const d = data();
  // копия тестовой версии: app 'training-pwa', schema 2
  await expect(
    parseBackup(JSON.stringify({ app: 'training-pwa', schema: 2, sessions: [], settings: {} })),
  ).rejects.toMatchObject({ code: 'foreign' });
  // simple-training со схемой тестовых версий (3–9) — «новее», чем 0.1.0 умеет: не читаем
  const old = structuredClone(await buildBackup(d, '3.24.0')) as unknown as { schemaVersion: number };
  old.schemaVersion = 9;
  await expect(parseBackup(JSON.stringify(old))).rejects.toMatchObject({ code: 'newer' });
  // удалённая тема из тестовых версий — файл не принимается
  const neon = structuredClone(await buildBackup(d, '0.1.0')) as unknown as {
    data: { settings: Record<string, unknown> };
    checksum: string;
  };
  neon.data.settings.theme = 'classic-orange';
  neon.checksum = 'sha256:' + (await sha256(canonical(neon.data)));
  await expect(parseBackup(JSON.stringify(neon))).rejects.toMatchObject({ code: 'invalid' });
  // необязательные настройки переживают копию
  const now = await buildBackup(
    {
      ...d,
      settings: {
        ...d.settings,
        theme: 'sun-paper',
        motion: 'off',
        pace: 'slow',
        useHistory: false,
        hideRules: true,
        backupReminderOff: true,
      },
    },
    '0.1.0',
  );
  expect(now.schemaVersion).toBe(BACKUP_SCHEMA);
  expect(BACKUP_SCHEMA).toBe(1);
  expect((await parseBackup(JSON.stringify(now))).data.settings).toMatchObject({
    theme: 'sun-paper',
    motion: 'off',
    pace: 'slow',
    useHistory: false,
    hideRules: true,
    backupReminderOff: true,
  });
});

test('reminder: once per 7 workouts after the last copy; «later» — until the next 7; off — never', () => {
  const t0 = Date.parse('2026-11-01T10:00:00Z');
  const at = (d: number) => new Date(t0 + d * DAY).toISOString();
  const runs = (n: number, from = 0) =>
    Array.from({ length: n }, (_, i) => ({ startedAt: at(from + i), endedAt: at(from + i + 0.05) }));
  expect(backupReminderDue({}, [])).toBe(false);
  expect(backupReminderDue({}, runs(1))).toBe(false);
  expect(backupReminderDue({}, runs(6))).toBe(false);
  expect(backupReminderDue({}, runs(7))).toBe(true);
  // восьмая без ответа — плашка ушла сама, до 14-й
  expect(backupReminderDue({}, runs(8))).toBe(false);
  expect(backupReminderDue({}, runs(14))).toBe(true);
  // «Позже» после 7-й — молчит на 7-й, снова на 14-й
  expect(backupReminderDue({ backupReminderDismissedAt: at(6.5) }, runs(7))).toBe(false);
  expect(backupReminderDue({ backupReminderDismissedAt: at(6.5) }, runs(14))).toBe(true);
  // счёт идёт от последней копии
  expect(backupReminderDue({ lastBackupAt: at(2.5) }, runs(7))).toBe(false);
  expect(backupReminderDue({ lastBackupAt: at(2.5) }, runs(10))).toBe(true);
  // «Не напоминать»
  expect(backupReminderDue({ backupReminderOff: true }, runs(7))).toBe(false);
  // незавершённая (нет endedAt) считается по началу
  expect(backupReminderDue({}, [...runs(6), { startedAt: at(9) }])).toBe(true);
});

test('3.24: tourSeen survives a round trip; copies without it still parse', async () => {
  const d = data();
  const withTour = await buildBackup({ ...d, settings: { ...d.settings, tourSeen: 1 } }, '3.24.0');
  expect((await parseBackup(JSON.stringify(withTour))).data.settings.tourSeen).toBe(1);
  const without = await buildBackup(d, '3.23.0');
  expect((await parseBackup(JSON.stringify(without))).data.settings.tourSeen).toBeUndefined();
  // мусор вместо версии — копия отклоняется (строгая проверка), а не ломает приложение
  const bad = await buildBackup({ ...d, settings: { ...d.settings, tourSeen: 1 } }, '3.24.0');
  (bad.data.settings as { tourSeen: unknown }).tourSeen = 'x';
  await expect(parseBackup(JSON.stringify(bad))).rejects.toThrow();
});
