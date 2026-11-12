import { expect, test } from '@playwright/test';
import {
  BACKUP_SCHEMA,
  MAX_BACKUP_BYTES,
  backupFileName,
  buildBackup,
  canonical,
  parseBackup,
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
  expect(backupFileName(new Date('2026-11-12T09:00:00Z'))).toBe('simple-training-backup-2026-11-12.json');
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

test('stage 1 backups (training-pwa, schema 2) are migrated', async () => {
  const old = {
    app: 'training-pwa',
    schema: 2,
    exportedAt: '2026-11-01T10:00:00.000Z',
    appVersion: '2.1.0',
    sessions: data().sessions,
    active: null,
    plan: data().plan,
    settings: {
      theme: 'dark',
      tipsEnabled: true,
      restBaseSec: 150,
      restIsoSec: 90,
      sound: true,
      wakeLock: true,
    },
  };
  const parsed = await parseBackup(JSON.stringify(old));
  expect(parsed.schemaVersion).toBe(2);
  expect(parsed.data.settings.theme).toBe('classic-dark');
  expect(parsed.data.sessions).toHaveLength(1);
  expect(parsed.data.profile).toBeNull();
});

test('reminder: every 7 days, snooze 3 days', () => {
  const now = Date.parse('2026-11-12T10:00:00Z');
  const ago = (d: number) => new Date(now - d * DAY).toISOString();
  expect(backupReminderDue({}, 0, now)).toBe(false);
  expect(backupReminderDue({}, 1, now)).toBe(true);
  expect(backupReminderDue({ lastBackupAt: ago(6) }, 5, now)).toBe(false);
  expect(backupReminderDue({ lastBackupAt: ago(7) }, 5, now)).toBe(true);
  expect(backupReminderDue({ lastBackupAt: ago(8), backupReminderDismissedAt: ago(2) }, 5, now)).toBe(false);
  expect(backupReminderDue({ lastBackupAt: ago(8), backupReminderDismissedAt: ago(3) }, 5, now)).toBe(true);
});
