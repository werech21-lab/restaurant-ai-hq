/**
 * A signed cookie for the local staging trial only.
 *
 * It is accepted only when AETHER_DEV_OWNER=1, the process is not production, and the request host is this machine.
 * The cookie names the owner of the aether-demo company. Membership and permissions are still read from the database.
 * Staging and Production deployments that do not set the flag ignore it.
 */

import { signE2eCookie } from '@/lib/auth/e2e-session'

export const DEV_OWNER_COOKIE = 'aether_dev_owner'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_AGE_SECONDS = 2 * 60 * 60

export function devOwnerEnabled(): boolean {
  if (process.env.AETHER_DEV_OWNER !== '1') return false
  if (process.env.NODE_ENV === 'production') return false
  const secret = process.env.AETHER_DEV_OWNER_SECRET
  return Boolean(secret && secret.length >= 32)
}

/** True only for a browser on this computer. A public host never qualifies. */
export function devOwnerHostAllowed(host: string | null): boolean {
  if (!host) return false
  const name = host.split(':')[0]?.toLowerCase()
  return name === '127.0.0.1' || name === 'localhost' || name === '[::1]'
}

/** Only a same-site path. Anything else returns the finance screen. */
export function devOwnerNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/erp/finance'
  return value
}

export async function signDevOwnerCookie(userId: string): Promise<string> {
  const secret = process.env.AETHER_DEV_OWNER_SECRET
  if (!secret) throw new Error('The dev owner secret is missing.')
  return signE2eCookie(userId, secret)
}

async function mac(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  let binary = ''
  for (const byte of new Uint8Array(signed)) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

/** The user id inside a valid local cookie, or null when the gate is closed or the signature is wrong. */
export async function devOwnerUserId(value: string | undefined, host: string | null): Promise<string | null> {
  if (!devOwnerEnabled() || !devOwnerHostAllowed(host) || !value) return null
  const secret = process.env.AETHER_DEV_OWNER_SECRET
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
