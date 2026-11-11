import { PROGRAM, dayIndex, findDay, findExercise } from '../../data/program';
import type { Workout } from '../../db/types';
import {
  fmtDate,
  fmtDuration,
  fmtNum,
  fmtShortDate,
  fmtTime,
  fmtWeight,
  plural,
  toUnit,
  unitLabel,
} from '../../lib/format';
import { ask, go, toast } from '../../state/ui';
import {
  exerciseSeries,
  history,
  progressionReady,
  removeWorkout,
  weekCount,
  workoutVolume,
} from '../../state/workout';
import { Icon } from '../components/Icon';
import { LineChart } from '../components/LineChart';
import { Pic } from '../components/Pic';

function DayChip({ dayId }: { dayId: string }) {
  const d = findDay(dayId);
  if (!d) return <span class="chip">?</span>;
  return (
    <span class="chip" style={{ background: `var(--${d.color}-fill)` }}>
      День {dayIndex(dayId) + 1}
    </span>
  );
}

function WeekCard() {
  const n = weekCount.value;
  return (
    <div class="card week">
      <div>
        <div class="eyebrow">Эта неделя</div>
        <div class="week-big">
          {n} <span>из 3–4 тренировок</span>
        </div>
      </div>
      <div class="week-dots" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <i key={i} class={i < n ? 'on' : i === 3 ? 'opt' : ''} />
        ))}
      </div>
    </div>
  );
}

export function History() {
  const list = history.value;
  const exIds = new Set(
    list.flatMap((w) => w.exercises.filter((e) => e.sets.some((s) => s.done)).map((e) => e.exId)),
  );

  return (
    <div class="screen history">
      <header class="topbar">
        <div class="eyebrow">Журнал</div>
        <h1 class="screen-title">История</h1>
      </header>

      <WeekCard />

      {!list.length && (
        <div class="empty">
          <p>Здесь появятся завершённые тренировки: дата, длительность и объём.</p>
          <button type="button" class="btn primary" onClick={() => go('today')}>
            К тренировке
          </button>
        </div>
      )}

      {!!list.length && (
        <section>
          <div class="sec-h">
            <h2>Тренировки</h2>
            <span class="eyebrow">
              {list.length} {plural(list.length, 'запись', 'записи', 'записей')}
            </span>
          </div>
          <ul class="list">
            {list.map((w) => (
              <li key={w.id}>
                <a class="row" href={`#/history/workout/${encodeURIComponent(w.id)}`}>
                  <DayChip dayId={w.dayId} />
                  <span class="row-main">
                    <b>{findDay(w.dayId)?.title ?? 'Тренировка'}</b>
                    <span class="muted">
                      {fmtDate(w.startedAt)} · {fmtDuration((w.finishedAt ?? w.startedAt) - w.startedAt)}
                    </span>
                  </span>
                  <span class="row-side">
                    <b>{fmtNum(toUnit(workoutVolume(w)) ?? 0)}</b>
                    <span class="muted">{unitLabel()} объём</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {exIds.size > 0 && (
        <section>
          <div class="sec-h">
            <h2>Прогресс по упражнениям</h2>
          </div>
          {PROGRAM.map((d) => {
            const exs = d.groups.flatMap((g) => g.exercises).filter((e) => exIds.has(e.id));
            if (!exs.length) return null;
            return (
              <div key={d.id} class="ex-links">
                <div class="ex-links-h">
                  <DayChip dayId={d.id} /> {d.title}
                </div>
                <ul class="list">
                  {exs.map((e) => (
                    <li key={e.id}>
                      <a class="row" href={`#/history/exercise/${encodeURIComponent(e.id)}`}>
                        <span class="row-main">
                          <b>{e.name}</b>
                          {progressionReady(e) && <span class="up">Пора добавить вес</span>}
                        </span>
                        <Icon name="chevron" size={18} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function BackBar({ title }: { title: string }) {
  return (
    <header class="topbar">
      <a class="back" href="#/history">
        <Icon name="back" size={20} /> История
      </a>
      <h1 class="screen-title sm">{title}</h1>
    </header>
  );
}

export function WorkoutDetail({ id }: { id: string }) {
  const w: Workout | undefined = history.value.find((x) => x.id === id);
  if (!w) {
    return (
      <div class="screen">
        <BackBar title="Не найдено" />
        <p class="muted">Эта тренировка удалена или ещё не загружена.</p>
      </div>
    );
  }
  const day = findDay(w.dayId);
  const onDelete = async () => {
    const r = await ask({
      title: 'Удалить тренировку?',
      body: `${fmtDate(w.startedAt)} — запись исчезнет из истории и графиков.`,
      confirm: 'Удалить',
      danger: true,
    });
    if (r !== 'confirm') return;
    await removeWorkout(w.id);
    go('history');
    toast('Тренировка удалена');
  };

  return (
    <div class="screen">
      <BackBar title={day?.title ?? 'Тренировка'} />
      <div class="card summary">
        <DayChip dayId={w.dayId} />
        <div class="summary-grid">
          <div>
            <b>{fmtDate(w.startedAt)}</b>
            <span>
              {fmtTime(w.startedAt)}–{fmtTime(w.finishedAt ?? w.startedAt)}
            </span>
          </div>
          <div>
            <b>{fmtDuration((w.finishedAt ?? w.startedAt) - w.startedAt)}</b>
            <span>длительность</span>
          </div>
          <div>
            <b>{fmtWeight(workoutVolume(w))}</b>
            <span>объём</span>
          </div>
        </div>
      </div>
      <ul class="detail">
        {w.exercises.map((e) => {
          const info = findExercise(e.exId);
          const done = e.sets.filter((s) => s.done);
          const sec = info?.ex.unit === 'sec';
          return (
            <li key={e.exId} class={e.skipped || !done.length ? 'dim' : ''}>
              <a href={`#/history/exercise/${encodeURIComponent(e.exId)}`}>{info?.ex.name ?? e.exId}</a>
              <span class="muted">
                {e.skipped
                  ? 'пропущено'
                  : done.length
                    ? done
                        .map((s) =>
                          s.weight != null
                            ? `${fmtNum(toUnit(s.weight) ?? 0)}×${s.reps ?? '—'}${sec ? ' с' : ''}`
                            : `${s.reps ?? '—'}${sec ? ' с' : ''}`,
                        )
                        .join(' · ')
                    : 'не выполнено'}
              </span>
            </li>
          );
        })}
      </ul>
      <button type="button" class="btn danger-ghost block" onClick={() => void onDelete()}>
        <Icon name="trash" size={18} /> Удалить тренировку
      </button>
    </div>
  );
}

export function ExerciseDetail({ id }: { id: string }) {
  const info = findExercise(id);
  if (!info) {
    return (
      <div class="screen">
        <BackBar title="Упражнение не найдено" />
      </div>
    );
  }
  const { ex } = info;
  const pts = exerciseSeries(id);
  const u = unitLabel();
  const withWeight = pts.filter((p) => p.top > 0);

  return (
    <div class="screen">
      <BackBar title={ex.name} />
      <div class="card ex-detail-top">
        <Pic pic={ex.pic} />
        <div class="muted">{ex.focus}</div>
        {progressionReady(ex) && <div class="hint-up">📈 Пора добавить вес</div>}
      </div>

      {withWeight.length > 0 ? (
        <div class="card">
          <h2 class="card-t">Рабочий вес и лучший подход</h2>
          <LineChart
            label={`График веса: ${ex.name}`}
            unit={u}
            dates={withWeight.map((p) => p.t)}
            series={[
              { name: `Рабочий вес, ${u}`, cls: 's1', values: withWeight.map((p) => toUnit(p.top) ?? 0) },
              {
                name: `Лучший подход (расч. 1ПМ), ${u}`,
                cls: 's2',
                values: withWeight.map((p) => Math.round(toUnit(p.best) ?? 0)),
              },
            ]}
          />
        </div>
      ) : (
        <div class="empty">
          <p>
            {pts.length
              ? 'Упражнение выполнялось без веса — график строится по весу.'
              : 'Пока нет данных. Отметь подходы во время тренировки.'}
          </p>
        </div>
      )}

      {pts.length > 0 && (
        <ul class="list">
          {[...pts].reverse().map((p) => (
            <li key={p.t}>
              <div class="row static">
                <span class="row-main">
                  <b>{fmtShortDate(p.t)}</b>
                  <span class="muted">
                    лучший:{' '}
                    {p.bestSet.weight
                      ? `${fmtWeight(p.bestSet.weight)} × ${p.bestSet.reps}`
                      : `${p.bestSet.reps}`}
                  </span>
                </span>
                <span class="row-side">
                  <b>{fmtWeight(p.top)}</b>
                  <span class="muted">рабочий</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
