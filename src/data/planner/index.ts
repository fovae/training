import type { Equipment, Exercise, Muscle } from '../../types';

/**
 * Данные помощника «Собрать за меня» (docs/ARCHITECTURE.md, «Помощник»). Только константы:
 * алгоритм — src/lib/planner, состояние и экран — src/state/planner.ts, ui/screens/Planner.tsx.
 * Подборка по правилам, без ИИ и сети, без «целей» и обещаний результата. Согласованность с
 * каталогом (каждый id существует) проверяет tests/e2e/planner.unit.spec.ts.
 */

// ---------- группы мышц мастера ----------

/** Группы, из которых человек выбирает приоритеты (до 4) — подписи planner.group.<id> */
export const GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
] as const;
export type Group = (typeof GROUPS)[number];

/** Мышцы каталога в группе (названия и синонимы мышц — общий словарь поиска, catalog/aliases.ts) */
export const GROUP_MUSCLES: Record<Group, Muscle[]> = {
  chest: ['chest'],
  back: ['lats', 'upper-back', 'traps', 'lower-back'],
  shoulders: ['front-delts', 'side-delts', 'rear-delts'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearms'],
  abs: ['abs', 'obliques', 'deep-core'],
  glutes: ['glutes', 'abductors', 'adductors'],
  quads: ['quads'],
  hamstrings: ['hamstrings'],
  calves: ['calves'],
};

/** Разделы мастера: «Руки» и «Ноги» раскрываются в свои мышцы */
export const GROUP_SECTIONS: { key: 'upper' | 'arms' | 'legs' | 'core'; groups: Group[] }[] = [
  { key: 'upper', groups: ['chest', 'back', 'shoulders'] },
  { key: 'arms', groups: ['biceps', 'triceps', 'forearms'] },
  { key: 'legs', groups: ['glutes', 'quads', 'hamstrings', 'calves'] },
  { key: 'core', groups: ['abs'] },
];

/** Крупные группы — первыми в дне и первыми получают второе упражнение */
export const BIG_GROUPS: Group[] = ['quads', 'back', 'chest', 'hamstrings', 'glutes', 'shoulders'];

export const MAX_PRIORITIES = 4;

// ---------- место и инвентарь ----------

export type Place = 'gym' | 'home' | 'outdoor';

/** Что можно отметить в мастере (вес тела есть всегда) */
export const EQUIPMENT_CHOICES: Equipment[] = [
  'dumbbell',
  'barbell',
  'machine',
  'cable',
  'pullup-bar',
  'dip-station',
  'bench',
  'band',
  'kettlebell',
  'jump-rope',
];

/** Набор по месту и быстрые пресеты для дома */
export const PLACE_EQUIPMENT: Record<Place, Equipment[]> = {
  gym: [
    'dumbbell',
    'barbell',
    'machine',
    'cable',
    'pullup-bar',
    'dip-station',
    'bench',
    'band',
    'kettlebell',
  ],
  home: [],
  outdoor: ['pullup-bar', 'dip-station', 'jump-rope'],
};
export const HOME_PRESETS: { key: 'nothing' | 'dumbbells' | 'bands'; equipment: Equipment[] }[] = [
  { key: 'nothing', equipment: [] },
  { key: 'dumbbells', equipment: ['dumbbell', 'bench'] },
  { key: 'bands', equipment: ['band'] },
];

/**
 * Можно ли сделать упражнение с этим инвентарём. Список equipment у упражнения — варианты
 * («гантели или тренажёр»); скамья нужна, только если без неё не обойтись (свободный вес + скамья),
 * а «вес тела» в списке значит, что упражнение делается и без снаряда.
 */
export function available(ex: Pick<Exercise, 'equipment'>, have: ReadonlySet<Equipment>): boolean {
  const eq = ex.equipment;
  if (eq.includes('bodyweight')) return true;
  const tools = eq.filter((q) => q !== 'bench');
  if (!tools.length) return have.has('bench');
  return tools.some((q) => {
    if (!have.has(q)) return false;
    // тренажёр или блок — со своей скамьёй / сиденьем
    if (q === 'machine' || q === 'cable') return true;
    return !eq.includes('bench') || have.has('bench');
  });
}

// ---------- роли ----------

export type Role = 'main' | 'accessory' | 'isolation' | 'warmup' | 'other';

const FREE: Equipment[] = ['barbell', 'dumbbell', 'kettlebell'];

/** Ручные исключения из правила ролей */
export const ROLE_EXCEPTIONS: Record<string, Role> = {
  // базовые с весом тела, которые в плане стоят как основные
  'pull-up': 'main',
  'chin-up': 'main',
  'chest-dip': 'main',
  'push-up': 'main',
  'inverted-row': 'main',
  // переноски и рывковые — не для подбора по группам
  'farmer-carry': 'other',
  'suitcase-carry': 'other',
  'kettlebell-swing': 'other',
  'kettlebell-clean': 'other',
  'db-thruster': 'other',
  'kettlebell-halo': 'other',
};

/**
 * Роль упражнения в тренировке. Правило: растяжка и разминка — warmup; кардио — other;
 * базовое со свободным весом — main; базовое на тренажёре, блоке или с весом тела — accessory;
 * изолирующее — isolation. Исключения — ROLE_EXCEPTIONS.
 */
export function roleOf(ex: Pick<Exercise, 'id' | 'category' | 'type' | 'equipment'>): Role {
  const x = ROLE_EXCEPTIONS[ex.id];
  if (x) return x;
  if (ex.category === 'mobility') return 'warmup';
  if (ex.category === 'cardio') return 'other';
  if (ex.type === 'compound') return ex.equipment.some((q) => FREE.includes(q)) ? 'main' : 'accessory';
  return 'isolation';
}

// ---------- ограничения ----------

/** «Не включать упражнения…» — только про упражнения, без медицинских формулировок */
export const RESTRICTIONS = ['jumps', 'kneeling', 'lyingBack', 'overhead', 'lowerBack'] as const;
export type Restriction = (typeof RESTRICTIONS)[number];

export const RESTRICTION_TAGS: Record<Restriction, string[]> = {
  /** С прыжками и ударной нагрузкой */
  jumps: [
    'burpee',
    'jump-rope',
    'jumping-jack',
    'clap-push-up',
    'jump-squat',
    'high-knees',
    'butt-kicks',
    'skater-jump',
    'squat-thrust',
    'box-jump',
    'double-under',
    'treadmill-jog',
  ],
  /** В упоре на коленях или стоя на коленях */
  kneeling: [
    'knee-push-up',
    'bird-dog',
    'donkey-kick',
    'fire-hydrant',
    'cable-crunch',
    'cat-cow',
    'thoracic-rotation',
    'thread-the-needle',
    'hip-flexor-stretch',
    'childs-pose',
  ],
  /** Лёжа на спине */
  lyingBack: [
    'barbell-bench-press',
    'db-fly',
    'db-pullover',
    'glute-bridge',
    'single-leg-glute-bridge',
    'skull-crusher',
    'db-skull-crusher',
    'close-grip-bench-press',
    'decline-bench-press',
    'db-floor-press',
    'db-squeeze-press',
    'crunch',
    'reverse-crunch',
    'bicycle-crunch',
    'hollow-hold',
    'hollow-rock',
    'dead-bug',
    'flutter-kicks',
    'lying-leg-raise',
    'v-up',
    'sit-up',
    'heel-touch',
    'decline-sit-up',
    'inverted-row',
    'feet-elevated-inverted-row',
    'lying-spinal-twist',
  ],
  /** С весом над головой */
  overhead: [
    'overhead-press',
    'arnold-press',
    'standing-db-press',
    'machine-shoulder-press',
    'seated-shoulder-press',
    'push-press',
    'kettlebell-press',
    'kettlebell-push-press',
    'pike-push-up',
    'landmine-press',
    'overhead-db-extension',
    'overhead-cable-extension',
    'db-thruster',
    'kettlebell-halo',
  ],
  /** С нагрузкой на поясницу (наклоны с весом, становые, тяги в наклоне) */
  lowerBack: [
    'deadlift',
    'romanian-deadlift',
    'db-romanian-deadlift',
    'single-leg-rdl',
    'sumo-deadlift',
    'rack-pull',
    'good-morning',
    'barbell-row',
    'pendlay-row',
    't-bar-row',
    'db-bent-over-row',
    'back-extension',
    'superman',
    'kettlebell-swing',
    'kettlebell-deadlift',
    'back-squat',
    'front-squat',
  ],
};

// ---------- разминка ----------

/** Одна строка «по желанию» в начале дня — по тому, что тренируется в этот день */
export const WARMUPS: Record<'upper' | 'lower' | 'full', string[]> = {
  upper: ['arm-circles', 'band-pull-apart', 'wall-slide', 'thoracic-rotation', 'band-pass-through'],
  lower: ['leg-swing', 'hip-circles', 'worlds-greatest-stretch', 'hip-90-90', 'ankle-circles'],
  full: ['inchworm', 'worlds-greatest-stretch', 'arm-circles', 'leg-swing'],
};

// ---------- замены ----------

/**
 * Запасные варианты, когда нет инвентаря (по порядку предпочтения). Остальные замены — по сходству
 * (та же главная мышца и роль, src/lib/planner: similar()).
 */
export const SUBSTITUTES: Record<string, string[]> = {
  'lat-pulldown': ['pull-up', 'assisted-pull-up', 'one-arm-db-row', 'band-row', 'inverted-row'],
  'seated-cable-row': ['chest-supported-db-row', 'one-arm-db-row', 'band-row', 'inverted-row'],
  'barbell-bench-press': ['flat-press', 'incline-db-press', 'push-up'],
  'back-squat': ['goblet-squat', 'leg-press', 'split-squat', 'air-squat'],
  'leg-press': ['goblet-squat', 'bulgarian-split-squat', 'air-squat'],
  'leg-curl': ['seated-leg-curl', 'db-romanian-deadlift', 'nordic-curl', 'single-leg-glute-bridge'],
  'overhead-press': ['seated-shoulder-press', 'standing-db-press', 'pike-push-up'],
  'rope-pushdown': ['band-pushdown', 'overhead-db-extension', 'diamond-push-up', 'bench-dip'],
  'cable-curl': ['db-curl', 'band-curl', 'hammer-curl'],
  'pull-up': ['band-row', 'inverted-row', 'one-arm-db-row'],
};

// ---------- восстановление ----------

/** Тяжёлые для поясницы группы — не ставим «тяжёлые ноги» и «тяжёлую спину» в соседние дни */
export const HEAVY_PAIRS: [Group, Group][] = [
  ['hamstrings', 'back'],
  ['quads', 'back'],
];

/** Подходов на группу в неделю по уровню — только для мягких подсказок, пользователю не показываются */
export const WEEKLY_SETS: Record<'first' | 'few' | 'intermediate' | 'veteran', [number, number]> = {
  first: [6, 10],
  few: [8, 12],
  intermediate: [10, 16],
  veteran: [12, 20],
};

// ---------- сплиты ----------

/** День сплита: группы по порядку (крупные первыми); light — лёгкий день: растяжка и пресс */
export interface SplitDay {
  key: string;
  groups: Group[];
  light?: true;
}
export interface Split {
  id: string;
  days: SplitDay[];
  /** Всё тело + 1–2 изолирующих на приоритеты в каждый день */
  accent?: true;
}

const D = {
  fullShort: { key: 'full', groups: ['quads', 'chest', 'back', 'abs'] },
  fullLong: {
    key: 'full',
    groups: ['quads', 'chest', 'back', 'hamstrings', 'shoulders', 'biceps', 'triceps', 'abs'],
  },
  fullA: { key: 'fullA', groups: ['quads', 'chest', 'back', 'hamstrings', 'shoulders', 'abs'] },
  fullB: { key: 'fullB', groups: ['hamstrings', 'back', 'chest', 'glutes', 'shoulders', 'abs'] },
  fullC: {
    key: 'fullC',
    groups: ['glutes', 'shoulders', 'back', 'chest', 'quads', 'triceps', 'biceps', 'abs'],
  },
  upper: { key: 'upper', groups: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
  lower: { key: 'lower', groups: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] },
  push: { key: 'push', groups: ['chest', 'shoulders', 'triceps'] },
  pull: { key: 'pull', groups: ['back', 'biceps', 'forearms'] },
  legs: { key: 'legs', groups: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] },
  armsBack: { key: 'armsBack', groups: ['back', 'biceps', 'triceps', 'forearms'] },
  chestShoulders: { key: 'chestShoulders', groups: ['chest', 'shoulders'] },
  legsAbs: { key: 'legsAbs', groups: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] },
  chestTri: { key: 'chestTri', groups: ['chest', 'triceps'] },
  backBi: { key: 'backBi', groups: ['back', 'biceps', 'forearms'] },
  legsOnly: { key: 'legs', groups: ['quads', 'hamstrings', 'glutes', 'calves'] },
  shouldersAbs: { key: 'shouldersAbs', groups: ['shoulders', 'abs'] },
  chestDay: { key: 'chest', groups: ['chest', 'abs'] },
  backDay: { key: 'back', groups: ['back'] },
  shouldersDay: { key: 'shoulders', groups: ['shoulders'] },
  armsAbs: { key: 'armsAbs', groups: ['biceps', 'triceps', 'forearms', 'abs'] },
  light: { key: 'light', groups: ['abs'], light: true },
} satisfies Record<string, SplitDay>;

/** Утверждённая таблица сплитов (по числу дней). Не расширять без согласования с владельцем. */
export const SPLITS: Record<string, Split> = {
  'full-1-short': { id: 'full-1-short', days: [D.fullShort] },
  'full-1-long': { id: 'full-1-long', days: [D.fullLong] },
  'ul-2': { id: 'ul-2', days: [D.upper, D.lower] },
  'full-2': { id: 'full-2', days: [D.fullA, D.fullB] },
  'full-3': { id: 'full-3', days: [D.fullA, D.fullB, D.fullC] },
  'ppl-3': { id: 'ppl-3', days: [D.push, D.pull, D.legs] },
  'abl-3': { id: 'abl-3', days: [D.armsBack, D.chestShoulders, D.legsAbs] },
  'ul-4': { id: 'ul-4', days: [D.upper, D.lower, D.upper, D.lower] },
  'bro-4': { id: 'bro-4', days: [D.chestTri, D.backBi, D.legsOnly, D.shouldersAbs] },
  'ulppl-5': { id: 'ulppl-5', days: [D.upper, D.lower, D.push, D.pull, D.legs] },
  'bro-5': { id: 'bro-5', days: [D.chestDay, D.backDay, D.legsOnly, D.shouldersDay, D.armsAbs] },
  'ppl-6': { id: 'ppl-6', days: [D.push, D.pull, D.legs, D.push, D.pull, D.legs] },
  'ul-6': { id: 'ul-6', days: [D.upper, D.lower, D.upper, D.lower, D.upper, D.lower] },
  'ppl-7': { id: 'ppl-7', days: [D.push, D.pull, D.legs, D.push, D.pull, D.legs, D.light] },
  // «Всё тело + акцент» (2–4 дня): дни всего тела, плюс изоляция на приоритеты в каждый день
  'accent-2': { id: 'accent-2', days: [D.fullA, D.fullB], accent: true },
  'accent-3': { id: 'accent-3', days: [D.fullA, D.fullB, D.fullC], accent: true },
  'accent-4': { id: 'accent-4', days: [D.fullA, D.fullB, D.fullA, D.fullB], accent: true },
};
