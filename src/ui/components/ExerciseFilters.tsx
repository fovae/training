import { useState } from 'preact/hooks';
import {
  EXERCISES,
  USED_EQUIPMENT,
  USED_MUSCLES,
  filterExercises,
  type ExerciseFilter,
} from '../../data/exercises';
import { t } from '../../i18n';
import type { Exercise } from '../../types';
import { exName } from '../labels';

/** Поиск + фильтры по мышцам и оборудованию; общий для библиотеки и выбора упражнения */
export function useExerciseFilter(initial: ExerciseFilter = {}) {
  const [f, setF] = useState<ExerciseFilter>({ query: '', muscle: '', equipment: '', ...initial });
  const list = filterExercises(EXERCISES, f, (e: Exercise) => exName(e.id));
  return { f, setF, list };
}

export function ExerciseFilters({
  f,
  setF,
  idPrefix,
  autofocus,
}: {
  f: ExerciseFilter;
  setF: (f: ExerciseFilter) => void;
  idPrefix: string;
  autofocus?: boolean;
}) {
  return (
    <div class="filters" role="search">
      <label class="sr-only" for={idPrefix + '-q'}>
        {t('library.search')}
      </label>
      <input
        id={idPrefix + '-q'}
        class="text-in search-in"
        type="search"
        autoComplete="off"
        enterKeyHint="search"
        placeholder={t('library.searchPh')}
        value={f.query}
        data-autofocus={autofocus ? true : undefined}
        onInput={(e) => setF({ ...f, query: e.currentTarget.value })}
      />
      <div class="filter-row">
        <label class="select">
          <span class="sr-only">{t('library.muscle')}</span>
          <select
            value={f.muscle ?? ''}
            aria-label={t('library.muscle')}
            onChange={(e) => setF({ ...f, muscle: e.currentTarget.value as ExerciseFilter['muscle'] })}
          >
            <option value="">{t('library.allMuscles')}</option>
            {USED_MUSCLES.map((m) => (
              <option key={m} value={m}>
                {t(`muscle.${m}`)}
              </option>
            ))}
          </select>
        </label>
        <label class="select">
          <span class="sr-only">{t('library.equipment')}</span>
          <select
            value={f.equipment ?? ''}
            aria-label={t('library.equipment')}
            onChange={(e) => setF({ ...f, equipment: e.currentTarget.value as ExerciseFilter['equipment'] })}
          >
            <option value="">{t('library.allEquipment')}</option>
            {USED_EQUIPMENT.map((q) => (
              <option key={q} value={q}>
                {t(`equip.${q}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
