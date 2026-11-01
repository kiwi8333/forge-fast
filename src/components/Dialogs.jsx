import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// Bottom sheets in place of the browser's confirm(), alert() and prompt().
// Each call returns a promise, so callers read like the old blocking ones:
//
//   const { confirm, notify } = useDialogs()
//   if (!(await confirm({ title: 'Delete this entry?', confirmLabel: 'Delete', tone: 'danger' }))) return
//
// Built on <dialog>, so focus stays inside the sheet, Esc cancels, and screen
// readers announce it as a modal. One sheet shows at a time; later calls wait.

const DialogContext = createContext(null)
const CLOSE_MS = 220
let nextId = 0

export function useDialogs() {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialogs must be used inside <DialogProvider>')
  return ctx
}

export function DialogProvider({ children }) {
  const [queue, setQueue] = useState([])

  const open = useCallback(
    (kind, options) =>
      new Promise((resolve) => {
        setQueue((q) => [...q, { id: ++nextId, kind, options: typeof options === 'string' ? { title: options } : options, resolve }])
      }),
    [],
  )

  const api = useRef(null)
  if (!api.current) {
    api.current = {
      // Resolves true when confirmed. requireText: the user must type it first.
      confirm: (options) => open('confirm', options),
      // A message with a single button. Resolves when dismissed.
      notify: (options) => open('notify', options),
    }
  }

  const current = queue[0]
  const settle = (value) => {
    current.resolve(value)
    setQueue((q) => q.slice(1))
  }

  return (
    <DialogContext.Provider value={api.current}>
      {children}
      {current && <Sheet key={current.id} request={current} onSettle={settle} />}
    </DialogContext.Provider>
  )
}

function Sheet({ request, onSettle }) {
  const { kind, options } = request
  const { title, message, confirmLabel, cancelLabel = 'Cancel', tone = 'primary', requireText } = options
  const ref = useRef(null)
  const settled = useRef(false)
  const [closing, setClosing] = useState(false)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal?.()
  }, [])

  const close = (value) => {
    if (settled.current) return
    settled.current = true
    setClosing(true)
    setTimeout(() => {
      ref.current?.close?.()
      onSettle(value)
    }, CLOSE_MS)
  }

  const cancelValue = kind === 'confirm' ? false : undefined
  const blocked = Boolean(requireText) && typed.trim() !== requireText

  return (
    <dialog
      ref={ref}
      className={`sheet ${closing ? 'closing' : ''}`}
      aria-labelledby="sheet-title"
      aria-describedby={message ? 'sheet-message' : undefined}
      onCancel={(e) => {
        e.preventDefault()
        close(cancelValue)
      }}
      onClick={(e) => {
        // A tap on the dimmed area outside the panel.
        if (e.target === e.currentTarget) close(cancelValue)
      }}
    >
      <form
        className="sheet-panel"
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          if (!blocked) close(kind === 'confirm' ? true : undefined)
        }}
      >
        <span className="sheet-grip" aria-hidden />
        <h2 id="sheet-title">{title}</h2>
        {message && (
          <p id="sheet-message" className="text-2">
            {message}
          </p>
        )}
        {requireText && (
          <label className="field">
            Type {requireText} to confirm
            <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
          </label>
        )}
        <div className="sheet-actions">
          <button type="submit" className={`btn big block ${tone === 'danger' ? 'danger-solid' : 'primary'}`} disabled={blocked} autoFocus={!requireText}>
            {confirmLabel ?? (kind === 'confirm' ? 'Confirm' : 'OK')}
          </button>
          {kind === 'confirm' && (
            <button type="button" className="btn big block ghost" onClick={() => close(false)}>
              {cancelLabel}
            </button>
          )}
        </div>
      </form>
    </dialog>
  )
}
