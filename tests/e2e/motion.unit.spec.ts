import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * Единая система движения (docs/ARCHITECTURE.md, «Анимации»): токены в motion.css, длительности
 * 150–350 мс, компоненты не задают свои цифры, анимируются только transform и opacity.
 */
const css = (f: string) => readFileSync(new URL(`../../src/styles/${f}`, import.meta.url), 'utf8');
const FILES = ['base.css', 'components.css', 'screens.css', 'features.css', 'layout.css', 'motion.css'];
const motion = css('motion.css');

const token = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(motion)?.[1]?.trim();

test('motion tokens exist and stay in 150–350 ms', () => {
  for (const n of ['--dur-fast', '--dur-base', '--dur-slow', '--dur-out']) {
    const v = token(n);
    expect(v, n).toMatch(/^\d+ms$/);
    const ms = parseInt(v!, 10);
    expect(ms, n).toBeGreaterThanOrEqual(150);
    expect(ms, n).toBeLessThanOrEqual(350);
  }
  expect(parseInt(token('--dur-fast')!)).toBeLessThan(parseInt(token('--dur-base')!));
  expect(parseInt(token('--dur-base')!)).toBeLessThan(parseInt(token('--dur-slow')!));
  for (const n of ['--ease-out', '--ease-in-out']) expect(token(n), n).toMatch(/^cubic-bezier\(/);
  // ease-out без отскока: вторая и четвёртая координаты не выходят за 1
  const nums = token('--ease-out')!
    .match(/[\d.]+/g)!
    .map(Number);
  expect(Math.max(...nums)).toBeLessThanOrEqual(1);
  // OUT_MS в коде совпадает с --dur-out
  const ts = readFileSync(new URL('../../src/lib/motion.ts', import.meta.url), 'utf8');
  expect(Number(/OUT_MS = (\d+)/.exec(ts)?.[1])).toBe(parseInt(token('--dur-out')!));
});

test('components use tokens, not their own durations (except documented ones)', () => {
  // Разрешены: секундные ритмы бесконечных подсветок (установка, пульс), вспышка таймера,
  // линейный шаг полосы таймера (250 мс = тик), смена поз схемы (3,2 с), кольцо отметки подхода.
  const allowed = [
    /250ms linear/,
    /\b0\.9s\b/,
    /\b1\.[468]s\b/,
    /\b3\.2s\b/,
    /\b1\.2s\b/,
    /420ms/,
    /\b0\.1s linear\b/,
    /260ms/,
  ];
  const bad: string[] = [];
  for (const f of FILES) {
    for (const [i, line] of css(f).split('\n').entries()) {
      if (!/(transition|animation)(-duration)?\s*:/.test(line) && !/^\s+(transform|opacity) \d/.test(line))
        continue;
      const raw = line.match(/\b\d+(\.\d+)?m?s\b/g);
      if (!raw) continue;
      if (allowed.some((r) => r.test(line))) continue;
      if (/0s !important/.test(line)) continue;
      bad.push(`${f}:${i + 1}: ${line.trim()}`);
    }
  }
  expect(bad).toEqual([]);
});

test('only transform and opacity are animated', () => {
  const bad: string[] = [];
  const okProps = /^(transform|opacity|background-color|border-color|color|stroke-dashoffset)$/;
  for (const f of FILES) {
    const text = css(f);
    // transition: свойства через запятую
    for (const m of text.matchAll(/transition:\s*([^;]+);/g)) {
      for (const part of m[1]!.split(',')) {
        const prop = part.trim().split(/\s+/)[0]!;
        if (prop === 'none') continue;
        if (!okProps.test(prop)) bad.push(`${f}: transition ${prop}`);
      }
    }
    // keyframes: только transform и opacity
    for (const m of text.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)) {
      for (const d of m[2]!.matchAll(/([a-z-]+)\s*:/g)) {
        if (!/^(transform|opacity)$/.test(d[1]!)) bad.push(`${f}: @keyframes ${m[1]} → ${d[1]}`);
      }
    }
  }
  // цвета (фон, обводка, текст) меняются плавно только у мелких элементов: кнопки, поля, вкладки
  expect(bad).toEqual([]);
});

test('reduced motion and the "Off" setting zero all durations; smooth scroll is off there', () => {
  expect(motion).toMatch(
    /:root\[data-motion='off'\] \*[\s\S]*?animation-duration: 0s !important[\s\S]*?transition-duration: 0s !important[\s\S]*?scroll-behavior: auto !important/,
  );
  expect(motion).toMatch(
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*:root:not\(\[data-motion='on'\]\) \*/,
  );
});

test('hover styles only for devices with hover', () => {
  for (const f of FILES) {
    const text = css(f);
    const lines = text.split('\n');
    lines.forEach((l, i) => {
      if (!/:hover/.test(l)) return;
      const before = lines.slice(Math.max(0, i - 3), i).join('\n');
      expect(before, `${f}:${i + 1}`).toMatch(/@media \(hover: hover\)/);
    });
  }
});
