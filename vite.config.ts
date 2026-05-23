import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // ローカル開発時に /api/archive → archive-api.open-meteo.com へ転送
      '/api/archive': {
        target: 'https://archive-api.open-meteo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/archive/, '/v1/archive'),
      },
    },
  },
})
