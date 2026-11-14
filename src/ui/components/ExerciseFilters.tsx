import { signal, type Signal } from '@preact/signals';
import { useMemo, useState } from 'preact/hooks';
import {
  allExercises,
  filterExercises,
  usedEquipment,
  usedMuscles,
  type ExerciseFilter,
} from '../../data/exercises';
import { locale } from '../../i18n';
import { t } from '../../i18n';
import type { Exercise } from '../../types';
import { exName } from '../labels';
import { Select } from './Select';

const EMPTY: ExerciseFilter = { query: '', muscle: '', equipment: '' };

/**
 * Фильтр экрана «Упражнения» живёт дольше самого экрана: после просмотра упражнения и «Назад»
 * выбранные группа мышц, оборудование и поиск остаются (до перезапуска приложения).
 */
export const libraryFilter = signal<ExerciseFilter>(EMPTY);

/** Полный сброс данных: поиск и фильтры экрана «Упражнения» — тоже к началу */
export function resetLibraryFilter(): void {
  libraryFilter.value = EMPTY;
}

/**
 * Поиск + фильтры по мышцам и оборудованию; общий для библиотеки и выбора упражнения.
 * `keep` — где хранить фильтр между открытиями экрана; без него фильтр свой у каждого открытия.
 */
export function useExerciseFilter(keep?: Signal<ExerciseFilter>) {
  const [own, setOwn] = useState<ExerciseFilter>(EMPTY);
  const f = keep ? keep.value : own;
  const setF: (v: ExerciseFilter) => void = keep
    ? (v) => {
        keep.value = v;
      }
    : setOwn;
  const lang = locale.value;
  // ~250 записей: фильтр дешёвый, но не пересчитываем его на каждый рендер без нужды
  const list = useMemo(
    () => filterExercises(allExercises(), f, (e: Exercise) => exName(e.id)),
    [f.query, f.muscle, f.equipment, lang],
  );
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
        <Select
          label={t('library.muscle')}
          value={f.muscle ?? ''}
          onChange={(v) => setF({ ...f, muscle: v as ExerciseFilter['muscle'] })}
          options={[
            { value: '', label: t('library.allMuscles') },
            ...usedMuscles().map((m) => ({ value: m, label: t(`muscle.${m}`) })),
          ]}
        />
        <Select
          label={t('library.equipment')}
          value={f.equipment ?? ''}
          onChange={(v) => setF({ ...f, equipment: v as ExerciseFilter['equipment'] })}
          options={[
            { value: '', label: t('library.allEquipment') },
            ...usedEquipment().map((q) => ({ value: q, label: t(`equip.${q}`) })),
          ]}
        />
      </div>
    </div>
  );
}
