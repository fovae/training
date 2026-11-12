import { useState } from 'preact/hooks';
import { findExercise } from '../../data/exercises';
import { fmtNum, t, tList, weekdayLong, weekdayShort } from '../../i18n';
import { fmtClock, fromUnit, inputNum, parseDecimal, toUnit, unitLabel } from '../../lib/format';
import {
  MAX_DAYS,
  addDay,
  addItem,
  clearDay,
  copyDayTo,
  dayColor,
  findDay,
  insertItem,
  moveItem,
  plan,
  removeDay,
  removeItem,
  renameDay,
  shownWeekday,
  setWeekday,
  updateItem,
} from '../../state/plan';
import { active, restFor } from '../../state/session';
import { ask, planDayId, toast } from '../../state/ui';
import type { Day, PlanItem, Weekday } from '../../types';
import { Stepper, Toggle } from '../components/Controls';
import { DayHead } from '../components/DayHead';
import { SwipeDays } from '../components/DaySwitcher';
import { ExerciseFilters, useExerciseFilter } from '../components/ExerciseFilters';
import { Icon } from '../components/Icon';
import { Pic } from '../components/Pic';
import { Sheet } from '../components/Sheet';
import { dayMeta, dayTitle, exName, muscleName, schemeText } from '../labels';

const REST_OPTIONS = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

export function Plan() {
  const p = plan.value;
  const [picker, setPicker] = useState(false);
  if (!p) return null;
  const day = (planDayId.value && findDay(planDayId.value)) || p.days[0]!;
  const select = (id: string) => (planDayId.value = id);

  const onAddDay = () => {
    const id = addDay();
    if (id) select(id);
  };

  return (
    <div class="screen plan">
      <header class="topbar">
        <div class="eyebrow">{t('plan.eyebrow')}</div>
        <h1 class="screen-title">{t('plan.title')}</h1>
      </header>

      <p class="muted small schedule-line">
        {t('plan.scheduleLine', {
          mode: t(p.mode === 'weekdays' ? 'plan.modeWeekdays' : 'plan.modeCycle'),
        })}{' '}
        <a href="#/settings">{t('plan.changeInSettings')}</a>
      </p>

      <section>
        <div class="sec-h">
          <h2>{t('plan.days', { count: p.days.length })}</h2>
          <span class="eyebrow hide-sm">{t('plan.swipeHint')}</span>
        </div>
        <div class="days" role="tablist" aria-label={t('plan.daysLabel')}>
          {p.days.map((d, i) => {
            const c = dayColor(d.id);
            return (
              <button
                type="button"
                key={d.id}
                role="tab"
                aria-selected={d.id === day.id}
                class={'day' + (d.id === day.id ? ' on' : '')}
                style={{ '--dc': `var(--${c})`, '--dci': `var(--${c}-ink)` }}
                onClick={() => select(d.id)}
              >
                <div class="num">
                  {t('day.n', { n: i + 1 })}
                  {shownWeekday(d) != null ? ` · ${weekdayShort(shownWeekday(d)!)}` : ''}
                </div>
                <div class="ttl">{dayTitle(d)}</div>
                <div class="meta">{dayMeta(d)}</div>
              </button>
            );
          })}
        </div>
        {p.days.length < MAX_DAYS && (
          <button type="button" class="btn-ghost add-day" onClick={onAddDay}>
            <Icon name="plus" size={20} /> {t('plan.addDay')}
          </button>
        )}
      </section>

      <section>
        <SwipeDays value={day.id} onChange={select}>
          <DayHead day={day} />
          <DayTools day={day} />
          {day.items.length === 0 && (
            <div class="empty">
              <p>{t('plan.emptyDay')}</p>
            </div>
          )}
          <ol class="items">
            {day.items.map((item, i) => (
              <ItemEditor key={item.exerciseId + i} day={day} item={item} idx={i} count={day.items.length} />
            ))}
          </ol>
          <button type="button" class="btn primary block" onClick={() => setPicker(true)}>
            <Icon name="plus" size={18} /> {t('plan.addExercise')}
          </button>
        </SwipeDays>
      </section>

      <Rules />

      {picker && <ExercisePicker day={day} onClose={() => setPicker(false)} />}
    </div>
  );
}

function DayTools({ day }: { day: Day }) {
  const p = plan.value!;
  const [copying, setCopying] = useState(false);
  const busy = active.value?.dayId === day.id;

  const onRename = async () => {
    let value = day.label ?? '';
    const r = await ask({
      title: t('plan.renameTitle'),
      body: (
        <input
          class="text-in"
          type="text"
          maxLength={40}
          aria-label={t('plan.dayName')}
          placeholder={dayTitle({ ...day, label: '' })}
          defaultValue={value}
          onInput={(e) => (value = e.currentTarget.value)}
        />
      ),
      confirm: t('common.save'),
    });
    if (r === 'confirm') renameDay(day.id, value);
  };

  const onClear = async () => {
    const r = await ask({
      title: t('plan.clearTitle'),
      body: t('plan.clearBody', { count: day.items.length }),
      confirm: t('plan.clear'),
      danger: true,
    });
    if (r === 'confirm') clearDay(day.id);
  };

  const onDelete = async () => {
    const r = await ask({
      title: t('plan.deleteDayTitle'),
      body: t('plan.deleteDayBody'),
      confirm: t('common.delete'),
      danger: true,
    });
    if (r !== 'confirm') return;
    const next = p.days.find((d) => d.id !== day.id);
    removeDay(day.id);
    if (next) planDayId.value = next.id;
  };

  return (
    <div class="day-tools">
      {p.mode === 'weekdays' && (
        <label class="select">
          <span>{t('plan.weekday')}</span>
          <select
            aria-label={t('plan.weekday')}
            value={day.weekday ?? ''}
            onChange={(e) => setWeekday(day.id, Number(e.currentTarget.value) as Weekday)}
          >
            {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((w) => (
              <option key={w} value={w}>
                {weekdayLong(w)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div class="tool-row">
        <button type="button" class="btn-ghost sm" onClick={() => void onRename()}>
          {t('plan.rename')}
        </button>
        {p.days.length > 1 && (
          <button
            type="button"
            class="btn-ghost sm"
            onClick={() => setCopying(true)}
            disabled={!day.items.length}
          >
            {t('plan.copyTo')}
          </button>
        )}
        <button
          type="button"
          class="btn-ghost sm"
          onClick={() => void onClear()}
          disabled={!day.items.length}
        >
          {t('plan.clear')}
        </button>
        {p.days.length > 1 && (
          <button type="button" class="btn-ghost sm danger" onClick={() => void onDelete()} disabled={busy}>
            {t('plan.deleteDay')}
          </button>
        )}
      </div>
      {copying && (
        <Sheet title={t('plan.copyTitle')} onClose={() => setCopying(false)}>
          <p class="muted small">{t('plan.copyHint')}</p>
          <ul class="list">
            {p.days
              .filter((d) => d.id !== day.id)
              .map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    class="row"
                    onClick={() => {
                      copyDayTo(day.id, d.id);
                      setCopying(false);
                      toast(t('plan.copied'));
                    }}
                  >
                    <span class="chip" style={{ background: `var(--${dayColor(d.id)}-fill)` }}>
                      {t('day.n', { n: p.days.indexOf(d) + 1 })}
                    </span>
                    <span class="row-main">
                      <b>{dayTitle(d)}</b>
                      <span class="muted">{dayMeta(d)}</span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </Sheet>
      )}
    </div>
  );
}

function ItemEditor({ day, item, idx, count }: { day: Day; item: PlanItem; idx: number; count: number }) {
  const ex = findExercise(item.exerciseId);
  const name = exName(item.exerciseId);
  const isTime = ex?.metric === 'time';
  const up = (patch: Partial<PlanItem>) => updateItem(day.id, idx, patch);

  const onRemove = () => {
    const removed = removeItem(day.id, idx);
    if (removed)
      toast(t('plan.removed', { name }), {
        action: { label: t('common.undo'), run: () => insertItem(day.id, idx, removed) },
      });
  };

  const num = (v: string, d: number) => {
    const n = parseDecimal(v);
    return n == null ? d : n;
  };

  return (
    <li class="item">
      <details>
        <summary>
          <span class="item-n">{idx + 1}</span>
          <span class="item-main">
            <b>{name}</b>
            <span class="muted small">
              {schemeText(item, ex)} · {fmtClock(restFor(ex, item))}
              {item.optional ? ' · ' + t('ex.optional') : ''}
            </span>
          </span>
          <Icon name="chevron" size={18} />
        </summary>
        <div class="item-body">
          <div class="item-pic">
            <Pic pic={ex?.pictogram} />
            {ex && <p class="muted small">{ex.primaryMuscles.map(muscleName).join(', ')}</p>}
          </div>
          <div class="srow">
            <span>{t('plan.sets')}</span>
            <Stepper
              label={t('plan.setsOf', { name })}
              value={item.sets}
              min={1}
              max={10}
              step={1}
              format={(v) => fmtNum(v)}
              onChange={(v) => up({ sets: v })}
            />
          </div>
          <div class="srow">
            <span>{t(isTime ? 'plan.secondsRange' : 'plan.repsRange')}</span>
            <span class="range">
              <input
                class="num-in"
                type="text"
                inputMode="numeric"
                aria-label={t('plan.min', { name })}
                defaultValue={String(item.repsMin)}
                key={'min' + item.repsMin}
                onChange={(e) => up({ repsMin: num(e.currentTarget.value, item.repsMin) })}
              />
              <span aria-hidden="true">–</span>
              <input
                class="num-in"
                type="text"
                inputMode="numeric"
                aria-label={t('plan.max', { name })}
                defaultValue={String(item.repsMax)}
                key={'max' + item.repsMax}
                onChange={(e) => up({ repsMax: num(e.currentTarget.value, item.repsMax) })}
              />
            </span>
          </div>
          {ex?.metric === 'weight_reps' && (
            <div class="srow">
              <span>
                {t('plan.weight')}
                <small>{t('plan.weightHint')}</small>
              </span>
              <input
                class="num-in wide"
                type="text"
                inputMode="decimal"
                placeholder={unitLabel()}
                aria-label={t('plan.weightOf', { name, unit: unitLabel() })}
                defaultValue={inputNum(toUnit(item.targetWeightKg))}
                key={'w' + item.targetWeightKg}
                onChange={(e) =>
                  up({ targetWeightKg: fromUnit(parseDecimal(e.currentTarget.value)) ?? undefined })
                }
              />
            </div>
          )}
          <div class="srow">
            <span>{t('plan.rest')}</span>
            <label class="select">
              <span class="sr-only">{t('plan.restOf', { name })}</span>
              <select
                aria-label={t('plan.restOf', { name })}
                value={item.restSec ?? ''}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  up({ restSec: v ? Number(v) : undefined });
                }}
              >
                <option value="">
                  {t('plan.restAuto', { time: fmtClock(restFor(ex, { ...item, restSec: undefined })) })}
                </option>
                {REST_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {fmtClock(s)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div class="srow">
            <span>
              {t('plan.optional')}
              <small>{t('plan.optionalHint')}</small>
            </span>
            <Toggle
              label={t('plan.optionalOf', { name })}
              on={!!item.optional}
              onChange={(v) => up({ optional: v || undefined })}
            />
          </div>
          <div class="tool-row">
            <button
              type="button"
              class="btn-ghost sm"
              disabled={idx === 0}
              aria-label={t('plan.moveUp', { name })}
              onClick={() => moveItem(day.id, idx, -1)}
            >
              ↑ {t('plan.up')}
            </button>
            <button
              type="button"
              class="btn-ghost sm"
              disabled={idx === count - 1}
              aria-label={t('plan.moveDown', { name })}
              onClick={() => moveItem(day.id, idx, 1)}
            >
              ↓ {t('plan.down')}
            </button>
            <button type="button" class="btn-ghost sm danger" onClick={onRemove}>
              <Icon name="trash" size={16} /> {t('common.remove')}
            </button>
          </div>
        </div>
      </details>
    </li>
  );
}

function ExercisePicker({ day, onClose }: { day: Day; onClose: () => void }) {
  const { f, setF, list } = useExerciseFilter();
  const [added, setAdded] = useState(0);
  const inDay = new Set(day.items.map((i) => i.exerciseId));
  return (
    <Sheet
      title={t('plan.pickerTitle')}
      onClose={onClose}
      footer={
        <button type="button" class="btn primary block" onClick={onClose}>
          {added ? t('plan.pickerDone', { count: added }) : t('common.close')}
        </button>
      }
    >
      <ExerciseFilters f={f} setF={setF} idPrefix="pick" autofocus />
      <p class="muted small" aria-live="polite">
        {t('library.found', { count: list.length })}
      </p>
      <ul class="list pick-list">
        {list.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              class="row"
              onClick={() => {
                addItem(day.id, e.id);
                setAdded((n) => n + 1);
                toast(t('plan.added', { name: exName(e.id) }));
              }}
            >
              <span class="row-main">
                <b>{exName(e.id)}</b>
                <span class="muted">
                  {e.primaryMuscles.map(muscleName).join(', ')}
                  {inDay.has(e.id) ? ' · ' + t('plan.alreadyInDay') : ''}
                </span>
              </span>
              <Icon name="plus" size={20} />
            </button>
          </li>
        ))}
      </ul>
      {!list.length && <p class="muted">{t('library.nothing')}</p>}
    </Sheet>
  );
}

/** Общие правила тренировок (были на странице «Программа») */
function Rules() {
  const rules = tList('rules.items');
  return (
    <section>
      <div class="sec-h">
        <h2>{t('rules.title')}</h2>
      </div>
      <div class="rules">
        {rules.map((r, i) => {
          const [title, text] = r.split('|');
          return (
            <div class="rule" key={i}>
              <div class="ic" aria-hidden="true">
                {['🔥', '🎯', '📈', '⏱️', '🛌', '🔁'][i] ?? '•'}
              </div>
              <h3 class="rule-t">{title}</h3>
              <p>{text}</p>
            </div>
          );
        })}
      </div>
      <div class="note warn">
        <span aria-hidden="true">⚠️</span>
        <span>
          <b>{t('rules.stopTitle')}</b> {t('rules.stopText')}
        </span>
      </div>
    </section>
  );
}
