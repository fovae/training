import { opener, restoreFocus, trapTab } from '../../lib/focus';
import { t } from '../../i18n';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { actionMenu, closeMenu, dialog, dismissToast, toasts } from '../../state/ui';
import { applyUpdate, needRefresh } from '../../features/update';
import { active } from '../../state/session';
import { Icon } from './Icon';
import { usePresence } from '../../lib/motion';

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
  const cur = dialog.value;
  // После закрытия окно ещё ~200 мс уезжает вниз (обратная анимация)
  const { item: d, leaving } = usePresence(cur);
  const ref = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  // layout-эффект: Escape и ловушка фокуса работают с первого же кадра окна
  useLayoutEffect(() => {
    const d = cur;
    if (!d) return;
    prevFocus.current = opener();
    const el = ref.current;
    el?.querySelector<HTMLButtonElement>('[data-autofocus]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        d.resolve('cancel');
      }
      if (el) trapTab(e, el);
    };
    document.addEventListener('keydown', onKey, true);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.classList.remove('modal-open');
      restoreFocus(prevFocus.current);
    };
  }, [cur]);

  if (!d) return null;
  return (
    <div
      class={'scrim' + (leaving ? ' leaving' : '')}
      onClick={(e) => e.target === e.currentTarget && d.resolve('cancel')}
    >
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

/** Меню действий снизу (как action sheet на iOS): долгое нажатие на карточку или кнопка «Действия» */
export function MenuHost() {
  const cur = actionMenu.value;
  const { item: m, leaving } = usePresence(cur);
  const ref = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  // layout-эффект: Escape и ловушка фокуса работают с первого же кадра окна
  useLayoutEffect(() => {
    if (!cur) return;
    prevFocus.current = opener();
    const el = ref.current;
    el?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
      }
      if (el) trapTab(e, el);
    };
    document.addEventListener('keydown', onKey, true);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.classList.remove('modal-open');
      restoreFocus(prevFocus.current);
    };
  }, [cur]);

  if (!m) return null;
  return (
    <div
      class={'scrim sheet-scrim' + (leaving ? ' leaving' : '')}
      onClick={(e) => e.target === e.currentTarget && closeMenu()}
    >
      <div
        class="action-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={m.title ?? t('menu.title')}
        ref={ref}
      >
        <div class="as-group">
          {m.title && <p class="as-title">{m.title}</p>}
          {m.actions.map((a) => (
            <button
              key={a.label}
              type="button"
              class={'as-btn' + (a.danger ? ' danger' : '')}
              disabled={a.disabled}
              onClick={() => {
                closeMenu();
                void a.run();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <button type="button" class="as-btn as-cancel" onClick={closeMenu}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
