import { describe, expect, it } from 'vitest'
import {
  computeGlobalWorkspace,
  computePeriodOverPeriodDeltaPct,
  DEFAULT_GLOBAL_FILTERS,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import { NO_COMPARISON_BADGE, resolveHeroDeltaBadge } from '@/lib/aether/hero-delta'
import { SCOPE_LABELS } from '@/lib/aether/brand-scope'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { loadLiveTodaySummary } from './support/dashboard-fixture'

const REFERENCE_NOW_MS = Date.parse('2026-11-17T03:05:00Z')

function filters(period: GlobalFilters['period'], brand = 'all'): GlobalFilters {
  return { ...DEFAULT_GLOBAL_FILTERS, period, brand: brand as GlobalFilters['brand'] }
}

/** 14 completed days: first week 100/day, second week 110/day (+10%). */
function fourteenDaySummary(): OdooLiveSummary {
  const summary = loadLiveTodaySummary()
  summary.dailySeries = Array.from({ length: 14 }, (_, i) => ({
    day: `2026-11-${String(3 + i).padStart(2, '0')}`,
    orders: 10,
    netKwd: i < 7 ? 100 : 110,
  }))
  return summary
}

describe('M5 — no fake +0.0% when there is no comparison', () => {
  it('M5 RED→GREEN: today-only dailySeries returns null, not 0', () => {
    const summary = loadLiveTodaySummary()
    const ws = computeGlobalWorkspace(filters('today'), summary)
    expect(computePeriodOverPeriodDeltaPct(filters('today'), ws, summary, { referenceNowMs: REFERENCE_NOW_MS })).toBeNull()
  })

  it('M5: the hero badge reads — with the "no comparison" title', () => {
    const summary = loadLiveTodaySummary()
    const ws = computeGlobalWorkspace(filters('today', 'china-garden'), summary)
    const badge = resolveHeroDeltaBadge(filters('today', 'china-garden'), ws, summary)
    expect(badge.badgeLabel).toBe(NO_COMPARISON_BADGE)
    expect(badge.hasComparison).toBe(false)
    expect(badge.titleAr).toBe(SCOPE_LABELS.noComparison.ar)
    expect(badge.badgeLabel).not.toContain('0.0%')
  })

  it('a real week-over-week comparison still renders (+10%)', () => {
    const summary = fourteenDaySummary()
    const ws = computeGlobalWorkspace(filters('week'), summary)
    expect(computePeriodOverPeriodDeltaPct(filters('week'), ws, summary, { referenceNowMs: REFERENCE_NOW_MS })).toBe(10)
  })

  it('with a brand selected the company series is not used: delta is null', () => {
    const summary = fourteenDaySummary()
    const ws = computeGlobalWorkspace(filters('week', 'china-garden'), summary)
    expect(
      computePeriodOverPeriodDeltaPct(filters('week', 'china-garden'), ws, summary, { referenceNowMs: REFERENCE_NOW_MS }),
    ).toBeNull()
  })
})
