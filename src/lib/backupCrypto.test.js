import { describe, expect, it } from 'vitest'
import { decryptBackup, encryptBackup, isEncryptedBackup } from './backupCrypto.js'

const backup = JSON.stringify({ app: 'test-app', exportedAt: '2026-11-01T10:00:00Z', data: { secret: 'resting HR 62', list: [1, 2, 3] } })
// Fewer iterations keep the tests fast; real backups use 310,000.
const fast = { iterations: 100000 }

describe('encrypted backups', () => {
  it('round-trips with the right password and hides the contents', async () => {
    const locked = await encryptBackup(backup, 'correct horse', fast)
    expect(isEncryptedBackup(locked)).toBe(true)
    expect(isEncryptedBackup(backup)).toBe(false)
    expect(locked).not.toContain('resting HR')
    expect(JSON.parse(locked)).toMatchObject({ app: 'test-app', exportedAt: '2026-11-01T10:00:00Z' })
    expect(await decryptBackup(locked, 'correct horse')).toBe(backup)
  })

  it('rejects a wrong password and a tampered file', async () => {
    const locked = await encryptBackup(backup, 'correct horse', fast)
    await expect(decryptBackup(locked, 'wrong horse!')).rejects.toThrow(/Wrong password/)
    const f = JSON.parse(locked)
    const bytes = atob(f.encrypted.data)
    f.encrypted.data = btoa(String.fromCharCode(bytes.charCodeAt(0) ^ 1) + bytes.slice(1))
    await expect(decryptBackup(JSON.stringify(f), 'correct horse')).rejects.toThrow(/Wrong password|changed/)
  })

  it('uses a fresh salt and IV every time, and needs a decent password', async () => {
    const a = JSON.parse(await encryptBackup(backup, 'correct horse', fast)).encrypted
    const b = JSON.parse(await encryptBackup(backup, 'correct horse', fast)).encrypted
    expect(a.salt).not.toBe(b.salt)
    expect(a.iv).not.toBe(b.iv)
    await expect(encryptBackup(backup, 'short', fast)).rejects.toThrow(/at least 8/)
  })

  it('refuses unknown formats and absurd settings', async () => {
    const f = JSON.parse(await encryptBackup(backup, 'correct horse', fast))
    f.encrypted.iterations = 10
    await expect(decryptBackup(JSON.stringify(f), 'correct horse')).rejects.toThrow(/format/)
  })
})
