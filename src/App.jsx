import { lazy, Suspense, useEffect } from 'react'
import { NavLink, navigate, useRoute } from './lib/router.jsx'
import { useStore } from './store/StoreContext.jsx'
import { HistoryIcon, SettingsIcon, TimerIcon } from './components/icons.jsx'
import Timer from './pages/Timer.jsx'
import { SkeletonRows } from './components/EmptyState.jsx'

// The timer ships in the main bundle so the app opens instantly; the other
// pages load the first time they are visited (and are cached for offline).
const History = lazy(() => import('./pages/History.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))

const NAV = [
  { to: '/', label: 'Timer', Icon: TimerIcon, end: true },
  { to: '/history', label: 'History', Icon: HistoryIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
]

const PAGES = { '/': Timer, '/history': History, '/settings': Settings }

const pageFallback = (
  <section className="card">
    <SkeletonRows count={3} label="Loading page" />
  </section>
)

export default function App() {
  const { state, loadError, readOnly, saveError, dismissLoadError } = useStore()
  const { path } = useRoute()
  const known = PAGES[path]

  // Unknown paths go back to the timer.
  useEffect(() => {
    if (!known) navigate('/', { replace: true })
  }, [known])

  // The chosen theme; "system" leaves it to the phone's setting.
  const theme = state.settings.theme
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f4f3ef' : '#111315')
  }, [theme])

  const Page = known ?? Timer

  return (
    <>
      <main className="app page">
        {loadError && (
          <div className="banner bad" role="alert">
            <span>{loadError}</span>
            {!readOnly && (
              <button className="link-btn" onClick={dismissLoadError}>
                Dismiss
              </button>
            )}
          </div>
        )}
        {saveError && (
          <div className="banner bad" role="alert">
            {saveError}
          </div>
        )}
        {/* Keyed by path so each page plays the entry animation. */}
        <div className="route" key={path}>
          <Suspense fallback={pageFallback}>
            <Page />
          </Suspense>
        </div>
      </main>
      <nav className="nav nav-3" aria-label="Main">
        <div className="nav-inner">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              <Icon />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}
