import type { ComponentChildren } from 'preact';
import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { openMenu, type MenuAction } from '../../state/ui';

/**
 * Карточка с действиями, как в iOS:
 *  - свайп влево — справа выезжают быстрые кнопки (например, «Удалить»); свайп вправо или тап — прячет;
 *  - долгое нажатие (и правый клик на ПК) — меню со всеми действиями снизу;
 *  - для клавиатуры и VoiceOver — кнопка «Действия», видимая при фокусе.
 * Свайп от левого края экрана не перехватываем: это системный жест «Назад».
 */

export interface RowAction extends MenuAction {
  /** Показать как быструю кнопку при свайпе (не больше двух) */
  quick?: boolean;
}

/** Открыта может быть только одна карточка */
const openId = signal<string | null>(null);
let seq = 0;

const EDGE = 24;
const BTN_W = 84;
const LONG_MS = 480;

export function SwipeRow({
  actions,
  title,
  children,
  class: cls,
}: {
  actions: RowAction[];
  /** Заголовок меню (название карточки) */
  title: string;
  children: ComponentChildren;
  class?: string;
}) {
  const [id] = useState(() => 'sr' + ++seq);
  const quick = actions.filter((a) => a.quick).slice(0, 2);
  const width = quick.length * BTN_W;
  const isOpen = openId.value === id;
  const [drag, setDrag] = useState<number | null>(null);
  const g = useRef<{ x: number; y: number; dir: 'h' | 'v' | null; timer: number; long: boolean } | null>(
    null,
  );
  /** Клик сразу после свайпа или долгого нажатия — не переход по ссылке. Флаг живёт недолго. */
  const swallowClick = useRef(false);
  const swallow = () => {
    swallowClick.current = true;
    window.setTimeout(() => (swallowClick.current = false), 400);
  };

  const menu = () => openMenu({ title, actions });

  useEffect(() => () => void (g.current && clearTimeout(g.current.timer)), []);

  const onStart = (e: TouchEvent) => {
    const p = e.touches[0];
    if (!p || e.touches.length > 1) return;
    if ((e.target as HTMLElement).closest('input, textarea, select, .no-swipe')) return;
    if (p.clientX < EDGE) return; // системный «Назад»
    if (openId.value && openId.value !== id) openId.value = null;
    const timer = window.setTimeout(() => {
      if (!g.current || g.current.dir) return;
      g.current.long = true;
      swallow();
      setDrag(null);
      menu();
    }, LONG_MS);
    g.current = { x: p.clientX, y: p.clientY, dir: null, timer, long: false };
  };

  const onMove = (e: TouchEvent) => {
    const s = g.current;
    const p = e.touches[0];
    if (!s || !p || s.long) return;
    const dx = p.clientX - s.x;
    const dy = p.clientY - s.y;
    if (!s.dir && Math.hypot(dx, dy) > 8) {
      clearTimeout(s.timer);
      s.dir = Math.abs(dx) > Math.abs(dy) * 1.2 && width > 0 ? 'h' : 'v';
    }
    if (s.dir === 'h') {
      if (e.cancelable) e.preventDefault();
      const base = isOpen ? -width : 0;
      setDrag(Math.max(-width - 24, Math.min(0, base + dx)));
    }
  };

  const onEnd = () => {
    const s = g.current;
    g.current = null;
    if (!s) return;
    clearTimeout(s.timer);
    if (s.dir === 'h' && drag != null) {
      swallow();
      openId.value = drag < -width / 2 ? id : null;
    }
    setDrag(null);
  };

  // Тап по открытой карточке — закрыть, не переходя по ссылке
  const onClickCapture = (e: MouseEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest('.sr-actions, .sr-menu-btn')) return;
    if (swallowClick.current || isOpen) {
      swallowClick.current = false;
      if (isOpen) openId.value = null;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const x = drag ?? (isOpen ? -width : 0);
  return (
    <div
      class={'swipe-row' + (cls ? ' ' + cls : '') + (isOpen ? ' open' : '') + (drag != null ? ' moving' : '')}
      onTouchStart={onStart}
      onTouchMove={onMove}
      onTouchEnd={onEnd}
      onTouchCancel={onEnd}
      onClickCapture={onClickCapture}
      onContextMenu={(e) => {
        e.preventDefault();
        menu();
      }}
    >
      {quick.length > 0 && (
        <div class="sr-actions" aria-hidden={!isOpen} style={{ width: width + 'px' }}>
          {quick.map((a) => (
            <button
              key={a.label}
              type="button"
              class={'sr-btn' + (a.danger ? ' danger' : '')}
              tabIndex={isOpen ? 0 : -1}
              disabled={a.disabled}
              onClick={() => {
                openId.value = null;
                void a.run();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      <div
        class={'sr-front' + (drag != null ? ' dragging' : '')}
        style={x ? { transform: `translateX(${x}px)` } : undefined}
      >
        {children}
      </div>
      <button type="button" class="sr-menu-btn" onClick={menu}>
        {t('menu.actionsFor', { name: title })}
      </button>
    </div>
  );
}
