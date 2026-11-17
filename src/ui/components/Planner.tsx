import { signal } from '@preact/signals';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { findExercise } from '../../data/exercises';
import {
  EQUIPMENT_CHOICES,
  GROUP_SECTIONS,
  PLACE_EQUIPMENT,
  PRESETS,
  RESTRICTIONS,
  type Group,
  type Place,
} from '../../data/planner';
import { fmtNum, t } from '../../i18n';
import { fmtDuration } from '../../lib/format';
import { MINUTES, similar, type Answers, type DraftDay, type Minutes, type Warning } from '../../lib/planner';
import {
  answers,
  applyDraft,
  applyDraftDay,
  buildPlanDraft,
  closePlanner,
  draft,
  planHasItems,
  plannerCtx,
  plannerDay,
  plannerOpen,
  rebuildDraft,
  replaceDraftItem,
  togglePin,
  undoApply,
} from '../../state/planner';
import { plan } from '../../state/plan';
import { ask, go, toast, toasts } from '../../state/ui';
import type { Equipment, Level } from '../../types';
import { exName, schemeText } from '../labels';
import { Choice, ScheduleSwitch, Seg, Stepper } from './Controls';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

/**
 * Мастер «Подбор плана»: фокус → место и инвентарь → дни → время → уровень и ограничения →
 * предпросмотр (заменить, закрепить, пересобрать) → применить к плану с отменой.
 * Подборка по правилам, не индивидуальная рекомендация (docs/CONCEPT.md).
 */
const ALL_STEPS = ['focus', 'place', 'days', 'time', 'level', 'preview'] as const;
/** «Собрать день» — без шага «дни» */
const stepsNow = () => (plannerDay.value ? ALL_STEPS.filter((x) => x !== 'days') : ALL_STEPS);
const step = signal(0);
/** Открытый список замен: день и строка */
const replacing = signal<{ di: number; ii: number } | null>(null);

const set = (patch: Partial<Answers>) => (answers.value = { ...answers.value, ...patch });

function Pick({
  on,
  disabled,
  onClick,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      class={'pick' + (on ? ' on' : '')}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function FocusStep() {
  const a = answers.value;
  const toggle = (g: Group) => {
    const has = a.priorities.includes(g);
    const priorities = has ? a.priorities.filter((x) => x !== g) : [...a.priorities, g];
    set({ priorities, full: priorities.length === 0 });
  };
  const full = a.full || !a.priorities.length;
  return (
    <div class="planner-step">
      <p class="muted">{t('planner.focusHint')}</p>
      <div class="picks">
        <Pick on={full} onClick={() => set({ full: true, priorities: [] })}>
          {t('planner.full')}
        </Pick>
      </div>
      {GROUP_SECTIONS.map((s) => (
        <div key={s.key} class="planner-sec">
          <h3>{t(`planner.section.${s.key}`)}</h3>
          <div class="picks">
            {s.groups.map((g) => (
              <Pick key={g} on={!full && a.priorities.includes(g)} onClick={() => toggle(g)}>
                {t(`planner.group.${g}`)}
              </Pick>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlaceStep() {
  const a = answers.value;
  const toggle = (q: Equipment) =>
    set({ equipment: a.equipment.includes(q) ? a.equipment.filter((x) => x !== q) : [...a.equipment, q] });
  return (
    <div class="planner-step">
      <Seg<Place>
        label={t('planner.place')}
        value={a.place}
        mini={false}
        options={(['gym', 'home', 'outdoor'] as const).map((v) => ({ v, t: t(`planner.placeOpt.${v}`) }))}
        onChange={(v) => set({ place: v, equipment: [...PLACE_EQUIPMENT[v]] })}
      />
      <div class="planner-sec">
        <h3>{t('planner.presets')}</h3>
        <div class="picks">
          {PRESETS[a.place].map((p) => (
            <Pick
              key={p.key}
              on={
                p.equipment.length === a.equipment.length && p.equipment.every((q) => a.equipment.includes(q))
              }
              onClick={() => set({ equipment: [...p.equipment] })}
            >
              {t(`planner.preset.${p.key}`)}
            </Pick>
          ))}
        </div>
      </div>
      <div class="planner-sec">
        <h3>{t('planner.equipment')}</h3>
        <p class="muted small">{t('planner.equipmentHint')}</p>
        <div class="picks">
          {EQUIPMENT_CHOICES.map((q) => (
            <Pick key={q} on={a.equipment.includes(q)} onClick={() => toggle(q)}>
              {t(`equip.${q}`)}
            </Pick>
          ))}
        </div>
      </div>
    </div>
  );
}

function DaysStep() {
  const a = answers.value;
  return (
    <div class="planner-step">
      <div class="srow">
        <span>{t('onb.plan.days')}</span>
        <Stepper
          label={t('onb.plan.days')}
          value={a.days}
          min={1}
          max={7}
          step={1}
          format={(v) => fmtNum(v)}
          onChange={(v) => set({ days: v })}
        />
      </div>
      {a.days >= 5 && <p class="note">{t('planner.warn.recovery')}</p>}
      <ScheduleSwitch value={a.mode} onChange={(v) => set({ mode: v })} />
    </div>
  );
}

function TimeStep() {
  const a = answers.value;
  return (
    <div class="planner-step">
      <p class="muted">{t('planner.timeHint')}</p>
      <Seg<Minutes>
        label={t('planner.time')}
        value={a.minutes}
        mini={false}
        options={MINUTES.map((v) => ({ v, t: fmtNum(v) }))}
        onChange={(v) => set({ minutes: v })}
      />
      <p class="muted small">{t('planner.timeUnit')}</p>
    </div>
  );
}

function LevelStep() {
  const a = answers.value;
  return (
    <div class="planner-step">
      <Choice<Level>
        label={t('onb.level.title')}
        value={a.level}
        onChange={(v) => set({ level: v })}
        options={(['first', 'few', 'intermediate', 'veteran'] as const).map((v) => ({
          v,
          t: t(`level.${v}`),
        }))}
      />
      <div class="planner-sec">
        <h3>{t('planner.restrict')}</h3>
        <div class="picks">
          {RESTRICTIONS.map((r) => (
            <Pick
              key={r}
              on={a.restrict.includes(r)}
              onClick={() =>
                set({
                  restrict: a.restrict.includes(r) ? a.restrict.filter((x) => x !== r) : [...a.restrict, r],
                })
              }
            >
              {t(`planner.restriction.${r}`)}
            </Pick>
          ))}
        </div>
      </div>
    </div>
  );
}

function warnText(w: Warning): string {
  const groups = (w.groups ?? []).map((g) => t(`planner.group.${g}`)).join(', ');
  const equipment = (w.equipment ?? []).map((q) => t(`equip.${q}`)).join(', ');
  return t(`planner.warn.${w.key}`, { groups, equipment });
}

function Preview() {
  const d = draft.value;
  if (!d) return null;
  const r = replacing.value;
  return (
    <div class="planner-step">
      <p class="note">{t('planner.disclaimer')}</p>
      {d.warnings.map((w, i) => (
        <p key={i} class="note warn">
          {warnText(w)}
        </p>
      ))}
      {d.days.map((day, di) => (
        <section key={di} class="card planner-day">
          <h3 class="card-t">
            {plannerDay.value ? dayName(day) : `${t('day.n', { n: di + 1 })} · ${dayName(day)}`}
          </h3>
          <p class="muted small">
            {t('estimate.label', {
              time: fmtDuration(day.estimate.typicalMin * 60000),
              from: day.estimate.minMin,
              to: day.estimate.maxMin,
            })}
          </p>
          <ol class="planner-items">
            {day.items.map((it, ii) => {
              const ex = findExercise(it.exerciseId);
              const open = r?.di === di && r.ii === ii;
              const name = exName(it.exerciseId);
              return (
                <li key={it.exerciseId} class={it.optional ? 'opt' : ''}>
                  <div class="planner-row">
                    <span class="planner-name">
                      <b>{name}</b>
                      <small>
                        {schemeText(it, ex)}
                        {it.warmup
                          ? ` · ${t('planner.warmup')}`
                          : it.optional
                            ? ` · ${t('plan.optional')}`
                            : ''}
                      </small>
                    </span>
                    <button
                      type="button"
                      class={'icon-btn' + (it.pinned ? ' on' : '')}
                      aria-pressed={!!it.pinned}
                      aria-label={t('planner.pin', { name })}
                      onClick={() => togglePin(di, ii)}
                    >
                      <Icon name="pin" size={18} />
                    </button>
                    <button
                      type="button"
                      class="btn-ghost sm"
                      aria-expanded={open}
                      onClick={() => (replacing.value = open ? null : { di, ii })}
                    >
                      {t('planner.replace')}
                    </button>
                  </div>
                  {open && (
                    <ul class="planner-alt" aria-label={t('planner.replaceWith', { name })}>
                      {similar(
                        it.exerciseId,
                        answers.value,
                        plannerCtx(),
                        day.items.map((x) => x.exerciseId),
                      ).map((e) => (
                        <li key={e.id}>
                          <button
                            type="button"
                            class="btn-ghost sm"
                            onClick={() => {
                              const prev = it.exerciseId;
                              replaceDraftItem(di, ii, e.id);
                              replacing.value = null;
                              toast(t('planner.replaced', { name: exName(e.id) }), {
                                action: {
                                  label: t('common.undo'),
                                  run: () => replaceDraftItem(di, ii, prev),
                                },
                              });
                            }}
                          >
                            {exName(e.id)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** Название дня черновика: 'custom' — группы через «+», иначе planner.day.<key> */
const dayName = (day: DraftDay) =>
  day.key === 'custom'
    ? (day.groups ?? []).map((g) => t(`planner.group.${g}`)).join(' + ')
    : t(`planner.day.${day.key}`);

async function onApplyDay() {
  const d = draft.value?.days[0];
  const target = plan.value?.days.find((x) => x.id === plannerDay.value);
  if (!d || !target) return;
  if (target.items.length) {
    const res = await ask({
      title: t('planner.dayReplaceTitle'),
      body: t('planner.dayReplaceBody'),
      confirm: t('planner.applyReplace'),
    });
    if (res !== 'confirm') return;
  }
  const prev = await applyDraftDay(dayName(d));
  step.value = 0;
  go('plan');
  toasts.value = [];
  toast(t('planner.dayApplied'), {
    // план только что сменился целиком — человеку нужно время посмотреть, прежде чем отменять
    ttl: 10000,
    action: { label: t('common.undo'), run: () => void undoApply(prev) },
  });
}

async function onApply() {
  if (plannerDay.value) return onApplyDay();
  let how: 'replace' | 'add' = 'replace';
  if (planHasItems()) {
    const res = await ask({
      title: t('planner.applyTitle'),
      body: t('planner.applyBody'),
      confirm: t('planner.applyReplace'),
      extra: { label: t('planner.applyAdd') },
      cancel: t('common.cancel'),
    });
    if (res === 'cancel') return;
    how = res === 'confirm' ? 'replace' : 'add';
  }
  const { prev, dropped } = await applyDraft(how);
  step.value = 0;
  go('plan');
  // «Отменить замену» из мастера после применения уже не нужна — остаётся одна отмена: всего плана
  toasts.value = [];
  toast(dropped ? t('planner.appliedDropped', { count: dropped }) : t('planner.applied'), {
    // план только что сменился целиком — человеку нужно время посмотреть, прежде чем отменять
    ttl: 10000,
    action: { label: t('common.undo'), run: () => void undoApply(prev) },
  });
}

export function PlannerHost() {
  if (!plannerOpen.value) return null;
  return <PlannerSheet />;
}

function PlannerSheet() {
  const i = step.value;
  const STEPS = stepsNow();
  const s = STEPS[i] ?? STEPS[STEPS.length - 1]!;
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    body.current?.closest('.sheet-body')?.scrollTo({ top: 0 });
  }, [i]);
  const close = () => {
    step.value = 0;
    replacing.value = null;
    closePlanner();
  };
  const next = () => {
    if (STEPS[i + 1] === 'preview') buildPlanDraft(0);
    step.value = Math.min(STEPS.length - 1, i + 1);
  };
  return (
    <Sheet
      tall
      title={plannerDay.value ? t('planner.dayTitle') : t('planner.title')}
      onClose={close}
      footer={
        <div class="planner-f">
          {i > 0 && (
            <button type="button" class="btn-ghost" onClick={() => (step.value = i - 1)}>
              {t('common.back')}
            </button>
          )}
          {s === 'preview' ? (
            <>
              <button type="button" class="btn-ghost" onClick={rebuildDraft}>
                <Icon name="refresh" size={18} /> {t('planner.rebuild')}
              </button>
              <button type="button" class="btn primary" onClick={() => void onApply()}>
                {t('planner.apply')}
              </button>
            </>
          ) : (
            <button type="button" class="btn primary" onClick={next}>
              {STEPS[i + 1] === 'preview' ? t('planner.build') : t('common.next')}
            </button>
          )}
        </div>
      }
    >
      <div ref={body}>
        <p class="eyebrow">{t('planner.stepOf', { n: i + 1, total: STEPS.length })}</p>
        <h3 class="planner-h">{t(`planner.step.${s}`)}</h3>
        {s === 'focus' && <FocusStep />}
        {s === 'place' && <PlaceStep />}
        {s === 'days' && <DaysStep />}
        {s === 'time' && <TimeStep />}
        {s === 'level' && <LevelStep />}
        {s === 'preview' && <Preview />}
      </div>
    </Sheet>
  );
}
