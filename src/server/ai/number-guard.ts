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

export function extractCanonicalDecimals(text: string): string[] {
  const normalized = normalizeGuardDigits(text)
  const found: string[] = []
  for (const match of normalized.matchAll(NUMBER_TOKEN)) {
    const canonical = canonicalDecimal(match[0])
    if (canonical) found.push(canonical)
  }
  return found
}

export function collectAllowedDecimals(facts: unknown): Set<string> {
  const allowed = new Set<string>()
  const json = JSON.stringify(facts) ?? ''
  for (const token of extractCanonicalDecimals(json)) allowed.add(token)
  if (facts && typeof facts === 'object') {
    const toolNumbers = (facts as { toolNumbers?: unknown }).toolNumbers
    if (Array.isArray(toolNumbers)) {
      for (const value of toolNumbers) {
        if (typeof value === 'number') {
          const canonical = decimalFromNumber(value)
          if (canonical) allowed.add(canonical)
        }
      }
    }
  }
  return allowed
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
