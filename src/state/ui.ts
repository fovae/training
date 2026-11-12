import { computed, effect, signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { settings, settingsReady } from './settings';
import { resolveTheme, themeColor } from '../themes';
import { dayColor, plan } from './plan';
import { active, suggestedDayId } from './session';

// ---------- маршрутизация (hash — работает на GitHub Pages без настроек сервера) ----------

export type Tab = 'today' | 'plan' | 'library' | 'history' | 'settings' | 'legal';
export interface Route {
  tab: Tab;
  /** history/exercise/<id>, history/workout/<id>, library/<id>, legal/<doc> */
  sub?: { kind: string; id: string };
}

const TABS: Tab[] = ['today', 'plan', 'library', 'history', 'settings', 'legal'];

export function parseRoute(hash: string): Route {
  const [tab, a, b] = hash.replace(/^#\/?/, '').split('/');
  // Старый адрес «Программа» ведёт в план
  const t: Tab = tab === 'program' ? 'plan' : TABS.includes(tab as Tab) ? (tab as Tab) : 'today';
  if (t === 'history' && (a === 'exercise' || a === 'workout') && b)
    return { tab: t, sub: { kind: a, id: decodeURIComponent(b) } };
  if (t === 'library' && a) return { tab: t, sub: { kind: 'exercise', id: decodeURIComponent(a) } };
  if (t === 'settings' && a) return { tab: t, sub: { kind: 'section', id: a } };
  if (t === 'legal')
    return { tab: t, sub: { kind: 'doc', id: a === 'terms' || a === 'licenses' ? a : 'privacy' } };
  return { tab: t };
}

export const route = signal<Route>(parseRoute(location.hash));
addEventListener('hashchange', () => {
  route.value = parseRoute(location.hash);
  window.scrollTo(0, 0);
});

export function go(path: string): void {
  location.hash = '#/' + path;
}

// ---------- выбранный день (вне активной тренировки) ----------

/** null — следовать подсказке плана */
export const pickedDayId = signal<string | null>(null);

export const todayDayId = computed<string | null>(() => {
  const days = plan.value?.days ?? [];
  const ok = (id: string | null | undefined) => (id && days.some((d) => d.id === id) ? id : null);
  return active.value?.dayId ?? ok(pickedDayId.value) ?? suggestedDayId.value;
});

/** День на экране «План» */
export const planDayId = signal<string | null>(null);

effect(() => {
  const id = route.value.tab === 'plan' ? planDayId.value : todayDayId.value;
  const c = id ? dayColor(id) : 'c1';
  const st = document.documentElement.style;
  st.setProperty('--accent', `var(--${c})`);
  st.setProperty('--accent-fill', `var(--${c}-fill)`);
  st.setProperty('--accent-ink', `var(--${c}-ink)`);
});

// ---------- тема ----------

effect(() => {
  // До чтения настроек не трогаем тему: иначе тема по умолчанию на миг перекрасит экран
  if (!settingsReady.value) return;
  const th = settings.value.theme;
  document.documentElement.dataset.theme = th;
  // theme-color: для «Авто» — свой цвет для светлой и тёмной системной темы, иначе цвет темы
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const dark = (m.media || '').includes('dark');
    m.content = themeColor(resolveTheme(th, dark));
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
  const item: Toast = { id: ++tid, text, ...opts };
  toasts.value = [...toasts.value.slice(-2), item];
  const ttl = opts.ttl ?? (opts.action ? 6000 : 3200);
  if (ttl > 0) setTimeout(() => dismissToast(item.id), ttl);
}

export function dismissToast(id: number): void {
  toasts.value = toasts.value.filter((x) => x.id !== id);
}

// ---------- модальные диалоги ----------

export interface DialogSpec {
  title: string;
  body?: ComponentChildren;
  confirm: string;
  cancel?: string;
  danger?: boolean;
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
