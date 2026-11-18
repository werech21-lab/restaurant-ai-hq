import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { kuwaitDayOf, shiftIso, toFils } from './helpers'

export interface DailyCell {
  netFils: number
  orders: number
}

export interface CompletedDaily {
  /** Completed Kuwait days, ascending (the day still in progress at sync time is left out). */
  days: string[]
  byDay: Record<string, Record<string, DailyCell>>
  branchIds: string[]
  syncAt: string | null
}

/**
 * Completed days of the payload's per-branch daily rows. A day is complete when the payload was
 * synced after it ended in Kuwait; the sync day itself is partial and is never compared.
 */
export function completedDailyByBranch(summary: OdooLiveSummary | null | undefined): CompletedDaily | null {
  const daily = summary?.dailyByBranch
  if (!summary || !daily || Object.keys(daily).length === 0) return null
  const syncAt = summary.lastSyncAt ?? summary.syncedAt ?? null
  const syncDay = kuwaitDayOf(syncAt)
  const days = Object.keys(daily)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && (!syncDay || d < syncDay))
    .sort()
  if (days.length === 0) return null
  const branchIds = new Set<string>()
  const byDay: CompletedDaily['byDay'] = {}
  for (const day of days) {
    byDay[day] = {}
    for (const [branch, cell] of Object.entries(daily[day] ?? {})) {
      branchIds.add(branch)
      byDay[day][branch] = { netFils: toFils(cell?.netKwd ?? 0), orders: Number(cell?.orders ?? 0) }
    }
  }
  return { days, byDay, branchIds: [...branchIds].sort(), syncAt }
}

export function sumWindow(
  d: CompletedDaily,
  from: string,
  to: string,
  branch?: string,
): DailyCell & { days: number } {
  let netFils = 0
  let orders = 0
  let days = 0
  for (const day of d.days) {
    if (day < from || day > to) continue
    days++
    for (const [b, cell] of Object.entries(d.byDay[day])) {
      if (branch && b !== branch) continue
      netFils += cell.netFils
      orders += cell.orders
    }
  }
  return { netFils, orders, days }
}

/** The last `n` completed days ending at the last completed day, and the `n` days before them. */
export function lastTwoWindows(d: CompletedDaily, n: number): { a: { from: string; to: string }; b: { from: string; to: string } } | null {
  if (d.days.length < 2 * n) return null
  const to = d.days[d.days.length - 1]
  const from = shiftIso(to, -(n - 1))
  const bTo = shiftIso(from, -1)
  const bFrom = shiftIso(bTo, -(n - 1))
  if (bFrom < d.days[0]) return null
  return { a: { from, to }, b: { from: bFrom, to: bTo } }
}
