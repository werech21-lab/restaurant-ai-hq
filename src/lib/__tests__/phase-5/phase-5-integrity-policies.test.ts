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
    expect(hours.indexOf(7)).toBeGreaterThan(hours.indexOf(1))
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
