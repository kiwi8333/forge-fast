import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { loadState, saveState } from './storage.js'

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const initial = useRef(null)
  if (initial.current === null) initial.current = loadState()

  const stateRef = useRef(initial.current.state)
  const [state, setState] = useState(initial.current.state)
  const [loadError, setLoadError] = useState(initial.current.error)
  const [readOnly, setReadOnly] = useState(Boolean(initial.current.readOnly))
  const [saveError, setSaveError] = useState(null)

  // Apply a pure transition. Runs synchronously so validation errors throw
  // straight back to the caller (to show next to the form), and nothing is
  // committed unless the whole transition succeeds.
  const apply = useCallback(
    (transition) => {
      const next = transition(stateRef.current)
      if (next === stateRef.current) return next
      if (!readOnly) {
        try {
          saveState(next)
          setSaveError(null)
        } catch {
          setSaveError('Could not save to this device (storage full or blocked). Export a backup from Settings.')
        }
      }
      stateRef.current = next
      setState(next)
      return next
    },
    [readOnly],
  )

  // Replace everything (backup restore / reset). Clears read-only mode, since
  // the user has explicitly chosen what the data should be.
  const replaceAll = useCallback((next) => {
    saveState(next)
    stateRef.current = next
    setState(next)
    setReadOnly(false)
    setLoadError(null)
    setSaveError(null)
  }, [])

  const value = useMemo(
    () => ({ state, apply, replaceAll, loadError, readOnly, saveError, dismissLoadError: () => setLoadError(null) }),
    [state, apply, replaceAll, loadError, readOnly, saveError],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
