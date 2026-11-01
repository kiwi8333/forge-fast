import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { requestPersistence } from './lib/persist.js'
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

// Ask the browser not to clear saved data (best effort; see lib/persist.js).
requestPersistence()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <DialogProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </DialogProvider>
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>,
)
