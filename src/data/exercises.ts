import { signal } from '@preact/signals';
import type { Equipment, Exercise, Muscle } from '../types';

/**
 * Доступ к базе упражнений. Сами записи и схемы — в ленивом чанке ./catalog
 * (≈120 упражнений): loadCatalog() вызывается при запуске (state/app.ts) параллельно с базой
 * данных и словарём, интерфейс рисуется после него. До загрузки findExercise возвращает undefined.
 * Как добавить упражнение — docs/ARCHITECTURE.md.
 */

type Catalog = typeof import('./catalog');

let cat: Catalog | null = null;
let index = new Map<string, Exercise>();
let loading: Promise<void> | null = null;

export const catalogReady = signal(false);

export function loadCatalog(): Promise<void> {
  loading ??= import('./catalog').then((m) => {
    cat = m;
    index = new Map(m.EXERCISES.map((e) => [e.id, e]));
    used = null;
    catalogReady.value = true;
  });
  return loading;
}

export const allExercises = (): Exercise[] => cat?.EXERCISES ?? [];

export const findExercise = (id: string): Exercise | undefined => index.get(id);

/** SVG-разметка схемы; null — схемы нет (или база ещё не загружена) */
export const picMarkup = (key: string): string | null => cat?.picMarkup(key) ?? null;

export const MUSCLES: Muscle[] = [
  'chest',
  'lats',
  'upper-back',
  'traps',
  'front-delts',
  'side-delts',
  'rear-delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'deep-core',
  'lower-back',
  'hip-flexors',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'calves',
];

export const EQUIPMENT: Equipment[] = [
  'bodyweight',
  'dumbbell',
  'barbell',
  'machine',
  'cable',
  'kettlebell',
  'band',
  'bench',
  'pullup-bar',
  'dip-station',
  'jump-rope',
];

let used: { muscles: Muscle[]; equipment: Equipment[] } | null = null;

/** Мышцы и оборудование, которые реально встречаются в базе — для фильтров */
function usedLists() {
  if (!used) {
    const list = allExercises();
    used = {
      muscles: MUSCLES.filter((m) =>
        list.some((e) => e.primaryMuscles.includes(m) || e.secondaryMuscles.includes(m)),
      ),
      equipment: EQUIPMENT.filter((q) => list.some((e) => e.equipment.includes(q))),
    };
  }
  return used;
}
export const usedMuscles = (): Muscle[] => usedLists().muscles;
export const usedEquipment = (): Equipment[] => usedLists().equipment;

export interface ExerciseFilter {
  /** Уже нормализованный запрос (нижний регистр) */
  query?: string;
  muscle?: Muscle | '';
  equipment?: Equipment | '';
}

/** Без учёта регистра и «ё/е» — «жим», «Жим», «приседания» ≈ «приседания» */
const norm = (s: string) => s.toLocaleLowerCase().replace(/ё/g, 'е');

/** name — переведённое название; поиск идёт по нему и по id. Все слова запроса должны найтись. */
export function filterExercises(
  list: Exercise[],
  f: ExerciseFilter,
  name: (e: Exercise) => string,
): Exercise[] {
  const words = norm(f.query ?? '')
    .split(/\s+/)
    .filter(Boolean);
  return list.filter((e) => {
    if (f.muscle && !e.primaryMuscles.includes(f.muscle) && !e.secondaryMuscles.includes(f.muscle))
      return false;
    if (f.equipment && !e.equipment.includes(f.equipment)) return false;
    if (!words.length) return true;
    const hay = norm(name(e)) + ' ' + e.id;
    return words.every((w) => hay.includes(w));
  });
}
