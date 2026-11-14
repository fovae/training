import { effect } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { settings, settingsReady } from '../state/settings';

/**
 * Анимации (docs/ARCHITECTURE.md, «Анимации»). Всё движение — CSS (transform и opacity, 150–350 мс,
 * ease-out), здесь только переключатель и помощники для ухода элементов.
 *  html[data-motion="off"] — выключены настройкой; "on" — включены, даже если в системе
 *  «уменьшение движения»; без атрибута — как в системе (@media prefers-reduced-motion).
 */

const reduceMq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/** Анимации сейчас выключены (настройкой или системой) */
export function motionOff(): boolean {
  const m = settings.value.motion ?? 'system';
  return m === 'off' || (m === 'system' && !!reduceMq?.matches);
}

effect(() => {
  if (!settingsReady.value) return;
  const m = settings.value.motion ?? 'system';
  const root = document.documentElement;
  if (m === 'system') delete root.dataset.motion;
  else root.dataset.motion = m;
});

/** Длительность ухода (мс): та же, что в CSS (--t-out) */
export const OUT_MS = 200;

/**
 * Плавный уход элемента: класс .leaving (CSS-анимация), затем done(). Без анимаций — сразу.
 * Для плашек, подсказок, листов: на время ухода элемент не принимает нажатия.
 */
export function leave(el: Element | null | undefined, done: () => void, ms = OUT_MS): void {
  if (!el || motionOff()) return done();
  el.classList.add('leaving');
  setTimeout(done, ms);
}

/**
 * Держит последнее значение на экране ещё `ms` после того, как оно стало null, чтобы окно
 * успело уехать. leaving — идёт уход (повесить класс .leaving).
 */
export function usePresence<T>(value: T | null, ms = OUT_MS): { item: T | null; leaving: boolean } {
  const [last, setLast] = useState<T | null>(value);
  useEffect(() => {
    if (value) return setLast(value);
    if (!last) return;
    if (motionOff()) return setLast(null);
    const id = setTimeout(() => setLast(null), ms);
    return () => clearTimeout(id);
  }, [value]);
  return { item: value ?? last, leaving: !value && !!last };
}

/** Поведение программной прокрутки: плавно, если анимации включены */
export const scrollBehavior = (): ScrollBehavior => (motionOff() ? 'instant' : 'smooth');

/**
 * Короткое затухание блока при обновлении содержимого (поиск, фильтры) — только opacity, без
 * пересчёта высоты. Web Animations API; без анимаций — ничего.
 */
export function blink(el: Element | null | undefined): void {
  if (!el || motionOff() || typeof (el as HTMLElement).animate !== 'function') return;
  (el as HTMLElement).animate([{ opacity: 0.35 }, { opacity: 1 }], {
    duration: 180,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  });
}

/** Смена темы: короткое перекрёстное затухание (View Transitions API), иначе — сразу */
export function crossfade(apply: () => void): void {
  const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (motionOff() || typeof d.startViewTransition !== 'function') return apply();
  try {
    d.startViewTransition(apply);
  } catch {
    apply();
  }
}

/**
 * Длинный список рисуется порциями: сначала `first` пунктов (то, что видно на экране), затем по
 * `step` за кадр. Ни одна порция не занимает главный поток надолго — нажатия на вкладки и кнопки
 * обрабатываются сразу, даже пока дорисовываются сотни карточек со схемами.
 * При «Назад» (eager) — сразу всё: восстановление прокрутки ищет карточку-якорь по индексу.
 */
export function useProgressive(total: number, eager = false, first = 24, step = 32): number {
  const [n, setN] = useState(() => (eager ? Infinity : first));
  useEffect(() => {
    if (n >= total) return;
    let t = 0;
    // кадр на отрисовку, затем порция в отдельной задаче (между ними браузер обрабатывает касания)
    const raf = requestAnimationFrame(() => {
      t = window.setTimeout(() => setN((v) => (v + step >= total ? Infinity : v + step)), 0);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [n, total]);
  return n;
}
