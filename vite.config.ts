import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { IOS_DEVICES, splashName, splashMedia, BRAND } from './scripts/ios-devices.mjs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// Для GitHub Pages: BASE_PATH=/имя-репозитория/ (выставляется в workflow).
const base = process.env.BASE_PATH ?? '/';

/**
 * virtual:legal-meta — версии и даты юридических документов из frontmatter
 * src/content/legal/en/*.md. Версии нигде не хардкодятся.
 */
function legalMeta(): Plugin {
  const id = 'virtual:legal-meta';
  const dir = new URL('./src/content/legal/en/', import.meta.url);
  const read = (name: string) => {
    const src = readFileSync(new URL(name + '.md', dir), 'utf8');
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(src)?.[1] ?? '';
    const get = (k: string) => new RegExp(`^${k}:\\s*"?([^"\\n]+)"?`, 'm').exec(fm)?.[1];
    const version = get('version');
    const updated = get('updated');
    if (!version || !updated) throw new Error(`legal-meta: нет version/updated в ${name}.md`);
    return { version, updated };
  };
  return {
    name: 'legal-meta',
    resolveId: (s) => (s === id ? '\0' + id : null),
    load(s) {
      if (s !== '\0' + id) return null;
      this.addWatchFile(new URL('privacy.md', dir).pathname);
      this.addWatchFile(new URL('terms.md', dir).pathname);
      return `export default ${JSON.stringify({ privacy: read('privacy'), terms: read('terms') })};`;
    },
  };
}

/**
 * virtual:themes.css — CSS-переменные всех тем из src/themes/themes.json.
 * Без data-theme — classic-orange; data-theme="auto" — classic-light / classic-dark по системе.
 */
interface ThemeDay {
  c: string;
  fill: string;
  fill2?: string;
  ink: string;
}
interface ThemeDef {
  scheme: 'light' | 'dark';
  bg: string;
  card: string;
  soft: string;
  line: string;
  ink: string;
  muted: string;
  danger: string;
  dangerFill: string;
  chart: string[];
  days: ThemeDay[];
}
function themesCss(): Plugin {
  const id = 'virtual:themes.css';
  const file = new URL('./src/themes/themes.json', import.meta.url);
  const vars = (t: ThemeDef) =>
    [
      `color-scheme:${t.scheme}`,
      `--bg:${t.bg}`,
      `--card:${t.card}`,
      `--soft:${t.soft}`,
      `--line:${t.line}`,
      `--ink:${t.ink}`,
      `--muted:${t.muted}`,
      `--danger:${t.danger}`,
      `--danger-fill:${t.dangerFill}`,
      `--chart-1:${t.chart[0]}`,
      `--chart-2:${t.chart[1]}`,
      t.scheme === 'dark'
        ? '--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.25)'
        : '--shadow:0 1px 2px rgba(20,20,30,.04),0 8px 24px rgba(20,20,30,.06)',
      ...t.days.flatMap((d, i) => [
        `--c${i + 1}:${d.c}`,
        `--c${i + 1}-fill:${d.fill}`,
        `--c${i + 1}-ink:${d.ink}`,
        // Градиент — только на крупных цветных карточках (шапка дня), не под плотным текстом
        `--c${i + 1}-bg:${d.fill2 ? `linear-gradient(135deg,${d.fill},${d.fill2})` : d.fill}`,
      ]),
    ].join(';');
  return {
    name: 'themes-css',
    resolveId: (s) => (s === id ? '\0' + id + '.css' : null),
    load(s) {
      if (s !== '\0' + id + '.css') return null;
      this.addWatchFile(file.pathname);
      const { themes } = JSON.parse(readFileSync(file, 'utf8')) as { themes: Record<string, ThemeDef> };
      const css = Object.entries(themes).map(([name, t]) =>
        name === 'classic-orange'
          ? `:root,:root[data-theme="classic-orange"]{${vars(t)}}`
          : `:root[data-theme="${name}"]{${vars(t)}}`,
      );
      css.push(`:root[data-theme="auto"]{${vars(themes['classic-light']!)}}`);
      css.push(
        `@media (prefers-color-scheme:dark){:root[data-theme="auto"]{${vars(themes['classic-dark']!)}}}`,
      );
      return css.join('\n');
    },
  };
}

/** Вставляет iOS splash-экраны (светлые и тёмные) с учётом base. */
function iosSplash(): Plugin {
  return {
    name: 'ios-splash-links',
    transformIndexHtml() {
      return IOS_DEVICES.flatMap((d) =>
        (['light', 'dark'] as const).map((theme) => ({
          tag: 'link',
          attrs: {
            rel: 'apple-touch-startup-image',
            media: splashMedia(d, theme),
            href: `${base}splash/${splashName(d, theme)}`,
          },
          injectTo: 'head' as const,
        })),
      );
    },
  };
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    preact(),
    iosSplash(),
    legalMeta(),
    themesCss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg', 'icons/*.ico', 'splash/*.png'],
      manifest: {
        id: base,
        name: 'Simple Training',
        short_name: 'Training',
        description:
          'Plan your training week and log your sets. Works offline; your data stays on your device.',
        lang: 'en',
        dir: 'ltr',
        start_url: `${base}#/today`,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        // Тема по умолчанию — «Авто»; в манифесте один цвет, берём светлую (Classic Light)
        theme_color: BRAND.light.bg,
        background_color: BRAND.light.bg,
        categories: ['health', 'fitness', 'sports'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Весь app shell (включая словари языков — это JS-чанки) + шрифт Manrope (латиница, кириллица
        // и их расширения для польского и украинского) + иконки + splash
        // (splash-экраны лёгкие, ~15 КБ каждый — пусть будут доступны офлайн).
        globPatterns: ['**/*.{js,css,html,woff2}'],
        globIgnores: ['**/*-greek-*', '**/*-vietnamese-*'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: ['es2022', 'safari16'],
    cssTarget: ['safari16'],
  },
});
