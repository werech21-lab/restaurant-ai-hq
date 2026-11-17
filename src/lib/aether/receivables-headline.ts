/**
 * Pure selectors and honesty guards for Open Unreconciled Receivables.
 *
 * When POS clearing account 10552 lines are unreconciled (`posClearingLinesCount > 0`),
 * net receivables are negative (`openReceivableKwd < 0`), or gross open debits are inflated
 * beyond 10x positive account residuals (`openDebitsKwd > 10 * grossPositiveReceivableKwd`),
 * the figures are NOT collectible receivables and must surface as unavailable under
 * accounting reconciliation.
 */

export const RECEIVABLES_RECONCILIATION_REASON_AR =
  'قيد المطابقة مع المحاسبة — غير متاح بعد'
export const RECEIVABLES_RECONCILIATION_REASON_EN =
  'Under reconciliation with accounting — not available yet'

export interface ReceivablesHonestyProbe {
  posClearingLinesCount?: number | null
  openReceivableKwd?: number | null
  openDebitsKwd?: number | null
  grossPositiveReceivableKwd?: number | null
}

export interface ReceivablesHeadlineInput extends ReceivablesHonestyProbe {
  unavailable?: boolean
  readable?: boolean
  unappliedCreditsKwd?: number | null
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

const NULL_RECEIVABLES_HEADLINE: ReceivablesHeadline = {
  openDebitsKwd: null,
  unappliedCreditsKwd: null,
  netKwd: null,
  lines: null,
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

export function isReceivablesUnderReconciliation(
  input: ReceivablesHonestyProbe | null | undefined,
): boolean {
  if (!input) return false
  if (
    typeof input.posClearingLinesCount === 'number' &&
    Number.isFinite(input.posClearingLinesCount) &&
    input.posClearingLinesCount > 0
  ) {
    return true
  }
  if (
    typeof input.openReceivableKwd === 'number' &&
    Number.isFinite(input.openReceivableKwd) &&
    input.openReceivableKwd < 0
  ) {
    return true
  }
  if (
    typeof input.openDebitsKwd === 'number' &&
    Number.isFinite(input.openDebitsKwd) &&
    typeof input.grossPositiveReceivableKwd === 'number' &&
    Number.isFinite(input.grossPositiveReceivableKwd) &&
    input.openDebitsKwd > 10 * Math.max(0, input.grossPositiveReceivableKwd)
  ) {
    return true
  }
  return false
}

export function selectReceivablesHeadline(
  receivables: ReceivablesHeadlineInput | null | undefined,
): ReceivablesHeadline {
  if (
    !receivables ||
    receivables.unavailable === true ||
    receivables.readable === false ||
    isReceivablesUnderReconciliation(receivables)
  ) {
    return { ...NULL_RECEIVABLES_HEADLINE }
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

  if (netKwd !== null && netKwd < 0) {
    return { ...NULL_RECEIVABLES_HEADLINE }
  }

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
