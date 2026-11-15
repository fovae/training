/**
 * Поиск упражнений: устойчив к опечаткам, словоформам, сленгу и неверной раскладке.
 *
 * Как ищется каждое слово запроса (лучшее совпадение из всех полей упражнения):
 *  - точное слово, начало слова (набор ещё идёт), одинаковая основа («молотки» ≈ «молотковые»,
 *    «грудь» ≈ «груди», «curls» ≈ «curl»), подстрока внутри слова;
 *  - опечатка: 1 ошибка в слове от 4 букв, 2 — от 8 (замена, пропуск, лишняя, перестановка букв);
 *  - слово, набранное не в той раскладке («ghbctl» → «присед», «ыйгфе» → «squat»).
 * Поля с весами: название 1, синонимы/сленг на языке интерфейса 0.9, английские названия и id 0.75,
 * основные мышцы с инвентарём 0.7 (точное название мышцы — 0.9, совпадение с основной мышцей или
 * инвентарём с учётом словоформ — ещё +0.2), второстепенные мышцы 0.3. Целиком совпавший запрос —
 * бонус: равен названию ×2, начало названия ×1.5, часть фразы ×0.8 (у синонимов — с их весом).
 * Предлоги («на», «от», «with»…) не обязательны; все остальные слова запроса должны найтись.
 *
 * Уровни (tiers). Если каждое значимое слово запроса называет мышцу, группу мышц или инвентарь
 * (словарь — TagLexicon: подписи на языке интерфейса + синонимы из catalog/aliases.ts; многословные
 * синонимы ищутся первыми: «бицепс бедра» — это hamstrings, а не biceps), результаты идут блоками:
 *  0 — запрос равен названию или синониму упражнения («кроссовер», «брусья», «bench»);
 *  1 — мышца или инвентарь ОСНОВНЫЕ (primaryMuscles / equipment);
 *  2 — слово есть в названии или синониме, но мышца не основная («тяга с акцентом на бицепс»);
 *  3 — мышца второстепенная;
 *  4 — остальные совпадения.
 * «Мышца + инвентарь» («бицепс гантели»): уровни сравниваются сначала по мышце, затем по инвентарю;
 * упражнения на основную мышцу с другим инвентарём тоже показываются (после подходящих).
 * Внутри уровня: мышца главная (первая в основных) → очки → порядок фильтра мышц → место в каталоге
 * (базовые раньше вариаций) → название → id. Запрос-название («молотки», «жим лёжа») — по очкам, при равенстве — так же. Порядок
 * переданного списка на результат не влияет.
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
  /** Постоянное место упражнения в каталоге (не в переданном списке) — порядок при равенстве */
  order?: number;
  /** id основных мышц (по порядку), инвентаря и второстепенных мышц — для уровней */
  primaryIds?: string[];
  equipIds?: string[];
  minorIds?: string[];
}

/** Мышцы и инвентарь с их названиями — чтобы понять, что запрос называет мышцу (см. уровни) */
export interface TagEntry {
  id: string;
  muscle: boolean;
  /** Подпись и синонимы, каждая фраза отдельно: «бицепс», «бицепс бедра», «biceps» */
  names: string[];
}
export interface TagLexicon {
  entries: { id: string; muscle: boolean; phrases: Tok[][] }[];
}

export function makeLexicon(list: TagEntry[]): TagLexicon {
  return {
    entries: list.map((e) => ({
      id: e.id,
      muscle: e.muscle,
      phrases: [...new Set(e.names.map(phraseOf))].filter(Boolean).map((p) => p.split(' ').map(tok)),
    })),
  };
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
export interface Doc {
  fields: Field[];
  /** Целые фразы (название и синонимы) — бонус за совпадение всего запроса */
  phrases: { text: string; weight: number }[];
  primary: string[];
  equip: string[];
  minor: string[];
  /** Для устойчивого порядка при равенстве: место в каталоге (базовые упражнения раньше вариаций),
   *  затем название и id */
  order: number;
  sortName: string;
  key: string;
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
    primary: f.primaryIds ?? [],
    equip: f.equipIds ?? [],
    minor: f.minorIds ?? [],
    order: f.order ?? 0,
    sortName: normText(f.name),
    key: f.en?.[0] ?? '',
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
    if (tags && qw.variants.some((v) => tags.toks.some((t) => t.w === v.t.w || t.s === v.t.s))) total += 0.2;
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

// ---------- уровни: запрос называет мышцу или инвентарь ----------

/** Что называет слово (или несколько слов подряд) запроса: набор мышц или инвентаря */
export interface Concept {
  ids: Set<string>;
  muscle: boolean;
  words: QWord[];
}

/** Похожесть слова запроса на слово из словаря мышц: без подстрок; опечатки — от 4 букв */
function tagQuality(qw: QWord, t: Tok): number {
  let best = 0;
  for (const v of qw.variants) {
    const s = quality(v.t, t) * v.k;
    if (s > best) best = s;
  }
  return best >= 0.55 ? best : 0;
}

/**
 * Если каждое значимое слово запроса — мышца, группа мышц или инвентарь, возвращает их по порядку;
 * иначе null (запрос-название, уровни не нужны). Многословные названия — первыми и целиком.
 */
export function tagConcepts(q: Query, lex: TagLexicon): Concept[] | null {
  const out: Concept[] = [];
  const ws = q.words;
  let i = 0;
  while (i < ws.length) {
    if (ws[i]!.stop) {
      i++;
      continue;
    }
    // лучшая длина фразы, начиная с i (сначала длинные), и все записи с этой длиной
    let len = 0;
    let found: { id: string; muscle: boolean; s: number }[] = [];
    for (const e of lex.entries) {
      for (const p of e.phrases) {
        if (p.length < len || i + p.length > ws.length) continue;
        let s = 1;
        for (let j = 0; j < p.length && s; j++) s = Math.min(s, tagQuality(ws[i + j]!, p[j]!));
        if (!s) continue;
        if (p.length > len) {
          len = p.length;
          found = [];
        }
        found.push({ id: e.id, muscle: e.muscle, s });
      }
    }
    if (!found.length) return null;
    // точные и словоформы важнее опечаток: «бицепс» не тянет похожие по опечатке мышцы
    const top = Math.max(...found.map((f) => f.s));
    const keep = found.filter((f) => f.s >= Math.min(top, 0.8));
    out.push({
      ids: new Set(keep.map((f) => f.id)),
      muscle: keep.some((f) => f.muscle),
      words: ws.slice(i, i + len),
    });
    i += len;
  }
  return out.length ? out.sort((a, b) => Number(b.muscle) - Number(a.muscle)) : null;
}

const NAMED = new Set([W_NAME, W_ALT, W_EN]);

/** Уровень упражнения для одного понятия запроса: 1 основная … 4 остальное */
function conceptLevel(doc: Doc, c: Concept): number {
  if (doc.primary.some((m) => c.ids.has(m)) || doc.equip.some((m) => c.ids.has(m))) return 1;
  const named = doc.fields.filter((f) => NAMED.has(f.weight));
  const inName = c.words.every((qw) =>
    qw.variants.some((v) => named.some((f) => f.toks.some((t) => quality(v.t, t, true) >= 0.8))),
  );
  if (inName) return 2;
  if (doc.minor.some((m) => c.ids.has(m))) return 3;
  return 4;
}

const collator = typeof Intl === 'object' ? new Intl.Collator(undefined, { sensitivity: 'base' }) : null;
const byText = (a: string, b: string) => (collator ? collator.compare(a, b) : a < b ? -1 : a > b ? 1 : 0);

export interface RankOptions<T> {
  /** Словарь мышц и инвентаря — для уровней; без него только очки */
  lexicon?: TagLexicon;
  /** Дополнительный порядок при равных уровне и очках (например, выбранный фильтр мышцы) */
  tiebreak?: (x: T) => number;
}

/**
 * Отбор и сортировка: уровень (если запрос называет мышцу/инвентарь) → главная мышца → очки →
 * tiebreak → название → id. От исходного порядка списка результат не зависит.
 */
export function rankByQuery<T>(list: T[], raw: string, doc: (x: T) => Doc, opts: RankOptions<T> = {}): T[] {
  const q = parseQuery(raw);
  if (!q.words.length) return list;
  const concepts = opts.lexicon ? tagConcepts(q, opts.lexicon) : null;
  const firstMuscle = concepts?.find((c) => c.muscle);
  const rows: { x: T; d: Doc; s: number; tier: number[]; main: number; tb: number }[] = [];
  for (const x of list) {
    const d = doc(x);
    const s = scoreDoc(d, q);
    let tier: number[] = [];
    let main = 0;
    if (concepts) {
      const exact = d.phrases.some(
        (p) => p.weight >= 0.9 && (p.text === q.phrase || p.text === q.phraseSwapped),
      );
      tier = exact ? [0] : concepts.map((c) => conceptLevel(d, c));
      // основная мышца без нужного инвентаря («бицепс гантели» → подъём штанги) — тоже показываем
      if (!s && !(firstMuscle && !exact && tier[concepts.indexOf(firstMuscle)] === 1)) continue;
      const c0 = concepts[0]!;
      const list0 = c0.muscle ? d.primary : d.equip;
      main = c0.ids.has(list0[0] ?? '') ? 0 : 1;
    } else if (!s) continue;
    rows.push({ x, d, s, tier, main, tb: opts.tiebreak?.(x) ?? 0 });
  }
  const cmpTier = (a: number[], b: number[]) => {
    for (let k = 0; k < Math.max(a.length, b.length); k++) {
      const v = (a[k] ?? 0) - (b[k] ?? 0);
      if (v) return v;
    }
    return 0;
  };
  return rows
    .sort(
      (a, b) =>
        cmpTier(a.tier, b.tier) ||
        a.main - b.main ||
        b.s - a.s ||
        a.tb - b.tb ||
        a.d.order - b.d.order ||
        byText(a.d.sortName, b.d.sortName) ||
        byText(a.d.key, b.d.key),
    )
    .map((r) => r.x);
}
