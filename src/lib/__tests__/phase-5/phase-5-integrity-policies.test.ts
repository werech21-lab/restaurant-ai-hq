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

describe('Phase 5 · Item 1 — hourly chart integrity', () => {
  it('display order covers all 24 hours exactly once', () => {
    expect([...HOURLY_DISPLAY_ORDER].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 24 }, (_, i) => i),
    )
  })

  it('never drops early-morning hours that carry sales', () => {
    const rows = [
      { hour: 7, orders: 3, netKwd: 4.5 },
      { hour: 12, orders: 10, netKwd: 50 },
    ]
    const hours = selectDisplayHours(rows)
    expect(hours).toContain(7)
    expect(hours).not.toContain(4)
    // Chronological: 07:00 is drawn before 09:00, never after 23:00.
    expect(hours.indexOf(7)).toBeLessThan(hours.indexOf(9))
    expect(hours.indexOf(7)).toBeLessThan(hours.indexOf(23))
  })

  it('a single day is ordered 00 → 23 and no 00:00–08:59 hour is ever drawn after 23:00', () => {
    const rows = [0, 1, 2, 8, 9, 15, 23].map((hour) => ({ hour, orders: 1, netKwd: 1 }))
    const hours = selectDisplayHours(rows)
    expect([...hours]).toEqual([...hours].sort((a, b) => a - b))
    const after23 = hours.slice(hours.indexOf(23) + 1)
    expect(after23.filter((h) => h <= 8)).toEqual([])
    // Contiguous from the first early hour (Phase 5 follow-up): 00, 01, 02, 03 …
    expect(hours.slice(0, 4)).toEqual([0, 1, 2, 3])
  })

  it('reconciles hourly buckets to the selected period total to the exact fils', () => {
    const rows = [
      { hour: 7, orders: 1, netKwd: 0.125 },
      { hour: 13, orders: 2, netKwd: 10.25 },
      { hour: 21, orders: 3, netKwd: 99.625 },
    ]
    const ok = reconcileHourlyToPeriod(rows, 110)
    expect(ok.reconciled).toBe(true)
    expect(ok.varianceKwd).toBe(0)
    expect(ok.hourlySumKwd).toBe(110)

    const off = reconcileHourlyToPeriod(rows, 110.001)
    expect(off.reconciled).toBe(false)
    expect(off.varianceKwd).toBe(-0.001)
  })

  it('is not reconciled when the period total is unknown', () => {
    const r = reconcileHourlyToPeriod([{ hour: 12, orders: 1, netKwd: 5 }], null)
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
    expect(RECEIVABLES_PENDING_STATUS.ar).toBe('قيد المطابقة مع المحاسبة')
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
