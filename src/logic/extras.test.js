import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, achievements, monthGrid, newlyEarned } from './achievements.js'
import { validateWindow, windowHours, windowStatus } from './schedule.js'
import { setFastNotes, initialFasting, normalizeFasting } from './fasting.js'
import { createInitialState, fromDisplay, normalizeState, saveFastNotes, setEatingWindow, setTheme, setUnits, toDisplay } from './state.js'

const fail = (path, why) => {
  throw new Error(`${path}: ${why}`)
}
// A fast of `hours` ending at `end` (local time string).
const log = (id, end, hours, targetHours = 16) => ({ id, startedAt: new Date(new Date(end).getTime() - hours * 3600e3).toISOString(), endedAt: new Date(end).toISOString(), targetHours, planId: '16:8' })

describe('eating window', () => {
  it('validates windows, including ones across midnight', () => {
    expect(validateWindow({ start: '12:00', end: '20:00' })).toEqual({ start: '12:00', end: '20:00' })
    expect(windowHours({ start: '20:00', end: '02:00' })).toBe(6)
    expect(validateWindow(null)).toBeNull()
    expect(() => validateWindow({ start: '12:00', end: '12:30' })).toThrow(/1 and 16/)
    expect(() => validateWindow({ start: '9am', end: '20:00' })).toThrow()
  })

  it('knows when the window is open and when it next opens or closes', () => {
    const win = { start: '12:00', end: '20:00' }
    const open = windowStatus(win, new Date('2026-11-01T15:00:00'))
    expect(open.open).toBe(true)
    expect(open.closesAt.getHours()).toBe(20)
    const morning = windowStatus(win, new Date('2026-11-01T09:00:00'))
    expect(morning).toMatchObject({ open: false })
    expect(morning.opensAt.getDate()).toBe(1)
    const night = windowStatus(win, new Date('2026-11-01T22:00:00'))
    expect(night.open).toBe(false)
    expect(night.opensAt.getDate()).toBe(2)
    // Across midnight: 20:00–02:00 is open at 01:00.
    expect(windowStatus({ start: '20:00', end: '02:00' }, new Date('2026-11-02T01:00:00')).open).toBe(true)
  })
})

describe('notes on a fast', () => {
  it('saves mood, energy, hunger, water and a note, and validates them', () => {
    let f = { ...initialFasting(), logs: [log('a', '2026-11-01T12:00:00', 16)] }
    f = setFastNotes(f, 'a', { mood: 4, energy: '3', hunger: '', water: 6, text: '  felt great ' })
    expect(f.logs[0].notes).toEqual({ mood: 4, energy: 3, hunger: null, water: 6, text: 'felt great' })
    expect(() => setFastNotes(f, 'a', { mood: 9 })).toThrow(/1 to 5/)
    expect(() => setFastNotes(f, 'zzz', { mood: 3 })).toThrow(/no longer/)
    expect(normalizeFasting(JSON.parse(JSON.stringify(f)), fail)).toEqual(f)
    expect(() => normalizeFasting({ ...f, logs: [{ ...f.logs[0], notes: { water: 99 } }] }, fail)).toThrow(/notes/)
  })
})

describe('achievements', () => {
  it('earns badges with the date of the deciding fast', () => {
    const logs = [log('a', '2026-11-01T12:00:00', 16.5), log('b', '2026-11-02T12:00:00', 17), log('c', '2026-11-03T13:00:00', 24.2)]
    const got = Object.fromEntries(achievements(logs).map((a) => [a.id, a]))
    expect(got.first.earnedAt).toBe(logs[0].endedAt)
    expect(got.h16.earned).toBe(true)
    expect(got.h24.earnedAt).toBe(logs[2].endedAt)
    expect(got.streak3.earnedAt).toBe(logs[2].endedAt)
    expect(got.streak7.earned).toBe(false)
    expect(achievements([]).every((a) => !a.earned)).toBe(true)
    expect(ACHIEVEMENTS.length).toBe(new Set(ACHIEVEMENTS.map((a) => a.id)).size)
  })

  it('breaks streaks on a missed day and reports new badges', () => {
    const logs = [log('a', '2026-11-01T12:00:00', 16), log('b', '2026-11-03T12:00:00', 16), log('c', '2026-11-04T12:00:00', 16)]
    expect(achievements(logs).find((a) => a.id === 'streak3').earned).toBe(false)
    const before = logs.slice(0, 2)
    expect(newlyEarned(before, logs).map((a) => a.id)).toEqual([])
    expect(newlyEarned([], [log('x', '2026-11-01T12:00:00', 18)]).map((a) => a.id)).toEqual(['first', 'h16', 'h18'])
  })

  it('lays out a month starting on Monday with the longest fast per day', () => {
    const logs = [log('a', '2026-11-03T12:00:00', 14), log('b', '2026-11-03T20:00:00', 18)]
    const weeks = monthGrid(logs, 2026, 10)
    expect(weeks[0].slice(0, 6)).toEqual([null, null, null, null, null, null]) // 1 Nov 2026 is a Sunday
    expect(weeks[0][6].day).toBe(1)
    const third = weeks.flat().find((c) => c?.day === 3)
    expect(third.log.id).toBe('b')
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })
})

describe('settings', () => {
  it('stores units, theme and eating window, with defaults for older data', () => {
    let s = setUnits(createInitialState(), 'lb')
    s = setTheme(s, 'light')
    s = setEatingWindow(s, { start: '12:00', end: '20:00' })
    expect(s.settings).toEqual({ units: 'lb', theme: 'light', window: { start: '12:00', end: '20:00' } })
    expect(normalizeState(JSON.parse(JSON.stringify(s)))).toEqual(s)
    const old = JSON.parse(JSON.stringify(createInitialState()))
    delete old.settings
    expect(normalizeState(old).settings).toEqual({ units: 'kg', theme: 'system', window: null })
    expect(() => setUnits(s, 'stone')).toThrow()
    expect(() => normalizeState({ ...s, settings: { units: 'kg', theme: 'neon' } })).toThrow(/theme/)
  })

  it('converts pounds both ways', () => {
    expect(toDisplay(80, 'lb')).toBe(176.4)
    expect(toDisplay(80, 'kg')).toBe(80)
    expect(fromDisplay(176.4, 'lb')).toBeCloseTo(80.01, 1)
  })

  it('a weight typed in pounds reads back the same', async () => {
    const { addBodyweight } = await import('./state.js')
    const s = addBodyweight(createInitialState(), '2026-11-01', fromDisplay(180, 'lb'))
    expect(toDisplay(s.bodyweight[0].kg, 'lb')).toBe(180)
  })

  it('saves notes through the app state', () => {
    let s = createInitialState()
    s = { ...s, fasting: { ...s.fasting, logs: [log('a', '2026-11-01T12:00:00', 16)] } }
    expect(saveFastNotes(s, 'a', { mood: 5 }).fasting.logs[0].notes.mood).toBe(5)
  })
})
