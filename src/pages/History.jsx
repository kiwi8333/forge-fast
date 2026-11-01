import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { fastHours, fastStats, formatDuration, lastSevenDays, planHours, reachedGoal, stageAt } from '../logic/fasting.js'
import { addBodyweight, dateKey, deleteBodyweight, fromDisplay, putBackFastLog, removeFastLog, toDisplay } from '../logic/state.js'
import { achievements, monthGrid } from '../logic/achievements.js'
import { notesSummary } from '../components/FastNotes.jsx'
import { shareFast } from '../lib/shareCard.js'
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

// One month, each day tinted by the deepest stage its longest fast reached.
function MonthCalendar({ logs }) {
  const today = new Date()
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const weeks = monthGrid(logs, cursor.y, cursor.m)
  const label = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const shift = (d) => setCursor(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }))
  const isCurrent = cursor.y === today.getFullYear() && cursor.m === today.getMonth()
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row between">
        <button className="btn small ghost" onClick={() => shift(-1)} aria-label="Previous month">
          ‹
        </button>
        <strong>{label}</strong>
        <button className="btn small ghost" onClick={() => shift(1)} disabled={isCurrent} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="cal" role="grid" aria-label={`Fasts in ${label}`}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="cal-head" aria-hidden="true">
            {d}
          </span>
        ))}
        {weeks.flat().map((c, i) =>
          c ? (
            <span
              key={c.key}
              role="gridcell"
              className={`cal-day ${c.log ? 'has' : ''} ${c.log && !reachedGoal(c.log) ? 'short' : ''}`}
              style={c.log ? { '--c': stageAt(fastHours(c.log)).color } : undefined}
              aria-label={c.log ? `${c.key}: ${formatDuration(fastHours(c.log))}, ${stageAt(fastHours(c.log)).name}` : `${c.key}: no fast`}
            >
              {c.day}
            </span>
          ) : (
            <span key={`e${i}`} className="cal-day empty" aria-hidden="true" />
          ),
        )}
      </div>
    </div>
  )
}

// Which plan suits you, from the notes you have added (needs 3+ rated fasts on a plan).
function insights(logs) {
  const byPlan = new Map()
  for (const l of logs) {
    if (!l.notes?.mood) continue
    const key = l.targetHours ? `${l.targetHours}h` : 'Open'
    const cur = byPlan.get(key) ?? { mood: 0, energy: 0, energyN: 0, n: 0 }
    cur.mood += l.notes.mood
    cur.n++
    if (l.notes.energy) {
      cur.energy += l.notes.energy
      cur.energyN++
    }
    byPlan.set(key, cur)
  }
  return [...byPlan.entries()]
    .filter(([, v]) => v.n >= 3)
    .map(([plan, v]) => ({ plan, mood: Math.round((v.mood / v.n) * 10) / 10, energy: v.energyN ? Math.round((v.energy / v.energyN) * 10) / 10 : null, n: v.n }))
    .sort((a, b) => b.mood - a.mood)
}

export default function History() {
  const { state, apply } = useStore()
  const { notify } = useDialogs()
  const toast = useToast()
  const f = state.fasting
  const goal = f.active ? f.active.targetHours : planHours(f)
  const stats = fastStats(f.logs)
  const [weight, setWeight] = useState('')
  const units = state.settings.units
  const badges = achievements(f.logs)
  const earned = badges.filter((b) => b.earned).length
  const tips = insights(f.logs)

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
    if (act((s) => addBodyweight(s, dateKey(), fromDisplay(weight, units)))) {
      toast({ message: `Logged ${Number(weight)} ${units} for today` })
      setWeight('')
    }
  }

  function removeWeight(entry) {
    act((s) => deleteBodyweight(s, entry.date))
    toast({ message: `Deleted ${toDisplay(entry.kg, units)} ${units} from ${dayOf(`${entry.date}T12:00:00`)}`, actionLabel: 'Undo', onAction: () => act((s) => addBodyweight(s, entry.date, entry.kg)) })
  }

  const weights = [...state.bodyweight].reverse()
  const change = state.bodyweight.length > 1 ? Math.round((toDisplay(state.bodyweight.at(-1).kg, units) - toDisplay(state.bodyweight[0].kg, units)) * 10) / 10 : null

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
        <h2>Calendar</h2>
        <MonthCalendar logs={f.logs} />
        <p className="hint">Each day takes the colour of the deepest stage reached; faded days fell short of the goal.</p>
      </section>

      <section className="card">
        <div className="row between">
          <h2>Badges</h2>
          <span className="pill accent">
            {earned} of {badges.length}
          </span>
        </div>
        <ul className="clean badge-grid">
          {badges.map((b) => (
            <li key={b.id} className={b.earned ? 'earned' : ''} title={b.detail}>
              <span className="badge-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path d={b.icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <strong>{b.title}</strong>
              <span className="hint">{b.earned ? dayOf(b.earnedAt) : b.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      {tips.length > 0 && (
        <section className="card">
          <h2>What works for you</h2>
          <ul className="clean seg-list">
            {tips.map((t, i) => (
              <li key={t.plan} className="seg-row">
                <span>
                  {i === 0 && tips.length > 1 ? 'Best: ' : ''}
                  <strong>{t.plan} fasts</strong> · {t.n} rated
                </span>
                <span className="text-2">
                  mood {t.mood}/5{t.energy ? ` · energy ${t.energy}/5` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
                <SwipeRow key={l.id} className="seg-row fast-row" onDelete={() => remove(l)}>
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
                      {l.notes && (notesSummary(l.notes) || l.notes.text) && (
                        <span className="hint">
                          {notesSummary(l.notes)}
                          {l.notes.text ? `${notesSummary(l.notes) ? ' · ' : ''}“${l.notes.text}”` : ''}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="row" style={{ gap: 8 }}>
                    <span className={`pill ${reachedGoal(l) ? 'good' : ''}`}>{reachedGoal(l) ? 'Goal ✓' : 'Short'}</span>
                    <button className="link-btn" onClick={() => shareFast(l).catch(() => {})} aria-label={`Share fast from ${dayOf(l.endedAt)}`}>
                      Share
                    </button>
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
          {change !== null && <span className="pill">{change > 0 ? '+' : change < 0 ? '−' : '±'}{Math.abs(change)} {units} overall</span>}
        </div>
        <p className="small text-2">Weigh in at the same time each day, ideally in the morning before eating.</p>
        <form className="row" style={{ gap: 8 }} onSubmit={logWeight}>
          <input className="input" type="number" inputMode="decimal" step="0.1" placeholder={`Today’s weight (${units})`} aria-label={`Weight in ${units}`} value={weight} onChange={(e) => setWeight(e.target.value)} required style={{ flex: 1 }} />
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
                  <strong>
                    {toDisplay(w.kg, units)} {units}
                  </strong>
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
