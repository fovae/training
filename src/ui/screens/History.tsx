import { findExercise } from '../../data/exercises';
import { adviceFor } from '../../advice';
import { fmtDate, fmtNum, fmtShortDate, fmtTime, t } from '../../i18n';
import { fmtDuration, fmtWeight, ms, toUnit, unitLabel } from '../../lib/format';
import { dayColor, findDay, plan } from '../../state/plan';
import { ask, go, toast } from '../../state/ui';
import {
  exerciseSeries,
  history,
  removeSession,
  sessionVolume,
  targetFor,
  weekCount,
} from '../../state/session';
import type { Session } from '../../types';
import { Icon } from '../components/Icon';
import { LineChart } from '../components/LineChart';
import { Pic } from '../components/Pic';
import { fmtSets } from '../components/ExerciseCard';
import { dayNumber, dayTitleById, exName, muscleName } from '../labels';

function DayChip({ dayId }: { dayId: string }) {
  if (!findDay(dayId)) return <span class="chip neutral">—</span>;
  return (
    <span class="chip" style={{ background: `var(--${dayColor(dayId)}-fill)` }}>
      {dayNumber(dayId)}
    </span>
  );
}

const sessionTitle = (s: Session) => (findDay(s.dayId) ? dayTitleById(s.dayId) : t('history.workout'));
const duration = (s: Session) => ms(s.endedAt ?? s.startedAt) - ms(s.startedAt);

function WeekCard() {
  const n = weekCount.value;
  const goal = plan.value?.days.length ?? 0;
  return (
    <div class="card week">
      <div>
        <div class="eyebrow">{t('history.thisWeek')}</div>
        <div class="week-big">
          {n} <span>{t('history.ofWorkouts', { count: goal, n: goal })}</span>
        </div>
      </div>
      <div class="week-dots" aria-hidden="true">
        {Array.from({ length: goal }, (_, i) => (
          <i key={i} class={i < n ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}

export function History() {
  const list = history.value;
  const exIds = [
    ...new Set(
      list.flatMap((s) => s.entries.filter((e) => e.sets.some((x) => x.done)).map((e) => e.exerciseId)),
    ),
  ];

  return (
    <div class="screen history">
      <header class="topbar">
        <div class="eyebrow">{t('history.eyebrow')}</div>
        <h1 class="screen-title">{t('history.title')}</h1>
      </header>

      <WeekCard />

      {!list.length && (
        <div class="empty">
          <p>{t('history.empty')}</p>
          <button type="button" class="btn primary" onClick={() => go('today')}>
            {t('history.toWorkout')}
          </button>
        </div>
      )}

      {!!list.length && (
        <section>
          <div class="sec-h">
            <h2>{t('history.workouts')}</h2>
            <span class="eyebrow">{t('history.records', { count: list.length })}</span>
          </div>
          <ul class="list">
            {list.map((s) => (
              <li key={s.id}>
                <a class="row" href={`#/history/workout/${encodeURIComponent(s.id)}`}>
                  <DayChip dayId={s.dayId} />
                  <span class="row-main">
                    <b>{sessionTitle(s)}</b>
                    <span class="muted">
                      {fmtDate(ms(s.startedAt))} · {fmtDuration(duration(s))}
                    </span>
                  </span>
                  <span class="row-side">
                    <b>{fmtNum(toUnit(sessionVolume(s)) ?? 0)}</b>
                    <span class="muted">{t('history.volumeUnit', { unit: unitLabel() })}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {exIds.length > 0 && (
        <section>
          <div class="sec-h">
            <h2>{t('history.byExercise')}</h2>
          </div>
          <ul class="list">
            {exIds.map((id) => (
              <li key={id}>
                <a class="row" href={`#/history/exercise/${encodeURIComponent(id)}`}>
                  <span class="row-main">
                    <b>{exName(id)}</b>
                  </span>
                  <Icon name="chevron" size={18} />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function BackBar({ title }: { title: string }) {
  return (
    <header class="topbar">
      <a class="back" href="#/history">
        <Icon name="back" size={20} /> {t('history.title')}
      </a>
      <h1 class="screen-title sm">{title}</h1>
    </header>
  );
}

export function WorkoutDetail({ id }: { id: string }) {
  const s = history.value.find((x) => x.id === id);
  if (!s) {
    return (
      <div class="screen">
        <BackBar title={t('history.notFound')} />
        <p class="muted">{t('history.notFoundText')}</p>
      </div>
    );
  }
  const started = ms(s.startedAt);
  const onDelete = async () => {
    const r = await ask({
      title: t('history.deleteTitle'),
      body: t('history.deleteBody', { date: fmtDate(started) }),
      confirm: t('common.delete'),
      danger: true,
    });
    if (r !== 'confirm') return;
    await removeSession(s.id);
    go('history');
    toast(t('history.deleted'));
  };

  return (
    <div class="screen">
      <BackBar title={sessionTitle(s)} />
      <div class="card summary">
        <DayChip dayId={s.dayId} />
        <div class="summary-grid">
          <div>
            <b>{fmtDate(started)}</b>
            <span>
              {fmtTime(started)}–{fmtTime(ms(s.endedAt ?? s.startedAt))}
            </span>
          </div>
          <div>
            <b>{fmtDuration(duration(s))}</b>
            <span>{t('history.duration')}</span>
          </div>
          <div>
            <b>{fmtWeight(sessionVolume(s))}</b>
            <span>{t('history.volume')}</span>
          </div>
        </div>
        {s.note && <p class="session-note">{s.note}</p>}
      </div>
      <ul class="detail">
        {s.entries.map((e, i) => {
          const ex = findExercise(e.exerciseId);
          const txt = fmtSets(e.sets, ex);
          return (
            <li key={e.exerciseId + i} class={e.skipped || !txt ? 'dim' : ''}>
              <a href={`#/history/exercise/${encodeURIComponent(e.exerciseId)}`}>{exName(e.exerciseId)}</a>
              <span class="muted">{e.skipped ? t('ex.skipped') : txt || t('history.notDone')}</span>
              {e.note && <span class="entry-note">{e.note}</span>}
            </li>
          );
        })}
      </ul>
      <button type="button" class="btn danger-ghost block" onClick={() => void onDelete()}>
        <Icon name="trash" size={18} /> {t('history.delete')}
      </button>
    </div>
  );
}

export function ExerciseDetail({ id }: { id: string }) {
  const ex = findExercise(id);
  const name = exName(id);
  const pts = exerciseSeries(id);
  const u = unitLabel();
  const withWeight = pts.filter((p) => p.top > 0);
  const isTime = ex?.metric === 'time';
  const advice = adviceFor(targetFor(history.value[0]?.dayId ?? '', id));

  return (
    <div class="screen">
      <BackBar title={name} />
      <div class="card ex-detail-top">
        <Pic pic={ex?.pictogram} />
        {ex && <div class="muted">{ex.primaryMuscles.map(muscleName).join(', ')}</div>}
        {advice.map((a) => (
          <div class="hint-up" key={a.id}>
            📈 {t(a.textKey)}
          </div>
        ))}
        {ex && (
          <a class="more" href={`#/library/${encodeURIComponent(id)}`}>
            {t('ex.fullCard')} <Icon name="chevron" size={14} />
          </a>
        )}
      </div>

      {withWeight.length > 0 ? (
        <div class="card">
          <h2 class="card-t">{t('history.chartTitle')}</h2>
          <LineChart
            label={t('history.chartLabel', { name })}
            unit={u}
            dates={withWeight.map((p) => p.t)}
            series={[
              {
                name: t('history.seriesTop', { unit: u }),
                cls: 's1',
                values: withWeight.map((p) => toUnit(p.top) ?? 0),
              },
              {
                name: t('history.seriesBest', { unit: u }),
                cls: 's2',
                values: withWeight.map((p) => Math.round(toUnit(p.best) ?? 0)),
              },
            ]}
          />
        </div>
      ) : (
        <div class="empty">
          <p>{pts.length ? t('history.noWeight') : t('history.noData')}</p>
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
                    {t('history.best')}{' '}
                    {isTime
                      ? `${p.bestSet.reps} ${t('unit.sec')}`
                      : p.bestSet.weight
                        ? `${fmtWeight(p.bestSet.weight)} × ${p.bestSet.reps}`
                        : `${p.bestSet.reps}`}
                  </span>
                </span>
                {!isTime && (
                  <span class="row-side">
                    <b>{fmtWeight(p.top)}</b>
                    <span class="muted">{t('history.working')}</span>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
