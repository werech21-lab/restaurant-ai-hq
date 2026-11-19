import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { applyReceivablesExecutivePolicy } from '@/lib/aether/global-filter-engine'
import { PER_CUSTOMER_DUE_DATE_AGING_VERIFIED } from '@/lib/aether/receivables-status'
import { isSalaryWindowDay, SALARY_WINDOW_DAYS } from '@/lib/aether/salary-window'
import { seasonLiftsFromDaily } from '@/lib/council/advisors/seasons'
import { buildReceivablePartnerRows, customerReceivableNetKwd, receivablesCustomerSplit } from '@/lib/odoo/live-sync-core'
import { warehouseChainErrorPayload } from '@/lib/odoo-live-connector'
import { defaultWarehouseQueryWindow } from '@/lib/warehouse-prep-engine'
import { loadLiveTodaySummary } from './support/dashboard-fixture'
import type { WorkspaceReceivablesMeta } from '@/lib/aether/global-filter-engine'
import type { SeasonEvent } from '@/lib/council/advisors/seasons'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'

describe('warehouse errors are not an empty period', () => {
  it('timeout and upstream failures keep noData false', () => {
    const range = { from: '2026-11-01', to: '2026-11-19' }
    const timeout = warehouseChainErrorPayload(range, 'timeout')
    const failed = warehouseChainErrorPayload(range, 'error')
    expect(timeout.noData).toBe(false)
    expect(timeout.fetchStatus).toBe('timeout')
    expect(timeout.messageAr).not.toContain('لا توجد بيانات')
    expect(failed.noData).toBe(false)
    expect(failed.fetchStatus).toBe('error')
    expect(failed.messageEn).toMatch(/could not be read/i)
  })

  it('a year filter starts on the month of the end date', () => {
    const window = defaultWarehouseQueryWindow({ fromIso: '2026-01-01', toInclusiveIso: '2026-11-19' })
    expect(window).toEqual({ fromIso: '2026-11-01', toInclusiveIso: '2026-11-19', narrowed: true })
    expect(defaultWarehouseQueryWindow({ fromIso: '2026-11-01', toInclusiveIso: '2026-11-19' }).narrowed).toBe(false)
  })
})

describe('receivables policy keeps residuals', () => {
  const base = {
    unavailable: false,
    pendingReconciliation: false,
    openReceivableKwd: 1500,
    grossPositiveReceivableKwd: 2000,
    creditClearingOffsetKwd: 500,
    unreconciledLineCount: 10,
    posClearingLinesCount: 4,
    platformAndCorporateLinesCount: 6,
    fromDate: '2026-10-01',
    toDate: '2026-11-19',
    latestMaturityDate: '2026-11-01',
    maturityStatusAr: 'مستحق التحصيل',
    maturityStatusEn: 'Overdue',
    openLinesExplanationAr: 'رصيد متبقي',
    openLinesExplanationEn: 'Open residual',
    sourceLabelAr: 'أودو',
    sourceLabelEn: 'Odoo',
    reconciliationFormulaAr: 'صيغة',
    reconciliationFormulaEn: 'formula',
    byAccount: [
      {
        accountId: 1,
        accountCode: '10501',
        accountName: 'Talabat',
        labelAr: 'طلبات',
        labelEn: 'Talabat',
        residualKwd: 1200,
        linesCount: 3,
      },
      {
        accountId: 2,
        accountCode: '10552',
        accountName: 'POS',
        labelAr: 'كاشير',
        labelEn: 'POS',
        residualKwd: 300,
        linesCount: 7,
      },
    ],
    agingBuckets: [],
    openDebitsKwd: 2000,
    unappliedCreditsKwd: -500,
    agingHiddenReasonAr: null,
    agingHiddenReasonEn: null,
    byPartner: [],
  } satisfies WorkspaceReceivablesMeta

  it('keeps residual balances and withholds due-date labels', () => {
    expect(PER_CUSTOMER_DUE_DATE_AGING_VERIFIED).toBe(false)
    const out = applyReceivablesExecutivePolicy(base, false)
    expect(out.openReceivableKwd).toBe(1500)
    expect(out.openDebitsKwd).toBe(2000)
    expect(out.byAccount).toHaveLength(2)
    expect(out.agingBuckets).toEqual([])
    expect(out.platformNetKwd).toBe(1200)
    expect(out.posClearingResidualKwd).toBe(300)
    expect(out.maturityStatusAr).not.toMatch(/مستحق|متأخر/)
    expect(out.maturityStatusEn.toLowerCase()).not.toContain('overdue')
  })
})

describe('receivable debit and credit split', () => {
  const accounts = [
    {
      accountId: 9,
      accountCode: '10509',
      accountName: 'Hesabe',
      labelAr: 'حسابي',
      labelEn: 'Hesabe',
      residualKwd: 30310.675,
      linesCount: 10,
    },
    {
      accountId: 52,
      accountCode: '10552',
      accountName: 'POS',
      labelAr: 'كاشير',
      labelEn: 'POS',
      residualKwd: -992.319,
      linesCount: 4,
    },
  ]
  const partners = [
    { residualKwd: 31612.547, linesCount: 8, accountCode: '10509', accountName: 'Hesabe' },
    { residualKwd: -1301.872, linesCount: 2, accountCode: '10509', accountName: 'Hesabe' },
  ]

  it('uses partner residuals for debits and credits, and one 10552-free net', () => {
    const accountOnly = receivablesCustomerSplit(accounts)
    expect(accountOnly.platformOpenDebitsKwd).toBe(30310.675)
    expect(accountOnly.platformUnappliedCreditsKwd).toBe(0)
    const split = receivablesCustomerSplit(accounts, partners)
    expect(split.platformNetKwd).toBe(30310.675)
    expect(split.platformOpenDebitsKwd).toBe(31612.547)
    expect(split.platformUnappliedCreditsKwd).toBe(-1301.872)
    expect(split.posClearingResidualKwd).toBe(-992.319)
    expect(customerReceivableNetKwd({
      platformNetKwd: split.platformNetKwd,
      byAccount: accounts,
      openReceivableKwd: 29318.356,
    })).toBe(30310.675)
    expect(customerReceivableNetKwd({ byAccount: accounts, openReceivableKwd: 29318.356 })).toBe(30310.675)
  })

  it('the company pages and the credits caption use that same net', () => {
    const files = [
      'src/components/aether/FullJourney360.tsx',
      'src/components/accounting/OdooAccountingAnalyticsHub.tsx',
      'src/components/accounting/VentureAccountingHub.tsx',
    ]
    for (const rel of files) {
      expect(readFileSync(path.join(process.cwd(), rel), 'utf8')).toContain('.figures')
    }
    const studio = readFileSync(path.join(process.cwd(), 'src/components/erp/ReceivablesAgingStudio.tsx'), 'utf8')
    expect(studio).not.toContain('POS Clearing (10552)')
    expect(studio).not.toContain('أعمار الديون')
  })
})

describe('partner grouping excludes cashier clearing', () => {
  it('drops 10552 and keeps the platform partner residual', () => {
    const rows = buildReceivablePartnerRows([
      {
        partnerId: 9,
        partnerName: 'Talabat',
        accountId: 11,
        accountLabel: '10501 Talabat',
        residualKwd: 80.5,
        linesCount: 2,
        oldestPostingDate: '2026-10-02',
      },
      {
        partnerId: 3,
        partnerName: 'Cashier',
        accountId: 52,
        accountLabel: '10552 Account Receivable (PoS)',
        residualKwd: -40,
        linesCount: 9,
        oldestPostingDate: '2026-01-01',
      },
    ])
    expect(rows.map((row) => row.accountCode)).toEqual(['10501'])
    expect(rows[0]?.residualKwd).toBe(80.5)
    expect(rows[0]?.oldestPostingDate).toBe('2026-10-02')
  })
})

describe('season lift from the daily series', () => {
  it('computes a lift when the window and its baseline are in the series', () => {
    const summary = loadLiveTodaySummary()
    const events: SeasonEvent[] = [
      {
        id: 'salary-days',
        kind: 'salary-days',
        nameAr: 'أيام الرواتب',
        nameEn: 'Salary days',
        startsOn: '2026-11-25',
        endsOn: '2026-12-01',
        recurrence: 'monthly',
        approximate: true,
      },
    ]
    const lifts = seasonLiftsFromDaily(summary, events)
    const salary = lifts.find((row) => row.eventId === 'salary-days')
    expect(salary).toBeTruthy()
    expect(SALARY_WINDOW_DAYS).toEqual({ start: 5, end: 10 })
    expect(isSalaryWindowDay(salary!.window.from)).toBe(true)
    expect(isSalaryWindowDay(salary!.window.to)).toBe(true)
    expect(salary!.window.from).not.toBe('2026-11-25')
    expect(salary!.avgDailyKwd).toBeGreaterThan(0)
    expect(salary!.baselineDailyKwd).toBeGreaterThan(0)
    expect(Number.isFinite(salary!.liftPct)).toBe(true)
  })

  it('returns no lift when the occurrence is outside the series', () => {
    const summary = { dailyByBranch: { '2026-11-10': { avenues: { netKwd: 10, orders: 1 } } }, syncedAt: '2026-11-18T00:00:00.000Z' } as unknown as OdooLiveSummary
    expect(seasonLiftsFromDaily(summary, [
      {
        id: 'ramadan-2027',
        kind: 'ramadan',
        nameAr: 'رمضان',
        nameEn: 'Ramadan',
        startsOn: '2027-02-08',
        endsOn: '2027-03-09',
        recurrence: 'yearly',
        approximate: true,
        previousStartsOn: '2026-02-18',
        previousEndsOn: '2026-03-19',
      },
    ])).toEqual([])
  })
})
