import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { PROGRAM, dayIndex } from '../../data/program';

interface Props {
  value: string;
  onChange: (id: string) => void;
  /** Отметка «следующая по циклу» */
  suggested?: string | undefined;
  disabled?: boolean;
  label?: string;
}

/** Сегментированный контрол «День 1…4» */
export function DaySwitcher({ value, onChange, suggested, disabled, label = 'Выбор тренировки' }: Props) {
  return (
    <div class="seg" role="tablist" aria-label={label}>
      {PROGRAM.map((d, i) => {
        const on = d.id === value;
        return (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={disabled && !on}
            class={'seg-btn' + (on ? ' on' : '')}
            style={{ '--dc': `var(--${d.color})`, '--dcf': `var(--${d.color}-fill)` }}
            onClick={() => onChange(d.id)}
          >
            <span class="seg-num">День {i + 1}</span>
            {suggested === d.id && <span class="seg-dot" aria-label="следующая по циклу" />}
          </button>
        );
      })}
    </div>
  );
}

export const shiftDay = (id: string, dir: 1 | -1): string => {
  const n = PROGRAM.length;
  return PROGRAM[(dayIndex(id) + dir + n) % n]!.id;
};

/** Область, в которой горизонтальный свайп переключает день */
export function SwipeDays({
  value,
  onChange,
  enabled = true,
  children,
}: {
  value: string;
  onChange: (id: string) => void;
  enabled?: boolean;
  children: ComponentChildren;
}) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);

  const onStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!enabled || !t || e.touches.length > 1) return;
    // Не перехватываем свайпы по полям ввода и горизонтальным скроллам
    if ((e.target as HTMLElement).closest('input, textarea, .no-swipe')) return;
    start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onEnd = (e: TouchEvent) => {
    const s = start.current;
    start.current = null;
    const t = e.changedTouches[0];
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - s.t < 700) {
      onChange(shiftDay(value, dx < 0 ? 1 : -1));
    }
  };

  return (
    <div class="swipe" onTouchStart={onStart} onTouchEnd={onEnd}>
      {children}
    </div>
  );
}
