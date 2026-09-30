/// <reference types="vite-plugin-pwa/vanillajs" />

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.tsx'
import { MotionProvider } from './components/ui/MotionProvider'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionProvider>
      <App />
    </MotionProvider>
  </StrictMode>,
)
