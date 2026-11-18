import { createHash } from 'node:crypto';
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
 * Адрес сайта — одно место для canonical, og:url и картинок превью (index.html, %VITE_SITE_URL%).
 * С 0.1.0 — свой домен на Cloudflare Pages, приложение в корне (docs/ARCHITECTURE.md, «Хостинг и защита»).
 */
const SITE_URL = 'https://simpletraining.app/';
process.env.VITE_SITE_URL = SITE_URL;

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

/**
 * Предзагрузка основного шрифта (Manrope, латиница) со своего домена: текст сразу в нужном шрифте,
 * без прыжка вёрстки. Кириллица грузится по unicode-range, когда нужна.
 */
function preloadFont(): Plugin {
  return {
    name: 'preload-font',
    apply: 'build',
    transformIndexHtml(_html, ctx) {
      const file = Object.keys(ctx.bundle ?? {}).find((f) => /manrope-latin-wght-normal-.*\.woff2$/.test(f));
      if (!file) return [];
      return [
        {
          tag: 'link',
          attrs: { rel: 'preload', href: base + file, as: 'font', type: 'font/woff2', crossorigin: '' },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

/**
 * Хостинг (Cloudflare Pages, 0.1.0): из публичной index.html убираются служебные комментарии (HTML и
 * строки-комментарии встроенного загрузочного скрипта), а в dist/_headers пишутся заголовки
 * безопасности и кэширования. CSP — только свой домен; встроенный загрузочный скрипт разрешён по
 * SHA-256 его итогового текста (считается здесь, после всех правок HTML), без 'unsafe-inline'.
 */
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
function hostingHeaders(scriptHashes: string[]): string {
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(' ')}`,
    // стили: встроенный <style> заставки и style у элементов (цвета образцов тем, схемы упражнений)
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "media-src 'self' data: blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
  return `# Создаётся при сборке (vite.config.ts, hostingHeaders) — не править вручную
/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), hid=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=(), screen-wake-lock=(self)
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload

# Файлы с хэшем в имени — навсегда
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/workbox-*.js
  Cache-Control: public, max-age=31536000, immutable

# Точка входа, service worker и манифест — всегда проверять новую версию
/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/manifest.webmanifest
  Cache-Control: no-cache

# Служебный адрес Cloudflare (*.pages.dev) — не индексировать: основной адрес один
https://:project.pages.dev/*
  X-Robots-Tag: noindex
`;
}
function hosting(): Plugin {
  return {
    name: 'hosting',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html.replace(/<!--[\s\S]*?-->\s*/g, '').replace(INLINE_SCRIPT, (tag: string, body: string) =>
          tag.replace(
            body,
            body
              .split('\n')
              .filter((l) => !/^\s*\/\//.test(l))
              .join('\n'),
          ),
        ),
    },
    generateBundle(_opts, bundle) {
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') return;
      const hashes = [...String(html.source).matchAll(INLINE_SCRIPT)].map(
        (m) => `'sha256-${createHash('sha256').update(m[1]!).digest('base64')}'`,
      );
      this.emitFile({ type: 'asset', fileName: '_headers', source: hostingHeaders(hashes) });
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
    preloadFont(),
    hosting(),
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
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    // карты исходников в публичную сборку не попадают; код минифицируется (по умолчанию)
    sourcemap: false,
    // шрифты — всегда отдельными файлами (не data: в CSS): CSP font-src 'self' без data:
    assetsInlineLimit: (file) => (file.endsWith('.woff2') ? false : undefined),
    target: ['es2022', 'safari16'],
    cssTarget: ['safari16'],
  },
});
