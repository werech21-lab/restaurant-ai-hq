import { describe, expect, it } from 'vitest'
import {
  calendarDaysInIsoMonth,
  computeGlobalWorkspace,
  computePeriodOverPeriodDeltaPct,
  DEFAULT_GLOBAL_FILTERS,
  inclusiveIsoDayCount,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import { resolveEqualPeriodSalesDelta } from '@/lib/aether/period-delta'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { loadLiveTodaySummary } from './support/dashboard-fixture'

const REFERENCE_NOW_MS = Date.parse('2026-11-17T06:00:00Z')

function filters(period: GlobalFilters['period'] = 'month'): GlobalFilters {
  return { ...DEFAULT_GLOBAL_FILTERS, period }
}

function isoDays(startIso: string, count: number): string[] {
  const start = Date.parse(`${startIso}T00:00:00Z`)
  return Array.from({ length: count }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10),
  )
}

describe('month preset compares equal-length windows', () => {
  it('ignores a rolling pulse whose windows differ in length', () => {
    const summary = loadLiveTodaySummary()
    const windowDays = 17
    const priorDaily = 2
    const currentDaily = 4
    const days = isoDays('2026-10-14', windowDays * 2)
    summary.dailySeries = days.map((day, i) => ({
      day,
      orders: 1,
      netKwd: i < windowDays ? priorDaily : currentDaily,
    }))
    summary.buckets = {
      ...summary.buckets,
      month: {
        ...(summary.buckets?.month ?? { key: 'month', from: '2026-11-01', to: '2026-11-18' }),
        key: 'month',
        from: '2026-11-01',
        to: '2026-11-18',
        days: windowDays,
      },
    } as OdooLiveSummary['buckets']
    summary.journeyPulse = {
      rolling30: {
        from: '2026-11-01',
        to: '2026-11-17',
        days: windowDays,
        netKwd: windowDays * currentDaily,
        orders: windowDays,
        perDayKwd: currentDaily,
      },
      prior30: {
        from: '2026-10-02',
        to: '2026-10-31',
        days: 30,
        netKwd: 30 * priorDaily,
        orders: 30,
        perDayKwd: priorDaily,
      },
      mtd: {
        from: '2026-11-01',
        to: '2026-11-17',
        days: windowDays,
        netKwd: windowDays * currentDaily,
        orders: windowDays,
        perDayKwd: currentDaily,
      },
    }
    const currentSum = summary.dailySeries.slice(-windowDays).reduce((s, d) => s + d.netKwd, 0)
    const priorSum = summary.dailySeries.slice(-2 * windowDays, -windowDays).reduce((s, d) => s + d.netKwd, 0)
    const expected = Math.round(((currentSum - priorSum) / priorSum) * 1000) / 10
    const ws = computeGlobalWorkspace(filters(), summary)
    expect(
      computePeriodOverPeriodDeltaPct(filters(), ws, summary, { referenceNowMs: REFERENCE_NOW_MS }),
    ).toBe(expected)
  })

  it('uses the rolling pulse when both windows have the same day count', () => {
    const summary = loadLiveTodaySummary()
    const days = 30
    const currentNet = days * 3
    const priorNet = days * 2
    summary.journeyPulse = {
      rolling30: {
        from: '2026-10-18',
        to: '2026-11-16',
        days,
        netKwd: currentNet,
        orders: days,
        perDayKwd: currentNet / days,
      },
      prior30: {
        from: '2026-09-18',
        to: '2026-10-17',
        days,
        netKwd: priorNet,
        orders: days,
        perDayKwd: priorNet / days,
      },
      mtd: {
        from: '2026-11-01',
        to: '2026-11-16',
        days: 16,
        netKwd: 16,
        orders: 16,
        perDayKwd: 1,
      },
    }
    const delta = resolveEqualPeriodSalesDelta({
      period: 'month',
      workspaceSalesKwd: 1,
      isUnfilteredCompanyScope: true,
      journeyPulse: summary.journeyPulse,
      liveConnected: true,
      referenceNowMs: REFERENCE_NOW_MS,
    })
    expect(delta.currentKwd).toBe(currentNet)
    expect(delta.priorKwd).toBe(priorNet)
    expect(summary.journeyPulse.rolling30.perDayKwd).toBe(currentNet / days)
    expect(summary.journeyPulse.mtd.perDayKwd).toBe(16 / 16)
  })

  it('does not compare a short month against a 30-day prior', () => {
    const delta = resolveEqualPeriodSalesDelta({
      period: 'month',
      workspaceSalesKwd: 17,
      isUnfilteredCompanyScope: true,
      journeyPulse: {
        rolling30: { netKwd: 17, days: 17 },
        prior30: { netKwd: 30, days: 30 },
      },
      liveConnected: true,
      referenceNowMs: REFERENCE_NOW_MS,
    })
    expect(delta.currentKwd).toBe(17)
    expect(delta.priorKwd).toBe(0)
  })

  it('labels the month with the real day count from the bucket', () => {
    const summary = loadLiveTodaySummary()
    const from = '2026-11-01'
    const toExclusive = '2026-11-18'
    const toInclusive = '2026-11-17'
    const days = inclusiveIsoDayCount(from, toInclusive)
    summary.buckets = {
      ...summary.buckets,
      month: {
        ...(summary.buckets?.month ?? { key: 'month', from, to: toExclusive }),
        key: 'month',
        from,
        to: toExclusive,
        days,
      },
    } as OdooLiveSummary['buckets']
    const ws = computeGlobalWorkspace(filters(), summary)
    expect(ws.periodDays).toBe(days)
    expect(ws.periodRangeLabelEn).toContain(`(${days}d)`)
    expect(ws.periodRangeLabelAr).toContain(String(days))
    expect(calendarDaysInIsoMonth(toInclusive)).toBe(30)
  })
})
