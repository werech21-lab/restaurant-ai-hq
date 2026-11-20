/**
 * Pure selectors for the Net Open Receivables KPI card.
 *
 * Resolves verified Odoo net open receivables (`netKwd` = `SUM(amount_residual)` across
 * posted unreconciled customer/platform receivable accounts, excluding POS cashier clearing
 * strictly by explicit verified Odoo `POS_CLEARING_ACCOUNT_ID = 35`), alongside optional
 * gross `openDebitsKwd` and `unappliedCreditsKwd` diagnostics.
 *
 * When `byAccount` rows are present without verified positive integer Odoo `accountId`s,
 * fails closed (`null` headline fields) and emits a structured warning instead of guessing
 * by account code or account name.
 */

import { logger } from '@/lib/logger'
import { POS_CLEARING_ACCOUNT_ID } from '@/lib/odoo/receivable-domain'

export interface ReceivablesHeadlineAccountItem {
  accountId?: number | null
  accountCode?: string
  accountName?: string
  labelAr?: string
  labelEn?: string
  residualKwd: number
  linesCount?: number
}

export interface ReceivablesHeadlineInput {
  unavailable?: boolean
  readable?: boolean
  maturityStatusEn?: string | null
  openDebitsKwd?: number | null
  unappliedCreditsKwd?: number | null
  openReceivableKwd?: number | null
  platformNetKwd?: number | null
  platformAndCorporateLinesCount?: number | null
  byAccount?: readonly ReceivablesHeadlineAccountItem[]
  figures?: {
    netKwd?: number | null
    openDebitsKwd?: number | null
    unappliedCreditsKwd?: number | null
  } | null
  unreconciledLineCount?: number | null
  openLinesCount?: number | null
  lines?: number | null
}

export interface ReceivablesHeadline {
  openDebitsKwd: number | null
  unappliedCreditsKwd: number | null
  netKwd: number | null
  lines: number | null
}

export interface ReceivablesWindowSource {
  unavailable?: boolean
  readable?: boolean
  fromDate?: string | null
  toDate?: string | null
}

function normalizeZero(n: number): number {
  return Object.is(n, -0) ? 0 : n
}

function round3(n: number): number {
  return normalizeZero(Math.round(n * 1000) / 1000)
}

function finiteRounded(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? round3(value) : null
}

function cleanIsoDate(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isVerifiedOdooAccountId(accountId: number | null | undefined): accountId is number {
  return typeof accountId === 'number' && Number.isInteger(accountId) && accountId > 0
}

export function selectReceivablesHeadline(
  receivables: ReceivablesHeadlineInput | null | undefined,
): ReceivablesHeadline {
  if (
    !receivables ||
    receivables.unavailable === true ||
    receivables.readable === false ||
    receivables.maturityStatusEn === 'No Odoo receivable data for this period'
  ) {
    return {
      openDebitsKwd: null,
      unappliedCreditsKwd: null,
      netKwd: null,
      lines: null,
    }
  }

  const accountRows = receivables.byAccount ?? []
  if (accountRows.length > 0) {
    const unverifiedRowCount = accountRows.filter(
      (row) => !isVerifiedOdooAccountId(row.accountId),
    ).length
    if (unverifiedRowCount > 0) {
      logger.warn('receivables_headline_fail_closed_unverified_account_id', {
        totalAccountRows: accountRows.length,
        unverifiedRowCount,
      })
      return {
        openDebitsKwd: null,
        unappliedCreditsKwd: null,
        netKwd: null,
        lines: null,
      }
    }
  }

  const openDebitsKwd =
    typeof receivables.openDebitsKwd === 'number' && Number.isFinite(receivables.openDebitsKwd)
      ? round3(Math.max(0, receivables.openDebitsKwd))
      : null

  const unappliedCreditsKwd =
    typeof receivables.unappliedCreditsKwd === 'number' &&
    Number.isFinite(receivables.unappliedCreditsKwd)
      ? round3(-Math.abs(receivables.unappliedCreditsKwd))
      : null

  const hasPosClearing = accountRows.some((row) => row.accountId === POS_CLEARING_ACCOUNT_ID)
  const customerAccountRows = accountRows.filter((row) => row.accountId !== POS_CLEARING_ACCOUNT_ID)
  const customerAccountSum = round3(
    customerAccountRows.reduce((sum, row) => sum + (Number(row.residualKwd) || 0), 0),
  )

  let netKwd: number | null
  if (hasPosClearing) {
    netKwd = customerAccountSum
  } else {
    netKwd =
      finiteRounded(receivables.openReceivableKwd) ??
      (accountRows.length > 0 ? customerAccountSum : null) ??
      finiteRounded(receivables.figures?.netKwd) ??
      finiteRounded(receivables.platformNetKwd) ??
      (openDebitsKwd !== null && unappliedCreditsKwd !== null
        ? round3(openDebitsKwd + unappliedCreditsKwd)
        : null)
  }

  const customerLinesFromAccounts =
    customerAccountRows.length > 0 &&
    customerAccountRows.every(
      (row) => typeof row.linesCount === 'number' && Number.isFinite(row.linesCount),
    )
      ? customerAccountRows.reduce((sum, row) => sum + (row.linesCount ?? 0), 0)
      : accountRows.length > 0 &&
          hasPosClearing &&
          customerAccountRows.length === 0 &&
          accountRows.every(
            (row) => typeof row.linesCount === 'number' && Number.isFinite(row.linesCount),
          )
        ? 0
        : null

  const rawLines = hasPosClearing
    ? typeof receivables.platformAndCorporateLinesCount === 'number' &&
      receivables.platformAndCorporateLinesCount > 0
      ? receivables.platformAndCorporateLinesCount
      : (customerLinesFromAccounts ??
        receivables.unreconciledLineCount ??
        receivables.openLinesCount ??
        receivables.lines)
    : (receivables.unreconciledLineCount ??
      receivables.openLinesCount ??
      receivables.lines ??
      customerLinesFromAccounts)
  const lines =
    typeof rawLines === 'number' && Number.isFinite(rawLines)
      ? Math.max(0, Math.round(rawLines))
      : null

  return {
    openDebitsKwd,
    unappliedCreditsKwd,
    netKwd,
    lines,
  }
}

/**
 * Resolves the provenance date window for open receivables.
 * When `fromDate` (min unreconciled line date) or `toDate` is unknown (`null`),
 * returns `'—'` instead of fabricating a fallback date.
 */
export function resolveReceivablesDateRange(
  workspaceReceivables: ReceivablesWindowSource | null | undefined,
  rawReceivables?: ReceivablesWindowSource | null,
): { from: string; to: string } | '—' {
  if (
    !workspaceReceivables ||
    workspaceReceivables.unavailable === true ||
    rawReceivables?.readable === false
  ) {
    return '—'
  }

  const fromDate =
    rawReceivables !== undefined && rawReceivables !== null
      ? cleanIsoDate(rawReceivables.fromDate)
      : cleanIsoDate(workspaceReceivables.fromDate)
  const toDate =
    rawReceivables !== undefined && rawReceivables !== null
      ? (cleanIsoDate(rawReceivables.toDate) ?? cleanIsoDate(workspaceReceivables.toDate))
      : cleanIsoDate(workspaceReceivables.toDate)

  if (!fromDate || !toDate) {
    return '—'
  }

  return { from: fromDate, to: toDate }
}
