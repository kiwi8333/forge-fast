import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
// Display font for headings and big numbers, bundled so it works offline.
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import './styles.css'
import App from './App.jsx'
import { StoreProvider } from './store/StoreContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { DialogProvider } from './components/Dialogs.jsx'
import { ToastProvider } from './components/Toasts.jsx'

// Wires up update checks so new deploys reach the installed app.
registerSW({ immediate: true })

// HashRouter: GitHub Pages has no server-side rewrites, so deep links like
// /history would 404 on refresh with BrowserRouter.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <StoreProvider>
          <DialogProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </DialogProvider>
        </StoreProvider>
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
)
