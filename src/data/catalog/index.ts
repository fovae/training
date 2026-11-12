import { PICS as BASE_PICS } from '../../pics/defs';
import { picSvg, type PicDef } from '../../pics/engine';
import type { Exercise } from '../../types';
import { PICS_B1 } from '../../pics/sets/b1';
import { BASE } from './base';
import { B1 } from './b1-chest-back';

/**
 * База упражнений и схем — отдельный ленивый чанк (грузится при запуске вместе с языком,
 * см. loadCatalog в ../exercises.ts). Основной чанк от размера базы не растёт.
 */

export const EXERCISES: Exercise[] = [...BASE, ...B1];

/** id исходных упражнений (этапы 1–2) — для контактного листа и тестов */
export const BASE_IDS: string[] = BASE.map((e) => e.id);

export const PICS: Record<string, PicDef> = { ...BASE_PICS, ...PICS_B1 };

const cache = new Map<string, string>();

/** Готовая SVG-разметка схемы (с кэшем — схемы статичны) */
export function picMarkup(key: string): string | null {
  const def = PICS[key];
  if (!def) return null;
  let s = cache.get(key);
  if (!s) {
    s = picSvg(def);
    cache.set(key, s);
  }
  return s;
}
