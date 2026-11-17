import {
  BIG_GROUPS,
  EQUIPMENT_CHOICES,
  GROUPS,
  GROUP_MUSCLES,
  GROUP_SECTIONS,
  RESTRICTION_TAGS,
  SPLITS,
  SUBSTITUTES,
  WARMUPS,
  WEEKLY_SETS,
  available,
  roleOf,
  type Group,
  type Place,
  type Restriction,
  type Role,
  type Split,
  type SplitDay,
} from '../../data/planner';
import { DEFAULT_WEEKDAYS, dayId, setsFor } from '../../data/templates';
import type { Day, Equipment, Exercise, Level, Plan, PlanItem } from '../../types';
import { estimateItems, type DurationItem, type Estimate, type EstimateOptions } from '../duration';

/**
 * Помощник «Подбор плана» (docs/ARCHITECTURE.md, «Помощник»): по ответам мастера собирает
 * черновик плана по заранее прописанным правилам. Чистые функции, без ИИ и сети; одинаковые
 * ответы и seed → одинаковый план; «Пересобрать» — следующий seed. Вес не подставляется никогда.
 */

export const MINUTES = [30, 45, 60, 75, 90] as const;
export type Minutes = (typeof MINUTES)[number];

export interface Answers {
  /** Приоритетные группы (любое число); пусто, full или все разделы сразу — всё тело */
  priorities: Group[];
  full: boolean;
  place: Place;
  /** Отмеченный инвентарь (вес тела есть всегда) */
  equipment: Equipment[];
  days: number;
  mode: Plan['mode'];
  minutes: Minutes;
  level: Level;
  restrict: Restriction[];
}

export const DEFAULT_ANSWERS: Answers = {
  priorities: [],
  full: true,
  place: 'gym',
  equipment: [
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
  days: 3,
  mode: 'cycle',
  minutes: 60,
  level: 'intermediate',
  restrict: [],
};

/** Упражнение черновика: обычный PlanItem + метки предпросмотра */
export interface DraftItem extends PlanItem {
  /** Для какой группы подобрано (замена ищется в ней же) */
  group?: Group;
  /** Закреплено: при пересборке не меняется */
  pinned?: boolean;
  warmup?: boolean;
}
export interface DraftDay {
  /** Ключ названия дня: planner.day.<key>; 'custom' — день на выбранные группы (название из групп) */
  key: string;
  /** Группы дня 'custom' — для названия */
  groups?: Group[];
  items: DraftItem[];
  estimate: Estimate;
}
export interface Warning {
  /** planner.warn.<key> */
  key:
    | 'recovery'
    | 'missing'
    | 'needsEquipment'
    | 'restricted'
    | 'onceAWeek'
    | 'lowVolume'
    | 'highVolume'
    | 'spread';
  groups?: Group[];
  equipment?: Equipment[];
}
export interface Draft {
  splitId: string;
  days: DraftDay[];
  warnings: Warning[];
  seed: number;
}

/** Что нужно алгоритму от приложения: каталог, отдых по таймеру и настройки оценки времени */
export interface PlannerCtx {
  exercises: Exercise[];
  restFor: (ex: Exercise) => number;
  estimate?: EstimateOptions;
}

const BEGINNER = (l: Level) => l === 'first' || l === 'few';

// ---------- выбор сплита (правила утверждены владельцем, docs/ARCHITECTURE.md) ----------

/** Приоритеты из всех четырёх разделов (верх, руки, ноги, кор) — это всё тело */
const spread = (pr: Group[]) => GROUP_SECTIONS.every((s) => s.groups.some((g) => pr.includes(g)));

export function chooseSplit(a: Answers): { split: Split; warnings: Warning[] } {
  const n = Math.min(7, Math.max(1, Math.round(a.days)));
  const warnings: Warning[] = [];
  let pr = a.full ? [] : a.priorities;
  if (pr.length && spread(pr)) {
    warnings.push({ key: 'spread' });
    pr = [];
  }
  const beginner = BEGINNER(a.level);
  let id: string;
  if (n === 1) id = a.minutes <= 45 ? 'full-1-short' : 'full-1-long';
  else if (!pr.length)
    id = ['', '', 'full-2', 'full-3', 'ul-4', 'ulppl-5', beginner ? 'ul-6' : 'ppl-6', 'ppl-7'][n]!;
  else if (pr.length <= 2)
    id =
      n <= 4
        ? `accent-${n}`
        : bestCoverage(pr, n === 5 ? ['ulppl-5', 'bro-5'] : n === 6 ? ['ppl-6', 'ul-6'] : ['ppl-7']);
  else
    id = [
      '',
      '',
      'ul-2',
      beginner ? 'full-3' : 'abl-3',
      beginner ? 'ul-4' : 'bro-4',
      beginner ? 'ulppl-5' : 'bro-5',
      beginner ? 'ul-6' : 'ppl-6',
      'ppl-7',
    ][n]!;
  if (n >= 5) warnings.push({ key: 'recovery' });
  return { split: SPLITS[id]!, warnings };
}

/** Из вариантов на это число дней — где приоритеты встречаются чаще (при равенстве — первый) */
function bestCoverage(pr: Group[], ids: string[]): string {
  let best = ids[0]!;
  let score = -1;
  for (const id of ids) {
    const s = SPLITS[id]!.days.reduce((acc, d) => acc + pr.filter((g) => d.groups.includes(g)).length, 0);
    if (s > score) {
      score = s;
      best = id;
    }
  }
  return best;
}

// ---------- кандидаты ----------

/** Детерминированный «случай» для пересборки: хэш id и seed */
function hash(s: string, seed: number): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

interface Pool {
  have: Set<Equipment>;
  banned: Set<string>;
  level: Level;
  byId: Map<string, Exercise>;
}

function makePool(a: Answers, ctx: PlannerCtx): Pool {
  const have = new Set<Equipment>(['bodyweight', ...a.equipment]);
  const banned = new Set(a.restrict.flatMap((r) => RESTRICTION_TAGS[r]));
  return { have, banned, level: a.level, byId: new Map(ctx.exercises.map((e) => [e.id, e])) };
}

function usable(
  e: Exercise,
  p: Pool,
  opts: { ignoreEquipment?: boolean; ignoreRestrict?: boolean } = {},
): boolean {
  if (!opts.ignoreEquipment && !available(e, p.have)) return false;
  if (!opts.ignoreRestrict && p.banned.has(e.id)) return false;
  if (BEGINNER(p.level) && e.levelHint === 'advanced') return false;
  return true;
}

const inGroup = (e: Exercise, g: Group) => e.primaryMuscles.some((m) => GROUP_MUSCLES[g].includes(m));

/** Группа упражнения — по главной (первой основной) мышце */
export function groupOf(e: Pick<Exercise, 'primaryMuscles'>): Group | undefined {
  const m = e.primaryMuscles[0];
  return GROUPS.find((g) => !!m && GROUP_MUSCLES[g].includes(m));
}

const ROLE_ORDER: Record<Role, number> = { main: 0, accessory: 1, isolation: 2, warmup: 3, other: 4 };

/**
 * Лучшие кандидаты на группу. want — желаемые роли по убыванию предпочтения. Главная мышца —
 * главный вес; затем роль, уровень, подходящий инвентарь; использованные на неделе — в конце.
 */
function pick(
  g: Group,
  want: Role[],
  p: Pool,
  ctx: PlannerCtx,
  taken: Set<string>,
  weekUsed: Set<string>,
  seed: number,
  dayRoles: Role[],
): Exercise | null {
  let best: Exercise | null = null;
  let bestS = -Infinity;
  let bestT = 0;
  for (const e of ctx.exercises) {
    if (taken.has(e.id) || !inGroup(e, g) || !usable(e, p)) continue;
    const role = roleOf(e);
    const wi = want.indexOf(role);
    if (wi < 0) continue;
    let s = (want.length - wi) * 2;
    if (GROUP_MUSCLES[g].includes(e.primaryMuscles[0]!)) s += 3;
    if (weekUsed.has(e.id)) s -= 6;
    // разнообразие в дне: не два упражнения одной роли подряд на группу, если есть выбор
    if (dayRoles.includes(role)) s -= 1;
    if (BEGINNER(p.level) && e.levelHint === 'intermediate') s -= 1;
    if (e.metric === 'time' && g !== 'abs') s -= 2;
    // в зале — упражнения со снарядом удобнее нагружать, чем вес тела или резинку
    if (p.have.size > 3 && e.equipment.every((q) => q === 'bodyweight' || q === 'band')) s -= 1;
    const t = seed ? hash(e.id, seed) : 0;
    if (s > bestS || (s === bestS && (seed ? t < bestT : !!best && e.id < best.id))) {
      best = e;
      bestS = s;
      bestT = t;
    }
  }
  return best;
}

// ---------- схема подходов ----------

function itemFor(e: Exercise, level: Level, role: Role, group: Group, optional = false): DraftItem {
  const base = e.defaults;
  // изоляция — не больше 3 подходов; основное — не меньше 2
  const sets0 = role === 'isolation' ? Math.min(base.sets, 3) : Math.max(2, base.sets);
  return {
    exerciseId: e.id,
    sets: optional ? Math.min(2, setsFor(sets0, level)) : setsFor(sets0, level),
    repsMin: base.repsMin,
    repsMax: base.repsMax,
    group,
    ...(optional ? { optional: true } : {}),
  };
}

function durationItems(items: DraftItem[], ctx: PlannerCtx, byId: Map<string, Exercise>): DurationItem[] {
  return items.map((it) => {
    const ex = byId.get(it.exerciseId);
    return {
      ex,
      sets: it.sets,
      repsMin: it.repsMin,
      repsMax: it.repsMax,
      restSec: it.restSec ?? (ex ? ctx.restFor(ex) : 90),
      optional: it.optional,
    };
  });
}

// ---------- день ----------

const groupRank = (g: Group | undefined) =>
  g === 'abs' ? 50 : g && BIG_GROUPS.includes(g) ? BIG_GROUPS.indexOf(g) : 20;

/** Порядок в дне: разминка → основные → вспомогательные → изоляция (крупные группы раньше) → пресс → по желанию */
function orderDay(items: DraftItem[], byId: Map<string, Exercise>): DraftItem[] {
  const rank = (it: DraftItem) => {
    if (it.warmup) return -1;
    if (it.optional) return 1000 + groupRank(it.group);
    const e = byId.get(it.exerciseId);
    const role = e ? roleOf(e) : 'isolation';
    return (it.group === 'abs' ? 300 : ROLE_ORDER[role] * 100) + groupRank(it.group);
  };
  return items
    .map((it, i) => ({ it, i, r: rank(it) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.it);
}

function warmupFor(day: SplitDay, p: Pool, n: number): Exercise | null {
  const upper = day.groups.every((g) => !['quads', 'hamstrings', 'glutes', 'calves'].includes(g));
  const lower = day.groups.every((g) => ['quads', 'hamstrings', 'glutes', 'calves', 'abs'].includes(g));
  const list = WARMUPS[upper ? 'upper' : lower ? 'lower' : 'full'];
  const ok = list.map((id) => p.byId.get(id)).filter((e): e is Exercise => !!e && usable(e, p));
  if (!ok.length) return null;
  return ok[n % ok.length]!;
}

function buildDay(
  day: SplitDay,
  split: Split,
  a: Answers,
  ctx: PlannerCtx,
  p: Pool,
  weekUsed: Set<string>,
  seed: number,
  pinned: DraftItem[],
  index: number,
): DraftItem[] {
  const level = a.level;
  const pr = a.full ? [] : a.priorities;
  const budget = a.minutes * 60 * 0.9;
  const items: DraftItem[] = pinned.map((x) => ({ ...x }));
  const taken = new Set(items.map((x) => x.exerciseId));
  const estimate = (list: DraftItem[]) =>
    estimateItems(
      durationItems(
        list.filter((x) => !x.optional),
        ctx,
        p.byId,
      ),
      ctx.estimate,
    ).sec.typical;
  const count = (g: Group) => items.filter((x) => x.group === g && !x.optional).length;
  const rolesOf = (g: Group) =>
    items.filter((x) => x.group === g).map((x) => roleOf(p.byId.get(x.exerciseId) ?? ({} as Exercise)));

  const tryAdd = (g: Group, want: Role[], optional = false): boolean => {
    const e = pick(g, want, p, ctx, taken, weekUsed, seed, rolesOf(g));
    if (!e) return false;
    const it = itemFor(e, level, roleOf(e), g, optional);
    if (!optional && estimate([...items, it]) > budget) return false;
    items.push(it);
    taken.add(e.id);
    return true;
  };

  if (day.light) {
    // лёгкий день: две растяжки и пресс — всё обычными строками
    for (const id of [...WARMUPS.full, ...WARMUPS.lower].slice(0, 6)) {
      const e = p.byId.get(id);
      if (e && usable(e, p) && !taken.has(id) && items.length < 2) {
        items.push({ ...itemFor(e, level, 'warmup', 'abs'), sets: 1 });
        taken.add(id);
      }
    }
    tryAdd('abs', ['isolation', 'accessory']);
    return items;
  }

  const inDay = day.groups;
  const accent = split.accent ? pr.filter((g) => !inDay.includes(g)) : [];
  const prIn = inDay.filter((g) => pr.includes(g));
  const order = [...prIn, ...inDay.filter((g) => !pr.includes(g))];
  // 1. приоритеты дня и акцент (изоляция на приоритеты, которых нет в дне всего тела) — первыми:
  //    при нехватке времени отпадают неприоритетные группы, а не приоритеты
  for (const g of prIn) if (!count(g)) tryAdd(g, ['main', 'accessory', 'isolation']);
  for (const g of accent) if (!count(g)) tryAdd(g, ['isolation', 'accessory']);
  // 2. по одному на остальные группы дня
  for (const g of order) if (!count(g)) tryAdd(g, ['main', 'accessory', 'isolation']);
  // 3. второе упражнение на приоритеты, затем на крупные группы дня
  for (const g of prIn) if (count(g) < 2) tryAdd(g, ['accessory', 'isolation', 'main']);
  for (const g of split.accent ? pr : []) if (count(g) < 2) tryAdd(g, ['isolation', 'accessory']);
  for (const g of order.filter((x) => BIG_GROUPS.includes(x) && !pr.includes(x)))
    if (count(g) < 2) tryAdd(g, ['accessory', 'isolation']);
  // 4. третье на приоритеты, если время ещё есть
  for (const g of prIn) if (count(g) < 3) tryAdd(g, ['isolation', 'accessory']);
  // 5. по желанию: по одному на приоритет дня и разминка в начале (в типичное время не входят)
  for (const g of [...prIn, ...accent].slice(0, 2)) tryAdd(g, ['isolation', 'accessory'], true);
  if (!items.some((x) => x.warmup)) {
    // разминки чередуются по дням недели и меняются при пересборке
    const w = warmupFor(day, p, index + seed);
    if (w && !taken.has(w.id)) {
      items.push({ ...itemFor(w, level, 'warmup', 'abs', true), sets: 1, warmup: true });
      taken.add(w.id);
    }
  }
  return items;
}

// ---------- неделя ----------

/** Черновик плана по ответам. pins — закреплённые упражнения по индексу дня (при пересборке) */
export function buildDraft(a: Answers, ctx: PlannerCtx, seed = 0, pins: DraftItem[][] = []): Draft {
  const { split, warnings } = chooseSplit(a);
  const p = makePool(a, ctx);
  const weekUsed = new Set<string>();
  const days: DraftDay[] = split.days.map((d, i) => {
    const raw = buildDay(d, split, a, ctx, p, weekUsed, seed + i * 7919 * (seed ? 1 : 0), pins[i] ?? [], i);
    for (const x of raw) weekUsed.add(x.exerciseId);
    const items = orderDay(raw, p.byId);
    return { key: d.key, items, estimate: estimateItems(durationItems(items, ctx, p.byId), ctx.estimate) };
  });
  return { splitId: split.id, days, warnings: [...warnings, ...weekWarnings(a, days, ctx, p)], seed };
}

/**
 * Один день (3.20, «Собрать день» для пустого дня плана). Выбраны группы — день на них (крупные
 * первыми); всё тело или группы из всех разделов — день на всё тело по времени. used — упражнения
 * других дней плана: по возможности не повторяются. Недельные подсказки об объёме здесь не нужны.
 */
export function buildOneDay(
  a: Answers,
  ctx: PlannerCtx,
  seed = 0,
  pins: DraftItem[] = [],
  used: string[] = [],
): Draft {
  const pr = a.full ? [] : a.priorities;
  const custom = pr.length > 0 && !spread(pr);
  const day: SplitDay = custom
    ? { key: 'custom', groups: [...pr].sort((x, y) => groupRank(x) - groupRank(y)) }
    : SPLITS[a.minutes <= 45 ? 'full-1-short' : 'full-1-long']!.days[0]!;
  const split: Split = { id: 'one-day', days: [day] };
  const p = makePool(a, ctx);
  const raw = buildDay(day, split, { ...a, days: 1 }, ctx, p, new Set(used), seed, pins, 0);
  const items = orderDay(raw, p.byId);
  const days: DraftDay[] = [
    {
      key: day.key,
      ...(custom ? { groups: day.groups } : {}),
      items,
      estimate: estimateItems(durationItems(items, ctx, p.byId), ctx.estimate),
    },
  ];
  const keep = new Set<Warning['key']>(['needsEquipment', 'restricted', 'missing']);
  const warnings = weekWarnings({ ...a, priorities: custom ? pr : [] }, days, ctx, p).filter((w) =>
    keep.has(w.key),
  );
  return { splitId: split.id, days, warnings, seed };
}

function weekWarnings(a: Answers, days: DraftDay[], ctx: PlannerCtx, p: Pool): Warning[] {
  const out: Warning[] = [];
  const pr = a.full ? [] : a.priorities;
  const main = (d: DraftDay) => d.items.filter((x) => !x.optional);
  const missing: Group[] = [];
  const once: Group[] = [];
  const low: Group[] = [];
  const high: Group[] = [];
  const [lo, hi] = WEEKLY_SETS[a.level];
  for (const g of pr) {
    const daysWith = days.filter((d) => main(d).some((x) => x.group === g)).length;
    if (!daysWith) {
      // почему: нет инвентаря, мешают ограничения или не влезло по времени / дням
      const any = (o: Parameters<typeof usable>[2]) =>
        ctx.exercises.some(
          (e) => inGroup(e, g) && ['main', 'accessory', 'isolation'].includes(roleOf(e)) && usable(e, p, o),
        );
      if (!any({}) && any({ ignoreRestrict: true })) out.push({ key: 'restricted', groups: [g] });
      else if (!any({}))
        out.push({
          key: 'needsEquipment',
          groups: [g],
          equipment: EQUIPMENT_CHOICES.filter((q) =>
            ctx.exercises.some(
              (e) => inGroup(e, g) && usable(e, { ...p, have: new Set<Equipment>([...p.have, q]) }),
            ),
          ),
        });
      else missing.push(g);
      continue;
    }
    if (days.length >= 3 && daysWith === 1) once.push(g);
    const sets = days.reduce(
      (acc, d) =>
        acc +
        main(d)
          .filter((x) => x.group === g)
          .reduce((s, x) => s + x.sets, 0),
      0,
    );
    if (sets < lo) low.push(g);
    if (sets > hi) high.push(g);
  }
  if (missing.length) out.push({ key: 'missing', groups: missing });
  if (once.length) out.push({ key: 'onceAWeek', groups: once });
  if (low.length) out.push({ key: 'lowVolume', groups: low });
  if (high.length) out.push({ key: 'highVolume', groups: high });
  return out;
}

// ---------- замена, план ----------

/**
 * Похожие упражнения для «Заменить»: та же группа, доступно с выбранным инвентарём и ограничениями,
 * не в этом дне; по близости — явные замены, та же роль, общие основные мышцы.
 */
export function similar(
  itemId: string,
  a: Answers,
  ctx: PlannerCtx,
  exclude: string[] = [],
  limit = 8,
): Exercise[] {
  const p = makePool(a, ctx);
  const cur = p.byId.get(itemId);
  if (!cur) return [];
  const g = groupOf(cur);
  const subs = SUBSTITUTES[itemId] ?? [];
  const role = roleOf(cur);
  return ctx.exercises
    .filter(
      (e) =>
        e.id !== itemId &&
        !exclude.includes(e.id) &&
        !!g &&
        inGroup(e, g) &&
        ['main', 'accessory', 'isolation'].includes(roleOf(e)) &&
        usable(e, p),
    )
    .map((e) => {
      let s = 0;
      const si = subs.indexOf(e.id);
      if (si >= 0) s += 10 - si;
      if (roleOf(e) === role) s += 3;
      s += e.primaryMuscles.filter((m) => cur.primaryMuscles.includes(m)).length;
      if (e.primaryMuscles[0] === cur.primaryMuscles[0]) s += 2;
      return { e, s };
    })
    .sort((x, y) => y.s - x.s || (x.e.id < y.e.id ? -1 : 1))
    .slice(0, limit)
    .map((x) => x.e);
}

/** Черновик → обычный план (названия дней — ключами, имена переводятся при смене языка) */
export function draftToDays(d: Draft, mode: Plan['mode'], startIndex = 0, ids?: string[]): Day[] {
  const weekdays = DEFAULT_WEEKDAYS[Math.min(7, d.days.length)]!;
  return d.days.map((dd, i) => {
    const day: Day = {
      id: ids?.[i] ?? dayId(startIndex + i),
      labelKey: `planner.day.${dd.key}`,
      items: dd.items.map(({ group: _g, pinned: _p, warmup: _w, ...it }) => it),
    };
    if (mode === 'weekdays') day.weekday = weekdays[i]!;
    return day;
  });
}

/** Ответы из сохранённых (старые версии, удалённые группы) — без падений */
export function sanitizeAnswers(raw: unknown): Answers {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Answers, unknown>>;
  const d = DEFAULT_ANSWERS;
  const arr = <T extends string>(v: unknown, ok: readonly T[]): T[] =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is T => ok.includes(x as T)))] : [];
  const minutes = MINUTES.includes(r.minutes as Minutes) ? (r.minutes as Minutes) : d.minutes;
  const levels: Level[] = ['first', 'few', 'intermediate', 'veteran'];
  return {
    priorities: arr(r.priorities, GROUPS),
    full: typeof r.full === 'boolean' ? r.full : d.full,
    place: r.place === 'home' || r.place === 'outdoor' || r.place === 'gym' ? r.place : d.place,
    equipment: Array.isArray(r.equipment) ? arr(r.equipment, EQUIPMENT_CHOICES) : [...d.equipment],
    days: typeof r.days === 'number' && r.days >= 1 && r.days <= 7 ? Math.round(r.days) : d.days,
    mode: r.mode === 'weekdays' ? 'weekdays' : 'cycle',
    minutes,
    level: levels.includes(r.level as Level) ? (r.level as Level) : d.level,
    restrict: arr(r.restrict, Object.keys(RESTRICTION_TAGS) as Restriction[]),
  };
}
