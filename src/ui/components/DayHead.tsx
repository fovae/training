import type { ComponentChildren } from 'preact';
import { t } from '../../i18n';
import { dayColor } from '../../state/plan';
import type { Day } from '../../types';
import { dayEstimate, dayEyebrow, dayMeta, dayTitle } from '../labels';

interface Props {
  day: Day;
  progress?: { done: number; total: number } | undefined;
  children?: ComponentChildren;
  /** Кнопка в правом верхнем углу карточки (меню дня на экране «План») */
  action?: ComponentChildren;
}

/** Цветная шапка дня */
export function DayHead({ day, progress, children, action }: Props) {
  const pct = progress && progress.total ? (progress.done / progress.total) * 100 : 0;
  return (
    <div
      class={'dayhead' + (action ? ' has-act' : '')}
      style={{ background: `var(--${dayColor(day.id)}-bg)`, '--dh-fill': `var(--${dayColor(day.id)}-fill)` }}
    >
      {action && <div class="dayhead-act">{action}</div>}
      <div class="eyebrow">{dayEyebrow(day)}</div>
      <h2 class="dayhead-title">{dayTitle(day)}</h2>
      <p>
        {dayMeta(day)}
        {dayEstimate(day) && <span class="dayhead-est"> · {dayEstimate(day)}</span>}
      </p>
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
            <i style={{ transform: `scaleX(${pct / 100})` }} />
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
