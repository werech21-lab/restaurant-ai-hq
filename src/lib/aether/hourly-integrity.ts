/**
 * Phase 5 · Item 1 — hourly chart integrity.
 *
 * The hourly chart must be computed strictly from the selected period (the period cube), never
 * from the month-to-date summary series, and every hour that carries sales must be shown so that
 * `sum(hourlyBuckets) === selectedPeriodTotal` to the exact fils.
 */

export interface HourlyRow {
  hour: number
  orders: number
  netKwd: number
}

/** Business-day reading order: opening (09:00) through late night, then early-morning hours. */
export const HOURLY_DISPLAY_ORDER: readonly number[] = [
  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8,
]

/** Hours always drawn (even when zero) so the core trading day keeps a stable x-axis. */
const ALWAYS_SHOWN_HOURS = new Set([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1])

const toFils = (kwd: number): number => (Number.isFinite(kwd) ? Math.round(kwd * 1000) : 0)

/**
 * Hours to draw, in display order. Early-morning hours (02:00–08:59) appear whenever they carry
 * any orders or sales so they are never silently dropped from the total.
 */
export function selectDisplayHours(rows: readonly HourlyRow[]): number[] {
  const byHour = new Map<number, HourlyRow>()
  for (const r of rows) byHour.set(r.hour, r)
  return HOURLY_DISPLAY_ORDER.filter((hr) => {
    if (ALWAYS_SHOWN_HOURS.has(hr)) return true
    const row = byHour.get(hr)
    return Boolean(row && (toFils(row.netKwd) !== 0 || (row.orders ?? 0) !== 0))
  })
}

export interface HourlyReconciliation {
  hourlySumKwd: number
  periodTotalKwd: number | null
  varianceKwd: number | null
  /** True only when the period total is known and the hourly buckets match it to the fils. */
  reconciled: boolean
}

/** Integer-fils comparison of the hourly buckets against the selected period total. */
export function reconcileHourlyToPeriod(
  rows: readonly HourlyRow[],
  periodTotalKwd: number | null | undefined,
): HourlyReconciliation {
  const sumFils = rows.reduce((s, r) => s + toFils(r.netKwd), 0)
  const hourlySumKwd = sumFils / 1000
  if (typeof periodTotalKwd !== 'number' || !Number.isFinite(periodTotalKwd)) {
    return { hourlySumKwd, periodTotalKwd: null, varianceKwd: null, reconciled: false }
  }
  const totalFils = toFils(periodTotalKwd)
  const varianceFils = sumFils - totalFils
  return {
    hourlySumKwd,
    periodTotalKwd: totalFils / 1000,
    varianceKwd: varianceFils / 1000,
    reconciled: varianceFils === 0,
  }
}
