import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { headGradient, previewOf, resolveThemes, type ThemeDef } from './src/themes/derive.mjs';
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
 * virtual:themes.css — CSS-переменные всех тем (src/themes/themes.json; цветные темы выводятся
 * из рецепта в src/themes/derive.mjs). Без data-theme и при data-theme="auto" — classic-light /
 * classic-dark по системной теме (тема по умолчанию — «Авто»).
 * virtual:themes-meta — немного цветов каждой темы для превью в настройках и theme-color.
 */
function themesCss(): Plugin {
  const css = 'virtual:themes.css';
  const meta = 'virtual:themes-meta';
  const file = new URL('./src/themes/themes.json', import.meta.url);
  const load = () => resolveThemes(JSON.parse(readFileSync(file, 'utf8')));
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
      `--on-fill:${t.onFill}`,
      `--card-btn:${t.cardBtn}`,
      `--card-btn-ink:${t.cardBtnInk}`,
      // Активная вкладка: в темах по рецепту — всегда первый акцент, в остальных — цвет дня
      `--nav-on:${t.grad ? t.days[0]!.ink : 'var(--accent-ink)'}`,
      // Тени: в светлых темах — мягкие; в тёмных вместо тени тонкая светлая обводка
      ...(t.scheme === 'dark'
        ? [`--shadow:0 0 0 1px ${t.line}`, `--shadow-pop:0 0 0 1px ${t.line}`]
        : [
            '--shadow:0 1px 2px rgba(20,20,30,.04),0 8px 24px rgba(20,20,30,.06)',
            '--shadow-pop:0 16px 48px rgba(20,20,30,.2)',
          ]),
      ...t.days.flatMap((d, i) => {
        const [g0, g1] = headGradient(t, i);
        return [
          `--c${i + 1}:${d.c}`,
          `--c${i + 1}-fill:${d.fill}`,
          `--c${i + 1}-ink:${d.ink}`,
          // Градиент — на главной карточке и крупных акцентных элементах, не под плотным текстом
          `--c${i + 1}-bg:${g0 === g1 ? d.fill : `linear-gradient(135deg,${g0},${g1})`}`,
        ];
      }),
    ].join(';');
  return {
    name: 'themes-css',
    resolveId: (s) => (s === css ? '\0' + css + '.css' : s === meta ? '\0' + meta : null),
    load(s) {
      if (s === '\0' + meta) {
        this.addWatchFile(file.pathname);
        const out = Object.fromEntries(Object.entries(load()).map(([id, t]) => [id, previewOf(t)]));
        return `export default ${JSON.stringify(out)};`;
      }
      if (s !== '\0' + css + '.css') return null;
      this.addWatchFile(file.pathname);
      const themes = load();
      const out = Object.entries(themes).map(([name, t]) => `:root[data-theme="${name}"]{${vars(t)}}`);
      out.unshift(`:root{${vars(themes['classic-light']!)}}`);
      out.push(
        `@media (prefers-color-scheme:dark){:root:not([data-theme]),:root[data-theme="auto"]{${vars(themes['classic-dark']!)}}}`,
      );
      return out.join('\n');
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
