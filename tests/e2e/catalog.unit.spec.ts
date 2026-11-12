import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { BASE_IDS, EXERCISES, PICS, picMarkup } from '../../src/data/catalog';
import { EQUIPMENT, MUSCLES } from '../../src/data/exercises';
import { PICS as BASE_PICS, picMarkup as basePicMarkup } from '../../src/pics/defs';
import type { Pose } from '../../src/pics/engine';

/** База упражнений и схемы (этап 3А): структура, тексты, запрещённые слова, схемы. */

const json = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const dict = {
  en: json('../../src/i18n/locales/en/exercises.json').ex as Record<string, ExText>,
  ru: json('../../src/i18n/locales/ru/exercises.json').ex as Record<string, ExText>,
};
const ui = {
  en: json('../../src/i18n/locales/en/ui.json'),
  ru: json('../../src/i18n/locales/ru/ui.json'),
};
interface ExText {
  name: string;
  desc: string;
  cues: string[];
  mistakes: string[];
  safety: string;
}

/** id упражнений этапов 1–2: никогда не меняются и не исчезают (по ним хранится история) */
const STAGE2_IDS = [
  'incline-db-press',
  'flat-press',
  'high-to-low-cable-fly',
  'rope-pushdown',
  'overhead-cable-extension',
  'single-arm-pushdown',
  'lat-pulldown',
  'seated-cable-row',
  'chest-supported-db-row',
  'incline-db-curl',
  'preacher-curl',
  'hammer-curl',
  'wrist-curl',
  'reverse-wrist-curl',
  'seated-shoulder-press',
  'lateral-raise',
  'reverse-pec-deck',
  'db-shrug',
  'incline-y-raise',
  'cable-crunch',
  'hanging-knee-raise',
  'side-plank',
  'pallof-press',
  'dead-bug',
  'leg-press',
  'leg-curl',
  'calf-raise',
];

/**
 * Запрещённые темы во всех текстах упражнений (CONCEPT.md, раздел 7, п. 6): вес тела, питание,
 * калории, жиросжигание, внешний вид. Проверяются все тексты, старые тоже.
 */
const FORBIDDEN = {
  en: /body ?weight|\bdiet|calori|\bfat\b|fat[- ]?burn|burn(s|ing)? fat|\bslim|lose weight|weight loss|\btoned?\b|appearance|physique|sculpt|nutrition|\bkcal\b|\bmeal/i,
  ru: /вес(а|ом|у)? тела|собственн\S* вес|диет|калори|жир|сжига|похуд|стройн|внешн\S* вид|рельеф|питани|фигур[аеуы]|ккал/i,
};

test('ids: unique, stable, stage 1–2 ids are all still here', () => {
  const ids = EXERCISES.map((e) => e.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of STAGE2_IDS) expect(ids, id).toContain(id);
  expect(BASE_IDS).toEqual(STAGE2_IDS);
  for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test('every exercise has all concept fields (CONCEPT.md §6)', () => {
  for (const e of EXERCISES) {
    expect(e.nameKey, e.id).toBe(`ex.${e.id}.name`);
    expect(e.descriptionKey).toBe(`ex.${e.id}.desc`);
    expect(e.safetyKey).toBe(`ex.${e.id}.safety`);
    expect(e.primaryMuscles.length, e.id).toBeGreaterThan(0);
    for (const m of [...e.primaryMuscles, ...e.secondaryMuscles])
      expect(MUSCLES, `${e.id}: ${m}`).toContain(m);
    expect(e.equipment.length, e.id).toBeGreaterThan(0);
    for (const q of e.equipment) expect(EQUIPMENT, `${e.id}: ${q}`).toContain(q);
    expect(['compound', 'isolation']).toContain(e.type);
    expect(['weight_reps', 'reps', 'time']).toContain(e.metric);
    expect(['beginner', 'intermediate', 'advanced']).toContain(e.levelHint);
    expect(e.cueKeys.length, e.id).toBeGreaterThanOrEqual(2);
    expect(e.mistakeKeys.length, e.id).toBeGreaterThanOrEqual(2);
    expect(e.defaults.sets).toBeGreaterThan(0);
    expect(e.defaults.repsMin).toBeLessThanOrEqual(e.defaults.repsMax);
  }
});

test('new exercises: 3–4 cues, 2–3 mistakes', () => {
  for (const e of EXERCISES.filter((x) => !BASE_IDS.includes(x.id))) {
    expect(e.cueKeys.length, e.id).toBeGreaterThanOrEqual(3);
    expect(e.cueKeys.length, e.id).toBeLessThanOrEqual(4);
    expect(e.mistakeKeys.length, e.id).toBeGreaterThanOrEqual(2);
    expect(e.mistakeKeys.length, e.id).toBeLessThanOrEqual(3);
  }
});

test('texts: every key exists in en and ru, non-empty, same shape', () => {
  for (const lang of ['en', 'ru'] as const) {
    for (const e of EXERCISES) {
      const tx = dict[lang][e.id];
      expect(tx, `${lang}: ${e.id}`).toBeTruthy();
      for (const s of [tx!.name, tx!.desc, tx!.safety, ...tx!.cues, ...tx!.mistakes])
        expect(s.trim().length, `${lang}: ${e.id}`).toBeGreaterThan(2);
      expect(tx!.cues.length, `${lang}: ${e.id} cues`).toBe(e.cueKeys.length);
      expect(tx!.mistakes.length, `${lang}: ${e.id} mistakes`).toBe(e.mistakeKeys.length);
    }
    // В словаре нет «осиротевших» упражнений
    const ids = new Set(EXERCISES.map((e) => e.id));
    for (const k of Object.keys(dict[lang])) if (!['technique'].includes(k)) expect(ids, k).toContain(k);
  }
  // Подписи мышц, оборудования и категорий
  for (const lang of ['en', 'ru'] as const) {
    for (const m of MUSCLES) expect(ui[lang].muscle[m], `${lang} muscle.${m}`).toBeTruthy();
    for (const q of EQUIPMENT) expect(ui[lang].equip[q], `${lang} equip.${q}`).toBeTruthy();
    for (const c of new Set(EXERCISES.map((e) => e.category)))
      expect(ui[lang].category[c], `${lang} category.${c}`).toBeTruthy();
  }
});

test('texts: no words about body weight, diet, calories, fat loss or appearance', () => {
  for (const lang of ['en', 'ru'] as const) {
    for (const [id, tx] of Object.entries(dict[lang])) {
      for (const s of [tx.name, tx.desc, tx.safety, ...(tx.cues ?? []), ...(tx.mistakes ?? [])])
        expect(s, `${lang}: ${id}`).not.toMatch(FORBIDDEN[lang]);
    }
  }
  // и в id / ключах
  for (const e of EXERCISES) expect(e.id).not.toMatch(/diet|calor|fat|slim|weight-loss/);
});

test('barbell texts mention safety: rack/spotter, collars, control — and no weight numbers', () => {
  for (const e of EXERCISES.filter((x) => x.equipment.includes('barbell') && x.metric === 'weight_reps')) {
    const s = dict.en[e.id]!.safety;
    expect(s, e.id).toMatch(/collar|spotter|safety arm|rack|landmine|fixed|light/i);
    expect(s, e.id).not.toMatch(/\d+\s?(kg|lb|кг)/i);
  }
});

// ---------- схемы ----------

/** Числа координат из разметки (без <defs> с наконечником стрелки) */
function coords(svg: string) {
  const body = svg.replace(/<defs>[\s\S]*?<\/defs>/, '');
  const xs: number[] = [];
  const ys: number[] = [];
  for (const m of body.matchAll(/\b(x|x1|x2|cx)="(-?[\d.]+)"/g)) xs.push(+m[2]!);
  for (const m of body.matchAll(/\b(y|y1|y2|cy)="(-?[\d.]+)"/g)) ys.push(+m[2]!);
  for (const m of body.matchAll(
    /<rect [^>]*x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g,
  )) {
    xs.push(+m[1]! + +m[3]!);
    ys.push(+m[2]! + +m[4]!);
  }
  for (const m of body.matchAll(/points="([^"]+)"/g))
    for (const pair of m[1]!.trim().split(/\s+/)) {
      const [x, y] = pair.split(',').map(Number);
      xs.push(x!);
      ys.push(y!);
    }
  for (const m of body.matchAll(/ d="([^"]+)"/g)) {
    const nums = m[1]!.match(/-?[\d.]+/g)!.map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) {
      xs.push(nums[i]!);
      ys.push(nums[i + 1]!);
    }
  }
  return { xs, ys };
}

const poseBox = (P: Pose) => {
  const pts = [P.h, ...P.c.flat(), ...P.far.flat()];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

/** Исходная схема с одной позой (статичное упражнение) — оставлена как была */
const SINGLE_POSE_LEGACY = ['side_plank'];

test('stage 1–2 pictograms are unchanged (same SVG as before stage 3A)', () => {
  const before = json('./fixtures/pics-stage2.json') as Record<string, string>;
  expect(Object.keys(BASE_PICS).sort()).toEqual(Object.keys(before).sort());
  for (const [k, svg] of Object.entries(before)) {
    expect(basePicMarkup(k as keyof typeof BASE_PICS), k).toBe(svg);
    expect(picMarkup(k), k).toBe(svg);
  }
});

test('every exercise has a pictogram with two different poses (start and end)', () => {
  for (const e of EXERCISES) {
    const def = PICS[e.pictogram];
    expect(def, `${e.id}: схема ${e.pictogram}`).toBeTruthy();
    expect(picMarkup(e.pictogram), e.id).toContain('<svg');
    if (SINGLE_POSE_LEGACY.includes(e.pictogram)) continue;
    expect(def!.poses.length, `${e.id}: две позы`).toBe(2);
    const [a, b] = def!.poses as [Pose, Pose];
    expect(JSON.stringify(a.c) + a.h.join(), `${e.id}: позы различаются`).not.toBe(
      JSON.stringify(b.c) + b.h.join(),
    );
  }
});

test('pictograms stay inside the frame and are not empty', () => {
  const used = new Set(EXERCISES.map((e) => e.pictogram));
  for (const key of used) {
    const svg = picMarkup(key)!;
    const { xs, ys } = coords(svg);
    expect(xs.length, key).toBeGreaterThan(10);
    // Линии толщиной 7 и голова r = 8.5 — с запасом внутри холста 200 × 135
    for (const x of xs) expect(x, `${key}: x`).toBeGreaterThanOrEqual(0);
    for (const x of xs) expect(x, `${key}: x`).toBeLessThanOrEqual(200);
    for (const y of ys) expect(y, `${key}: y`).toBeGreaterThanOrEqual(0);
    for (const y of ys) expect(y, `${key}: y`).toBeLessThanOrEqual(135);
    for (const P of PICS[key]!.poses) {
      const b = poseBox(P);
      // Голова (r = 8.5) целиком в кадре, концы линий — не ближе 2 px к краю
      expect(P.h[0] - 8.5, `${key}: голова слева`).toBeGreaterThanOrEqual(0);
      expect(P.h[0] + 8.5, `${key}: голова справа`).toBeLessThanOrEqual(200);
      expect(P.h[1] - 8.5, `${key}: голова сверху`).toBeGreaterThanOrEqual(0);
      expect(b.x0, `${key}: слева`).toBeGreaterThanOrEqual(2);
      expect(b.x1, `${key}: справа`).toBeLessThanOrEqual(198);
      expect(b.y0, `${key}: сверху`).toBeGreaterThanOrEqual(2);
      expect(b.y1, `${key}: фигура не под полом`).toBeLessThanOrEqual(130);
      // Фигура не крошечная: занимает заметную часть кадра
      expect(Math.max(b.x1 - b.x0, b.y1 - b.y0), `${key}: размер фигуры`).toBeGreaterThan(45);
    }
  }
});
