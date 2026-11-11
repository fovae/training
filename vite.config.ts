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
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg', 'splash/*.png'],
      manifest: {
        id: base,
        name: 'Тренировочная программа · Сплит 3+1',
        short_name: 'Тренировки',
        description: 'Сплит 3+1: журнал тренировок, таймер отдыха и прогресс. Работает офлайн.',
        lang: 'ru',
        dir: 'ltr',
        start_url: `${base}#/today`,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: BRAND.light.bg,
        background_color: BRAND.light.bg,
        categories: ['health', 'fitness', 'sports'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Весь app shell + шрифт Manrope (кириллица и латиница) + иконки + splash
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
