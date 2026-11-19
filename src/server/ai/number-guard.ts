import { directionSign } from './claims'
import { Decimal } from './decimal'

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'
const EXTENDED_ARABIC = '۰۱۲۳۴۵۶۷۸۹'

export function normalizeGuardDigits(text: string): string {
  let out = ''
  for (const ch of text) {
    const indic = ARABIC_INDIC.indexOf(ch)
    if (indic >= 0) {
      out += String(indic)
      continue
    }
    const extended = EXTENDED_ARABIC.indexOf(ch)
    if (extended >= 0) {
      out += String(extended)
      continue
    }
    if (ch === '٫') {
      out += '.'
      continue
    }
    if (ch === '٬') {
      out += ','
      continue
    }
    if (ch === '−') {
      out += '-'
      continue
    }
    out += ch
  }
  return out
}

/** Canonical decimal with trailing zeros removed. `10.50` and `10.5` are the same value. */
export function canonicalDecimal(raw: string): string | null {
  const normalized = normalizeGuardDigits(raw).replace(/\s/g, '')
  const match = normalized.match(/^([+-])?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?$/)
  if (!match) return null
  const sign = match[1] === '-' ? '-' : ''
  const intPart = match[2].replace(/,/g, '').replace(/^0+(?=\d)/, '')
  const fraction = (match[3] ?? '').slice(1).replace(/0+$/, '')
  const body = fraction ? `${intPart}.${fraction}` : intPart || '0'
  if (body === '0') return '0'
  return `${sign}${body}`
}

export function decimalFromNumber(value: number): string | null {
  if (!Number.isFinite(value)) return null
  const asJson = JSON.stringify(value)
  if (/e/i.test(asJson)) return canonicalDecimal(value.toFixed(8))
  return canonicalDecimal(asJson)
}

const NUMBER_TOKEN = /[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g
const NUMBER_OR_PERCENT = /[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*%?/g
const FROM_TO =
  /(?:from|من)\s+([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s+(?:to|إلى|الى)\s+([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)/giu
const SKIP_KEYS = new Set([
  'id',
  'period',
  'scope',
  'source',
  'reply',
  'executedQueries',
  'name',
  'code',
  'model',
  'domain',
  'from',
  'to',
  'hour',
  'date',
])

export function extractCanonicalDecimals(text: string): string[] {
  const normalized = normalizeGuardDigits(text)
  const found: string[] = []
  for (const match of normalized.matchAll(NUMBER_TOKEN)) {
    const canonical = canonicalDecimal(match[0])
    if (canonical) found.push(canonical)
  }
  return found
}

function pushCanonical(target: string[], value: string | number): void {
  const canonical = typeof value === 'number' ? decimalFromNumber(value) : canonicalDecimal(value)
  if (canonical) target.push(canonical)
}

/** Numeric amount, quantity, or percent fields. Ids, dates, hours, and codes are skipped. */
export function collectFactValueDecimals(facts: unknown): string[] {
  const found: string[] = []
  const walk = (node: unknown, key: string | null) => {
    if (key && SKIP_KEYS.has(key)) return
    if (key === 'toolNumbers' && Array.isArray(node)) {
      for (const value of node) {
        if (typeof value === 'number' && Number.isFinite(value)) pushCanonical(found, value)
      }
      return
    }
    if (key === 'value' && (typeof node === 'string' || typeof node === 'number')) {
      pushCanonical(found, node)
      return
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, null)
      return
    }
    if (node && typeof node === 'object') {
      for (const [childKey, child] of Object.entries(node)) walk(child, childKey)
    }
  }
  walk(facts, null)
  return [...new Set(found)]
}

export function collectAllowedDecimals(facts: unknown): Set<string> {
  return new Set(collectFactValueDecimals(facts))
}

function writtenScale(raw: string): number {
  const fraction = raw.replace(/,/g, '').split('.')[1] ?? ''
  return fraction.length
}

function matchesRounded(exact: Decimal, written: Decimal, scale: number): boolean {
  return exact.roundHalfUp(scale).compare(written) === 0
}

function pairMatches(
  written: Decimal,
  scale: number,
  values: readonly Decimal[],
  mode: 'delta' | 'ratio' | 'share' | 'growth',
): boolean {
  const hundred = Decimal.parse('100') ?? Decimal.fromParts(100n, 0)
  for (let i = 0; i < values.length; i += 1) {
    for (let j = 0; j < values.length; j += 1) {
      if (i === j) continue
      const left = values[i]
      const right = values[j]
      if (!left || !right) continue
      if (mode === 'delta') {
        if (matchesRounded(left.sub(right), written, scale)) return true
        continue
      }
      if (mode === 'ratio') {
        const ratio = left.div(right, scale + 6)
        if (ratio && matchesRounded(ratio, written, scale)) return true
        continue
      }
      if (right.sign() === 0) continue
      const ratio = mode === 'growth' ? left.sub(right).div(right, scale + 8) : left.div(right, scale + 8)
      if (!ratio) continue
      const pct = ratio.mul(hundred).roundHalfUp(scale)
      if (pct.compare(written) === 0) return true
    }
  }
  return false
}

function hasCue(text: string, kind: 'difference' | 'ratio' | 'growth'): boolean {
  if (kind === 'difference') {
    return /(?:^|[^\p{L}\p{N}])(?:difference|delta|gap|فرق|الفارق|الفرق|بفارق)(?=$|[^\p{L}\p{N}])/iu.test(text)
  }
  if (kind === 'ratio') return /%\s*of\b|\bratio\b|\bshare\b|\bof\b|نسبة/iu.test(text)
  return /(?:^|[^\p{L}\p{N}])(?:growth|percent|change|نمو|نسبة)(?=$|[^\p{L}\p{N}])/iu.test(text)
}

interface FactValueRow {
  metric?: string
  scope?: string
  period?: string
  value?: string
}

function periodDeltaSign(facts: unknown): -1 | 0 | 1 | null {
  if (!Array.isArray(facts)) return null
  const groups = new Map<string, FactValueRow[]>()
  for (const entry of facts) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as FactValueRow
    if (!row.metric || !row.period || !row.value) continue
    const key = `${row.metric}|${row.scope ?? ''}`
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }
  const signs = new Set<-1 | 1>()
  for (const rows of groups.values()) {
    const ordered = [...rows].sort((a, b) => String(a.period).localeCompare(String(b.period)))
    if (ordered.length < 2) continue
    const earlier = Decimal.parse(canonicalDecimal(ordered[0]?.value ?? '') ?? '')
    const later = Decimal.parse(canonicalDecimal(ordered[ordered.length - 1]?.value ?? '') ?? '')
    if (!earlier || !later) continue
    const sign = later.sub(earlier).sign()
    if (sign !== 0) signs.add(sign)
  }
  if (signs.size !== 1) return null
  return [...signs][0] ?? null
}

function directionMatches(text: string, facts: unknown): boolean {
  FROM_TO.lastIndex = 0
  const pairs: Array<-1 | 0 | 1> = []
  for (const match of text.matchAll(FROM_TO)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    const window = text.slice(Math.max(0, start - 64), Math.min(text.length, end + 64))
    const from = Decimal.parse(match[1] ?? '')
    const to = Decimal.parse(match[2] ?? '')
    if (!from || !to) return false
    const pairSign = to.sub(from).sign()
    pairs.push(pairSign)
    const word = directionSign(window)
    if (word !== 0 && pairSign !== word) return false
  }
  const whole = directionSign(text)
  if (whole === 0) return true
  if (pairs.length > 0) return pairs.every((pairSign) => pairSign === whole)
  const delta = periodDeltaSign(facts)
  // A single period has no earlier/later pair. "increase" is not a contradiction.
  if (delta == null) return true
  return delta === whole
}

export const PROPOSED_USER_INPUT_LABEL = 'Proposed / User Input'
export const ODOO_VERIFIED_ACTUALS_LABEL = 'Odoo Verified Actuals'

export interface GroundingOptions {
  /** The user's question. Numbers they typed are allowed only when the answer labels them. */
  question?: string
  /** Extra proposed amounts already parsed from the question. */
  userInputs?: readonly string[]
}

function maskIsoDates(text: string): string {
  return text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
}

function hasProposedLabel(text: string): boolean {
  return text.includes(PROPOSED_USER_INPUT_LABEL) || /proposed\s*\/\s*user input/i.test(text)
}

function decimalsIn(text: string): string[] {
  return extractCanonicalDecimals(maskIsoDates(normalizeGuardDigits(text)))
}

function proposedDecimals(options: GroundingOptions | undefined, labeled: boolean): string[] {
  if (!labeled) return []
  const found = new Set<string>(decimalsIn(options?.question ?? ''))
  for (const raw of options?.userInputs ?? []) {
    const canonical = canonicalDecimal(raw)
    if (canonical) found.add(canonical)
  }
  return [...found]
}

function matchesRoundedValue(exact: Decimal, written: Decimal, scale: number): boolean {
  return matchesRounded(exact, written, scale)
}

/** Sums, differences, products, and qty × (proposed − current), including half-up rounding. */
function matchesDerivation(written: Decimal, scale: number, values: readonly Decimal[]): boolean {
  const pool = values.slice(0, 40)
  for (const value of pool) {
    if (matchesRoundedValue(value, written, scale)) return true
  }
  for (let i = 0; i < pool.length; i += 1) {
    for (let j = 0; j < pool.length; j += 1) {
      if (i === j) continue
      const left = pool[i]
      const right = pool[j]
      if (!left || !right) continue
      if (matchesRoundedValue(left.add(right), written, scale)) return true
      if (matchesRoundedValue(left.sub(right), written, scale)) return true
      if (matchesRoundedValue(left.mul(right), written, scale)) return true
    }
  }
  const tripleLimit = Math.min(pool.length, 24)
  for (let i = 0; i < tripleLimit; i += 1) {
    for (let j = 0; j < tripleLimit; j += 1) {
      if (i === j) continue
      for (let k = 0; k < tripleLimit; k += 1) {
        const left = pool[i]
        const right = pool[j]
        const factor = pool[k]
        if (!left || !right || !factor) continue
        if (matchesRoundedValue(left.sub(right).mul(factor), written, scale)) return true
      }
    }
  }
  if (pool.length > 1) {
    let sum = pool[0]
    if (!sum) return false
    for (let i = 1; i < pool.length; i += 1) {
      const next = pool[i]
      if (!next) continue
      sum = sum.add(next)
    }
    if (matchesRoundedValue(sum, written, scale)) return true
  }
  return false
}

export interface NumberGuardResult {
  ok: boolean
  offending: string[]
}

export function guardAnswerNumbers(answer: string, allowed: ReadonlySet<string>): NumberGuardResult {
  const normalized = normalizeGuardDigits(answer)
  if (/\d(?:\.\d+)?e[+-]?\d/i.test(normalized)) {
    return { ok: false, offending: ['SCIENTIFIC'] }
  }
  const offending: string[] = []
  const seen = new Set<string>()
  for (const token of extractCanonicalDecimals(normalized)) {
    if (allowed.has(token) || seen.has(token)) continue
    seen.add(token)
    offending.push(token)
  }
  return { ok: offending.length === 0, offending }
}

/**
 * Every number must be a cited fact value, a half-up rounding of one, a Decimal
 * derivation of those values (including qty × (proposed − current)), or a number
 * the user typed that the answer labels `Proposed / User Input`.
 */
export function guardAnswerAgainstFacts(
  answer: string,
  facts: unknown,
  options?: GroundingOptions,
): NumberGuardResult {
  const normalized = maskIsoDates(normalizeGuardDigits(answer))
  if (/\d(?:\.\d+)?e[+-]?\d/i.test(normalized)) {
    return { ok: false, offending: ['SCIENTIFIC'] }
  }
  const labeled = hasProposedLabel(normalized)
  const userCanon = proposedDecimals(options, labeled)
  const valueCanon = [...collectFactValueDecimals(facts), ...userCanon]
  const valueSet = new Set(valueCanon)
  const parsed = valueCanon.flatMap((token) => {
    const decimal = Decimal.parse(token)
    return decimal ? [decimal] : []
  })
  FROM_TO.lastIndex = 0
  const explainedGrowth = hasCue(normalized, 'growth') || FROM_TO.test(normalized)
  FROM_TO.lastIndex = 0
  const explainedRatio = hasCue(normalized, 'ratio')
  const explainedDifference = hasCue(normalized, 'difference')
  const offending: string[] = []
  const seen = new Set<string>()
  for (const match of normalized.matchAll(NUMBER_OR_PERCENT)) {
    const raw = match[0]
    const percent = /%\s*$/.test(raw)
    const numeric = raw.replace('%', '').trim()
    const canonical = canonicalDecimal(numeric)
    const written = Decimal.parse(numeric)
    if (!canonical || !written || seen.has(`${percent ? '%' : ''}${canonical}`)) continue
    seen.add(`${percent ? '%' : ''}${canonical}`)
    const scale = writtenScale(numeric)
    const ok = percent
      ? (explainedGrowth && pairMatches(written, scale, parsed, 'growth')) ||
        (explainedRatio && pairMatches(written, scale, parsed, 'share'))
      : valueSet.has(canonical) ||
        matchesDerivation(written, scale, parsed) ||
        (explainedDifference && pairMatches(written, scale, parsed, 'delta')) ||
        (explainedRatio && pairMatches(written, scale, parsed, 'ratio'))
    if (!ok) offending.push(canonical)
  }
  if (!directionMatches(normalized, facts)) offending.push('DIRECTION')
  return { ok: offending.length === 0, offending }
}

/** Same check the council uses so a rounded or derived Odoo figure is not an unverified number. */
export function reviewGroundedNumbers(
  answer: string,
  facts: unknown,
  options?: GroundingOptions,
): NumberGuardResult {
  return guardAnswerAgainstFacts(answer, facts, options)
}
