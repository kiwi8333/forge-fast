import { useEffect, useRef, useState } from 'react'
import { navigate } from '../lib/router.jsx'
import { useStore } from '../store/StoreContext.jsx'
import { THEMES, UNITS, createInitialState, dateKey, importFromForge, parseBackupFile, serializeBackup, setEatingWindow, setTheme, setUnits } from '../logic/state.js'
import { windowHours } from '../logic/schedule.js'
import { useDialogs } from '../components/Dialogs.jsx'
import { MIN_PASSWORD, decryptBackup, encryptBackup, isEncryptedBackup } from '../lib/backupCrypto.js'
import { requestPersistence, storageStatus } from '../lib/persist.js'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function Status({ status }) {
  if (!status) return null
  return (
    <p className={status.ok ? 'banner good small' : 'error'} role="status">
      {status.text}
    </p>
  )
}

export default function Settings() {
  const { state, apply, replaceAll } = useStore()
  const { confirm, prompt } = useDialogs()
  const fileRef = useRef(null)
  const [status, setStatus] = useState(null)
  const [protect, setProtect] = useState(true)
  const [storage, setStorage] = useState(null)
  const win = state.settings.window
  const [winForm, setWinForm] = useState(() => win ?? { start: '12:00', end: '20:00' })
  const [winStatus, setWinStatus] = useState(null)

  function saveWindow(e) {
    e.preventDefault()
    try {
      apply((s) => setEatingWindow(s, winForm))
      setWinStatus({ ok: true, text: `Saved: eat for ${windowHours(winForm)} hours, fast for ${24 - windowHours(winForm)}.` })
    } catch (err) {
      setWinStatus({ ok: false, text: err.message })
    }
  }

  useEffect(() => {
    storageStatus().then(setStorage)
  }, [])

  // Asks for a new backup password twice. Resolves with it, or null if cancelled.
  async function newPassword() {
    const first = await prompt({
      title: 'Protect your backup',
      message: `Choose a password of at least ${MIN_PASSWORD} characters. You need it to restore; it cannot be recovered if you forget it.`,
      inputLabel: 'Password',
      inputType: 'password',
      minLength: MIN_PASSWORD,
      autoComplete: 'new-password',
      confirmLabel: 'Next',
    })
    if (first === null) return null
    const again = await prompt({ title: 'Type it again', inputLabel: 'Password', inputType: 'password', minLength: 1, autoComplete: 'new-password', confirmLabel: 'Back up' })
    if (again === null) return null
    if (again !== first) {
      setStatus({ ok: false, text: 'The passwords did not match. Nothing was saved; try again.' })
      return null
    }
    return first
  }

  async function exportBackup() {
    setStatus(null)
    let text = serializeBackup(state)
    if (protect) {
      const password = await newPassword()
      if (password === null) return
      text = await encryptBackup(text, password)
    }
    const filename = `forge-fast-backup-${dateKey()}${protect ? '-locked' : ''}.json`
    const blob = new Blob([text], { type: 'application/json' })
    try {
      const file = new File([blob], filename, { type: 'application/json' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Forge Fast backup' })
        return setStatus({ ok: true, text: 'Backup shared. Choose Google Drive, Save to Files (iCloud) or email so it is stored off this phone.' })
      }
    } catch (err) {
      if (err?.name === 'AbortError') return
      // Fall through to a normal download.
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    setStatus({ ok: true, text: `Downloaded ${filename}. Move it to Google Drive or iCloud to keep it safe.` })
  }

  // One file input for both: a Forge Fast backup restores everything; a Forge
  // training-app backup adds its fasts and weigh-ins.
  async function onFile(e) {
    setStatus(null)
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 150 * 1024 * 1024) return setStatus({ ok: false, text: 'That file is too large to be a backup.' })
    let parsed
    try {
      let text = await file.text()
      if (isEncryptedBackup(text)) {
        const password = await prompt({ title: 'Enter the backup password', inputLabel: 'Password', inputType: 'password', autoComplete: 'current-password', confirmLabel: 'Unlock' })
        if (password === null) return
        text = await decryptBackup(text, password)
      }
      parsed = parseBackupFile(text)
    } catch (err) {
      return setStatus({ ok: false, text: `Nothing was changed. ${err.message}` })
    }
    if (parsed.kind === 'restore') {
      const ok = await confirm({
        title: 'Replace all data with this backup?',
        message: `Everything here is replaced by the backup (${plural(parsed.state.fasting.logs.length, 'fast')}, ${plural(parsed.state.bodyweight.length, 'weigh-in')}). This cannot be undone.`,
        confirmLabel: 'Restore backup',
        tone: 'danger',
      })
      if (!ok) return
      replaceAll(parsed.state)
      return navigate('/', { replace: true })
    }
    const ok = await confirm({
      title: 'Import from Forge?',
      message: `This backup has ${plural(parsed.fasting.logs.length, 'fast')} and ${plural(parsed.bodyweight.length, 'weigh-in')}. They are added to what is here; nothing is overwritten or duplicated.`,
      confirmLabel: 'Import',
    })
    if (!ok) return
    let added
    apply((s) => {
      const r = importFromForge(s, parsed)
      added = r.added
      return r.state
    })
    setStatus({
      ok: true,
      text: `Imported ${plural(added.fasts, 'fast')} and ${plural(added.weights, 'weigh-in')}${added.active ? ', plus your running fast' : ''}.`,
    })
  }

  async function resetAll() {
    const ok = await confirm({
      title: 'Delete all data?',
      message: 'This deletes every fast and weigh-in on this device.',
      confirmLabel: 'Delete everything',
      tone: 'danger',
      requireText: 'DELETE',
    })
    if (!ok) return
    replaceAll(createInitialState())
    navigate('/', { replace: true })
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Forge Fast</span>
        <h1>Settings</h1>
      </div>

      <form className="card" onSubmit={saveWindow}>
        <div className="stack" style={{ gap: 4 }}>
          <h2>Eating window</h2>
          <p className="small text-2">The hours you usually eat. The timer then shows when your window opens and closes, so you know when to start each fast.</p>
        </div>
        <div className="grid-2">
          <label className="field">
            Opens
            <input className="input" type="time" value={winForm.start} onChange={(e) => setWinForm((w) => ({ ...w, start: e.target.value }))} required />
          </label>
          <label className="field">
            Closes
            <input className="input" type="time" value={winForm.end} onChange={(e) => setWinForm((w) => ({ ...w, end: e.target.value }))} required />
          </label>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn primary" type="submit">
            Save window
          </button>
          {win && (
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                apply((s) => setEatingWindow(s, null))
                setWinStatus({ ok: true, text: 'Eating window turned off.' })
              }}
            >
              Turn off
            </button>
          )}
        </div>
        <Status status={winStatus} />
      </form>

      <section className="card">
        <h2>Display</h2>
        <div className="stack" style={{ gap: 6 }}>
          <span className="coach-label">Weight units</span>
          <div className="segmented" role="radiogroup" aria-label="Weight units">
            {UNITS.map((u) => (
              <button key={u} type="button" role="radio" aria-checked={state.settings.units === u} className={state.settings.units === u ? 'on' : ''} onClick={() => apply((s) => setUnits(s, u))}>
                {u}
              </button>
            ))}
          </div>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <span className="coach-label">Theme</span>
          <div className="segmented" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={state.settings.theme === t} className={state.settings.theme === t ? 'on' : ''} onClick={() => apply((s) => setTheme(s, t))}>
                {t === 'system' ? 'Auto' : t === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="stack" style={{ gap: 4 }}>
          <h2>Moving from Forge?</h2>
          <p className="small text-2">
            Fasting now lives here. In the Forge app, open Settings and tap <strong>Back up now</strong>, then choose that file below. Your fasts and weigh-ins are
            copied across; nothing here is overwritten.
          </p>
        </div>
        <button className="btn primary" onClick={() => fileRef.current?.click()}>
          Import a Forge backup
        </button>
      </section>

      <section className="card">
        <div className="stack" style={{ gap: 4 }}>
          <h2>Backup</h2>
          <p className="small text-2">Your fasts live only on this phone. Back them up to Google Drive, Files (iCloud) or email now and then.</p>
        </div>
        <label className="row small">
          <input type="checkbox" checked={protect} onChange={(e) => setProtect(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--accent)' }} />
          Protect the backup with a password (recommended)
        </label>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn primary" onClick={exportBackup}>
            Back up now
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Restore a backup
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} hidden />
        <Status status={status} />
      </section>

      <section className="card">
        <div className="row between">
          <h2>Storage</h2>
          <span className={`pill ${storage === 'granted' ? 'good' : storage === 'denied' ? 'warn' : ''}`}>
            {storage === 'granted' ? 'Protected' : storage === 'denied' ? 'Not protected' : storage === 'unsupported' ? 'Unknown' : '…'}
          </span>
        </div>
        <p className="small text-2">
          {storage === 'granted'
            ? 'Your browser has agreed to keep Forge Fast’s data, even when the phone is low on space.'
            : 'Browsers can clear website data when space runs low, or after a week without a visit on iPhone. Add Forge Fast to your home screen and keep backups.'}
        </p>
        {storage === 'denied' && (
          <button className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => requestPersistence().then(setStorage)}>
            Ask again
          </button>
        )}
      </section>

      <section className="card">
        <h2>About</h2>
        <p className="small text-2">
          Forge Fast is an intermittent fasting timer from the makers of the Forge training app. It works offline and keeps your data on this device. It gives general
          guidance, not medical advice.
        </p>
      </section>

      <section className="card">
        <h2>Delete all data</h2>
        <p className="small text-2">Removes every fast and weigh-in from this device. Back up first if you might want them again.</p>
        <button className="btn danger" onClick={resetAll}>
          Delete all data
        </button>
      </section>
    </>
  )
}
