/**
 * Pure check, parsing, redaction, and report-rendering utilities for the
 * AetherBI deployment gate (`scripts/gate/checks.ts`).
 *
 * Kept dependency-free (no Playwright or network I/O) so every parser, text
 * check, tolerance rule, and report builder is directly unit-tested in Vitest.
 */

export const DEFAULT_EXPECTED_RECEIVABLES = 30310.675
export const DEFAULT_EXPECTED_YTD = 1743500
export const DEFAULT_YTD_TOLERANCE_PCT = 0.5
export const DEFAULT_GATE_TIMEOUT_MS = 135_000
export const DEFAULT_SETTLE_TIMEOUT_MS = 125_000

/** Exact 3-decimal KWD match tolerance (half of 0.001 KWD). */
export const KWD_EXACT_TOLERANCE = 0.0005

export const BANNED_STRINGS: readonly string[] = [
  'قيود غير مكتملة',
  'غير متاح بعد',
  'قيد المطابقة',
  'بعض الأرقام غير متاحة',
  'لا توجد بيانات',
  'غير مربوط بمصدر',
] as const

export interface GateConfig {
  baseUrl: string
  shareUrl: string | null
  qaEmail: string
  qaPassword: string
  outDir: string
  expectedReceivables: number
  expectedYtd: number
  ytdTolerancePct: number
  navigationTimeoutMs: number
  settleTimeoutMs: number
}

export interface BannedStringHit {
  phrase: string
  count: number
  snippet: string
}

export interface HttpErrorRecord {
  status: number
  method: string
  url: string
  resourceType: string
}

export interface MissingTestIdNote {
  selectorId: string
  page: string
  preferredTestId: string
  fallbackUsed: string | null
  appSourceHint: string
}

export interface ReceivablesExtraction {
  erpCard: number | null
  erpLineUnderCard: number | null
  erpBadgeValue: number | null
  erpBadgePresent: boolean
  erpTieOutStatus: 'ties' | 'mismatch' | 'missing'
  erpCreditsLine: number | null
  financeGlCard: number | null
  financeReceivablesTabCard: number | null
  financeCreditsCard: number | null
  receivablesCard: number | null
  receivablesCreditsCard: number | null
}

export interface ReceivablesCheckResult {
  passed: boolean
  expected: number
  values: {
    erpCard: number | null
    erpLineUnderCard: number | null
    erpBadgeValue: number | null
    financeGlCard: number | null
    financeReceivablesTabCard: number | null
    receivablesCard: number | null
  }
  credits: {
    erpCreditsLine: number | null
    financeCreditsCard: number | null
    receivablesCreditsCard: number | null
  }
  allIdentical: boolean
  allMatchExpected: boolean
  creditsNonZero: boolean
  failures: string[]
  perPageFailures: Record<'/erp' | '/erp/finance' | '/erp/receivables', string[]>
}

export interface YtdCheckResult {
  passed: boolean
  actual: number | null
  expected: number
  tolerancePct: number
  deltaKwd: number | null
  deltaPct: number | null
  minAllowed: number
  maxAllowed: number
  failure: string | null
}

export interface PageGateReport {
  path: string
  finalPath: string
  passed: boolean
  httpStatus: number | null
  retriedOn5xx: boolean
  httpErrors: HttpErrorRecord[]
  consoleErrors: string[]
  pageErrors: string[]
  bannedHits: BannedStringHit[]
  keyNumbers: Record<string, string | number | null>
  failures: string[]
  screenshotFile: string | null
  textFile: string | null
}

export interface GateSummary {
  overall: 'PASS' | 'FAIL'
  exitCode: 0 | 1
  timestampIso: string
  baseUrl: string
  shareUrlUsed: boolean
  outDir: string
  expectedReceivables: number
  expectedYtd: number
  ytdTolerancePct: number
  conditions: {
    bannedStrings: { passed: boolean; totalHits: number; pagesAffected: string[] }
    receivables: ReceivablesCheckResult
    ytd2026: YtdCheckResult
    httpAndConsole: {
      passed: boolean
      httpErrorCount: number
      consoleErrorCount: number
      pageErrorCount: number
    }
  }
  pages: PageGateReport[]
  missingTestIds: MissingTestIdNote[]
  nonGetBlockedCount: number
}

/** Formats a filesystem-safe timestamp (`YYYYMMDD-HHmmss`) for the default output folder. */
export function formatRunTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    '-',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join('')
}

function parseHttpUrl(raw: string, envName: string): URL {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(`Invalid URL in ${envName}. Must be a valid http:// or https:// URL.`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid protocol in ${envName}. Only http:// and https:// are allowed.`)
  }
  if (parsed.username || parsed.password) {
    throw new Error(`Embedded credentials are not allowed in ${envName}.`)
  }
  return parsed
}

function parsePositiveNumberEnv(
  raw: string | undefined,
  envName: string,
  defaultValue: number,
  allowZero = false,
): number {
  if (raw === undefined || raw.trim() === '') return defaultValue
  const parsed = Number(raw.trim().replace(/,/g, ''))
  if (!Number.isFinite(parsed) || (allowZero ? parsed < 0 : parsed <= 0)) {
    throw new Error(`Invalid numeric value for ${envName}.`)
  }
  return parsed
}

/**
 * Validates all environment inputs fail-closed.
 * Never includes secret values in thrown errors.
 */
export function parseGateEnv(
  env: Record<string, string | undefined>,
  now: Date = new Date(),
): GateConfig {
  const missing: string[] = []
  const rawBaseUrl = (env.GATE_BASE_URL ?? '').trim()
  const rawEmail = (env.AETHER_QA_EMAIL ?? '').trim()
  const rawPassword = (env.AETHER_QA_PASSWORD ?? '').trim()
  const rawShareUrl = (env.GATE_SHARE_URL ?? '').trim()
  const rawOutDir = (env.GATE_OUT_DIR ?? '').trim()

  if (!rawBaseUrl) missing.push('GATE_BASE_URL')
  if (!rawEmail) missing.push('AETHER_QA_EMAIL')
  if (!rawPassword) missing.push('AETHER_QA_PASSWORD')

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. Refusing to run (fail-closed).`,
    )
  }

  const parsedBaseUrl = parseHttpUrl(rawBaseUrl, 'GATE_BASE_URL')
  const normalizedBasePath = parsedBaseUrl.pathname.replace(/\/+$/, '')
  const normalizedBaseUrl = `${parsedBaseUrl.origin}${normalizedBasePath}`
  const shareUrl = rawShareUrl ? parseHttpUrl(rawShareUrl, 'GATE_SHARE_URL').toString() : null
  const outDir = rawOutDir || `./gate-out/${formatRunTimestamp(now)}`

  const navigationTimeoutMs = Math.round(
    parsePositiveNumberEnv(env.GATE_TIMEOUT_MS, 'GATE_TIMEOUT_MS', DEFAULT_GATE_TIMEOUT_MS),
  )
  const settleTimeoutMs =
    env.GATE_TIMEOUT_MS && env.GATE_TIMEOUT_MS.trim() !== ''
      ? Math.max(15_000, navigationTimeoutMs - 10_000)
      : DEFAULT_SETTLE_TIMEOUT_MS

  return {
    baseUrl: normalizedBaseUrl,
    shareUrl,
    qaEmail: rawEmail,
    qaPassword: rawPassword,
    outDir,
    expectedReceivables: parsePositiveNumberEnv(
      env.EXPECTED_RECEIVABLES,
      'EXPECTED_RECEIVABLES',
      DEFAULT_EXPECTED_RECEIVABLES,
    ),
    expectedYtd: parsePositiveNumberEnv(
      env.EXPECTED_YTD,
      'EXPECTED_YTD',
      DEFAULT_EXPECTED_YTD,
    ),
    ytdTolerancePct: parsePositiveNumberEnv(
      env.YTD_TOLERANCE_PCT,
      'YTD_TOLERANCE_PCT',
      DEFAULT_YTD_TOLERANCE_PCT,
      true,
    ),
    navigationTimeoutMs,
    settleTimeoutMs,
  }
}

/** Strips query strings, fragments, and embedded credentials from URLs before logging/reporting. */
export function sanitizeUrlForReport(rawUrl: string): string {
  try {
    const u = new URL(rawUrl)
    return `${u.origin}${u.pathname}`
  } catch {
    return rawUrl.split('?')[0]?.split('#')[0] || '<invalid-url>'
  }
}

/** Scrubs passwords, share-URL tokens, cookies, and bearer headers from diagnostic strings. */
export function redactSensitiveText(
  input: string,
  secrets: readonly (string | null | undefined)[] = [],
): string {
  let out = input
  for (const secret of secrets) {
    if (!secret || secret.length < 3) continue
    out = out.split(secret).join('[REDACTED]')
  }
  out = out.replace(
    /([?&](?:_vercel_share|_vercel_jwt|x-vercel-set-bypass-cookie|x-vercel-protection-bypass|token|secret|password|key|cookie|auth)=)[^&\s"'<>]+/gi,
    '$1[REDACTED]',
  )
  out = out.replace(/((?:set-cookie|cookie|authorization)\s*[:=]\s*)[^\r\n;]+/gi, '$1[REDACTED]')
  out = out.replace(/((?:aether_exec_session|_vercel_jwt)\s*=\s*)[^\s;,"'<>]+/gi, '$1[REDACTED]')
  return out
}

const ARABIC_INDIC_MAP: Record<string, string> = {
  '\u0660': '0',
  '\u0661': '1',
  '\u0662': '2',
  '\u0663': '3',
  '\u0664': '4',
  '\u0665': '5',
  '\u0666': '6',
  '\u0667': '7',
  '\u0668': '8',
  '\u0669': '9',
  '\u06f0': '0',
  '\u06f1': '1',
  '\u06f2': '2',
  '\u06f3': '3',
  '\u06f4': '4',
  '\u06f5': '5',
  '\u06f6': '6',
  '\u06f7': '7',
  '\u06f8': '8',
  '\u06f9': '9',
  '\u066c': ',', // Arabic thousands separator ٬
  '\u066b': '.', // Arabic decimal separator ٫
}

/**
 * Normalizes Eastern Arabic-Indic (`٠–٩`), Persian (`۰–۹`) digits, Arabic
 * thousands/decimal separators (`٬`, `٫`), Unicode minus (`−`), and invisible
 * directional characters to standard ASCII digits and separators.
 */
export function normalizeNumericText(raw: string): string {
  let out = ''
  for (const ch of raw) {
    out += ARABIC_INDIC_MAP[ch] ?? ch
  }
  // Remove Unicode bidirectional/BOM controls
  out = out.replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
  // Normalize mathematical minus (U+2212) and en-dash (U+2013) to ASCII hyphen-minus
  out = out.replace(/[\u2212\u2013]/g, '-')
  // Normalize NBSP / narrow NBSP / thin spaces to plain space
  out = out.replace(/[\u00a0\u202f\u2009\u2007]/g, ' ')
  return out
}

function parseNormalizedNumberToken(token: string): number | null {
  let s = token.trim()
  if (!s) return null

  let negative = false
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true
    s = s.slice(1, -1).trim()
  }
  if (s.startsWith('-')) {
    negative = !negative
    s = s.slice(1).trim()
  } else if (s.startsWith('+')) {
    s = s.slice(1).trim()
  }
  if (s.endsWith('-')) {
    negative = !negative
    s = s.slice(0, -1).trim()
  }

  // Collapse space-grouped thousands like "1 743 500.000"
  if (/^\d{1,3}(?: \d{3})+(?:[.,]\d+)?$/.test(s)) {
    s = s.replace(/ /g, '')
  }

  if (!/^\d[\d.,]*$/.test(s)) return null

  const hasDot = s.includes('.')
  const hasComma = s.includes(',')

  let canonical = s
  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf('.')
    const lastComma = s.lastIndexOf(',')
    if (lastComma > lastDot) {
      // European style: "30.310,675" -> "30310.675"
      canonical = s.replace(/\./g, '').replace(',', '.')
    } else {
      // Standard style: "30,310.675" -> "30310.675"
      canonical = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    const parts = s.split(',')
    if (parts.length > 2) {
      // Multiple commas: "1,743,500" -> thousands separators
      if (!parts.slice(1).every((p) => p.length === 3)) return null
      canonical = parts.join('')
    } else {
      // Single comma: "30,310" (3 trailing digits) is thousands separator;
      // "30,5" or "30,50" (1-2 trailing digits) is decimal comma.
      const [, right] = parts
      if (right.length === 3) {
        canonical = parts.join('')
      } else if (right.length === 1 || right.length === 2) {
        canonical = `${parts[0]}.${right}`
      } else {
        return null
      }
    }
  } else if (hasDot) {
    const parts = s.split('.')
    if (parts.length > 2) {
      // Multiple dots: "1.743.500" -> thousands separators
      if (!parts.slice(1).every((p) => p.length === 3)) return null
      canonical = parts.join('')
    }
  }

  const num = Number(canonical)
  if (!Number.isFinite(num)) return null
  if (num === 0) return 0
  return negative ? -num : num
}

/**
 * Extracts all numeric amounts from an arbitrary Arabic/English text string,
 * ignoring ISO dates (`2026-11-19`) and clock times (`14:30`).
 */
export function extractKwdNumbers(raw: string): number[] {
  if (!raw) return []
  const normalized = normalizeNumericText(raw)
    // Mask ISO dates and times so date components are not misread as KWD amounts
    .replace(/\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')

  const tokenRegex =
    /\(\s*\d{1,3}(?:[,.]\d{3})*(?:[.,]\d+)?\s*\)|[+-]?\s*\d{1,3}(?:(?:,\d{3})+|\.\d{3}(?:\.\d{3})+)(?:[.,]\d+)?-?|[+-]?\s*\d+(?:[.,]\d+)?-?/g

  const results: number[] = []
  let match: RegExpExecArray | null
  while ((match = tokenRegex.exec(normalized)) !== null) {
    const parsed = parseNormalizedNumberToken(match[0])
    if (parsed !== null) {
      results.push(parsed)
    }
  }
  return results
}

/**
 * Parses a single KPI / currency string (Arabic or Latin digits, optional
 * thousands separators, optional 3-decimal KWD precision, optional currency
 * label `د.ك` / `KWD` / `KD`, signed or parenthesized) into a JS number.
 * Returns `null` for empty, dash (`—`), unavailable (`غير متاح`), or ambiguous text.
 */
export function parseKwdNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const trimmed = normalizeNumericText(raw)
    .replace(/(?:د\.?\s*ك\.?|KWD|KD)/gi, ' ')
    .trim()
  if (!trimmed) return null
  if (/^(?:—|-|غير متاح|unavailable|n\/a)$/i.test(trimmed)) return null

  // Fast path: clean single numeric expression
  const direct = parseNormalizedNumberToken(trimmed)
  if (direct !== null) return direct

  // Secondary path: extract numeric tokens; accept only if unambiguous (exactly 1)
  const extracted = extractKwdNumbers(trimmed)
  if (extracted.length === 1) return extracted[0] ?? null
  return null
}

/**
 * Extracts a KWD currency amount from mixed prose/badge text only when a number
 * is explicitly marked with a currency unit (`د.ك` / `KWD` / `KD`) or formatted
 * with 3 KWD decimal places (ignoring plain integer IDs like Odoo account `10552`).
 */
export function extractExplicitKwdAmount(raw: string | null | undefined): number | null {
  if (!raw) return null
  const normalized = normalizeNumericText(raw)
    .replace(/\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')

  const currencyAdjacent =
    /(?:(?:د\.?\s*ك\.?|KWD|KD)\s*([+-]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,3})?|[+-]?\s*\d+(?:\.\d{1,3})?)|([+-]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,3})?-?|[+-]?\s*\d+(?:\.\d{1,3})?-?)\s*(?:د\.?\s*ك\.?|KWD|KD))/gi

  const matches: number[] = []
  let m: RegExpExecArray | null
  while ((m = currencyAdjacent.exec(normalized)) !== null) {
    const token = m[1] ?? m[2]
    if (!token) continue
    const parsed = parseNormalizedNumberToken(token)
    if (parsed !== null) matches.push(parsed)
  }
  if (matches.length > 0) {
    // Prefer the final amount in a formula like "A - B = NET KWD"
    return matches[matches.length - 1] ?? null
  }

  const threeDecimalRe = /[+-]?\s*\d{1,3}(?:,\d{3})*\.\d{3}-?|[+-]?\s*\d+\.\d{3}-?/g
  while ((m = threeDecimalRe.exec(normalized)) !== null) {
    const parsed = parseNormalizedNumberToken(m[0])
    if (parsed !== null) matches.push(parsed)
  }
  if (matches.length > 0) {
    return matches[matches.length - 1] ?? null
  }
  return null
}

/**
 * Checks visible page text for any of the 6 banned placeholder/incomplete phrases.
 * Collapses whitespace runs so phrases split across lines are still caught.
 */
export function findBannedStrings(visibleText: string): BannedStringHit[] {
  const collapsed = visibleText.replace(/\s+/g, ' ').trim()
  if (!collapsed) return []

  const hits: BannedStringHit[] = []
  for (const phrase of BANNED_STRINGS) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    const re = new RegExp(escaped, 'g')
    let count = 0
    let firstIndex = -1
    let m: RegExpExecArray | null
    while ((m = re.exec(collapsed)) !== null) {
      if (firstIndex === -1) firstIndex = m.index
      count += 1
    }
    if (count > 0) {
      const start = Math.max(0, firstIndex - 24)
      const end = Math.min(collapsed.length, firstIndex + phrase.length + 24)
      hits.push({
        phrase,
        count,
        snippet: collapsed.slice(start, end).trim(),
      })
    }
  }
  return hits
}

function approxEqualKwd(a: number, b: number, tol = KWD_EXACT_TOLERANCE): boolean {
  return Math.abs(a - b) <= tol
}

/**
 * Evaluates Deploy Condition 4(b):
 * - On `/erp` (card + line under it + badge), `/erp/finance`, and `/erp/receivables`,
 *   the receivables figure is identical everywhere and equals `expectedReceivables`.
 * - The credits card value is non-zero.
 */
export function evaluateReceivablesCheck(
  extracted: ReceivablesExtraction,
  expectedReceivables: number = DEFAULT_EXPECTED_RECEIVABLES,
): ReceivablesCheckResult {
  const failures: string[] = []
  const perPageFailures: Record<'/erp' | '/erp/finance' | '/erp/receivables', string[]> = {
    '/erp': [],
    '/erp/finance': [],
    '/erp/receivables': [],
  }

  const addFailure = (page: '/erp' | '/erp/finance' | '/erp/receivables', msg: string) => {
    failures.push(msg)
    perPageFailures[page].push(msg)
  }

  const requiredSlots: Array<{
    key: keyof ReceivablesCheckResult['values']
    page: '/erp' | '/erp/finance' | '/erp/receivables'
    label: string
    value: number | null
  }> = [
    { key: 'erpCard', page: '/erp', label: '/erp receivables card', value: extracted.erpCard },
    {
      key: 'erpLineUnderCard',
      page: '/erp',
      label: '/erp receivables line under card',
      value: extracted.erpLineUnderCard,
    },
    {
      key: 'financeGlCard',
      page: '/erp/finance',
      label: '/erp/finance GL summary receivables card',
      value: extracted.financeGlCard,
    },
    {
      key: 'financeReceivablesTabCard',
      page: '/erp/finance',
      label: '/erp/finance receivables tab card',
      value: extracted.financeReceivablesTabCard,
    },
    {
      key: 'receivablesCard',
      page: '/erp/receivables',
      label: '/erp/receivables main card',
      value: extracted.receivablesCard,
    },
  ]

  const allCheckedNumbers: Array<{ label: string; value: number }> = []
  let allMatchExpected = true

  for (const slot of requiredSlots) {
    if (slot.value === null || !Number.isFinite(slot.value)) {
      allMatchExpected = false
      addFailure(slot.page, `Missing numeric figure for ${slot.label}`)
      continue
    }
    allCheckedNumbers.push({ label: slot.label, value: slot.value })
    if (!approxEqualKwd(slot.value, expectedReceivables)) {
      allMatchExpected = false
      addFailure(
        slot.page,
        `${slot.label} is ${slot.value.toFixed(3)} KWD, expected ${expectedReceivables.toFixed(3)} KWD`,
      )
    }
  }

  // /erp badge verification: if a numeric badge figure exists, it must match expected;
  // otherwise verify the badge is present and the tie-out status is not "mismatch".
  if (extracted.erpBadgeValue !== null && Number.isFinite(extracted.erpBadgeValue)) {
    allCheckedNumbers.push({ label: '/erp receivables badge', value: extracted.erpBadgeValue })
    if (!approxEqualKwd(extracted.erpBadgeValue, expectedReceivables)) {
      allMatchExpected = false
      addFailure(
        '/erp',
        `/erp receivables badge is ${extracted.erpBadgeValue.toFixed(3)} KWD, expected ${expectedReceivables.toFixed(3)} KWD`,
      )
    }
  } else if (!extracted.erpBadgePresent) {
    allMatchExpected = false
    addFailure('/erp', 'Missing receivables badge on /erp')
  }

  if (extracted.erpTieOutStatus === 'mismatch') {
    allMatchExpected = false
    addFailure('/erp', '/erp receivables tie-out reports mismatch (data-ar-tie-out="mismatch")')
  } else if (extracted.erpBadgeValue === null && extracted.erpTieOutStatus !== 'ties') {
    allMatchExpected = false
    addFailure('/erp', 'Missing verified receivables tie-out status on /erp (expected data-ar-tie-out="ties")')
  }

  // Cross-page identity check across all extracted numeric receivables slots
  let allIdentical = true
  if (allCheckedNumbers.length >= 2) {
    const first = allCheckedNumbers[0]!
    for (const other of allCheckedNumbers.slice(1)) {
      if (!approxEqualKwd(first.value, other.value)) {
        allIdentical = false
        failures.push(
          `Receivables mismatch across pages: ${first.label} (${first.value.toFixed(3)}) != ${other.label} (${other.value.toFixed(3)})`,
        )
      }
    }
  } else {
    allIdentical = false
  }

  // Credits card non-zero check across /erp/receivables, /erp/finance (receivables tab), and /erp
  let creditsNonZero = true
  const creditSlots: Array<{
    page: '/erp' | '/erp/finance' | '/erp/receivables'
    label: string
    value: number | null
  }> = [
    {
      page: '/erp/receivables',
      label: '/erp/receivables unapplied credits card',
      value: extracted.receivablesCreditsCard,
    },
    {
      page: '/erp/finance',
      label: '/erp/finance credit clearing offset card',
      value: extracted.financeCreditsCard,
    },
    {
      page: '/erp',
      label: '/erp unapplied credits line',
      value: extracted.erpCreditsLine,
    },
  ]

  for (const credit of creditSlots) {
    if (credit.value === null || !Number.isFinite(credit.value)) {
      creditsNonZero = false
      addFailure(credit.page, `Missing numeric figure for ${credit.label}`)
    } else if (Math.abs(credit.value) <= KWD_EXACT_TOLERANCE) {
      creditsNonZero = false
      addFailure(credit.page, `${credit.label} must be non-zero, got ${credit.value.toFixed(3)} KWD`)
    }
  }

  return {
    passed: failures.length === 0 && allIdentical && allMatchExpected && creditsNonZero,
    expected: expectedReceivables,
    values: {
      erpCard: extracted.erpCard,
      erpLineUnderCard: extracted.erpLineUnderCard,
      erpBadgeValue: extracted.erpBadgeValue,
      financeGlCard: extracted.financeGlCard,
      financeReceivablesTabCard: extracted.financeReceivablesTabCard,
      receivablesCard: extracted.receivablesCard,
    },
    credits: {
      erpCreditsLine: extracted.erpCreditsLine,
      financeCreditsCard: extracted.financeCreditsCard,
      receivablesCreditsCard: extracted.receivablesCreditsCard,
    },
    allIdentical,
    allMatchExpected,
    creditsNonZero,
    failures,
    perPageFailures,
  }
}

/**
 * Evaluates Deploy Condition 4(c):
 * 2026 YTD company total on `/erp/cores` (year filter) within ±0.5% of `expectedYtd`.
 */
export function evaluateYtdCheck(
  actualYtd: number | null,
  expectedYtd: number = DEFAULT_EXPECTED_YTD,
  tolerancePct: number = DEFAULT_YTD_TOLERANCE_PCT,
): YtdCheckResult {
  const ratio = tolerancePct / 100
  const minAllowed = expectedYtd * (1 - ratio)
  const maxAllowed = expectedYtd * (1 + ratio)

  if (actualYtd === null || !Number.isFinite(actualYtd)) {
    return {
      passed: false,
      actual: null,
      expected: expectedYtd,
      tolerancePct,
      deltaKwd: null,
      deltaPct: null,
      minAllowed,
      maxAllowed,
      failure: `Missing 2026 YTD company total on /erp/cores (expected ${expectedYtd.toLocaleString('en-US')} KWD ±${tolerancePct}%)`,
    }
  }

  const deltaKwd = actualYtd - expectedYtd
  const deltaPct = (deltaKwd / expectedYtd) * 100
  const passed = Math.abs(deltaPct) <= tolerancePct + 1e-9

  return {
    passed,
    actual: actualYtd,
    expected: expectedYtd,
    tolerancePct,
    deltaKwd,
    deltaPct,
    minAllowed,
    maxAllowed,
    failure: passed
      ? null
      : `2026 YTD total ${actualYtd.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD deviates by ${deltaPct.toFixed(3)}% from expected ${expectedYtd.toLocaleString('en-US')} KWD (allowed ±${tolerancePct}%)`,
  }
}

export function buildGateSummary(input: {
  timestampIso: string
  baseUrl: string
  shareUrlUsed: boolean
  outDir: string
  expectedReceivables: number
  expectedYtd: number
  ytdTolerancePct: number
  pages: PageGateReport[]
  receivables: ReceivablesCheckResult
  ytd2026: YtdCheckResult
  missingTestIds: MissingTestIdNote[]
  nonGetBlockedCount: number
}): GateSummary {
  const pagesWithBanned = input.pages
    .filter((p) => p.bannedHits.length > 0)
    .map((p) => p.path)
  const totalBannedHits = input.pages.reduce(
    (sum, p) => sum + p.bannedHits.reduce((s, h) => s + h.count, 0),
    0,
  )

  const httpErrorCount = input.pages.reduce(
    (sum, p) => sum + (p.httpStatus !== null && p.httpStatus >= 400 ? 1 : 0) + p.httpErrors.length,
    0,
  )
  const consoleErrorCount = input.pages.reduce((sum, p) => sum + p.consoleErrors.length, 0)
  const pageErrorCount = input.pages.reduce((sum, p) => sum + p.pageErrors.length, 0)

  const bannedPassed = totalBannedHits === 0
  const httpAndConsolePassed =
    httpErrorCount === 0 &&
    consoleErrorCount === 0 &&
    pageErrorCount === 0 &&
    input.pages.every((p) => p.httpStatus !== null && p.httpStatus < 400)

  const allPagesPassed = input.pages.length > 0 && input.pages.every((p) => p.passed)
  const overallPassed =
    allPagesPassed &&
    bannedPassed &&
    input.receivables.passed &&
    input.ytd2026.passed &&
    httpAndConsolePassed

  return {
    overall: overallPassed ? 'PASS' : 'FAIL',
    exitCode: overallPassed ? 0 : 1,
    timestampIso: input.timestampIso,
    baseUrl: sanitizeUrlForReport(input.baseUrl),
    shareUrlUsed: input.shareUrlUsed,
    outDir: input.outDir,
    expectedReceivables: input.expectedReceivables,
    expectedYtd: input.expectedYtd,
    ytdTolerancePct: input.ytdTolerancePct,
    conditions: {
      bannedStrings: {
        passed: bannedPassed,
        totalHits: totalBannedHits,
        pagesAffected: pagesWithBanned,
      },
      receivables: input.receivables,
      ytd2026: input.ytd2026,
      httpAndConsole: {
        passed: httpAndConsolePassed,
        httpErrorCount,
        consoleErrorCount,
        pageErrorCount,
      },
    },
    pages: input.pages,
    missingTestIds: input.missingTestIds,
    nonGetBlockedCount: input.nonGetBlockedCount,
  }
}

function escapeMdCell(raw: string): string {
  return raw.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()
}

function formatKeyNumbersCell(keyNumbers: Record<string, string | number | null>): string {
  const entries = Object.entries(keyNumbers)
  if (entries.length === 0) return '—'
  return entries
    .map(([k, v]) => {
      if (v === null) return `${k}: missing`
      if (typeof v === 'number') {
        return `${k}: ${v.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
      }
      return `${k}: ${v}`
    })
    .join('; ')
}

export function renderSummaryMarkdown(summary: GateSummary): string {
  const lines: string[] = []
  lines.push(`# AetherBI Deployment Gate Summary — ${summary.overall}`)
  lines.push('')
  lines.push(`- **Overall Result:** \`${summary.overall}\` (exit code \`${summary.exitCode}\`)`)
  lines.push(`- **Timestamp (UTC):** \`${summary.timestampIso}\``)
  lines.push(`- **Target Base URL:** \`${summary.baseUrl}\``)
  lines.push(`- **Vercel Share URL Used:** \`${summary.shareUrlUsed ? 'yes' : 'no'}\``)
  lines.push(`- **Output Directory:** \`${summary.outDir}\``)
  lines.push(
    `- **Thresholds:** Receivables = \`${summary.expectedReceivables.toFixed(3)} KWD\`, 2026 YTD = \`${summary.expectedYtd.toLocaleString('en-US')} KWD\` (±${summary.ytdTolerancePct}%)`,
  )
  if (summary.nonGetBlockedCount > 0) {
    lines.push(`- **Non-GET Requests Blocked After Login:** \`${summary.nonGetBlockedCount}\``)
  }
  lines.push('')
  lines.push('## Deploy Conditions')
  lines.push('')
  lines.push('| # | Condition | Result | Details |')
  lines.push('|---|---|---|---|')
  lines.push(
    `| a | Banned strings absent everywhere | ${summary.conditions.bannedStrings.passed ? 'PASS' : 'FAIL'} | ${
      summary.conditions.bannedStrings.passed
        ? '0 hits across all pages'
        : `${summary.conditions.bannedStrings.totalHits} hit(s) on ${summary.conditions.bannedStrings.pagesAffected.join(', ')}`
    } |`,
  )
  lines.push(
    `| b | Receivables identical everywhere & credits non-zero | ${summary.conditions.receivables.passed ? 'PASS' : 'FAIL'} | ${
      summary.conditions.receivables.passed
        ? `All figures = ${summary.expectedReceivables.toFixed(3)} KWD; credits non-zero`
        : escapeMdCell(summary.conditions.receivables.failures.join('; '))
    } |`,
  )
  lines.push(
    `| c | 2026 YTD company total within ±${summary.ytdTolerancePct}% | ${summary.conditions.ytd2026.passed ? 'PASS' : 'FAIL'} | ${
      summary.conditions.ytd2026.passed && summary.conditions.ytd2026.actual !== null
        ? `${summary.conditions.ytd2026.actual.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD (${(summary.conditions.ytd2026.deltaPct ?? 0).toFixed(3)}%)`
        : escapeMdCell(summary.conditions.ytd2026.failure ?? 'Failed')
    } |`,
  )
  lines.push(
    `| d | No HTTP >= 400 and no console errors | ${summary.conditions.httpAndConsole.passed ? 'PASS' : 'FAIL'} | HTTP>=400: ${summary.conditions.httpAndConsole.httpErrorCount}, console errors: ${summary.conditions.httpAndConsole.consoleErrorCount}, page errors: ${summary.conditions.httpAndConsole.pageErrorCount} |`,
  )
  lines.push('')
  lines.push('## Per-Page Results')
  lines.push('')
  lines.push('| Page | Result | Key Numbers | Failure Reasons |')
  lines.push('|---|---|---|---|')
  for (const page of summary.pages) {
    const keyNums = escapeMdCell(formatKeyNumbersCell(page.keyNumbers))
    const reasons =
      page.failures.length === 0 ? '—' : escapeMdCell(page.failures.join('; '))
    lines.push(`| \`${page.path}\` | **${page.passed ? 'PASS' : 'FAIL'}** | ${keyNums} | ${reasons} |`)
  }
  lines.push('')
  lines.push('## Missing `data-testid` Notes')
  lines.push('')
  if (summary.missingTestIds.length === 0) {
    lines.push('All configured selectors matched their preferred `data-testid`.')
  } else {
    lines.push(
      'The following targets do not currently expose a `data-testid` in the app DOM, so fallback selectors from `scripts/gate/selectors.ts` were used (app source files were not modified):',
    )
    lines.push('')
    lines.push('| Selector ID | Page | Preferred `data-testid` | App File | Fallback Used |')
    lines.push('|---|---|---|---|---|')
    for (const note of summary.missingTestIds) {
      lines.push(
        `| \`${note.selectorId}\` | \`${note.page}\` | \`${note.preferredTestId}\` | \`${note.appSourceHint}\` | ${note.fallbackUsed ? `\`${escapeMdCell(note.fallbackUsed)}\`` : 'none matched'} |`,
      )
    }
  }
  lines.push('')
  return lines.join('\n')
}
