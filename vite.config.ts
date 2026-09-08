import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Vitest 3 bundles its own Vite type definitions; cast keeps the existing
  // Vite 8 React plugin compatible at the config boundary.
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Orch.Weather',
        short_name: 'Orch.Weather',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f0f4f8',
        theme_color: '#51c49f',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ] as any,
  build: {
    target: 'es2020',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
  // server: {
  //   proxy: {
  //     // archive-api プロキシ経由に切り替える場合はコメントイン
  //     // （src/api/weather.ts の baseUrl を '/api/archive' に変更するのと併用）
  //     '/api/archive': {
  //       target: 'https://archive-api.open-meteo.com',
  //       changeOrigin: true,
  //       rewrite: (path) => path.replace(/^\/api\/archive/, '/v1/archive'),
  //     },
  //   },
  // },
})
