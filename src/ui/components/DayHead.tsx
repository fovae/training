import type { ComponentChildren } from 'preact';
import { t } from '../../i18n';
import { dayColor } from '../../state/plan';
import type { Day } from '../../types';
import { dayEyebrow, dayMeta, dayTitle } from '../labels';

interface Props {
  day: Day;
  progress?: { done: number; total: number } | undefined;
  children?: ComponentChildren;
}

/** Цветная шапка дня */
export function DayHead({ day, progress, children }: Props) {
  const pct = progress && progress.total ? (progress.done / progress.total) * 100 : 0;
  return (
    <div class="dayhead" style={{ background: `var(--${dayColor(day.id)}-bg)` }}>
      <div class="eyebrow">{dayEyebrow(day)}</div>
      <h2 class="dayhead-title">{dayTitle(day)}</h2>
      <p>{dayMeta(day)}</p>
      {progress && (
        <div class="prog">
          <div
            class="track"
            role="progressbar"
            aria-label={t('today.progress')}
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
