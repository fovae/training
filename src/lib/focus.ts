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
