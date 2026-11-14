import { useEffect, useRef } from 'preact/hooks';
import { findExercise } from '../../data/exercises';
import { blink, useProgressive } from '../../lib/motion';
import { t } from '../../i18n';
import { navDir } from '../../state/ui';
import { Icon } from '../components/Icon';
import { Pic } from '../components/Pic';
import { ExerciseFilters, libraryFilter, useExerciseFilter } from '../components/ExerciseFilters';
import { exName, muscleName } from '../labels';

export function Library() {
  const { f, setF, list } = useExerciseFilter(libraryFilter);
  const grid = useRef<HTMLUListElement>(null);
  const first = useRef(true);
  const shown = useProgressive(list.length, navDir.peek() === 'pop');
  // Поиск и фильтры: список обновляется коротким затуханием (без анимации высоты)
  useEffect(() => {
    if (first.current) first.current = false;
    else blink(grid.current);
  }, [list]);
  return (
    <div class="screen library">
      <header class="topbar">
        <div class="eyebrow">{t('library.eyebrow')}</div>
        <h1 class="screen-title">{t('library.title')}</h1>
      </header>
      <ExerciseFilters f={f} setF={setF} idPrefix="lib" />
      <p class="muted small" aria-live="polite">
        {t('library.found', { count: list.length })}
      </p>
      <ul class="lib-grid" ref={grid}>
        {list.slice(0, shown).map((e) => (
          <li key={e.id}>
            <a class="lib-card" href={`#/library/${encodeURIComponent(e.id)}`}>
              <Pic pic={e.pictogram} />
              <span class="lib-txt">
                <b>{exName(e.id)}</b>
                <span class="muted small">{e.primaryMuscles.map(muscleName).join(', ')}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {!list.length && (
        <div class="empty">
          <p>{t('library.nothing')}</p>
        </div>
      )}
    </div>
  );
}

export function LibraryDetail({ id }: { id: string }) {
  const ex = findExercise(id);
  const back = (
    <a class="back" href="#/library">
      <Icon name="back" size={20} /> {t('library.title')}
    </a>
  );
  if (!ex)
    return (
      <div class="screen">
        <header class="topbar">
          {back}
          <h1 class="screen-title sm">{t('library.notFound')}</h1>
        </header>
      </div>
    );
  return (
    <div class="screen lib-detail">
      <header class="topbar">
        {back}
        <h1 class="screen-title sm">{exName(ex.id)}</h1>
      </header>
      <div class="card ex-detail-top">
        <Pic pic={ex.pictogram} live auto />
        <p>{t(ex.descriptionKey)}</p>
        <dl class="facts">
          <div>
            <dt>{t('library.primary')}</dt>
            <dd>{ex.primaryMuscles.map(muscleName).join(', ')}</dd>
          </div>
          {ex.secondaryMuscles.length > 0 && (
            <div>
              <dt>{t('library.secondary')}</dt>
              <dd>{ex.secondaryMuscles.map(muscleName).join(', ')}</dd>
            </div>
          )}
          <div>
            <dt>{t('library.equipment')}</dt>
            <dd>{ex.equipment.map((q) => t(`equip.${q}`)).join(', ')}</dd>
          </div>
          <div>
            <dt>{t('library.type')}</dt>
            <dd>{t(`exType.${ex.type}`)}</dd>
          </div>
        </dl>
      </div>
      <section class="card">
        <h2 class="card-t">{t('ex.technique')}</h2>
        <ol class="cues">
          {ex.cueKeys.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ol>
      </section>
      <section class="card">
        <h2 class="card-t">{t('library.mistakes')}</h2>
        <ul class="cues">
          {ex.mistakeKeys.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      </section>
      <div class="note warn">
        <span aria-hidden="true">⚠️</span>
        <span>
          <b>{t('library.safety')}.</b> {t(ex.safetyKey)}
        </span>
      </div>
      <a class="btn secondary block" href={`#/history/exercise/${encodeURIComponent(ex.id)}`}>
        {t('library.myHistory')}
      </a>
    </div>
  );
}
