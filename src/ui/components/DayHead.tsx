import type { ComponentChildren } from 'preact';
import { t } from '../../i18n';
import { dayColor } from '../../state/plan';
import type { Day } from '../../types';
import { fmtDuration } from '../../lib/format';
import { calibration, estimateForDay } from '../../state/estimate';
import { settings } from '../../state/settings';
import { dayEstimate, dayEyebrow, dayMeta, dayTitle } from '../labels';
import { HelpTip } from './HelpTip';

/** Расшифровка оценки времени: части в минутах, личная поправка и темп */
function EstimateParts({ day }: { day: Day }) {
  const e = estimateForDay(day);
  const rows = (['work', 'rest', 'setup', 'warmup', 'transitions'] as const).filter((k) => e.parts[k] >= 30);
  const c = calibration.value;
  const pace = settings.value.pace ?? 'normal';
  return (
    <span class="est-parts">
      <b>{t('estimate.title')}</b>
      {rows.map((k) => (
        <span key={k}>
          {t(`estimate.${k}`)} — {fmtDuration(e.parts[k] * 1000)}
        </span>
      ))}
      {e.maxMin > e.typicalMin && <span>{t('estimate.upTo', { to: e.maxMin })}</span>}
      {c.n > 0 && Math.abs(c.factor - 1) >= 0.03 && <small>{t('estimate.calibrated')}</small>}
      {pace !== 'normal' && (
        <small>
          {t('settings.pace')}: {t(`settings.paceOpt.${pace}`)}
        </small>
      )}
    </span>
  );
}

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
        {dayEstimate(day) && (
          <span class="dayhead-est">
            {' · '}
            <HelpTip
              topic={t('estimate.title')}
              label={dayEstimate(day)}
              text={<EstimateParts day={day} />}
            />
          </span>
        )}
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
