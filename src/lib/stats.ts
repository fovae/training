import { findExercise } from '../data/exercises';
import type { Session } from '../types';

/** Статистика для «Истории». Чистые функции; только числа и даты — никаких серий и наград. */

const DAY = 86_400_000;

/** Понедельник 00:00 (локальное время) для даты */
export function mondayOf(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function sessionVolumeKg(s: Session): number {
  let v = 0;
  for (const e of s.entries) {
    if (e.skipped || findExercise(e.exerciseId)?.metric === 'time') continue;
    for (const x of e.sets) if (x.done && x.weightKg && x.reps) v += x.weightKg * x.reps;
  }
  return v;
}

export interface WeekStat {
  /** Понедельник недели, мс */
  start: number;
  workouts: number;
  /** Суммарный объём (вес × повторы), кг */
  volumeKg: number;
  /** Время тренировок (от старта до завершения), минуты */
  minutes: number;
}

/** Последние `weeks` недель, старые первыми; завершённые тренировки по дате окончания */
export function weeklyStats(sessions: Session[], now: number, weeks = 10): WeekStat[] {
  const thisWeek = mondayOf(now);
  const out: WeekStat[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    // через setDate, чтобы не сбиться на переходе на летнее время
    const d = new Date(thisWeek);
    d.setDate(d.getDate() - 7 * i);
    out.push({ start: d.getTime(), workouts: 0, volumeKg: 0, minutes: 0 });
  }
  const first = out[0]!.start;
  for (const s of sessions) {
    if (!s.endedAt) continue;
    const t = Date.parse(s.endedAt);
    if (t < first || t > now + DAY) continue;
    const w = out.find((x, i) => t >= x.start && (i === out.length - 1 || t < out[i + 1]!.start));
    if (!w) continue;
    w.workouts++;
    w.volumeKg += sessionVolumeKg(s);
    // забытая открытой тренировка (больше 6 часов) не раздувает график
    w.minutes += Math.min(360, Math.max(0, (t - Date.parse(s.startedAt)) / 60000));
  }
  return out.map((w) => ({ ...w, volumeKg: Math.round(w.volumeKg), minutes: Math.round(w.minutes) }));
}

export interface Record_ {
  value: number;
  /** Вес подхода, кг (для повторов и объёма) */
  weightKg: number;
  reps: number;
  at: string;
}

export interface ExerciseRecords {
  maxWeight: Record_ | null;
  maxReps: Record_ | null;
  /** Лучший подход по объёму: вес × повторы */
  maxSetVolume: Record_ | null;
}

/** Рекорды по упражнению из выполненных подходов */
export function exerciseRecords(sessions: Session[], exerciseId: string): ExerciseRecords {
  const r: ExerciseRecords = { maxWeight: null, maxReps: null, maxSetVolume: null };
  const time = findExercise(exerciseId)?.metric === 'time';
  for (const s of sessions) {
    for (const e of s.entries) {
      if (e.exerciseId !== exerciseId || e.skipped) continue;
      for (const x of e.sets) {
        if (!x.done) continue;
        const w = x.weightKg ?? 0;
        const reps = (time ? x.seconds : x.reps) ?? 0;
        const rec = (value: number): Record_ => ({ value, weightKg: w, reps, at: s.startedAt });
        if (w > 0 && (!r.maxWeight || w > r.maxWeight.value)) r.maxWeight = rec(w);
        if (reps > 0 && (!r.maxReps || reps > r.maxReps.value)) r.maxReps = rec(reps);
        const vol = w * reps;
        if (!time && vol > 0 && (!r.maxSetVolume || vol > r.maxSetVolume.value)) r.maxSetVolume = rec(vol);
      }
    }
  }
  return r;
}
