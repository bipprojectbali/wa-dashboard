import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './frontend/App'

// Stale chunk handler: setelah deploy, browser mungkin masih cache chunk lama
// dengan immutable headers yang merujuk hash berbeda → 404 saat lazy import.
// Vite fires 'vite:preloadError' untuk kasus ini. Reload sekali otomatis
// agar browser ambil index.html + chunk baru. sessionStorage mencegah loop.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const RELOAD_KEY = '_vite_reload'
  if (!sessionStorage.getItem(RELOAD_KEY)) {
    sessionStorage.setItem(RELOAD_KEY, '1')
    window.location.reload()
  }
})

// DevInspector hanya di-import saat dev (tree-shaken di production)
const InspectorWrapper = import.meta.env?.DEV
  ? (await import('./frontend/DevInspector')).DevInspector
  : ({ children }: { children: ReactNode }) => <>{children}</>

// Agentation UI annotation tool — dev only, tree-shaken di production
if (import.meta.env?.DEV) {
  const { Agentation } = await import('agentation')
  const { createElement } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const container = document.createElement('div')
  document.body.appendChild(container)
  createRoot(container).render(createElement(Agentation))
}

const elem = document.getElementById('root')!
const app = (
  <InspectorWrapper>
    <App />
  </InspectorWrapper>
)

// HMR-safe: reuse root agar React state preserved saat hot reload
if (import.meta.hot) {
  import.meta.hot.data.root ??= createRoot(elem)
  import.meta.hot.data.root.render(app)
} else {
  createRoot(elem).render(app)
}
