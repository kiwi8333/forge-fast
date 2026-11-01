// Badges earned from your fasting history, each with the date it was earned.
// Nothing is stored: they are worked out from the history every time, so
// deleting a fast can take a badge away again.

import { fastHours, reachedGoal } from './fasting.js'

const localDay = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const ACHIEVEMENTS = [
  { id: 'first', title: 'First fast', detail: 'Finish your first fast', icon: 'M12 3v18M5 10l7-7 7 7' },
  { id: 'h16', title: '16 hours', detail: 'A fast of 16 hours or more', hours: 16, icon: 'M12 7v5l3 3M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z' },
  { id: 'h18', title: 'Into ketosis', detail: 'A fast of 18 hours or more', hours: 18, icon: 'M13 2L4 14h7l-1 8 9-12h-7z' },
  { id: 'h24', title: 'Full day', detail: 'A fast of 24 hours or more', hours: 24, icon: 'M4 12a8 8 0 0 1 14-5l2 2M20 4v5h-5M20 12a8 8 0 0 1-14 5l-2-2M4 20v-5h5' },
  { id: 'streak3', title: '3-day streak', detail: 'Reach your goal 3 days in a row', streak: 3, icon: 'M12 3c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 0 3 1 4 3 4 0-3-1-5 0-8z' },
  { id: 'streak7', title: '7-day streak', detail: 'Reach your goal 7 days in a row', streak: 7, icon: 'M12 3c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 0 3 1 4 3 4 0-3-1-5 0-8z' },
  { id: 'streak30', title: '30-day streak', detail: 'Reach your goal 30 days in a row', streak: 30, icon: 'M12 3c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 0 3 1 4 3 4 0-3-1-5 0-8z' },
  { id: 'count10', title: '10 goals', detail: 'Reach your goal 10 times', count: 10, icon: 'M5 13l4 4L19 7' },
  { id: 'count50', title: '50 goals', detail: 'Reach your goal 50 times', count: 50, icon: 'M5 13l4 4L19 7' },
  { id: 'total100', title: '100 hours', detail: '100 hours fasted in total', total: 100, icon: 'M4 20h16M7 16v-5M12 16V6M17 16v-8' },
  { id: 'total500', title: '500 hours', detail: '500 hours fasted in total', total: 500, icon: 'M4 20h16M7 16v-5M12 16V6M17 16v-8' },
]

/** Every badge with { earned, earnedAt } (earnedAt: when the deciding fast ended). */
export function achievements(logs) {
  const sorted = [...logs].sort((a, b) => a.endedAt.localeCompare(b.endedAt))
  const earnedAt = {}
  const mark = (id, iso) => {
    if (!earnedAt[id]) earnedAt[id] = iso
  }
  let completed = 0
  let total = 0
  let streak = 0
  let lastDay = null
  for (const l of sorted) {
    const h = fastHours(l)
    total += h
    mark('first', l.endedAt)
    for (const a of ACHIEVEMENTS) if (a.hours && h >= a.hours) mark(a.id, l.endedAt)
    for (const a of ACHIEVEMENTS) if (a.total && total >= a.total) mark(a.id, l.endedAt)
    if (!reachedGoal(l)) continue
    completed++
    for (const a of ACHIEVEMENTS) if (a.count && completed >= a.count) mark(a.id, l.endedAt)
    // Streak of consecutive days with a goal reached (several fasts in a day count once).
    const day = localDay(l.endedAt)
    if (day !== lastDay) {
      const prev = lastDay ? new Date(`${lastDay}T12:00:00`) : null
      const cur = new Date(`${day}T12:00:00`)
      streak = prev && Math.round((cur - prev) / 86400000) === 1 ? streak + 1 : 1
      lastDay = day
    }
    for (const a of ACHIEVEMENTS) if (a.streak && streak >= a.streak) mark(a.id, l.endedAt)
  }
  return ACHIEVEMENTS.map((a) => ({ ...a, earned: Boolean(earnedAt[a.id]), earnedAt: earnedAt[a.id] ?? null }))
}

/** Badges earned by `after` that were not earned by `before` (e.g. on ending a fast). */
export function newlyEarned(beforeLogs, afterLogs) {
  const had = new Set(achievements(beforeLogs).filter((a) => a.earned).map((a) => a.id))
  return achievements(afterLogs).filter((a) => a.earned && !had.has(a.id))
}

/**
 * A month as calendar weeks (Monday first). Each day carries the longest fast
 * that ended on it (or null), for colouring by stage.
 */
export function monthGrid(logs, year, month) {
  const byDay = new Map()
  for (const l of logs) {
    const key = localDay(l.endedAt)
    if (!byDay.has(key) || fastHours(l) > fastHours(byDay.get(key))) byDay.set(key, l)
  }
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = (first.getDay() + 6) % 7
  const cells = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, key, log: byDay.get(key) ?? null })
  }
  while (cells.length % 7) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
