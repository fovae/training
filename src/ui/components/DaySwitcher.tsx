import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { t, weekdayShort } from '../../i18n';
import { dayColor, planDays } from '../../state/plan';

interface Props {
  value: string | null;
  onChange: (id: string) => void;
  /** Отметка «предложено на сегодня» */
  suggested?: string | null | undefined;
  disabled?: boolean;
  label?: string;
}

/** Сегментированный контрол «День 1…N» (до 7 дней) */
export function DaySwitcher({ value, onChange, suggested, disabled, label }: Props) {
  const days = planDays.value;
  return (
    <div
      class={'seg' + (days.length > 4 ? ' many' : '')}
      role="tablist"
      aria-label={label ?? t('today.pickDay')}
    >
      {days.map((d, i) => {
        const on = d.id === value;
        const c = dayColor(d.id);
        return (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={t('day.n', { n: i + 1 }) + (d.weekday != null ? `, ${weekdayShort(d.weekday)}` : '')}
            disabled={disabled && !on}
            class={'seg-btn' + (on ? ' on' : '')}
            style={{ '--dc': `var(--${c})`, '--dcf': `var(--${c}-fill)` }}
            onClick={() => onChange(d.id)}
          >
            <span class="seg-num" aria-hidden="true">
              {d.weekday != null
                ? weekdayShort(d.weekday)
                : days.length > 4
                  ? i + 1
                  : t('day.n', { n: i + 1 })}
            </span>
            {suggested === d.id && <span class="seg-dot" aria-label={t('today.suggestedMark')} />}
          </button>
        );
      })}
    </div>
  );
}

export const shiftDay = (id: string | null, dir: 1 | -1): string | null => {
  const days = planDays.value;
  if (!days.length) return null;
  const i = Math.max(
    0,
    days.findIndex((d) => d.id === id),
  );
  return days[(i + dir + days.length) % days.length]!.id;
};

/** Область, в которой горизонтальный свайп переключает день */
export function SwipeDays({
  value,
  onChange,
  enabled = true,
  children,
}: {
  value: string | null;
  onChange: (id: string) => void;
  enabled?: boolean;
  children: ComponentChildren;
}) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);

  const onStart = (e: TouchEvent) => {
    const p = e.touches[0];
    if (!enabled || !p || e.touches.length > 1) return;
    if ((e.target as HTMLElement).closest('input, textarea, select, .no-swipe')) return;
    start.current = { x: p.clientX, y: p.clientY, t: Date.now() };
  };
  const onEnd = (e: TouchEvent) => {
    const s = start.current;
    start.current = null;
    const p = e.changedTouches[0];
    if (!s || !p) return;
    const dx = p.clientX - s.x;
    const dy = p.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - s.t < 700) {
      const next = shiftDay(value, dx < 0 ? 1 : -1);
      if (next) onChange(next);
    }
  };

  return (
    <div class="swipe" onTouchStart={onStart} onTouchEnd={onEnd}>
      {children}
    </div>
  );
}
