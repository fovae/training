import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { findExercise } from '../../data/exercises';
import { dismissTip, type Advice } from '../../advice';
import { levelBehavior } from '../../advice/levels';
import { confirmWeight } from '../../features/weightCheck';
import { profile } from '../../state/settings';
import { fmtNum, t } from '../../i18n';
import { fromUnit, inputNum, parseDecimal, toUnit, unitLabel } from '../../lib/format';
import type { Exercise, PlanItem, SessionEntry, SessionSet } from '../../types';
import {
  addSet,
  entryState,
  lastPerformance,
  removeSet,
  restFor,
  setEntryNote,
  toggleSetDone,
  toggleSkip,
  updateSet,
} from '../../state/session';
import { startRest } from '../../features/timer';
import { go } from '../../state/ui';
import { exName, muscleName, restText, schemeText } from '../labels';
import { Icon } from './Icon';
import { Pic } from './Pic';

interface Props {
  item: PlanItem;
  num: number;
  /** Режим журнала во время тренировки */
  log?: { idx: number; entry: SessionEntry } | undefined;
  /** Советы по этому упражнению (уже отобранные: не больше двух на тренировку) */
  tips?: Advice[] | undefined;
}

export function ExerciseCard({ item, num, log, tips = [] }: Props) {
  const ex = findExercise(item.exerciseId);
  const name = exName(item.exerciseId);
  const state = log ? entryState(log.entry) : 'todo';
  const last = !log ? lastPerformance(item.exerciseId) : null;

  return (
    <article
      class={'ex' + (state === 'done' ? ' done' : '') + (state === 'skipped' ? ' skipped' : '')}
      aria-label={name}
    >
      <Pic pic={ex?.pictogram} />
      <div class="ex-top">
        {log && (
          <span class={'chk' + (state === 'done' ? ' on' : '')} aria-hidden="true">
            <Icon name="check" size={14} />
          </span>
        )}
        <div class="ex-head">
          <h4 class="ex-name">
            {num}. {name}
          </h4>
          {ex && <div class="ex-focus">{ex.primaryMuscles.map(muscleName).join(', ')}</div>}
        </div>
      </div>
      <div class="pills">
        <span class="pill main">{schemeText(item, ex)}</span>
        <span class="pill">⏱ {restText(item, ex)}</span>
        {item.targetWeightKg != null && (
          <span class="pill">
            {fmtNum(toUnit(item.targetWeightKg) ?? 0)} {unitLabel()}
          </span>
        )}
        {item.optional && <span class="pill opt">{t('ex.optional')}</span>}
        {state === 'skipped' && <span class="pill">{t('ex.skipped')}</span>}
      </div>

      {tips.map((a) => (
        <TipCard key={a.id} tip={a} />
      ))}

      {last && <LastLine ex={ex} sets={last.sets} />}

      {log && state !== 'skipped' && (
        <SetTable ex={ex} item={item} name={name} idx={log.idx} sets={log.entry.sets} />
      )}

      {log && <EntryNote idx={log.idx} note={log.entry.note} name={name} />}

      {log && (
        <div class="ex-actions">
          {item.optional && (
            <button type="button" class="btn-ghost sm" onClick={() => toggleSkip(log.idx)}>
              <Icon name="skip" size={16} />
              {state === 'skipped' ? t('ex.unskip') : t('ex.skip')}
            </button>
          )}
          <button
            type="button"
            class="btn-ghost sm"
            onClick={() => go('history/exercise/' + encodeURIComponent(item.exerciseId))}
          >
            {t('nav.history')}
            <Icon name="chevron" size={16} />
          </button>
        </div>
      )}

      {ex && (
        <details class="tech" open={levelBehavior(profile.value?.level).techniqueOpen}>
          <summary>
            <b>{t('ex.technique')}</b>
          </summary>
          <ul class="cues">
            {ex.cueKeys.map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ul>
          <a class="more" href={`#/library/${encodeURIComponent(ex.id)}`}>
            {t('ex.fullCard')}
            <Icon name="chevron" size={14} />
          </a>
        </details>
      )}
    </article>
  );
}

function fmtSet(s: SessionSet, ex: Exercise | undefined): string {
  if (ex?.metric === 'time') return `${s.seconds ?? '—'} ${t('unit.sec')}`;
  if (s.weightKg) return `${fmtNum(toUnit(s.weightKg) ?? 0)}×${s.reps ?? '—'}`;
  return `${s.reps ?? '—'}`;
}

export const fmtSets = (sets: SessionSet[], ex: Exercise | undefined): string =>
  sets
    .filter((s) => s.done)
    .map((s) => fmtSet(s, ex))
    .join(' · ');

function LastLine({ ex, sets }: { ex: Exercise | undefined; sets: SessionSet[] }) {
  const txt = fmtSets(sets, ex);
  if (!txt) return null;
  return (
    <div class="last">
      {t('ex.lastTime')} {txt}
    </div>
  );
}

function EntryNote({ idx, note, name }: { idx: number; note: string | undefined; name: string }) {
  const [open, setOpen] = useState(!!note);
  if (!open)
    return (
      <button type="button" class="btn-ghost sm note-btn" onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} /> {t('ex.addNote')}
      </button>
    );
  return (
    <textarea
      class="note-in"
      rows={2}
      maxLength={1000}
      placeholder={t('ex.notePlaceholder')}
      aria-label={t('ex.noteFor', { name })}
      defaultValue={note ?? ''}
      onChange={(e) => setEntryNote(idx, e.currentTarget.value)}
    />
  );
}

function SetTable({
  ex,
  item,
  name,
  idx,
  sets,
}: {
  ex: Exercise | undefined;
  item: PlanItem;
  name: string;
  idx: number;
  sets: SessionSet[];
}) {
  const metric = ex?.metric ?? 'weight_reps';
  return (
    <div class={'sets no-swipe' + (metric !== 'weight_reps' ? ' one' : '')}>
      <div class="sets-h" aria-hidden="true">
        <span>#</span>
        {metric === 'weight_reps' && <span>{unitLabel()}</span>}
        <span>{metric === 'time' ? t('unit.sec') : t('ex.repsShort')}</span>
        <span />
      </div>
      {sets.map((s, i) => (
        <SetRow key={i} ex={ex} item={item} name={name} idx={idx} setIdx={i} set={s} />
      ))}
      <div class="sets-more">
        <button type="button" class="btn-ghost sm" onClick={() => addSet(idx)}>
          <Icon name="plus" size={16} /> {t('ex.addSet')}
        </button>
        {sets.length > 1 && !sets[sets.length - 1]!.done && (
          <button type="button" class="btn-ghost sm" onClick={() => removeSet(idx)}>
            <Icon name="minus" size={16} /> {t('ex.removeSet')}
          </button>
        )}
      </div>
    </div>
  );
}

function SetRow({
  ex,
  item,
  name,
  idx,
  setIdx,
  set,
}: {
  ex: Exercise | undefined;
  item: PlanItem;
  name: string;
  idx: number;
  setIdx: number;
  set: SessionSet;
}) {
  const wRef = useRef<HTMLInputElement>(null);
  const rRef = useRef<HTMLInputElement>(null);
  const metric = ex?.metric ?? 'weight_reps';
  const isTime = metric === 'time';
  const wVal = toUnit(set.weightKg);
  const count = isTime ? set.seconds : set.reps;
  const label = t('ex.setLabel', { name, n: setIdx + 1 });

  // Уход из поля (onChange) и тап по галочке приходят почти одновременно — одна проверка на двоих
  const pending = useRef<Promise<boolean> | null>(null);
  const commit = (): Promise<boolean> => {
    pending.current ??= doCommit().finally(() => (pending.current = null));
    return pending.current;
  };

  /** false — человек выбрал «Исправить» в проверке веса */
  const doCommit = async (): Promise<boolean> => {
    const patch: Partial<SessionSet> = {};
    if (metric === 'weight_reps') {
      const w = fromUnit(parseDecimal(wRef.current?.value ?? ''));
      if (w != null && w !== set.weightKg && ex) {
        const ok = await confirmWeight(ex.id, w);
        if (ok == null) {
          // «Исправить»: вернуть прежнее значение и поставить курсор в поле
          if (wRef.current) {
            wRef.current.value = inputNum(wVal);
            wRef.current.focus();
          }
          return false;
        }
        patch.weightKg = ok;
        if (ok !== w && wRef.current) wRef.current.value = inputNum(toUnit(ok));
      } else patch.weightKg = w ?? undefined;
    }
    const r = parseDecimal(rRef.current?.value ?? '');
    const v = r == null ? undefined : Math.round(r);
    if (isTime) patch.seconds = v;
    else patch.reps = v;
    const changed = (Object.keys(patch) as (keyof SessionSet)[]).some((k) => patch[k] !== set[k]);
    if (changed) updateSet(idx, setIdx, patch);
    return true;
  };

  const onDone = async () => {
    if (!(await commit())) return;
    if (toggleSetDone(idx, setIdx)) startRest(restFor(ex, item), name);
  };

  return (
    <div class={'set' + (set.done ? ' done' : '')}>
      <span class="set-n">{setIdx + 1}</span>
      {metric === 'weight_reps' && (
        <input
          key={`w-${wVal}`}
          ref={wRef}
          class="num-in"
          type="text"
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          placeholder={unitLabel()}
          defaultValue={inputNum(wVal)}
          aria-label={t('ex.weightOf', { set: label, unit: unitLabel() })}
          onChange={() => void commit()}
        />
      )}
      <input
        key={`r-${count}`}
        ref={rRef}
        class="num-in"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        autoComplete="off"
        placeholder={`${item.repsMin}–${item.repsMax}`}
        defaultValue={count == null ? '' : String(count)}
        aria-label={t(isTime ? 'ex.secondsOf' : 'ex.repsOf', { set: label })}
        onChange={() => void commit()}
      />
      <button
        type="button"
        class={'set-done' + (set.done ? ' on' : '')}
        aria-pressed={set.done}
        aria-label={t(set.done ? 'ex.setUndo' : 'ex.setDone', { set: label })}
        onClick={() => void onDone()}
      >
        <Icon name="check" size={20} />
      </button>
    </div>
  );
}

/** Совет — маленькая закрываемая карточка в потоке (никаких модальных окон) */
export function TipCard({ tip, children }: { tip: Advice; children?: ComponentChildren }) {
  const icon = { progression: '📈', deload: '🪶', recovery: '🛌', 'light-start': '🌱' }[tip.kind];
  return (
    <div class={'tip ' + tip.kind} role="note">
      <span class="tip-ic" aria-hidden="true">
        {icon}
      </span>
      <p>{children ?? t(tip.textKey)}</p>
      <button
        type="button"
        class="icon-btn tip-x"
        aria-label={t('advice.dismiss')}
        onClick={() => dismissTip(tip.id)}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
