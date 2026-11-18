import 'server-only'

import { logger } from '@/lib/logger'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import type {
  GlBalanceSheetSummary,
  GlStatementAccountLine,
  GlTrialBalanceRow,
  GlTrialBalanceSummary,
  OdooAnalyticBranchPnlRow,
  OdooAnalyticBranchPnlSummary,
  OdooBudgetLineRow,
  OdooBudgetProbeSummary,
  OdooPartnerAgingRow,
  OdooUnavailableSectionKey,
} from '@/lib/odoo/live-sync-core'
import {
  AR_AGING_BUCKETS,
  summarizeArAging,
  type AgingGroupTotal,
  type ArAgingBucketKey,
} from '@/lib/odoo/receivable-aging'

export const PNL_GL_ACCOUNT_TYPES = [
  'income',
  'income_other',
  'expense_direct_cost',
  'expense',
  'expense_depreciation',
] as const

export const ASSET_GL_ACCOUNT_TYPES = [
  'asset_receivable',
  'asset_cash',
  'asset_current',
  'asset_non_current',
  'asset_prepayments',
  'asset_fixed',
] as const

export const LIABILITY_GL_ACCOUNT_TYPES = [
  'liability_payable',
  'liability_credit_card',
  'liability_current',
  'liability_non_current',
] as const

export const EQUITY_GL_ACCOUNT_TYPES = ['equity', 'equity_unaffected'] as const

export const BALANCE_SHEET_GL_ACCOUNT_TYPES = [
  ...ASSET_GL_ACCOUNT_TYPES,
  ...LIABILITY_GL_ACCOUNT_TYPES,
  ...EQUITY_GL_ACCOUNT_TYPES,
] as const

export const ALL_GL_ACCOUNT_TYPES = [
  ...PNL_GL_ACCOUNT_TYPES,
  ...BALANCE_SHEET_GL_ACCOUNT_TYPES,
] as const

const PNL_TYPE_SET = new Set<string>(PNL_GL_ACCOUNT_TYPES)
const ASSET_TYPE_SET = new Set<string>(ASSET_GL_ACCOUNT_TYPES)
const LIABILITY_TYPE_SET = new Set<string>(LIABILITY_GL_ACCOUNT_TYPES)
const EQUITY_TYPE_SET = new Set<string>(EQUITY_GL_ACCOUNT_TYPES)

const KWD_TIE_TOLERANCE = 0.001
const r3 = (n: number): number => Math.round((Number(n) || 0) * 1000) / 1000

export type OdooM2O = [number, string] | false | null | undefined

export interface GlAccountMeta {
  id: number
  code: string
  name: string
  account_type: string
}

export interface GlMoveLineGroupRow {
  account_id: OdooM2O
  debit?: number
  credit?: number
  balance?: number
  __count?: number
}

export interface PartnerAgingGroupRow {
  partner_id?: OdooM2O
  partnerId?: number | null
  partnerName?: string
  amount_residual?: number
  residualKwd?: number
  __count?: number
  linesCount?: number
}

export type OdooExecuteFn = <T = unknown>(
  model: string,
  method: string,
  args?: unknown[],
  kwargs?: Record<string, unknown>,
  options?: { timeoutMs?: number },
) => Promise<T>

export type GlSafeSubQueryFn = <T>(
  fn: () => Promise<T>,
  fallback: T,
  onFailure?: { collector: Set<OdooUnavailableSectionKey>; section: OdooUnavailableSectionKey },
) => Promise<T>

export interface GlOdooReadContext {
  executeOdoo: OdooExecuteFn
  safeSubQuery?: GlSafeSubQueryFn
  markUnavailable?: (section: OdooUnavailableSectionKey) => void
  companyDomain?: readonly unknown[][]
  isDecommissionedAccount?: (rawText?: string | null) => boolean
}

const m2oId = (v: unknown): number | null =>
  Array.isArray(v) && typeof v[0] === 'number' ? v[0] : null

const m2oName = (v: unknown): string | null =>
  Array.isArray(v) && typeof v[1] === 'string' ? v[1] : null

function defaultExcludeAccount(acc: GlAccountMeta): boolean {
  return isExcludedOdooEntity(`${acc.code ?? ''} ${acc.name ?? ''}`.trim())
}

function toAccountMap(
  accounts: ReadonlyMap<number, GlAccountMeta> | readonly GlAccountMeta[],
): ReadonlyMap<number, GlAccountMeta> {
  if (accounts instanceof Map) return accounts
  return new Map((accounts as readonly GlAccountMeta[]).map((a) => [a.id, a]))
}

function compareAccountCodes(a: { code: string }, b: { code: string }): number {
  return a.code.localeCompare(b.code, undefined, { numeric: true })
}

export interface BuildGlTrialBalanceParams {
  fromIso: string
  toInclusiveIso: string
  accountById: ReadonlyMap<number, GlAccountMeta>
  rows: readonly GlMoveLineGroupRow[]
  /** Predicate returning `true` if the account is excluded/decommissioned and must be omitted. */
  filterExcludedAccount?: (account: GlAccountMeta) => boolean
}

/**
 * Builds a posted General Ledger Trial Balance from `account.move.line.read_group` rows.
 */
export function buildGlTrialBalanceFromGroups(
  params: BuildGlTrialBalanceParams,
): GlTrialBalanceSummary {
  const { fromIso, toInclusiveIso, accountById, rows, filterExcludedAccount } = params
  const isExcluded = filterExcludedAccount ?? defaultExcludeAccount

  const byAcc = new Map<
    number,
    { account: GlAccountMeta; debit: number; credit: number; balance: number; lineCount: number }
  >()

  for (const r of rows) {
    const accId = m2oId(r.account_id)
    if (accId === null) continue
    const acc = accountById.get(accId)
    if (!acc || isExcluded(acc)) continue

    const debit = Number(r.debit) || 0
    const credit = Number(r.credit) || 0
    const balance = r.balance !== undefined ? Number(r.balance) || 0 : debit - credit
    const lineCount = Math.max(0, Math.round(Number(r.__count) || 0))

    const prev = byAcc.get(accId) ?? {
      account: acc,
      debit: 0,
      credit: 0,
      balance: 0,
      lineCount: 0,
    }
    prev.debit += debit
    prev.credit += credit
    prev.balance += balance
    prev.lineCount += lineCount
    byAcc.set(accId, prev)
  }

  let rawTotalDebit = 0
  let rawTotalCredit = 0
  let rawTotalBalance = 0
  let totalLines = 0
  const outRows: GlTrialBalanceRow[] = []

  for (const entry of byAcc.values()) {
    const debitKwd = r3(entry.debit)
    const creditKwd = r3(entry.credit)
    const balanceKwd = r3(entry.balance)
    if (debitKwd === 0 && creditKwd === 0 && balanceKwd === 0 && entry.lineCount === 0) continue

    rawTotalDebit += entry.debit
    rawTotalCredit += entry.credit
    rawTotalBalance += entry.balance
    totalLines += entry.lineCount

    outRows.push({
      accountId: entry.account.id,
      code: entry.account.code,
      name: entry.account.name,
      accountType: entry.account.account_type,
      debitKwd,
      creditKwd,
      balanceKwd,
      lineCount: entry.lineCount,
    })
  }

  outRows.sort(compareAccountCodes)

  const totalDebitKwd = r3(rawTotalDebit)
  const totalCreditKwd = r3(rawTotalCredit)
  const totalBalanceKwd = r3(rawTotalBalance)
  const differenceKwd = r3(rawTotalDebit - rawTotalCredit)
  const balanced = Math.abs(differenceKwd) <= KWD_TIE_TOLERANCE

  return {
    readable: true,
    from: fromIso,
    to: toInclusiveIso,
    totalDebitKwd,
    totalCreditKwd,
    totalBalanceKwd,
    balanced,
    differenceKwd,
    accountsCount: outRows.length,
    linesCount: totalLines,
    rows: outRows,
  }
}

export interface BuildGlBalanceSheetParams {
  asOfIso: string
  fiscalYearStartIso?: string
  balanceAccounts: ReadonlyMap<number, GlAccountMeta> | readonly GlAccountMeta[]
  balanceRows: readonly GlMoveLineGroupRow[]
  ytdPnlAccountById: ReadonlyMap<number, GlAccountMeta>
  ytdPnlRows: readonly GlMoveLineGroupRow[]
  /** Optional pre-fiscal-year P&L rows when prior fiscal years are not closed to retained earnings. */
  priorPnlRows?: readonly GlMoveLineGroupRow[]
  /** Predicate returning `true` if the account is excluded/decommissioned and must be omitted. */
  filterExcludedAccount?: (account: GlAccountMeta) => boolean
}

function sumPnlRows(
  rows: readonly GlMoveLineGroupRow[],
  accountById: ReadonlyMap<number, GlAccountMeta>,
  isExcluded: (account: GlAccountMeta) => boolean,
): number {
  let sum = 0
  for (const r of rows) {
    const accId = m2oId(r.account_id)
    if (accId === null) continue
    const acc = accountById.get(accId)
    if (!acc || isExcluded(acc) || !PNL_TYPE_SET.has(acc.account_type)) continue
    sum += Number(r.balance) || 0
  }
  return sum
}

/**
 * Builds an as-of Balance Sheet from cumulative BS `read_group` rows plus YTD P&L rows.
 * Current-year earnings = `-Σ(YTD P&L balances)` so `Assets = Liabilities + Equity`.
 */
export function buildGlBalanceSheetFromGroups(
  params: BuildGlBalanceSheetParams,
): GlBalanceSheetSummary {
  const {
    asOfIso,
    fiscalYearStartIso,
    balanceAccounts,
    balanceRows,
    ytdPnlAccountById,
    ytdPnlRows,
    priorPnlRows,
    filterExcludedAccount,
  } = params
  const isExcluded = filterExcludedAccount ?? defaultExcludeAccount
  const balanceAccMap = toAccountMap(balanceAccounts)
  const fiscalYearStart = fiscalYearStartIso ?? `${asOfIso.slice(0, 4)}-01-01`

  const grouped = new Map<
    number,
    { account: GlAccountMeta; debit: number; credit: number; balance: number; lineCount: number }
  >()
  for (const r of balanceRows) {
    const accId = m2oId(r.account_id)
    if (accId === null) continue
    const acc = balanceAccMap.get(accId)
    if (!acc || isExcluded(acc)) continue

    const debit = Number(r.debit) || 0
    const credit = Number(r.credit) || 0
    const balance = r.balance !== undefined ? Number(r.balance) || 0 : debit - credit
    const lineCount = Math.max(0, Math.round(Number(r.__count) || 0))

    const prev = grouped.get(accId) ?? {
      account: acc,
      debit: 0,
      credit: 0,
      balance: 0,
      lineCount: 0,
    }
    prev.debit += debit
    prev.credit += credit
    prev.balance += balance
    prev.lineCount += lineCount
    grouped.set(accId, prev)
  }

  let assetsRaw = 0
  let liabilitiesRaw = 0
  let equityAccountsRaw = 0
  const assetsAccounts: GlStatementAccountLine[] = []
  const liabilitiesAccounts: GlStatementAccountLine[] = []
  const equityAccounts: GlStatementAccountLine[] = []

  for (const entry of grouped.values()) {
    const { account, debit, credit, balance, lineCount } = entry
    const t = account.account_type
    if (ASSET_TYPE_SET.has(t)) {
      assetsRaw += balance
      const amountKwd = r3(balance)
      if (amountKwd !== 0) {
        assetsAccounts.push({
          accountId: account.id,
          code: account.code,
          name: account.name,
          accountType: t,
          amountKwd,
          debitKwd: r3(debit),
          creditKwd: r3(credit),
          balanceKwd: r3(balance),
          lineCount,
        })
      }
    } else if (LIABILITY_TYPE_SET.has(t)) {
      liabilitiesRaw += -balance
      const amountKwd = r3(-balance)
      if (amountKwd !== 0) {
        liabilitiesAccounts.push({
          accountId: account.id,
          code: account.code,
          name: account.name,
          accountType: t,
          amountKwd,
          debitKwd: r3(debit),
          creditKwd: r3(credit),
          balanceKwd: r3(balance),
          lineCount,
        })
      }
    } else if (EQUITY_TYPE_SET.has(t)) {
      equityAccountsRaw += -balance
      const amountKwd = r3(-balance)
      if (amountKwd !== 0) {
        equityAccounts.push({
          accountId: account.id,
          code: account.code,
          name: account.name,
          accountType: t,
          amountKwd,
          debitKwd: r3(debit),
          creditKwd: r3(credit),
          balanceKwd: r3(balance),
          lineCount,
        })
      }
    }
  }

  assetsAccounts.sort(compareAccountCodes)
  liabilitiesAccounts.sort(compareAccountCodes)
  equityAccounts.sort(compareAccountCodes)

  const ytdPnlRaw = sumPnlRows(ytdPnlRows, ytdPnlAccountById, isExcluded)
  const currentYearEarningsRaw = -ytdPnlRaw
  const priorPnlRaw = priorPnlRows
    ? sumPnlRows(priorPnlRows, ytdPnlAccountById, isExcluded)
    : 0
  const priorYearsEarningsRaw = -priorPnlRaw

  const assetsTotalKwd = r3(assetsRaw)
  const liabilitiesTotalKwd = r3(liabilitiesRaw)
  const equityAccountsTotalKwd = r3(equityAccountsRaw)
  const currentYearEarningsKwd = r3(currentYearEarningsRaw)
  const priorYearsEarningsKwd = r3(priorYearsEarningsRaw)
  const equityTotalKwd = r3(equityAccountsRaw + priorYearsEarningsRaw + currentYearEarningsRaw)
  const liabilitiesAndEquityTotalKwd = r3(liabilitiesRaw + equityAccountsRaw + priorYearsEarningsRaw + currentYearEarningsRaw)
  const differenceKwd = r3(assetsTotalKwd - liabilitiesAndEquityTotalKwd)
  const equationBalanced = Math.abs(differenceKwd) <= KWD_TIE_TOLERANCE

  return {
    readable: true,
    asOfDate: asOfIso,
    fiscalYearStart,
    currentYearEarningsKwd,
    ...(priorPnlRows !== undefined ? { priorYearsEarningsKwd } : {}),
    assetsTotalKwd,
    liabilitiesTotalKwd,
    equityAccountsTotalKwd,
    equityTotalKwd,
    liabilitiesAndEquityTotalKwd,
    equationBalanced,
    differenceKwd,
    assetsAccounts,
    liabilitiesAccounts,
    equityAccounts,
  }
}

export interface BuildPartnerAgingParams {
  debitsByBucketPartner: Partial<Record<ArAgingBucketKey, readonly PartnerAgingGroupRow[]>>
  creditsByPartner: readonly PartnerAgingGroupRow[]
  isExcludedPartnerName?: (name: string) => boolean
}

function resolvePartnerIdentity(row: PartnerAgingGroupRow): {
  key: string
  partnerId: number | null
  partnerName: string
} {
  if (row.partner_id !== undefined) {
    const pid = m2oId(row.partner_id)
    const pname = (m2oName(row.partner_id) ?? '').trim() || 'Unassigned'
    return { key: pid !== null ? `id:${pid}` : 'none', partnerId: pid, partnerName: pname }
  }
  const pid = row.partnerId ?? null
  const pname = (row.partnerName ?? '').trim() || 'Unassigned'
  return { key: pid !== null ? `id:${pid}` : 'none', partnerId: pid, partnerName: pname }
}

/**
 * Builds per-partner due-date aging rows reusing `AR_AGING_BUCKETS` and `summarizeArAging`.
 * For AP (`liability_payable`), callers pass negated payable credits as `debitsByBucketPartner`
 * and negated unapplied vendor debits as `creditsByPartner`.
 */
export function buildPartnerAgingRows(params: BuildPartnerAgingParams): OdooPartnerAgingRow[] {
  const { debitsByBucketPartner, creditsByPartner, isExcludedPartnerName } = params
  const isExcluded = isExcludedPartnerName ?? isExcludedOdooEntity

  type Acc = {
    partnerId: number | null
    partnerName: string
    debitsByBucket: Partial<Record<ArAgingBucketKey, AgingGroupTotal>>
    credits: AgingGroupTotal
  }
  const partners = new Map<string, Acc>()

  const getOrCreate = (row: PartnerAgingGroupRow): Acc | null => {
    const ident = resolvePartnerIdentity(row)
    if (ident.partnerId !== null && isExcluded(ident.partnerName)) return null
    let acc = partners.get(ident.key)
    if (!acc) {
      acc = {
        partnerId: ident.partnerId,
        partnerName: ident.partnerName,
        debitsByBucket: {},
        credits: { residualKwd: 0, linesCount: 0 },
      }
      partners.set(ident.key, acc)
    }
    return acc
  }

  for (const bucketDef of AR_AGING_BUCKETS) {
    const rows = debitsByBucketPartner[bucketDef.key] ?? []
    for (const row of rows) {
      const acc = getOrCreate(row)
      if (!acc) continue
      const val = Number(row.residualKwd ?? row.amount_residual ?? 0) || 0
      const cnt = Math.max(0, Math.round(Number(row.linesCount ?? row.__count ?? 0)))
      const cur = acc.debitsByBucket[bucketDef.key] ?? { residualKwd: 0, linesCount: 0 }
      cur.residualKwd += val
      cur.linesCount += cnt
      acc.debitsByBucket[bucketDef.key] = cur
    }
  }

  for (const row of creditsByPartner) {
    const acc = getOrCreate(row)
    if (!acc) continue
    const val = Number(row.residualKwd ?? row.amount_residual ?? 0) || 0
    const cnt = Math.max(0, Math.round(Number(row.linesCount ?? row.__count ?? 0)))
    acc.credits.residualKwd += val
    acc.credits.linesCount += cnt
  }

  const out: OdooPartnerAgingRow[] = []
  for (const acc of partners.values()) {
    const summarized = summarizeArAging({
      debitsByBucket: acc.debitsByBucket,
      credits: acc.credits,
    })
    const linesCount =
      summarized.buckets.reduce((s, b) => s + b.linesCount, 0) +
      summarized.unappliedCreditLinesCount
    if (
      linesCount === 0 &&
      summarized.openDebitsKwd === 0 &&
      summarized.unappliedCreditsKwd === 0
    ) {
      continue
    }
    out.push({
      partnerId: acc.partnerId,
      partnerName: acc.partnerName,
      residualKwd: summarized.openReceivableKwd,
      openDebitsKwd: summarized.openDebitsKwd,
      unappliedCreditsKwd: summarized.unappliedCreditsKwd,
      linesCount,
      buckets: summarized.buckets,
    })
  }

  out.sort(
    (a, b) =>
      b.residualKwd - a.residualKwd ||
      b.openDebitsKwd - a.openDebitsKwd ||
      a.partnerName.localeCompare(b.partnerName),
  )
  return out
}

const FAILED_SENTINEL = Symbol('gl-section-read-failed')

async function runGlSection<R>(
  ctx: Pick<GlOdooReadContext, 'safeSubQuery' | 'markUnavailable'>,
  section: OdooUnavailableSectionKey,
  work: () => Promise<R>,
  onUnavailable: () => R,
): Promise<R> {
  let recorded = false
  const recordFailure = () => {
    if (recorded) return
    recorded = true
    ctx.markUnavailable?.(section)
    logger.warn('Odoo GL section read failed', { section })
  }

  const runner =
    ctx.safeSubQuery ??
    (async <T>(fn: () => Promise<T>, fallback: T) => {
      try {
        return await fn()
      } catch {
        return fallback
      }
    })

  const result = await runner<R | typeof FAILED_SENTINEL>(async () => {
    try {
      return await work()
    } catch {
      recordFailure()
      return FAILED_SENTINEL
    }
  }, FAILED_SENTINEL)

  if (result === FAILED_SENTINEL) {
    recordFailure()
    return onUnavailable()
  }
  return result
}

function isMissingModelError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /doesn't exist|does not exist|Object .* doesn't exist|KeyError/i.test(msg)
}

function isAccessDeniedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /AccessError|access right|not allowed to access|AccessDenied|record rules/i.test(msg)
}

function filterAccountMap(
  accounts: ReadonlyMap<number, GlAccountMeta>,
  isDecommissioned: (rawText?: string | null) => boolean,
): Map<number, GlAccountMeta> {
  const active = new Map<number, GlAccountMeta>()
  for (const [id, acc] of accounts.entries()) {
    const label = `${acc.code ?? ''} ${acc.name ?? ''}`.trim()
    if (isDecommissioned(label)) continue
    active.set(id, acc)
  }
  return active
}

export interface FetchGlTrialBalanceParams extends GlOdooReadContext {
  fromIso: string
  toInclusiveIso: string
  accountById?: ReadonlyMap<number, GlAccountMeta>
}

/**
 * Fetches and builds a posted Trial Balance across all active GL accounts for `[fromIso, toInclusiveIso]`.
 */
export async function fetchGlTrialBalance(
  params: FetchGlTrialBalanceParams,
): Promise<GlTrialBalanceSummary> {
  const {
    fromIso,
    toInclusiveIso,
    accountById,
    executeOdoo,
    safeSubQuery,
    markUnavailable,
    companyDomain = [],
    isDecommissionedAccount,
  } = params
  const isDecommissioned = isDecommissionedAccount ?? isExcludedOdooEntity

  return runGlSection(
    { safeSubQuery, markUnavailable },
    'gl.trialBalance',
    async () => {
      let sourceAccounts = accountById
      if (sourceAccounts === undefined) {
        const fetched = await executeOdoo<GlAccountMeta[]>(
          'account.account',
          'search_read',
          [[['account_type', 'in', [...ALL_GL_ACCOUNT_TYPES]]]],
          { fields: ['id', 'code', 'name', 'account_type'] },
        )
        sourceAccounts = new Map(fetched.map((a) => [a.id, a]))
      }

      const activeMap = filterAccountMap(sourceAccounts, isDecommissioned)
      const activeIds = [...activeMap.keys()]
      if (activeIds.length === 0) {
        return buildGlTrialBalanceFromGroups({
          fromIso,
          toInclusiveIso,
          accountById: activeMap,
          rows: [],
        })
      }

      const rows = await executeOdoo<GlMoveLineGroupRow[]>(
        'account.move.line',
        'read_group',
        [
          [
            ...companyDomain,
            ['parent_state', '=', 'posted'],
            ['date', '>=', fromIso],
            ['date', '<=', toInclusiveIso],
            ['account_id', 'in', activeIds],
          ],
          ['debit:sum', 'credit:sum', 'balance:sum'],
          ['account_id'],
        ],
        { lazy: false },
      )

      return buildGlTrialBalanceFromGroups({
        fromIso,
        toInclusiveIso,
        accountById: activeMap,
        rows,
        filterExcludedAccount: (acc) =>
          isDecommissioned(`${acc.code ?? ''} ${acc.name ?? ''}`.trim()),
      })
    },
    () => ({
      readable: false,
      from: fromIso,
      to: toInclusiveIso,
      totalDebitKwd: 0,
      totalCreditKwd: 0,
      totalBalanceKwd: 0,
      balanced: false,
      differenceKwd: 0,
      accountsCount: 0,
      linesCount: 0,
      rows: [],
      reason: 'gl.trialBalance unavailable',
    }),
  )
}

export interface FetchGlBalanceSheetParams extends GlOdooReadContext {
  asOfIso: string
  fiscalYearStartIso?: string
  balanceAccounts?: ReadonlyMap<number, GlAccountMeta> | readonly GlAccountMeta[]
  ytdPnlAccountById?: ReadonlyMap<number, GlAccountMeta>
  /** When true, also queries `date < fiscalYearStart` P&L rows to compute unclosed prior-years earnings. */
  includePriorPnl?: boolean
}

/**
 * Fetches and builds an as-of Balance Sheet (`date <= asOfIso`) plus YTD P&L current-year earnings.
 */
export async function fetchGlBalanceSheet(
  params: FetchGlBalanceSheetParams,
): Promise<GlBalanceSheetSummary> {
  const {
    asOfIso,
    fiscalYearStartIso,
    balanceAccounts,
    ytdPnlAccountById,
    includePriorPnl = false,
    executeOdoo,
    safeSubQuery,
    markUnavailable,
    companyDomain = [],
    isDecommissionedAccount,
  } = params
  const isDecommissioned = isDecommissionedAccount ?? isExcludedOdooEntity
  const fiscalYearStart = fiscalYearStartIso ?? `${asOfIso.slice(0, 4)}-01-01`

  return runGlSection(
    { safeSubQuery, markUnavailable },
    'gl.balanceSheet',
    async () => {
      let rawBsMap = balanceAccounts !== undefined ? toAccountMap(balanceAccounts) : undefined
      let rawPnlMap = ytdPnlAccountById

      if (rawBsMap === undefined || rawPnlMap === undefined) {
        const fetched = await executeOdoo<GlAccountMeta[]>(
          'account.account',
          'search_read',
          [[['account_type', 'in', [...ALL_GL_ACCOUNT_TYPES]]]],
          { fields: ['id', 'code', 'name', 'account_type'] },
        )
        if (rawBsMap === undefined) {
          rawBsMap = new Map(
            fetched
              .filter(
                (a) =>
                  ASSET_TYPE_SET.has(a.account_type) ||
                  LIABILITY_TYPE_SET.has(a.account_type) ||
                  EQUITY_TYPE_SET.has(a.account_type),
              )
              .map((a) => [a.id, a]),
          )
        }
        if (rawPnlMap === undefined) {
          rawPnlMap = new Map(
            fetched.filter((a) => PNL_TYPE_SET.has(a.account_type)).map((a) => [a.id, a]),
          )
        }
      }

      const activeBsMap = filterAccountMap(rawBsMap, isDecommissioned)
      const activePnlMap = filterAccountMap(rawPnlMap, isDecommissioned)
      const activeBsIds = [...activeBsMap.keys()]
      const activePnlIds = [...activePnlMap.keys()]

      const [balanceRows, ytdPnlRows, priorPnlRows] = await Promise.all([
        activeBsIds.length > 0
          ? executeOdoo<GlMoveLineGroupRow[]>(
              'account.move.line',
              'read_group',
              [
                [
                  ...companyDomain,
                  ['parent_state', '=', 'posted'],
                  ['date', '<=', asOfIso],
                  ['account_id', 'in', activeBsIds],
                ],
                ['debit:sum', 'credit:sum', 'balance:sum'],
                ['account_id'],
              ],
              { lazy: false },
            )
          : Promise.resolve([]),
        activePnlIds.length > 0
          ? executeOdoo<GlMoveLineGroupRow[]>(
              'account.move.line',
              'read_group',
              [
                [
                  ...companyDomain,
                  ['parent_state', '=', 'posted'],
                  ['date', '>=', fiscalYearStart],
                  ['date', '<=', asOfIso],
                  ['account_id', 'in', activePnlIds],
                ],
                ['balance:sum'],
                ['account_id'],
              ],
              { lazy: false },
            )
          : Promise.resolve([]),
        includePriorPnl && activePnlIds.length > 0
          ? executeOdoo<GlMoveLineGroupRow[]>(
              'account.move.line',
              'read_group',
              [
                [
                  ...companyDomain,
                  ['parent_state', '=', 'posted'],
                  ['date', '<', fiscalYearStart],
                  ['account_id', 'in', activePnlIds],
                ],
                ['balance:sum'],
                ['account_id'],
              ],
              { lazy: false },
            )
          : Promise.resolve(undefined),
      ])

      return buildGlBalanceSheetFromGroups({
        asOfIso,
        fiscalYearStartIso: fiscalYearStart,
        balanceAccounts: activeBsMap,
        balanceRows,
        ytdPnlAccountById: activePnlMap,
        ytdPnlRows,
        ...(priorPnlRows !== undefined ? { priorPnlRows } : {}),
        filterExcludedAccount: (acc) =>
          isDecommissioned(`${acc.code ?? ''} ${acc.name ?? ''}`.trim()),
      })
    },
    () => ({
      readable: false,
      asOfDate: asOfIso,
      fiscalYearStart,
      currentYearEarningsKwd: 0,
      assetsTotalKwd: 0,
      liabilitiesTotalKwd: 0,
      equityAccountsTotalKwd: 0,
      equityTotalKwd: 0,
      liabilitiesAndEquityTotalKwd: 0,
      equationBalanced: false,
      differenceKwd: 0,
      assetsAccounts: [],
      liabilitiesAccounts: [],
      equityAccounts: [],
      reason: 'gl.balanceSheet unavailable',
    }),
  )
}

async function probeOdooModelPresenceAndRead(
  executeOdoo: OdooExecuteFn,
  modelName: string,
): Promise<{ modelPresent: boolean; readable: boolean; reason?: string }> {
  let modelPresent = false
  try {
    const modelRows = await executeOdoo<{ id: number; model: string }[]>(
      'ir.model',
      'search_read',
      [[['model', '=', modelName]]],
      { fields: ['id', 'model'], limit: 1 },
    )
    if (!modelRows || modelRows.length === 0) {
      return { modelPresent: false, readable: false, reason: `${modelName} model not installed` }
    }
    modelPresent = true
  } catch (err) {
    if (!isAccessDeniedError(err)) {
      throw err
    }
    // `ir.model` is restricted for non-system users; probe the target model directly.
  }

  try {
    const ok = await executeOdoo<boolean>(modelName, 'check_access_rights', ['read', false])
    if (ok === true) {
      return { modelPresent: true, readable: true }
    }
    return { modelPresent: true, readable: false, reason: `${modelName} read access denied` }
  } catch (err) {
    if (isMissingModelError(err)) {
      return { modelPresent: false, readable: false, reason: `${modelName} model not installed` }
    }
    if (isAccessDeniedError(err)) {
      return { modelPresent: true, readable: false, reason: `${modelName} read access denied` }
    }
    if (modelPresent) {
      throw err
    }
    throw err
  }
}

export interface ProbeCrossoveredBudgetParams extends GlOdooReadContext {
  fromIso: string
  toInclusiveIso: string
}

interface OdooBudgetLineRaw {
  planned_amount?: number
  practical_amount?: number
  general_budget_id?: OdooM2O
  analytic_account_id?: OdooM2O
  date_from?: string | false
  date_to?: string | false
}

/**
 * Probes Odoo `ir.model` for `crossovered.budget` and checks `read` rights before reading `crossovered.budget.lines`.
 */
export async function probeCrossoveredBudget(
  params: ProbeCrossoveredBudgetParams,
): Promise<OdooBudgetProbeSummary> {
  const {
    fromIso,
    toInclusiveIso,
    executeOdoo,
    safeSubQuery,
    markUnavailable,
    companyDomain = [],
    isDecommissionedAccount,
  } = params
  const isDecommissioned = isDecommissionedAccount ?? isExcludedOdooEntity

  return runGlSection(
    { safeSubQuery, markUnavailable },
    'gl.budget',
    async () => {
      const probe = await probeOdooModelPresenceAndRead(executeOdoo, 'crossovered.budget')
      if (!probe.modelPresent || !probe.readable) {
        return {
          probed: true,
          modelPresent: probe.modelPresent,
          readable: false,
          fiscalFrom: fromIso,
          fiscalTo: toInclusiveIso,
          lines: [],
          ...(probe.reason ? { reason: probe.reason } : {}),
        }
      }

      const rawLines = await executeOdoo<OdooBudgetLineRaw[]>(
        'crossovered.budget.lines',
        'search_read',
        [
          [
            ...companyDomain,
            ['date_from', '<=', toInclusiveIso],
            ['date_to', '>=', fromIso],
          ],
        ],
        {
          fields: [
            'planned_amount',
            'practical_amount',
            'general_budget_id',
            'analytic_account_id',
            'date_from',
            'date_to',
          ],
          limit: 500,
        },
      )

      const lines: OdooBudgetLineRow[] = []
      for (const line of rawLines) {
        const analyticName = m2oName(line.analytic_account_id)
        if (analyticName && isDecommissioned(analyticName)) continue
        const budgetName = m2oName(line.general_budget_id) ?? 'Budget'
        const plannedKwd = r3(Number(line.planned_amount) || 0)
        const practicalKwd = r3(Number(line.practical_amount) || 0)
        lines.push({
          budgetName,
          analyticName,
          plannedKwd,
          practicalKwd,
          varianceKwd: r3(practicalKwd - plannedKwd),
          dateFrom: typeof line.date_from === 'string' ? line.date_from : fromIso,
          dateTo: typeof line.date_to === 'string' ? line.date_to : toInclusiveIso,
        })
      }

      return {
        probed: true,
        modelPresent: true,
        readable: true,
        fiscalFrom: fromIso,
        fiscalTo: toInclusiveIso,
        lines,
      }
    },
    () => ({
      probed: true,
      modelPresent: false,
      readable: false,
      fiscalFrom: fromIso,
      fiscalTo: toInclusiveIso,
      lines: [],
      reason: 'gl.budget unavailable',
    }),
  )
}

export interface FetchGlAnalyticBreakdownParams extends GlOdooReadContext {
  fromIso: string
  toInclusiveIso: string
  /** Optional total posted P&L net (`-Σ balance`, positive = profit) for unallocated computation. */
  totalPnlNetKwd?: number
  /** Optional total posted P&L absolute base for share percentage denominator. */
  totalPnlAbsKwd?: number
  excludedAnalyticIds?: readonly number[]
}

interface OdooAnalyticGroupRaw {
  account_id: OdooM2O
  amount?: number
  __count?: number
}

/**
 * Checks `account.analytic.line` availability/read rights and summarizes branch analytic P&L vs total P&L.
 */
export async function fetchGlAnalyticBreakdown(
  params: FetchGlAnalyticBreakdownParams,
): Promise<OdooAnalyticBranchPnlSummary> {
  const {
    fromIso,
    toInclusiveIso,
    totalPnlNetKwd,
    totalPnlAbsKwd,
    excludedAnalyticIds = [],
    executeOdoo,
    safeSubQuery,
    markUnavailable,
    companyDomain = [],
    isDecommissionedAccount,
  } = params
  const isDecommissioned = isDecommissionedAccount ?? isExcludedOdooEntity
  const excludedSet = new Set(excludedAnalyticIds)

  return runGlSection(
    { safeSubQuery, markUnavailable },
    'gl.analytic',
    async () => {
      const probe = await probeOdooModelPresenceAndRead(executeOdoo, 'account.analytic.line')
      if (!probe.modelPresent || !probe.readable) {
        return {
          readable: false,
          populated: false,
          unallocatedKwd: 0,
          unallocatedSharePct: 0,
          branches: [],
          ...(probe.reason ? { reason: probe.reason } : {}),
        }
      }

      const analyticDomain: unknown[][] = [
        ...companyDomain,
        ['date', '>=', fromIso],
        ['date', '<=', toInclusiveIso],
      ]
      if (excludedSet.size > 0) {
        analyticDomain.push(['account_id', 'not in', [...excludedSet]])
      }

      const [analyticRows, pnlTotalRows] = await Promise.all([
        executeOdoo<OdooAnalyticGroupRaw[]>(
          'account.analytic.line',
          'read_group',
          [analyticDomain, ['amount:sum'], ['account_id']],
          { lazy: false },
        ),
        totalPnlNetKwd === undefined
          ? executeOdoo<{ balance?: number }[]>(
              'account.move.line',
              'read_group',
              [
                [
                  ...companyDomain,
                  ['parent_state', '=', 'posted'],
                  ['date', '>=', fromIso],
                  ['date', '<=', toInclusiveIso],
                  ['account_id.account_type', 'in', [...PNL_GL_ACCOUNT_TYPES]],
                ],
                ['balance:sum'],
                [],
              ],
              { lazy: false },
            )
          : Promise.resolve([]),
      ])

      const rawBranches: { analyticId?: number; analyticName: string; rawAmount: number }[] = []
      let allocatedRaw = 0
      for (const row of analyticRows) {
        const analyticId = m2oId(row.account_id)
        const analyticName = m2oName(row.account_id)
        if (analyticId === null || !analyticName) continue
        if (excludedSet.has(analyticId) || isDecommissioned(analyticName)) continue
        const rawAmount = Number(row.amount) || 0
        allocatedRaw += rawAmount
        rawBranches.push({ analyticId, analyticName, rawAmount })
      }

      const resolvedTotalPnlNet =
        totalPnlNetKwd !== undefined
          ? totalPnlNetKwd
          : -(Number(pnlTotalRows?.[0]?.balance) || 0)
      const unallocatedKwd = r3(resolvedTotalPnlNet - allocatedRaw)

      const branchAbsSum = rawBranches.reduce((s, b) => s + Math.abs(b.rawAmount), 0)
      const shareBase =
        totalPnlAbsKwd !== undefined && totalPnlAbsKwd > 0
          ? totalPnlAbsKwd
          : branchAbsSum + Math.abs(unallocatedKwd)

      const pct1 = (part: number): number =>
        shareBase > 0 ? Math.round((Math.abs(part) / shareBase) * 1000) / 10 : 0

      const branches: OdooAnalyticBranchPnlRow[] = rawBranches
        .map((b) => ({
          analyticId: b.analyticId,
          analyticName: b.analyticName,
          amountKwd: r3(b.rawAmount),
          sharePct: pct1(b.rawAmount),
        }))
        .sort((a, b) => Math.abs(b.amountKwd) - Math.abs(a.amountKwd))

      const populated = branches.some((b) => Math.abs(b.amountKwd) >= KWD_TIE_TOLERANCE)

      return {
        readable: true,
        populated,
        unallocatedKwd,
        unallocatedSharePct: pct1(unallocatedKwd),
        branches,
      }
    },
    () => ({
      readable: false,
      populated: false,
      unallocatedKwd: 0,
      unallocatedSharePct: 0,
      branches: [],
      reason: 'gl.analytic unavailable',
    }),
  )
}
