import type { Category, Equipment, Exercise, Muscle } from '../types';
import type { PicKey } from '../pics/defs';

/**
 * Библиотека упражнений. Тексты лежат в словарях src/i18n/locales/<lang>/exercises.json
 * под ключом id упражнения: name, desc, cues[], mistakes[], safety.
 * Как добавить упражнение — docs/ARCHITECTURE.md.
 */

interface Spec {
  id: string;
  pic: PicKey;
  category: Category;
  primary: Muscle[];
  secondary?: Muscle[];
  equipment: Equipment[];
  type: Exercise['type'];
  metric?: Exercise['metric'];
  level?: Exercise['levelHint'];
  per?: Exercise['per'];
  cues: number;
  mistakes: number;
  defaults: Exercise['defaults'];
}

const keys = (id: string, part: string, n: number) =>
  Array.from({ length: n }, (_, i) => `ex.${id}.${part}.${i}`);

function make(s: Spec): Exercise {
  return {
    id: s.id,
    nameKey: `ex.${s.id}.name`,
    category: s.category,
    primaryMuscles: s.primary,
    secondaryMuscles: s.secondary ?? [],
    equipment: s.equipment,
    type: s.type,
    metric: s.metric ?? 'weight_reps',
    levelHint: s.level ?? 'beginner',
    pictogram: s.pic,
    descriptionKey: `ex.${s.id}.desc`,
    cueKeys: keys(s.id, 'cues', s.cues),
    mistakeKeys: keys(s.id, 'mistakes', s.mistakes),
    safetyKey: `ex.${s.id}.safety`,
    ...(s.per ? { per: s.per } : {}),
    defaults: s.defaults,
  };
}

const d = (sets: number, repsMin: number, repsMax: number) => ({ sets, repsMin, repsMax });

export const EXERCISES: Exercise[] = [
  // Грудь
  make({
    id: 'incline-db-press',
    pic: 'incline_press',
    category: 'chest',
    primary: ['chest'],
    secondary: ['front-delts', 'triceps'],
    equipment: ['dumbbell', 'bench'],
    type: 'compound',
    cues: 3,
    mistakes: 2,
    defaults: d(3, 8, 12),
  }),
  make({
    id: 'flat-press',
    pic: 'flat_press',
    category: 'chest',
    primary: ['chest'],
    secondary: ['front-delts', 'triceps'],
    equipment: ['machine', 'dumbbell', 'bench'],
    type: 'compound',
    cues: 3,
    mistakes: 2,
    defaults: d(3, 8, 12),
  }),
  make({
    id: 'high-to-low-cable-fly',
    pic: 'cable_fly',
    category: 'chest',
    primary: ['chest'],
    secondary: ['front-delts'],
    equipment: ['cable'],
    type: 'isolation',
    level: 'intermediate',
    cues: 3,
    mistakes: 2,
    defaults: d(3, 10, 15),
  }),
  // Трицепс
  make({
    id: 'rope-pushdown',
    pic: 'pushdown',
    category: 'arms',
    primary: ['triceps'],
    equipment: ['cable'],
    type: 'isolation',
    cues: 3,
    mistakes: 2,
    defaults: d(3, 10, 12),
  }),
  make({
    id: 'overhead-cable-extension',
    pic: 'overhead_ext',
    category: 'arms',
    primary: ['triceps'],
    equipment: ['cable'],
    type: 'isolation',
    level: 'intermediate',
    cues: 3,
    mistakes: 2,
    defaults: d(3, 10, 12),
  }),
  make({
    id: 'single-arm-pushdown',
    pic: 'pushdown',
    category: 'arms',
    primary: ['triceps'],
    equipment: ['cable'],
    type: 'isolation',
    per: 'arm',
    cues: 2,
    mistakes: 2,
    defaults: d(2, 10, 12),
  }),
  // Спина
  make({
    id: 'lat-pulldown',
    pic: 'lat_pulldown',
    category: 'back',
    primary: ['lats'],
    secondary: ['upper-back', 'biceps'],
    equipment: ['cable', 'machine'],
    type: 'compound',
    cues: 3,
    mistakes: 2,
    defaults: d(3, 8, 12),
  }),
  make({
    id: 'seated-cable-row',
    pic: 'cable_row',
    category: 'back',
    primary: ['upper-back', 'lats'],
    secondary: ['biceps', 'rear-delts'],
    equipment: ['cable'],
    type: 'compound',
    cues: 3,
    mistakes: 2,
    defaults: d(3, 8, 12),
  }),
  make({
    id: 'chest-supported-db-row',
    pic: 'chest_row',
    category: 'back',
    primary: ['upper-back'],
    secondary: ['lats', 'rear-delts', 'biceps'],
    equipment: ['dumbbell', 'bench'],
    type: 'compound',
    cues: 3,
    mistakes: 2,
    defaults: d(3, 8, 12),
  }),
  // Бицепс и предплечья
  make({
    id: 'incline-db-curl',
    pic: 'incline_curl',
    category: 'arms',
    primary: ['biceps'],
    equipment: ['dumbbell', 'bench'],
    type: 'isolation',
    cues: 3,
    mistakes: 2,
    defaults: d(3, 8, 12),
  }),
  make({
    id: 'preacher-curl',
    pic: 'preacher',
    category: 'arms',
    primary: ['biceps'],
    equipment: ['machine', 'dumbbell', 'bench'],
    type: 'isolation',
    cues: 2,
    mistakes: 2,
    defaults: d(3, 8, 12),
  }),
  make({
    id: 'hammer-curl',
    pic: 'hammer',
    category: 'arms',
    primary: ['biceps', 'forearms'],
    equipment: ['dumbbell'],
    type: 'isolation',
    cues: 2,
    mistakes: 2,
    defaults: d(2, 10, 12),
  }),
  make({
    id: 'wrist-curl',
    pic: 'wrist_curl',
    category: 'arms',
    primary: ['forearms'],
    equipment: ['dumbbell', 'bench'],
    type: 'isolation',
    cues: 2,
    mistakes: 2,
    defaults: d(2, 12, 15),
  }),
  make({
    id: 'reverse-wrist-curl',
    pic: 'wrist_curl',
    category: 'arms',
    primary: ['forearms'],
    equipment: ['dumbbell', 'bench'],
    type: 'isolation',
    cues: 2,
    mistakes: 2,
    defaults: d(2, 12, 15),
  }),
  // Плечи и трапеция
  make({
    id: 'seated-shoulder-press',
    pic: 'shoulder_press',
    category: 'shoulders',
    primary: ['front-delts', 'side-delts'],
    secondary: ['triceps'],
    equipment: ['dumbbell', 'machine', 'bench'],
    type: 'compound',
    cues: 3,
    mistakes: 2,
    defaults: d(3, 8, 12),
  }),
  make({
    id: 'lateral-raise',
    pic: 'lateral',
    category: 'shoulders',
    primary: ['side-delts'],
    secondary: ['traps'],
    equipment: ['dumbbell'],
    type: 'isolation',
    cues: 3,
    mistakes: 2,
    defaults: d(3, 10, 15),
  }),
  make({
    id: 'reverse-pec-deck',
    pic: 'rear_fly',
    category: 'shoulders',
    primary: ['rear-delts'],
    secondary: ['upper-back'],
    equipment: ['machine'],
    type: 'isolation',
    cues: 2,
    mistakes: 2,
    defaults: d(3, 10, 15),
  }),
  make({
    id: 'db-shrug',
    pic: 'shrug',
    category: 'shoulders',
    primary: ['traps'],
    secondary: ['forearms'],
    equipment: ['dumbbell'],
    type: 'isolation',
    cues: 2,
    mistakes: 2,
    defaults: d(3, 10, 12),
  }),
  make({
    id: 'incline-y-raise',
    pic: 'y_raise',
    category: 'shoulders',
    primary: ['traps'],
    secondary: ['rear-delts', 'side-delts'],
    equipment: ['dumbbell', 'bench'],
    type: 'isolation',
    level: 'intermediate',
    cues: 3,
    mistakes: 2,
    defaults: d(2, 12, 15),
  }),
  // Пресс и кор
  make({
    id: 'cable-crunch',
    pic: 'cable_crunch',
    category: 'core',
    primary: ['abs'],
    equipment: ['cable'],
    type: 'isolation',
    cues: 2,
    mistakes: 2,
    defaults: d(3, 12, 15),
  }),
  make({
    id: 'hanging-knee-raise',
    pic: 'knee_raise',
    category: 'core',
    primary: ['abs'],
    secondary: ['obliques', 'forearms'],
    equipment: ['pullup-bar', 'dip-station'],
    type: 'isolation',
    metric: 'reps',
    level: 'intermediate',
    cues: 3,
    mistakes: 2,
    defaults: d(3, 10, 15),
  }),
  make({
    id: 'side-plank',
    pic: 'side_plank',
    category: 'core',
    primary: ['obliques'],
    secondary: ['deep-core'],
    equipment: ['bodyweight'],
    type: 'isolation',
    metric: 'time',
    per: 'side',
    cues: 2,
    mistakes: 2,
    defaults: d(2, 20, 40),
  }),
  make({
    id: 'pallof-press',
    pic: 'pallof',
    category: 'core',
    primary: ['obliques', 'deep-core'],
    equipment: ['cable', 'band'],
    type: 'isolation',
    per: 'side',
    cues: 3,
    mistakes: 2,
    defaults: d(2, 10, 12),
  }),
  make({
    id: 'dead-bug',
    pic: 'dead_bug',
    category: 'core',
    primary: ['deep-core'],
    secondary: ['abs'],
    equipment: ['bodyweight'],
    type: 'isolation',
    metric: 'reps',
    per: 'side',
    cues: 3,
    mistakes: 2,
    defaults: d(2, 8, 12),
  }),
  // Ноги
  make({
    id: 'leg-press',
    pic: 'leg_press',
    category: 'legs',
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings'],
    equipment: ['machine'],
    type: 'compound',
    cues: 3,
    mistakes: 2,
    defaults: d(3, 10, 12),
  }),
  make({
    id: 'leg-curl',
    pic: 'leg_curl',
    category: 'legs',
    primary: ['hamstrings'],
    equipment: ['machine'],
    type: 'isolation',
    cues: 2,
    mistakes: 2,
    defaults: d(3, 10, 15),
  }),
  make({
    id: 'calf-raise',
    pic: 'calf',
    category: 'legs',
    primary: ['calves'],
    equipment: ['machine', 'dumbbell', 'bodyweight'],
    type: 'isolation',
    cues: 2,
    mistakes: 2,
    defaults: d(3, 12, 15),
  }),
];

const INDEX = new Map(EXERCISES.map((e) => [e.id, e]));

export const findExercise = (id: string): Exercise | undefined => INDEX.get(id);

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
  'quads',
  'hamstrings',
  'glutes',
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
];

/** Мышцы и оборудование, которые реально встречаются в базе — для фильтров */
export const USED_MUSCLES = MUSCLES.filter((m) =>
  EXERCISES.some((e) => e.primaryMuscles.includes(m) || e.secondaryMuscles.includes(m)),
);
export const USED_EQUIPMENT = EQUIPMENT.filter((q) => EXERCISES.some((e) => e.equipment.includes(q)));

export interface ExerciseFilter {
  /** Уже нормализованный запрос (нижний регистр) */
  query?: string;
  muscle?: Muscle | '';
  equipment?: Equipment | '';
}

/** name — переведённое название; поиск идёт по нему и по id */
export function filterExercises(
  list: Exercise[],
  f: ExerciseFilter,
  name: (e: Exercise) => string,
): Exercise[] {
  const q = (f.query ?? '').trim().toLocaleLowerCase();
  return list.filter((e) => {
    if (f.muscle && !e.primaryMuscles.includes(f.muscle) && !e.secondaryMuscles.includes(f.muscle))
      return false;
    if (f.equipment && !e.equipment.includes(f.equipment)) return false;
    if (!q) return true;
    return name(e).toLocaleLowerCase().includes(q) || e.id.includes(q);
  });
}
