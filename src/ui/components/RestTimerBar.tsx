import { t } from '../../i18n';
import { useEffect, useState } from 'preact/hooks';
import { adjustRest, flash, remainingMs, stopRest, timer, togglePause } from '../../features/timer';
import { fmtClock } from '../../lib/format';
import { Icon } from './Icon';

/** Нижняя плашка таймера отдыха поверх контента */
export function RestTimerBar() {
  const rt = timer.value;
  if (!rt) return null;
  const left = remainingMs.value;
  const pct = rt.total ? Math.min(100, (1 - left / rt.total) * 100) : 100;
  const paused = rt.pausedLeft != null;
  const finished = rt.fired || left <= 0;

  return (
    <section
      class={'rest' + (finished ? ' finished' : '') + (paused ? ' paused' : '')}
      aria-label={t('timer.region')}
    >
      <div class="rest-bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div class="rest-row">
        <button
          type="button"
          class="rest-adj"
          onClick={() => adjustRest(-15)}
          disabled={finished}
          aria-label={t('timer.minus15')}
        >
          −15
        </button>
        <button
          type="button"
          class="rest-main"
          onClick={togglePause}
          disabled={finished}
          aria-label={paused ? t('timer.resume') : t('timer.pause')}
        >
          <span class="rest-label">
            {finished ? t('timer.over') : paused ? t('timer.paused') : rt.label || t('timer.rest')}
          </span>
          <span class="rest-time" role="timer" aria-live="off">
            {finished ? t('timer.go') : fmtClock(left / 1000)}
          </span>
        </button>
        <button
          type="button"
          class="rest-adj"
          onClick={() => adjustRest(15)}
          disabled={finished}
          aria-label={t('timer.plus15')}
        >
          +15
        </button>
        <button
          type="button"
          class="rest-skip"
          onClick={stopRest}
          aria-label={finished ? t('common.close') : t('timer.skip')}
        >
          <Icon name={finished ? 'close' : 'skip'} size={20} />
        </button>
      </div>
      <span class="sr-only" aria-live="assertive">
        {finished ? t('timer.over') : ''}
      </span>
    </section>
  );
}

/** Визуальная вспышка по окончании отдыха */
export function Flash() {
  const n = flash.value;
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!n) return;
    setOn(true);
    const id = setTimeout(() => setOn(false), 900);
    return () => clearTimeout(id);
  }, [n]);
  return on ? <div class="flash" aria-hidden="true" /> : null;
}
