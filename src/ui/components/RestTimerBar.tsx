import { useEffect, useState } from 'preact/hooks';
import { adjustRest, flash, remainingMs, stopRest, timer, togglePause } from '../../features/timer';
import { fmtClock } from '../../lib/format';
import { Icon } from './Icon';

/** Нижняя плашка таймера отдыха поверх контента */
export function RestTimerBar() {
  const t = timer.value;
  if (!t) return null;
  const left = remainingMs.value;
  const pct = t.total ? Math.min(100, (1 - left / t.total) * 100) : 100;
  const paused = t.pausedLeft != null;
  const finished = t.fired || left <= 0;

  return (
    <section
      class={'rest' + (finished ? ' finished' : '') + (paused ? ' paused' : '')}
      aria-label="Таймер отдыха"
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
          aria-label="Минус 15 секунд"
        >
          −15
        </button>
        <button
          type="button"
          class="rest-main"
          onClick={togglePause}
          disabled={finished}
          aria-label={paused ? 'Продолжить отдых' : 'Пауза'}
        >
          <span class="rest-label">{finished ? 'Отдых окончен' : paused ? 'Пауза' : t.label}</span>
          <span class="rest-time" role="timer" aria-live="off">
            {finished ? 'Пора!' : fmtClock(left / 1000)}
          </span>
        </button>
        <button
          type="button"
          class="rest-adj"
          onClick={() => adjustRest(15)}
          disabled={finished}
          aria-label="Плюс 15 секунд"
        >
          +15
        </button>
        <button
          type="button"
          class="rest-skip"
          onClick={stopRest}
          aria-label={finished ? 'Закрыть' : 'Пропустить отдых'}
        >
          <Icon name={finished ? 'close' : 'skip'} size={20} />
        </button>
      </div>
      <span class="sr-only" aria-live="assertive">
        {finished ? 'Отдых окончен' : ''}
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
