import { computed, effect, signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { PROGRAM, findDay } from '../data/program';
import { settings } from './settings';
import { active, suggestedDayId } from './workout';

// ---------- маршрутизация (hash — работает на GitHub Pages без настроек сервера) ----------

export type Tab = 'today' | 'program' | 'history' | 'settings';
export interface Route {
  tab: Tab;
  /** history/exercise/<id>, history/workout/<id> */
  sub?: { kind: 'exercise' | 'workout'; id: string };
}

function parse(hash: string): Route {
  const [tab, kind, id] = hash.replace(/^#\/?/, '').split('/');
  const t: Tab = tab === 'program' || tab === 'history' || tab === 'settings' ? tab : 'today';
  if (t === 'history' && (kind === 'exercise' || kind === 'workout') && id)
    return { tab: t, sub: { kind, id: decodeURIComponent(id) } };
  return { tab: t };
}

export const route = signal<Route>(parse(location.hash));
addEventListener('hashchange', () => {
  route.value = parse(location.hash);
  window.scrollTo(0, 0);
});

export function go(path: string): void {
  location.hash = '#/' + path;
}

// ---------- выбранный день (вне активной тренировки) ----------

/** null — следовать подсказке цикла */
export const pickedDayId = signal<string | null>(null);

export const todayDayId = computed(() => active.value?.dayId ?? pickedDayId.value ?? suggestedDayId.value);

/** День на экране «Программа» */
export const programDayId = signal<string>(PROGRAM[0]!.id);

export const accentDayId = computed(() =>
  route.value.tab === 'program' ? programDayId.value : todayDayId.value,
);

effect(() => {
  const d = findDay(accentDayId.value);
  const c = d?.color ?? 'c1';
  const st = document.documentElement.style;
  st.setProperty('--accent', `var(--${c})`);
  st.setProperty('--accent-fill', `var(--${c}-fill)`);
  st.setProperty('--accent-ink', `var(--${c}-ink)`);
});

// ---------- тема ----------

const THEME_BG = { light: '#F3F1EC', dark: '#111114' };
const mq = matchMedia('(prefers-color-scheme: dark)');
export const systemDark = signal(mq.matches);
mq.addEventListener('change', (e) => (systemDark.value = e.matches));

export const resolvedTheme = computed<'light' | 'dark'>(() => {
  const t = settings.value.theme;
  return t === 'system' ? (systemDark.value ? 'dark' : 'light') : t;
});

effect(() => {
  const t = settings.value.theme;
  const root = document.documentElement;
  if (t === 'system') delete root.dataset.theme;
  else root.dataset.theme = t;
  // theme-color: при ручной теме обе meta получают цвет выбранной темы
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  metas.forEach((m) => {
    const isDarkMeta = (m.media || '').includes('dark');
    m.content = t === 'system' ? (isDarkMeta ? THEME_BG.dark : THEME_BG.light) : THEME_BG[t];
  });
});

// ---------- тосты ----------

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
  ttl?: number;
}
export const toasts = signal<Toast[]>([]);
let tid = 0;

export function toast(text: string, opts: Omit<Toast, 'id' | 'text'> = {}): void {
  const t: Toast = { id: ++tid, text, ...opts };
  toasts.value = [...toasts.value.slice(-2), t];
  const ttl = opts.ttl ?? (opts.action ? 6000 : 3200);
  if (ttl > 0) setTimeout(() => dismissToast(t.id), ttl);
}

export function dismissToast(id: number): void {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

// ---------- модальные диалоги (вместо confirm()) ----------

export interface DialogSpec {
  title: string;
  body?: ComponentChildren;
  confirm: string;
  cancel?: string;
  danger?: boolean;
  /** Третья кнопка (например, «Отменить тренировку») */
  extra?: { label: string; danger?: boolean };
}

export interface OpenDialog extends DialogSpec {
  resolve: (r: 'confirm' | 'cancel' | 'extra') => void;
}

export const dialog = signal<OpenDialog | null>(null);

export function ask(spec: DialogSpec): Promise<'confirm' | 'cancel' | 'extra'> {
  return new Promise((resolve) => {
    dialog.value?.resolve('cancel');
    dialog.value = {
      ...spec,
      resolve: (r) => {
        dialog.value = null;
        resolve(r);
      },
    };
  });
}

export const confirmDialog = async (spec: DialogSpec): Promise<boolean> => (await ask(spec)) === 'confirm';
