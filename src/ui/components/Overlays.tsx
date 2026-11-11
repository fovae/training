import { useEffect, useRef } from 'preact/hooks';
import { dialog, dismissToast, toasts } from '../../state/ui';
import { applyUpdate, needRefresh } from '../../features/update';
import { active } from '../../state/workout';
import { Icon } from './Icon';

export function Toasts() {
  const list = toasts.value;
  const showUpdate = needRefresh.value && !active.value;
  return (
    <div class="toasts" aria-live="polite">
      {showUpdate && (
        <div class="toast" role="status">
          <span>Доступно обновление</span>
          <button type="button" class="toast-act" onClick={() => void applyUpdate()}>
            Обновить
          </button>
          <button
            type="button"
            class="toast-x"
            aria-label="Позже"
            onClick={() => (needRefresh.value = false)}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      )}
      {list.map((t) => (
        <div class="toast" key={t.id} role="status">
          <span>{t.text}</span>
          {t.action && (
            <button
              type="button"
              class="toast-act"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
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
            {d.cancel ?? 'Отмена'}
          </button>
        </div>
      </div>
    </div>
  );
}
