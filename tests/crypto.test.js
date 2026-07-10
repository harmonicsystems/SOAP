import { describe, it, expect } from 'vitest'
import {
  deriveKey,
  encryptJSON,
  decryptJSON,
  makeVerification,
  checkVerification,
  randomBytes,
  PBKDF2_ITERATIONS
} from '../src/lib/crypto.js'

// Low iteration count keeps tests fast; production always uses PBKDF2_ITERATIONS.
const ITER = 1000

describe('crypto', () => {
  it('meets the spec minimum iteration count', () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(310000)
  })

  it('round-trips an object', async () => {
    const salt = randomBytes(16)
    const key = await deriveKey('correct horse battery', salt, ITER)
    const payload = { a: 1, s: 'héllo — with unicode', nested: { list: [1, 2, 3] } }
    const blob = await encryptJSON(key, payload)
    expect(await decryptJSON(key, blob)).toEqual(payload)
  })

  it('fails with the wrong passphrase', async () => {
    const salt = randomBytes(16)
    const right = await deriveKey('right passphrase', salt, ITER)
    const wrong = await deriveKey('wrong passphrase', salt, ITER)
    const blob = await encryptJSON(right, { secret: true })
    await expect(decryptJSON(wrong, blob)).rejects.toThrow()
    expect(await checkVerification(wrong, await makeVerification(right))).toBe(false)
    expect(await checkVerification(right, await makeVerification(right))).toBe(true)
  })

  it('uses a fresh IV per write (same plaintext, different ciphertext)', async () => {
    const key = await deriveKey('p', randomBytes(16), ITER)
    const a = await encryptJSON(key, { x: 1 })
    const b = await encryptJSON(key, { x: 1 })
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false)
    expect(a.length).toBeGreaterThan(12) // IV prefix present
  })
})
