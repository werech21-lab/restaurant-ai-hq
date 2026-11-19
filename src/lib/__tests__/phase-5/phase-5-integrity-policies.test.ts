import { describe, expect, it } from 'vitest'
import {
  HOURLY_DISPLAY_ORDER,
  reconcileHourlyToPeriod,
  selectDisplayHours,
} from '@/lib/aether/hourly-integrity'
import {
  closedMonthWithheldReason,
  isWindowWithinClosedMonths,
  lastClosedMonthLabel,
  resolveGlClosedThroughDate,
} from '@/lib/aether/closed-month-policy'
import {
  RECEIVABLES_PENDING_STATUS,
  canShowReceivableAmounts,
  resolveReceivablesExecutiveStatus,
} from '@/lib/aether/receivables-status'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'

describe('Phase 5 · Item 1 — hourly chart integrity', () => {
  it('display order covers all 24 hours exactly once', () => {
    expect([...HOURLY_DISPLAY_ORDER].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 24 }, (_, i) => i),
    )
  })

  // Real data only: the live 2026-11-17 payload's hourly series (rolling 30 days, Asia/Kuwait) and
  // its real rolling-30 total. No hand-written hourly figures.
  const live = loadLiveTodaySummary()
  const realHourly = live.hourlySeries ?? []
  const realRolling30 = (live as unknown as { journeyPulse: { rolling30: { netKwd: number } } }).journeyPulse.rolling30.netKwd
  const realToday = live.buckets!.today!.totals.netSalesKwd as number

  it('never drops early-morning hours that carry sales (real series)', () => {
    const early = realHourly.filter((r) => r.hour <= 8 && (r.netKwd !== 0 || r.orders !== 0)).map((r) => r.hour)
    expect(early.length).toBeGreaterThan(0)
    const hours = selectDisplayHours(realHourly)
    for (const h of early) expect(hours).toContain(h)
  })

  it('is ordered 00 → 23, contiguous, and no 00:00–08:59 hour is drawn after 23:00 (real series)', () => {
    const hours = selectDisplayHours(realHourly)
    expect([...hours]).toEqual([...hours].sort((a, b) => a - b))
    for (let i = 1; i < hours.length; i++) expect(hours[i] - hours[i - 1]).toBe(1)
    expect(hours[hours.length - 1]).toBe(23)
    expect(hours.slice(hours.indexOf(23) + 1)).toEqual([])
    // a real zero hour inside the range is still drawn (no gap)
    const zeroHours = realHourly.filter((r) => r.netKwd === 0 && r.orders === 0 && r.hour >= hours[0]).map((r) => r.hour)
    for (const h of zeroHours) expect(hours).toContain(h)
  })

  it('Σ hourly reconciles to the real period total to the fils (rolling-30 series vs rolling-30 total)', () => {
    const r = reconcileHourlyToPeriod(realHourly, realRolling30)
    expect(r.reconciled).toBe(true)
    expect(r.varianceKwd).toBe(0)
  })

  it('the rolling-30 hourly series does NOT reconcile to the real "today" total — so it must never be drawn as today', () => {
    const r = reconcileHourlyToPeriod(realHourly, realToday)
    expect(r.reconciled).toBe(false)
    expect(r.varianceKwd).not.toBe(0)
  })

  it('is not reconciled when the period total is unknown', () => {
    const r = reconcileHourlyToPeriod(realHourly, null)
    expect(r.reconciled).toBe(false)
    expect(r.periodTotalKwd).toBeNull()
  })
})

describe('Phase 5 · Item 7 — Net Profit for closed GL months only', () => {
  it('uses the later of period_lock_date and fiscalyear_lock_date; Odoo `false` means unset', () => {
    expect(resolveGlClosedThroughDate('2026-10-31', '2025-12-31')).toBe('2026-10-31')
    expect(resolveGlClosedThroughDate(false, '2025-12-31')).toBe('2025-12-31')
    expect(resolveGlClosedThroughDate(false, false)).toBeNull()
  })

  it('shows profit only when the whole window ends on or before the closed-through date', () => {
    expect(isWindowWithinClosedMonths('2026-10-31', '2026-10-31')).toBe(true)
    expect(isWindowWithinClosedMonths('2026-11-17', '2026-10-31')).toBe(false)
    // fail-closed when the lock date could not be read
    expect(isWindowWithinClosedMonths('2026-01-31', null)).toBe(false)
  })

  it('labels the last fully closed month', () => {
    expect(lastClosedMonthLabel('2026-10-31', 'en')).toBe('Oct 2026')
    expect(lastClosedMonthLabel('2026-10-15', 'en')).toBe('Sep 2026')
    expect(lastClosedMonthLabel('2026-01-10', 'ar')).toBe('ديسمبر 2025')
    expect(closedMonthWithheldReason('2026-10-31').en).toContain('Oct 2026')
  })
})

describe('Phase 5 · Item 2 — receivables executive status', () => {
  it('is pending reconciliation (no amounts) until per-customer aging is verified', () => {
    expect(resolveReceivablesExecutiveStatus({ unavailable: false })).toBe('pending-reconciliation')
    expect(canShowReceivableAmounts({ unavailable: false })).toBe(false)
    expect(resolveReceivablesExecutiveStatus({ unavailable: true })).toBe('unavailable')
    expect(canShowReceivableAmounts({ unavailable: false }, true)).toBe(true)
  })

  it('uses the approved bilingual wording', () => {
    expect(RECEIVABLES_PENDING_STATUS.en).toBe('Pending Accounting Reconciliation')
    expect(RECEIVABLES_PENDING_STATUS.ar).toBe('بانتظار مراجعة المحاسبة')
  })
})

describe('Phase 5 · Item 4 — shares always total 100.0%', () => {
  it('fixes the classic 33.3 + 33.3 + 33.3 = 99.9 case', async () => {
    const { normalizeSharesTo100, sumShares } = await import('@/lib/aether/share-normalization')
    const s = normalizeSharesTo100([1, 1, 1])
    expect(sumShares(s)).toBe(100)
    expect(s.filter((x) => x === 33.4)).toHaveLength(1)
  })

  it('sums to exactly 100.0 for realistic six-brand splits and keeps zero brands at 0', async () => {
    const { normalizeSharesTo100, sumShares } = await import('@/lib/aether/share-normalization')
    const samples = [
      [4820.125, 3311.5, 2210.875, 1990.004, 845.333, 0],
      [0.001, 0.001, 99999.998, 12.5, 7.25, 3.125],
      [1234.567, 2345.678, 3456.789, 4567.891, 5678.912, 6789.123],
    ]
    for (const v of samples) {
      const s = normalizeSharesTo100(v)
      expect(sumShares(s)).toBe(100)
      v.forEach((x, i) => {
        if (x === 0) expect(s[i]).toBe(0)
      })
    }
    expect(normalizeSharesTo100([0, 0])).toEqual([0, 0])
  })
})
