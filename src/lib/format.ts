import { fmtNum, t } from '../i18n';
import { units } from '../state/settings';

const LB = 2.2046226218;
const IN = 2.54;

/** кг → число в выбранных единицах (для показа и полей ввода) */
export function toUnit(kg: number | null | undefined): number | null {
  if (kg == null) return null;
  if (units.value === 'imperial') return Math.round(kg * LB * 2) / 2;
  return Math.round(kg * 100) / 100;
}

/** число в выбранных единицах → кг (для хранения) */
export function fromUnit(v: number | null): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  if (units.value === 'imperial') return Math.round((v / LB) * 1000) / 1000;
  return Math.round(v * 100) / 100;
}

export const unitLabel = (): string => t(units.value === 'imperial' ? 'unit.lb' : 'unit.kg');

export function fmtWeight(kg: number | null | undefined): string {
  const v = toUnit(kg);
  return v == null ? '—' : `${fmtNum(v)} ${unitLabel()}`;
}

/** Вес тела — точнее, чем вес снаряда */
export const kgToLb = (kg: number): number => Math.round(kg * LB * 10) / 10;
export const lbToKg = (lb: number): number => Math.round((lb / LB) * 10) / 10;
export const cmToFtIn = (cm: number): { ft: number; inch: number } => {
  const total = Math.round(cm / IN);
  return { ft: Math.floor(total / 12), inch: total % 12 };
};
export const ftInToCm = (ft: number, inch: number): number => Math.round((ft * 12 + inch) * IN);

/** Парсинг ввода: принимает и запятую, и точку */
export function parseDecimal(s: string): number | null {
  const v = s.replace(',', '.').trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Число в поле ввода: десятичный разделитель как в языке интерфейса */
export function inputNum(n: number | null | undefined): string {
  if (n == null) return '';
  const sep = fmtNum(1.5).includes(',') ? ',' : '.';
  return String(n).replace('.', sep);
}

export function fmtDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return t('fmt.minutes', { n: min });
  return t('fmt.hoursMinutes', { h: Math.floor(min / 60), m: min % 60 });
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** «2–3 мин», «90 с» — для подписи отдыха */
export function fmtRest(sec: number): string {
  if (sec >= 120 && sec % 60 === 0) return t('fmt.restMin', { n: sec / 60 });
  if (sec > 60) return fmtClock(sec);
  return t('fmt.restSec', { n: sec });
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

export const ms = (iso: string | undefined): number => (iso ? Date.parse(iso) : 0);

/** Убирает поля со значением undefined (в IndexedDB храним без пустых ключей) */
export function compact<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** Время подхода: «45 с», «1:30», «30:00», «1:05:00» */
export function fmtSetTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} ${t('unit.sec')}`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Диапазон времени в плане: «20–40 с» или «5–10 мин» (если оба значения — целые минуты) */
export function fmtTimeRange(min: number, max: number): string {
  const n = (v: number) => fmtNum(v);
  const range = (a: number, b: number) => (a === b ? n(a) : `${n(a)}–${n(b)}`);
  if (min >= 60 && min % 60 === 0 && max % 60 === 0) return `${range(min / 60, max / 60)} ${t('unit.min')}`;
  return `${range(min, max)} ${t('unit.sec')}`;
}
