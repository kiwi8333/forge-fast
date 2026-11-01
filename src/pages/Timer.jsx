import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Link, navigate, useRoute } from '../lib/router.jsx'
import { useStore } from '../store/StoreContext.jsx'
import { FAST_PLANS, FAST_STAGES, MAX_CUSTOM_HOURS, MIN_CUSTOM_HOURS, fastStats, formatClockHours, formatDuration, hoursBetween, planHours, stageAt, stageTimes } from '../logic/fasting.js'
import { abandonFast, beginFast, changeFastStart, finishFast, saveFastNotes, setFastPlan } from '../logic/state.js'
import { windowStatus } from '../logic/schedule.js'
import { newlyEarned } from '../logic/achievements.js'
import FastNotes from '../components/FastNotes.jsx'
import { shareFast } from '../lib/shareCard.js'
import { useNow } from '../components/useNow.js'
import FastOrbit from '../components/FastOrbit.jsx'
import { useDialogs } from '../components/Dialogs.jsx'
import { useToast } from '../components/Toasts.jsx'
import { haptic } from '../lib/alerts.js'
import { dayOf, timeOf, toLocalInput } from '../lib/time.js'

// The fasting plans, as a grid of chips.
const PlanPicker = memo(function PlanPicker({ fasting, onPick }) {
  const [custom, setCustom] = useState(String(fasting.customHours))
  const [error, setError] = useState(null)
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="plan-grid" role="radiogroup" aria-label="Fasting plan">
        {FAST_PLANS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={fasting.planId === p.id}
            className={`plan-chip ${fasting.planId === p.id ? 'on' : ''}`}
            onClick={() => {
              setError(null)
              try {
                onPick(p.id, p.id === 'custom' ? Number(custom) : undefined)
              } catch (err) {
                setError(err.message)
              }
            }}
          >
            <strong>{p.id === 'custom' ? `${fasting.customHours}h` : p.id === 'open' ? '∞' : p.id}</strong>
            <span>{p.name}</span>
          </button>
        ))}
      </div>
      <p className="hint">{FAST_PLANS.find((p) => p.id === fasting.planId)?.note}</p>
      {fasting.planId === 'custom' && (
        <form
          className="row"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            try {
              onPick('custom', Number(custom))
            } catch (err) {
              setError(err.message)
            }
          }}
        >
          <label className="field" style={{ flex: 1 }}>
            Goal (hours)
            <input className="input" type="number" inputMode="decimal" min={MIN_CUSTOM_HOURS} max={MAX_CUSTOM_HOURS} step="0.5" value={custom} onChange={(e) => setCustom(e.target.value)} />
          </label>
          <button className="btn" type="submit" style={{ alignSelf: 'flex-end' }}>
            Set
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
})

// The stages as a strip: where you are now, and how far through.
function StageStrip({ hours }) {
  const current = stageAt(hours)
  return (
    <ol className="stage-strip clean" aria-label="Fasting stages">
      {FAST_STAGES.map((s, i) => {
        const next = FAST_STAGES[i + 1]
        const span = next ? next.from - s.from : 12
        const fill = Math.min(1, Math.max(0, (hours - s.from) / span))
        return (
          <li key={s.id} className={`stage-seg ${s.id === current.id ? 'now' : hours >= s.from ? 'past' : ''}`} title={s.name}>
            <span className="stage-bar">
              <span style={{ width: `${fill * 100}%`, background: s.color }} />
            </span>
            <span className="stage-hour">{s.from}h</span>
          </li>
        )
      })}
    </ol>
  )
}

export default function Timer() {
  const { state, apply } = useStore()
  const { confirm, notify } = useDialogs()
  const toast = useToast()
  const f = state.fasting
  const active = f.active
  const now = useNow(true, 1000)
  const [editing, setEditing] = useState(false)
  const [startInput, setStartInput] = useState('')
  const [showStages, setShowStages] = useState(false)
  const [burstKey, setBurstKey] = useState(0)
  // Fasts whose "how did it go?" card was closed this session.
  const [notesClosed, setNotesClosed] = useState(() => new Set())
  const { query } = useRoute()

  const elapsed = active ? hoursBetween(active.startedAt, now) : 0
  const goal = active ? active.targetHours : planHours(f)
  const stage = stageAt(elapsed)
  const nextStage = FAST_STAGES.find((s) => s.from > elapsed)
  const reached = active && goal !== null && elapsed >= goal
  const last = f.logs.at(-1)
  const stats = fastStats(f.logs, new Date(now))

  // A short celebration the moment the goal is reached with the app open.
  const celebrated = useRef(reached)
  useEffect(() => {
    if (reached && !celebrated.current) {
      haptic('complete')
      toast({ message: `Goal reached: ${goal}h fast! End it whenever you are ready.` })
    }
    celebrated.current = reached
  }, [reached, goal, toast])

  // Crossing into a new stage with the app open: a burst on the ring, a buzz
  // and a message. Opening the page mid-fast does not celebrate.
  const lastStage = useRef(active ? stage.id : null)
  useEffect(() => {
    if (!active) {
      lastStage.current = null
      return
    }
    if (lastStage.current && lastStage.current !== stage.id && stage.from > (FAST_STAGES.find((s) => s.id === lastStage.current)?.from ?? 0)) {
      haptic('success')
      setBurstKey(Date.now())
      toast({ message: `New stage: ${stage.name}` })
    }
    lastStage.current = stage.id
  }, [active, stage, toast])

  // Stable, so the memoised plan picker skips the once-a-second clock renders.
  const pickPlan = useCallback((id, hours) => apply((s) => setFastPlan(s, id, hours)), [apply])

  // Home-screen shortcuts open #/?do=start or #/?do=end.
  const shortcut = query.get('do')
  useEffect(() => {
    if (!shortcut) return
    navigate('/', { replace: true })
    if (shortcut === 'start' && !state.fasting.active) {
      try {
        apply((s) => beginFast(s))
        haptic('success')
        toast({ message: 'Fast started' })
      } catch {
        // Already running or otherwise not startable: just show the timer.
      }
    }
    if (shortcut === 'end' && state.fasting.active) end()
    // Runs once per shortcut visit.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcut])

  const win = state.settings.window
  const winNow = win ? windowStatus(win, new Date(now)) : null

  // The latest fast, if it ended in the last 12 hours and has no notes yet.
  const notesLog = last && !last.notes && !notesClosed.has(last.id) && now - new Date(last.endedAt).getTime() < 12 * 3600000 ? last : null

  const act = (fn) => {
    try {
      apply(fn)
      return true
    } catch (err) {
      notify({ title: 'That didn’t work', message: err.message })
      return false
    }
  }

  async function end() {
    const short = goal !== null && elapsed < goal
    const ok = await confirm({
      title: short ? `End at ${formatDuration(elapsed)}?` : 'End your fast?',
      message: short ? `You are ${formatDuration(goal - elapsed)} short of your ${goal}h goal. It is saved either way.` : `${formatDuration(elapsed)} fasted. Nice work. Break it with a protein-rich meal.`,
      confirmLabel: 'End fast',
      cancelLabel: 'Keep fasting',
    })
    if (!ok) return
    const before = state.fasting.logs
    let next
    try {
      next = apply((s) => finishFast(s))
    } catch (err) {
      return notify({ title: 'That didn’t work', message: err.message })
    }
    haptic(short ? 'tap' : 'success')
    const badges = newlyEarned(before, next.fasting.logs)
    if (badges.length) {
      setTimeout(() => toast({ message: `Badge earned: ${badges.map((b) => b.title).join(', ')}` }), 600)
      haptic('complete')
    }
  }

  async function cancel() {
    const ok = await confirm({ title: 'Cancel this fast?', message: 'It will not be saved to your history.', confirmLabel: 'Cancel fast', cancelLabel: 'Keep fasting', tone: 'danger' })
    if (ok) act(abandonFast)
  }

  function saveStart(e) {
    e.preventDefault()
    if (act((s) => changeFastStart(s, new Date(startInput).toISOString()))) setEditing(false)
  }

  const pct = goal ? Math.min(100, Math.round((elapsed / goal) * 100)) : null
  const goalAt = active && goal ? new Date(new Date(active.startedAt).getTime() + goal * 3600000).toISOString() : null

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <h1>{active ? 'Fasting' : 'Ready to fast'}</h1>
      </div>

      <section className={`card fast-hero ${active ? 'running' : ''}`}>
        <div className="fast-ring-wrap">
          <FastOrbit hours={elapsed} active={Boolean(active)} goal={goal} burstKey={burstKey} onShowStages={() => setShowStages((v) => !v)}>
            {active ? (
              <>
                <span className="fast-label stage-text" style={{ '--c': reached ? 'var(--good)' : stage.color }}>
                  {reached ? 'Goal reached' : stage.name}
                </span>
                <span className="fast-clock">{formatClockHours(elapsed)}</span>
                <span className="fast-sub">
                  {goal ? (reached ? `+${formatDuration(elapsed - goal)} past ${goal}h` : `${formatDuration(goal - elapsed)} to go · ${pct}%`) : 'Open fast'}
                </span>
              </>
            ) : (
              <>
                <span className="fast-label">Your plan</span>
                <span className="fast-clock">{goal ? `${goal}h` : '∞'}</span>
                <span className="fast-sub">{last ? `Last fast ended ${formatDuration(hoursBetween(last.endedAt, now))} ago` : 'Pick a plan and start'}</span>
              </>
            )}
          </FastOrbit>
        </div>
        <p className="hint" style={{ textAlign: 'center' }}>
          Tap or hold the ring for {active ? 'when you reach each stage' : 'the fasting stages'}.
        </p>
        {winNow && (
          <p className={`window-line ${winNow.open ? 'open' : ''}`}>
            {winNow.open
              ? `Eating window open · closes ${timeOf(winNow.closesAt.toISOString())}${active ? '' : ', start your fast then'}`
              : `Eating window opens ${timeOf(winNow.opensAt.toISOString())}${dayOf(winNow.opensAt.toISOString()) !== dayOf(new Date(now).toISOString()) ? ` ${dayOf(winNow.opensAt.toISOString())}` : ''}`}
          </p>
        )}
        {showStages && (
          <ol className="clean stage-times" aria-label="Fasting stages">
            {(active ? stageTimes(active.startedAt, new Date(now)) : FAST_STAGES).map((s) => (
              <li key={s.id} className={active && s.reached ? 'reached' : ''} style={{ '--c': s.color }}>
                <span className="stage-times-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path d={s.icon} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="stack" style={{ gap: 1, flex: 1, minWidth: 0 }}>
                  <strong>{s.name}</strong>
                  <span className="hint">
                    From {s.from}h
                    {active && (s.reached ? ` · reached ${timeOf(s.at.toISOString())}` : ` · ${timeOf(s.at.toISOString())} ${dayOf(s.at.toISOString())}, in ${formatDuration((s.at - now) / 3600000)}`)}
                  </span>
                </span>
                {active && s.id === stage.id && (
                  <span className="pill stage-text" style={{ background: `${s.color}26` }}>
                    Now
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}

        {active ? (
          <>
            <div className="fast-times">
              <div>
                <span className="coach-label">Started</span>
                <strong>{timeOf(active.startedAt)}</strong>
                <span className="hint">{dayOf(active.startedAt)}</span>
              </div>
              <div>
                <span className="coach-label">Goal</span>
                <strong>{goalAt ? timeOf(goalAt) : 'None'}</strong>
                <span className="hint">{goalAt ? `${dayOf(goalAt)} · ${goal}h` : 'Open fast'}</span>
              </div>
            </div>
            <button className="btn primary big block" onClick={end}>
              End fast
            </button>
            {editing ? (
              <form className="stack" style={{ gap: 8 }} onSubmit={saveStart}>
                <label className="field">
                  When did you start?
                  <input className="input" type="datetime-local" value={startInput} max={toLocalInput(new Date(now).toISOString())} onChange={(e) => setStartInput(e.target.value)} required />
                </label>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn primary" type="submit">
                    Save start time
                  </button>
                  <button className="btn ghost" type="button" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="row between">
                <button
                  className="link-btn"
                  onClick={() => {
                    setStartInput(toLocalInput(active.startedAt))
                    setEditing(true)
                  }}
                >
                  Edit start time
                </button>
                <button className="link-btn" style={{ color: 'var(--bad)' }} onClick={cancel}>
                  Cancel fast
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <PlanPicker fasting={f} onPick={pickPlan} />
            <button className="btn primary big block" onClick={() => act((s) => beginFast(s)) && haptic('success')}>
              Start {goal ? `${goal}h` : 'open'} fast
            </button>
            <p className="hint" style={{ textAlign: 'center' }}>
              Forgot to start it? Start now, then use “Edit start time”.
            </p>
          </>
        )}
      </section>

      {!active && notesLog && (
        <section className="card">
          <div className="row between">
            <h2>How did it go?</h2>
            <button className="link-btn" onClick={() => shareFast(notesLog).catch(() => {})}>
              Share
            </button>
          </div>
          <p className="small text-2">
            {formatDuration(hoursBetween(notesLog.startedAt, notesLog.endedAt))} fasted. A few taps now show what works best for you in History.
          </p>
          <FastNotes
            onSave={(n) => {
              if (act((s) => saveFastNotes(s, notesLog.id, n))) toast({ message: 'Saved' })
            }}
            onSkip={() => setNotesClosed((set) => new Set(set).add(notesLog.id))}
          />
        </section>
      )}

      {active && (
        <section className="card">
          <div className="row between">
            <h2>{stage.name}</h2>
            <span className="pill accent">{formatDuration(elapsed)}</span>
          </div>
          <p className="small text-2">{stage.text}</p>
          <StageStrip hours={elapsed} />
          {nextStage && (
            <p className="hint">
              Next: <strong>{nextStage.name}</strong> in {formatDuration(nextStage.from - elapsed)}
            </p>
          )}
        </section>
      )}

      {active && (
        <section className="card">
          <h2>Change plan</h2>
          <PlanPicker fasting={f} onPick={pickPlan} />
        </section>
      )}

      <section className="card">
        <div className="row between">
          <h2>Your fasting</h2>
          <Link className="link-btn" to="/history">
            History
          </Link>
        </div>
        <div className="mini-stats">
          <span>
            <strong>{stats.streak}</strong> day streak
          </span>
          <span>
            <strong>{stats.completed}</strong> goals reached
          </span>
          <span>
            <strong>{stats.total ? formatDuration(stats.longest) : '–'}</strong> longest
          </span>
        </div>
      </section>

      <section className="card">
        <h2>Fasting safely</h2>
        <ul className="cues">
          <li>Water, black coffee and plain tea are fine while fasting. Drink plenty.</li>
          <li>If you train, eat your protein-rich meals inside your eating window so you can still build muscle.</li>
          <li>Stop if you feel dizzy, faint or unwell.</li>
          <li>Do not fast if you are pregnant or breastfeeding, under 18, have had an eating disorder, or take medicine for diabetes or blood pressure without your doctor’s OK.</li>
        </ul>
        <p className="hint">Stage timings are typical averages and vary from person to person.</p>
      </section>
    </>
  )
}
