import { describe, expect, it } from 'vitest'
import {
  FAST_STAGES,
  choosePlan,
  editFastStart,
  endFast,
  fastStats,
  fastStreak,
  formatClockHours,
  formatDuration,
  initialFasting,
  lastSevenDays,
  normalizeFasting,
  planHours,
  reachedGoal,
  restoreFastLog,
  deleteFastLog,
  stageAt,
  startFast,
  stageTimes,
} from './fasting.js'
import { beginFast, createInitialState, finishFast, normalizeState } from './state.js'

const at = (s) => new Date(s)
const fail = (path, why) => {
  throw new Error(`${path}: ${why}`)
}

describe('fasting plans and stages', () => {
  it('reads the goal from the plan', () => {
    const f = initialFasting()
    expect(planHours(f)).toBe(16)
    expect(planHours(choosePlan(f, '20:4'))).toBe(20)
    expect(planHours(choosePlan(f, 'custom', 36))).toBe(36)
    expect(planHours(choosePlan(f, 'open'))).toBeNull()
    expect(() => choosePlan(f, 'custom', 5)).toThrow(/between/)
    expect(() => choosePlan(f, 'nope')).toThrow()
  })

  it('moves through the stages at the right hours', () => {
    expect(stageAt(0).id).toBe('rising')
    expect(stageAt(11.9).id).toBe('normal')
    expect(stageAt(12).id).toBe('fatburn')
    expect(stageAt(18).id).toBe('ketosis')
    expect(stageAt(30).id).toBe('autophagy')
    const starts = FAST_STAGES.map((s) => s.from)
    expect(starts).toEqual(starts.toSorted((a, b) => a - b))
  })

  it('formats durations', () => {
    expect(formatDuration(16.5)).toBe('16h 30m')
    expect(formatDuration(0.25)).toBe('15m')
    expect(formatClockHours(1.5 + 5 / 3600)).toBe('01:30:05')
  })
})

describe('running a fast', () => {
  it('starts, changes the start time, and ends with a log entry', () => {
    let f = startFast(initialFasting(), at('2026-10-20T20:00:00'))
    expect(f.active.targetHours).toBe(16)
    expect(() => startFast(f, at('2026-10-20T21:00:00'))).toThrow(/already/)
    f = editFastStart(f, '2026-10-20T19:00:00', at('2026-10-20T21:00:00'))
    expect(() => editFastStart(f, '2026-10-21T23:00:00', at('2026-10-20T21:00:00'))).toThrow(/future/)
    expect(() => editFastStart(f, '2026-10-17T19:00:00', at('2026-10-20T21:00:00'))).toThrow(/at most/)
    const { fasting, log } = endFast(f, at('2026-10-21T11:30:00'))
    expect(fasting.active).toBeNull()
    expect(fasting.logs).toEqual([log])
    expect(reachedGoal(log)).toBe(true)
  })

  it('treats a fast stopped within a minute as cancelled', () => {
    const f = startFast(initialFasting(), at('2026-10-20T20:00:00'))
    const r = endFast(f, at('2026-10-20T20:00:30'))
    expect(r.log).toBeNull()
    expect(r.fasting.logs).toHaveLength(0)
  })

  it('switching plan mid-fast updates the goal', () => {
    const f = choosePlan(startFast(initialFasting(), at('2026-10-20T20:00:00')), '18:6')
    expect(f.active.targetHours).toBe(18)
  })

  it('deletes and restores a log in date order', () => {
    let f = initialFasting()
    for (const day of ['18', '19', '20']) f = endFast(startFast(f, at(`2026-10-${day}T08:00:00`)), at(`2026-10-${day}T22:00:00`)).fasting
    const middle = f.logs[1]
    const back = restoreFastLog(deleteFastLog(f, middle.id), middle)
    expect(back.logs.map((l) => l.id)).toEqual(f.logs.map((l) => l.id))
    expect(restoreFastLog(back, middle)).toBe(back)
  })
})

describe('fasting history', () => {
  const log = (start, end, targetHours = 16) => ({ id: start, startedAt: start, endedAt: end, targetHours, planId: '16:8' })
  const logs = [
    log('2026-10-17T20:00:00', '2026-10-18T13:00:00'), // 17 h, reached
    log('2026-10-18T20:00:00', '2026-10-19T10:00:00'), // 14 h, missed
    log('2026-10-19T20:00:00', '2026-10-20T12:30:00'), // 16.5 h
    log('2026-10-20T20:00:00', '2026-10-21T12:00:00'), // 16 h
  ]

  it('counts the streak of days with a completed fast', () => {
    expect(fastStreak(logs, at('2026-10-21T15:00:00'))).toBe(2)
    expect(fastStreak(logs, at('2026-10-22T09:00:00'))).toBe(2) // today not done yet
    expect(fastStreak(logs, at('2026-10-23T09:00:00'))).toBe(0)
  })

  it('summarises totals and the last seven days', () => {
    const s = fastStats(logs, at('2026-10-21T15:00:00'))
    expect(s).toMatchObject({ total: 4, completed: 3, longest: 17, streak: 2 })
    const week = lastSevenDays(logs, at('2026-10-21T15:00:00'))
    expect(week).toHaveLength(7)
    expect(week.at(-1)).toMatchObject({ date: '2026-10-21', hours: 16, reached: true })
    expect(week.at(-3)).toMatchObject({ date: '2026-10-19', hours: 14, reached: false })
    expect(week[0].hours).toBe(0)
  })
})

describe('fasting data', () => {
  it('survives a save and reload, and older saves without it load fresh', () => {
    let s = createInitialState()
    s = finishFast(beginFast(s, at('2026-10-20T20:00:00')), at('2026-10-21T12:00:00'))
    s = beginFast(s, at('2026-10-21T20:00:00'))
    const reloaded = normalizeState(JSON.parse(JSON.stringify(s)))
    expect(reloaded.fasting).toEqual(s.fasting)
    const old = JSON.parse(JSON.stringify(createInitialState()))
    delete old.fasting
    expect(normalizeState(old).fasting).toEqual(initialFasting())
  })

  it('rejects broken fasting data', () => {
    expect(() => normalizeFasting({ planId: 'x', logs: [] }, fail)).toThrow(/planId/)
    expect(() => normalizeFasting({ planId: '16:8', logs: [{ id: 'a', startedAt: '2026-10-21T10:00:00Z', endedAt: '2026-10-20T10:00:00Z' }] }, fail)).toThrow(/before/)
    expect(() => normalizeFasting({ planId: '16:8', logs: 'no' }, fail)).toThrow(/list/)
  })
})

describe('stage times and colours', () => {
  it('works out when each stage is reached', () => {
    const times = stageTimes('2026-10-20T20:00:00', new Date('2026-10-21T10:00:00'))
    expect(times.map((t) => t.id)).toEqual(['rising', 'falling', 'normal', 'fatburn', 'ketosis', 'autophagy'])
    expect(times[3].at.getTime()).toBe(new Date('2026-10-21T08:00:00').getTime())
    expect(times.map((t) => t.reached)).toEqual([true, true, true, true, false, false])
  })

  it('gives every stage a distinct colour and an icon', () => {
    expect(new Set(FAST_STAGES.map((s) => s.color)).size).toBe(FAST_STAGES.length)
    for (const s of FAST_STAGES) expect(s.icon.length).toBeGreaterThan(10)
  })
})
