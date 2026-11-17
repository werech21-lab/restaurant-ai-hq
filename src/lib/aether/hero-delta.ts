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
