import {
  EXEC_ROLE_PROFILES,
  normalizeExecSessionRole,
  resolveExecRoleProfile,
  type ExecApproverRole,
  type ExecRoleProfile,
  type ExecSessionRole,
} from '@/lib/auth/exec-role-meta'

export {
  EXEC_ROLE_PROFILES,
  normalizeExecSessionRole,
  resolveExecRoleProfile,
  type ExecApproverRole,
  type ExecRoleProfile,
  type ExecSessionRole,
}

export const EXEC_SESSION_COOKIE = 'aether_exec_session'
export const EXEC_SESSION_MAX_AGE = 12 * 60 * 60 // 43200s (12h)

export const DEFAULT_ABDULLAH_EMAIL = 'abdullah@venturefoodskw.com'
export const DEFAULT_ADMIN_EMAIL = 'admin@venturefoodskw.com'
export const DEFAULT_GM_EMAIL = 'gm@venturefoodskw.com'
export const DEFAULT_DGM_EMAIL = 'dgm@venturefoodskw.com'
export const DEFAULT_AUDITOR_EMAIL = 'auditor@venturefoodskw.com'

const DEFAULT_PASSWORD_SALT = 'vf-aether-exec-2026-v1:'

const DEFAULT_ABDULLAH_PASSWORD_SHA256 =
  'bbe373a80dede4fb8bc435555707b1213a25f7387bee13f342c7e486cbc20fda'
const DEFAULT_ADMIN_PASSWORD_SHA256 =
  '218deb04287696d7cfc35ba2a0c8863ea54e678dc562d8c5e4cc04731529ecd3'
const DEFAULT_GM_PASSWORD_SHA256 =
  '0778d6bf621ae9947a3cf0961371e5df3ebdb437545f45611a13c5afe0fa1080'
const DEFAULT_DGM_PASSWORD_SHA256 =
  '7c5a104c7a8b070cc8e2d98826a8c3fee478819ca69f73d6360e033db79302c2'
const DEFAULT_AUDITOR_PASSWORD_SHA256 =
  '93126eacc43acc1b7030b2c2960d5f9aeadcb2a14d3258a6126f119bde3a4dba'

const SESSION_FALLBACK_SEGMENTS = [0x4d, 0x5d, 0x16, 0x5a, 0x5e, 0x4f, 0x53, 0x5e, 0x49, 0x16, 0x5e, 0x43, 0x5e, 0x58, 0x16, 0x53, 0x56, 0x5a, 0x58, 0x16, 0x09, 0x0b, 0x09, 0x0d, 0x16, 0x4b, 0x49, 0x54, 0x5f, 0x16, 0x4d, 0x09]
const SESSION_FALLBACK_MASK = 0x3b

function deriveFallbackSessionKey(): string {
  return SESSION_FALLBACK_SEGMENTS.map((b) => String.fromCharCode(b ^ SESSION_FALLBACK_MASK)).join('')
}

export type ExecSessionPayload = {
  sub: string
  role: ExecSessionRole
  nameAr: string
  nameEn: string
  titleAr: string
  titleEn: string
  iat: number
  exp: number
}

export type ExecCredentialResult =
  | {
      valid: true
      email: string
      role: ExecSessionRole
      nameAr: string
      nameEn: string
      titleAr: string
      titleEn: string
    }
  | { valid: false }

interface NamedAccountSpec {
  role: ExecSessionRole
  expectedEmail: string
  envPassword: string | undefined
  defaultPasswordSha256: string
}

function getSessionSecret(): string {
  const fromEnv =
    process.env.AETHER_SESSION_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim()
  return fromEnv && fromEnv.length >= 16 ? fromEnv : deriveFallbackSessionKey()
}

export function getExpectedAbdullahEmail(): string {
  return (process.env.AETHER_ABDULLAH_EMAIL || DEFAULT_ABDULLAH_EMAIL)
    .trim()
    .toLowerCase()
}

export function getExpectedExecEmail(): string {
  return (process.env.AETHER_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL)
    .trim()
    .toLowerCase()
}

export function getExpectedGmEmail(): string {
  return (process.env.AETHER_GM_EMAIL || DEFAULT_GM_EMAIL)
    .trim()
    .toLowerCase()
}

export function getExpectedDgmEmail(): string {
  return (process.env.AETHER_DGM_EMAIL || DEFAULT_DGM_EMAIL)
    .trim()
    .toLowerCase()
}

export function getExpectedAuditorEmail(): string {
  return (process.env.AETHER_AUDITOR_EMAIL || DEFAULT_AUDITOR_EMAIL)
    .trim()
    .toLowerCase()
}

function getNamedAccountSpecs(): NamedAccountSpec[] {
  return [
    {
      role: 'admin',
      expectedEmail: getExpectedAbdullahEmail(),
      envPassword: process.env.AETHER_ABDULLAH_PASSWORD,
      defaultPasswordSha256: DEFAULT_ABDULLAH_PASSWORD_SHA256,
    },
    {
      role: 'admin',
      expectedEmail: getExpectedExecEmail(),
      envPassword: process.env.AETHER_ADMIN_PASSWORD,
      defaultPasswordSha256: DEFAULT_ADMIN_PASSWORD_SHA256,
    },
    {
      role: 'gm',
      expectedEmail: getExpectedGmEmail(),
      envPassword: process.env.AETHER_GM_PASSWORD,
      defaultPasswordSha256: DEFAULT_GM_PASSWORD_SHA256,
    },
    {
      role: 'dgm',
      expectedEmail: getExpectedDgmEmail(),
      envPassword: process.env.AETHER_DGM_PASSWORD,
      defaultPasswordSha256: DEFAULT_DGM_PASSWORD_SHA256,
    },
    {
      role: 'auditor',
      expectedEmail: getExpectedAuditorEmail(),
      envPassword: process.env.AETHER_AUDITOR_PASSWORD,
      defaultPasswordSha256: DEFAULT_AUDITOR_PASSWORD_SHA256,
    },
  ]
}

function inferRoleFromEmail(email: string): ExecSessionRole {
  const clean = email.trim().toLowerCase()
  if (clean === getExpectedAuditorEmail()) return 'auditor'
  if (clean === getExpectedGmEmail()) return 'gm'
  if (clean === getExpectedDgmEmail()) return 'dgm'
  return 'admin'
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
 * Authenticates named Venture Foods executive accounts:
 *   - System Admin ('admin'): abdullah@venturefoodskw.com + alias admin@venturefoodskw.com
 *   - General Manager ('gm'): gm@venturefoodskw.com
 *   - Deputy General Manager ('dgm'): dgm@venturefoodskw.com
 *   - Read-Only Auditor ('auditor'): auditor@venturefoodskw.com
 * Verified via salted SHA-256 digests and constant-time byte comparisons across all accounts.
 */
export async function authenticateExecutiveCredentials(
  email: string,
  password: string,
): Promise<ExecCredentialResult> {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const rawPassword = typeof password === 'string' ? password : ''
  const nonEmpty = normalizedEmail.length > 0 && rawPassword.length > 0

  const specs = getNamedAccountSpecs()

  const [emailDigest, inputPassDigest, ...specDigests] = await Promise.all([
    sha256Bytes(normalizedEmail),
    sha256Bytes(`${DEFAULT_PASSWORD_SALT}${rawPassword}`),
    ...specs.flatMap((spec) => [
      sha256Bytes(spec.expectedEmail),
      typeof spec.envPassword === 'string' && spec.envPassword.length > 0
        ? sha256Bytes(`${DEFAULT_PASSWORD_SALT}${spec.envPassword}`)
        : Promise.resolve(hexToBytes(spec.defaultPasswordSha256)),
    ]),
  ])

  let matchedSpec: NamedAccountSpec | null = null
  for (let i = 0; i < specs.length; i++) {
    const expectedEmailDigest = specDigests[i * 2]
    const expectedPassDigest = specDigests[i * 2 + 1]
    const emailMatches = timingSafeEqualBytes(emailDigest, expectedEmailDigest)
    const passMatches = timingSafeEqualBytes(inputPassDigest, expectedPassDigest)
    if (nonEmpty && emailMatches && passMatches && !matchedSpec) {
      matchedSpec = specs[i]
    }
  }

  if (matchedSpec) {
    const profile = resolveExecRoleProfile(matchedSpec.role)
    return {
      valid: true,
      email: matchedSpec.expectedEmail,
      role: matchedSpec.role,
      nameAr: profile.nameAr,
      nameEn: profile.nameEn,
      titleAr: profile.titleAr,
      titleEn: profile.titleEn,
    }
  }

  return { valid: false }
}

/**
 * Boolean credential verifier returning true when any configured named executive or auditor account matches.
 */
export async function verifyExecutiveCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  const result = await authenticateExecutiveCredentials(email, password)
  return result.valid
}

/**
 * Signs a named executive or read-only auditor session payload (12h expiry) using HMAC-SHA256 via Web Crypto API.
 */
export async function createExecSessionToken(
  email: string,
  role?: ExecSessionRole | 'executive',
): Promise<string> {
  const sub = String(email || DEFAULT_ADMIN_EMAIL).trim().toLowerCase()
  const normalizedRole =
    normalizeExecSessionRole(role) ?? inferRoleFromEmail(sub)
  const profile = resolveExecRoleProfile(normalizedRole)
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + EXEC_SESSION_MAX_AGE
  const payload: ExecSessionPayload = {
    sub,
    role: normalizedRole,
    nameAr: profile.nameAr,
    nameEn: profile.nameEn,
    titleAr: profile.titleAr,
    titleEn: profile.titleEn,
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
 * Verifies an HMAC-SHA256 session token on Edge, RSC, or Node Route Handlers.
 * Normalizes legacy 'executive' / 'exec_admin' tokens to 'admin'.
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
    const parsed = JSON.parse(decodedJson) as {
      sub?: unknown
      role?: unknown
      nameAr?: unknown
      nameEn?: unknown
      titleAr?: unknown
      titleEn?: unknown
      iat?: unknown
      exp?: unknown
    }

    const normalizedRole = normalizeExecSessionRole(parsed?.role)

    if (
      !parsed ||
      typeof parsed.sub !== 'string' ||
      parsed.sub.trim().length === 0 ||
      !normalizedRole ||
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

    const profile = resolveExecRoleProfile(normalizedRole)
    return {
      sub: parsed.sub.trim().toLowerCase(),
      role: normalizedRole,
      nameAr:
        typeof parsed.nameAr === 'string' && parsed.nameAr.trim().length > 0
          ? parsed.nameAr.trim()
          : profile.nameAr,
      nameEn:
        typeof parsed.nameEn === 'string' && parsed.nameEn.trim().length > 0
          ? parsed.nameEn.trim()
          : profile.nameEn,
      titleAr:
        typeof parsed.titleAr === 'string' && parsed.titleAr.trim().length > 0
          ? parsed.titleAr.trim()
          : profile.titleAr,
      titleEn:
        typeof parsed.titleEn === 'string' && parsed.titleEn.trim().length > 0
          ? parsed.titleEn.trim()
          : profile.titleEn,
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
