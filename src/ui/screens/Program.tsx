import { PROGRAM, dayExerciseCount, daySetCount, findDay, isOptional } from '../../data/program';
import { FOOTER, HERO, RULES, STATS, STOP_SIGNALS, WEEK_FLOW } from '../../data/rules';
import { programDayId } from '../../state/ui';
import { DayHead } from '../components/DayHead';
import { SwipeDays } from '../components/DaySwitcher';
import { ExerciseCard } from '../components/ExerciseCard';

/** Полная программа — повторяет исходную одностраничную версию */
export function Program() {
  const day = findDay(programDayId.value) ?? PROGRAM[0]!;
  const setDay = (id: string) => (programDayId.value = id);

  return (
    <div class="screen program">
      <header class="hero">
        <div class="eyebrow">{HERO.eyebrow}</div>
        <h1>{HERO.title}</h1>
        <p class="lead">{HERO.lead}</p>
        <div class="stats">
          {STATS.map((s) => (
            <div class="stat" key={s.value}>
              <b>{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </header>

      <section>
        <div class="sec-h">
          <h2>Выбери тренировку</h2>
          <span class="eyebrow hide-sm">Листай свайпом</span>
        </div>
        <div class="days" role="tablist" aria-label="Дни программы">
          {PROGRAM.map((d, i) => (
            <button
              type="button"
              key={d.id}
              role="tab"
              aria-selected={d.id === day.id}
              class={'day' + (d.id === day.id ? ' on' : '')}
              style={{ '--dc': `var(--${d.color})`, '--dci': `var(--${d.color}-ink)` }}
              onClick={() => setDay(d.id)}
            >
              <div class="num">День {i + 1}</div>
              <div class="ttl">{d.title}</div>
              <div class="meta">
                {dayExerciseCount(d)} упр. · {daySetCount(d)} подх.
              </div>
              <div class="day-tag">
                <span class={'tag' + (d.status === 'Дополнительная' ? ' opt' : '')}>{d.status}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <SwipeDays value={day.id} onChange={setDay}>
          <DayHead day={day} />
          {day.groups.map((g) => (
            <div class="group" key={g.name}>
              <div class="group-h">
                <h3>{g.name}</h3>
                <span class={'tag' + (g.optional ? ' opt' : '')}>
                  {g.label ?? `${g.exercises.length} упр.`}
                </span>
              </div>
              <div class="ex-grid">
                {g.exercises.map((ex, ei) => (
                  <ExerciseCard key={ex.id} ex={ex} num={ei + 1} optional={isOptional(day, ex.id)} />
                ))}
              </div>
            </div>
          ))}
        </SwipeDays>
      </section>

      <section>
        <div class="sec-h">
          <h2>Правила</h2>
        </div>
        <div class="rules">
          {RULES.map((r) => (
            <div class="rule" key={r.title}>
              <div class="ic" aria-hidden="true">
                {r.icon}
              </div>
              <h3 class="rule-t">{r.title}</h3>
              <p>{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div class="sec-h">
          <h2>Как распределять неделю</h2>
        </div>
        <div class="flow">
          {WEEK_FLOW.map((f) => (
            <div class="rule" key={f.title}>
              <h3 class="rule-t">{f.title}</h3>
              <div class="chain">
                {PROGRAM.slice(0, f.days).map((d, i) => (
                  <span key={d.id} style={{ background: `var(--${d.color}-fill)` }}>
                    День {i + 1}
                  </span>
                ))}
              </div>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
        <div class="note warn">
          <span aria-hidden="true">⚠️</span>
          <span>
            <b>{STOP_SIGNALS.title}</b> {STOP_SIGNALS.text}
          </span>
        </div>
      </section>

      <footer class="foot">
        {FOOTER.before}
        <a href={FOOTER.href} target="_blank" rel="noopener noreferrer">
          {FOOTER.linkText}
        </a>
        {FOOTER.after}
      </footer>
    </div>
  );
}
