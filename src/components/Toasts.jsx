import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// A short message above the bottom nav, optionally with one action (Undo).
// A new toast replaces the current one.
//
//   const toast = useToast()
//   toast({ message: 'Entry deleted', actionLabel: 'Undo', onAction: restore })

const ToastContext = createContext(null)
const DURATION_MS = 5000
let nextId = 0

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const show = useCallback((t) => setToast({ ...t, id: ++nextId }), [])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), toast.duration ?? DURATION_MS)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <span>{toast.message}</span>
            {toast.onAction && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.onAction()
                  setToast(null)
                }}
              >
                {toast.actionLabel ?? 'Undo'}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
