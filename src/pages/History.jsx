import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { fastHours, fastStats, formatDuration, lastSevenDays, planHours, reachedGoal, stageAt } from '../logic/fasting.js'
import { addBodyweight, dateKey, deleteBodyweight, putBackFastLog, removeFastLog } from '../logic/state.js'
import SwipeRow from '../components/SwipeRow.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { HistoryIcon } from '../components/icons.jsx'
import { useDialogs } from '../components/Dialogs.jsx'
import { useToast } from '../components/Toasts.jsx'
import { dayOf, timeOf } from '../lib/time.js'

function WeekChart({ logs, goal }) {
  const days = lastSevenDays(logs)
  const top = Math.max(24, goal ?? 0, ...days.map((d) => d.hours))
  const H = 120
  return (
    <figure className="week-chart" aria-label="Fasting hours, last 7 days">
      <svg viewBox={`0 0 280 ${H + 22}`} role="img">
        {goal && (
          <>
            <line x1="0" x2="280" y1={H - (goal / top) * H} y2={H - (goal / top) * H} className="week-goal" />
            <text x="2" y={H - (goal / top) * H - 4} className="week-goal-label">
              {goal}h goal
            </text>
          </>
        )}
        {days.map((d, i) => {
          const h = (d.hours / top) * H
          const x = 8 + i * 39
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={H - Math.max(h, 3)}
                width="26"
                height={Math.max(h, 3)}
                rx="6"
                className={d.hours === 0 ? 'week-bar empty' : 'week-bar'}
                style={d.hours ? { fill: stageAt(d.hours).color, opacity: d.reached ? 1 : 0.55 } : undefined}
              />
              <text x={x + 13} y={H + 16} textAnchor="middle" className="week-day">
                {d.weekday}
              </text>
              <title>{d.hours ? `${d.date}: ${formatDuration(d.hours)}, reached ${stageAt(d.hours).name}` : `${d.date}: no fast`}</title>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

export default function History() {
  const { state, apply } = useStore()
  const { notify } = useDialogs()
  const toast = useToast()
  const f = state.fasting
  const goal = f.active ? f.active.targetHours : planHours(f)
  const stats = fastStats(f.logs)
  const [weight, setWeight] = useState('')

  const act = (fn) => {
    try {
      apply(fn)
      return true
    } catch (err) {
      notify({ title: 'That didn’t work', message: err.message })
      return false
    }
  }

  function remove(log) {
    act((s) => removeFastLog(s, log.id))
    toast({ message: `Deleted ${formatDuration(fastHours(log))} fast`, actionLabel: 'Undo', onAction: () => act((s) => putBackFastLog(s, log)) })
  }

  function logWeight(e) {
    e.preventDefault()
    if (act((s) => addBodyweight(s, dateKey(), weight))) {
      toast({ message: `Logged ${Number(weight)} kg for today` })
      setWeight('')
    }
  }

  function removeWeight(entry) {
    act((s) => deleteBodyweight(s, entry.date))
    toast({ message: `Deleted ${entry.kg} kg from ${dayOf(`${entry.date}T12:00:00`)}`, actionLabel: 'Undo', onAction: () => act((s) => addBodyweight(s, entry.date, entry.kg)) })
  }

  const weights = [...state.bodyweight].reverse()
  const change = state.bodyweight.length > 1 ? Math.round((state.bodyweight.at(-1).kg - state.bodyweight[0].kg) * 10) / 10 : null

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Forge Fast</span>
        <h1>History</h1>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="value">{stats.streak}</span>
          <span className="label">Day streak</span>
        </div>
        <div className="stat">
          <span className="value">{stats.completed}</span>
          <span className="label">Goals reached</span>
        </div>
        <div className="stat">
          <span className="value">{stats.total ? formatDuration(stats.longest) : '–'}</span>
          <span className="label">Longest fast</span>
        </div>
        <div className="stat">
          <span className="value">{stats.total ? formatDuration(stats.average) : '–'}</span>
          <span className="label">Average fast</span>
        </div>
      </div>

      <section className="card">
        <h2>Last 7 days</h2>
        <WeekChart logs={f.logs} goal={goal} />
      </section>

      <section className="card">
        <h2>History</h2>
        {f.logs.length === 0 ? (
          <EmptyState icon={<HistoryIcon />} title="No fasts yet">
            Your finished fasts show up here with their length. Swipe one left to delete it.
          </EmptyState>
        ) : (
          <ul className="clean seg-list">
            {[...f.logs]
              .reverse()
              .slice(0, 20)
              .map((l) => (
                <SwipeRow key={l.id} className="seg-row" onDelete={() => remove(l)}>
                  <span className="row" style={{ gap: 10, minWidth: 0 }}>
                    <span className="fast-stage-dot" style={{ '--c': stageAt(fastHours(l)).color }} title={`Reached ${stageAt(fastHours(l)).name}`} aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path d={stageAt(fastHours(l)).icon} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="stack" style={{ gap: 1 }}>
                      <span>
                        {dayOf(l.endedAt)} · <strong>{formatDuration(fastHours(l))}</strong>
                      </span>
                      <span className="hint">
                        {timeOf(l.startedAt)} → {timeOf(l.endedAt)}
                        {l.targetHours ? ` · goal ${l.targetHours}h` : ' · open'}
                      </span>
                      <span className="hint stage-text" style={{ '--c': stageAt(fastHours(l)).color }}>
                        Reached {stageAt(fastHours(l)).name.toLowerCase()}
                      </span>
                    </span>
                  </span>
                  <span className="row" style={{ gap: 8 }}>
                    <span className={`pill ${reachedGoal(l) ? 'good' : ''}`}>{reachedGoal(l) ? 'Goal ✓' : 'Short'}</span>
                    <button className="link-btn" onClick={() => remove(l)} aria-label={`Delete fast from ${dayOf(l.endedAt)}`}>
                      Delete
                    </button>
                  </span>
                </SwipeRow>
              ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="row between">
          <h2>Weight</h2>
          {change !== null && <span className="pill">{change > 0 ? '+' : change < 0 ? '−' : '±'}{Math.abs(change)} kg overall</span>}
        </div>
        <p className="small text-2">Weigh in at the same time each day, ideally in the morning before eating.</p>
        <form className="row" style={{ gap: 8 }} onSubmit={logWeight}>
          <input className="input" type="number" inputMode="decimal" step="0.1" placeholder="Today’s weight (kg)" aria-label="Weight in kg" value={weight} onChange={(e) => setWeight(e.target.value)} required style={{ flex: 1 }} />
          <button className="btn primary" type="submit">
            Save
          </button>
        </form>
        {weights.length > 0 && (
          <ul className="clean seg-list">
            {weights.slice(0, 10).map((w) => (
              <SwipeRow key={w.date} className="seg-row" onDelete={() => removeWeight(w)}>
                <span>{dayOf(`${w.date}T12:00:00`)}</span>
                <span className="row" style={{ gap: 8 }}>
                  <strong>{w.kg} kg</strong>
                  <button className="link-btn" onClick={() => removeWeight(w)} aria-label={`Delete weight from ${w.date}`}>
                    Delete
                  </button>
                </span>
              </SwipeRow>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
