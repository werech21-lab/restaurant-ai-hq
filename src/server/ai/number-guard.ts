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
  'sourceTag',
  'reply',
  'executedQueries',
  'name',
  'itemName',
  'matchedOdooProductName',
  'entityId',
  'entityName',
  'entityType',
  'metric',
  'unit',
  'label',
  'labelEn',
  'labelAr',
  'optionKey',
  'recommendedOptionKey',
  'abcTier',
  'riskTag',
  'playbookAction',
  'brand',
  'brandId',
  'branch',
  'branchId',
  'fileName',
  'fileKind',
  'draftId',
  'rowId',
  'confirmedAtIso',
  'productId',
  'matchedOdooProductId',
  'categoryId',
  'configIds',
  'chunks',
  'rank',
  'code',
  'model',
  'domain',
  'from',
  'to',
  'hour',
  'date',
  'cogsBoundaryNoteEn',
  'cogsBoundaryNoteAr',
  'rationaleEn',
  'rationaleAr',
  'executiveOpinionEn',
  'executiveOpinionAr',
  'justificationEn',
  'justificationAr',
  'verdictBadge',
  'verdictLabelEn',
  'verdictLabelAr',
  'feryalVerdict',
])

const NUMERIC_ARRAY_KEYS = new Set([
  'toolNumbers',
  'canonicalDecimals',
  'allowedDecimals',
  'simulationNumbers',
  'confirmedUserInputs',
  'userInputs',
])
const PERCENT_ARRAY_KEYS = new Set(['allowedPercents', 'percentDecimals'])
const NUMERIC_FIELD_KEY_RE =
  /(?:Kwd|Qty|Count|Orders|Pct|Percent|PctChange|Delta|Price|Amount|Sales|Rev|Revenue)$/i
const PERCENT_FIELD_KEY_RE = /(?:Pct|Percent|SharePct|PctChange|DeltaPct)$/i

/**
 * Deterministic policy constants & Kuwait F&B pricing rule thresholds permitted as direct
 * literals in `executiveMode` ONLY (kept strictly separate from the pairwise derivation pool
 * so they never combine via `add`/`sub`/`mul` to match hallucinated numbers).
 */
const EXECUTIVE_POLICY_DECIMAL_SET: ReadonlySet<string> = new Set([
  // Kuwait 0.050 KWD rounding increment & psychological KWD price endings (.000/.250/.500/.750/.950)
  '0',
  '0.05',
  '0.25',
  '0.5',
  '0.75',
  '0.95',
  // Structural scenario & 1-to-1 matching counts
  '1',
  '2',
  '3',
  // Standard elasticity & Kuwait F&B pricing policy thresholds (%)
  '5',
  '-5',
  '8',
  '-8',
  '10',
  '-10',
  '12',
  '-12',
  '15',
  '-15',
  '20',
  '-20',
  '25',
  '-25',
  '30',
  '-30',
  '35',
  '-35',
  '50',
  '60',
  '80',
  '95',
  '100',
  // Odoo 17, POS register inclusion/exclusion IDs (24, 36, 25, 39, 40, 43, 150), and user 225
  '17',
  '24',
  '25',
  '36',
  '39',
  '40',
  '43',
  '150',
  '225',
])

const EXECUTIVE_POLICY_PERCENT_LIST: readonly string[] = [
  '0',
  '5',
  '-5',
  '8',
  '-8',
  '10',
  '-10',
  '12',
  '-12',
  '15',
  '-15',
  '20',
  '-20',
  '25',
  '-25',
  '30',
  '-30',
  '35',
  '-35',
  '60',
  '80',
  '95',
  '100',
]

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
  if (typeof value === 'number') {
    const canonical = decimalFromNumber(value)
    if (canonical) target.push(canonical)
    return
  }
  const trimmed = value.trim().replace(/%\s*$/, '')
  const canonical = canonicalDecimal(trimmed)
  if (canonical) target.push(canonical)
}

/** Numeric amount, quantity, or percent fields. Ids, dates, hours, and codes are skipped. */
export function collectFactValueDecimals(facts: unknown): string[] {
  const found: string[] = []
  const walk = (node: unknown, key: string | null) => {
    if (key && SKIP_KEYS.has(key)) return
    if (key && NUMERIC_ARRAY_KEYS.has(key) && Array.isArray(node)) {
      for (const value of node) {
        if (typeof value === 'number' && Number.isFinite(value)) pushCanonical(found, value)
        else if (typeof value === 'string') pushCanonical(found, value)
      }
      return
    }
    if (key === 'value' && (typeof node === 'string' || typeof node === 'number')) {
      pushCanonical(found, node)
      return
    }
    if (
      key &&
      NUMERIC_FIELD_KEY_RE.test(key) &&
      (typeof node === 'string' || (typeof node === 'number' && Number.isFinite(node)))
    ) {
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

function collectPercentValueDecimals(
  facts: unknown,
  options: GroundingOptions | undefined,
  executiveMode: boolean,
): string[] {
  const found: string[] = []
  for (const raw of options?.allowedPercents ?? []) {
    pushCanonical(found, raw)
  }
  if (executiveMode) {
    for (const policyPct of EXECUTIVE_POLICY_PERCENT_LIST) {
      pushCanonical(found, policyPct)
    }
    for (const simVal of options?.simulationNumbers ?? []) {
      pushCanonical(found, simVal)
    }
  }
  const walk = (node: unknown, key: string | null) => {
    if (key && PERCENT_ARRAY_KEYS.has(key) && Array.isArray(node)) {
      for (const value of node) {
        if (typeof value === 'number' || typeof value === 'string') pushCanonical(found, value)
      }
      return
    }
    if (executiveMode && key === 'simulationNumbers' && Array.isArray(node)) {
      for (const value of node) {
        if (typeof value === 'number' || typeof value === 'string') pushCanonical(found, value)
      }
      return
    }
    if (
      key &&
      PERCENT_FIELD_KEY_RE.test(key) &&
      (typeof node === 'string' || (typeof node === 'number' && Number.isFinite(node)))
    ) {
      pushCanonical(found, node)
      return
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, null)
      return
    }
    if (node && typeof node === 'object') {
      const record = node as Record<string, unknown>
      const unit = typeof record.unit === 'string' ? record.unit.trim().toLowerCase() : ''
      const id = typeof record.id === 'string' ? record.id : ''
      const label = typeof record.label === 'string' ? record.label : ''
      const rawVal = record.value
      const isPercentLabeledFact =
        unit === '%' ||
        unit === 'pct' ||
        unit === 'percent' ||
        /(?:^|[_|:-])(?:pct|percent|share|abc|elasticity)(?:$|[_|:-])/i.test(id) ||
        /%|\bpct\b|\bpercent\b|\bshare\b|\belasticity\b|نسبة|حصة/iu.test(label) ||
        (typeof rawVal === 'string' && /%\s*$/.test(rawVal))
      if (isPercentLabeledFact && (typeof rawVal === 'string' || typeof rawVal === 'number')) {
        pushCanonical(found, rawVal)
      }
      for (const [childKey, child] of Object.entries(record)) {
        if (SKIP_KEYS.has(childKey)) continue
        walk(child, childKey)
      }
    }
  }
  walk(facts, null)
  return [...new Set(found)]
}

function isExecutiveFactPack(facts: unknown): boolean {
  let detected = false
  const walk = (node: unknown, depth: number) => {
    if (detected || depth > 4 || !node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node.slice(0, 8)) walk(item, depth + 1)
      return
    }
    const record = node as Record<string, unknown>
    if (
      'labeledFacts' in record ||
      'simulationNumbers' in record ||
      'skuVelocity' in record ||
      'tierSummary' in record ||
      'baseDeltaKwd' in record ||
      'conservativeDeltaKwd' in record ||
      'stressTestDeltaKwd' in record ||
      'feryalRecKwd' in record ||
      record.source === ODOO_VERIFIED_ACTUAL_LABEL ||
      record.source === USER_INPUT_CONFIRMED_LABEL ||
      record.source === DETERMINISTIC_SIMULATION_LABEL ||
      record.source === KUWAIT_MARKET_PRICING_STRATEGY_LABEL ||
      record.sourceTag === USER_INPUT_CONFIRMED_LABEL
    ) {
      detected = true
      return
    }
    for (const child of Object.values(record)) walk(child, depth + 1)
  }
  walk(facts, 0)
  return detected
}

function detectsPosCogsUnavailable(facts: unknown): boolean {
  let explicitReadable: boolean | null = null
  let sawPosItems = false
  const walk = (node: unknown, depth: number) => {
    if (depth > 5 || !node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node.slice(0, 12)) walk(item, depth + 1)
      return
    }
    const record = node as Record<string, unknown>
    if (typeof record.cogsReadable === 'boolean') {
      explicitReadable = record.cogsReadable
    }
    if (
      (typeof record.metric === 'string' && record.metric.startsWith('item_')) ||
      'skuVelocity' in record ||
      'abcTier' in record ||
      'odooRealizedUnitPriceKwd' in record ||
      'avgRealizedPriceKwd' in record
    ) {
      sawPosItems = true
    }
    for (const child of Object.values(record)) walk(child, depth + 1)
  }
  walk(facts, 0)
  if (explicitReadable === false) return true
  if (explicitReadable === true) return false
  return sawPosItems
}

export function collectAllowedDecimals(facts: unknown): Set<string> {
  return new Set(collectFactValueDecimals(facts))
}

function writtenScale(raw: string): number {
  const fraction = raw.replace(/,/g, '').split('.')[1] ?? ''
  return fraction.length
}

function matchesRounded(exact: Decimal, written: Decimal, scale: number): boolean {
  if (exact.roundHalfUp(scale).compare(written) === 0) return true
  // Also accept half-up rounding to 0dp, 1dp, 2dp, or 3dp when trailing zeros were omitted (e.g. `10.5` for `10.50`).
  if (scale <= 3) {
    for (const targetScale of [0, 1, 2, 3]) {
      if (targetScale < scale) continue
      if (exact.roundHalfUp(targetScale).compare(written) === 0) return true
    }
  }
  return false
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
        if (left.sub(right).roundHalfUp(scale).compare(written) === 0) return true
        continue
      }
      if (mode === 'ratio') {
        const ratio = left.div(right, scale + 6)
        if (ratio && ratio.roundHalfUp(scale).compare(written) === 0) return true
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
    return /(?:^|[^\p{L}\p{N}])(?:difference|delta|gap|impact|فرق|الفارق|الفرق|بفارق|الأثر|أثر)(?=$|[^\p{L}\p{N}])/iu.test(
      text,
    )
  }
  if (kind === 'ratio') return /%\s*of\b|\bratio\b|\bshare\b|\bof\b|\babc\b|\btier\b|نسبة|حصة/iu.test(text)
  return /(?:^|[^\p{L}\p{N}])(?:growth|percent|change|increase|decrease|hike|drop|elasticity|نمو|نسبة|زيادة|تغير|انخفاض)(?=$|[^\p{L}\p{N}])/iu.test(
    text,
  )
}

function hasLossOrDropCue(text: string): boolean {
  return /\b(?:drop|drops|dropped|decline|decrease|loss|lower|negative|reduction|volume\s+loss|stress[- ]test|conservative)\b|(?:انخفاض|تراجع|خسارة|نقص|هبوط|تحفظي|ضغط)/iu.test(
    text,
  )
}

const EXECUTIVE_CAP_OR_COMPRESS_CUE_RE =
  /\b(?:cap|caps|capped|capping|trim|trims|trimmed|compress|compresses|compressed|compression|moderate|moderates|moderated|pull\s+back|scale\s+back|reduce|reduces|reduced)\b|(?:سقف|يقلص|تقليص|تخفيف|تعديل|ضبط|كبح|حصر)/iu

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

function localClauseAround(text: string, start: number, end: number): string {
  let left = start
  while (left > 0 && start - left < 56 && !/[\n.!?;؛|]/.test(text[left - 1] ?? '')) {
    left -= 1
  }
  let right = end
  while (right < text.length && right - end < 56 && !/[\n.!?;؛|]/.test(text[right] ?? '')) {
    right += 1
  }
  return text.slice(left, right)
}

function directionMatches(text: string, facts: unknown, executiveMode: boolean): boolean {
  FROM_TO.lastIndex = 0
  const pairs: Array<-1 | 0 | 1> = []
  for (const match of text.matchAll(FROM_TO)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    const from = Decimal.parse(match[1] ?? '')
    const to = Decimal.parse(match[2] ?? '')
    if (!from || !to) return false
    const pairSign = to.sub(from).sign()
    pairs.push(pairSign)
    const window = executiveMode
      ? localClauseAround(text, start, end)
      : text.slice(Math.max(0, start - 64), Math.min(text.length, end + 64))
    if (executiveMode && pairSign <= 0 && EXECUTIVE_CAP_OR_COMPRESS_CUE_RE.test(window)) {
      continue
    }
    const word = directionSign(window)
    if (word !== 0 && pairSign !== word) return false
  }
  if (executiveMode) {
    return true
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
export const ODOO_VERIFIED_ACTUAL_LABEL = 'Odoo Verified Actual'
export const USER_INPUT_CONFIRMED_LABEL = 'User Input (Confirmed)'
export const DETERMINISTIC_SIMULATION_LABEL = 'Deterministic Simulation'
export const KUWAIT_MARKET_PRICING_STRATEGY_LABEL = 'Kuwait Market Pricing Strategy'
export const KUWAIT_MARKET_PRICING_STRATEGY_LABEL_AR = 'استراتيجية التسعير في سوق الكويت'

export const EXPLICIT_GROUNDING_LABELS = [
  ODOO_VERIFIED_ACTUAL_LABEL,
  USER_INPUT_CONFIRMED_LABEL,
  DETERMINISTIC_SIMULATION_LABEL,
  KUWAIT_MARKET_PRICING_STRATEGY_LABEL,
  KUWAIT_MARKET_PRICING_STRATEGY_LABEL_AR,
  PROPOSED_USER_INPUT_LABEL,
  ODOO_VERIFIED_ACTUALS_LABEL,
] as const

export interface GroundingOptions {
  /** The user's question. Numbers they typed are allowed only when the answer labels them. */
  question?: string
  /** Extra proposed amounts already parsed from the question or ConfirmedPriceSheet. */
  userInputs?: readonly string[]
  /** Deterministic simulation numbers (including Feryal Rec. KWD & portfolio deltas). */
  simulationNumbers?: readonly (string | number)[]
  /** Deterministic whitelist of allowed numeric values (Odoo actuals, confirmed inputs, simulation KWD). */
  allowedDecimals?: readonly (string | number)[]
  /** Deterministic whitelist of allowed percentage values (ABC shares, % changes, elasticity scenarios). */
  allowedPercents?: readonly (string | number)[]
  /** Verbatim entity names (e.g. '360 Mall', 'مول 360', 'Combo 2') masked prior to number scanning. */
  allowedEntityNames?: readonly string[]
  /** Explicitly reject any invented COGS / gross margin / net margin claims on POS SKUs. */
  forbidPosCogsMarginClaims?: boolean
  /** Multi-SKU executive brief mode: enables local per-clause direction check & markdown section ordinals. */
  executiveBriefMode?: boolean
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function maskIsoDates(text: string): string {
  return text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
}

export function maskExecutiveStructuralTokens(
  text: string,
  entityNames: readonly string[],
  executiveMode: boolean,
): string {
  let out = text
  if (entityNames.length > 0) {
    const sorted = [...new Set(entityNames.map((n) => normalizeGuardDigits(n).trim()).filter((n) => n.length >= 3))].sort(
      (a, b) => b.length - a.length,
    )
    for (const entity of sorted) {
      out = out.replace(new RegExp(escapeRegExp(entity), 'giu'), ' ')
    }
  }
  if (executiveMode) {
    out = out
      .replace(/^\s*(?:#{1,6}\s*)?\d{1,2}[.)]\s+/gm, ' ')
      // Leading-dot psychological KWD endings (.000 / .050 / .250 / .500 / .750 / .950)
      .replace(/(^|[^\d])\.(?:000|050|250|500|750|950)(?!\d)/gu, '$1 ')
      // Percentage ranges like "8-10%" or "8%–10%" or "10-15%" so range dashes are not parsed as minus signs
      .replace(/(^|[^\d.])(\d+(?:\.\d+)?)\s*%?\s*[-–—]\s*(\d+(?:\.\d+)?\s*%)/gu, '$1$2% to $3')
      // Structural 1-to-1 SKU matching, 80/15/5 Pareto ratio, and 3-scenario notation
      .replace(/\b1\s*(?:-\s*to\s*-|\s+to\s+|:)\s*1\b/giu, ' ')
      .replace(/\b80\s*[-/]\s*15\s*[-/]\s*5\b/gu, ' ')
      .replace(/\b3(?:\s*-\s*|\s+)(?:scenarios?|سيناريوهات|خيارات)\b/giu, ' ')
      .replace(/\b(?:50|5|0)\s*(?:fils|فلس)\b/giu, ' ')
      .replace(/\b(?:odoo|أودو|اودو)\s+17\b/giu, ' ')
      .replace(/\b(?:integration\s+user|user|id|مستخدم(?:\s+الربط)?|رقم)\s*#?225\b/giu, ' ')
      .replace(/\bpos\.config\s+(?:24|36|25|39|40|43)\b/giu, ' ')
      .replace(/\b(?:pos_category|category|فئة)\s+150\b/giu, ' ')
  }
  return out
}

export function hasExplicitGroundingLabel(text: string): boolean {
  return (
    text.includes(ODOO_VERIFIED_ACTUAL_LABEL) ||
    text.includes(USER_INPUT_CONFIRMED_LABEL) ||
    text.includes(DETERMINISTIC_SIMULATION_LABEL) ||
    text.includes(KUWAIT_MARKET_PRICING_STRATEGY_LABEL) ||
    text.includes(KUWAIT_MARKET_PRICING_STRATEGY_LABEL_AR) ||
    text.includes(PROPOSED_USER_INPUT_LABEL) ||
    text.includes(ODOO_VERIFIED_ACTUALS_LABEL) ||
    /proposed\s*\/\s*user input/i.test(text) ||
    /user input\s*\(\s*confirmed\s*\)/i.test(text) ||
    /odoo verified actuals?/i.test(text) ||
    /deterministic simulation/i.test(text) ||
    /kuwait market pricing strategy/i.test(text) ||
    /استراتيجية\s+التسعير\s+في\s+سوق\s+الكويت/u.test(text)
  )
}

function hasProposedLabel(text: string): boolean {
  return (
    text.includes(PROPOSED_USER_INPUT_LABEL) ||
    text.includes(USER_INPUT_CONFIRMED_LABEL) ||
    /proposed\s*\/\s*user input/i.test(text) ||
    /user input\s*\(\s*confirmed\s*\)/i.test(text) ||
    /مدخلات\s+المستخدم\s+المؤكدة/u.test(text)
  )
}

function decimalsIn(text: string): string[] {
  return extractCanonicalDecimals(maskIsoDates(normalizeGuardDigits(text)))
}

function proposedDecimals(
  options: GroundingOptions | undefined,
  labeled: boolean,
  executiveMode: boolean,
): string[] {
  const found = new Set<string>()
  if (labeled) {
    for (const qDec of decimalsIn(options?.question ?? '')) {
      found.add(qDec)
    }
  }
  if (labeled || executiveMode) {
    for (const raw of options?.userInputs ?? []) {
      const canonical = canonicalDecimal(raw)
      if (canonical) found.add(canonical)
    }
  }
  return [...found]
}

function absDecimal(d: Decimal): Decimal {
  return d.sign() < 0 ? Decimal.fromParts(-d.scaled, d.scale) : d
}

function matchesSingleValue(
  written: Decimal,
  scale: number,
  values: readonly Decimal[],
  allowUnsignedLossMagnitude: boolean,
): boolean {
  const exactScaleMatch = (exact: Decimal): boolean => exact.roundHalfUp(scale).compare(written) === 0
  for (const value of values) {
    if (exactScaleMatch(value)) return true
    if (allowUnsignedLossMagnitude && value.sign() < 0 && written.sign() > 0 && exactScaleMatch(absDecimal(value))) {
      return true
    }
  }
  return false
}

function matchesExecutiveHalfUpTolerance(
  written: Decimal,
  scale: number,
  values: readonly Decimal[],
  allowUnsignedLossMagnitude: boolean,
): boolean {
  for (const value of values) {
    if (matchesRounded(value, written, scale)) return true
    if (allowUnsignedLossMagnitude && value.sign() < 0 && written.sign() > 0 && matchesRounded(absDecimal(value), written, scale)) {
      return true
    }
  }
  return false
}

/** Sums, differences, products, and qty × (proposed − current), including half-up rounding. */
function matchesDerivation(
  written: Decimal,
  scale: number,
  values: readonly Decimal[],
  executiveMode: boolean,
  allowUnsignedLossMagnitude: boolean,
): boolean {
  if (
    executiveMode
      ? matchesExecutiveHalfUpTolerance(written, scale, values, allowUnsignedLossMagnitude)
      : matchesSingleValue(written, scale, values, false)
  ) {
    return true
  }
  const pool = values.slice(0, 40)
  for (let i = 0; i < pool.length; i += 1) {
    for (let j = 0; j < pool.length; j += 1) {
      if (i === j) continue
      const left = pool[i]
      const right = pool[j]
      if (!left || !right) continue
      if (left.add(right).roundHalfUp(scale).compare(written) === 0) return true
      if (left.sub(right).roundHalfUp(scale).compare(written) === 0) return true
      if (left.mul(right).roundHalfUp(scale).compare(written) === 0) return true
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
        if (left.sub(right).mul(factor).roundHalfUp(scale).compare(written) === 0) return true
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
    if (sum.roundHalfUp(scale).compare(written) === 0) return true
  }
  return false
}

function matchesPercentPool(
  written: Decimal,
  scale: number,
  percentValues: readonly Decimal[],
  allowUnsignedLossMagnitude: boolean,
): boolean {
  for (const exact of percentValues) {
    if (matchesRounded(exact, written, scale)) return true
    if (allowUnsignedLossMagnitude && exact.sign() < 0 && written.sign() > 0 && matchesRounded(absDecimal(exact), written, scale)) {
      return true
    }
  }
  const pool = percentValues.slice(0, 24)
  for (let i = 0; i < pool.length; i += 1) {
    for (let j = 0; j < pool.length; j += 1) {
      if (i === j) continue
      const left = pool[i]
      const right = pool[j]
      if (!left || !right) continue
      if (left.add(right).roundHalfUp(scale).compare(written) === 0) return true
      if (left.sub(right).roundHalfUp(scale).compare(written) === 0) return true
    }
  }
  return false
}

const COGS_OR_MARGIN_CLAIM_RE =
  /\b(?:cogs|cost\s+of\s+goods(?:\s+sold)?|food\s+cost|recipe\s+cost|unit\s+cost|item\s+cost|sku\s+cost|gross\s+margin|net\s+margin|profit\s+margin|contribution\s+margin|gross\s+profit)\b|(?:تكلف[ةه]\s*(?:البضاع[ةه]|المبيعات|الصنف|الأصناف|الاصناف|الطبق|الوصف[ةه]|المواد|الوحد[ةه])|هامش\s*(?:الربح|ربح|إجمالي|اجمالي|صافي|المساهم[ةه]|الصنف)|الهامش\s*(?:الإجمالي|الاجمالي|الصافي))/iu

const COGS_UNAVAILABLE_NEGATION_RE =
  /\b(?:not\s+(?:readable|available|estimated|calculated|computed|provided|accessible|linked|known|shown|included)|unreadable|unavailable|cannot|can't|can\s+not|unable\s+to|lacks?\b|lacking|lack\s+of|missing|without|no\s+(?:cogs|margin|margins|cost|read|access|permission|standard_price)|zero\s+fabricated\s+cost|do\s+not|does\s+not|never|omit(?:ted)?|excluded|refused|restricted|revenue[- ]only|gross\s+revenue\s+only|not\s+(?:net\s+)?(?:profit|margin|cogs))\b|(?:غير\s*(?:متاح|متاحة|متاحين|متوفر|متوفرة|مقروء|مقروءة|مقدر|مقدرة|محسوب|محسوبة|مربوط)|لا\s*(?:يمكن|تتوفر|يتوفر|يملك|تملك|نملك|يوجد|توجد|تقدر|تُقدر|نقدر|نخمن|يحتسب|تحتسب|يُحتسب|نحتسب)|ل?عدم\s*(?:توفر|إمكانية|امكانية|صلاحية|قدرة|احتساب|تقدير|قراءة)|يتعذر|تعذر|بدون|دون\s+(?:أي\s+|اي\s+)?(?:احتساب|تقدير|افتراض|تكلف|هامش|قراءة|صلاحية)|ليست?\s+(?:متاح|متوفر|مقروء)|لا\s+يشمل\s+(?:تكلف|هامش))/iu

function hasInventedPosCogsOrMarginClaim(normalizedText: string): boolean {
  const clauses = normalizedText.split(/[\n.!?;؛]+/)
  for (const rawClause of clauses) {
    const clause = rawClause.trim()
    if (!clause) continue
    if (!COGS_OR_MARGIN_CLAIM_RE.test(clause)) continue
    if (COGS_UNAVAILABLE_NEGATION_RE.test(clause)) continue
    const cleaned = clause
      .replace(/^\s*(?:#{1,6}\s*)?\d{1,2}[.)]\s+/, ' ')
      .replace(/\b(?:integration\s+user|user|id|مستخدم(?:\s+الربط)?|رقم)\s*#?225\b/giu, ' ')
      .replace(/\b(?:odoo|أودو|اودو)\s+17\b/giu, ' ')
    if (/\d/.test(cleaned)) {
      return true
    }
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
 * derivation of those values (including qty × (proposed − current)), a deterministic
 * simulation / ABC figure, or a user-confirmed number labeled `Proposed / User Input`
 * or `User Input (Confirmed)`.
 */
export function guardAnswerAgainstFacts(
  answer: string,
  facts: unknown,
  options?: GroundingOptions,
): NumberGuardResult {
  const digitsNormalized = normalizeGuardDigits(answer)
  if (/\d(?:\.\d+)?e[+-]?\d/i.test(digitsNormalized)) {
    return { ok: false, offending: ['SCIENTIFIC'] }
  }
  const executiveMode = options?.executiveBriefMode === true || isExecutiveFactPack(facts)
  const posCogsUnavailable =
    options?.forbidPosCogsMarginClaims === true || detectsPosCogsUnavailable(facts)

  const maskedDates = maskIsoDates(digitsNormalized)
  const normalized = maskExecutiveStructuralTokens(
    maskedDates,
    options?.allowedEntityNames ?? [],
    executiveMode,
  )

  const labeled = hasProposedLabel(digitsNormalized)
  const userCanon = proposedDecimals(options, labeled, executiveMode)
  const explicitAllowedCanon: string[] = []
  for (const raw of options?.allowedDecimals ?? []) {
    pushCanonical(explicitAllowedCanon, raw)
  }
  for (const simRaw of options?.simulationNumbers ?? []) {
    pushCanonical(explicitAllowedCanon, simRaw)
  }
  const valueCanon = [...new Set([...collectFactValueDecimals(facts), ...explicitAllowedCanon, ...userCanon])]
  const valueSet = new Set(valueCanon)
  const parsed = valueCanon.flatMap((token) => {
    const decimal = Decimal.parse(token)
    return decimal ? [decimal] : []
  })

  const percentCanon = collectPercentValueDecimals(facts, options, executiveMode)
  const percentParsed = percentCanon.flatMap((token) => {
    const decimal = Decimal.parse(token)
    return decimal ? [decimal] : []
  })
  const allowUnsignedLossMagnitude = executiveMode && hasLossOrDropCue(digitsNormalized)

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
      ? matchesPercentPool(written, scale, percentParsed, allowUnsignedLossMagnitude) ||
        (explainedGrowth && pairMatches(written, scale, parsed, 'growth')) ||
        (explainedRatio && pairMatches(written, scale, parsed, 'share'))
      : valueSet.has(canonical) ||
        (executiveMode && EXECUTIVE_POLICY_DECIMAL_SET.has(canonical)) ||
        matchesDerivation(written, scale, parsed, executiveMode, allowUnsignedLossMagnitude) ||
        (explainedDifference && pairMatches(written, scale, parsed, 'delta')) ||
        (explainedRatio && pairMatches(written, scale, parsed, 'ratio'))
    if (!ok) offending.push(canonical)
  }
  if (posCogsUnavailable && hasInventedPosCogsOrMarginClaim(maskedDates)) {
    offending.push('COGS_MARGIN_UNAVAILABLE')
  }
  if (!directionMatches(normalized, facts, executiveMode)) offending.push('DIRECTION')
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
