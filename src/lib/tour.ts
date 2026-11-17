/**
 * Тур после онбординга (3.24, «истории» как в Instagram): чистая логика без DOM — листание,
 * пауза, автопереход, условия показа (tests/e2e/tour.unit.spec.ts). Экран — ui/tour/Tour.tsx.
 *
 * Автопереход — как в историях: удержание пальца ставит паузу, «вперёд» его не выключает; выключает
 * только «назад» (человек хочет перечитать — не торопим). На последнем слайде автоперехода нет: он
 * ждёт «К тренировке». Без анимаций (motionOff) — только вручную.
 */

/** Версия тура: при расширении увеличить — тем, кто видел прежний, покажется заново (tourSeen) */
export const TOUR_VERSION = 1;
/** Сколько длится слайд при автопереходе, мс (полоска прогресса — та же длительность в tour.css) */
export const SLIDE_MS = 5500;

export interface TourState {
  /** Текущий слайд */
  i: number;
  /** Сколько слайдов */
  n: number;
  /** Автопереход включён (выключается навсегда кнопкой «назад») */
  auto: boolean;
  /** Пауза: удержание, свёрнутое приложение, пробел */
  paused: boolean;
  /** Тур закрыт («Пропустить», крестик, свайп вниз, «К тренировке») */
  done: boolean;
}

export const startTour = (n: number, auto = true): TourState => ({
  i: 0,
  n: Math.max(1, n),
  auto,
  paused: false,
  done: false,
});

export const isLast = (s: TourState): boolean => s.i >= s.n - 1;

/** Вперёд (кнопка, касание справа, автопереход). На последнем — ничего: там ждёт «К тренировке» */
export const nextSlide = (s: TourState): TourState => (s.done || isLast(s) ? s : { ...s, i: s.i + 1 });

/** Назад: автопереход выключается до конца тура */
export const prevSlide = (s: TourState): TourState =>
  s.done ? s : { ...s, i: Math.max(0, s.i - 1), auto: false };

export const pauseTour = (s: TourState): TourState => (s.done || s.paused ? s : { ...s, paused: true });
export const resumeTour = (s: TourState): TourState => (s.done || !s.paused ? s : { ...s, paused: false });

/** Закрыть — сколько угодно раз, результат один */
export const closeTour = (s: TourState): TourState => (s.done ? s : { ...s, done: true });

/** Идёт ли сейчас отсчёт до следующего слайда */
export const autoplays = (s: TourState, motionOff = false): boolean =>
  !motionOff && s.auto && !s.paused && !s.done && !isLast(s);

/**
 * Показать тур: онбординг пройден (есть профиль), документы приняты, экран установки закрыт, и эту
 * версию тура человек ещё не видел. Не путать с принятием документов и установкой — тур их не заменяет.
 */
export function shouldShowTour(o: {
  hasProfile: boolean;
  legalPending: boolean;
  gateVisible: boolean;
  seen: number | undefined;
}): boolean {
  return o.hasProfile && !o.legalPending && !o.gateVisible && (o.seen ?? 0) < TOUR_VERSION;
}
