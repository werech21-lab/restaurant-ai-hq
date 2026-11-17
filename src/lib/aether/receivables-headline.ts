/**
 * Pure selectors for the Open Unreconciled Receivables KPI card.
 *
 * Separates non-negative `openDebitsKwd` (what platforms and customers actually owe)
 * from `unappliedCreditsKwd` (<= 0 unmatched payouts & POS clearing credits) and signed
 * `netKwd` (debits + credits), while preserving `openReceivableKwd` semantics everywhere else.
 */

export interface ReceivablesHeadlineInput {
  unavailable?: boolean
  readable?: boolean
  openDebitsKwd?: number | null
  unappliedCreditsKwd?: number | null
  openReceivableKwd?: number | null
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

function cleanIsoDate(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function selectReceivablesHeadline(
  receivables: ReceivablesHeadlineInput | null | undefined,
): ReceivablesHeadline {
  if (!receivables || receivables.unavailable === true || receivables.readable === false) {
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

  const netKwd =
    typeof receivables.openReceivableKwd === 'number' &&
    Number.isFinite(receivables.openReceivableKwd)
      ? round3(receivables.openReceivableKwd)
      : openDebitsKwd !== null && unappliedCreditsKwd !== null
        ? round3(openDebitsKwd + unappliedCreditsKwd)
        : null

  const rawLines =
    receivables.unreconciledLineCount ?? receivables.openLinesCount ?? receivables.lines
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
