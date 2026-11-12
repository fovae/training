#!/usr/bin/env node
/**
 * Собирает лицензии всего, что попадает в приложение: зависимости из package.json → dependencies
 * (рекурсивно) и модули Workbox, которые vite-plugin-pwa встраивает в sw.js.
 * Результат — src/content/generated/licenses.json (не коммитится, создаётся при сборке).
 * Работает офлайн: тексты берутся из node_modules.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
/** Встраиваются в service worker при generateSW */
const EXTRA = ['workbox-core', 'workbox-precaching', 'workbox-routing'];

function findPkgDir(name, from) {
  let dir = from;
  for (;;) {
    const p = join(dir, 'node_modules', name);
    if (existsSync(join(p, 'package.json'))) return p;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function licenseText(dir) {
  const f = readdirSync(dir).find(
    (x) => /^(licen[sc]e|copying)(\.(md|txt))?$/i.test(x) || /^OFL(\.txt)?$/i.test(x),
  );
  return f ? readFileSync(join(dir, f), 'utf8').trim() : null;
}

const seen = new Map();
function visit(name, from) {
  if (seen.has(name)) return;
  const dir = findPkgDir(name, from);
  if (!dir) throw new Error(`licenses: не найден пакет ${name}`);
  const p = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const license = typeof p.license === 'string' ? p.license : (p.license?.type ?? 'UNKNOWN');
  const text = licenseText(dir);
  if (!text) throw new Error(`licenses: у ${name} нет файла лицензии`);
  seen.set(name, { name, version: p.version, license, text });
  for (const dep of Object.keys(p.dependencies ?? {})) visit(dep, dir);
}

for (const dep of Object.keys(pkg.dependencies ?? {})) visit(dep, root);
for (const dep of EXTRA) visit(dep, root);

const list = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
const out = join(root, 'src/content/generated');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'licenses.json'), JSON.stringify(list, null, 1) + '\n');
console.log(`licenses: ${list.length} пакетов → src/content/generated/licenses.json`);
for (const l of list) console.log(`  ${l.name}@${l.version} — ${l.license}`);
