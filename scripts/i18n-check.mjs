#!/usr/bin/env node
/**
 * Проверка переводов. Падает (exit 1), если:
 *  - у какого-то языка нет ключа, который есть в en (или есть лишний);
 *  - у множественного числа нет формы, нужной языку по Intl.PluralRules;
 *  - в коде используется ключ t('…'), которого нет в en;
 *  - у упражнения из библиотеки или шаблона нет текстов.
 * Запуск: npm run i18n:check
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const LOC = join(root, 'src/i18n/locales');
const SRC = join(root, 'src');
const PLURAL = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
const errors = [];

const isPlural = (v) =>
  v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length &&
  Object.keys(v).every((k) => PLURAL.has(k));

/** key → { kind: 'str' | 'plural', forms? } */
function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(key, { kind: 'str', value: v });
    else if (Array.isArray(v)) v.forEach((s, i) => out.set(`${key}.${i}`, { kind: 'str', value: s }));
    else if (isPlural(v)) out.set(key, { kind: 'plural', forms: v });
    else if (v && typeof v === 'object') flatten(v, key, out);
    else errors.push(`${prefix}: недопустимое значение у «${key}»`);
  }
  return out;
}

function loadLocale(code) {
  const dir = join(LOC, code);
  const all = new Map();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    let data;
    try {
      data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    } catch (e) {
      errors.push(`${code}/${f}: невалидный JSON — ${e.message}`);
      continue;
    }
    for (const [k, v] of flatten(data)) {
      if (all.has(k)) errors.push(`${code}: ключ «${k}» объявлен дважды`);
      all.set(k, v);
    }
  }
  return all;
}

const intlOf = { en: 'en-GB', ru: 'ru-RU', uk: 'uk-UA', pl: 'pl-PL', 'zh-Hans': 'zh-Hans' };
const codes = readdirSync(LOC).filter((d) => statSync(join(LOC, d)).isDirectory());
if (!codes.includes('en')) errors.push('нет словаря en — он источник истины');
const dicts = Object.fromEntries(codes.map((c) => [c, loadLocale(c)]));
const en = dicts.en ?? new Map();

// 1. Полнота языков относительно en
for (const code of codes) {
  if (code === 'en') continue;
  const d = dicts[code];
  for (const k of en.keys()) if (!d.has(k)) errors.push(`${code}: нет ключа «${k}»`);
  for (const k of d.keys()) if (!en.has(k)) errors.push(`${code}: лишний ключ «${k}» (нет в en)`);
}

// 2. Формы множественного числа и плейсхолдеры
const vars = (s) =>
  [...s.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(',');
for (const code of codes) {
  const need = new Intl.PluralRules(intlOf[code] ?? code).resolvedOptions().pluralCategories;
  for (const [k, v] of dicts[code]) {
    const ref = en.get(k);
    if (v.kind === 'plural') {
      for (const cat of need) if (!(cat in v.forms)) errors.push(`${code}: «${k}» — нет формы «${cat}»`);
      if (!('other' in v.forms)) errors.push(`${code}: «${k}» — нет формы «other»`);
    }
    if (ref && ref.kind !== v.kind) errors.push(`${code}: «${k}» — тип отличается от en`);
    if (ref?.kind === 'str' && v.kind === 'str' && vars(ref.value) !== vars(v.value))
      errors.push(`${code}: «${k}» — плейсхолдеры {…} отличаются от en`);
  }
}

// 3. Ключи, используемые в коде
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(f)) out.push(p);
  }
  return out;
}
const enKeys = [...en.keys()];
const prefixOk = (re) => enKeys.some((k) => re.test(k));
for (const file of walk(SRC)) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(root, file);
  for (const m of src.matchAll(/\bt(?:List)?\(\s*'([^']+)'/g)) {
    const k = m[1];
    const listOk = enKeys.some((x) => x.startsWith(k + '.'));
    if (!en.has(k) && !listOk) errors.push(`${rel}: ключ «${k}» не найден в en`);
  }
  for (const m of src.matchAll(/\bt(?:List)?\(\s*`([^`]+)`/g)) {
    const pattern = m[1].replace(/[.*+?^()|[\]\\]/g, '\\$&').replace(/\$\\\{[^}]*\}|\$\{[^}]*\}/g, '[^.]+');
    if (!prefixOk(new RegExp('^' + pattern + '(\\.|$)')))
      errors.push(`${rel}: шаблон ключа «${m[1]}» не найден в en`);
  }
  // Ключи, записанные строкой в данных (шаблоны: 'tpl.…')
  for (const m of src.matchAll(/'((?:tpl|advice)\.[\w.-]+)'/g)) {
    if (!en.has(m[1])) errors.push(`${rel}: ключ «${m[1]}» не найден в en`);
  }
}

// 4. Тексты всех упражнений библиотеки
const CAT = join(SRC, 'data/catalog');
const exSrc = readdirSync(CAT)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => readFileSync(join(CAT, f), 'utf8'))
  .join('\n');
let exCount = 0;
for (const m of exSrc.matchAll(/make\(\{\s*id: '([\w-]+)'[\s\S]*?cues: (\d+),\s*mistakes: (\d+)/g)) {
  exCount++;
  const [, id, cues, mistakes] = m;
  const need = [`ex.${id}.name`, `ex.${id}.desc`, `ex.${id}.safety`];
  for (let i = 0; i < +cues; i++) need.push(`ex.${id}.cues.${i}`);
  for (let i = 0; i < +mistakes; i++) need.push(`ex.${id}.mistakes.${i}`);
  for (const k of need) if (!en.has(k)) errors.push(`упражнение ${id}: нет «${k}» в en`);
  if (en.has(`ex.${id}.cues.${cues}`)) errors.push(`упражнение ${id}: в словаре больше cues, чем ${cues}`);
  if (en.has(`ex.${id}.mistakes.${mistakes}`))
    errors.push(`упражнение ${id}: в словаре больше mistakes, чем ${mistakes}`);
}

const makes = (exSrc.match(/\bmake\(\{/g) ?? []).length;
if (!exCount || exCount !== makes)
  errors.push(
    `упражнения: разобрано ${exCount} из ${makes} записей make({…}) — обнови регулярку в i18n-check`,
  );

if (errors.length) {
  console.error(`i18n:check — ошибок: ${errors.length}\n` + errors.map((e) => '  • ' + e).join('\n'));
  process.exit(1);
}
console.log(`i18n:check — OK: ${codes.join(', ')} · ${en.size} ключей · упражнений: ${exCount}`);
