import { computed, signal } from '@preact/signals';

/**
 * Переводы. Английский — источник истины (docs/CONCEPT.md, раздел 10).
 * Словари лежат в src/i18n/locales/<код>/*.json и подгружаются по одному языку:
 * каждый язык — отдельный чанк сборки. Проверка полноты: npm run i18n:check.
 */

export interface LocaleInfo {
  code: string;
  /** Название языка на нём самом */
  native: string;
  /** Intl-локаль для чисел и дат */
  intl: string;
}

/** Языки, для которых есть словари. Остальные из концепта добавляются папкой + строкой здесь. */
export const LOCALES: LocaleInfo[] = [
  { code: 'en', native: 'English', intl: 'en-GB' },
  { code: 'ru', native: 'Русский', intl: 'ru-RU' },
];

export const DEFAULT_LOCALE = 'en';

type Dict = { [k: string]: string | string[] | Dict };

const loaders = import.meta.glob<{ default: Dict }>('./locales/*/*.json');

const BOOT_KEY = 'tp-boot';

export const locale = signal<string>(DEFAULT_LOCALE);
const dict = signal<Dict>({});

export const localeInfo = computed(() => LOCALES.find((l) => l.code === locale.value) ?? LOCALES[0]!);

export const isSupported = (code: string | null | undefined): code is string =>
  !!code && LOCALES.some((l) => l.code === code);

function merge(a: Dict, b: Dict): Dict {
  const out: Dict = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const prev = out[k];
    out[k] =
      prev && typeof prev === 'object' && !Array.isArray(prev) && typeof v === 'object' && !Array.isArray(v)
        ? merge(prev, v)
        : v;
  }
  return out;
}

async function loadDict(code: string): Promise<Dict> {
  const files = Object.entries(loaders).filter(([p]) => p.startsWith(`./locales/${code}/`));
  const mods = await Promise.all(files.map(([, load]) => load()));
  return mods.reduce<Dict>((acc, m) => merge(acc, m.default), {});
}

/** Язык из прошлого запуска (до чтения базы) — чтобы не мигал английский */
export function bootLocale(): string {
  try {
    const raw = JSON.parse(localStorage.getItem(BOOT_KEY) ?? '{}') as { locale?: string };
    if (isSupported(raw.locale)) return raw.locale;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

export function saveBoot(patch: {
  locale?: string;
  theme?: string;
  motion?: string;
  themeColor?: string | undefined;
}): void {
  try {
    const cur = JSON.parse(localStorage.getItem(BOOT_KEY) ?? '{}') as object;
    localStorage.setItem(BOOT_KEY, JSON.stringify({ ...cur, ...patch }));
  } catch {
    /* приватный режим */
  }
}

let seq = 0;

/** Меняет язык сразу во всём интерфейсе */
export async function setLocale(code: string): Promise<void> {
  const target = isSupported(code) ? code : DEFAULT_LOCALE;
  const my = ++seq;
  const d = await loadDict(target);
  if (my !== seq) return; // пока грузили, выбрали другой язык
  dict.value = d;
  locale.value = target;
  document.documentElement.lang = target;
  saveBoot({ locale: target });
}

function lookup(key: string): unknown {
  let cur: unknown = dict.value;
  for (const part of key.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

const pluralRules = computed(() => new Intl.PluralRules(localeInfo.value.intl));

export type Params = Record<string, string | number>;

function interpolate(s: string, params?: Params): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = params[k];
    if (v == null) return m;
    return typeof v === 'number' ? fmtNum(v) : v;
  });
}

/**
 * Перевод по ключу. Если значение — объект форм множественного числа
 * ({ one, few, many, other }), форма выбирается через Intl.PluralRules по params.count.
 * Нет ключа — возвращается сам ключ (и i18n:check это ловит заранее).
 */
export function t(key: string, params?: Params): string {
  const v = lookup(key);
  if (typeof v === 'string') return interpolate(v, params);
  if (v && typeof v === 'object' && !Array.isArray(v) && params && typeof params.count === 'number') {
    const forms = v as Record<string, string>;
    const form = pluralRules.value.select(params.count);
    const s = forms[form] ?? forms.other;
    if (typeof s === 'string') return interpolate(s, params);
  }
  if (import.meta.env.DEV) console.warn('[i18n] missing', key);
  return key;
}

/** Список строк (например, шаги техники) */
export function tList(key: string): string[] {
  const v = lookup(key);
  return Array.isArray(v) ? v : [];
}

export const has = (key: string): boolean => lookup(key) !== undefined;

// ---------- Intl: числа и даты в языке интерфейса ----------

const nf = computed(() => new Intl.NumberFormat(localeInfo.value.intl, { maximumFractionDigits: 1 }));
const df = computed(
  () => new Intl.DateTimeFormat(localeInfo.value.intl, { day: 'numeric', month: 'long', weekday: 'short' }),
);
const sdf = computed(
  () => new Intl.DateTimeFormat(localeInfo.value.intl, { day: 'numeric', month: 'short' }),
);
const tf = computed(
  () => new Intl.DateTimeFormat(localeInfo.value.intl, { hour: '2-digit', minute: '2-digit' }),
);
const wdf = computed(() => new Intl.DateTimeFormat(localeInfo.value.intl, { weekday: 'short' }));
const wdlf = computed(() => new Intl.DateTimeFormat(localeInfo.value.intl, { weekday: 'long' }));

export const fmtNum = (n: number): string => nf.value.format(n);
export const fmtDate = (t: number): string => df.value.format(t);
export const fmtShortDate = (t: number): string => sdf.value.format(t).replace(/\.$/, '');
export const fmtTime = (t: number): string => tf.value.format(t);

/** 2024-01-01 — понедельник: от него считаем названия дней недели 0..6 */
const MONDAY = Date.UTC(2024, 0, 1, 12);
export const weekdayShort = (w: number): string => wdf.value.format(MONDAY + w * 86_400_000);
export const weekdayLong = (w: number): string => wdlf.value.format(MONDAY + w * 86_400_000);
