import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
