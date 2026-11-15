import { signal } from '@preact/signals';
import type { Equipment, Exercise, Muscle } from '../types';
import { makeDoc, makeLexicon, rankByQuery, type SearchFields, type TagLexicon } from './search';

/**
 * Доступ к базе упражнений. Сами записи и схемы — в ленивом чанке ./catalog
 * (≈250 упражнений): loadCatalog() вызывается при запуске (state/app.ts) параллельно с базой
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
  /** Текст поиска как набран */
  query?: string;
  muscle?: Muscle | '';
  equipment?: Equipment | '';
}

const splitList = (s: string | undefined): string[] => (s ? s.split(/\s*,\s*/).filter(Boolean) : []);

/** Синонимы и сленг упражнения для поиска (src/data/catalog/aliases.ts) */
export function exerciseAliases(id: string, lang: 'ru' | 'en'): string[] {
  return splitList(cat?.ALIASES[id]?.[lang === 'ru' ? 0 : 1]);
}

/** Синонимы мышцы или инвентаря для поиска: «бицуха», «турник»… */
export function tagSynonyms(tag: Muscle | Equipment, lang: 'ru' | 'en'): string[] {
  return splitList(cat?.TAG_SYNONYMS[tag]?.[lang === 'ru' ? 0 : 1]);
}

/**
 * Что ищется у упражнения: название на языке интерфейса, синонимы на русском или английском
 * (по языку), английские синонимы и id (на остальных языках тоже), мышцы и инвентарь с
 * разговорными названиями. labels — подписи на языке интерфейса.
 */
export type SearchFieldsFn = ((e: Exercise) => SearchFields) & {
  /** Словарь мышц и инвентаря на этом языке — для уровней поиска (src/data/search.ts) */
  lexicon: () => TagLexicon;
};

export function exerciseSearchFields(
  lang: string,
  labels: { name: (id: string) => string; muscle: (m: Muscle) => string; equip: (q: Equipment) => string },
): SearchFieldsFn {
  const own = lang === 'ru' ? 'ru' : 'en';
  const tag = (label: string, syn: string[]) => [label, ...syn].join(', ');
  const muscle = (m: Muscle) => tag(labels.muscle(m), tagSynonyms(m, own));
  const lexicon = () => {
    let lx = lexicons.get(lang);
    if (!lx) {
      const ids = Object.keys(cat?.TAG_SYNONYMS ?? {}) as (Muscle | Equipment)[];
      const muscles = new Set<string>(MUSCLES);
      lx = makeLexicon(
        ids.map((id) => {
          const m = muscles.has(id);
          const label = m ? labels.muscle(id as Muscle) : labels.equip(id as Equipment);
          // английские названия мышц понимаются на всех языках («biceps», «back»)
          return { id, muscle: m, names: [label, ...tagSynonyms(id, own), ...tagSynonyms(id, 'en')] };
        }),
      );
      if (cat) lexicons.set(lang, lx);
    }
    return lx;
  };
  const fn = (e: Exercise): SearchFields => ({
    name: labels.name(e.id),
    alt: lang === 'ru' || lang === 'en' ? exerciseAliases(e.id, own) : [],
    en: [e.id.replace(/-/g, ' '), ...(lang === 'en' ? [] : exerciseAliases(e.id, 'en'))],
    tags: [
      ...e.primaryMuscles.map(muscle),
      ...e.equipment.map((q) => tag(labels.equip(q), tagSynonyms(q, own))),
    ],
    minor: e.secondaryMuscles.map(muscle),
    order: catalogIndex().get(e.id) ?? 0,
    primaryIds: e.primaryMuscles,
    equipIds: e.equipment,
    minorIds: e.secondaryMuscles,
  });
  return Object.assign(fn, { lexicon });
}

const lexicons = new Map<string, TagLexicon>();

/** Постоянный порядок каталога: базовые упражнения раньше вариаций */
let catIndex: Map<string, number> | null = null;
const catalogIndex = (): Map<string, number> => {
  if (!catIndex && cat) catIndex = new Map(cat.EXERCISES.map((e, i) => [e.id, i]));
  return catIndex ?? new Map();
};

/**
 * Отбор по мышце и оборудованию + поиск (src/data/search.ts): опечатки, словоформы, синонимы,
 * раскладка. С запросом — по убыванию релевантности, без запроса — порядок каталога / по мышце.
 * `fields` — что искать у упражнения (название на языке интерфейса, синонимы, мышцы…).
 */
export function filterExercises(
  list: Exercise[],
  f: ExerciseFilter,
  fields: ((e: Exercise) => SearchFields) & { lexicon?: () => TagLexicon },
  /** Ключ кэша поисковых записей (язык): записи строятся один раз на язык */
  cacheKey?: string,
): Exercise[] {
  let out = list.filter((e) => {
    if (f.muscle && !e.primaryMuscles.includes(f.muscle) && !e.secondaryMuscles.includes(f.muscle))
      return false;
    if (f.equipment && !e.equipment.includes(f.equipment)) return false;
    return true;
  });
  if (f.muscle) out = sortByMuscle(out, f.muscle);
  const q = (f.query ?? '').trim();
  if (!q) return out;
  const doc = (e: Exercise) => {
    if (cacheKey === undefined) return makeDoc(fields(e));
    const k = cacheKey + '\n' + e.id;
    let d = docs.get(k);
    if (!d) docs.set(k, (d = makeDoc(fields(e))));
    return d;
  };
  const m = f.muscle;
  return rankByQuery(out, q, doc, {
    lexicon: fields.lexicon?.(),
    // выбран фильтр мышцы: при равенстве — где она главная, затем основная, затем второстепенная
    tiebreak: m ? (e) => muscleRank(e, m) : undefined,
  });
}

const docs = new Map<string, ReturnType<typeof makeDoc>>();

/**
 * Порядок при выбранной группе мышц: сначала упражнения, где она главная (первая в основных),
 * затем — где она одна из основных, затем — где второстепенная, и дальше по месту в списке
 * второстепенных. Внутри одного уровня — прежний порядок каталога (сортировка устойчивая).
 */
function muscleRank(e: Exercise, m: Muscle): number {
  const p = e.primaryMuscles.indexOf(m);
  if (p >= 0) return p === 0 ? 0 : 1;
  const s = e.secondaryMuscles.indexOf(m);
  return s >= 0 ? 2 + s : 99;
}

function sortByMuscle(list: Exercise[], m: Muscle): Exercise[] {
  return list
    .map((e, i) => ({ e, i, r: muscleRank(e, m) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.e);
}
