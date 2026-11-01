import { describe, expect, it } from 'vitest'
import { STORAGE_KEY, loadState, saveState } from './storage.js'
import { createInitialState } from '../logic/state.js'

function memoryStorage({ failWrites = false } = {}) {
  const map = new Map()
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (failWrites) throw new Error('QuotaExceededError')
      map.set(k, String(v))
    },
  }
}

describe('storage', () => {
  it('starts fresh when nothing is saved', () => {
    const r = loadState(memoryStorage())
    expect(r.error).toBeNull()
    expect(r.state).toEqual(createInitialState())
  })

  it('round-trips saved state', () => {
    const s = memoryStorage()
    const initial = createInitialState()
    const state = { ...initial, bodyweight: [{ date: '2026-10-30', kg: 82.4 }] }
    saveState(state, s)
    expect(loadState(s).state).toEqual(state)
  })

  it('keeps a copy of corrupt data and reports it', () => {
    const s = memoryStorage()
    s.setItem(STORAGE_KEY, '{broken')
    const r = loadState(s)
    expect(r.error).toMatch(/could not be read/)
    expect(r.readOnly).toBeUndefined()
    const copies = [...s.map.keys()].filter((k) => k.startsWith('forge-fast:corrupt:'))
    expect(copies).toHaveLength(1)
    expect(s.map.get(copies[0])).toBe('{broken')
    // A second launch loads cleanly and does not copy again.
    const again = loadState(s)
    expect(again.error).toBeNull()
    expect([...s.map.keys()].filter((k) => k.startsWith('forge-fast:corrupt:'))).toHaveLength(1)
  })

  it('goes read-only when corrupt data cannot be copied', () => {
    const s = memoryStorage()
    s.map.set(STORAGE_KEY, '{"version":99}')
    s.setItem = () => {
      throw new Error('full')
    }
    const r = loadState(s)
    expect(r.readOnly).toBe(true)
    expect(s.map.get(STORAGE_KEY)).toBe('{"version":99}')
  })

  it('reports blocked storage', () => {
    const r = loadState({ getItem: () => { throw new Error('denied') } })
    expect(r.error).toMatch(/blocking storage/)
  })
})
