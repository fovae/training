import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../../i18n';
import { Icon } from './Icon';

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
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    (el?.querySelector<HTMLElement>('[data-autofocus]') ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab' && el) {
        const f = [...el.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]')].filter(
          (x) => !x.hasAttribute('disabled'),
        );
        const first = f[0];
        const last = f[f.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.classList.remove('modal-open');
      prev?.focus?.();
    };
  }, []);

  return (
    <div class="scrim sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-t" ref={ref} tabIndex={-1}>
        <div class="sheet-h">
          <h2 id="sheet-t">{title}</h2>
          <button type="button" class="icon-btn" aria-label={t('common.close')} onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div class="sheet-body">{children}</div>
        {footer && <div class="sheet-f">{footer}</div>}
      </div>
    </div>
  );
}
