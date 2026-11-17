import type { ComponentChildren, ComponentType } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import {
  autoplays,
  closeTour,
  isLast,
  nextSlide,
  pauseTour,
  prevSlide,
  resumeTour,
  startTour,
  type TourState,
} from '../../lib/tour';
import { motionOff } from '../../lib/motion';
import { trapTab } from '../../lib/focus';
import { dayColor, plan } from '../../state/plan';
import { finishTour } from '../../state/tour';
import type { Day } from '../../types';
import { Icon } from '../components/Icon';
import { Pic } from '../components/Pic';
import { findExercise } from '../../data/exercises';
import { dayTitle, exName } from '../labels';
import '../../styles/tour.css';

/**
 * Тур после онбординга (3.24): 5 «историй» — что где лежит и как записать подход. Логика листания —
 * lib/tour.ts; здесь — макеты (упрощённые экраны приложения из токенов темы), жесты и кнопки.
 * Названия вкладок и разделов — из тех же ключей, что и в приложении (nav.*, settings.data).
 */

/** Вкладки мини-панели — как в Nav.tsx */
const TABS = ['today', 'plan', 'library', 'history', 'settings'] as const;
type TabId = (typeof TABS)[number];

interface Slide {
  id: string;
  /** Подсвеченные вкладки мини-панели */
  tabs: TabId[];
  Mock: ComponentType;
  /** Показывать ли слайд (на будущее: слайды по условию) */
  when?: () => boolean;
}

/** Мини-панель вкладок внизу макета: подсвеченные — с пульсирующим кольцом */
function MiniNav({ on }: { on: TabId[] }) {
  return (
    <div class="tm-nav" aria-hidden="true">
      {TABS.map((id) => (
        <span key={id} class={'tm-tab' + (on.includes(id) ? ' hl' : '')}>
          <Icon name={id} size={18} />
        </span>
      ))}
    </div>
  );
}

function Phone({ children, tabs }: { children: ComponentChildren; tabs: TabId[] }) {
  return (
    <div class="tm-phone" aria-hidden="true">
      <div class="tm-screen">{children}</div>
      <MiniNav on={tabs} />
    </div>
  );
}

/** Дни из плана человека (цвет и название), пустой план — нейтральные «День 1…3» */
function weekDays(): { title: string; color: string }[] {
  const days: Day[] = plan.value?.days ?? [];
  if (!days.length) return [1, 2, 3].map((n) => ({ title: t('day.n', { n }), color: 'var(--line)' }));
  return days.slice(0, 5).map((d) => ({ title: dayTitle(d), color: `var(--${dayColor(d.id)})` }));
}

function PlanMock() {
  return (
    <Phone tabs={['plan']}>
      <span class="tm-h">{t('nav.plan')}</span>
      <div class="tm-days">
        {weekDays().map((d, i) => (
          <span key={i} class="tm-day" style={{ '--d': d.color, '--i': i }}>
            <i />
            <b>{d.title}</b>
          </span>
        ))}
      </div>
      <span class="tm-assist">
        <Icon name="spark" size={14} />
        {t('planner.assistant')}
      </span>
    </Phone>
  );
}

/** Первое упражнение плана — для подписи карточки в макете «Сегодня» */
function firstExercise(): string | null {
  const id = plan.value?.days.find((d) => d.items.length)?.items[0]?.exerciseId;
  return id ? exName(id) : null;
}

/** Схема первого упражнения плана (или жима гантелей) — для карточки «Упражнения» */
function firstPic(): string | undefined {
  const id = plan.value?.days.find((d) => d.items.length)?.items[0]?.exerciseId ?? 'incline-db-press';
  return findExercise(id)?.pictogram;
}

function TodayMock() {
  const name = firstExercise();
  return (
    <Phone tabs={['today']}>
      <span class="tm-head">
        <b>{t('nav.today')}</b>
      </span>
      <div class="tm-ex">
        <span class="tm-line w70">{name ?? ''}</span>
        <div class="tm-set">
          <span class="tm-n">1</span>
          <span class="tm-field">
            <i class="tm-type">20</i>
          </span>
          <span class="tm-field">
            <i class="tm-type d2">10</i>
          </span>
          <span class="tm-done hl">
            <Icon name="check" size={16} />
          </span>
        </div>
        <div class="tm-set dim">
          <span class="tm-n">2</span>
          <span class="tm-field" />
          <span class="tm-field" />
          <span class="tm-done" />
        </div>
      </div>
      <span class="tm-rest">
        <svg viewBox="0 0 36 36" class="tm-ring">
          <circle cx="18" cy="18" r="15" />
          <circle cx="18" cy="18" r="15" class="tm-ring-v" />
        </svg>
        <b>1:30</b>
      </span>
    </Phone>
  );
}

function TimerMock() {
  return (
    <Phone tabs={[]}>
      <div class="tm-tip">
        <span class="tm-tip-ic">
          <Icon name="bulb" size={16} />
        </span>
        <span class="tm-lines">
          <span class="tm-line w80" />
          <span class="tm-line w55" />
        </span>
      </div>
      <div class="tm-bar hl">
        <span class="tm-adj">−</span>
        <span class="tm-time">
          <svg viewBox="0 0 36 36" class="tm-ring big">
            <circle cx="18" cy="18" r="15" />
            <circle cx="18" cy="18" r="15" class="tm-ring-v slow" />
          </svg>
          <b>1:30</b>
        </span>
        <span class="tm-adj">+</span>
      </div>
    </Phone>
  );
}

function LibHistMock() {
  return (
    <Phone tabs={['library', 'history']}>
      <div class="tm-pair">
        <div class="tm-card">
          <span class="tm-search">
            <Icon name="library" size={14} />
          </span>
          <span class="tm-thumb">
            <Pic pic={firstPic()} />
          </span>
          <span class="tm-line w80" />
          <span class="tm-line w55" />
        </div>
        <div class="tm-card">
          <div class="tm-chart">
            {[0.45, 0.6, 0.52, 0.78, 0.9].map((h, i) => (
              <i key={i} style={{ '--h': h, '--i': i }} />
            ))}
          </div>
          <span class="tm-line w70" />
          <span class="tm-pr">
            <Icon name="trend" size={14} />
          </span>
        </div>
      </div>
    </Phone>
  );
}

function DataMock() {
  return (
    <Phone tabs={['settings']}>
      <div class="tm-safe">
        <span class="tm-lock">
          <Icon name="shield" size={40} />
        </span>
        <span class="tm-share hl">
          <Icon name="share" size={18} />
        </span>
      </div>
    </Phone>
  );
}

/** Слайды — данные: добавить или убрать слайд — одна строка здесь и тексты tour.<id>.* */
const SLIDES: Slide[] = [
  { id: 'plan', tabs: ['plan'], Mock: PlanMock },
  { id: 'log', tabs: ['today'], Mock: TodayMock },
  { id: 'timer', tabs: [], Mock: TimerMock },
  { id: 'more', tabs: ['library', 'history'], Mock: LibHistMock },
  { id: 'data', tabs: ['settings'], Mock: DataMock },
];

/** Подстановки в тексты: реальные названия разделов (меняются вместе с приложением) */
const names = () => ({
  plan: t('nav.plan'),
  today: t('nav.today'),
  library: t('nav.library'),
  history: t('nav.history'),
  settings: t('nav.settings'),
  data: t('settings.data'),
  assistant: t('planner.assistant'),
});

export function Tour() {
  const slides = SLIDES.filter((s) => !s.when || s.when());
  const [st, setSt] = useState<TourState>(() => startTour(slides.length, !motionOff()));
  const ref = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const press = useRef<{ x: number; y: number; t: number; held: boolean; timer: number } | null>(null);
  const stRef = useRef(st);
  stRef.current = st;
  const update = (fn: (s: TourState) => TourState) => setSt((s) => fn(s));
  const slide = slides[st.i]!;
  const last = isLast(st);
  const running = autoplays(st, motionOff());

  const close = () => {
    update(closeTour);
    finishTour();
  };

  // фокус на заголовке слайда — экранные дикторы читают его при каждой смене
  useLayoutEffect(() => {
    head.current?.focus({ preventScroll: true });
  }, [st.i]);

  // свернули приложение — пауза; вернулись — продолжаем с того же места. layout-эффект: клавиши
  // работают с первого кадра тура (иначе стрелка, нажатая сразу после открытия, терялась)
  useLayoutEffect(() => {
    const onVis = () => update(document.hidden ? pauseTour : resumeTour);
    document.addEventListener('visibilitychange', onVis);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') update(nextSlide);
      else if (e.key === 'ArrowLeft') update(prevSlide);
      else if (e.key === 'Escape') close();
      else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        update((s) => (s.paused ? resumeTour(s) : pauseTour(s)));
      } else if (ref.current) trapTab(e, ref.current);
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
      if (press.current) clearTimeout(press.current.timer);
    };
  }, []);

  // жесты: касание справа / слева, удержание — пауза, свайп вниз — закрыть
  const onDown = (e: PointerEvent) => {
    if ((e.target as Element).closest('button')) return;
    const timer = window.setTimeout(() => {
      if (press.current) press.current.held = true;
      update(pauseTour);
    }, 220);
    press.current = { x: e.clientX, y: e.clientY, t: Date.now(), held: false, timer };
  };
  const onUp = (e: PointerEvent) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    clearTimeout(p.timer);
    const dy = e.clientY - p.y;
    const dx = e.clientX - p.x;
    if (p.held) {
      update(resumeTour);
      return;
    }
    if (dy > 70 && Math.abs(dy) > Math.abs(dx)) return close();
    if (Math.abs(dx) > 12 || Math.abs(dy) > 12) return;
    const r = ref.current!.getBoundingClientRect();
    update(e.clientX - r.left < r.width * 0.3 ? prevSlide : nextSlide);
  };
  const onCancel = () => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    clearTimeout(p.timer);
    if (p.held) update(resumeTour);
  };

  const n = names();
  return (
    <div class="tour-scrim">
      <div
        ref={ref}
        class={'tour' + (st.paused ? ' paused' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-h"
        aria-describedby="tour-b"
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
      >
        <div class="tour-bars" aria-hidden="true">
          {slides.map((s, i) => (
            <span key={s.id} class="tour-bar">
              <i
                key={i === st.i ? `run-${st.i}` : 'idle'}
                class={i < st.i ? 'full' : i === st.i ? (running || st.paused ? 'run' : 'full') : ''}
                onAnimationEnd={i === st.i ? () => update(nextSlide) : undefined}
              />
            </span>
          ))}
        </div>
        <div class="tour-top">
          <span class="sr-only" aria-live="polite">
            {t('tour.progress', { n: st.i + 1, total: slides.length })}
          </span>
          <button type="button" class="tour-skip" onClick={close}>
            {t('tour.skip')}
          </button>
          <button type="button" class="icon-btn tour-x" aria-label={t('tour.close')} onClick={close}>
            <Icon name="close" size={22} />
          </button>
        </div>

        <div class="tour-slide" key={slide.id}>
          <div class="tour-art">
            <slide.Mock />
          </div>
          <div class="tour-txt">
            <h2 id="tour-h" class="tour-h" tabIndex={-1} ref={head}>
              {t(`tour.${slide.id}.title`, n)}
            </h2>
            <p id="tour-b" class="tour-b">
              {t(`tour.${slide.id}.body`, n)}
            </p>
          </div>
        </div>

        <div class="tour-f">
          <button type="button" class="btn secondary" disabled={st.i === 0} onClick={() => update(prevSlide)}>
            <Icon name="back" size={18} /> {t('common.back')}
          </button>
          {last ? (
            <button type="button" class="btn primary" onClick={close}>
              {t('tour.finish')}
            </button>
          ) : (
            <button type="button" class="btn primary" onClick={() => update(nextSlide)}>
              {t('common.next')} <Icon name="chevron" size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
