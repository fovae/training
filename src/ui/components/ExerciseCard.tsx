import { useRef } from 'preact/hooks';
import type { Exercise } from '../../data/types';
import type { SetEntry, WorkoutExercise } from '../../db/types';
import { restLabel, schemeText } from '../../data/program';
import { fmtNum, fromUnit, parseDecimal, toUnit, unitLabel } from '../../lib/format';
import { settings } from '../../state/settings';
import {
  addSet,
  exerciseState,
  lastPerformance,
  progressionReady,
  removeSet,
  toggleSetDone,
  toggleSkip,
  updateSet,
} from '../../state/workout';
import { startRest } from '../../features/timer';
import { go, toast } from '../../state/ui';
import { Icon } from './Icon';
import { Pic } from './Pic';

interface Props {
  ex: Exercise;
  num: number;
  optional: boolean;
  /** Режим журнала во время тренировки */
  log?: { exIdx: number; entry: WorkoutExercise } | undefined;
  /** Показывать подсказку прогрессии */
  showHints?: boolean;
}

export function DemoLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      class="demo"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (!navigator.onLine) {
          e.preventDefault();
          toast('Нет интернета — демонстрация откроется, когда появится сеть.');
        }
      }}
    >
      ▶ {label}
    </a>
  );
}

export function ExerciseCard({ ex, num, optional, log, showHints }: Props) {
  const state = log ? exerciseState(log.entry) : 'todo';
  const hint = showHints && progressionReady(ex);
  const last = showHints && !log ? lastPerformance(ex.id) : null;

  return (
    <article
      class={'ex' + (state === 'done' ? ' done' : '') + (state === 'skipped' ? ' skipped' : '')}
      aria-label={ex.name}
    >
      <Pic pic={ex.pic} />
      <div class="ex-top">
        {log && (
          <span class={'chk' + (state === 'done' ? ' on' : '')} aria-hidden="true">
            <Icon name="check" size={14} />
          </span>
        )}
        <div class="ex-head">
          <h4 class="ex-name">
            {num}. {ex.name}
          </h4>
          <div class="ex-focus">{ex.focus}</div>
        </div>
      </div>
      <div class="pills">
        <span class="pill main">
          {schemeText(ex)}
          {ex.per ? ' ' + ex.per : ''}
        </span>
        <span class="pill">⏱ {restLabel(ex)}</span>
        {(ex.optional || (optional && log)) && <span class="pill opt">по желанию</span>}
        {state === 'skipped' && <span class="pill">пропущено</span>}
      </div>

      {hint && (
        <div class="hint-up" role="note">
          <span aria-hidden="true">📈</span> Пора добавить вес — в прошлый раз верх диапазона во всех
          подходах.
        </div>
      )}

      {last && <LastLine ex={ex} sets={last.sets} />}

      {log && state !== 'skipped' && <SetTable ex={ex} exIdx={log.exIdx} sets={log.entry.sets} />}

      {log && (
        <div class="ex-actions">
          {optional && (
            <button type="button" class="btn-ghost sm" onClick={() => toggleSkip(log.exIdx)}>
              <Icon name="skip" size={16} />
              {state === 'skipped' ? 'Вернуть' : 'Пропустить'}
            </button>
          )}
          <button
            type="button"
            class="btn-ghost sm"
            onClick={() => go('history/exercise/' + encodeURIComponent(ex.id))}
          >
            История
            <Icon name="chevron" size={16} />
          </button>
        </div>
      )}

      <details class="tech">
        <summary>
          <b>Техника</b>
          {ex.alt ? ' и замена' : ''}
        </summary>
        <p>
          {ex.tech}
          {ex.alt && (
            <>
              <br />
              <b>Замена.</b> {ex.alt}
            </>
          )}
        </p>
      </details>
      {(ex.link || ex.link2) && (
        <div class="demos">
          {ex.link && <DemoLink href={ex.link} label="Демонстрация техники" />}
          {ex.link2 && <DemoLink href={ex.link2.href} label={ex.link2.label} />}
        </div>
      )}
    </article>
  );
}

function LastLine({ ex, sets }: { ex: Exercise; sets: SetEntry[] }) {
  const done = sets.filter((s) => s.done);
  if (!done.length) return null;
  const u = ex.unit === 'sec' ? ' с' : '';
  return (
    <div class="last">
      В прошлый раз:{' '}
      {done
        .map((s) =>
          s.weight ? `${fmtNum(toUnit(s.weight) ?? 0)}×${s.reps ?? '—'}${u}` : `${s.reps ?? '—'}${u}`,
        )
        .join(' · ')}
    </div>
  );
}

function SetTable({ ex, exIdx, sets }: { ex: Exercise; exIdx: number; sets: SetEntry[] }) {
  const repsLabel = ex.unit === 'sec' ? 'сек' : 'повт.';
  return (
    <div class="sets no-swipe">
      <div class="sets-h" aria-hidden="true">
        <span>#</span>
        <span>{unitLabel()}</span>
        <span>{repsLabel}</span>
        <span />
      </div>
      {sets.map((s, i) => (
        <SetRow key={i} ex={ex} exIdx={exIdx} setIdx={i} set={s} />
      ))}
      <div class="sets-more">
        <button type="button" class="btn-ghost sm" onClick={() => addSet(exIdx)}>
          <Icon name="plus" size={16} /> Подход
        </button>
        {sets.length > 1 && !sets[sets.length - 1]!.done && (
          <button type="button" class="btn-ghost sm" onClick={() => removeSet(exIdx)}>
            <Icon name="minus" size={16} /> Убрать
          </button>
        )}
      </div>
    </div>
  );
}

function SetRow({ ex, exIdx, setIdx, set }: { ex: Exercise; exIdx: number; setIdx: number; set: SetEntry }) {
  const wRef = useRef<HTMLInputElement>(null);
  const rRef = useRef<HTMLInputElement>(null);
  const units = settings.value.units;
  const wVal = toUnit(set.weight);
  const name = `${ex.name}, подход ${setIdx + 1}`;

  const commit = () => {
    const w = fromUnit(parseDecimal(wRef.current?.value ?? ''));
    const r = parseDecimal(rRef.current?.value ?? '');
    const reps = r == null ? null : Math.round(r);
    if (w !== set.weight || reps !== set.reps) updateSet(exIdx, setIdx, { weight: w, reps });
  };

  const onDone = () => {
    commit();
    const nowDone = toggleSetDone(exIdx, setIdx);
    if (nowDone) {
      const s = settings.value;
      startRest(ex.base ? s.restBase : s.restIso, ex.name);
    }
  };

  return (
    <div class={'set' + (set.done ? ' done' : '')}>
      <span class="set-n">{setIdx + 1}</span>
      <input
        key={`w-${wVal}-${units}`}
        ref={wRef}
        class="num-in"
        type="text"
        inputMode="decimal"
        enterKeyHint="next"
        autoComplete="off"
        placeholder={unitLabel()}
        defaultValue={wVal == null ? '' : String(wVal).replace('.', ',')}
        aria-label={`${name}: вес, ${unitLabel()}`}
        onChange={commit}
      />
      <input
        key={`r-${set.reps}`}
        ref={rRef}
        class="num-in"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        autoComplete="off"
        placeholder={`${ex.reps[0]}–${ex.reps[1]}`}
        defaultValue={set.reps == null ? '' : String(set.reps)}
        aria-label={`${name}: ${ex.unit === 'sec' ? 'секунды' : 'повторы'}`}
        onChange={commit}
      />
      <button
        type="button"
        class={'set-done' + (set.done ? ' on' : '')}
        aria-pressed={set.done}
        aria-label={set.done ? `${name}: снять отметку` : `${name}: выполнен`}
        onClick={onDone}
      >
        <Icon name="check" size={20} />
      </button>
    </div>
  );
}
