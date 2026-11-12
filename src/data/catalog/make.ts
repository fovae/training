import type { Category, Equipment, Exercise, Muscle } from '../../types';

/**
 * Запись упражнения. Тексты лежат в словарях src/i18n/locales/<lang>/exercises.json
 * под ключом ex.<id>: name, desc, cues[], mistakes[], safety.
 * cues / mistakes — сколько строк в словаре (npm run i18n:check сверяет).
 */
export interface Spec {
  id: string;
  /** Ключ схемы: src/pics/defs.ts (исходные) или src/pics/sets/*.ts (генератор) */
  pic: string;
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

export function make(s: Spec): Exercise {
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

export const d = (sets: number, repsMin: number, repsMax: number) => ({ sets, repsMin, repsMax });
