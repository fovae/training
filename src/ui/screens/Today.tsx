import { useEffect, useState } from 'preact/hooks';
import { fmtDate, t, weekdayLong } from '../../i18n';
import { fmtDuration } from '../../lib/format';
import { ask, go, pickedDayId, todayDayId, toast } from '../../state/ui';
import { findDay, plan } from '../../state/plan';
import {
  active,
  activeProgress,
  cancelSession,
  finishSession,
  loadError,
  nextWeekdayDayId,
  setSessionNote,
  startSession,
  suggestedDayId,
  targetFor,
  weekCount,
} from '../../state/session';
import { stopRest } from '../../features/timer';
import { DayHead } from '../components/DayHead';
import { DaySwitcher, SwipeDays } from '../components/DaySwitcher';
import { ExerciseCard, TipCard } from '../components/ExerciseCard';
import { dayTips } from '../../advice';
import { dismissReminder, reminderDue, saveCopy } from '../../features/backup';
import { Icon } from '../components/Icon';
import { dayNumber, muscleName } from '../labels';

function useElapsed(fromIso: string | undefined): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!fromIso) return;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [fromIso]);
  return fromIso ? now - Date.parse(fromIso) : 0;
}

export function Today() {
  const s = active.value;
  const p = plan.value;
  const dayId = todayDayId.value;
  const day = dayId ? findDay(dayId) : undefined;
  const suggested = suggestedDayId.value;
  const elapsed = useElapsed(s?.startedAt);
  const perWeek = p?.days.length ?? 0;

  const setDay = (id: string) => {
    if (s) return;
    pickedDayId.value = id === suggested ? null : id;
  };

  const onFinish = async () => {
    const pr = activeProgress.value;
    const anyDone = s?.entries.some((e) => e.sets.some((x) => x.done));
    if (!anyDone) {
      const r = await ask({
        title: t('today.emptyTitle'),
        body: t('today.emptyBody'),
        confirm: t('today.cancelWorkout'),
        danger: true,
        cancel: t('common.continue'),
      });
      if (r === 'confirm') {
        await cancelSession();
        stopRest();
      }
      return;
    }
    const left = pr.total - pr.done;
    const r = await ask({
      title: t('today.finishTitle'),
      body: left > 0 ? t('today.finishLeft', { count: left }) : t('today.finishAll'),
      confirm: t('today.finish'),
      cancel: t('common.continue'),
    });
    if (r !== 'confirm') return;
    try {
      await finishSession();
      stopRest();
      pickedDayId.value = null;
      toast(t('today.saved'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error(e);
      toast(t('today.saveFailed'));
    }
  };

  const onCancel = async () => {
    const ok = await ask({
      title: t('today.cancelTitle'),
      body: t('today.cancelBody'),
      confirm: t('common.delete'),
      danger: true,
      cancel: t('common.back'),
    });
    if (ok === 'confirm') {
      await cancelSession();
      stopRest();
    }
  };

  // Советы: не больше двух на тренировку; восстановление — только когда тренировка идёт
  const tips = day
    ? dayTips(day.id, s ? s.entries.map((e) => targetFor(s.dayId, e.exerciseId)) : day.items, {
        withRecovery: !!s,
        ...(s ? { beforeIso: s.startedAt } : {}),
      })
    : [];
  const restDay = !s && !day && p?.mode === 'weekdays';
  const title = s
    ? t('today.inProgress')
    : restDay
      ? t('today.restDay')
      : dayId === suggested
        ? t(p?.mode === 'weekdays' ? 'today.scheduled' : 'today.nextInCycle')
        : t('today.offSchedule');

  return (
    <div class="screen today">
      <header class="topbar">
        <div class="topbar-row">
          <div>
            <div class="eyebrow">{fmtDate(Date.now())}</div>
            <h1 class="screen-title">{title}</h1>
          </div>
          <div class="week-chip" title={t('today.weekChipTitle')}>
            <b>{weekCount.value}</b>
            <span>{t('today.ofPerWeek', { n: perWeek })}</span>
          </div>
        </div>
        {!!p && p.days.length > 1 && (
          <DaySwitcher value={dayId} onChange={setDay} suggested={s ? undefined : suggested} disabled={!!s} />
        )}
      </header>

      {loadError.value && <div class="note warn">{t('app.storageError')}</div>}
      {!s && reminderDue.value && <BackupReminder />}

      {restDay && <RestDay onPick={setDay} />}

      {day && (
        <SwipeDays value={day.id} onChange={setDay} enabled={!s}>
          <DayHead day={day} progress={s ? activeProgress.value : undefined}>
            {!s && day.items.length > 0 && (
              <div class="dayhead-cta">
                <button type="button" class="btn on-color" onClick={() => startSession(day.id)}>
                  <Icon name="play" size={18} /> {t('today.start')}
                </button>
                {suggested && day.id !== suggested && (
                  <span class="dayhead-note">{t('today.suggestedIs', { day: dayNumber(suggested) })}</span>
                )}
              </div>
            )}
            {s && (
              <div class="dayhead-cta">
                <span class="dayhead-note">⏱ {fmtDuration(elapsed)}</span>
                <button type="button" class="btn on-color" onClick={() => void onFinish()}>
                  <Icon name="check" size={18} /> {t('today.finish')}
                </button>
              </div>
            )}
          </DayHead>

          {tips
            .filter((a) => a.kind === 'recovery')
            .map((a) => (
              <TipCard key={a.id} tip={a}>
                {t('advice.recovery', { muscles: (a.muscles ?? []).map(muscleName).join(', ') })}
              </TipCard>
            ))}

          {!s && !day.items.length && (
            <div class="empty">
              <p>{t('today.emptyDay')}</p>
              <button type="button" class="btn primary" onClick={() => go('plan')}>
                {t('today.toPlan')}
              </button>
            </div>
          )}

          <div class="ex-grid">
            {s
              ? s.entries.map((entry, i) => (
                  <ExerciseCard
                    key={entry.exerciseId + i}
                    item={targetFor(s.dayId, entry.exerciseId)}
                    num={i + 1}
                    log={{ idx: i, entry }}
                    tips={tips.filter((a) => a.exerciseId === entry.exerciseId)}
                  />
                ))
              : day.items.map((item, i) => (
                  <ExerciseCard
                    key={item.exerciseId + i}
                    item={item}
                    num={i + 1}
                    tips={tips.filter((a) => a.exerciseId === item.exerciseId)}
                  />
                ))}
          </div>

          {s && (
            <div class="finish-zone">
              <label class="field">
                <span class="field-lb">{t('today.sessionNote')}</span>
                <textarea
                  class="note-in"
                  rows={2}
                  maxLength={1000}
                  placeholder={t('today.sessionNotePh')}
                  defaultValue={s.note ?? ''}
                  onChange={(e) => setSessionNote(e.currentTarget.value)}
                />
              </label>
              <button type="button" class="btn primary block" onClick={() => void onFinish()}>
                <Icon name="check" size={18} /> {t('today.finishWorkout')}
              </button>
              <button type="button" class="btn danger-ghost block" onClick={() => void onCancel()}>
                {t('today.cancelWorkout')}
              </button>
            </div>
          )}
        </SwipeDays>
      )}
    </div>
  );
}

function RestDay({ onPick }: { onPick: (id: string) => void }) {
  const next = nextWeekdayDayId.value;
  const nd = next ? findDay(next) : undefined;
  return (
    <div class="card rest-day">
      <p>{t('today.restDayText')}</p>
      {nd?.weekday != null && (
        <p class="muted small">{t('today.nextScheduled', { day: weekdayLong(nd.weekday) })}</p>
      )}
      {nd && (
        <button type="button" class="btn secondary" onClick={() => onPick(nd.id)}>
          {t('today.trainAnyway')}
        </button>
      )}
    </div>
  );
}

/** «Сохрани копию»: раз в 7 дней, закрытие откладывает на 3 дня. Никаких push. */
function BackupReminder() {
  const onSave = async () => {
    const r = await saveCopy();
    if (r === 'downloaded') toast(t('backup.downloaded'));
    if (r === 'shared') toast(t('backup.saved'));
  };
  return (
    <aside class="card backup-reminder" aria-label={t('backup.reminderLabel')}>
      <div class="br-text">
        <b>{t('legal.backupReminder')}</b>
        <span class="muted small">{t('legal.backupReminderNote')}</span>
      </div>
      <div class="br-actions">
        <button type="button" class="btn primary" onClick={() => void onSave()}>
          <Icon name="share" size={18} /> {t('backup.save')}
        </button>
        <button
          type="button"
          class="icon-btn"
          aria-label={t('backup.reminderDismiss')}
          onClick={dismissReminder}
        >
          <Icon name="close" size={20} />
        </button>
      </div>
    </aside>
  );
}
