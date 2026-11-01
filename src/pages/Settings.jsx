import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext.jsx'
import { createInitialState, dateKey, importFromForge, parseBackupFile, serializeBackup } from '../logic/state.js'
import { useDialogs } from '../components/Dialogs.jsx'

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
  const { confirm } = useDialogs()
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [status, setStatus] = useState(null)

  async function exportBackup() {
    setStatus(null)
    const text = serializeBackup(state)
    const filename = `forge-fast-backup-${dateKey()}.json`
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
      parsed = parseBackupFile(await file.text())
    } catch (err) {
      return setStatus({ ok: false, text: `Nothing was changed. ${err.message}` })
    }
    if (parsed.kind === 'restore') {
      const ok = await confirm({
        title: 'Replace all data with this backup?',
        message: `Everything here is replaced by the backup (${parsed.state.fasting.logs.length} fasts, ${parsed.state.bodyweight.length} weigh-ins). This cannot be undone.`,
        confirmLabel: 'Restore backup',
        tone: 'danger',
      })
      if (!ok) return
      replaceAll(parsed.state)
      return navigate('/', { replace: true })
    }
    const ok = await confirm({
      title: 'Import from Forge?',
      message: `This backup has ${parsed.fasting.logs.length} fasts and ${parsed.bodyweight.length} weigh-ins. They are added to what is here; nothing is overwritten or duplicated.`,
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
      text: `Imported ${added.fasts} fast${added.fasts === 1 ? '' : 's'} and ${added.weights} weigh-in${added.weights === 1 ? '' : 's'}${added.active ? ', plus your running fast' : ''}.`,
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
