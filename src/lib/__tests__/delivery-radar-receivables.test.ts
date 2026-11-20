import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  OdooBucketSummary,
  OdooLiveSummary,
  OdooReceivableAccountRow,
} from '@/lib/odoo/live-sync-core'
import { POS_CLEARING_ACCOUNT_ID } from '@/lib/odoo/receivable-domain'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import {
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
  DEFAULT_GLOBAL_FILTERS,
  computeGlobalWorkspace,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import { selectReceivablesHeadline } from '@/lib/aether/receivables-headline'
import { logger } from '@/lib/logger'

type GlobalFilterContextValue = ReturnType<
  typeof import('@/components/aether/GlobalFilterContext').useGlobalFilter
>

const filterStateHolder: { current: GlobalFilterContextValue | null } = {
  current: null,
}

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp/aggregator-radar',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => {
    if (!filterStateHolder.current) {
      throw new Error('filterStateHolder.current must be initialized before rendering')
    }
    return filterStateHolder.current
  },
}))

import { LanguageProvider } from '@/lib/i18n'
import { DeliveryRadarV5 } from '@/components/aether/DeliveryRadarV5'

const TypedLanguageProvider = LanguageProvider as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

const TypedDeliveryRadar = DeliveryRadarV5 as React.ComponentType<{
  initialLiveCube?: OdooPeriodCube | null
}>

const FIXTURE_NOW = new Date('2026-11-17T11:30:00.000Z')
const TODAY_ISO = '2026-11-17'

function buildEmptyUiChannels() {
  return Object.fromEntries(
    APPROVED_CHANNEL_IDS.map((ch) => [ch, { netKwd: 0, orders: 0 }]),
  )
}

function buildSummaryWithReceivables(
  aggregatorReceivables: OdooLiveSummary['aggregatorReceivables'],
  unavailableSections: string[] = [],
): OdooLiveSummary {
  const uiChannels = {
    ...buildEmptyUiChannels(),
    'dine-in': { netKwd: 420.5, orders: 64 },
    'talabat-tgo': { netKwd: 185.25, orders: 29 },
    keeta: { netKwd: 94.75, orders: 15 },
  }

  const bucket: OdooBucketSummary = {
    key: 'today',
    from: TODAY_ISO,
    to: '2026-11-18',
    days: 1,
    totals: {
      netSalesKwd: 700.5,
      orders: 108,
      aovKwd: 6.486,
      restaurantNetKwd: 700.5,
      restaurantOrders: 108,
    },
    byLocation: {
      avenues: {
        netKwd: 700.5,
        orders: 108,
        uiChannels,
      },
    },
    mappedByLocation: {
      avenues: { netKwd: 700.5, orders: 108 },
    },
    byBrand: Object.fromEntries(
      APPROVED_BRAND_IDS.map((brandId) => [
        brandId,
        { netKwd: brandId === 'china-garden' ? 700.5 : 0, orders: brandId === 'china-garden' ? 108 : 0, qty: 0 },
      ]),
    ),
    uiChannels,
    unattributedSalesKwd: 0,
    unattributedOrders: 0,
  }

  return {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    partial: unavailableSections.length > 0,
    unavailableSections,
    syncedAt: '2026-11-17T11:25:00.000Z',
    lastSyncAt: '2026-11-17T11:25:00.000Z',
    latestRecordAt: '2026-11-17T11:20:00.000Z',
    latestOperationalDate: TODAY_ISO,
    period: { from: TODAY_ISO, to: TODAY_ISO },
    database: null,
    totals: { netSalesKwd: 700.5, orders: 108, aovKwd: 6.486 },
    brands: [],
    branches: [],
    channels: [],
    buckets: {
      today: bucket,
      week: { ...bucket, key: 'week', days: 7 },
      month: { ...bucket, key: 'month', days: 30 },
    },
    dailySeries: [{ day: TODAY_ISO, orders: 108, netKwd: 700.5 }],
    hourlySeries: [],
    aggregatorReceivables,
  }
}

function renderRadarHtml(
  locale: 'ar' | 'en',
  summary: OdooLiveSummary,
  filtersOverride: Partial<GlobalFilters> = {},
): string {
  const filters: GlobalFilters = {
    ...DEFAULT_GLOBAL_FILTERS,
    period: 'today',
    ...filtersOverride,
  }
  const workspace = computeGlobalWorkspace(filters, summary, '/erp/aggregator-radar')
  filterStateHolder.current = {
    filters: workspace.filters,
    workspace,
    liveSummary: summary,
    isAuditor: false,
    sessionRole: 'admin',
    syncingOdoo: false,
    syncCooldownSec: 0,
    triggerOdooSyncNow: vi.fn(async () => {}),
    setPeriod: vi.fn(),
    setCustomRange: vi.fn(),
    setKuwaitSlice: vi.fn(),
    setBrand: vi.fn(),
    setBranch: vi.fn(),
    setChannel: vi.fn(),
    setLens: vi.fn(),
    resetFilters: vi.fn(),
    buildShareDeepLinkText: vi.fn(() => ''),
  }

  return renderToStaticMarkup(
    React.createElement(
      TypedLanguageProvider,
      { initialLocale: locale },
      React.createElement(TypedDeliveryRadar, { initialLiveCube: null }),
    ),
  )
}

function extractHeadlineText(html: string): string {
  const match = /data-receivables-headline-kwd="true"[^>]*>([^<]+)</.exec(html)
  return match?.[1] ?? ''
}

describe('Boudi QA Blocker #2 — DeliveryRadarV5 Net Open Receivables (30,310.675 KWD vs ~1,077,552)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] })
    filterStateHolder.current = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('selectReceivablesHeadline computes exact 30,310.675 KWD netKwd from Odoo debits and unapplied clearing credits', () => {
    const selected = selectReceivablesHeadline({
      openDebitsKwd: 1077552.125,
      unappliedCreditsKwd: -1047241.45,
      openReceivableKwd: 30310.675,
      unreconciledLineCount: 3804,
    })

    expect(selected.netKwd).toBe(30310.675)
    expect(selected.openDebitsKwd).toBe(1077552.125)
    expect(selected.unappliedCreditsKwd).toBe(-1047241.45)
    expect(selected.lines).toBe(3804)

    // Fallback tie-out when openReceivableKwd is omitted still yields exact 30,310.675 KWD
    const derived = selectReceivablesHeadline({
      openDebitsKwd: 1077552.125,
      unappliedCreditsKwd: -1047241.45,
    })
    expect(derived.netKwd).toBe(30310.675)

    // Payloads containing verified Odoo POS_CLEARING_ACCOUNT_ID = 35 in byAccount isolate 30,310.675 KWD
    const verifiedWithPos35 = selectReceivablesHeadline({
      openReceivableKwd: 29318.356,
      platformNetKwd: 30310.675,
      platformAndCorporateLinesCount: 6,
      unreconciledLineCount: 10,
      byAccount: [
        {
          accountId: 121,
          accountCode: '10501',
          accountName: 'Talabat',
          residualKwd: 30310.675,
          linesCount: 6,
        },
        {
          accountId: POS_CLEARING_ACCOUNT_ID,
          accountCode: '10552',
          accountName: 'POS Clearing',
          residualKwd: -992.319,
          linesCount: 4,
        },
      ],
    })
    expect(verifiedWithPos35.netKwd).toBe(30310.675)
    expect(verifiedWithPos35.lines).toBe(6)
  })

  it('excludes accountId === 35 (POS_CLEARING_ACCOUNT_ID) strictly by explicit ID even when accountCode and accountName differ', () => {
    expect(POS_CLEARING_ACCOUNT_ID).toBe(35)

    const byAccountRenamed: OdooReceivableAccountRow[] = [
      {
        accountId: 121,
        accountCode: '10501',
        accountName: 'Talabat Receivable',
        labelAr: 'ذمم طلبات',
        labelEn: 'Talabat Receivable',
        residualKwd: 20100.5,
        linesCount: 1800,
      },
      {
        accountId: 122,
        accountCode: '10502',
        accountName: 'Keeta Receivable',
        labelAr: 'ذمم كيتا',
        labelEn: 'Keeta Receivable',
        residualKwd: 11561.547,
        linesCount: 1400,
      },
      {
        accountId: 123,
        accountCode: '10509',
        accountName: 'Corporate Settlements',
        labelAr: 'ذمم شركات',
        labelEn: 'Corporate Settlements',
        residualKwd: -1351.372,
        linesCount: 604,
      },
      {
        accountId: POS_CLEARING_ACCOUNT_ID,
        accountCode: '99999',
        accountName: 'Suspense Ledger Reclassified',
        labelAr: 'حساب معاد تصنيفه',
        labelEn: 'Suspense Ledger Reclassified',
        residualKwd: -992.319,
        linesCount: 62766,
      },
    ]

    const direct = selectReceivablesHeadline({
      openReceivableKwd: 29318.356,
      byAccount: byAccountRenamed,
    })
    expect(direct.netKwd).toBe(30310.675)
    expect(direct.lines).toBe(3804)

    const summary = buildSummaryWithReceivables({
      readable: true,
      openReceivableKwd: 29318.356,
      openLinesCount: 66570,
      fromDate: '2025-01-01',
      toDate: '2026-11-17',
      sourceModel: 'account.move.line',
      byAccount: byAccountRenamed,
    })

    const enHtml = renderRadarHtml('en', summary)
    const arHtml = renderRadarHtml('ar', summary)
    expect(extractHeadlineText(enHtml)).toBe('30,310.675 KWD')
    expect(extractHeadlineText(arHtml)).toBe('30,310.675 د.ك')
    expect(enHtml).not.toContain('29,318.356')
    expect(arHtml).not.toContain('29,318.356')
  })

  it('does NOT guess or exclude accountCode "10552" when accountId is 777 (not POS_CLEARING_ACCOUNT_ID = 35)', () => {
    const non35Accounts: OdooReceivableAccountRow[] = [
      {
        accountId: 121,
        accountCode: '10501',
        accountName: 'Talabat Receivable',
        labelAr: 'ذمم طلبات',
        labelEn: 'Talabat Receivable',
        residualKwd: 30310.675,
        linesCount: 6,
      },
      {
        accountId: 777,
        accountCode: '10552',
        accountName: 'POS Clearing',
        labelAr: 'مقاصة نقاط البيع',
        labelEn: 'POS Clearing',
        residualKwd: -992.319,
        linesCount: 4,
      },
    ]

    const directFromAccounts = selectReceivablesHeadline({
      byAccount: non35Accounts,
    })
    expect(directFromAccounts.netKwd).toBe(29318.356)
    expect(directFromAccounts.lines).toBe(10)

    const withSummaryTotals = selectReceivablesHeadline({
      openReceivableKwd: 29318.356,
      platformNetKwd: 30310.675,
      unreconciledLineCount: 10,
      platformAndCorporateLinesCount: 6,
      byAccount: non35Accounts,
    })
    expect(withSummaryTotals.netKwd).toBe(29318.356)
    expect(withSummaryTotals.lines).toBe(10)

    const summary = buildSummaryWithReceivables({
      readable: true,
      openReceivableKwd: 29318.356,
      openLinesCount: 10,
      fromDate: '2025-01-01',
      toDate: '2026-11-17',
      sourceModel: 'account.move.line',
      byAccount: non35Accounts,
    })
    const enHtml = renderRadarHtml('en', summary)
    expect(extractHeadlineText(enHtml)).toBe('29,318.356 KWD')
  })

  it('enforces Fail-Closed and logs structured warning when byAccount has missing, null, 0, negative, non-integer, or NaN accountId', () => {
    const warnSpy = vi.spyOn(logger, 'warn')
    const stdoutWrites: string[] = []
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stdoutWrites.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
      return true
    })

    const unverifiedAccountIds: Array<number | null | undefined> = [
      undefined,
      null,
      0,
      -35,
      35.5,
      Number.NaN,
    ]

    for (const invalidId of unverifiedAccountIds) {
      warnSpy.mockClear()
      const res = selectReceivablesHeadline({
        openDebitsKwd: 1077552.125,
        unappliedCreditsKwd: -1047241.45,
        openReceivableKwd: 29318.356,
        platformNetKwd: 30310.675,
        unreconciledLineCount: 10,
        platformAndCorporateLinesCount: 6,
        byAccount: [
          {
            accountId: 121,
            accountCode: '10501',
            accountName: 'Talabat',
            residualKwd: 30310.675,
            linesCount: 6,
          },
          {
            accountId: invalidId,
            accountCode: '10552',
            accountName: 'POS Clearing',
            residualKwd: -992.319,
            linesCount: 4,
          },
        ],
      })

      expect(res).toEqual({
        openDebitsKwd: null,
        unappliedCreditsKwd: null,
        netKwd: null,
        lines: null,
      })
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy).toHaveBeenCalledWith('receivables_headline_fail_closed_unverified_account_id', {
        totalAccountRows: 2,
        unverifiedRowCount: 1,
      })
    }

    expect(stdoutWrites.length).toBe(unverifiedAccountIds.length)
    const parsedLog = JSON.parse(stdoutWrites[0]!.trim()) as Record<string, unknown>
    expect(parsedLog.level).toBe('warn')
    expect(parsedLog.message).toBe('receivables_headline_fail_closed_unverified_account_id')
    expect(parsedLog.totalAccountRows).toBe(2)
    expect(parsedLog.unverifiedRowCount).toBe(1)

    // DeliveryRadarV5 cleanly hides the unverified receivables card rather than guessing by accountCode '10552'
    warnSpy.mockClear()
    const unverifiedSummary = buildSummaryWithReceivables({
      readable: true,
      openReceivableKwd: 29318.356,
      openDebitsKwd: 1077552.125,
      unappliedCreditsKwd: -1047241.45,
      openLinesCount: 10,
      fromDate: '2025-01-01',
      toDate: '2026-11-17',
      sourceModel: 'account.move.line',
      byAccount: [
        {
          accountId: 121,
          accountCode: '10501',
          accountName: 'Talabat',
          labelAr: 'طلبات',
          labelEn: 'Talabat',
          residualKwd: 30310.675,
          linesCount: 6,
        },
        {
          accountId: null as unknown as number,
          accountCode: '10552',
          accountName: 'POS Clearing',
          labelAr: 'مقاصة نقاط البيع',
          labelEn: 'POS Clearing',
          residualKwd: -992.319,
          linesCount: 4,
        },
      ],
    })

    const unverifiedEnHtml = renderRadarHtml('en', unverifiedSummary)
    const unverifiedArHtml = renderRadarHtml('ar', unverifiedSummary)
    expect(unverifiedEnHtml).not.toContain('data-receivables-kpi-card="true"')
    expect(unverifiedArHtml).not.toContain('data-receivables-kpi-card="true"')
    expect(unverifiedEnHtml).not.toContain('Net Open Receivables')
    expect(unverifiedArHtml).not.toContain('صافي الذمم المدينة المفتوحة')
    expect(unverifiedEnHtml).not.toContain('30,310.675')
    expect(unverifiedEnHtml).not.toContain('29,318.356')
    expect(unverifiedEnHtml).not.toContain('1,077,552')
    expect(warnSpy).toHaveBeenCalledWith('receivables_headline_fail_closed_unverified_account_id', {
      totalAccountRows: 2,
      unverifiedRowCount: 1,
    })

    // Isomorphic logger guard: does not throw when process.stdout is absent in browser-like runtimes
    const originalStdout = process.stdout
    Object.defineProperty(process, 'stdout', { value: undefined, configurable: true })
    try {
      expect(() =>
        selectReceivablesHeadline({
          openReceivableKwd: 30310.675,
          byAccount: [{ accountId: Number.NaN, accountCode: '10552', residualKwd: -992.319 }],
        }),
      ).not.toThrow()
    } finally {
      Object.defineProperty(process, 'stdout', { value: originalStdout, configurable: true })
    }
  })

  it('renders exact 30,310.675 KWD in both EN and AR on DeliveryRadarV5 and NEVER renders inflated 1,077,552', () => {
    const summary = buildSummaryWithReceivables({
      readable: true,
      openReceivableKwd: 30310.675,
      grossPositiveReceivableKwd: 31662.047,
      creditClearingOffsetKwd: -1351.372,
      openDebitsKwd: 1077552.125,
      unappliedCreditsKwd: -1047241.45,
      openLinesCount: 3804,
      fromDate: '2025-01-01',
      toDate: '2026-11-17',
      sourceModel: 'account.move.line',
    })

    const enHtml = renderRadarHtml('en', summary)
    expect(enHtml).toContain('Net Open Receivables')
    expect(extractHeadlineText(enHtml)).toBe('30,310.675 KWD')
    expect(enHtml).toContain('30,310.675 KWD')
    expect(enHtml).not.toContain('1,077,552')
    expect(enHtml).not.toContain('1077552')

    const arHtml = renderRadarHtml('ar', summary)
    expect(arHtml).toContain('صافي الذمم المدينة المفتوحة')
    expect(extractHeadlineText(arHtml)).toBe('30,310.675 د.ك')
    expect(arHtml).toContain('30,310.675 د.ك')
    expect(arHtml).not.toContain('1,077,552')
    expect(arHtml).not.toContain('1077552')

    // Period & brand filters never double-count or distort point-in-time net open receivables
    const monthBrandHtml = renderRadarHtml('en', summary, {
      period: 'month',
      brand: 'china-garden',
    })
    expect(extractHeadlineText(monthBrandHtml)).toBe('30,310.675 KWD')
    expect(monthBrandHtml).not.toContain('1,077,552')
  })

  it('hides the receivables card cleanly with zero invented numbers when Odoo receivables are unavailable or unreadable', () => {
    expect(selectReceivablesHeadline(null).netKwd).toBeNull()
    expect(selectReceivablesHeadline({ unavailable: true, openReceivableKwd: 30310.675 }).netKwd).toBeNull()
    expect(selectReceivablesHeadline({ readable: false, openReceivableKwd: 30310.675 }).netKwd).toBeNull()
    expect(
      selectReceivablesHeadline({
        unavailable: false,
        openReceivableKwd: 0,
        maturityStatusEn: 'No Odoo receivable data for this period',
      }).netKwd,
    ).toBeNull()

    const nullSummary = buildSummaryWithReceivables(null, ['receivables'])
    const nullEn = renderRadarHtml('en', nullSummary)
    const nullAr = renderRadarHtml('ar', nullSummary)
    expect(nullEn).not.toContain('data-receivables-kpi-card="true"')
    expect(nullAr).not.toContain('data-receivables-kpi-card="true"')
    expect(nullEn).not.toContain('Net Open Receivables')
    expect(nullAr).not.toContain('صافي الذمم المدينة المفتوحة')
    expect(nullEn).not.toContain('1,077,552')

    const unreadableSummary = buildSummaryWithReceivables({
      readable: false,
      openReceivableKwd: 0,
      openLinesCount: 0,
    })
    const unreadableEn = renderRadarHtml('en', unreadableSummary)
    expect(unreadableEn).not.toContain('data-receivables-kpi-card="true"')
    expect(unreadableEn).not.toContain('>0.000 KWD<')
  })
})
