import {
  EXEC_ROLE_PROFILES,
  EXEC_ROLE_WHITELIST,
  isValidExecRole,
  normalizeExecSessionRole,
  resolveExecRoleProfile,
  VALID_EXEC_ROLES,
  type ExecApproverRole,
  type ExecRole,
  type ExecRoleProfile,
  type ExecSessionRole,
} from '@/lib/auth/exec-role-meta'
import { ExecRoleDeniedError, resolveSessionSecret } from '@/lib/auth/session-secret'

export {
  EXEC_ROLE_PROFILES,
  EXEC_ROLE_WHITELIST,
  isValidExecRole,
  normalizeExecSessionRole,
  resolveExecRoleProfile,
  VALID_EXEC_ROLES,
  type ExecApproverRole,
  type ExecRole,
  type ExecRoleProfile,
  type ExecSessionRole,
}

export const EXEC_SESSION_COOKIE = 'aether_exec_session'
export const EXEC_SESSION_MAX_AGE = 12 * 60 * 60 // 43200s (12h)

export const DEFAULT_ABDULLAH_EMAIL = 'abdullah@venturefoodskw.com'
export const DEFAULT_ADMIN_EMAIL = 'admin@venturefoodskw.com'
export const DEFAULT_GM_EMAIL = 'gm@venturefoodskw.com'
export const DEFAULT_DGM_EMAIL = 'dgm@venturefoodskw.com'
export const DEFAULT_OPS_EMAIL = 'operations@venturefoodskw.com'
export const DEFAULT_CFO_EMAIL = 'cfo@venturefoodskw.com'
export const DEFAULT_FINANCE_ALIAS_EMAIL = 'finance@venturefoodskw.com'
export const DEFAULT_MARKETING_EMAIL = 'marketing@venturefoodskw.com'
export const DEFAULT_MARKETING_ALIAS_EMAIL = 'mkt@venturefoodskw.com'
export const DEFAULT_SUPPLY_EMAIL = 'supply@venturefoodskw.com'
export const DEFAULT_SUPPLY_ALIAS_EMAIL = 'kitchen@venturefoodskw.com'
export const DEFAULT_AUDITOR_EMAIL = 'auditor@venturefoodskw.com'
/** Read-only QA login. Password comes only from `AETHER_QA_PASSWORD` at runtime. */
export const DEFAULT_QA_EMAIL = 'qa-readonly@venturefoodskw.com'

const DEFAULT_PASSWORD_SALT = 'vf-aether-exec-2026-v1:'

export const DEFAULT_ABDULLAH_PASSWORD_SHA256 =
  'bbe373a80dede4fb8bc435555707b1213a25f7387bee13f342c7e486cbc20fda'
export const DEFAULT_ADMIN_PASSWORD_SHA256 =
  '218deb04287696d7cfc35ba2a0c8863ea54e678dc562d8c5e4cc04731529ecd3'
export const DEFAULT_GM_PASSWORD_SHA256 =
  '0778d6bf621ae9947a3cf0961371e5df3ebdb437545f45611a13c5afe0fa1080'
export const DEFAULT_DGM_PASSWORD_SHA256 =
  '7c5a104c7a8b070cc8e2d98826a8c3fee478819ca69f73d6360e033db79302c2'
export const DEFAULT_OPS_PASSWORD_SHA256 =
  '886a00b530e565a3f2544f8103d4fdead97154ffd2e36995340738ae6ff4b8ef'
export const DEFAULT_CFO_PASSWORD_SHA256 =
  'e7b409f0ff6fd09281f16366113ce65f540b42236be3a7cb6889e053b545de53'
export const DEFAULT_MARKETING_PASSWORD_SHA256 =
  '491a250410a9880ecd125afd393d810d2dc0f0514c696d916b9146881d340a27'
export const DEFAULT_SUPPLY_PASSWORD_SHA256 =
  '4469d39aa846b41faab0c61fed8e6dbecc930ce543c55f0685b7a0327bfdc1de'
export const DEFAULT_AUDITOR_PASSWORD_SHA256 =
  '93126eacc43acc1b7030b2c2960d5f9aeadcb2a14d3258a6126f119bde3a4dba'

const EXEC_PIN_SALT_PREFIX = 'vf-aether-exec-seal-v1::'
export const DEFAULT_EXEC_APPROVAL_PIN_HASH = 'vfh1_8658c76cf929a25c'

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
  role: ExecRole
  canonicalEmail: string
  expectedEmail: string
  envPassword: string | undefined
  defaultPasswordSha256: string
  /** No built-in digest. Login succeeds only when the env password is set and matches. */
  envPasswordOnly?: boolean
}

function getSessionSecret(): string {
  return resolveSessionSecret(deriveFallbackSessionKey())
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

export function getExpectedOpsEmail(): string {
  return (process.env.AETHER_OPS_EMAIL || DEFAULT_OPS_EMAIL)
    .trim()
    .toLowerCase()
}

export function getExpectedCfoEmail(): string {
  return (process.env.AETHER_CFO_EMAIL || DEFAULT_CFO_EMAIL)
    .trim()
    .toLowerCase()
}

export function getExpectedFinanceAliasEmail(): string {
  return (process.env.AETHER_FINANCE_EMAIL || DEFAULT_FINANCE_ALIAS_EMAIL)
    .trim()
    .toLowerCase()
}

export function getExpectedMarketingEmail(): string {
  return (process.env.AETHER_MARKETING_EMAIL || DEFAULT_MARKETING_EMAIL)
    .trim()
    .toLowerCase()
}

export function getExpectedMarketingAliasEmail(): string {
  return (process.env.AETHER_MKT_EMAIL || DEFAULT_MARKETING_ALIAS_EMAIL)
    .trim()
    .toLowerCase()
}

export function getExpectedSupplyEmail(): string {
  return (process.env.AETHER_SUPPLY_EMAIL || DEFAULT_SUPPLY_EMAIL)
    .trim()
    .toLowerCase()
}

export function getExpectedSupplyAliasEmail(): string {
  return (process.env.AETHER_KITCHEN_EMAIL || DEFAULT_SUPPLY_ALIAS_EMAIL)
    .trim()
    .toLowerCase()
}

export function getExpectedAuditorEmail(): string {
  return (process.env.AETHER_AUDITOR_EMAIL || DEFAULT_AUDITOR_EMAIL)
    .trim()
    .toLowerCase()
}

export function getExpectedQaEmail(): string {
  return (process.env.AETHER_QA_EMAIL || DEFAULT_QA_EMAIL)
    .trim()
    .toLowerCase()
}

function getNamedAccountSpecs(): NamedAccountSpec[] {
  return [
    {
      role: 'admin',
      canonicalEmail: DEFAULT_ABDULLAH_EMAIL,
      expectedEmail: getExpectedAbdullahEmail(),
      envPassword: process.env.AETHER_ABDULLAH_PASSWORD,
      defaultPasswordSha256: DEFAULT_ABDULLAH_PASSWORD_SHA256,
    },
    {
      role: 'admin',
      canonicalEmail: DEFAULT_ADMIN_EMAIL,
      expectedEmail: getExpectedExecEmail(),
      envPassword: process.env.AETHER_ADMIN_PASSWORD,
      defaultPasswordSha256: DEFAULT_ADMIN_PASSWORD_SHA256,
    },
    {
      role: 'gm',
      canonicalEmail: DEFAULT_GM_EMAIL,
      expectedEmail: getExpectedGmEmail(),
      envPassword: process.env.AETHER_GM_PASSWORD,
      defaultPasswordSha256: DEFAULT_GM_PASSWORD_SHA256,
    },
    {
      role: 'dgm',
      canonicalEmail: DEFAULT_DGM_EMAIL,
      expectedEmail: getExpectedDgmEmail(),
      envPassword: process.env.AETHER_DGM_PASSWORD,
      defaultPasswordSha256: DEFAULT_DGM_PASSWORD_SHA256,
    },
    {
      role: 'ops',
      canonicalEmail: DEFAULT_OPS_EMAIL,
      expectedEmail: getExpectedOpsEmail(),
      envPassword: process.env.AETHER_OPS_PASSWORD,
      defaultPasswordSha256: DEFAULT_OPS_PASSWORD_SHA256,
    },
    {
      role: 'cfo',
      canonicalEmail: DEFAULT_CFO_EMAIL,
      expectedEmail: getExpectedCfoEmail(),
      envPassword: process.env.AETHER_CFO_PASSWORD,
      defaultPasswordSha256: DEFAULT_CFO_PASSWORD_SHA256,
    },
    {
      role: 'cfo',
      canonicalEmail: DEFAULT_FINANCE_ALIAS_EMAIL,
      expectedEmail: getExpectedFinanceAliasEmail(),
      envPassword: process.env.AETHER_CFO_PASSWORD,
      defaultPasswordSha256: DEFAULT_CFO_PASSWORD_SHA256,
    },
    {
      role: 'marketing',
      canonicalEmail: DEFAULT_MARKETING_EMAIL,
      expectedEmail: getExpectedMarketingEmail(),
      envPassword: process.env.AETHER_MARKETING_PASSWORD,
      defaultPasswordSha256: DEFAULT_MARKETING_PASSWORD_SHA256,
    },
    {
      role: 'marketing',
      canonicalEmail: DEFAULT_MARKETING_ALIAS_EMAIL,
      expectedEmail: getExpectedMarketingAliasEmail(),
      envPassword: process.env.AETHER_MARKETING_PASSWORD,
      defaultPasswordSha256: DEFAULT_MARKETING_PASSWORD_SHA256,
    },
    {
      role: 'supply',
      canonicalEmail: DEFAULT_SUPPLY_EMAIL,
      expectedEmail: getExpectedSupplyEmail(),
      envPassword: process.env.AETHER_SUPPLY_PASSWORD,
      defaultPasswordSha256: DEFAULT_SUPPLY_PASSWORD_SHA256,
    },
    {
      role: 'supply',
      canonicalEmail: DEFAULT_SUPPLY_ALIAS_EMAIL,
      expectedEmail: getExpectedSupplyAliasEmail(),
      envPassword: process.env.AETHER_SUPPLY_PASSWORD,
      defaultPasswordSha256: DEFAULT_SUPPLY_PASSWORD_SHA256,
    },
    {
      role: 'auditor',
      canonicalEmail: DEFAULT_AUDITOR_EMAIL,
      expectedEmail: getExpectedAuditorEmail(),
      envPassword: process.env.AETHER_AUDITOR_PASSWORD,
      defaultPasswordSha256: DEFAULT_AUDITOR_PASSWORD_SHA256,
    },
    {
      role: 'auditor',
      canonicalEmail: DEFAULT_QA_EMAIL,
      expectedEmail: getExpectedQaEmail(),
      envPassword: process.env.AETHER_QA_PASSWORD,
      defaultPasswordSha256: '',
      envPasswordOnly: true,
    },
  ]
}

/** Named-account allowlist. Unknown emails are denied, not treated as admin. */
export function inferExecRoleFromEmail(email: string): ExecRole | null {
  const clean = String(email || '').trim().toLowerCase()
  if (!clean) return null
  if (clean === DEFAULT_AUDITOR_EMAIL || clean === getExpectedAuditorEmail()) {
    return 'auditor'
  }
  if (clean === DEFAULT_QA_EMAIL || clean === getExpectedQaEmail()) {
    return 'auditor'
  }
  if (clean === DEFAULT_GM_EMAIL || clean === getExpectedGmEmail()) {
    return 'gm'
  }
  if (clean === DEFAULT_DGM_EMAIL || clean === getExpectedDgmEmail()) {
    return 'dgm'
  }
  if (clean === DEFAULT_OPS_EMAIL || clean === getExpectedOpsEmail()) {
    return 'ops'
  }
  if (
    clean === DEFAULT_CFO_EMAIL ||
    clean === DEFAULT_FINANCE_ALIAS_EMAIL ||
    clean === getExpectedCfoEmail() ||
    clean === getExpectedFinanceAliasEmail()
  ) {
    return 'cfo'
  }
  if (
    clean === DEFAULT_MARKETING_EMAIL ||
    clean === DEFAULT_MARKETING_ALIAS_EMAIL ||
    clean === getExpectedMarketingEmail() ||
    clean === getExpectedMarketingAliasEmail()
  ) {
    return 'marketing'
  }
  if (
    clean === DEFAULT_SUPPLY_EMAIL ||
    clean === DEFAULT_SUPPLY_ALIAS_EMAIL ||
    clean === getExpectedSupplyEmail() ||
    clean === getExpectedSupplyAliasEmail()
  ) {
    return 'supply'
  }
  if (
    clean === DEFAULT_ABDULLAH_EMAIL ||
    clean === DEFAULT_ADMIN_EMAIL ||
    clean === getExpectedAbdullahEmail() ||
    clean === getExpectedExecEmail()
  ) {
    return 'admin'
  }
  return null
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
 * Authenticates all 8 named Venture Foods corporate roles (+ aliases):
 *   - System Admin ('admin'): abdullah@venturefoodskw.com + alias admin@venturefoodskw.com
 *   - General Manager ('gm'): gm@venturefoodskw.com (Approval PIN verified via verifyExecutiveApprovalPin)
 *   - Deputy General Manager ('dgm'): dgm@venturefoodskw.com (Approval PIN verified via verifyExecutiveApprovalPin)
 *   - Operations Manager ('ops'): operations@venturefoodskw.com
 *   - Finance Manager / CFO ('cfo'): cfo@venturefoodskw.com + alias finance@venturefoodskw.com
 *   - Marketing Lead ('marketing'): marketing@venturefoodskw.com + alias mkt@venturefoodskw.com
 *   - Central Kitchen & Supply ('supply'): supply@venturefoodskw.com + alias kitchen@venturefoodskw.com
 *   - Read-Only Auditor ('auditor'): auditor@venturefoodskw.com
 *
 * Normalizes email with `.trim().toLowerCase()` and trims accidental leading/trailing spaces
 * on password input while strictly preserving exact password case sensitivity.
 */
/** True when built-in default executive passwords are revoked (env-var passwords only). */
export function isRotatedPasswordEnforcementOn(): boolean {
  return String(process.env.AETHER_ENFORCE_ROTATED_PASSWORDS ?? '').trim().toLowerCase() === 'true'
}

export async function authenticateExecutiveCredentials(
  email: string,
  password: string,
): Promise<ExecCredentialResult> {
  const normalizedEmail = String(email ?? '').trim().toLowerCase()
  const normalizedPassword = typeof password === 'string' ? password.trim() : ''
  const nonEmpty = normalizedEmail.length > 0 && normalizedPassword.length > 0

  const specs = getNamedAccountSpecs()

  const [emailDigest, inputPassDigest, ...specDigests] = await Promise.all([
    sha256Bytes(normalizedEmail),
    sha256Bytes(`${DEFAULT_PASSWORD_SALT}${normalizedPassword}`),
    ...specs.flatMap((spec) => {
      const trimmedEnvPass =
        typeof spec.envPassword === 'string' ? spec.envPassword.trim() : ''
      return [
        sha256Bytes(spec.canonicalEmail.trim().toLowerCase()),
        sha256Bytes(spec.expectedEmail.trim().toLowerCase()),
        Promise.resolve(hexToBytes(spec.defaultPasswordSha256)),
        trimmedEnvPass.length > 0
          ? sha256Bytes(`${DEFAULT_PASSWORD_SALT}${trimmedEnvPass}`)
          : Promise.resolve(new Uint8Array(0)),
      ]
    }),
  ])

  const enforceRotated = isRotatedPasswordEnforcementOn()
  let matchedSpec: NamedAccountSpec | null = null
  for (let i = 0; i < specs.length; i++) {
    const base = i * 4
    const canonicalEmailDigest = specDigests[base]
    const expectedEmailDigest = specDigests[base + 1]
    const defaultPassDigest = specDigests[base + 2]
    const envPassDigest = specDigests[base + 3]

    const emailMatches =
      timingSafeEqualBytes(emailDigest, canonicalEmailDigest) ||
      timingSafeEqualBytes(emailDigest, expectedEmailDigest)
    // Phase 5 · Item 10: once rotated passwords are in place, AETHER_ENFORCE_ROTATED_PASSWORDS=true
    // revokes the built-in defaults so only the env-var password logs in (fail-closed if unset).
    const envPassMatches =
      envPassDigest.length > 0 && timingSafeEqualBytes(inputPassDigest, envPassDigest)
    const passMatches = specs[i].envPasswordOnly
      ? envPassMatches
      : (!enforceRotated && timingSafeEqualBytes(inputPassDigest, defaultPassDigest)) || envPassMatches

    if (nonEmpty && emailMatches && passMatches && !matchedSpec) {
      matchedSpec = specs[i]
    }
  }

  if (matchedSpec) {
    const profile = resolveExecRoleProfile(matchedSpec.role)
    return {
      valid: true,
      email: normalizedEmail,
      role: matchedSpec.role,
      nameAr: profile.nameAr,
      nameEn: profile.nameEn,
      titleAr: profile.titleAr,
      titleEn: profile.titleEn,
    }
  }

  return { valid: false }
}

function hashExecApprovalPin(pin: string): string {
  const clean = pin.trim()
  const input = `${EXEC_PIN_SALT_PREFIX}${clean}::venturefoods-kw`
  let h1 = 0xdeadbeef ^ input.length
  let h2 = 0x41c6ce57 ^ input.length
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0')
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0')
  return `vfh1_${hex2}${hex1}`
}

/**
 * Verifies the 4-digit Executive Approval PIN for `gm`, `dgm`, and authorized executive roles.
 * Always rejects `auditor` (Read-Only) and non-4-digit inputs.
 */
export function verifyExecutiveApprovalPin(
  role: unknown,
  candidatePin: string,
): boolean {
  const normalizedRole = normalizeExecSessionRole(role)
  if (!normalizedRole) return false
  const profile = resolveExecRoleProfile(normalizedRole)
  if (!profile.canApprove || profile.isAuditor) return false
  const clean = typeof candidatePin === 'string' ? candidatePin.trim() : ''
  if (!/^\d{4}$/.test(clean)) return false
  return hashExecApprovalPin(clean) === DEFAULT_EXEC_APPROVAL_PIN_HASH
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
  const sub = String(email || '').trim().toLowerCase()
  const normalizedRole =
    normalizeExecSessionRole(role) ?? inferExecRoleFromEmail(sub)
  if (!sub || !normalizedRole || !EXEC_ROLE_WHITELIST.has(normalizedRole)) {
    throw new ExecRoleDeniedError()
  }
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
      !EXEC_ROLE_WHITELIST.has(normalizedRole) ||
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
