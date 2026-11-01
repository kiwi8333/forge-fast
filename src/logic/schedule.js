// The eating window: the hours you plan to eat (e.g. 12:00–20:00). Outside it
// you fast. Times are local "HH:MM"; a window may cross midnight.

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))

export function validateWindow(win) {
  if (win === null) return null
  if (!win || !TIME_RE.test(win.start) || !TIME_RE.test(win.end)) throw new Error('Pick a start and end time for your eating window.')
  const length = (minutesOf(win.end) - minutesOf(win.start) + 1440) % 1440
  if (length < 60 || length > 16 * 60) throw new Error('An eating window should be between 1 and 16 hours long.')
  return { start: win.start, end: win.end }
}

export function windowHours(win) {
  return ((minutesOf(win.end) - minutesOf(win.start) + 1440) % 1440) / 60
}

// The Date of a local "HH:MM" on the day of `day`.
function at(day, hhmm) {
  const d = new Date(day)
  d.setHours(Number(hhmm.slice(0, 2)), Number(hhmm.slice(3)), 0, 0)
  return d
}

/**
 * Where `now` sits relative to the eating window. Returns { open, opensAt,
 * closesAt }: when open, closesAt is when it closes (and your next fast
 * starts); when closed, opensAt is when you can eat again.
 */
export function windowStatus(win, now = new Date()) {
  const day = 24 * 60 * 60 * 1000
  // Check the window that started yesterday (for windows crossing midnight) and today's.
  for (const offset of [-1, 0, 1]) {
    const start = at(new Date(now.getTime() + offset * day), win.start)
    const end = new Date(start.getTime() + windowHours(win) * 60 * 60 * 1000)
    if (now >= start && now < end) return { open: true, opensAt: start, closesAt: end }
    if (now < start) return { open: false, opensAt: start, closesAt: end }
  }
  return { open: false, opensAt: null, closesAt: null }
}
