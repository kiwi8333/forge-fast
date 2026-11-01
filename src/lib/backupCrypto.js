// Password-protected backups. The backup text is encrypted with AES-GCM
// (256-bit), using a key derived from the password with PBKDF2-SHA-256 and a
// random salt; a random IV is used for every backup. Everything runs in the
// browser's Web Crypto API: the password and plain data never leave the phone.
//
// An encrypted backup file looks like:
//   { "app": "<app id>", "exportedAt": "...", "encrypted": { "v": 1, "kdf": "PBKDF2-SHA-256",
//     "iterations": 310000, "salt": "<base64>", "iv": "<base64>", "data": "<base64>" } }

const ITERATIONS = 310000
export const MIN_PASSWORD = 8

const enc = new TextEncoder()
const dec = new TextDecoder()

function toBase64(bytes) {
  let s = ''
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b)
  return btoa(s)
}

function fromBase64(text) {
  const s = atob(text)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function deriveKey(password, salt, iterations, usage) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, [usage])
}

/** Wraps a backup's JSON text (from serializeBackup) in an encrypted envelope. */
export async function encryptBackup(backupText, password, { iterations = ITERATIONS } = {}) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) throw new Error(`Use a password of at least ${MIN_PASSWORD} characters.`)
  const { app, exportedAt } = JSON.parse(backupText)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, iterations, 'encrypt')
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(backupText))
  return JSON.stringify({ app, exportedAt, encrypted: { v: 1, kdf: 'PBKDF2-SHA-256', iterations, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(data) } })
}

export function isEncryptedBackup(text) {
  try {
    const f = JSON.parse(text)
    return Boolean(f && typeof f === 'object' && f.encrypted && typeof f.encrypted.data === 'string')
  } catch {
    return false
  }
}

/** Returns the original backup JSON text. A wrong password or a tampered file throws. */
export async function decryptBackup(text, password) {
  const { encrypted: e } = JSON.parse(text)
  if (e.v !== 1 || e.kdf !== 'PBKDF2-SHA-256' || !Number.isInteger(e.iterations) || e.iterations < 100000 || e.iterations > 5000000) {
    throw new Error('This encrypted backup uses a format this app does not know.')
  }
  try {
    const key = await deriveKey(password, fromBase64(e.salt), e.iterations, 'decrypt')
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(e.iv) }, key, fromBase64(e.data))
    return dec.decode(plain)
  } catch {
    throw new Error('Wrong password, or the file has been changed.')
  }
}
