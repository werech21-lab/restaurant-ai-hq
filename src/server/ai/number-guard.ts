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

function matchesDerived(written: Decimal, scale: number, values: readonly Decimal[], percent: boolean): boolean {
  for (let i = 0; i < values.length; i += 1) {
    for (let j = 0; j < values.length; j += 1) {
      if (i === j) continue
      const left = values[i]
      const right = values[j]
      if (!left || !right) continue
      if (percent) {
        const ratio = left.div(right, scale + 6)
        if (!ratio) continue
        const pct = ratio.mul(Decimal.parse('100') ?? Decimal.fromParts(100n, 0)).roundHalfUp(scale)
        if (pct.compare(written) === 0) return true
        continue
      }
      if (matchesRounded(left.sub(right), written, scale)) return true
      const ratio = left.div(right, scale + 6)
      if (ratio && matchesRounded(ratio, written, scale)) return true
    }
  }
  return false
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

function directionWordSign(text: string): -1 | 0 | 1 {
  const rise = /(?:^|[^\p{L}\p{N}])(rose|risen|increased|increase|grew|grown|higher|gained|ارتفع|ارتفعت|ارتفاع|زاد|زادت|زيادة)(?=$|[^\p{L}\p{N}])/iu.test(text)
  const fall = /(?:^|[^\p{L}\p{N}])(fell|fallen|decreased|decrease|dropped|declined|انخفض|انخفضت|انخفاض|نقص|نقصت|تراجع|تراجعت|هبط|هبطت)(?=$|[^\p{L}\p{N}])/iu.test(text)
  if (rise === fall) return 0
  return rise ? 1 : -1
}

function directionMatches(text: string, facts: unknown): boolean {
  FROM_TO.lastIndex = 0
  let sawPair = false
  for (const match of text.matchAll(FROM_TO)) {
    sawPair = true
    const start = match.index ?? 0
    const window = text.slice(Math.max(0, start - 48), start + match[0].length)
    const word = directionWordSign(window)
    if (word === 0) continue
    const from = Decimal.parse(match[1] ?? '')
    const to = Decimal.parse(match[2] ?? '')
    if (!from || !to) return false
    if (to.sub(from).sign() !== word) return false
  }
  const whole = directionWordSign(text)
  if (whole === 0) return true
  if (sawPair) return true
  const delta = periodDeltaSign(facts)
  return delta != null && delta === whole
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

/** Every number must be a cited fact value, or a server-side Decimal derivation of those values. */
export function guardAnswerAgainstFacts(answer: string, facts: unknown): NumberGuardResult {
  const normalized = normalizeGuardDigits(answer)
  if (/\d(?:\.\d+)?e[+-]?\d/i.test(normalized)) {
    return { ok: false, offending: ['SCIENTIFIC'] }
  }
  const valueCanon = collectFactValueDecimals(facts)
  const valueSet = new Set(valueCanon)
  const parsed = valueCanon.flatMap((token) => {
    const decimal = Decimal.parse(token)
    return decimal ? [decimal] : []
  })
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
      ? matchesDerived(written, scale, parsed, true)
      : valueSet.has(canonical) || matchesDerived(written, scale, parsed, false)
    if (!ok) offending.push(canonical)
  }
  if (!directionMatches(normalized, facts)) offending.push('DIRECTION')
  return { ok: offending.length === 0, offending }
}
