import type { ComponentChildren } from 'preact';
import type { Day } from '../../data/types';
import { dayIndex } from '../../data/program';

interface Props {
  day: Day;
  progress?: { done: number; total: number } | undefined;
  children?: ComponentChildren;
}

/** Цветная шапка дня — как в исходной программе */
export function DayHead({ day, progress, children }: Props) {
  const i = dayIndex(day.id);
  const pct = progress && progress.total ? (progress.done / progress.total) * 100 : 0;
  return (
    <div class="dayhead" style={{ background: `var(--${day.color}-fill)` }}>
      <div class="eyebrow">
        День {i + 1} · {day.status}
      </div>
      <h2 class="dayhead-title">{day.title}</h2>
      <p>{day.intro}</p>
      {progress && (
        <div class="prog">
          <div
            class="track"
            role="progressbar"
            aria-label="Выполнено упражнений"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
          >
            <i style={{ width: `${pct}%` }} />
          </div>
          <span>
            {progress.done} / {progress.total}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
