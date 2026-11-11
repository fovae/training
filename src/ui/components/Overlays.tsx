import { t } from '../../i18n';
import { useEffect, useRef } from 'preact/hooks';
import { dialog, dismissToast, toasts } from '../../state/ui';
import { applyUpdate, needRefresh } from '../../features/update';
import { active } from '../../state/session';
import { Icon } from './Icon';

export function Toasts() {
  const list = toasts.value;
  const showUpdate = needRefresh.value && !active.value;
  return (
    <div class="toasts" aria-live="polite">
      {showUpdate && (
        <div class="toast" role="status">
          <span>{t('update.available')}</span>
          <button type="button" class="toast-act" onClick={() => void applyUpdate()}>
            {t('update.reload')}
          </button>
          <button
            type="button"
            class="toast-x"
            aria-label={t('update.later')}
            onClick={() => (needRefresh.value = false)}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      )}
      {list.map((x) => (
        <div class="toast" key={x.id} role="status">
          <span>{x.text}</span>
          {x.action && (
            <button
              type="button"
              class="toast-act"
              onClick={() => {
                x.action!.run();
                dismissToast(x.id);
              }}
            >
              {x.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Свой модальный диалог (вместо confirm()) с фокусом и Escape */
export function DialogHost() {
  const d = dialog.value;
  const ref = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!d) return;
    prevFocus.current = document.activeElement;
    const el = ref.current;
    el?.querySelector<HTMLButtonElement>('[data-autofocus]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        d.resolve('cancel');
      }
      if (e.key === 'Tab' && el) {
        const f = [...el.querySelectorAll<HTMLElement>('button')];
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
      (prevFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [d]);

  if (!d) return null;
  return (
    <div class="scrim" onClick={(e) => e.target === e.currentTarget && d.resolve('cancel')}>
      <div
        class="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dlg-t"
        aria-describedby="dlg-b"
        ref={ref}
      >
        <h2 id="dlg-t">{d.title}</h2>
        {d.body && (
          <div id="dlg-b" class="modal-body">
            {d.body}
          </div>
        )}
        <div class="modal-actions">
          <button
            type="button"
            class={'btn ' + (d.danger ? 'danger' : 'primary')}
            data-autofocus
            onClick={() => d.resolve('confirm')}
          >
            {d.confirm}
          </button>
          {d.extra && (
            <button
              type="button"
              class={'btn ' + (d.extra.danger ? 'danger-ghost' : 'secondary')}
              onClick={() => d.resolve('extra')}
            >
              {d.extra.label}
            </button>
          )}
          <button type="button" class="btn secondary" onClick={() => d.resolve('cancel')}>
            {d.cancel ?? t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
