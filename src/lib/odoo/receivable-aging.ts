/**
 * Unified receivable aging that ages only verified net-positive open debtor balances.
 *
 * Isolation & Netting Invariants:
 * 1. POS cashier clearing is isolated strictly by explicit `accountId === POS_CLEARING_ACCOUNT_ID` (35).
 *    Missing or non-integer `accountId` values trigger Fail-Closed with structured `logger.error`
 *    and zero fallback to account-code or account-name string matching.
 * 2. Within each `(partner_id, account_id)` pair (excluding `accountId === 35`), unapplied negative
 *    credit/settlement residuals offset open positive debit lines FIFO (oldest `date_maturity || date`
 *    first), so only net-positive debtor balances remain in `0_7`, `8_30`, `31_60`, and `over_60`,
 *    and `sum(buckets.map(b => b.positiveDebitKwd)) === openDebitsKwd` to 3 decimal places (`0.000` diff).
 */
import { logger } from '../logger'
import { isVerifiedReceivableAccountId, POS_CLEARING_ACCOUNT_ID } from './receivable-domain'

export const AR_AGING_BUCKETS = [
  { key: '0_7', minDays: 0, maxDays: 7, labelAr: '0–7 أيام', labelEn: '0–7 days' },
  { key: '8_30', minDays: 8, maxDays: 30, labelAr: '8–30 يوماً', labelEn: '8–30 days' },
  { key: '31_60', minDays: 31, maxDays: 60, labelAr: '31–60 يوماً', labelEn: '31–60 days' },
  { key: 'over_60', minDays: 61, maxDays: null, labelAr: 'أكثر من 60 يوماً', labelEn: 'Over 60 days' },
] as const

export type ArAgingBucketKey = (typeof AR_AGING_BUCKETS)[number]['key']

const MS_PER_DAY = 86_400_000
const FILS_PER_KWD = 1000

export class UnverifiedReceivableAccountError extends Error {
  readonly stage: string
  readonly unverifiedCount: number

  constructor(stage: string, unverifiedCount: number) {
    super(
      `Fail-closed receivable aging: ${unverifiedCount} row(s) missing verified integer Odoo accountId at ${stage}`,
    )
    this.name = 'UnverifiedReceivableAccountError'
    this.stage = stage
    this.unverifiedCount = unverifiedCount
  }
}

export interface OpenReceivableLine {
  id?: number | null
  partnerId?: number | null
  accountId?: number | null
  residualKwd: number
  dateMaturity: string | null
  date: string
}

export interface UnifiedReceivablePartnerGroup {
  partnerId: number | null
  accountId?: number | null
  residualKwd: number
  linesCount: number
  oldestDueDate?: string | null
  oldestPostingDate?: string | null
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

export interface UnifiedArAgingResult extends ArAgingResult {
  failClosed: boolean
  posClearingResidualKwd: number
  posClearingLinesCount: number
}

export interface AgingGroupTotal {
  residualKwd: number
  linesCount: number
}

function normalizeZero(n: number): number {
  return Object.is(n, -0) ? 0 : n
}

function round3(n: number): number {
  return normalizeZero(Math.round(n * FILS_PER_KWD) / FILS_PER_KWD)
}

function toFils(kwd: number): number {
  return Math.round((Number(kwd) || 0) * FILS_PER_KWD)
}

function fromFils(fils: number): number {
  return normalizeZero(fils / FILS_PER_KWD)
}

function cleanIsoDay(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : null
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / MS_PER_DAY)
}

function shiftIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10)
}

/** Lines not yet due count as current (0–7 days). */
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

function failClosedAgingResult(): UnifiedArAgingResult {
  return {
    basis: 'open-debits-by-due-date',
    failClosed: true,
    buckets: [],
    openDebitsKwd: 0,
    unappliedCreditsKwd: 0,
    unappliedCreditLinesCount: 0,
    openReceivableKwd: 0,
    posClearingResidualKwd: 0,
    posClearingLinesCount: 0,
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

function minIsoDay(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a <= b ? a : b
}

function partnerAccountKey(partnerId: number | null | undefined, accountId: number): string {
  const normalizedPartner = typeof partnerId === 'number' && Number.isFinite(partnerId) ? Math.trunc(partnerId) : 0
  return `${normalizedPartner}:${accountId}`
}

/**
 * Unified receivable aging over verified Odoo `(partner_id, account_id)` balances and open lines.
 *
 * - Fails closed (emitting `logger.error` and returning empty `failClosed: true` or throwing when
 *   `throwOnUnverifiedAccountId` is set) whenever any group or line lacks a verified positive
 *   integer `accountId`.
 * - Isolates `accountId === POS_CLEARING_ACCOUNT_ID` (35) strictly by explicit ID.
 * - Nets unapplied negative credit lines FIFO against oldest open debit lines within each
 *   `(partner_id, account_id)` debtor so `sum(buckets) === openDebitsKwd` with `0.000` drift.
 * - Cleanly falls back to `oldestDueDate || oldestPostingDate` from `partnerGroups` when open line
 *   rows are absent for a net-positive debtor.
 */
export function computeUnifiedReceivableAging(input: {
  todayIso: string
  lines?: readonly OpenReceivableLine[]
  partnerGroups?: readonly UnifiedReceivablePartnerGroup[]
  fallbackDateIso?: string
  throwOnUnverifiedAccountId?: boolean
}): UnifiedArAgingResult {
  const rawGroups = input.partnerGroups
  const rawLines = input.lines ?? []
  const fallbackIso = cleanIsoDay(input.fallbackDateIso) ?? cleanIsoDay(input.todayIso) ?? '1970-01-01'

  if (rawGroups) {
    const unverifiedGroups = rawGroups.filter((g) => !isVerifiedReceivableAccountId(g.accountId)).length
    if (unverifiedGroups > 0) {
      logger.error('receivable_aging_fail_closed_unverified_account_id', {
        stage: 'partnerGroups',
        totalRows: rawGroups.length,
        unverifiedCount: unverifiedGroups,
      })
      if (input.throwOnUnverifiedAccountId) {
        throw new UnverifiedReceivableAccountError('partnerGroups', unverifiedGroups)
      }
      return failClosedAgingResult()
    }
  }

  if (rawLines.length > 0) {
    const unverifiedLines = rawLines.filter((l) => !isVerifiedReceivableAccountId(l.accountId)).length
    if (unverifiedLines > 0) {
      logger.error('receivable_aging_fail_closed_unverified_account_id', {
        stage: 'lines',
        totalRows: rawLines.length,
        unverifiedCount: unverifiedLines,
      })
      if (input.throwOnUnverifiedAccountId) {
        throw new UnverifiedReceivableAccountError('lines', unverifiedLines)
      }
      return failClosedAgingResult()
    }
  }

  const bucketFils = new Map<ArAgingBucketKey, { fils: number; linesCount: number }>(
    AR_AGING_BUCKETS.map((def) => [def.key, { fils: 0, linesCount: 0 }]),
  )

  let posClearingResidualFils = 0
  let posClearingLinesCount = 0
  let unappliedCreditsFils = 0
  let unappliedCreditLinesCount = 0

  type PreparedLine = {
    id: number
    residualFils: number
    dueIso: string
    postingIso: string
  }

  const linesByGroup = new Map<string, PreparedLine[]>()
  let fallbackLineSeq = 0
  for (const line of rawLines) {
    const accId = line.accountId as number
    const resFils = toFils(line.residualKwd)
    if (accId === POS_CLEARING_ACCOUNT_ID) {
      if (!rawGroups) {
        posClearingResidualFils += resFils
        posClearingLinesCount += 1
      }
      continue
    }
    if (resFils === 0) continue
    const postingIso = cleanIsoDay(line.date) ?? fallbackIso
    const dueIso = cleanIsoDay(line.dateMaturity) ?? postingIso
    const key = partnerAccountKey(line.partnerId, accId)
    const bucket = linesByGroup.get(key) ?? []
    bucket.push({
      id: typeof line.id === 'number' && Number.isFinite(line.id) ? line.id : ++fallbackLineSeq,
      residualFils: resFils,
      dueIso,
      postingIso,
    })
    linesByGroup.set(key, bucket)
  }

  const ageDebtorGroupFifo = (
    groupNetFils: number,
    groupLinesCount: number,
    groupFallbackDueIso: string,
    groupLines: readonly PreparedLine[],
  ) => {
    const positiveLines = groupLines
      .filter((l) => l.residualFils > 0)
      .sort((a, b) => a.dueIso.localeCompare(b.dueIso) || a.postingIso.localeCompare(b.postingIso) || a.id - b.id)

    if (positiveLines.length === 0) {
      const bKey = classifyAgingBucket(groupFallbackDueIso, input.todayIso)
      const acc = bucketFils.get(bKey)!
      acc.fils += groupNetFils
      acc.linesCount += Math.max(1, Math.round(groupLinesCount))
      return
    }

    const totalPositiveFils = positiveLines.reduce((sum, l) => sum + l.residualFils, 0)
    let creditToOffsetFils = Math.max(0, totalPositiveFils - groupNetFils)
    let agedFils = 0

    for (const posLine of positiveLines) {
      const offset = Math.min(posLine.residualFils, creditToOffsetFils)
      const netLineFils = posLine.residualFils - offset
      creditToOffsetFils -= offset
      if (netLineFils > 0) {
        const bKey = classifyAgingBucket(posLine.dueIso, input.todayIso)
        const acc = bucketFils.get(bKey)!
        acc.fils += netLineFils
        acc.linesCount += 1
        agedFils += netLineFils
      }
    }

    const remainderFils = groupNetFils - agedFils
    if (remainderFils > 0) {
      const bKey = classifyAgingBucket(groupFallbackDueIso, input.todayIso)
      const acc = bucketFils.get(bKey)!
      acc.fils += remainderFils
      acc.linesCount += 1
    }
  }

  if (rawGroups) {
    const mergedGroups = new Map<
      string,
      {
        residualFils: number
        linesCount: number
        oldestDueDate: string | null
        oldestPostingDate: string | null
      }
    >()

    for (const group of rawGroups) {
      const accId = group.accountId as number
      const resFils = toFils(group.residualKwd)
      const cnt = Math.max(0, Math.round(group.linesCount || 0))
      if (accId === POS_CLEARING_ACCOUNT_ID) {
        posClearingResidualFils += resFils
        posClearingLinesCount += cnt
        continue
      }
      const key = partnerAccountKey(group.partnerId, accId)
      const prior = mergedGroups.get(key)
      const dueDay = cleanIsoDay(group.oldestDueDate)
      const postDay = cleanIsoDay(group.oldestPostingDate)
      if (prior) {
        prior.residualFils += resFils
        prior.linesCount += cnt
        prior.oldestDueDate = minIsoDay(prior.oldestDueDate, dueDay)
        prior.oldestPostingDate = minIsoDay(prior.oldestPostingDate, postDay)
      } else {
        mergedGroups.set(key, {
          residualFils: resFils,
          linesCount: cnt,
          oldestDueDate: dueDay,
          oldestPostingDate: postDay,
        })
      }
    }

    for (const [key, group] of mergedGroups.entries()) {
      if (group.residualFils < 0) {
        unappliedCreditsFils += group.residualFils
        unappliedCreditLinesCount += Math.max(1, group.linesCount)
        continue
      }
      if (group.residualFils === 0) continue
      const fallbackDue = group.oldestDueDate ?? group.oldestPostingDate ?? fallbackIso
      ageDebtorGroupFifo(group.residualFils, group.linesCount, fallbackDue, linesByGroup.get(key) ?? [])
    }
  } else {
    for (const [, groupLines] of linesByGroup.entries()) {
      const netFils = groupLines.reduce((sum, l) => sum + l.residualFils, 0)
      if (netFils < 0) {
        unappliedCreditsFils += netFils
        unappliedCreditLinesCount += groupLines.filter((l) => l.residualFils < 0).length || 1
        continue
      }
      if (netFils === 0) continue
      const earliestDue = groupLines.reduce<string | null>((min, l) => minIsoDay(min, l.dueIso), null) ?? fallbackIso
      ageDebtorGroupFifo(netFils, groupLines.length, earliestDue, groupLines)
    }
  }

  const buckets: ArAgingBucketResult[] = AR_AGING_BUCKETS.map((def) => {
    const cell = bucketFils.get(def.key) ?? { fils: 0, linesCount: 0 }
    const kwd = fromFils(Math.max(0, cell.fils))
    return {
      ...emptyBucket(def),
      residualKwd: kwd,
      positiveDebitKwd: kwd,
      linesCount: cell.linesCount,
    }
  })

  const openDebitsFils = AR_AGING_BUCKETS.reduce((sum, def) => sum + Math.max(0, bucketFils.get(def.key)?.fils ?? 0), 0)
  const openDebitsKwd = fromFils(openDebitsFils)
  const unappliedCreditsKwd = fromFils(Math.min(0, unappliedCreditsFils))

  return {
    basis: 'open-debits-by-due-date',
    failClosed: false,
    buckets,
    openDebitsKwd,
    unappliedCreditsKwd,
    unappliedCreditLinesCount,
    openReceivableKwd: fromFils(openDebitsFils + Math.min(0, unappliedCreditsFils)),
    posClearingResidualKwd: fromFils(posClearingResidualFils),
    posClearingLinesCount,
  }
}

/**
 * Ages open receivable lines. When lines carry `accountId` metadata, enforces explicit
 * `POS_CLEARING_ACCOUNT_ID = 35` isolation, Fail-Closed `accountId` validation, and
 * `(partnerId, accountId)` FIFO credit netting via `computeUnifiedReceivableAging`.
 */
export function ageOpenReceivableLines(lines: readonly OpenReceivableLine[], todayIso: string): ArAgingResult {
  const carriesAccountMetadata = lines.some((line) => 'accountId' in line || 'partnerId' in line)
  if (carriesAccountMetadata) {
    const unified = computeUnifiedReceivableAging({ todayIso, lines })
    return {
      basis: unified.basis,
      buckets: unified.buckets,
      openDebitsKwd: unified.openDebitsKwd,
      unappliedCreditsKwd: unified.unappliedCreditsKwd,
      unappliedCreditLinesCount: unified.unappliedCreditLinesCount,
      openReceivableKwd: unified.openReceivableKwd,
    }
  }

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

/**
 * Per-bucket due-date window domains (`0_7`, `8_30`, `31_60`, `over_60`) plus negative-residual domain.
 * Live sync uses `computeUnifiedReceivableAging` so unapplied partner credits are netted FIFO per
 * `(partner_id, account_id)` rather than summing raw line-level `amount_residual > 0`.
 */
export function buildArAgingDomains(baseDomain: readonly unknown[][], todayIso: string): {
  debitDomains: { key: ArAgingBucketKey; domain: unknown[] }[]
  creditDomain: unknown[]
} {
  const debitDomains = AR_AGING_BUCKETS.map((def) => {
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
  /** Why no buckets are shown, when the payload only carries the old signed per-account nets. */
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
} | null | undefined): DisplayableAging {
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
