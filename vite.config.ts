import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Vitest 3 bundles its own Vite type definitions; cast keeps the existing
  // Vite 8 React plugin compatible at the config boundary.
  plugins: [react()] as any,
  build: {
    target: 'es2020',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
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
