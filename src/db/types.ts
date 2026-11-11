/** Один подход. Вес всегда хранится в килограммах. */
export interface SetEntry {
  weight: number | null;
  reps: number | null;
  done: boolean;
  doneAt?: number;
}

export interface WorkoutExercise {
  exId: string;
  skipped: boolean;
  sets: SetEntry[];
}

export interface Workout {
  id: string;
  dayId: string;
  startedAt: number;
  /** null — тренировка ещё идёт */
  finishedAt: number | null;
  exercises: WorkoutExercise[];
}

/** Формат файла экспорта */
export interface BackupFile {
  app: 'training-pwa';
  schema: number;
  exportedAt: string;
  appVersion: string;
  workouts: Workout[];
  active: Workout | null;
  settings: unknown;
}
