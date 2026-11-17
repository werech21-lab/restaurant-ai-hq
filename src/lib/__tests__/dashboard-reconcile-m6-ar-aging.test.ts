import { describe, expect, it } from 'vitest'
import {
  ageOpenReceivableLines,
  buildArAgingDomains,
  classifyAgingBucket,
  summarizeArAging,
  toDisplayableAging,
} from '@/lib/odoo/receivable-aging'
import { computeGlobalWorkspace, DEFAULT_GLOBAL_FILTERS } from '@/lib/aether/global-filter-engine'
import { loadLiveTodaySummary } from './support/dashboard-fixture'

const TODAY = '2026-11-17'

describe('M6 — AR aging ages open debits by due date; credits are a separate line', () => {
  it('M6: +100 invoice 45 days old and −100 unmatched payment 5 days old', () => {
    const aging = ageOpenReceivableLines(
      [
        { residualKwd: 100, dateMaturity: null, date: '2026-10-03' },
        { residualKwd: -100, dateMaturity: null, date: '2026-11-12' },
      ],
      TODAY,
    )
    const byKey = Object.fromEntries(aging.buckets.map((b) => [b.key, b.residualKwd]))
    expect(byKey).toEqual({ '0_30': 0, '31_60': 100, over_60: 0 })
    expect(aging.unappliedCreditsKwd).toBe(-100)
    expect(aging.openReceivableKwd).toBe(0)
    expect(aging.buckets.every((b) => b.residualKwd >= 0)).toBe(true)
  })

  it('ages by date_maturity first and falls back to the posting date', () => {
    expect(classifyAgingBucket('2026-11-17', TODAY)).toBe('0_30')
    expect(classifyAgingBucket('2026-12-30', TODAY)).toBe('0_30')
    expect(classifyAgingBucket('2026-10-18', TODAY)).toBe('0_30')
    expect(classifyAgingBucket('2026-10-17', TODAY)).toBe('31_60')
    expect(classifyAgingBucket('2026-09-18', TODAY)).toBe('31_60')
    expect(classifyAgingBucket('2026-09-17', TODAY)).toBe('over_60')
    const aging = ageOpenReceivableLines([{ residualKwd: 50, dateMaturity: '2026-11-10', date: '2026-08-01' }], TODAY)
    expect(aging.buckets.find((b) => b.key === '0_30')?.residualKwd).toBe(50)
  })

  it('server domains: positive residual per bucket with maturity-or-date windows, one negative credit domain', () => {
    const { debitDomains, creditDomain } = buildArAgingDomains([['reconciled', '=', false]], TODAY)
    const json = (x: unknown) => JSON.stringify(x)
    expect(debitDomains.map((d) => d.key)).toEqual(['0_30', '31_60', 'over_60'])
    for (const d of debitDomains) expect(json(d.domain)).toContain('["amount_residual",">",0]')
    expect(json(debitDomains[0].domain)).toContain('["date_maturity",">=","2026-10-18"]')
    expect(json(debitDomains[1].domain)).toContain('["date_maturity","<","2026-10-18"]')
    expect(json(debitDomains[1].domain)).toContain('["date",">=","2026-09-18"]')
    expect(json(debitDomains[2].domain)).toContain('["date","<","2026-09-18"]')
    expect(json(creditDomain)).toContain('["amount_residual","<",0]')
    const summarized = summarizeArAging({
      debitsByBucket: { '31_60': { residualKwd: 100, linesCount: 1 } },
      credits: { residualKwd: -100, linesCount: 1 },
    })
    expect(summarized).toEqual(
      ageOpenReceivableLines(
        [
          { residualKwd: 100, dateMaturity: null, date: '2026-10-03' },
          { residualKwd: -100, dateMaturity: null, date: '2026-11-12' },
        ],
        TODAY,
      ),
    )
  })

  it('M6 RED→GREEN: the old signed buckets in the live payload (−22,182.5 / 47,244.3 / −23,879.1) are hidden, not shown', () => {
    const summary = loadLiveTodaySummary()
    const legacy = toDisplayableAging(summary.aggregatorReceivables)
    expect(legacy.buckets).toEqual([])
    expect(legacy.hiddenReasonAr).toBeTruthy()
    const ws = computeGlobalWorkspace({ ...DEFAULT_GLOBAL_FILTERS, period: 'today' }, summary)
    expect(ws.receivables.agingBuckets.some((b) => b.residualKwd < 0)).toBe(false)
    // Phase 5 · Item 2: the workspace withholds the amount until per-customer aging is verified.
    expect(ws.receivables.pendingReconciliation).toBe(true)
    expect(ws.receivables.openReceivableKwd).toBeNull()
  })
})
