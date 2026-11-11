import { useEffect, useState } from 'preact/hooks';
import { PROGRAM, dayIndex, findDay, isOptional } from '../../data/program';
import { fmtDate, fmtDuration, plural } from '../../lib/format';
import { ask, pickedDayId, todayDayId, toast } from '../../state/ui';
import {
  active,
  activeProgress,
  cancelWorkout,
  finishWorkout,
  loadError,
  loaded,
  startWorkout,
  suggestedDayId,
  weekCount,
} from '../../state/workout';
import { stopRest } from '../../features/timer';
import { DayHead } from '../components/DayHead';
import { DaySwitcher, SwipeDays } from '../components/DaySwitcher';
import { ExerciseCard } from '../components/ExerciseCard';
import { InstallHint } from '../components/InstallHint';
import { Icon } from '../components/Icon';

function useElapsed(from: number | undefined): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!from) return;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [from]);
  return from ? now - from : 0;
}

export function Today() {
  const w = active.value;
  const dayId = todayDayId.value;
  const day = findDay(dayId) ?? PROGRAM[0]!;
  const suggested = suggestedDayId.value;
  const elapsed = useElapsed(w?.startedAt);

  const setDay = (id: string) => {
    if (w) return;
    pickedDayId.value = id === suggested ? null : id;
  };

  const onFinish = async () => {
    const p = activeProgress.value;
    const anyDone = w?.exercises.some((e) => e.sets.some((s) => s.done));
    if (!anyDone) {
      const r = await ask({
        title: 'Ни одного подхода не отмечено',
        body: 'Сохранять пустую тренировку нет смысла. Отменить её?',
        confirm: 'Отменить тренировку',
        danger: true,
        cancel: 'Продолжить',
      });
      if (r === 'confirm') {
        await cancelWorkout();
        stopRest();
      }
      return;
    }
    const left = p.total - p.done;
    const r = await ask({
      title: 'Завершить тренировку?',
      body:
        left > 0
          ? `Осталось ${left} ${plural(left, 'упражнение', 'упражнения', 'упражнений')}. Неотмеченные подходы не попадут в историю.`
          : 'Все упражнения выполнены. Отличная работа!',
      confirm: 'Завершить',
      cancel: 'Продолжить',
    });
    if (r !== 'confirm') return;
    try {
      await finishWorkout();
      stopRest();
      pickedDayId.value = null;
      toast('Тренировка сохранена 💪');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error(e);
      toast('Не удалось сохранить. Попробуй ещё раз или сделай экспорт данных.');
    }
  };

  const onCancel = async () => {
    const ok = await ask({
      title: 'Отменить тренировку?',
      body: 'Введённые подходы этой тренировки будут удалены.',
      confirm: 'Удалить',
      danger: true,
      cancel: 'Назад',
    });
    if (ok === 'confirm') {
      await cancelWorkout();
      stopRest();
    }
  };

  return (
    <div class="screen today">
      <header class="topbar">
        <div class="topbar-row">
          <div>
            <div class="eyebrow">{fmtDate(Date.now())}</div>
            <h1 class="screen-title">
              {w ? 'Идёт тренировка' : day.id === suggested ? 'Следующая по циклу' : 'Вне очереди'}
            </h1>
          </div>
          <div class="week-chip" title="Тренировок на этой неделе">
            <b>{weekCount.value}</b>
            <span>из 3–4</span>
          </div>
        </div>
        <DaySwitcher value={day.id} onChange={setDay} suggested={w ? undefined : suggested} disabled={!!w} />
      </header>

      <InstallHint />
      {loadError.value && <div class="note warn">{loadError.value}</div>}

      <SwipeDays value={day.id} onChange={setDay} enabled={!w}>
        <DayHead day={day} progress={w ? activeProgress.value : undefined}>
          {loaded.value && !w && (
            <div class="dayhead-cta">
              <button type="button" class="btn on-color" onClick={() => startWorkout(day.id)}>
                <Icon name="play" size={18} /> Начать тренировку
              </button>
              {day.id !== suggested && (
                <span class="dayhead-note">По циклу следующая — День {dayIndex(suggested) + 1}</span>
              )}
            </div>
          )}
          {w && (
            <div class="dayhead-cta">
              <span class="dayhead-note">⏱ {fmtDuration(elapsed)}</span>
              <button type="button" class="btn on-color" onClick={() => void onFinish()}>
                <Icon name="check" size={18} /> Завершить
              </button>
            </div>
          )}
        </DayHead>

        {day.groups.map((g) => (
          <section class="group" key={g.name}>
            <div class="group-h">
              <h3>{g.name}</h3>
              <span class={'tag' + (g.optional ? ' opt' : '')}>
                {g.label ?? `${g.exercises.length} упр.`}
              </span>
            </div>
            <div class="ex-grid">
              {g.exercises.map((ex, ei) => {
                // Ищем запись по id — устойчиво, даже если программу поменяли посреди тренировки
                const entryIdx = w?.exercises.findIndex((e) => e.exId === ex.id) ?? -1;
                const entry = w?.exercises[entryIdx];
                const log = w && entry ? { exIdx: entryIdx, entry } : undefined;
                return (
                  <ExerciseCard
                    key={ex.id}
                    ex={ex}
                    num={ei + 1}
                    optional={isOptional(day, ex.id)}
                    log={log}
                    showHints
                  />
                );
              })}
            </div>
          </section>
        ))}

        {w && (
          <div class="finish-zone">
            <button type="button" class="btn primary block" onClick={() => void onFinish()}>
              <Icon name="check" size={18} /> Завершить тренировку
            </button>
            <button type="button" class="btn danger-ghost block" onClick={() => void onCancel()}>
              Отменить тренировку
            </button>
          </div>
        )}
      </SwipeDays>
    </div>
  );
}
