import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { usePresence } from '../../lib/motion';
import { Icon } from './Icon';

/**
 * Свой выпадающий список вместо системного <select>: оформление из токенов активной темы (как
 * выделение текста — base.css), одинаковое на iPhone, Android и ПК. Кнопка показывает выбранное,
 * список открывается под ней (или над ней, если внизу мало места) в общем слое SelectHost —
 * поверх листов и карточек со свайпом, которые обрезали бы его.
 * Доступность: кнопка aria-haspopup="listbox", список role="listbox" с role="option";
 * ↑ ↓ Home End — по пунктам, Enter / пробел — выбрать, Escape — закрыть, фокус возвращается на кнопку.
 */

export interface SelectOption {
  value: string;
  label: string;
  /** язык подписи (список языков — каждое название на своём языке) */
  lang?: string;
}

interface OpenList {
  anchor: HTMLElement;
  label: string;
  options: SelectOption[];
  value: string;
  pick: (v: string) => void;
}

const openList = signal<OpenList | null>(null);

function close(focusBack = true): void {
  const cur = openList.value;
  openList.value = null;
  if (focusBack) cur?.anchor.focus({ preventScroll: true });
}

interface Props {
  /** Доступное имя кнопки; видимая подпись — `caption` */
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  /** видимая подпись над полем (иначе только для экранного диктора) */
  caption?: ComponentChildren;
  describedBy?: string;
  class?: string;
}

export function Select({ label, value, options, onChange, caption, describedBy, class: cls }: Props) {
  const btn = useRef<HTMLButtonElement>(null);
  const cur = options.find((o) => o.value === value) ?? options[0];
  const isOpen = openList.value?.anchor === btn.current && !!btn.current;
  const open = () => {
    if (!btn.current) return;
    if (isOpen) return close();
    openList.value = { anchor: btn.current, label, options, value, pick: onChange };
  };
  return (
    <div class={'select' + (cls ? ' ' + cls : '')}>
      {caption && (
        <span class="select-cap" aria-hidden="true">
          {caption}
        </span>
      )}
      <button
        ref={btn}
        type="button"
        class={'select-btn' + (isOpen ? ' open' : '')}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-describedby={describedBy}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isOpen) open();
          }
        }}
      >
        <span class="select-val" lang={cur?.lang}>
          {cur?.label}
        </span>
        <span class="select-chev" aria-hidden="true">
          <Icon name="chevron" size={18} />
        </span>
      </button>
    </div>
  );
}

const GAP = 6;
const EDGE = 12;
const MAX_H = 360;

/** Слой открытого списка (один на приложение, App.tsx) */
export function SelectHost() {
  const { item: cur, leaving } = usePresence(openList.value);
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxH: number; up: boolean } | null>(null);
  const [act, setAct] = useState(0);

  // Положение: под кнопкой или над ней, в пределах экрана; пункт выбранного — в центре видимого
  useLayoutEffect(() => {
    if (!cur || leaving) return;
    const r = cur.anchor.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = document.documentElement.clientWidth;
    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    const want = Math.min(MAX_H, cur.options.length * 46 + 12);
    const up = below < want && above > below;
    const width = Math.min(Math.max(r.width, 200), vw - 2 * EDGE);
    const left = Math.min(Math.max(EDGE, r.left), vw - EDGE - width);
    setPos(
      up
        ? { left, bottom: vh - r.top + GAP, width, maxH: Math.min(MAX_H, above), up }
        : { left, top: r.bottom + GAP, width, maxH: Math.min(MAX_H, below), up },
    );
    const i = Math.max(
      0,
      cur.options.findIndex((o) => o.value === cur.value),
    );
    setAct(i);
  }, [cur, leaving]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !cur || leaving || !pos) return;
    el.focus({ preventScroll: true });
    const sel = el.querySelector<HTMLElement>('[aria-selected="true"]');
    if (sel) el.scrollTop = sel.offsetTop - (el.clientHeight - sel.offsetHeight) / 2;
  }, [pos]);

  // Прокрутка страницы, поворот экрана — список закрывается (иначе «отрывается» от кнопки)
  useLayoutEffect(() => {
    if (!cur || leaving) return;
    const onScroll = (e: Event) => {
      if (box.current && e.target instanceof Node && box.current.contains(e.target)) return;
      close(false);
    };
    const onResize = () => close(false);
    addEventListener('scroll', onScroll, { capture: true, passive: true });
    addEventListener('resize', onResize);
    return () => {
      removeEventListener('scroll', onScroll, { capture: true });
      removeEventListener('resize', onResize);
    };
  }, [cur, leaving]);

  if (!cur || !pos) return null;
  const choose = (v: string) => {
    if (leaving) return;
    close();
    if (v !== cur.value) cur.pick(v);
  };
  const id = 'sel-opt-';
  return (
    <div class={'select-layer' + (leaving ? ' leaving' : '')} onPointerDown={(e) => e.target === e.currentTarget && close(false)}>
      <div
        ref={box}
        class={'select-list' + (pos.up ? ' up' : '')}
        role="listbox"
        tabIndex={-1}
        aria-label={cur.label}
        aria-activedescendant={id + act}
        style={{
          left: pos.left + 'px',
          width: pos.width + 'px',
          maxHeight: pos.maxH + 'px',
          top: pos.top != null ? pos.top + 'px' : undefined,
          bottom: pos.bottom != null ? pos.bottom + 'px' : undefined,
        }}
        onKeyDown={(e) => {
          const n = cur.options.length;
          let i: number;
          if (e.key === 'ArrowDown') i = Math.min(n - 1, act + 1);
          else if (e.key === 'ArrowUp') i = Math.max(0, act - 1);
          else if (e.key === 'Home') i = 0;
          else if (e.key === 'End') i = n - 1;
          else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            return choose(cur.options[act]!.value);
          } else if (e.key === 'Escape' || e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            return close();
          } else return;
          e.preventDefault();
          setAct(i);
          box.current?.querySelector<HTMLElement>('#' + id + i)?.scrollIntoView({ block: 'nearest' });
        }}
      >
        {cur.options.map((o, i) => {
          const on = o.value === cur.value;
          return (
            <div
              key={o.value}
              id={id + i}
              role="option"
              aria-selected={on}
              data-value={o.value}
              lang={o.lang}
              class={'select-opt' + (on ? ' on' : '') + (i === act ? ' act' : '')}
              onClick={() => choose(o.value)}
            >
              <span>{o.label}</span>
              {on && <Icon name="check" size={18} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
