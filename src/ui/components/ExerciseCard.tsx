import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { findExercise } from '../../data/exercises';
import { dismissTip, type Advice } from '../../advice';
import { levelBehavior } from '../../advice/levels';
import { confirmWeight } from '../../features/weightCheck';
import { profile } from '../../state/settings';
import { fmtNum, t } from '../../i18n';
import { fmtSetTime, fromUnit, inputNum, parseDecimal, toUnit, unitLabel } from '../../lib/format';
import type { Exercise, PlanItem, SessionEntry, SessionSet } from '../../types';
import {
  addSet,
  countModeFor,
  entryState,
  loadModeFor,
  setExerciseMode,
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
import { leave } from '../../lib/motion';
import { nextField } from '../../lib/keyboard';
import { loadModes, splitTotal, totalReps, type CountMode, type LoadMode } from '../../lib/dumbbell';
import { ask } from '../../state/ui';
import { Seg } from './Controls';
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
      <Pic pic={ex?.pictogram} live />
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
  if (ex?.metric === 'time') return s.seconds != null ? fmtSetTime(s.seconds) : `— ${t('unit.sec')}`;
  const reps = s.repsR != null && s.repsR !== s.reps ? `${s.reps ?? '—'}/${s.repsR}` : `${s.reps ?? '—'}`;
  const w = (kg: number | undefined) => fmtNum(toUnit(kg) ?? 0);
  // «(2×12)×10» — по гантели 12 в каждой руке; «(12+14)×10» — левая и правая
  if (s.load === 'x2' && s.weightKg) return `(2×${w(s.weightKg)})×${reps}`;
  if (s.load === 'lr' && (s.weightKg || s.weightRKg))
    return `(${w(s.weightKg)}+${w(s.weightRKg ?? s.weightKg)})×${reps}`;
  if (s.weightKg) return `${w(s.weightKg)}×${reps}`;
  return reps;
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
  const modes = loadModes(ex);
  const load = loadModeFor(ex);
  const count = countModeFor(ex);
  const perLabel = ex?.per ? t(`per.${ex.per}`) : '';
  return (
    <div class={'sets no-swipe' + (metric !== 'weight_reps' ? ' one' : load === 'lr' ? ' lr' : '')}>
      {ex && (modes || (ex.per && metric !== 'time')) && (
        <div class="set-modes">
          {modes && (
            <Seg<LoadMode>
              label={t('ex.loadLabel')}
              value={load}
              options={modes.map((v) => ({ v, t: t(`ex.load.${v}`) }))}
              onChange={(v) => setExerciseMode(ex, idx, { load: v })}
            />
          )}
          {ex.per && metric !== 'time' && (
            <Seg<CountMode>
              label={t('ex.countLabel')}
              value={count}
              options={[
                { v: 'side', t: perLabel },
                { v: 'total', t: t('ex.countTotal') },
              ]}
              onChange={(v) => setExerciseMode(ex, idx, { count: v })}
            />
          )}
        </div>
      )}
      <div class="sets-h" aria-hidden="true">
        <span>#</span>
        {metric === 'weight_reps' && load === 'lr' && (
          <>
            <span>
              {t('ex.left')} {unitLabel()}
            </span>
            <span>
              {t('ex.right')} {unitLabel()}
            </span>
          </>
        )}
        {metric === 'weight_reps' && load !== 'lr' && (
          <span>{load === 'x2' ? `${unitLabel()} ×2` : unitLabel()}</span>
        )}
        <span>
          {metric === 'time' ? t('unit.sec') : count === 'total' ? t('ex.countTotal') : t('ex.repsShort')}
        </span>
        <span />
      </div>
      {sets.map((s, i) => (
        <SetRow
          key={i}
          ex={ex}
          item={item}
          name={name}
          idx={idx}
          setIdx={i}
          set={s}
          last={i === sets.length - 1}
          load={load}
          count={count}
        />
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
  last,
  load,
  count,
}: {
  ex: Exercise | undefined;
  item: PlanItem;
  name: string;
  idx: number;
  setIdx: number;
  set: SessionSet;
  /** Последний подход: Enter в повторах закрывает клавиатуру, а не ведёт дальше */
  last: boolean;
  /** Режим гантелей и счёт сторон (src/lib/dumbbell.ts) */
  load: LoadMode;
  count: CountMode;
}) {
  const wRef = useRef<HTMLInputElement>(null);
  const wRRef = useRef<HTMLInputElement>(null);
  const rRef = useRef<HTMLInputElement>(null);
  const metric = ex?.metric ?? 'weight_reps';
  const isTime = metric === 'time';
  const wVal = toUnit(set.weightKg);
  // правая гантель: пусто — как левая (подсказка в поле); ключ — только своё значение, иначе поле
  // пересоздаётся после записи левого веса и теряет фокус
  const wRVal = toUnit(set.weightRKg);
  const total = !isTime && count === 'total';
  const shown = isTime ? set.seconds : total ? totalReps(set) : set.reps;
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
      // вес одной гантели (в режиме Л и П — каждой): проверка нереального веса — по одной
      const one = async (
        ref: { current: HTMLInputElement | null },
        prev: number | undefined,
      ): Promise<number | undefined | false> => {
        const w = fromUnit(parseDecimal(ref.current?.value ?? ''));
        if (w == null || w === prev || !ex) return w ?? undefined;
        const ok = await confirmWeight(ex.id, w);
        if (ok == null) {
          // «Исправить»: вернуть прежнее значение и поставить курсор в поле
          if (ref.current) {
            ref.current.value = inputNum(toUnit(prev));
            ref.current.focus();
          }
          return false;
        }
        if (ok !== w && ref.current) ref.current.value = inputNum(toUnit(ok));
        return ok;
      };
      const l = await one(wRef, set.weightKg);
      if (l === false) return false;
      patch.weightKg = l;
      if (load === 'lr') {
        const r = await one(wRRef, set.weightRKg);
        if (r === false) return false;
        patch.weightRKg = r;
      } else patch.weightRKg = undefined;
      patch.load = load === 'one' ? undefined : load;
    }
    const r = parseDecimal(rRef.current?.value ?? '');
    const v = r == null ? undefined : Math.round(r);
    if (isTime) patch.seconds = v;
    else if (total && v != null) {
      // общий счёт «по очереди»: 16 → 8 на сторону; нечётный — спросить, без округления
      const sp = splitTotal(v);
      if ('odd' in sp) {
        const [a, b] = sp.odd;
        const res = await ask({
          title: t('ex.oddTitle', { total: v }),
          body: t('ex.oddBody'),
          confirm: t('ex.oddSplit', { l: a, r: b }),
          extra: { label: t('ex.oddSplit', { l: b, r: a }) },
          cancel: t('common.cancel'),
        });
        if (res === 'cancel') {
          if (rRef.current) {
            rRef.current.value = shown == null ? '' : String(shown);
            rRef.current.focus();
          }
          return false;
        }
        patch.reps = res === 'confirm' ? a : b;
        patch.repsR = res === 'confirm' ? b : a;
      } else {
        patch.reps = sp.left;
        patch.repsR = undefined;
      }
    } else {
      patch.reps = v;
      patch.repsR = undefined;
    }
    const changed = (Object.keys(patch) as (keyof SessionSet)[]).some((k) => patch[k] !== set[k]);
    if (changed) updateSet(idx, setIdx, patch);
    return true;
  };

  // Enter: вес → повторы → вес следующего подхода; на последнем поле — закрыть клавиатуру
  const onEnter = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    const cur = e.currentTarget as HTMLInputElement;
    const fields = [...(cur.closest('.sets')?.querySelectorAll<HTMLInputElement>('.set .num-in') ?? [])];
    const next = nextField(fields, cur);
    if (next) next.focus();
    else cur.blur();
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
          onKeyDown={onEnter}
          placeholder={unitLabel()}
          defaultValue={inputNum(wVal)}
          aria-label={t(load === 'lr' ? 'ex.weightLeftOf' : 'ex.weightOf', { set: label, unit: unitLabel() })}
          onChange={() => void commit()}
        />
      )}
      {metric === 'weight_reps' && load === 'lr' && (
        <input
          key={`wr-${wRVal}`}
          ref={wRRef}
          class="num-in"
          type="text"
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          onKeyDown={onEnter}
          placeholder={wVal != null ? inputNum(wVal) : unitLabel()}
          defaultValue={inputNum(wRVal)}
          aria-label={t('ex.weightRightOf', { set: label, unit: unitLabel() })}
          onChange={() => void commit()}
        />
      )}
      <input
        key={`r-${shown}-${count}`}
        ref={rRef}
        class="num-in"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint={last ? 'done' : 'next'}
        autoComplete="off"
        onKeyDown={onEnter}
        placeholder={`${item.repsMin}–${item.repsMax}`}
        defaultValue={shown == null ? '' : String(shown)}
        aria-label={t(isTime ? 'ex.secondsOf' : total ? 'ex.totalOf' : 'ex.repsOf', { set: label })}
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
      {total && set.reps != null && (
        <span class="set-hint">
          {set.repsR != null && set.repsR !== set.reps
            ? t('ex.totalHintOdd', { total: shown ?? 0, l: set.reps, r: set.repsR })
            : t('ex.totalHint', { total: shown ?? 0, n: set.reps, per: ex?.per ? t(`per.${ex.per}`) : '' })}
        </span>
      )}
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
        onClick={(e) => leave(e.currentTarget.closest('.tip'), () => dismissTip(tip.id))}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
