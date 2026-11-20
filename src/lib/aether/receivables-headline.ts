/**
 * Pure selectors for the Net Open Receivables KPI card.
 *
 * Resolves verified Odoo net open receivables (`netKwd` = `SUM(amount_residual)` across
 * posted unreconciled customer/platform receivable accounts, excluding cashier clearing 10552),
 * alongside optional gross `openDebitsKwd` and `unappliedCreditsKwd` diagnostics.
 */

import { isPosClearingAccount } from '@/lib/odoo/live-sync-core'

export interface ReceivablesHeadlineAccountItem {
  accountCode?: string
  accountName?: string
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

  const openDebitsKwd =
    typeof receivables.openDebitsKwd === 'number' && Number.isFinite(receivables.openDebitsKwd)
      ? round3(Math.max(0, receivables.openDebitsKwd))
      : null

  const unappliedCreditsKwd =
    typeof receivables.unappliedCreditsKwd === 'number' &&
    Number.isFinite(receivables.unappliedCreditsKwd)
      ? round3(-Math.abs(receivables.unappliedCreditsKwd))
      : null

  const accountRows = receivables.byAccount ?? []
  const hasPosClearing10552 = accountRows.some((row) =>
    isPosClearingAccount(`${row.accountCode ?? ''} ${row.accountName ?? ''} ${row.labelEn ?? ''}`),
  )

  let netKwd: number | null
  if (hasPosClearing10552) {
    const customerAccountSum = round3(
      accountRows
        .filter(
          (row) =>
            !isPosClearingAccount(
              `${row.accountCode ?? ''} ${row.accountName ?? ''} ${row.labelEn ?? ''}`,
            ),
        )
        .reduce((sum, row) => sum + (Number(row.residualKwd) || 0), 0),
    )
    netKwd =
      finiteRounded(receivables.figures?.netKwd) ??
      finiteRounded(receivables.platformNetKwd) ??
      customerAccountSum
  } else {
    netKwd =
      finiteRounded(receivables.openReceivableKwd) ??
      finiteRounded(receivables.figures?.netKwd) ??
      finiteRounded(receivables.platformNetKwd) ??
      (openDebitsKwd !== null && unappliedCreditsKwd !== null
        ? round3(openDebitsKwd + unappliedCreditsKwd)
        : null)
  }

  const rawLines =
    hasPosClearing10552 &&
    typeof receivables.platformAndCorporateLinesCount === 'number' &&
    receivables.platformAndCorporateLinesCount > 0
      ? receivables.platformAndCorporateLinesCount
      : (receivables.unreconciledLineCount ?? receivables.openLinesCount ?? receivables.lines)
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
