import { useRef } from 'react'
import { FAST_STAGES, stageAt } from '../logic/fasting.js'

// The fasting ring: a 24-hour track split into the body's fasting stages,
// each in its own colour, filling as the fast runs. A glowing dot marks
// "now", the current stage's icon pulses, a tick marks the goal, and an
// ember in the middle grows and throws more sparks as the fast deepens.
// Tapping (or long-pressing) the ring calls onShowStages.

const SIZE = 300
const C = SIZE / 2
const R = 120
const GAP = 0.12 // hours left blank between stage sections

function point(hours, r = R) {
  const a = (((hours / 24) * 360 - 90) * Math.PI) / 180
  return [C + r * Math.cos(a), C + r * Math.sin(a)]
}

function arc(h0, h1) {
  if (h1 - h0 <= 0.01) return null
  const [x0, y0] = point(h0)
  const [x1, y1] = point(h1)
  const large = ((h1 - h0) / 24) * 360 > 180 ? 1 : 0
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

// The ring's sections: the first five stages, ending at 24 hours.
const SECTIONS = FAST_STAGES.slice(0, 5).map((s, i) => ({ ...s, to: FAST_STAGES[i + 1].from }))

export default function FastOrbit({ hours, active, goal, burstKey, onShowStages, children }) {
  const stage = stageAt(hours)
  const idx = FAST_STAGES.findIndex((s) => s.id === stage.id)
  const press = useRef({ timer: null, long: false })
  const head = point(Math.min(hours, 24))
  const goalTick = goal && goal <= 24 ? [point(goal, R + 13), point(goal, R + 22), point(goal, R + 32)] : null
  const sparks = active ? 2 + idx * 2 : 0
  const ember = active ? { halo: 64 + idx * 9, mid: 36 + idx * 5, core: 10 + idx * 2 } : { halo: 52, mid: 30, core: 8 }

  // Long-press opens the stage times too, without also firing a click.
  const startPress = () => {
    press.current.long = false
    clearTimeout(press.current.timer)
    press.current.timer = setTimeout(() => {
      press.current.long = true
      onShowStages?.()
    }, 450)
  }
  const endPress = () => clearTimeout(press.current.timer)

  return (
    <button
      type="button"
      className={`orbit ${active ? 'on' : ''}`}
      style={{ '--stage': active ? stage.color : '#5c6166' }}
      aria-label={active ? `Fast progress, ${stage.name}. Show stage times` : 'Fasting stages. Show stage times'}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (press.current.long) {
          press.current.long = false
          return
        }
        onShowStages?.()
      }}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden="true">
        <circle className="orbit-dots" cx={C} cy={C} r={R + 22} fill="none" />
        {SECTIONS.map((s) => (
          <g key={s.id}>
            <path className="orbit-track" d={arc(s.from + GAP, s.to - GAP)} fill="none" stroke={s.color} strokeWidth="16" />
            {active && hours > s.from && <path className="orbit-fill" d={arc(s.from + GAP, Math.min(s.to - GAP, hours))} fill="none" stroke={s.color} strokeWidth="16" strokeLinecap="round" />}
          </g>
        ))}
        {goalTick && (
          <g className="orbit-goal">
            <line x1={goalTick[0][0]} y1={goalTick[0][1]} x2={goalTick[1][0]} y2={goalTick[1][1]} strokeWidth="2.5" strokeLinecap="round" />
            <text x={goalTick[2][0]} y={goalTick[2][1] + 4} textAnchor="middle">
              {goal}h
            </text>
          </g>
        )}
        {SECTIONS.map((s, i) => {
          const [x, y] = point((s.from + s.to) / 2)
          const reached = active && hours >= s.from
          return (
            <g key={s.id} className={active && i === idx ? 'orbit-icon now' : 'orbit-icon'}>
              <circle cx={x} cy={y} r="14" fill="var(--orbit-bg)" stroke={reached ? s.color : '#5c6166'} strokeWidth="2" />
              <path d={s.icon} transform={`translate(${x - 8.4} ${y - 8.4}) scale(0.7)`} fill="none" stroke={reached ? s.color : '#5c6166'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )
        })}
        {active && (
          <>
            <circle className="orbit-head-glow" cx={head[0]} cy={head[1]} r="15" fill={stage.color} />
            <circle cx={head[0]} cy={head[1]} r="8" fill="#ffffff" stroke={stage.color} strokeWidth="4" />
          </>
        )}
      </svg>

      <span className="orbit-center">
        <span className="ember" aria-hidden="true">
          <span className="ember-halo" style={{ width: ember.halo, height: ember.halo }} />
          <span className="ember-mid" style={{ width: ember.mid, height: ember.mid }} />
          <span className="ember-core" style={{ width: ember.core, height: ember.core }} />
          {Array.from({ length: sparks }, (_, i) => (
            <span key={i} className="ember-spark" style={{ left: `${30 + ((i * 37) % 40)}%`, animationDelay: `${((i * 0.37) % 2.2).toFixed(2)}s` }} />
          ))}
        </span>
        {children}
      </span>

      {burstKey ? (
        <span key={burstKey} className="orbit-burst" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <i key={i} style={{ '--a': `${(360 / 14) * i}deg` }} />
          ))}
        </span>
      ) : null}
    </button>
  )
}
