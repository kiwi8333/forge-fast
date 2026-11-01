import { useState } from 'react'

const SCALES = [
  ['mood', 'Mood', ['Low', 'Great']],
  ['energy', 'Energy', ['Drained', 'Strong']],
  ['hunger', 'Hunger', ['None', 'Starving']],
]

// "How did it go?" after a fast: mood, energy and hunger from 1 to 5, glasses
// of water and an optional note. onSave receives the notes object.
export default function FastNotes({ initial, onSave, onSkip, saveLabel = 'Save' }) {
  const [notes, setNotes] = useState(() => ({ mood: null, energy: null, hunger: null, water: null, text: '', ...initial }))
  const set = (key, value) => setNotes((n) => ({ ...n, [key]: value }))

  return (
    <div className="stack" style={{ gap: 12 }}>
      {SCALES.map(([key, label, [lo, hi]]) => (
        <div key={key} className="stack" style={{ gap: 6 }}>
          <div className="row between">
            <span className="coach-label">{label}</span>
            <span className="hint">
              1 {lo} · 5 {hi}
            </span>
          </div>
          <div className="scale-row" role="radiogroup" aria-label={label}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={notes[key] === n} className={`scale-chip ${notes[key] === n ? 'on' : ''}`} onClick={() => set(key, notes[key] === n ? null : n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="row between">
        <span className="coach-label">Water (glasses)</span>
        <span className="row" style={{ gap: 8 }}>
          <button type="button" className="btn small" aria-label="One glass fewer" onClick={() => set('water', Math.max(0, (notes.water ?? 0) - 1))}>
            −
          </button>
          <strong style={{ minWidth: 24, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{notes.water ?? 0}</strong>
          <button type="button" className="btn small" aria-label="One more glass" onClick={() => set('water', Math.min(30, (notes.water ?? 0) + 1))}>
            +
          </button>
        </span>
      </div>
      <label className="field">
        Note (optional)
        <input className="input" maxLength={280} value={notes.text} onChange={(e) => set('text', e.target.value)} placeholder="e.g. Easy until 3pm, coffee helped" />
      </label>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn primary" onClick={() => onSave(notes)}>
          {saveLabel}
        </button>
        {onSkip && (
          <button type="button" className="btn ghost" onClick={onSkip}>
            Not now
          </button>
        )}
      </div>
    </div>
  )
}

export function notesSummary(notes) {
  if (!notes) return ''
  const parts = []
  if (notes.mood) parts.push(`mood ${notes.mood}/5`)
  if (notes.energy) parts.push(`energy ${notes.energy}/5`)
  if (notes.hunger) parts.push(`hunger ${notes.hunger}/5`)
  if (notes.water) parts.push(`${notes.water} glass${notes.water === 1 ? '' : 'es'} of water`)
  return parts.join(' · ')
}
