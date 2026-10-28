/**
 * A signed cookie for the local browser suite only.
 *
 * It is accepted only when AETHER_E2E=1, the process is not production, and DATABASE_URL points at 127.0.0.1.
 * A remote database, Staging, or Production ignores the cookie. Membership and permissions are still read from the
 * database afterwards: the cookie names the person, and it does not grant a permission.
 */

export const E2E_COOKIE = 'aether_e2e'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_AGE_SECONDS = 2 * 60 * 60

export function e2eEnabled(): boolean {
  if (process.env.AETHER_E2E !== '1') return false
  if (process.env.NODE_ENV === 'production') return false
  const secret = process.env.AETHER_E2E_SECRET
  if (!secret || secret.length < 32) return false
  const database = process.env.DATABASE_URL
  if (!database) return false
  try {
    return new URL(database).hostname === '127.0.0.1'
  } catch {
    return false
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

async function mac(secret: string, userId: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(userId))
  return bytesToBase64Url(new Uint8Array(signed))
}

/** The cookie value for one synthetic user. It expires after two hours. The local runner calls this. */
export async function signE2eCookie(userId: string, secret: string, expiresAt = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS): Promise<string> {
  const body = `${userId}.${expiresAt}`
  return `${body}.${await mac(secret, body)}`
}

/** The user id inside a valid, unexpired local cookie, or null when the gate is closed, the signature is wrong, or the cookie has expired. */
export async function e2eUserId(value: string | undefined): Promise<string | null> {
  if (!e2eEnabled() || !value) return null
  const secret = process.env.AETHER_E2E_SECRET
  if (!secret) return null
  const parts = value.split('.')
  if (parts.length !== 3) return null
  const [userId, expiryText, presented] = parts
  const expiresAt = Number(expiryText)
  const now = Math.floor(Date.now() / 1000)
  if (!UUID.test(userId) || !Number.isInteger(expiresAt) || expiresAt <= now || expiresAt > now + MAX_AGE_SECONDS + 60) return null
  const expected = await mac(secret, `${userId}.${expiresAt}`)
  if (presented.length !== expected.length) return null
  let mismatch = 0
  for (let index = 0; index < expected.length; index += 1) mismatch |= presented.charCodeAt(index) ^ expected.charCodeAt(index)
  return mismatch === 0 ? userId : null
}
