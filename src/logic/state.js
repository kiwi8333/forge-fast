// Pure state transitions for Forge Fast. No React and no storage here, so
// every rule is unit-tested directly.

import {
  cancelFast,
  choosePlan,
  deleteFastLog,
  editFastStart,
  endFast,
  initialFasting,
  normalizeFasting,
  restoreFastLog,
  setFastNotes,
  startFast,
} from './fasting.js'
import { validateWindow } from './schedule.js'

export const SCHEMA_VERSION = 1
export const BACKUP_APP_ID = 'forge-fast'
// Backups from the Forge training app, whose fasting data can be imported.
export const FORGE_BACKUP_APP_ID = 'forge-bodybuilding'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const DEFAULT_SETTINGS = { units: 'kg', theme: 'system', window: null }
export const UNITS = ['kg', 'lb']
export const THEMES = ['system', 'light', 'dark']

export function createInitialState() {
  return { version: SCHEMA_VERSION, fasting: initialFasting(), bodyweight: [], settings: { ...DEFAULT_SETTINGS } }
}

// Local calendar date as YYYY-MM-DD (not UTC, so a late-evening weigh-in counts today).
export function dateKey(date = new Date()) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------- Fasting ----------

export function setFastPlan(state, planId, customHours) {
  return { ...state, fasting: choosePlan(state.fasting, planId, customHours) }
}

export function beginFast(state, now = new Date(), startedAt) {
  return { ...state, fasting: startFast(state.fasting, now, startedAt ?? now.toISOString()) }
}

export function changeFastStart(state, startedAt, now = new Date()) {
  return { ...state, fasting: editFastStart(state.fasting, startedAt, now) }
}

export function finishFast(state, now = new Date()) {
  return { ...state, fasting: endFast(state.fasting, now).fasting }
}

export function abandonFast(state) {
  return { ...state, fasting: cancelFast(state.fasting) }
}

export function removeFastLog(state, id) {
  return { ...state, fasting: deleteFastLog(state.fasting, id) }
}

export function putBackFastLog(state, log) {
  return { ...state, fasting: restoreFastLog(state.fasting, log) }
}

export function saveFastNotes(state, id, notes) {
  return { ...state, fasting: setFastNotes(state.fasting, id, notes) }
}

// ---------- Settings ----------

export function setUnits(state, units) {
  if (!UNITS.includes(units)) throw new Error('Choose kg or lb.')
  return { ...state, settings: { ...state.settings, units } }
}

export function setTheme(state, theme) {
  if (!THEMES.includes(theme)) throw new Error('Choose a theme.')
  return { ...state, settings: { ...state.settings, theme } }
}

export function setEatingWindow(state, win) {
  return { ...state, settings: { ...state.settings, window: validateWindow(win) } }
}

// ---------- Weight ----------

// Weights are stored in kg; these convert for people who think in pounds.
export const KG_PER_LB = 0.45359237
export const toDisplay = (kg, units) => (units === 'lb' ? Math.round((kg / KG_PER_LB) * 10) / 10 : kg)
export const fromDisplay = (value, units) => (units === 'lb' ? Number(value) * KG_PER_LB : Number(value))

export function addBodyweight(state, date, kg) {
  const value = Number(kg)
  if (!DATE_RE.test(date)) throw new Error('Pick a valid date.')
  if (!Number.isFinite(value) || value < 25 || value > 300) throw new Error('Weight must be between 25 and 300 kg.')
  const rest = state.bodyweight.filter((e) => e.date !== date)
  // Two decimals, so a weight typed in pounds comes back exactly (180 lb, not 179.9).
  const bodyweight = [...rest, { date, kg: Math.round(value * 100) / 100 }].sort((a, b) => a.date.localeCompare(b.date))
  return { ...state, bodyweight }
}

export function deleteBodyweight(state, date) {
  return { ...state, bodyweight: state.bodyweight.filter((e) => e.date !== date) }
}

// ---------- Validation (on load and on restore) ----------

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

function fail(path, why) {
  throw new Error(`Invalid data at ${path}: ${why}`)
}

function checkBodyweight(list, path = 'bodyweight') {
  if (list === undefined) return []
  if (!Array.isArray(list)) fail(path, 'not a list')
  return list.map((e, i) => {
    if (!isObj(e) || !DATE_RE.test(e.date) || typeof e.kg !== 'number' || !Number.isFinite(e.kg) || e.kg <= 0 || e.kg > 500) fail(`${path}[${i}]`, 'invalid entry')
    return { date: e.date, kg: e.kg }
  })
}

// Settings were added after the first release; missing ones take defaults.
function checkSettings(raw) {
  if (raw === undefined) return { ...DEFAULT_SETTINGS }
  if (!isObj(raw)) fail('settings', 'invalid')
  const units = raw.units ?? DEFAULT_SETTINGS.units
  const theme = raw.theme ?? DEFAULT_SETTINGS.theme
  if (!UNITS.includes(units)) fail('settings.units', 'invalid')
  if (!THEMES.includes(theme)) fail('settings.theme', 'invalid')
  let win = null
  try {
    win = validateWindow(raw.window ?? null)
  } catch (err) {
    fail('settings.window', err.message)
  }
  return { units, theme, window: win }
}

/**
 * Checks stored or restored data thoroughly and returns a clean copy.
 * Throws a readable message on anything malformed, so bad data is rejected
 * as a whole instead of half-loading.
 */
export function normalizeState(raw) {
  if (!isObj(raw)) fail('root', 'not an object')
  if (raw.version !== SCHEMA_VERSION) fail('version', `expected ${SCHEMA_VERSION}, got ${JSON.stringify(raw.version)}`)
  return { version: SCHEMA_VERSION, fasting: normalizeFasting(raw.fasting, fail), bodyweight: checkBodyweight(raw.bodyweight), settings: checkSettings(raw.settings) }
}

// ---------- Backup ----------

export function serializeBackup(state, now = new Date()) {
  return JSON.stringify({ app: BACKUP_APP_ID, exportedAt: now.toISOString(), data: state }, null, 2)
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
}

/**
 * Reads a backup file. A Forge Fast backup replaces everything; a Forge
 * training-app backup is a source to import fasts and weigh-ins from.
 * Returns { kind: 'restore', state } or { kind: 'forge', fasting, bodyweight }.
 */
export function parseBackupFile(text) {
  const file = parseJson(text)
  if (!isObj(file)) throw new Error('This is not a Forge Fast or Forge backup file.')
  if (file.app === BACKUP_APP_ID) return { kind: 'restore', state: normalizeState(file.data) }
  if (file.app === FORGE_BACKUP_APP_ID) {
    const data = isObj(file.data) ? file.data : fail('data', 'missing')
    return { kind: 'forge', fasting: normalizeFasting(data.fasting, fail), bodyweight: checkBodyweight(data.bodyweight, 'data.bodyweight') }
  }
  throw new Error('This is not a Forge Fast or Forge backup file.')
}

/**
 * Merges fasts and weigh-ins from a Forge backup into this app. Nothing here
 * is overwritten: fasts already present (same id) are skipped, and a weigh-in
 * is only added for a day that has none. A running fast is taken over only
 * if none is running here. Returns { state, added: { fasts, weights } }.
 */
export function importFromForge(state, imported) {
  const ids = new Set(state.fasting.logs.map((l) => l.id))
  const newLogs = imported.fasting.logs.filter((l) => !ids.has(l.id))
  const logs = [...state.fasting.logs, ...newLogs].sort((a, b) => a.endedAt.localeCompare(b.endedAt))
  const days = new Set(state.bodyweight.map((b) => b.date))
  const newWeights = imported.bodyweight.filter((b) => !days.has(b.date))
  const bodyweight = [...state.bodyweight, ...newWeights].sort((a, b) => a.date.localeCompare(b.date))
  const active = state.fasting.active ?? imported.fasting.active
  return {
    state: { ...state, fasting: { ...state.fasting, logs, active }, bodyweight },
    added: { fasts: newLogs.length, weights: newWeights.length, active: !state.fasting.active && Boolean(imported.fasting.active) },
  }
}
