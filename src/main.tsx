/// <reference types="vite-plugin-pwa/vanillajs" />

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { MotionProvider } from './components/ui/MotionProvider'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { AppErrorFallback } from './components/AppErrorFallback'
import { logAppError } from './lib/analytics'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionProvider>
      {/* どこかの描画エラーで真っ白にしない（原因と立て直す手段を出す） */}
      <ErrorBoundary onError={e => logAppError('app', e)} fallback={(_reset, error) => <AppErrorFallback error={error} />}>
        <App />
      </ErrorBoundary>
    </MotionProvider>
  </StrictMode>,
)
