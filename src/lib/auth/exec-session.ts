export const EXEC_SESSION_COOKIE = 'aether_exec_session'
export const EXEC_SESSION_MAX_AGE = 12 * 60 * 60 // 43200s (12h)

export const DEFAULT_ADMIN_EMAIL = 'admin@venturefoodskw.com'
const DEFAULT_PASSWORD_SALT = 'vf-aether-exec-2026-v1:'
const DEFAULT_PASSWORD_SHA256 =
  '218deb04287696d7cfc35ba2a0c8863ea54e678dc562d8c5e4cc04731529ecd3'

const FALLBACK_SESSION_SECRET = 'vf-aether-exec-hmac-2026-prod-v2'

export type ExecSessionPayload = {
  sub: string
  role: 'exec_admin'
  iat: number
  exp: number
}

function getSessionSecret(): string {
  const fromEnv =
    process.env.AETHER_SESSION_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim()
  return fromEnv && fromEnv.length > 0 ? fromEnv : FALLBACK_SESSION_SECRET
}

export function getExpectedExecEmail(): string {
  return (process.env.AETHER_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL)
    .trim()
    .toLowerCase()
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase()
  const out = new Uint8Array(normalized.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length || a.length === 0) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

async function sha256Bytes(input: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(input)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded)
  return new Uint8Array(digest)
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlToBytes(input: string): Uint8Array | null {
  try {
    if (!input || !/^[A-Za-z0-9\-_]+$/.test(input)) return null
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
    const padLength = (4 - (base64.length % 4)) % 4
    const padded = base64 + '='.repeat(padLength)
    const binary = atob(padded)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i)
    }
    return out
  } catch {
    return null
  }
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const keyBytes = new TextEncoder().encode(secret)
  return globalThis.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await importHmacKey(secret)
  const sig = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  )
  return new Uint8Array(sig)
}

/**
 * Verifies executive credentials using salted SHA-256 and constant-time byte comparison.
 * Supports runtime overrides via AETHER_ADMIN_EMAIL and AETHER_ADMIN_PASSWORD.
 */
export async function verifyExecutiveCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const rawPassword = typeof password === 'string' ? password : ''
  const expectedEmail = getExpectedExecEmail()

  const [emailDigest, expectedEmailDigest, inputPassDigest] = await Promise.all([
    sha256Bytes(normalizedEmail),
    sha256Bytes(expectedEmail),
    sha256Bytes(`${DEFAULT_PASSWORD_SALT}${rawPassword}`),
  ])

  const envPassword = process.env.AETHER_ADMIN_PASSWORD
  const expectedPassDigest =
    typeof envPassword === 'string' && envPassword.length > 0
      ? await sha256Bytes(`${DEFAULT_PASSWORD_SALT}${envPassword}`)
      : hexToBytes(DEFAULT_PASSWORD_SHA256)

  const emailMatches = timingSafeEqualBytes(emailDigest, expectedEmailDigest)
  const passwordMatches = timingSafeEqualBytes(
    inputPassDigest,
    expectedPassDigest,
  )

  return (
    normalizedEmail.length > 0 &&
    rawPassword.length > 0 &&
    emailMatches &&
    passwordMatches
  )
}

/**
 * Signs an executive session payload (12h expiry) using HMAC-SHA256 via Web Crypto API.
 */
export async function createExecSessionToken(email: string): Promise<string> {
  const sub = String(email || DEFAULT_ADMIN_EMAIL).trim().toLowerCase()
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + EXEC_SESSION_MAX_AGE
  const payload: ExecSessionPayload = {
    sub,
    role: 'exec_admin',
    iat,
    exp,
  }
  const payloadB64 = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  )
  const sigBytes = await hmacSha256(getSessionSecret(), payloadB64)
  const sigB64 = bytesToBase64Url(sigBytes)
  return `${payloadB64}.${sigB64}`
}

/**
 * Verifies an HMAC-SHA256 executive session token on Edge, RSC, or Node Route Handlers.
 */
export async function verifyExecSessionToken(
  token: string | undefined | null,
): Promise<ExecSessionPayload | null> {
  try {
    if (!token || typeof token !== 'string') return null
    const dotIndex = token.indexOf('.')
    if (dotIndex <= 0 || token.indexOf('.', dotIndex + 1) !== -1) return null

    const payloadB64 = token.slice(0, dotIndex)
    const sigB64 = token.slice(dotIndex + 1)

    const payloadBytes = base64UrlToBytes(payloadB64)
    const providedSig = base64UrlToBytes(sigB64)
    if (!payloadBytes || !providedSig || providedSig.length !== 32) return null

    const expectedSig = await hmacSha256(getSessionSecret(), payloadB64)
    if (!timingSafeEqualBytes(providedSig, expectedSig)) return null

    const decodedJson = new TextDecoder().decode(payloadBytes)
    const parsed = JSON.parse(decodedJson) as Partial<ExecSessionPayload>

    if (
      !parsed ||
      typeof parsed.sub !== 'string' ||
      parsed.sub.trim().length === 0 ||
      parsed.role !== 'exec_admin' ||
      typeof parsed.iat !== 'number' ||
      !Number.isFinite(parsed.iat) ||
      typeof parsed.exp !== 'number' ||
      !Number.isFinite(parsed.exp)
    ) {
      return null
    }

    const nowSec = Math.floor(Date.now() / 1000)
    if (parsed.exp <= nowSec || parsed.iat > nowSec + 120) {
      return null
    }

    return {
      sub: parsed.sub.trim().toLowerCase(),
      role: 'exec_admin',
      iat: parsed.iat,
      exp: parsed.exp,
    }
  } catch {
    return null
  }
}

export function execCookieOptions(
  isSecure = process.env.NODE_ENV === 'production',
) {
  return {
    httpOnly: true,
    secure: Boolean(isSecure),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: EXEC_SESSION_MAX_AGE,
  }
}

export function isSecureRequest(request: Request): boolean {
  if (process.env.NODE_ENV === 'production') return true
  const forwarded = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
    .toLowerCase()
  if (forwarded === 'https') return true
  try {
    return new URL(request.url).protocol === 'https:'
  } catch {
    return false
  }
}

export function sanitizeExecNextPath(
  value: string | null | undefined,
  fallback = '/erp',
): string {
  if (!value || typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback
  }
  if (
    trimmed === '/' ||
    trimmed === '/login' ||
    trimmed.startsWith('/login?') ||
    trimmed.startsWith('/login/') ||
    trimmed.startsWith('/api/auth/')
  ) {
    return fallback
  }
  if (!/^\/[A-Za-z0-9\-_./?=&%]*$/.test(trimmed)) {
    return fallback
  }
  return trimmed
}
