// Intermittent fasting: plans, the stages your body moves through, and the
// rules for starting, ending and editing a fast. Pure functions; state.js
// wires them into the app state.

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export const FAST_PLANS = [
  { id: '13:11', hours: 13, name: 'Circadian', note: 'Gentle start: stop eating after dinner, eat after breakfast time.' },
  { id: '14:10', hours: 14, name: 'Easy', note: 'A step up from overnight: a 10-hour eating window.' },
  { id: '16:8', hours: 16, name: 'Lean 16:8', note: 'The most popular plan: an 8-hour eating window.' },
  { id: '18:6', hours: 18, name: 'Fat burner', note: 'Longer in the fat-burning stage: a 6-hour window.' },
  { id: '20:4', hours: 20, name: 'Warrior', note: 'One big meal and a snack in a 4-hour window.' },
  { id: '23:1', hours: 23, name: 'OMAD', note: 'One meal a day. For experienced fasters.' },
  { id: 'custom', hours: null, name: 'Custom', note: 'Pick your own goal, from 12 to 72 hours.' },
  { id: 'open', hours: null, name: 'Open', note: 'No goal: fast until you choose to stop.' },
]

export const MIN_CUSTOM_HOURS = 12
export const MAX_CUSTOM_HOURS = 72
// A fast can be started up to this far in the past (forgot to press start).
export const MAX_BACKDATE_HOURS = 48

/**
 * What the body is mostly doing at each point of a fast. Timings are
 * typical averages; they shift with your last meal, activity and how used
 * to fasting you are.
 */
export const FAST_STAGES = [
  { id: 'rising', from: 0, name: 'Blood sugar rising', short: 'Rising', color: '#7fd1ff', icon: 'M4 16l5-5 4 4 7-7M14 8h6v6', text: 'You are digesting your last meal. Insulin is up and your body is storing energy.' },
  { id: 'falling', from: 4, name: 'Blood sugar falling', short: 'Falling', color: '#5aa8ff', icon: 'M4 8l5 5 4-4 7 7M14 16h6v-6', text: 'Digestion is winding down. Insulin drops back towards normal.' },
  { id: 'normal', from: 8, name: 'Blood sugar normal', short: 'Normal', color: '#a497ff', icon: 'M3 12h4l2-4 4 8 2-4h6', text: 'Your body starts drawing on stored glycogen. Hunger often comes in waves now; water or black coffee help.' },
  { id: 'fatburn', from: 12, name: 'Fat burning', short: 'Fat burn', color: '#ff7a1a', icon: 'M12 3c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 0 3 1 4 3 4 0-3-1-5 0-8z', text: 'Glycogen is running low, so your body turns increasingly to stored fat for fuel.' },
  { id: 'ketosis', from: 18, name: 'Ketosis', short: 'Ketosis', color: '#ff5c93', icon: 'M13 2L4 14h7l-1 8 9-12h-7z', text: 'Your liver makes ketones from fat. Many people feel steadier energy and less hunger here.' },
  { id: 'autophagy', from: 24, name: 'Deep fast', short: 'Deep', color: '#3ecf6e', icon: 'M4 12a8 8 0 0 1 14-5l2 2M20 4v5h-5M20 12a8 8 0 0 1-14 5l-2-2M4 20v-5h5', text: 'Ketones keep rising and the body ramps up cellular recycling (autophagy). Mostly studied in animals; timing in people is uncertain.' },
]

// When a fast that started at `startedAt` reaches each stage.
export function stageTimes(startedAt, now = new Date()) {
  const start = new Date(startedAt).getTime()
  return FAST_STAGES.map((s) => {
    const at = new Date(start + s.from * 60 * 60 * 1000)
    return { ...s, at, reached: at.getTime() <= now.getTime() }
  })
}

export function initialFasting() {
  return { planId: '16:8', customHours: 16, active: null, logs: [] }
}

export function planHours(fasting) {
  if (fasting.planId === 'open') return null
  if (fasting.planId === 'custom') return fasting.customHours
  return FAST_PLANS.find((p) => p.id === fasting.planId)?.hours ?? 16
}

export function stageAt(hours) {
  let stage = FAST_STAGES[0]
  for (const s of FAST_STAGES) if (hours >= s.from) stage = s
  return stage
}

export function hoursBetween(startIso, end) {
  return Math.max(0, (new Date(end).getTime() - new Date(startIso).getTime()) / HOUR)
}

function validHours(h) {
  const n = Number(h)
  if (!Number.isFinite(n) || n < MIN_CUSTOM_HOURS || n > MAX_CUSTOM_HOURS) {
    throw new Error(`Pick a goal between ${MIN_CUSTOM_HOURS} and ${MAX_CUSTOM_HOURS} hours.`)
  }
  return Math.round(n * 2) / 2
}

export function choosePlan(fasting, planId, customHours) {
  if (!FAST_PLANS.some((p) => p.id === planId)) throw new Error('Unknown fasting plan.')
  const next = { ...fasting, planId, customHours: planId === 'custom' ? validHours(customHours ?? fasting.customHours) : fasting.customHours }
  // A fast in progress takes the new goal straight away.
  if (next.active) next.active = { ...next.active, targetHours: planHours(next) }
  return next
}

function checkStart(startIso, now) {
  const t = new Date(startIso).getTime()
  if (!Number.isFinite(t)) throw new Error('Pick a valid start time.')
  if (t > now.getTime() + 60 * 1000) throw new Error('The start time cannot be in the future.')
  if (now.getTime() - t > MAX_BACKDATE_HOURS * HOUR) throw new Error(`The start time can be at most ${MAX_BACKDATE_HOURS} hours ago.`)
  return new Date(t).toISOString()
}

export function startFast(fasting, now = new Date(), startedAt = now.toISOString()) {
  if (fasting.active) throw new Error('A fast is already running.')
  return { ...fasting, active: { startedAt: checkStart(startedAt, now), targetHours: planHours(fasting), planId: fasting.planId } }
}

export function editFastStart(fasting, startedAt, now = new Date()) {
  if (!fasting.active) throw new Error('No fast is running.')
  return { ...fasting, active: { ...fasting.active, startedAt: checkStart(startedAt, now) } }
}

let idCounter = 0

/** Ends the running fast and logs it. Returns { fasting, log }. */
export function endFast(fasting, now = new Date()) {
  const a = fasting.active
  if (!a) throw new Error('No fast is running.')
  const endedAt = now.toISOString()
  idCounter = (idCounter + 1) % 1e6
  const log = {
    id: `fast-${now.getTime().toString(36)}-${idCounter.toString(36)}`,
    startedAt: a.startedAt,
    endedAt,
    targetHours: a.targetHours,
    planId: a.planId,
  }
  // Under a minute is a mis-tap, not a fast: just cancel it.
  if (hoursBetween(a.startedAt, endedAt) < 1 / 60) return { fasting: { ...fasting, active: null }, log: null }
  return { fasting: { ...fasting, active: null, logs: [...fasting.logs, log].slice(-1000) }, log }
}

export function cancelFast(fasting) {
  return { ...fasting, active: null }
}

export function deleteFastLog(fasting, id) {
  return { ...fasting, logs: fasting.logs.filter((l) => l.id !== id) }
}

export function restoreFastLog(fasting, log) {
  if (fasting.logs.some((l) => l.id === log.id)) return fasting
  const logs = [...fasting.logs, log].sort((a, b) => a.endedAt.localeCompare(b.endedAt))
  return { ...fasting, logs }
}

export function fastHours(log) {
  return hoursBetween(log.startedAt, log.endedAt)
}

// A fast counts as complete when it reached its goal (open fasts: 12 hours).
export function reachedGoal(log) {
  return fastHours(log) >= (log.targetHours ?? MIN_CUSTOM_HOURS) - 1e-9
}

const localDay = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/**
 * Days in a row (ending today or yesterday) with at least one completed fast,
 * counted by the day each fast ended.
 */
export function fastStreak(logs, now = new Date()) {
  const days = new Set(logs.filter(reachedGoal).map((l) => localDay(l.endedAt)))
  let streak = 0
  const cursor = new Date(now)
  if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1)
  while (days.has(localDay(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function fastStats(logs, now = new Date()) {
  const hours = logs.map(fastHours)
  const completed = logs.filter(reachedGoal).length
  return {
    total: logs.length,
    completed,
    longest: hours.length ? Math.max(...hours) : 0,
    average: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : 0,
    streak: fastStreak(logs, now),
  }
}

/** The last 7 days (oldest first): the longest fast that ended each day. */
export function lastSevenDays(logs, now = new Date()) {
  const out = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY)
    const key = localDay(d)
    const ofDay = logs.filter((l) => localDay(l.endedAt) === key)
    const best = ofDay.reduce((m, l) => (fastHours(l) > (m ? fastHours(m) : -1) ? l : m), null)
    out.push({ date: key, weekday: d.toLocaleDateString(undefined, { weekday: 'narrow' }), hours: best ? fastHours(best) : 0, goal: best?.targetHours ?? null, reached: best ? reachedGoal(best) : false })
  }
  return out
}

export function formatDuration(hours) {
  const totalMin = Math.max(0, Math.floor(hours * 60))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

// Clock-style elapsed time, e.g. "16:04:09".
export function formatClockHours(hours) {
  const total = Math.max(0, Math.floor(hours * 3600))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Validates stored or restored fasting data and returns a clean copy. */
export function normalizeFasting(raw, fail) {
  if (raw === undefined) return initialFasting()
  if (raw === null || typeof raw !== 'object') fail('fasting', 'invalid')
  const isIso = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v))
  const isTarget = (v) => v === null || (typeof v === 'number' && v >= 1 && v <= MAX_CUSTOM_HOURS)
  if (!FAST_PLANS.some((p) => p.id === raw.planId)) fail('fasting.planId', 'unknown plan')
  const customHours = typeof raw.customHours === 'number' && raw.customHours >= MIN_CUSTOM_HOURS && raw.customHours <= MAX_CUSTOM_HOURS ? raw.customHours : 16
  let active = null
  if (raw.active) {
    const a = raw.active
    if (!isIso(a.startedAt) || !isTarget(a.targetHours ?? null)) fail('fasting.active', 'invalid')
    active = { startedAt: a.startedAt, targetHours: a.targetHours ?? null, planId: FAST_PLANS.some((p) => p.id === a.planId) ? a.planId : raw.planId }
  }
  if (!Array.isArray(raw.logs)) fail('fasting.logs', 'not a list')
  const logs = raw.logs.map((l, i) => {
    const p = `fasting.logs[${i}]`
    if (!l || typeof l.id !== 'string' || !isIso(l.startedAt) || !isIso(l.endedAt)) fail(p, 'invalid entry')
    if (Date.parse(l.endedAt) < Date.parse(l.startedAt)) fail(p, 'ends before it starts')
    if (!isTarget(l.targetHours ?? null)) fail(`${p}.targetHours`, 'invalid')
    return { id: l.id, startedAt: l.startedAt, endedAt: l.endedAt, targetHours: l.targetHours ?? null, planId: FAST_PLANS.some((x) => x.id === l.planId) ? l.planId : 'open' }
  })
  return { planId: raw.planId, customHours, active, logs }
}
