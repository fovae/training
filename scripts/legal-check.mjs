#!/usr/bin/env node
/** Роняет сборку, если в юридических текстах остались метки [OWNER… или [PLACEHOLDER… */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../src/content/legal/', import.meta.url).pathname;
const found = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.md'))
      readFileSync(p, 'utf8')
        .split('\n')
        .forEach(
          (line, i) => /\[(OWNER|PLACEHOLDER)/.test(line) && found.push(`${p}:${i + 1}: ${line.trim()}`),
        );
  }
};
walk(dir);
if (found.length) {
  console.error(
    'legal:check — в юридических текстах остались метки:\n' + found.map((x) => '  • ' + x).join('\n'),
  );
  process.exit(1);
}
console.log('legal:check — OK: меток [OWNER / [PLACEHOLDER нет');
