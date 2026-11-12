import type { Level } from '../types';

/**
 * Как уровень меняет поведение приложения (docs/CONCEPT.md, раздел 7).
 * Тексты — словари: level.<id> (название), level.desc.<id> (что меняется).
 */
export interface LevelBehavior {
  /** Карточка «Техника» раскрыта по умолчанию */
  techniqueOpen: boolean;
  /** Совет «начни с лёгкого веса» для упражнений без истории (без цифр) */
  lightStartTip: boolean;
  /** При добавлении упражнения в план сразу открыть поля рабочего веса и повторов */
  askWeightOnAdd: boolean;
  /** Поле рабочего веса в плане показано сразу (иначе — по кнопке, не навязываем) */
  showTargetWeight: boolean;
}

export const LEVEL_IDS: Level[] = ['first', 'few', 'intermediate', 'veteran'];

/** Множитель порога предупреждения о весе. Владелец может поменять значения здесь. */
export const WEIGHT_LIMIT_MULTIPLIER: Record<Level, number> = {
  first: 0.6,
  few: 0.8,
  intermediate: 1,
  veteran: 1,
};

const BEGINNER: LevelBehavior = {
  techniqueOpen: true,
  lightStartTip: true,
  askWeightOnAdd: false,
  showTargetWeight: false,
};
const EXPERIENCED: LevelBehavior = {
  techniqueOpen: false,
  lightStartTip: false,
  askWeightOnAdd: true,
  showTargetWeight: true,
};

export const LEVELS: Record<Level, LevelBehavior> = {
  first: BEGINNER,
  few: BEGINNER,
  intermediate: EXPERIENCED,
  veteran: EXPERIENCED,
};

/** Без профиля (онбординг) — как «средний» */
export const levelBehavior = (level: Level | null | undefined): LevelBehavior =>
  LEVELS[level ?? 'intermediate'];

export const isBeginner = (level: Level | null | undefined): boolean => level === 'first' || level === 'few';
