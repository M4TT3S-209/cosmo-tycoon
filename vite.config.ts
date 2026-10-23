import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // relative Pfade: läuft unter https://<name>.github.io/<repo>/ genauso wie lokal
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'Cosmo Tycoon',
        short_name: 'Cosmo Tycoon',
        description: 'Baue dein galaktisches Bergbau-Imperium – vom Weltraumschrott bis zum Schwarzen Loch.',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#050716',
        theme_color: '#060818',
        categories: ['games'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
