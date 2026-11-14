import { signal } from '@preact/signals';
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';

/**
 * Кнопка «?» с короткой подсказкой (toggletip). Открывается и закрывается нажатием на «?»;
 * закрывается по Escape (фокус остаётся на кнопке), нажатию вне подсказки, прокрутке и повороту экрана.
 * Подсказка — поверх содержимого (position: fixed), в пределах экрана, и не перехватывает нажатия
 * вокруг: регуляторы рядом работают как обычно, нажатие на них просто закрывает подсказку.
 * Одновременно открыта одна подсказка. Цвета — токены активной темы (features.css, .help-*).
 */

const openTip = signal<string | null>(null);

const EDGE = 12;
const GAP = 8;
const MAX_W = 320;

export function HelpTip({ topic, text }: { topic: string; text: string }) {
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const open = openTip.value === id;
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    width: number;
    arrow: number;
    up: boolean;
  } | null>(null);

  // Положение: под кнопкой, а если внизу мало места — над ней; ширина — по экрану телефона
  useLayoutEffect(() => {
    if (!open || !btn.current) return setPos(null);
    const r = btn.current.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const width = Math.min(MAX_W, vw - 2 * EDGE);
    const left = Math.min(Math.max(EDGE, r.left + r.width / 2 - width / 2), vw - EDGE - width);
    const h = box.current?.offsetHeight ?? 120;
    const up = r.bottom + GAP + h > window.innerHeight - EDGE && r.top - GAP - h > EDGE;
    setPos({
      left,
      top: up ? r.top - GAP - h : r.bottom + GAP,
      width,
      arrow: r.left + r.width / 2 - left,
      up,
    });
  }, [open]);

  // Закрытие: Escape, нажатие вне подсказки и кнопки, прокрутка, смена размеров окна
  useLayoutEffect(() => {
    if (!open) return;
    const close = () => {
      if (openTip.value === id) openTip.value = null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      close();
      btn.current?.focus({ preventScroll: true });
    };
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node;
      if (btn.current?.contains(n) || box.current?.contains(n)) return;
      close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, true);
    addEventListener('scroll', close, { passive: true });
    addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown, true);
      removeEventListener('scroll', close);
      removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        class={'help-btn' + (open ? ' on' : '')}
        aria-label={t('common.helpAbout', { what: topic })}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (openTip.value = open ? null : id)}
      >
        <span aria-hidden="true">?</span>
      </button>
      {open && (
        <div
          ref={box}
          id={id}
          role="status"
          class={'help-tip' + (pos?.up ? ' up' : '')}
          style={
            pos
              ? {
                  left: pos.left + 'px',
                  top: pos.top + 'px',
                  width: pos.width + 'px',
                  '--ax': pos.arrow + 'px',
                }
              : {
                  visibility: 'hidden',
                  left: '0px',
                  top: '0px',
                  width: Math.min(MAX_W, innerWidth - 2 * EDGE) + 'px',
                }
          }
        >
          {text}
        </div>
      )}
    </>
  );
}
