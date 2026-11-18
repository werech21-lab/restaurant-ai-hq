/**
 * The "vs prior period" badge on the Executive Dashboard headline.
 *
 * A badge is shown only for a real comparison. When there is none, it reads `—` with the
 * "no comparison" title instead of a fallback `±0.0%`.
 */
import { SCOPE_LABELS } from '@/lib/aether/brand-scope'
import {
  computePeriodOverPeriodDeltaPct,
  type GlobalFilters,
  type GlobalWorkspaceSlice,
} from '@/lib/aether/global-filter-engine'
import { computePeriodDelta } from '@/lib/aether/period-delta'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'

/** `computePeriodDelta` takes two levels; a % change p is the ratio (BASE + p) / BASE. */
const PERCENT_BASE = 100
export const NO_COMPARISON_BADGE = '—'

export interface HeroDeltaBadge {
  hasComparison: boolean
  badgeLabel: string
  tone: 'green' | 'red' | 'neutral'
  titleAr: string | null
  titleEn: string | null
}

export function resolveHeroDeltaBadge(
  filters: GlobalFilters,
  workspace: Pick<GlobalWorkspaceSlice, 'salesKwd' | 'isTodayFallback' | 'nullableSalesKwd'>,
  liveSummary: OdooLiveSummary | null | undefined,
): HeroDeltaBadge {
  const pct =
    workspace.nullableSalesKwd === null ? null : computePeriodOverPeriodDeltaPct(filters, workspace, liveSummary)
  if (pct === null) {
    return {
      hasComparison: false,
      badgeLabel: NO_COMPARISON_BADGE,
      tone: 'neutral',
      titleAr: SCOPE_LABELS.noComparison.ar,
      titleEn: SCOPE_LABELS.noComparison.en,
    }
  }
  const delta = computePeriodDelta(PERCENT_BASE + pct, PERCENT_BASE)
  return { hasComparison: true, badgeLabel: delta.badgeLabel, tone: delta.tone, titleAr: null, titleEn: null }
}

export interface TodaySameHoursComparison {
  /** Completed hours compared: [00:00, cutoffHour:00). */
  cutoffHour: number
  todayKwd: number
  yesterdayKwd: number
  pct: number
}

/**
 * Today so far vs yesterday over the same completed hours (Kuwait). Only the hours both days have
 * fully completed are compared, so a partial today is never set against a whole day. `null` when an
 * hourly series is unavailable, no hour is complete yet, or yesterday had no sales in that window.
 */
export function resolveTodaySameHoursComparison(
  todayHourly: readonly { hour: number; netKwd: number }[] | null | undefined,
  yesterdayHourly: readonly { hour: number; netKwd: number }[] | null | undefined,
  cutoffHour: number,
): TodaySameHoursComparison | null {
  if (!todayHourly?.length || !yesterdayHourly?.length || cutoffHour <= 0) return null
  const sum = (rows: readonly { hour: number; netKwd: number }[]) =>
    Math.round(rows.filter((r) => r.hour < cutoffHour).reduce((s, r) => s + (Number(r.netKwd) || 0), 0) * 1000) / 1000
  const todayKwd = sum(todayHourly)
  const yesterdayKwd = sum(yesterdayHourly)
  if (!(yesterdayKwd > 0)) return null
  return { cutoffHour, todayKwd, yesterdayKwd, pct: Math.round(((todayKwd - yesterdayKwd) / yesterdayKwd) * 1000) / 10 }
}
