import { opener, restoreFocus, trapTab } from '../../lib/focus';
import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { t } from '../../i18n';
import { Icon } from './Icon';
import { leave } from '../../lib/motion';

/** Нижний лист (на ПК — модальное окно) с фокусом внутри и закрытием по Escape */
export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  // Всегда свежий onClose: обработчик Escape вешается один раз, а onClose меняется с каждым кадром
  // (в выборе упражнения он знает, сколько добавлено)
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Закрытие самим листом (крестик, фон, Escape, свайп вниз) — с обратной анимацией
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    leave(scrim.current, () => onCloseRef.current());
  };
  const drag = useRef<{ y: number; t: number } | null>(null);

  // Свайп вниз закрывает лист: по шапке или по списку, когда он прокручен в самый верх
  const onTouchStart = (e: TouchEvent) => {
    const p = e.touches[0];
    const body = ref.current?.querySelector('.sheet-body');
    const onHeader = (e.target as HTMLElement).closest('.sheet-h');
    if (!p || (!onHeader && (body?.scrollTop ?? 0) > 0)) return;
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    drag.current = { y: p.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const s = drag.current;
    drag.current = null;
    const p = e.changedTouches[0];
    if (s && p && p.clientY - s.y > 70 && Date.now() - s.t < 800) close();
  };

  // layout-эффект: Escape и ловушка фокуса работают с первого же кадра листа
  useLayoutEffect(() => {
    const prev = opener();
    const el = ref.current;
    (el?.querySelector<HTMLElement>('[data-autofocus]') ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      // открытый выпадающий список (Select.tsx) сам обрабатывает клавиши
      if (e.target instanceof Element && e.target.closest('.select-list')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
      if (el) trapTab(e, el);
    };
    document.addEventListener('keydown', onKey, true);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.classList.remove('modal-open');
      restoreFocus(prev);
    };
  }, []);

  return (
    <div class="scrim sheet-scrim" ref={scrim} onClick={(e) => e.target === e.currentTarget && close()}>
      <div
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-t"
        ref={ref}
        tabIndex={-1}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div class="sheet-grip" aria-hidden="true" />
        <div class="sheet-h">
          <h2 id="sheet-t">{title}</h2>
          <button type="button" class="icon-btn" aria-label={t('common.close')} onClick={close}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div class="sheet-body">{children}</div>
        {footer && <div class="sheet-f">{footer}</div>}
      </div>
    </div>
  );
}
