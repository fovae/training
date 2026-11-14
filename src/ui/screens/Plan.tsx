import { useEffect, useRef, useState } from 'preact/hooks';
import { levelBehavior } from '../../advice/levels';
import { profile } from '../../state/settings';
import { findExercise } from '../../data/exercises';
import { fmtNum, t, tList, weekdayLong, weekdayShort } from '../../i18n';
import { useProgressive } from '../../lib/motion';
import { Select } from '../components/Select';
import {
  fmtClock,
  fromUnit,
  inputNum,
  occurrenceKeys,
  parseDecimal,
  toUnit,
  unitLabel,
} from '../../lib/format';
import {
  MAX_DAYS,
  addDay,
  addItem,
  clearDay,
  copyDayTo,
  dayColor,
  findDay,
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
import { ask, openMenu, planDayId, toast, type MenuAction } from '../../state/ui';
import type { Day, PlanItem, Weekday } from '../../types';
import { Seg, Stepper, Toggle } from '../components/Controls';
import { DayHead } from '../components/DayHead';
import { ExerciseFilters, useExerciseFilter } from '../components/ExerciseFilters';
import { Icon } from '../components/Icon';
import { Pic } from '../components/Pic';
import { SwipeRow, type RowAction } from '../components/SwipeRow';
import { Sheet } from '../components/Sheet';
import { dayMeta, dayTitle, exName, muscleName, schemeText } from '../labels';

const REST_OPTIONS = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

export function Plan() {
  const p = plan.value;
  const [picker, setPicker] = useState(false);
  /** Ключ только что добавленного упражнения: его редактор открывается сам (средний и опытный уровень) */
  const [openKey, setOpenKey] = useState<string | null>(null);
  const addBtn = useRef<HTMLButtonElement>(null);
  if (!p) return null;
  const day = (planDayId.value && findDay(planDayId.value)) || p.days[0]!;
  const select = (id: string) => (planDayId.value = id);
  const keys = occurrenceKeys(day.items.map((i) => i.exerciseId));

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

      <section>
        <div class="sec-h">
          <h2>{t('plan.days', { count: p.days.length })}</h2>
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

      <hr class="sec-div" />

      <section aria-labelledby="day-h">
        <>
          <div class="sec-h">
            <h2 id="day-h">{t('plan.dayContent')}</h2>
          </div>
          <DayTools day={day} />
          {day.items.length === 0 && (
            <div class="empty">
              <p>{t('plan.emptyDay')}</p>
            </div>
          )}
          <ol class="items">
            {day.items.map((item, i) => (
              <ItemEditor
                key={day.id + '/' + keys[i]}
                day={day}
                item={item}
                idx={i}
                count={day.items.length}
                autoOpen={openKey === keys[i]}
                onAutoOpened={() => setOpenKey(null)}
              />
            ))}
          </ol>
          <button ref={addBtn} type="button" class="btn primary block" onClick={() => setPicker(true)}>
            <Icon name="plus" size={18} /> {t('plan.addExercise')}
          </button>
        </>
      </section>

      <hr class="sec-div" />

      <Rules />

      <hr class="sec-div" />

      <section class="card schedule-card" aria-labelledby="schedule-h">
        <div>
          <h2 class="card-t" id="schedule-h">
            {t('plan.scheduleLine', {
              mode: t(p.mode === 'weekdays' ? 'plan.modeWeekdays' : 'plan.modeCycle'),
            })}
          </h2>
          <p class="muted small">
            {t(p.mode === 'weekdays' ? 'plan.modeWeekdaysHint' : 'plan.modeCycleHint')}
          </p>
        </div>
        <a class="btn secondary" href="#/settings/schedule">
          {t('plan.changeInSettings')}
        </a>
      </section>

      {picker && (
        <ExercisePicker
          day={day}
          onClose={(added) => {
            setPicker(false);
            // Средний и опытный: сразу открыть последнее добавленное упражнение — ввести вес и повторы
            if (added && levelBehavior(profile.value?.level).askWeightOnAdd) {
              setOpenKey(keys[keys.length - 1] ?? null);
              return;
            }
            // Safari не фокусирует кнопку по клику — возвращаем фокус явно
            requestAnimationFrame(() => addBtn.current?.focus());
          }}
        />
      )}
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
          autoComplete="off"
          enterKeyHint="done"
          data-autofocus
          aria-label={t('plan.dayName')}
          placeholder={dayTitle({ ...day, label: '' })}
          defaultValue={value}
          onInput={(e) => (value = e.currentTarget.value)}
          // «Готово» на клавиатуре — то же, что «Сохранить»
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.isComposing) return;
            e.preventDefault();
            e.currentTarget.closest('.modal')?.querySelector<HTMLButtonElement>('.modal-actions .btn')?.click();
          }}
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

  // Управление днём — в карточке дня: «⋯» справа вверху открывает меню снизу (как у упражнений)
  const actions: MenuAction[] = [{ label: t('plan.rename'), run: onRename }];
  if (p.days.length > 1)
    actions.push({ label: t('plan.copyTo'), disabled: !day.items.length, run: () => setCopying(true) });
  actions.push({ label: t('plan.clear'), disabled: !day.items.length, run: onClear });
  if (p.days.length > 1)
    actions.push({ label: t('plan.deleteDay'), danger: true, disabled: busy, run: onDelete });

  return (
    <>
      <DayHead
        day={day}
        action={
          <button
            type="button"
            class="dayhead-more"
            aria-label={t('plan.dayActions', { name: dayTitle(day) })}
            aria-haspopup="dialog"
            onClick={() => openMenu({ title: dayTitle(day), actions })}
          >
            <Icon name="more" size={22} />
          </button>
        }
      />
      {p.mode === 'weekdays' && (
        <div class="day-tools">
          <Select
            label={t('plan.weekday')}
            caption={t('plan.weekday')}
            value={String(day.weekday ?? '')}
            onChange={(v) => setWeekday(day.id, Number(v) as Weekday)}
            options={([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((w) => ({
              value: String(w),
              label: weekdayLong(w),
            }))}
          />
        </div>
      )}
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
    </>
  );
}

function ItemEditor({
  day,
  item,
  idx,
  count,
  autoOpen,
  onAutoOpened,
}: {
  day: Day;
  item: PlanItem;
  idx: number;
  count: number;
  autoOpen?: boolean;
  onAutoOpened?: () => void;
}) {
  const ex = findExercise(item.exerciseId);
  const lvl = levelBehavior(profile.value?.level);
  const [showWeight, setShowWeight] = useState(lvl.showTargetWeight || item.targetWeightKg != null);
  const weightRef = useRef<HTMLInputElement>(null);
  const repsRef = useRef<HTMLInputElement>(null);
  const details = useRef<HTMLDetailsElement>(null);
  // Только что добавленное упражнение: раскрыть редактор и поставить курсор в вес — один раз.
  // Раскрываем через DOM, а не атрибутом: после сброса метки редактор остаётся открытым, а
  // перестановка и удаление соседей его больше не открывают заново.
  useEffect(() => {
    if (!autoOpen) return;
    if (details.current) details.current.open = true;
    (showWeight ? weightRef : repsRef).current?.focus();
    onAutoOpened?.();
  }, [autoOpen]);
  const name = exName(item.exerciseId);
  const isTime = ex?.metric === 'time';
  const up = (patch: Partial<PlanItem>) => updateItem(day.id, idx, patch);

  // Удаление — только после вопроса «Удалить?» (решение владельца)
  const onRemove = async () => {
    const r = await ask({
      title: t('menu.removeExTitle', { name }),
      body: t('menu.removeExBody'),
      confirm: t('menu.delete'),
      danger: true,
    });
    if (r !== 'confirm') return;
    if (removeItem(day.id, idx)) toast(t('plan.removed', { name }));
  };
  const actions: RowAction[] = [
    { label: t('menu.moveUp'), disabled: idx === 0, run: () => moveItem(day.id, idx, -1) },
    { label: t('menu.moveDown'), disabled: idx === count - 1, run: () => moveItem(day.id, idx, 1) },
    { label: t('menu.delete'), danger: true, quick: true, run: onRemove },
  ];

  const num = (v: string, d: number) => {
    const n = parseDecimal(v);
    return n == null ? d : n;
  };
  // Упражнения на время: диапазон в секундах или в минутах (хранится всегда в секундах)
  const [inMin, setInMin] = useState(isTime && item.repsMin >= 60 && item.repsMin % 60 === 0);
  const k = isTime && inMin ? 60 : 1;
  const shown = (sec: number) => (k === 60 ? inputNum(Math.round((sec / 60) * 10) / 10) : String(sec));
  const toSec = (v: string, d: number) => Math.round(num(v, d / k) * k);

  return (
    <li class="item">
      <SwipeRow title={name} actions={actions}>
        <details ref={details}>
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
              <Pic pic={ex?.pictogram} live />
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
            {isTime && (
              <div class="srow">
                <span class="sr-only">{t('plan.timeUnit', { name })}</span>
                <Seg
                  label={t('plan.timeUnit', { name })}
                  value={inMin ? 'min' : 'sec'}
                  onChange={(v) => setInMin(v === 'min')}
                  options={[
                    { v: 'sec', t: t('plan.secondsRange') },
                    { v: 'min', t: t('plan.minutesRange') },
                  ]}
                />
              </div>
            )}
            <div class="srow">
              <span>
                {t(isTime ? (inMin ? 'plan.minutesRange' : 'plan.secondsRange') : 'plan.repsRange')}
              </span>
              <span class="range">
                <input
                  class="num-in"
                  type="text"
                  inputMode={k === 60 ? 'decimal' : 'numeric'}
                  enterKeyHint="done"
                  autoComplete="off"
                  ref={repsRef}
                  aria-label={t('plan.min', { name })}
                  defaultValue={shown(item.repsMin)}
                  key={'min' + item.repsMin + k}
                  onChange={(e) => up({ repsMin: toSec(e.currentTarget.value, item.repsMin) })}
                />
                <span aria-hidden="true">–</span>
                <input
                  class="num-in"
                  type="text"
                  inputMode={k === 60 ? 'decimal' : 'numeric'}
                  enterKeyHint="done"
                  autoComplete="off"
                  aria-label={t('plan.max', { name })}
                  defaultValue={shown(item.repsMax)}
                  key={'max' + item.repsMax + k}
                  onChange={(e) => up({ repsMax: toSec(e.currentTarget.value, item.repsMax) })}
                />
              </span>
            </div>
            {ex?.metric === 'weight_reps' && !showWeight && (
              <button type="button" class="btn-ghost sm" onClick={() => setShowWeight(true)}>
                <Icon name="plus" size={16} /> {t('plan.addWeight')}
              </button>
            )}
            {ex?.metric === 'weight_reps' && showWeight && (
              <div class="srow">
                <span>
                  {t('plan.weight')}
                  <small>{t('plan.weightHint')}</small>
                </span>
                <input
                  ref={weightRef}
                  class="num-in wide"
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
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
              <Select
                label={t('plan.restOf', { name })}
                value={String(item.restSec ?? '')}
                onChange={(v) => up({ restSec: v ? Number(v) : undefined })}
                options={[
                  {
                    value: '',
                    label: t('plan.restAuto', {
                      time: fmtClock(restFor(ex, { ...item, restSec: undefined })),
                    }),
                  },
                  ...REST_OPTIONS.map((s) => ({ value: String(s), label: fmtClock(s) })),
                ]}
              />
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
              <button type="button" class="btn-ghost sm danger" onClick={() => void onRemove()}>
                <Icon name="trash" size={16} /> {t('common.remove')}
              </button>
            </div>
          </div>
        </details>
      </SwipeRow>
    </li>
  );
}

function ExercisePicker({ day, onClose }: { day: Day; onClose: (added: number) => void }) {
  const { f, setF, list } = useExerciseFilter();
  const [added, setAdded] = useState(0);
  // лист выезжает плавно: сотни строк дорисовываются кадром позже
  const shown = useProgressive(list.length, false, 16);
  const inDay = new Set(day.items.map((i) => i.exerciseId));
  return (
    <Sheet
      title={t('plan.pickerTitle')}
      onClose={() => onClose(added)}
      footer={
        <button type="button" class="btn primary block" onClick={() => onClose(added)}>
          {added ? t('plan.pickerDone', { count: added }) : t('common.close')}
        </button>
      }
    >
      <ExerciseFilters f={f} setF={setF} idPrefix="pick" autofocus />
      <p class="muted small" aria-live="polite">
        {t('library.found', { count: list.length })}
      </p>
      <ul class="list pick-list">
        {list.slice(0, shown).map((e) => (
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
              {/* миниатюра схемы: сразу видно, что за движение */}
              <span class="pick-thumb" aria-hidden="true">
                <Pic pic={e.pictogram} />
              </span>
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
