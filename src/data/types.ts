import type { PicKey } from '../pics/defs';

export type DayColor = 'c1' | 'c2' | 'c3' | 'c4';

export interface Exercise {
  /** Стабильный id: по нему хранится история. Не меняй у существующих упражнений. */
  id: string;
  /** Ключ схемы движения из src/pics/defs.ts */
  pic?: PicKey;
  /** Название */
  name: string;
  /** Рабочих подходов */
  sets: number;
  /** Диапазон повторов (или секунд, если unit = 'sec') */
  reps: [min: number, max: number];
  unit?: 'reps' | 'sec';
  /** «на руку», «на сторону» */
  per?: string;
  /** Целевая мышца / акцент */
  focus: string;
  /** Базовое упражнение: отдых 2–3 мин */
  base?: boolean;
  /** Необязательное: можно пропустить */
  optional?: boolean;
  /** Техника */
  tech: string;
  /** Чем заменить */
  alt?: string;
  /** Ссылка на демонстрацию */
  link?: string;
  /** Дополнительная демонстрация (например, для замены) */
  link2?: { href: string; label: string };
}

export interface Group {
  name: string;
  /** Вся группа по желанию */
  optional?: boolean;
  /** Подпись вместо «N упр.» */
  label?: string;
  exercises: Exercise[];
}

export interface Day {
  id: 'day-1' | 'day-2' | 'day-3' | 'day-4';
  color: DayColor;
  title: string;
  status: 'Основная' | 'Дополнительная';
  intro: string;
  groups: Group[];
}
