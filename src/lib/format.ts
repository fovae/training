import { settings } from '../state/settings';

const LB = 2.2046226218;

/** кг → число в выбранных единицах (для отображения и полей ввода) */
export function toUnit(kg: number | null | undefined): number | null {
  if (kg == null) return null;
  if (settings.value.units === 'lb') return Math.round(kg * LB * 2) / 2;
  return Math.round(kg * 100) / 100;
}

/** число в выбранных единицах → кг (для хранения) */
export function fromUnit(v: number | null): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  if (settings.value.units === 'lb') return Math.round((v / LB) * 1000) / 1000;
  return Math.round(v * 100) / 100;
}

export const unitLabel = (): string => (settings.value.units === 'lb' ? 'фунт' : 'кг');

export function fmtNum(n: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n);
}

export function fmtWeight(kg: number | null | undefined): string {
  const v = toUnit(kg);
  return v == null ? '—' : `${fmtNum(v)} ${unitLabel()}`;
}

/** Парсинг ввода: принимает и запятую, и точку */
export function parseDecimal(s: string): number | null {
  const t = s.replace(',', '.').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function fmtDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} мин`;
  return `${Math.floor(min / 60)} ч ${min % 60} мин`;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
const shortFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

export const fmtDate = (t: number): string => dateFmt.format(t);
export const fmtShortDate = (t: number): string => shortFmt.format(t).replace('.', '');
export const fmtTime = (t: number): string => timeFmt.format(t);

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Начало текущей недели (понедельник 00:00) */
export function weekStart(now = new Date()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
