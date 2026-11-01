import { createInitialState, normalizeState } from '../logic/state.js'

export const STORAGE_KEY = 'forge-fast:state'
const CORRUPT_PREFIX = 'forge-fast:corrupt:'

// Load saved state. Unreadable or invalid data is never silently discarded:
// it is copied to a separate key first, so it can still be recovered, and
// the app starts fresh with an explanation instead of crashing.
export function loadState(storage = globalThis.localStorage) {
  let raw
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return { state: createInitialState(), error: 'Your browser is blocking storage, so fasts cannot be saved on this device.' }
  }
  if (raw === null) return { state: createInitialState(), error: null }
  try {
    return { state: normalizeState(JSON.parse(raw)), error: null }
  } catch (e) {
    const key = `${CORRUPT_PREFIX}${Date.now()}`
    try {
      storage.setItem(key, raw)
    } catch {
      // Storage full; keep the original key untouched so nothing is lost.
      return { state: createInitialState(), error: `Saved data could not be read (${e.message}). It has been left in place and nothing will be saved until you restore a backup or reset in Settings.`, readOnly: true }
    }
    const fresh = createInitialState()
    try {
      // Replace the bad data now that it is safely copied, so the next launch
      // doesn't make another copy of it.
      storage.setItem(STORAGE_KEY, JSON.stringify(fresh))
    } catch {
      // Harmless: the next successful save overwrites it.
    }
    return { state: fresh, error: `Saved data could not be read (${e.message}). A copy was kept under "${key}". Restore a backup from Settings if you have one.` }
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state))
}
