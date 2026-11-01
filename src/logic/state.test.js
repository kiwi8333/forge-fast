import { describe, expect, it } from 'vitest'
import {
  addBodyweight,
  beginFast,
  createInitialState,
  deleteBodyweight,
  finishFast,
  importFromForge,
  normalizeState,
  parseBackupFile,
  serializeBackup,
} from './state.js'

const at = (s) => new Date(s)

describe('weight', () => {
  it('logs one weigh-in per day, rounded, and validates it', () => {
    let s = addBodyweight(createInitialState(), '2026-10-30', '82.468')
    s = addBodyweight(s, '2026-10-30', 82.1)
    expect(s.bodyweight).toEqual([{ date: '2026-10-30', kg: 82.1 }])
    expect(() => addBodyweight(s, '2026-10-31', 10)).toThrow(/between/)
    expect(deleteBodyweight(s, '2026-10-30').bodyweight).toEqual([])
  })
})

describe('validation and backup', () => {
  it('round-trips a backup unchanged', () => {
    let s = finishFast(beginFast(createInitialState(), at('2026-10-30T20:00:00')), at('2026-10-31T12:00:00'))
    s = addBodyweight(s, '2026-10-31', 81)
    const parsed = parseBackupFile(serializeBackup(s))
    expect(parsed).toEqual({ kind: 'restore', state: s })
  })

  it('rejects files that are not backups, and broken data', () => {
    expect(() => parseBackupFile('not json')).toThrow(/JSON/)
    expect(() => parseBackupFile('{"app":"other"}')).toThrow(/not a Forge/)
    expect(() => normalizeState({ version: 9 })).toThrow(/version/)
    expect(() => normalizeState({ version: 1, fasting: { planId: '16:8', logs: [] }, bodyweight: [{ date: 'x', kg: 80 }] })).toThrow(/bodyweight/)
  })
})

describe('importing from Forge', () => {
  const forgeBackup = (fasting, bodyweight) => JSON.stringify({ app: 'forge-bodybuilding', exportedAt: '2026-10-31T00:00:00Z', data: { version: 2, fasting, bodyweight, workouts: [] } })
  // A 16-hour fast ending at `end`.
  const log = (id, end) => ({ id, startedAt: new Date(new Date(end).getTime() - 16 * 3600e3).toISOString(), endedAt: end, targetHours: 16, planId: '16:8' })

  it('reads fasts and weigh-ins out of a Forge training backup', () => {
    const parsed = parseBackupFile(forgeBackup({ planId: '18:6', customHours: 16, active: null, logs: [log('a', '2026-10-30T12:00:00Z')] }, [{ date: '2026-10-30', kg: 84 }]))
    expect(parsed.kind).toBe('forge')
    expect(parsed.fasting.logs).toHaveLength(1)
    expect(parsed.bodyweight).toEqual([{ date: '2026-10-30', kg: 84 }])
  })

  it('merges without overwriting or duplicating', () => {
    let here = addBodyweight(createInitialState(), '2026-10-30', 83)
    here = { ...here, fasting: { ...here.fasting, logs: [log('a', '2026-10-30T12:00:00Z')] } }
    const imported = parseBackupFile(
      forgeBackup({ planId: '16:8', customHours: 16, active: { startedAt: '2026-10-31T20:00:00Z', targetHours: 16, planId: '16:8' }, logs: [log('a', '2026-10-30T12:00:00Z'), log('b', '2026-10-29T12:00:00Z')] }, [
        { date: '2026-10-30', kg: 84 },
        { date: '2026-10-29', kg: 84.5 },
      ]),
    )
    const { state, added } = importFromForge(here, imported)
    expect(added).toEqual({ fasts: 1, weights: 1, active: true })
    expect(state.fasting.logs.map((l) => l.id)).toEqual(['b', 'a'])
    expect(state.bodyweight).toEqual([
      { date: '2026-10-29', kg: 84.5 },
      { date: '2026-10-30', kg: 83 },
    ])
    expect(state.fasting.active.startedAt).toBe('2026-10-31T20:00:00Z')
    // A fast already running here is kept.
    const running = beginFast(createInitialState(), at('2026-11-01T08:00:00'))
    expect(importFromForge(running, imported).state.fasting.active).toEqual(running.fasting.active)
  })

  it('handles a Forge backup made before fasting existed', () => {
    const parsed = parseBackupFile(JSON.stringify({ app: 'forge-bodybuilding', data: { version: 2, workouts: [] } }))
    expect(parsed.fasting.logs).toEqual([])
    expect(parsed.bodyweight).toEqual([])
  })
})
