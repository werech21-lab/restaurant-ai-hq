/**
 * Receivable aging that only ages money customers actually owe.
 *
 * Why: the old buckets summed signed `amount_residual` per account by posting `date`, so unmatched
 * payments and POS / aggregator clearing credits were netted against invoices and produced negative
 * "aging" buckets. Here every positive open residual is aged by its due date (`date_maturity`,
 * falling back to `date`), and every negative open residual is reported once as unapplied credits.
 * `openReceivableKwd` stays debits − credits so the headline still ties back to Odoo.
 */

import {
  isReceivablesUnderReconciliation,
  RECEIVABLES_RECONCILIATION_REASON_AR,
  RECEIVABLES_RECONCILIATION_REASON_EN,
} from '@/lib/aether/receivables-headline'

export const AR_AGING_BUCKETS = [
  { key: '0_30', minDays: 0, maxDays: 30, labelAr: '0–30 يوماً', labelEn: '0–30 days' },
  { key: '31_60', minDays: 31, maxDays: 60, labelAr: '31–60 يوماً', labelEn: '31–60 days' },
  { key: 'over_60', minDays: 61, maxDays: null, labelAr: 'أكثر من 60 يوماً', labelEn: 'Over 60 days' },
] as const

export type ArAgingBucketKey = (typeof AR_AGING_BUCKETS)[number]['key']

const MS_PER_DAY = 86_400_000

export interface OpenReceivableLine {
  residualKwd: number
  dateMaturity: string | null
  date: string
}

export interface ArAgingBucketResult {
  key: ArAgingBucketKey
  labelAr: string
  labelEn: string
  residualKwd: number
  positiveDebitKwd: number
  creditOffsetKwd: number
  linesCount: number
}

export interface ArAgingResult {
  basis: 'open-debits-by-due-date'
  buckets: ArAgingBucketResult[]
  openDebitsKwd: number
  unappliedCreditsKwd: number
  unappliedCreditLinesCount: number
  openReceivableKwd: number
}

export interface AgingGroupTotal {
  residualKwd: number
  linesCount: number
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / MS_PER_DAY)
}

function shiftIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10)
}

/** Lines not yet due count as current (0–30). */
export function classifyAgingBucket(dueIso: string, todayIso: string): ArAgingBucketKey {
  const ageDays = Math.max(0, daysBetween(dueIso, todayIso))
  const hit = AR_AGING_BUCKETS.find((b) => ageDays >= b.minDays && (b.maxDays === null || ageDays <= b.maxDays))
  return hit?.key ?? 'over_60'
}

function emptyBucket(def: (typeof AR_AGING_BUCKETS)[number]): ArAgingBucketResult {
  return {
    key: def.key,
    labelAr: def.labelAr,
    labelEn: def.labelEn,
    residualKwd: 0,
    positiveDebitKwd: 0,
    creditOffsetKwd: 0,
    linesCount: 0,
  }
}

/** Builds the result from per-bucket debit totals and one credit total. */
export function summarizeArAging(input: {
  debitsByBucket: Partial<Record<ArAgingBucketKey, AgingGroupTotal>>
  credits: AgingGroupTotal
}): ArAgingResult {
  const buckets = AR_AGING_BUCKETS.map((def) => {
    const group = input.debitsByBucket[def.key]
    const debit = round3(Math.max(0, group?.residualKwd ?? 0))
    return { ...emptyBucket(def), residualKwd: debit, positiveDebitKwd: debit, linesCount: group?.linesCount ?? 0 }
  })
  const openDebitsKwd = round3(buckets.reduce((s, b) => s + b.residualKwd, 0))
  const unappliedCreditsKwd = round3(Math.min(0, input.credits.residualKwd))
  return {
    basis: 'open-debits-by-due-date',
    buckets,
    openDebitsKwd,
    unappliedCreditsKwd,
    unappliedCreditLinesCount: input.credits.linesCount,
    openReceivableKwd: round3(openDebitsKwd + unappliedCreditsKwd),
  }
}

/** Line-level aging; the server uses `buildArAgingDomains` + `summarizeArAging` for the same result. */
export function ageOpenReceivableLines(lines: readonly OpenReceivableLine[], todayIso: string): ArAgingResult {
  const debitsByBucket: Partial<Record<ArAgingBucketKey, AgingGroupTotal>> = {}
  const credits: AgingGroupTotal = { residualKwd: 0, linesCount: 0 }
  for (const line of lines) {
    if (line.residualKwd < 0) {
      credits.residualKwd += line.residualKwd
      credits.linesCount += 1
      continue
    }
    if (line.residualKwd === 0) continue
    const key = classifyAgingBucket(line.dateMaturity || line.date, todayIso)
    const group = debitsByBucket[key] ?? { residualKwd: 0, linesCount: 0 }
    group.residualKwd += line.residualKwd
    group.linesCount += 1
    debitsByBucket[key] = group
  }
  return summarizeArAging({ debitsByBucket, credits })
}

/** Odoo domain clause: due date (maturity, else posting date) inside [fromIso, toExclusiveIso). */
function dueDateWindowClause(fromIso: string | null, toExclusiveIso: string | null): unknown[] {
  const range = (field: string): unknown[][] => [
    ...(fromIso ? [[field, '>=', fromIso]] : []),
    ...(toExclusiveIso ? [[field, '<', toExclusiveIso]] : []),
  ]
  const withMaturity = [['date_maturity', '!=', false], ...range('date_maturity')]
  const withoutMaturity = [['date_maturity', '=', false], ...range('date')]
  const and = (clauses: unknown[][]): unknown[] =>
    clauses.length <= 1 ? clauses : [...Array(clauses.length - 1).fill('&'), ...clauses]
  return ['|', ...and(withMaturity), ...and(withoutMaturity)]
}

/** One debit domain per aging bucket plus the unapplied-credit domain. */
export function buildArAgingDomains(baseDomain: readonly unknown[][], todayIso: string): {
  debitDomains: { key: ArAgingBucketKey; domain: unknown[] }[]
  creditDomain: unknown[]
} {
  const debitDomains = AR_AGING_BUCKETS.map((def) => {
    // Age N days ⇔ due date = today − N. A bucket [min, max] covers due dates (today−max−1, today−min].
    const toExclusive = def.minDays === 0 ? null : shiftIso(todayIso, -def.minDays + 1)
    const from = def.maxDays === null ? null : shiftIso(todayIso, -def.maxDays)
    return {
      key: def.key,
      domain: [...baseDomain, ['amount_residual', '>', 0], ...dueDateWindowClause(from, toExclusive)],
    }
  })
  return { debitDomains, creditDomain: [...baseDomain, ['amount_residual', '<', 0]] }
}

export interface DisplayableAging {
  buckets: ArAgingBucketResult[]
  unappliedCreditsKwd: number | null
  openDebitsKwd: number | null
  /** Why no buckets are shown, when the payload only carries the old signed per-account buckets. */
  hiddenReasonAr: string | null
  hiddenReasonEn: string | null
}

const LEGACY_AGING_HIDDEN = {
  ar: 'تعمير الذمم غير متاح: البيانات الحالية تخلط الدفعات غير المطابقة بالفواتير',
  en: 'Aging unavailable: this payload nets unmatched payments against invoices',
} as const

/**
 * Only due-date aging of open debits is shown. Older payloads carry signed per-account nets that
 * can be negative; those are hidden with a reason instead of being displayed as aging.
 */
export function toDisplayableAging(raw: {
  agingBasis?: string
  agingBuckets?: readonly ArAgingBucketResult[] | readonly { key: string; residualKwd: number }[]
  unappliedCreditsKwd?: number
  openDebitsKwd?: number
  posClearingLinesCount?: number
  openReceivableKwd?: number
  grossPositiveReceivableKwd?: number
} | null | undefined): DisplayableAging {
  if (isReceivablesUnderReconciliation(raw)) {
    return {
      buckets: [],
      unappliedCreditsKwd: null,
      openDebitsKwd: null,
      hiddenReasonAr: RECEIVABLES_RECONCILIATION_REASON_AR,
      hiddenReasonEn: RECEIVABLES_RECONCILIATION_REASON_EN,
    }
  }
  if (raw?.agingBasis === 'open-debits-by-due-date' && raw.agingBuckets) {
    return {
      buckets: (raw.agingBuckets as ArAgingBucketResult[]).map((b) => ({ ...b, residualKwd: Math.max(0, b.residualKwd) })),
      unappliedCreditsKwd: raw.unappliedCreditsKwd ?? null,
      openDebitsKwd: raw.openDebitsKwd ?? null,
      hiddenReasonAr: null,
      hiddenReasonEn: null,
    }
  }
  const hasLegacy = Boolean(raw?.agingBuckets && raw.agingBuckets.length > 0)
  return {
    buckets: [],
    unappliedCreditsKwd: null,
    openDebitsKwd: null,
    hiddenReasonAr: hasLegacy ? LEGACY_AGING_HIDDEN.ar : null,
    hiddenReasonEn: hasLegacy ? LEGACY_AGING_HIDDEN.en : null,
  }
}

/** Open debits and unapplied credits are rounded separately; one fils of drift still ties. */
const AR_TIE_TOLERANCE_FILS = 1
const FILS_PER_KWD = 1000

export interface ArTieOut {
  openDebitsKwd: number
  unappliedCreditsKwd: number
  openReceivableKwd: number
  ties: boolean
  /** Open AR − (open debits + unapplied credits); 0 when it ties. */
  differenceKwd: number
}

/**
 * The AR card's one credit decomposition: aging total (open debits) + unapplied credits = open AR.
 * `null` when the payload has no due-date aging (legacy payloads), so nothing half-ties on screen.
 */
export function buildArTieOut(input: {
  openDebitsKwd: number | null
  unappliedCreditsKwd: number | null
  openReceivableKwd: number
}): ArTieOut | null {
  if (input.openDebitsKwd === null || input.unappliedCreditsKwd === null) return null
  const toFils = (kwd: number) => Math.round(kwd * FILS_PER_KWD)
  const diffFils = toFils(input.openReceivableKwd) - toFils(input.openDebitsKwd) - toFils(input.unappliedCreditsKwd)
  const ties = Math.abs(diffFils) <= AR_TIE_TOLERANCE_FILS
  return {
    openDebitsKwd: input.openDebitsKwd,
    unappliedCreditsKwd: input.unappliedCreditsKwd,
    openReceivableKwd: input.openReceivableKwd,
    ties,
    differenceKwd: ties ? 0 : diffFils / FILS_PER_KWD,
  }
}

function fmt2(kwd: number): string {
  return kwd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * The receivables formula line. With due-date aging it uses the same line-level split as the AR
 * card (open debits − unapplied credits); older payloads keep the account-level split they carry.
 */
export function formatArReconciliationFormula(input: {
  openReceivableKwd: number
  grossPositiveReceivableKwd: number
  creditClearingOffsetKwd: number
  openDebitsKwd: number | null
  unappliedCreditsKwd: number | null
}): { ar: string; en: string } {
  const net = fmt2(input.openReceivableKwd)
  if (input.openDebitsKwd !== null && input.unappliedCreditsKwd !== null) {
    const debits = fmt2(input.openDebitsKwd)
    const credits = fmt2(Math.abs(input.unappliedCreditsKwd))
    return {
      ar: `${debits} د.ك مدين مفتوح (أعمار الذمم) − ${credits} د.ك دفعات ومقاصات غير مطابقة = ${net} د.ك صافي`,
      en: `${debits} KWD open debits (aging) − ${credits} KWD unapplied credits = ${net} KWD net`,
    }
  }
  const gross = fmt2(input.grossPositiveReceivableKwd)
  const offset = fmt2(Math.abs(input.creditClearingOffsetKwd))
  return {
    ar: `${gross} د.ك ذمم موجبة − ${offset} د.ك مقاصة دائنة = ${net} د.ك صافي`,
    en: `${gross} KWD positive AR − ${offset} KWD credit clearing = ${net} KWD net`,
  }
}
