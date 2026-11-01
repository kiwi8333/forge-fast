import { useMemo, useSyncExternalStore } from 'react'

// A tiny hash router: Forge Fast has three screens, so a full routing library
// is not worth its weight. Paths live after the "#" (GitHub Pages cannot
// rewrite URLs), e.g. #/history or #/?do=start.

function subscribe(onChange) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function parseHash(hash) {
  const [path, query = ''] = hash.replace(/^#/, '').split('?')
  return { path: path || '/', query: new URLSearchParams(query) }
}

export function useRoute() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '')
  return useMemo(() => parseHash(hash), [hash])
}

export function navigate(path, { replace = false } = {}) {
  if (replace) {
    window.history.replaceState(window.history.state, '', `#${path}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = path
  }
}

export function Link({ to, children, ...rest }) {
  return (
    <a href={`#${to}`} {...rest}>
      {children}
    </a>
  )
}

export function NavLink({ to, end = false, className, children }) {
  const { path } = useRoute()
  const active = end ? path === to : path === to || path.startsWith(`${to}/`)
  return (
    <a href={`#${to}`} className={typeof className === 'function' ? className({ isActive: active }) : className} aria-current={active ? 'page' : undefined}>
      {children}
    </a>
  )
}
