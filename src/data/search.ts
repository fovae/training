/**
 * Поиск упражнений: устойчив к опечаткам, словоформам, сленгу и неверной раскладке.
 *
 * Как ищется каждое слово запроса (лучшее совпадение из всех полей упражнения):
 *  - точное слово, начало слова (набор ещё идёт), одинаковая основа («молотки» ≈ «молотковые»,
 *    «грудь» ≈ «груди», «curls» ≈ «curl»), подстрока внутри слова;
 *  - опечатка: 1 ошибка в слове от 4 букв, 2 — от 8 (замена, пропуск, лишняя, перестановка букв);
 *  - слово, набранное не в той раскладке («ghbctl» → «присед», «ыйгфе» → «squat»).
 * Поля с весами: название, синонимы/сленг на языке интерфейса, английские названия и id, основные
 * и второстепенные мышцы с инвентарём. Предлоги («на», «от», «with»…) не обязательны.
 * Все остальные слова запроса должны найтись; результаты — по убыванию релевантности.
 */

export interface SearchFields {
  /** Название на языке интерфейса */
  name: string;
  /** Синонимы, сленг, частые формулировки на языке интерфейса — каждое отдельной фразой */
  alt?: string[];
  /** Английские названия и id (на русском часто ищут по-английски: «hammer curl», «pec deck») */
  en?: string[];
  /** Основные мышцы и инвентарь (с синонимами) */
  tags?: string[];
  /** Второстепенные мышцы */
  minor?: string[];
}

const W_NAME = 1;
const W_ALT = 0.9;
const W_EN = 0.75;
const W_TAGS = 0.7;
const W_MINOR = 0.3;
const W_EXACT_TAG = 0.9;

const STOP = new Set(
  'на в во с со от к ко для и или по из за под у о об при без до the a an on in with of for and or to at by'.split(
    ' ',
  ),
);

/** Регистр, «ё/е», «й/и» — без разницы */
export const normText = (s: string): string => s.toLocaleLowerCase().replace(/ё/g, 'е').replace(/й/g, 'и');

const WORD = /[\p{L}\p{N}]+/gu;
const COMPOUND = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)+/gu;

/** Слова строки + слитные варианты через дефис: «push-up» → push, up, pushup */
function words(s: string): string[] {
  const n = normText(s);
  const out: string[] = [...(n.match(WORD) ?? [])];
  for (const c of n.match(COMPOUND) ?? []) out.push(c.replace(/-/g, ''));
  return out;
}

const RU_END = [
  'иями',
  'ями',
  'ами',
  'ого',
  'его',
  'ому',
  'ему',
  'ыми',
  'ими',
  'иях',
  'ией',
  'ешь',
  'ует',
  'ая',
  'яя',
  'ое',
  'ее',
  'ые',
  'ие',
  'ыи',
  'ии',
  'ои',
  'ом',
  'ем',
  'ам',
  'ям',
  'ах',
  'ях',
  'ов',
  'ев',
  'еи',
  'ую',
  'юю',
  'ия',
  'ья',
  'ье',
  'ть',
  'а',
  'я',
  'о',
  'е',
  'ы',
  'и',
  'у',
  'ю',
  'ь',
];
const EN_END = ['ings', 'ing', 'ies', 'es', 'ed', 's', 'e'];
const CYR = /[а-я]/;

/** Грубая основа слова: отрезать окончание, оставив хотя бы 3 буквы */
export function stem(w: string): string {
  const ends = CYR.test(w) ? RU_END : EN_END;
  for (const e of ends) if (w.length - e.length >= 3 && w.endsWith(e)) return w.slice(0, -e.length);
  return w;
}

/** Расстояние Дамерау — Левенштейна (с перестановкой соседних букв), с ранним выходом > max */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  let pp = new Array<number>(n + 1).fill(0);
  let p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const c = new Array<number>(n + 1);
    c[0] = i;
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(p[j]! + 1, c[j - 1]! + 1, p[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, pp[j - 2]! + 1);
      c[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    pp = p;
    p = c;
  }
  return p[n]!;
}

const EN_KEYS = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
const RU_KEYS = 'йцукенгшщзхъфывапролджэячсмитьбюё';
const TO_RU = new Map([...EN_KEYS].map((c, i) => [c, RU_KEYS[i]!]));
const TO_EN = new Map([...RU_KEYS].map((c, i) => [c, EN_KEYS[i]!]));

/** Слово, набранное не в той раскладке (ЙЦУКЕН ↔ QWERTY); null — переводить нечего */
export function swapLayout(raw: string): string | null {
  const s = raw.toLocaleLowerCase();
  if ([...s].every((c) => TO_RU.has(c) || /\d/.test(c)) && /[a-z]/.test(s))
    return [...s].map((c) => TO_RU.get(c) ?? c).join('');
  if ([...s].every((c) => TO_EN.has(c) || /\d/.test(c)) && /[а-яё]/.test(s))
    return [...s].map((c) => TO_EN.get(c) ?? c).join('');
  return null;
}

interface Tok {
  w: string;
  s: string;
}
const tok = (w: string): Tok => ({ w, s: stem(w) });

/** Насколько слово запроса похоже на слово упражнения: 0 — не похоже, 1 — то же слово */
function quality(q: Tok, t: Tok, strict = false): number {
  if (t.w === q.w) return 1;
  if (t.w.startsWith(q.w)) return q.w.length >= 3 ? 0.9 : 0.7;
  if (q.s === t.s) return 0.85;
  const [lo, hi] = q.s.length <= t.s.length ? [q.s, t.s] : [t.s, q.s];
  if (lo.length >= 4 && hi.startsWith(lo)) return 0.8;
  // мышцы и инвентарь — без подстрок и опечаток, иначе «махи» ≈ «маши(на)»
  if (strict) return 0;
  if (q.w.length >= 3 && t.w.includes(q.w)) return 0.5;
  if (q.w.length < 4) return 0;
  const max = q.w.length >= 8 ? 2 : 1;
  let d = editDistance(q.w, t.w, max);
  // опечатка в ещё недонабранном слове: «молотк» ≈ «молотковые», «ширачай» ≈ «широчайшие»
  if (d > max && q.w.length >= 5 && t.w.length > q.w.length)
    d = editDistance(q.w, t.w.slice(0, q.w.length), max);
  if (d > max) d = editDistance(q.s, t.s, max);
  return d <= max ? 0.65 - 0.1 * (d - 1) : 0;
}

interface Field {
  weight: number;
  toks: Tok[];
  strict: boolean;
}
interface Doc {
  fields: Field[];
  /** Целые фразы (название и синонимы) — бонус за совпадение всего запроса */
  phrases: { text: string; weight: number }[];
}

const phraseOf = (s: string) => words(s).join(' ');

export function makeDoc(f: SearchFields): Doc {
  const field = (list: string[] | undefined, weight: number): Field => ({
    weight,
    toks: [...new Set((list ?? []).flatMap(words))].map(tok),
    strict: weight < W_EN,
  });
  return {
    fields: [
      field([f.name], W_NAME),
      field(f.alt, W_ALT),
      field(f.en, W_EN),
      field(f.tags, W_TAGS),
      field(f.minor, W_MINOR),
    ].filter((x) => x.toks.length),
    phrases: [
      { text: phraseOf(f.name), weight: 1 },
      ...(f.alt ?? []).map((a) => ({ text: phraseOf(a), weight: 0.9 })),
      ...(f.en ?? []).map((a) => ({ text: phraseOf(a), weight: 0.7 })),
    ],
  };
}

interface QWord {
  variants: { t: Tok; k: number }[];
  stop: boolean;
}

export interface Query {
  words: QWord[];
  phrase: string;
  phraseSwapped: string | null;
}

export function parseQuery(raw: string): Query {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  const qs: QWord[] = [];
  for (const p of parts) {
    const main = words(p);
    const sw = swapLayout(p);
    // «,» и «.» в другой раскладке — буквы «б» и «ю»: если слово распалось иначе, вариант не берём
    const swWords = sw ? words(sw) : [];
    const alt = swWords.length === main.length ? swWords : [];
    main.forEach((w, i) => {
      const variants = [{ t: tok(w), k: 1 }];
      const a = alt[i];
      if (a && a !== w && a.length >= 2) variants.push({ t: tok(a), k: 0.95 });
      qs.push({ variants, stop: STOP.has(w) });
    });
  }
  const swapped = parts.map((p) => swapLayout(p) ?? p).join(' ');
  return {
    words: qs,
    phrase: phraseOf(raw),
    phraseSwapped: swapped !== raw.trim() ? phraseOf(swapped) : null,
  };
}

/** Релевантность упражнения запросу; 0 — не подходит */
export function scoreDoc(doc: Doc, q: Query): number {
  if (!q.words.length) return 1;
  const required = q.words.some((w) => !w.stop);
  const tags = doc.fields.find((f) => f.weight === W_TAGS);
  let total = 0;
  for (const qw of q.words) {
    let best = 0;
    for (const f of doc.fields) {
      if (Math.max(f.weight, f.weight === W_TAGS ? W_EXACT_TAG : 0) <= best) continue;
      for (const v of qw.variants) {
        for (const t of f.toks) {
          const qv = quality(v.t, t, f.strict);
          // точное название мышцы или инвентаря («спина», «турник») — почти как слово из названия
          const s = (qv === 1 && f.weight === W_TAGS ? W_EXACT_TAG : qv * f.weight) * v.k;
          if (s > best) best = s;
          if (best >= Math.max(f.weight, W_EXACT_TAG) * v.k) break;
        }
      }
    }
    if (!best && (qw.stop ? !required : true)) return 0;
    total += best;
    // запрос называет основную мышцу или инвентарь упражнения («грудь», «спина», «турник») — оно
    // выше тех, где это слово просто встречается в названии («тяга с упором в грудь»)
    if (tags && qw.variants.some((v) => tags.toks.some((t) => t.w === v.t.w))) total += 0.2;
  }
  // Весь запрос — начало или часть названия / синонима: «молотки», «жим от груди»
  let bonus = 0;
  const multi = q.words.length > 1;
  for (const ph of [q.phrase, q.phraseSwapped]) {
    if (!ph) continue;
    for (const p of doc.phrases) {
      // Одно слово уже засчитано выше: за «начинается с» бонус только у названия, за «содержит» —
      // только у запроса из нескольких слов (иначе синоним «squat to press» обгонит «Front squat»)
      const starts = (multi || p.weight === 1) && p.text.startsWith(ph);
      const b = p.text === ph ? 2 : starts ? 1.5 : multi && p.text.includes(ph) ? 0.8 : 0;
      if (b * p.weight > bonus) bonus = b * p.weight;
    }
  }
  return total + bonus;
}

/** Отбор и сортировка по релевантности (при равенстве — исходный порядок) */
export function rankByQuery<T>(list: T[], raw: string, doc: (x: T) => Doc): T[] {
  const q = parseQuery(raw);
  if (!q.words.length) return list;
  return list
    .map((x, i) => ({ x, i, s: scoreDoc(doc(x), q) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((r) => r.x);
}
