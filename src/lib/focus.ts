const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Ловушка фокуса для модальных окон: Tab и Shift+Tab переводим сами и по кругу.
 * Явный переход нужен, потому что WebKit/Safari по Tab по умолчанию пропускает кнопки
 * и фокус «убегает» из окна.
 */
export function trapTab(e: KeyboardEvent, root: HTMLElement): void {
  if (e.key !== 'Tab') return;
  const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (x) => !x.hasAttribute('disabled') && x.getClientRects().length > 0,
  );
  if (!items.length) return;
  e.preventDefault();
  const i = items.indexOf(document.activeElement as HTMLElement);
  const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i < 0 || i >= items.length - 1 ? 0 : i + 1;
  items[next]!.focus();
}

/**
 * Safari не переводит фокус на кнопку при нажатии — тогда «вернуть фокус открывшей кнопке» после
 * закрытия окна было бы некуда. Запоминаем последний нажатый интерактивный элемент.
 */
let lastPressed: HTMLElement | null = null;
const remember = (e: Event) => {
  const el = (e.target as Element | null)?.closest?.<HTMLElement>(FOCUSABLE);
  if (el && !el.closest('[role="dialog"], [role="alertdialog"]')) lastPressed = el;
};
if (typeof document !== 'undefined') {
  // click — на случай, когда pointer-событий нет (старые WebView); capture — раньше обработчика кнопки
  document.addEventListener('pointerdown', remember, true);
  document.addEventListener('click', remember, true);
}

/** Элемент, который открыл окно: в фокусе или последний нажатый (Safari) */
export function opener(): HTMLElement | null {
  // в фокусе может оказаться контейнер (main с tabindex=-1): WebKit фокусирует его при касании
  const a = document.activeElement as HTMLElement | null;
  if (a?.matches('button, input, select, textarea, a[href], summary, [role="radio"]')) return a;
  return lastPressed?.isConnected ? lastPressed : null;
}

/** Вернуть фокус открывшему окно элементу, если он ещё на странице (без прокрутки) */
export function restoreFocus(el: HTMLElement | null): void {
  if (el?.isConnected) el.focus({ preventScroll: true });
}
