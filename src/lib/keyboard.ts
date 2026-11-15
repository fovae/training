import { motionOff } from './motion';

/**
 * Экранная клавиатура (docs/ARCHITECTURE.md, «Клавиатура»). Один механизм на всё приложение:
 *  - высота клавиатуры → CSS-переменная --kb-h и html[data-kb] (пока открыта), видимая высота окна
 *    → --vvh. По ним листы и окна поднимаются над клавиатурой, а нижняя панель и таймер отдыха
 *    прячутся (стили — layout.css, раздел «Клавиатура»);
 *  - сфокусированное поле прокручивается в видимую часть вместе со своей плашкой (подпись, кнопка
 *    «Сохранить» или «Готово») — в ближайшем прокручиваемом контейнере или окне.
 * Различия платформ: iOS Safari и установленное приложение — клавиатура уменьшает visualViewport,
 * layout viewport (innerHeight) прежний: высота = innerHeight − (vv.height + vv.offsetTop).
 * Android Chrome — по умолчанию так же; если браузер уменьшает и само окно (resizes-content),
 * клавиатура «видна» как уменьшение innerHeight при поле в фокусе: --kb-h = 0 (окно уже над ней),
 * но data-kb ставится, чтобы спрятать нижнюю панель.
 */

/** Меньше этого — не клавиатура (адресная строка, панель подсказок) */
const MIN_KB = 120;
/** Запас между плашкой поля и клавиатурой / верхним краем, px */
const GAP = 12;

const isField = (el: Element | null): el is HTMLElement =>
  !!el &&
  (el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && !/^(checkbox|radio|button|submit|range|color|file)$/.test(el.type)) ||
    (el instanceof HTMLElement && el.isContentEditable));

/** Плашка поля: подпись, поле и кнопка подтверждения — то, что должно быть видно целиком */
export function fieldBlock(el: HTMLElement, maxH: number): HTMLElement {
  const sel = '[data-kb-block], .modal, .set, .field, .srow, .search, .note-in, .sheet-f';
  let best: HTMLElement = el;
  let cur = el.closest<HTMLElement>(sel);
  while (cur) {
    if (cur.getBoundingClientRect().height > maxH) break;
    best = cur;
    if (cur.matches('[data-kb-block], .modal')) break;
    cur = cur.parentElement?.closest<HTMLElement>(sel) ?? null;
  }
  return best;
}

function scroller(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/** Видимая область окна (с учётом клавиатуры), координаты как у getBoundingClientRect */
function visibleBox(): { top: number; bottom: number } {
  const vv = window.visualViewport;
  const top = vv ? vv.offsetTop : 0;
  const h = vv ? vv.height : window.innerHeight;
  return { top, bottom: top + h };
}

/** Прокрутить так, чтобы плашка поля была видна целиком над клавиатурой */
export function revealField(el: HTMLElement): void {
  const box = visibleBox();
  const block = fieldBlock(el, (box.bottom - box.top) * 0.7);
  const sc = scroller(block);
  const r = block.getBoundingClientRect();
  let top = box.top + GAP;
  let bottom = box.bottom - GAP;
  if (sc) {
    const s = sc.getBoundingClientRect();
    top = Math.max(top, s.top + GAP);
    bottom = Math.min(bottom, s.bottom - GAP);
  }
  let dy = 0;
  if (r.bottom > bottom) dy = r.bottom - bottom;
  if (r.top - dy < top) dy = r.top - top;
  if (Math.abs(dy) < 2) return;
  const behavior: ScrollBehavior = motionOff() ? 'instant' : 'smooth';
  if (sc) sc.scrollBy({ top: dy, behavior });
  else window.scrollBy({ top: dy, behavior });
}

let installed = false;

export function installKeyboard(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const root = document.documentElement;
  let baseH = window.innerHeight;
  let open = false;
  let revealT = 0;
  let recheckT = 0;

  const update = () => {
    const vv = window.visualViewport;
    const focused = isField(document.activeElement);
    // без поля в фокусе — клавиатуры нет; запоминаем полную высоту окна (поворот, панели браузера)
    if (!focused) baseH = window.innerHeight;
    const kb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    const shrunk = baseH - window.innerHeight;
    const now = focused && (kb >= MIN_KB || shrunk >= MIN_KB);
    root.style.setProperty('--kb-h', (now ? Math.round(kb) : 0) + 'px');
    root.style.setProperty('--vvh', Math.round(vv ? vv.height : window.innerHeight) + 'px');
    if (now !== open) {
      open = now;
      if (now) root.dataset.kb = '';
      else delete root.dataset.kb;
    }
  };

  const reveal = () => {
    const el = document.activeElement;
    if (isField(el)) revealField(el);
  };
  const later = (ms: number) => {
    clearTimeout(revealT);
    clearTimeout(recheckT);
    revealT = window.setTimeout(() => {
      update();
      reveal();
      // повторная проверка после плавной прокрутки: её могла прервать перерисовка или сама
      // клавиатура (iOS ещё двигает окно) — если поле уже видно, ничего не происходит
      recheckT = window.setTimeout(() => {
        update();
        reveal();
      }, 450);
    }, ms);
  };

  window.visualViewport?.addEventListener('resize', () => {
    update();
    // клавиатура доехала — поправить положение поля
    later(60);
  });
  window.visualViewport?.addEventListener('scroll', update);
  addEventListener('resize', update);
  addEventListener('orientationchange', () => {
    baseH = window.innerHeight;
    update();
  });
  document.addEventListener('focusin', (e) => {
    if (!isField(e.target as Element)) return;
    update();
    // клавиатура выезжает ~250–350 мс; если она уже открыта (переход между полями) — сразу
    later(open ? 0 : 320);
  });
  document.addEventListener('focusout', () => {
    // переход в соседнее поле — без «мигания» панели
    setTimeout(update, 50);
  });
  update();
}

/**
 * Enter в поле подхода: вес → повторы → вес следующего подхода; на последнем — закрыть клавиатуру.
 * fields — поля подходов по порядку (в карточке упражнения).
 */
export function nextField(fields: HTMLElement[], current: HTMLElement): HTMLElement | null {
  const i = fields.indexOf(current);
  return i >= 0 ? (fields[i + 1] ?? null) : null;
}
