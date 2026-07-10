// All cryptography uses the native WebCrypto API — no libraries (spec §1).
// Key derivation: PBKDF2-SHA-256, ≥310k iterations, random 16-byte salt (spec §2.1).
// Payload encryption: AES-GCM-256 with a fresh 12-byte IV per write (spec §2.2).

const te = new TextEncoder()
const td = new TextDecoder()

export const PBKDF2_ITERATIONS = 310000
export const VERIFY_CONSTANT = 'soap-note-builder-verify-v1'

export function randomBytes(n) {
  const b = new Uint8Array(n)
  crypto.getRandomValues(b)
  return b
}

export async function deriveKey(passphrase, salt, iterations = PBKDF2_ITERATIONS) {
  const material = await crypto.subtle.importKey('raw', te.encode(passphrase), 'PBKDF2', false, [
    'deriveKey'
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable — the raw key can never be read out or stored
    ['encrypt', 'decrypt']
  )
}

// Blob layout: [12-byte IV][AES-GCM ciphertext]. The IV is stored alongside
// the ciphertext, never reused (fresh random per write).
export async function encryptJSON(key, obj) {
  const iv = randomBytes(12)
  const pt = te.encode(JSON.stringify(obj))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt))
  const blob = new Uint8Array(12 + ct.length)
  blob.set(iv, 0)
  blob.set(ct, 12)
  return blob
}

export async function decryptJSON(key, blob) {
  const iv = blob.slice(0, 12)
  const ct = blob.slice(12)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return JSON.parse(td.decode(pt))
}

// Verification value: encrypt a known constant; on unlock, decrypt and compare.
// The passphrase and raw key are never stored (spec §2.1).
export async function makeVerification(key) {
  return encryptJSON(key, VERIFY_CONSTANT)
}

export async function checkVerification(key, blob) {
  try {
    return (await decryptJSON(key, blob)) === VERIFY_CONSTANT
  } catch {
    return false // AES-GCM auth tag mismatch → wrong passphrase
  }
}
