import { kuwaitDateBoundsToOdooUtc } from '@/lib/odoo/pos-order-query'
import fs from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGlobalFilterState = {
  current: null as ReturnType<typeof import('@/components/aether/GlobalFilterContext').useGlobalFilter> | null,
}

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp',
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

vi.mock('@/components/aether/GlobalFilterContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/aether/GlobalFilterContext')>()
  return {
    ...actual,
    useGlobalFilter: () => {
      if (!mockGlobalFilterState.current) {
        throw new Error('mockGlobalFilterState.current was not initialized in test')
      }
      return mockGlobalFilterState.current
    },
  }
})

import { DeliveryRadarV5 } from '@/components/aether/DeliveryRadarV5'
import { CoresHubStudio } from '@/components/aether/CoresHubStudio'
import { FullJourney360 } from '@/components/aether/FullJourney360'
import { OdooAccountingAnalyticsHub } from '@/components/accounting/OdooAccountingAnalyticsHub'
import { VentureAccountingHub } from '@/components/accounting/VentureAccountingHub'
import { ExecutivePnlStudio } from '@/components/erp/ExecutivePnlStudio'
import { ReceivablesAgingStudio } from '@/components/erp/ReceivablesAgingStudio'
import { SalesScorecardStudio } from '@/components/erp/SalesScorecardStudio'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import {
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import { fmt, kwd } from '@/lib/aether/ledger'
import { LanguageProvider } from '@/lib/i18n'
import { bustOdooLiveCache, fetchLiveOdooSnapshot } from '@/lib/odoo-live-connector'
import { describePosOrderQuery } from '@/lib/odoo/pos-order-query'
import { buildLiveEnterpriseDepartments } from '@/lib/reports/enterprise-reports-registry'

const TEST_REF_NOW_MS = Date.parse('2026-11-15T12:00:00.000Z') // 15:00 Asia/Kuwait on 2026-11-15

function monthWindowFor(nowMs: number) {
  const today = new Date(nowMs + 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return kuwaitDateBoundsToOdooUtc(`${today.slice(0, 7)}-01`, today)
}

const MONTH_WINDOWS = [monthWindowFor(TEST_REF_NOW_MS), monthWindowFor(Date.now())]

function isExactMonthWindow(gte: unknown, lt: unknown): boolean {
  return MONTH_WINDOWS.some(
    (window) => gte === window.fromUtc && lt === window.toExclusiveUtc,
  )
}
const KW_DAY_NOV_15 = { 'date_order:day': { from: '2026-11-14 21:00:00', to: '2026-11-15 21:00:00' } }
const KW_HOUR_13 = { 'date_order:hour': { from: '2026-11-15 10:00:00', to: '2026-11-15 11:00:00' } }

const ODOO_ENV_KEYS = [
  'ODOO_URL',
  'ODOO_DB',
  'ODOO_USERNAME',
  'ODOO_LOGIN',
  'ODOO_API_KEY',
] as const

function rpcOk(id: number, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function rpcFault(id: number, message: string, name = 'odoo.exceptions.ValidationError'): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: {
        code: 200,
        message: 'Odoo Server Error',
        data: { name, message },
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

type WrappedSectionKey =
  | 'hourly'
  | 'channels.month'
  | 'channels.week'
  | 'channels.today'
  | 'channels.year'
  | 'year'
  | 'journeyPulse'

type FailureMode = 'count' | 'net' | 'both'

function installOdooMockWithOptionalSectionFailure(target?: {
  section: WrappedSectionKey
  mode: FailureMode
}) {
  const secretLeakMessage =
    'Upstream failure at https://odoo-test.example.com for key 0123456789abcdef0123456789abcdef'

  // Bounds matching TEST_REF_NOW_MS = 2026-11-15 (anchor day 2026-11-15, tomorrow 2026-11-16):
  // today:  from 2026-11-14 21:00:00 -> 2026-11-15 21:00:00
  // week:   from 2026-11-08 21:00:00 -> 2026-11-15 21:00:00
  // month:  from 2026-10-16 21:00:00 -> 2026-11-15 21:00:00
  // year:   from 2025-12-31 21:00:00 -> 2026-11-15 21:00:00
  // prior30:from 2026-09-16 21:00:00 -> 2026-10-16 21:00:00
  const shouldFail = (section: WrappedSectionKey, isCountQuery: boolean): boolean => {
    if (!target || target.section !== section) return false
    if (target.mode === 'both') return true
    if (target.mode === 'count') return isCountQuery
    return !isCountQuery
  }

  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      id?: number
      params?: { service?: string; method?: string; args?: unknown[] }
    }
    const reqId = body.id ?? 1
    if (body.params?.service === 'common' && body.params?.method === 'authenticate') {
      return rpcOk(reqId, 7)
    }

    const args = body.params?.args ?? []
    const model = String(args[3] ?? '')
    const method = String(args[4] ?? '')
    const methodArgs = (args[5] as unknown[]) ?? []
    const domainStr = JSON.stringify(methodArgs[0] ?? [])
    const groupby = (methodArgs[2] as string[]) ?? []

    if (model === 'pos.config' && method === 'search_read') {
      return rpcOk(reqId, [
        { id: 8, name: 'Promenade 1', active: true, company_id: [1, 'Venture Foods'] },
      ])
    }
    if (model === 'res.users' && method === 'read') {
      return rpcOk(reqId, [{ id: 7, company_id: [1, 'Venture Foods'] }])
    }
    if (model === 'pos.order' && method === 'search_read') {
      return rpcOk(reqId, [
        {
          id: 1,
          date_order: '2026-11-15 10:15:00',
          amount_total: 300,
          config_id: [8, 'Promenade 1'],
          company_id: [1, 'Venture Foods'],
        },
      ])
    }
    if (model === 'pos.session' && method === 'read') {
      return rpcOk(reqId, [{ id: 501, config_id: [8, 'Promenade 1'] }])
    }

    if (model === 'pos.order' && method === 'read_group') {
      const isCount = domainStr.includes('["amount_total",">=",0]')
      if (groupby.includes('date_order:day')) {
        if (isCount) {
          return rpcOk(reqId, [
            {
              session_id: [501, 'POS/501'],
              pricelist_id: [3, 'Talabat Go'],
              __count: 10,
              __range: KW_DAY_NOV_15,
            },
          ])
        }
        return rpcOk(reqId, [
          {
            session_id: [501, 'POS/501'],
            pricelist_id: [3, 'Talabat Go'],
            amount_total: 300,
            amount_tax: 0,
            __count: 10,
            __range: KW_DAY_NOV_15,
          },
        ])
      }

      if (groupby.includes('date_order:hour')) {
        if (shouldFail('hourly', isCount)) {
          return rpcFault(reqId, secretLeakMessage)
        }
        if (isCount) {
          return rpcOk(reqId, [{ __count: 4, __range: KW_HOUR_13 }])
        }
        return rpcOk(reqId, [
          { amount_total: 120, amount_tax: 0, __count: 4, __range: KW_HOUR_13 },
        ])
      }

      if (groupby.length === 1 && groupby[0] === 'session_id') {
        if (shouldFail('year', isCount)) {
          return rpcFault(reqId, secretLeakMessage)
        }
        if (isCount) {
          return rpcOk(reqId, [{ session_id: [501, 'POS/501'], __count: 400 }])
        }
        return rpcOk(reqId, [
          { session_id: [501, 'POS/501'], amount_total: 12000, amount_tax: 0, __count: 400 },
        ])
      }

      if (groupby.length === 0) {
        if (shouldFail('journeyPulse', false)) {
          return rpcFault(reqId, secretLeakMessage)
        }
        return rpcOk(reqId, [{ amount_total: 8400, amount_tax: 0, __count: 280 }])
      }
      return rpcOk(reqId, [])
    }

    if (model === 'pos.order' && method === 'search_count') {
      if (shouldFail('journeyPulse', true)) {
        return rpcFault(reqId, secretLeakMessage)
      }
      return rpcOk(reqId, 280)
    }

    if (model === 'pos.payment' && method === 'read_group') {
      const isCount = domainStr.includes('["pos_order_id.amount_total",">=",0]')
      const domainClauses = (methodArgs[0] as unknown[][]) ?? []
      const gteClause = domainClauses.find(
        (c) => Array.isArray(c) && c[0] === 'pos_order_id.date_order' && c[1] === '>=',
      )
      const ltClause = domainClauses.find(
        (c) => Array.isArray(c) && c[0] === 'pos_order_id.date_order' && c[1] === '<',
      )
      const fromMs = Date.parse(`${String(gteClause?.[2] ?? '').replace(' ', 'T')}Z`)
      const toMs = Date.parse(`${String(ltClause?.[2] ?? '').replace(' ', 'T')}Z`)
      const spanDays = Math.round((toMs - fromMs) / 86_400_000)

      let paySection: WrappedSectionKey = 'channels.month'
      let amount = 180
      let count = 6
      if (spanDays > 30) {
        paySection = 'channels.year'
        amount = 900
        count = 30
      } else if (spanDays === 7) {
        paySection = 'channels.week'
        amount = 150
        count = 5
      } else if (spanDays === 1) {
        paySection = 'channels.today'
        amount = 90
        count = 3
      }

      if (shouldFail(paySection, isCount)) {
        return rpcFault(reqId, secretLeakMessage)
      }
      if (isCount) {
        return rpcOk(reqId, [
          {
            session_id: [501, 'POS/501'],
            payment_method_id: [7, 'Keeta'],
            __count: count,
          },
        ])
      }
      return rpcOk(reqId, [
        {
          session_id: [501, 'POS/501'],
          payment_method_id: [7, 'Keeta'],
          amount,
          __count: count,
        },
      ])
    }

    return rpcOk(reqId, [])
  })
}

describe('Phase 14 — Blocker N2 (unavailable sections with partial warning) & Item B (batch sync)', () => {
  const savedEnv: Partial<Record<(typeof ODOO_ENV_KEYS)[number], string | undefined>> = {}

  beforeEach(() => {
    for (const k of ODOO_ENV_KEYS) savedEnv[k] = process.env[k]
    process.env.ODOO_URL = 'https://odoo-test.example.com'
    process.env.ODOO_DB = 'vf_test_db'
    process.env.ODOO_USERNAME = 'svc@example.com'
    process.env.ODOO_LOGIN = 'svc@example.com'
    process.env.ODOO_API_KEY = '0123456789abcdef0123456789abcdef'
    mockGlobalFilterState.current = null
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockGlobalFilterState.current = null
    for (const k of ODOO_ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k]
      else process.env[k] = savedEnv[k]
    }
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
  })

  describe('Blocker N2 — wrapped sub-query failures produce null + partial warning, never 0', () => {
    const SECTIONS: readonly WrappedSectionKey[] = [
      'hourly',
      'channels.month',
      'channels.week',
      'channels.today',
      'channels.year',
      'year',
    ]
    const MODES: readonly FailureMode[] = ['count', 'net', 'both']

    describe.each(SECTIONS)('section %s', (section) => {
      it.each(MODES)(
        `marks ${section} as null with partial=true, warning, and non-OK_LIVE diagnosticCode when %s fails while keeping other sections identical`,
        async (mode) => {
          // 1. Capture baseline normal-run values first
          bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
          const normalSpy = installOdooMockWithOptionalSectionFailure()
          const periodForEnvelope =
            section === 'year' || section === 'channels.year'
              ? 'year'
              : section === 'channels.week'
                ? 'week'
                : section === 'channels.today'
                  ? 'today'
                  : 'month'

          const normalEnvelope = await fetchLiveOdooSnapshot({
            period: periodForEnvelope,
            forceRefresh: true,
            referenceNowMs: TEST_REF_NOW_MS,
          })
          normalSpy.mockRestore()

          // 2. Run with targeted sub-query failure
          bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
          const errConsoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
          const warnConsoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
          installOdooMockWithOptionalSectionFailure({ section, mode })

          const envelope = await fetchLiveOdooSnapshot({
            period: periodForEnvelope,
            forceRefresh: true,
            referenceNowMs: TEST_REF_NOW_MS,
          })

          // Envelope & summary partial metadata
          expect(envelope.connected).toBe(true)
          expect(envelope.partial).toBe(true)
          expect(envelope.summary?.partial).toBe(true)
          expect(envelope.unavailableSections).toContain(section)
          expect(envelope.summary?.unavailableSections).toContain(section)
          expect(envelope.warningAr).toBeTruthy()
          expect(envelope.warningEn).toBeTruthy()
          expect(envelope.summary?.warningAr).toBeTruthy()
          expect(envelope.summary?.warningEn).toBeTruthy()
          expect(envelope.diagnosticCode).toBeDefined()
          expect(envelope.diagnosticCode).not.toBe('OK_LIVE')

          // Never leak raw Odoo URL or API key in payload or console logs
          const serialized = JSON.stringify(envelope)
          expect(serialized).not.toContain('odoo-test.example.com')
          expect(serialized).not.toContain('0123456789abcdef0123456789abcdef')
          for (const call of [...errConsoleSpy.mock.calls, ...warnConsoleSpy.mock.calls]) {
            const msg = call.map(String).join(' ')
            expect(msg).not.toContain('0123456789abcdef0123456789abcdef')
          }

          const buckets = envelope.summary?.buckets
          const normalBuckets = normalEnvelope.summary?.buckets
          expect(buckets).toBeDefined()
          expect(normalBuckets).toBeDefined()
          if (
            !buckets?.month ||
            !buckets.week ||
            !buckets.today ||
            !buckets.year ||
            !normalBuckets?.month ||
            !normalBuckets.week ||
            !normalBuckets.today ||
            !normalBuckets.year
          ) {
            throw new Error('Expected all 4 buckets on summary')
          }
          const bMap = {
            month: buckets.month,
            week: buckets.week,
            today: buckets.today,
            year: buckets.year,
          }
          const nMap = {
            month: normalBuckets.month,
            week: normalBuckets.week,
            today: normalBuckets.today,
            year: normalBuckets.year,
          }

          // Failed section is null (never 0) and average ticket for that section is not a number
          if (section === 'hourly') {
            expect(envelope.hourlySeries).toBeNull()
            expect(envelope.summary?.hourlySeries).toBeNull()
            const quietWs = computeGlobalWorkspace(
              { ...DEFAULT_GLOBAL_FILTERS, period: 'month', kuwaitSlice: 'quiet-hours' },
              envelope.summary,
            )
            expect(quietWs.nullableSalesKwd).toBeNull()
            expect(quietWs.nullableOrders).toBeNull()
            expect(typeof quietWs.nullableAovKwd).not.toBe('number')
          } else {
            expect(envelope.hourlySeries).toEqual(normalEnvelope.hourlySeries)
          }

          for (const bktKey of ['month', 'week', 'today', 'year'] as const) {
            const chSection = `channels.${bktKey}` as const
            if (section === chSection) {
              expect(bMap[bktKey].uiChannels).toBeNull()
              expect(bMap[bktKey].byLocation?.promenade?.uiChannels).toBeNull()
              expect(envelope.channels).toBeNull()
              const chWs = computeGlobalWorkspace(
                { ...DEFAULT_GLOBAL_FILTERS, period: bktKey, channel: 'keeta' },
                envelope.summary,
              )
              expect(chWs.nullableSalesKwd).toBeNull()
              expect(chWs.nullableOrders).toBeNull()
              expect(typeof chWs.nullableAovKwd).not.toBe('number')
            } else {
              expect(bMap[bktKey].uiChannels).toEqual(nMap[bktKey].uiChannels)
            }
          }

          if (section === 'year') {
            expect(bMap.year.totals).toEqual({
              netSalesKwd: null,
              orders: null,
              aovKwd: null,
              restaurantNetKwd: null,
              restaurantOrders: null,
            })
            expect(typeof bMap.year.totals.aovKwd).not.toBe('number')
            expect(envelope.totals).toEqual({ netSalesKwd: null, orders: null, aovKwd: null })
            const yrWs = computeGlobalWorkspace(
              { ...DEFAULT_GLOBAL_FILTERS, period: 'year' },
              envelope.summary,
            )
            expect(yrWs.nullableSalesKwd).toBeNull()
            expect(yrWs.nullableOrders).toBeNull()
            expect(typeof yrWs.nullableAovKwd).not.toBe('number')
          } else {
            expect(bMap.year.totals).toEqual(nMap.year.totals)
          }

          expect(envelope.summary?.journeyPulse).toEqual(normalEnvelope.summary?.journeyPulse)

          // Non-failed month/week/today totals always equal normal run
          expect(bMap.month.totals).toEqual(nMap.month.totals)
          expect(bMap.week.totals).toEqual(nMap.week.totals)
          expect(bMap.today.totals).toEqual(nMap.today.totals)
        },
      )
    })

    it('keeps partial=false, unavailableSections=[], OK_LIVE, and exact refund/count semantics on normal runs', async () => {
      installOdooMockWithOptionalSectionFailure()
      const normalEnvelope = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      expect(normalEnvelope.partial).toBe(false)
      expect(normalEnvelope.unavailableSections).toEqual([])
      expect(normalEnvelope.diagnosticCode).toBe('OK_LIVE')
      expect(normalEnvelope.warningAr).toBeUndefined()
      expect(normalEnvelope.warningEn).toBeUndefined()
      expect(normalEnvelope.totals).toEqual({ netSalesKwd: 300, orders: 10, aovKwd: 30 })

      // 10 orders (+100 KWD) + 1 big refund (-120 KWD) -> 9 orders, net -20 KWD
      vi.restoreAllMocks()
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number
          params?: { service?: string; method?: string; args?: unknown[] }
        }
        const reqId = body.id ?? 1
        if (body.params?.service === 'common' && body.params?.method === 'authenticate') {
          return rpcOk(reqId, 7)
        }
        const args = body.params?.args ?? []
        const model = String(args[3] ?? '')
        const method = String(args[4] ?? '')
        const methodArgs = (args[5] as unknown[]) ?? []
        const domainStr = JSON.stringify(methodArgs[0] ?? [])
        const groupby = (methodArgs[2] as string[]) ?? []

        if (model === 'pos.config' && method === 'search_read') {
          return rpcOk(reqId, [
            { id: 8, name: 'Promenade 1', active: true, company_id: [1, 'Venture Foods'] },
          ])
        }
        if (model === 'res.users' && method === 'read') {
          return rpcOk(reqId, [{ id: 7, company_id: [1, 'Venture Foods'] }])
        }
        if (model === 'pos.session' && method === 'read') {
          return rpcOk(reqId, [{ id: 501, config_id: [8, 'Promenade 1'] }])
        }
        if (model === 'pos.order' && method === 'read_group' && groupby.includes('date_order:day')) {
          if (domainStr.includes('["amount_total",">=",0]')) {
            return rpcOk(reqId, [
              { session_id: [501, 'POS/501'], pricelist_id: false, __count: 9, __range: KW_DAY_NOV_15 },
            ])
          }
          return rpcOk(reqId, [
            {
              session_id: [501, 'POS/501'],
              pricelist_id: false,
              amount_total: -20,
              amount_tax: 0,
              __count: 10,
              __range: KW_DAY_NOV_15,
            },
          ])
        }
        if (model === 'pos.order' && method === 'search_count') return rpcOk(reqId, 0)
        return rpcOk(reqId, [])
      })

      const mixedRefundEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      expect(mixedRefundEnv.partial).toBe(false)
      expect(mixedRefundEnv.unavailableSections).toEqual([])
      expect(mixedRefundEnv.totals.orders).toBe(9)
      expect(mixedRefundEnv.totals.netSalesKwd).toBe(-20)

      // Refund-only -> 0 orders, negative net, partial=false
      vi.restoreAllMocks()
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number
          params?: { service?: string; method?: string; args?: unknown[] }
        }
        const reqId = body.id ?? 1
        if (body.params?.service === 'common' && body.params?.method === 'authenticate') {
          return rpcOk(reqId, 7)
        }
        const args = body.params?.args ?? []
        const model = String(args[3] ?? '')
        const method = String(args[4] ?? '')
        const methodArgs = (args[5] as unknown[]) ?? []
        const domainStr = JSON.stringify(methodArgs[0] ?? [])
        const groupby = (methodArgs[2] as string[]) ?? []

        if (model === 'pos.config' && method === 'search_read') {
          return rpcOk(reqId, [
            { id: 8, name: 'Promenade 1', active: true, company_id: [1, 'Venture Foods'] },
          ])
        }
        if (model === 'res.users' && method === 'read') {
          return rpcOk(reqId, [{ id: 7, company_id: [1, 'Venture Foods'] }])
        }
        if (model === 'pos.session' && method === 'read') {
          return rpcOk(reqId, [{ id: 501, config_id: [8, 'Promenade 1'] }])
        }
        if (model === 'pos.order' && method === 'read_group' && groupby.includes('date_order:day')) {
          if (domainStr.includes('["amount_total",">=",0]')) {
            return rpcOk(reqId, [])
          }
          return rpcOk(reqId, [
            {
              session_id: [501, 'POS/501'],
              pricelist_id: false,
              amount_total: -45,
              amount_tax: 0,
              __count: 2,
              __range: KW_DAY_NOV_15,
            },
          ])
        }
        if (model === 'pos.order' && method === 'search_count') return rpcOk(reqId, 0)
        return rpcOk(reqId, [])
      })

      const refundOnlyEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      expect(refundOnlyEnv.partial).toBe(false)
      expect(refundOnlyEnv.unavailableSections).toEqual([])
      expect(refundOnlyEnv.totals.orders).toBe(0)
      expect(refundOnlyEnv.totals.netSalesKwd).toBe(-45)

      const tooltipQuery = describePosOrderQuery({
        fromKuwaitDate: '2026-10-17',
        toInclusiveKuwaitDate: '2026-11-15',
        companyId: 1,
        aggregate: 'search_count',
      })
      expect(tooltipQuery).toContain('["amount_total",">=",0]')
    })

    it('renders "غير متاح" / "—" (never "0") and shows the warning banner in UI components when a section is null', async () => {
      // 1. FullJourney360 on period='year' when YTD ('year') failed
      installOdooMockWithOptionalSectionFailure({ section: 'year', mode: 'count' })
      const yearFailedEnv = await fetchLiveOdooSnapshot({
        period: 'year',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      const yearFilters: Required<GlobalFilters> = {
        ...DEFAULT_GLOBAL_FILTERS,
        period: 'year',
      }
      const yearWorkspace = computeGlobalWorkspace(yearFilters, yearFailedEnv.summary)
      mockGlobalFilterState.current = {
        filters: yearFilters,
        workspace: yearWorkspace,
        liveSummary: yearFailedEnv.summary,
        isAuditor: false,
        sessionRole: 'admin',
        syncingOdoo: false,
        syncCooldownSec: 0,
        triggerOdooSyncNow: async () => {},
        setPeriod: () => {},
        setCustomRange: () => {},
        setKuwaitSlice: () => {},
        setBrand: () => {},
        setBranch: () => {},
        setChannel: () => {},
        setLens: () => {},
        resetFilters: () => {},
        buildShareDeepLinkText: () => '',
      }

      const TypedLangProvider = LanguageProvider as React.ComponentType<{
        initialLocale: 'ar' | 'en'
        children?: React.ReactNode
      }>

      const journeyArHtml = renderToStaticMarkup(
        React.createElement(
          TypedLangProvider,
          { initialLocale: 'ar' },
          React.createElement(FullJourney360),
        ),
      )
      expect(journeyArHtml).toContain('data-odoo-partial-warning="true"')
      expect(journeyArHtml).toContain('بعض الأرقام غير متاحة الآن')
      expect(journeyArHtml).toContain('غير متاح')
      expect(journeyArHtml).not.toContain('• متوسط 0.00 د.ك')

      const journeyEnHtml = renderToStaticMarkup(
        React.createElement(
          TypedLangProvider,
          { initialLocale: 'en' },
          React.createElement(FullJourney360),
        ),
      )
      expect(journeyEnHtml).toContain('data-odoo-partial-warning="true"')
      expect(journeyEnHtml).toContain('Some figures are temporarily unavailable')
      expect(journeyEnHtml).toContain('• AOV —')
      expect(journeyEnHtml).not.toContain('• AOV 0.00 KWD')

      // 2. DeliveryRadarV5 on period='month' when 'channels.month' failed
      vi.restoreAllMocks()
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      installOdooMockWithOptionalSectionFailure({ section: 'channels.month', mode: 'count' })
      const chFailedEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      const monthFilters: Required<GlobalFilters> = {
        ...DEFAULT_GLOBAL_FILTERS,
        period: 'month',
      }
      const monthWorkspace = computeGlobalWorkspace(monthFilters, chFailedEnv.summary)
      mockGlobalFilterState.current = {
        ...mockGlobalFilterState.current,
        filters: monthFilters,
        workspace: monthWorkspace,
        liveSummary: chFailedEnv.summary,
      }

      const radarHtml = renderToStaticMarkup(
        React.createElement(
          TypedLangProvider,
          { initialLocale: 'ar' },
          React.createElement(DeliveryRadarV5),
        ),
      )
      expect(radarHtml).toContain('data-odoo-partial-warning="true"')
      expect(radarHtml).toContain('بعض الأرقام غير متاحة الآن')
      expect(radarHtml).toContain('غير متاح')
      expect(radarHtml).not.toContain('0 طلب مباشر بدون عمولة تطبيقات')
    })
  })

  describe('Item B — scripts/sync-odoo-live.mjs & scripts/build-odoo-dataset.mjs', () => {
    it.each([
      'session_read_group',
      'bucket_session_read_group',
      'bucket_payment_read_group',
      'brand_search_count',
    ] as const)(
      'aborts non-zero without writing any snapshot file when %s fails for a non-permission reason',
      async (failurePoint) => {
        vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
          throw new Error(`process.exit(${code})`)
        }) as never)
        const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {})

        const syncMod = (await import('../../../scripts/sync-odoo-live.mjs')) as Record<
          string,
          unknown
        >
        expect(typeof syncMod.runSyncOdooLive).toBe('function')

        const runSyncOdooLive = syncMod.runSyncOdooLive as (opts: {
          odooUrl: string
          odooDb: string
          odooLogin: string
          odooApiKey: string
          period: { from: string; to: string }
          today: string
          skipJourney: boolean
          rpcImpl: (service: string, method: string, args: unknown[]) => Promise<unknown>
          writeFileImpl: (filePath: string, data: string) => void
          silent?: boolean
        }) => Promise<unknown>

        let orderReadGroupCalls = 0
        let paymentReadGroupCalls = 0
        const writtenFiles: string[] = []
        await expect(
          runSyncOdooLive({
            odooUrl: 'https://odoo-test.example.com',
            odooDb: 'vf_test_db',
            odooLogin: 'svc@example.com',
            odooApiKey: '0123456789abcdef0123456789abcdef',
            period: { from: '2026-10-16', to: '2026-11-15' },
            today: '2026-11-15',
            skipJourney: true,
            silent: true,
            writeFileImpl: (fp) => {
              writtenFiles.push(fp)
            },
            rpcImpl: async (service, method, args) => {
              if (service === 'common' && method === 'version') return { server_version: '17.0' }
              if (service === 'common' && method === 'authenticate') return 7
              const model = String(args[3] ?? '')
              const kwMethod = String(args[4] ?? '')
              if (model === 'pos.config' && kwMethod === 'search_read') {
                return [{ id: 8, name: 'Promenade 1', active: true, company_id: [1, 'Venture Foods'] }]
              }
              if (model === 'pos.category' && kwMethod === 'search_read') {
                return [{ id: 10, name: 'CG', parent_id: false }]
              }
              if (model === 'pos.payment.method' && kwMethod === 'search_read') {
                return [{ id: 7, name: 'Keeta' }]
              }
              if (model === 'pos.session' && kwMethod === 'read') {
                return [{ id: 501, config_id: [8, 'Promenade 1'] }]
              }
              if (model === 'product.product' && kwMethod === 'read') {
                return [{ id: 99, pos_categ_id: [10, 'China Garden'], lst_price: 12, standard_price: 4 }]
              }
              if (model === 'pos.order' && kwMethod === 'read_group') {
                orderReadGroupCalls += 1
                if (failurePoint === 'session_read_group' && orderReadGroupCalls === 1) {
                  throw new Error('HTTP 502 Bad Gateway')
                }
                if (failurePoint === 'bucket_session_read_group' && orderReadGroupCalls === 2) {
                  throw new Error('HTTP 502 Bad Gateway')
                }
                return [{ session_id: [501, 'POS/501'], amount_total: 240, amount_tax: 0, __count: 20 }]
              }
              if (model === 'pos.order.line' && kwMethod === 'read_group') {
                return [{ product_id: [99, 'Sweet & Sour'], price_subtotal: 240, qty: 20 }]
              }
              if (model === 'pos.payment' && kwMethod === 'read_group') {
                paymentReadGroupCalls += 1
                if (failurePoint === 'bucket_payment_read_group' && paymentReadGroupCalls >= 2) {
                  throw new Error('HTTP 502 Bad Gateway')
                }
                return [{ session_id: [501, 'POS/501'], payment_method_id: [7, 'Keeta'], amount: 240, __count: 20 }]
              }
              if (model === 'pos.order' && kwMethod === 'search_count') {
                if (failurePoint === 'brand_search_count') {
                  throw new Error('HTTP 502 Bad Gateway')
                }
                return 20
              }
              return []
            },
          }),
        ).rejects.toThrow(/502/)

        expect(writtenFiles).toEqual([])
        expect(writeSpy).not.toHaveBeenCalled()
      },
    )

    it('never derives order counts from KWD (no / 4.8), records null on missing read permission, and formats null orders as "—"', async () => {
      const syncSource = await readFile(
        path.join(process.cwd(), 'scripts', 'sync-odoo-live.mjs'),
        'utf8',
      )
      expect(syncSource).not.toContain('4.8')

      vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new Error(`process.exit(${code})`)
      }) as never)
      vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {})

      const syncMod = (await import('../../../scripts/sync-odoo-live.mjs')) as Record<
        string,
        unknown
      >
      const buildMod = (await import('../../../scripts/build-odoo-dataset.mjs')) as Record<
        string,
        unknown
      >
      expect(typeof syncMod.runSyncOdooLive).toBe('function')
      expect(typeof buildMod.buildOdooDataset).toBe('function')

      const runSyncOdooLive = syncMod.runSyncOdooLive as (opts: {
        odooUrl: string
        odooDb: string
        odooLogin: string
        odooApiKey: string
        period: { from: string; to: string }
        today: string
        skipJourney: boolean
        rpcImpl: (service: string, method: string, args: unknown[]) => Promise<unknown>
        writeFileImpl: (filePath: string, data: string) => void
        silent?: boolean
      }) => Promise<{
        permissions: { missingRead: string[] }
        brands: { id: string; netKwd: number; orders: number | null; aovKwd: number | null }[]
        buckets: Record<
          string,
          {
            uiChannels: Record<string, { netKwd: number; orders: number | null }>
            byBrand: Record<string, { netKwd: number; orders: number | null }>
          }
        >
      }>

      let capturedSnapshotJson = ''
      const snapshot = await runSyncOdooLive({
        odooUrl: 'https://odoo-test.example.com',
        odooDb: 'vf_test_db',
        odooLogin: 'svc@example.com',
        odooApiKey: '0123456789abcdef0123456789abcdef',
        period: { from: '2026-10-16', to: '2026-11-15' },
        today: '2026-11-15',
        skipJourney: true,
        silent: true,
        writeFileImpl: (_fp, content) => {
          capturedSnapshotJson = content
        },
        rpcImpl: async (service, method, args) => {
          if (service === 'common' && method === 'version') return { server_version: '17.0' }
          if (service === 'common' && method === 'authenticate') return 7
          const model = String(args[3] ?? '')
          const kwMethod = String(args[4] ?? '')
          if (model === 'pos.config' && kwMethod === 'search_read') {
            return [{ id: 8, name: 'Promenade 1', active: true, company_id: [1, 'Venture Foods'] }]
          }
          if (model === 'pos.category' && kwMethod === 'search_read') {
            return [{ id: 10, name: 'CG', parent_id: false }]
          }
          if (model === 'pos.payment.method' && kwMethod === 'search_read') {
            return [{ id: 7, name: 'Keeta' }]
          }
          if (model === 'pos.session' && kwMethod === 'read') {
            return [{ id: 501, config_id: [8, 'Promenade 1'] }]
          }
          if (model === 'product.product' && kwMethod === 'read') {
            return [{ id: 99, pos_categ_id: [10, 'China Garden'], lst_price: 12, standard_price: 4 }]
          }
          if (model === 'pos.order' && kwMethod === 'read_group') {
            // 240 KWD net on Promenade session 501, 20 orders
            return [{ session_id: [501, 'POS/501'], amount_total: 240, amount_tax: 0, __count: 20 }]
          }
          if (model === 'pos.order.line' && kwMethod === 'read_group') {
            return [{ product_id: [99, 'Sweet & Sour'], price_subtotal: 240, qty: 20 }]
          }
          if (model === 'pos.order' && kwMethod === 'search_count') {
            // Simulate missing Odoo read permission on search_count -> must record in permissions.missingRead and yield null, never 0
            const err = new Error('AccessError: You are not allowed to access pos.order records.')
            throw err
          }
          if (model === 'pos.payment' && kwMethod === 'read_group') {
            // Intentionally return [] so reconciled netVal (240 KWD) has NO payment count; must be null, never 240 / 4.8 = 50!
            return []
          }
          return []
        },
      })

      expect(capturedSnapshotJson.length).toBeGreaterThan(0)
      expect(snapshot.permissions.missingRead).toContain('pos.order')

      const cgBrand = snapshot.brands.find((b) => b.id === 'china-garden')
      expect(cgBrand?.netKwd).toBe(240)
      expect(cgBrand?.orders).toBeNull()
      expect(cgBrand?.aovKwd).toBeNull()

      // Reconciled channel received 240 KWD on 'dine-in' with unknown payment count -> orders is null (NOT 50 from 240/4.8, and NOT 0)
      expect(snapshot.buckets.month.uiChannels['dine-in'].netKwd).toBe(240)
      expect(snapshot.buckets.month.uiChannels['dine-in'].orders).toBeNull()
      expect(snapshot.buckets.month.byBrand['china-garden'].orders).toBeNull()

      const registry = JSON.parse(
        await readFile(path.join(process.cwd(), 'src', 'lib', 'odoo', 'pos-registry.json'), 'utf8'),
      )
      const buildOdooDataset = buildMod.buildOdooDataset as (
        snap: unknown,
        reg: unknown,
      ) => {
        brands: { id: string; orders: number | null; aovKwd: number | null }[]
      }
      const dataset = buildOdooDataset(JSON.parse(capturedSnapshotJson), registry)
      const dsBrand = dataset.brands.find((b) => b.id === 'china-garden')
      expect(dsBrand?.orders).toBeNull()
      expect(dsBrand?.aovKwd).toBeNull()

      // Consumers format null as "—", never "0"
      expect(fmt(dsBrand?.orders as unknown as number)).toBe('—')
      expect(kwd(dsBrand?.aovKwd as unknown as number, 'ar')).toBe('—')
    })
  })

  describe('Wave 1 — Remaining Phase A Gaps (A1–A9)', () => {
    function buildMockGlobalFilterContext(
      filters: Required<GlobalFilters>,
      summary: NonNullable<Awaited<ReturnType<typeof fetchLiveOdooSnapshot>>['summary']>,
    ) {
      const workspace = computeGlobalWorkspace(filters, summary)
      return {
        filters,
        workspace,
        liveSummary: summary,
        isAuditor: false,
        sessionRole: 'admin' as const,
        syncingOdoo: false,
        syncCooldownSec: 0,
        triggerOdooSyncNow: async () => {},
        setPeriod: () => {},
        setCustomRange: () => {},
        setKuwaitSlice: () => {},
        setBrand: () => {},
        setBranch: () => {},
        setChannel: () => {},
        setLens: () => {},
        resetFilters: () => {},
        buildShareDeepLinkText: () => '',
      }
    }

    function installCustomPhaseAMock(opts?: {
      failBrandsMonth?: boolean
      failChannelsMonth?: boolean
      failYear?: boolean
      failHourly?: boolean
      failReceivables?: boolean
      failReceivablesAgingOnly?: boolean
      failStockTransfers?: boolean
      failStockCountOnly?: boolean
      failPosCategory?: boolean
      failProducts?: boolean
      failSessions?: boolean
      failExcludedMonth?: boolean
      failGlAccounts?: boolean
      includePostedGl?: boolean
      includeDecommissionedConfig?: boolean
    }) {
      return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number
          params?: { service?: string; method?: string; args?: unknown[] }
        }
        const reqId = body.id ?? 1
        if (body.params?.service === 'common' && body.params?.method === 'authenticate') {
          return rpcOk(reqId, 7)
        }
        const args = body.params?.args ?? []
        const model = String(args[3] ?? '')
        const method = String(args[4] ?? '')
        const methodArgs = (args[5] as unknown[]) ?? []
        const domainStr = JSON.stringify(methodArgs[0] ?? [])
        const groupby = (methodArgs[2] as string[]) ?? []

        if (model === 'pos.config' && method === 'search_read') {
          const configs = [
            { id: 8, name: 'Promenade 1', active: true, company_id: [1, 'Venture Foods'] },
          ]
          if (opts?.includeDecommissionedConfig) {
            configs.push({
              id: 25,
              name: 'Heisenberg 1',
              active: true,
              company_id: [1, 'Venture Foods'],
            })
          }
          return rpcOk(reqId, configs)
        }
        if (model === 'pos.category' && method === 'search_read') {
          if (opts?.failPosCategory) return rpcFault(reqId, 'pos.category unavailable')
          return rpcOk(reqId, [
            { id: 10, name: 'CG', parent_id: false },
            { id: 150, name: 'Heisenberg', parent_id: false },
          ])
        }
        if (model === 'account.account' && method === 'search_read') {
          if (opts?.failGlAccounts) return rpcFault(reqId, 'account.account unavailable')
          if (opts?.includePostedGl) {
            return rpcOk(reqId, [
              { id: 401, code: '4000', name: 'Food Sales', account_type: 'income' },
              { id: 501, code: '5000', name: 'Raw Food COGS', account_type: 'expense_direct_cost' },
              { id: 612, code: '6120', name: 'Talabat Commission', account_type: 'expense' },
              { id: 620, code: '6200', name: 'Branch Rent', account_type: 'expense' },
              {
                id: 700,
                code: '7000',
                name: 'Equipment Depreciation',
                account_type: 'expense_depreciation',
              },
            ])
          }
          return rpcOk(reqId, [])
        }
        if (model === 'res.users' && method === 'read') {
          return rpcOk(reqId, [{ id: 7, company_id: [1, 'Venture Foods'] }])
        }
        if (model === 'pos.order' && method === 'search_read') {
          return rpcOk(reqId, [
            {
              id: 1,
              date_order: '2026-11-15 10:15:00',
              amount_total: 300,
              config_id: [8, 'Promenade 1'],
              company_id: [1, 'Venture Foods'],
            },
          ])
        }
        if (model === 'pos.session' && method === 'read') {
          if (opts?.failSessions) return rpcFault(reqId, 'pos.session unavailable')
          return rpcOk(reqId, [{ id: 501, config_id: [8, 'Promenade 1'] }])
        }
        if (model === 'product.product' && method === 'read') {
          if (opts?.failProducts) return rpcFault(reqId, 'product.product unavailable')
          return rpcOk(reqId, [{ id: 99, name: 'Sweet & Sour', pos_categ_id: [10, 'CG'] }])
        }

        if (model === 'pos.order' && method === 'read_group') {
          if (domainStr.includes('[25]')) {
            if (opts?.failExcludedMonth) return rpcFault(reqId, 'excluded.month unavailable')
            return rpcOk(reqId, [
              {
                session_id: [601, 'POS/601'],
                amount_total: 50,
                amount_tax: 0,
                __count: 2,
                __range: KW_DAY_NOV_15,
              },
            ])
          }
          const isCount = domainStr.includes('["amount_total",">=",0]')
          if (groupby.includes('date_order:day')) {
            if (isCount) {
              return rpcOk(reqId, [
                {
                  session_id: [501, 'POS/501'],
                  pricelist_id: [3, 'Talabat Go'],
                  __count: 10,
                  __range: KW_DAY_NOV_15,
                },
              ])
            }
            return rpcOk(reqId, [
              {
                session_id: [501, 'POS/501'],
                pricelist_id: [3, 'Talabat Go'],
                amount_total: 300,
                amount_tax: 0,
                __count: 10,
                __range: KW_DAY_NOV_15,
              },
            ])
          }
          if (groupby.includes('date_order:hour')) {
            if (opts?.failHourly) return rpcFault(reqId, 'hourly unavailable')
            if (isCount) return rpcOk(reqId, [{ __count: 4, __range: KW_HOUR_13 }])
            return rpcOk(reqId, [{ amount_total: 120, amount_tax: 0, __count: 4, __range: KW_HOUR_13 }])
          }
          if (groupby.length === 1 && groupby[0] === 'session_id') {
            if (opts?.failYear) return rpcFault(reqId, 'year unavailable')
            if (isCount) return rpcOk(reqId, [{ session_id: [501, 'POS/501'], __count: 400 }])
            return rpcOk(reqId, [
              { session_id: [501, 'POS/501'], amount_total: 12000, amount_tax: 0, __count: 400 },
            ])
          }
          if (groupby.length === 0) {
            return rpcOk(reqId, [{ amount_total: 8400, amount_tax: 0, __count: 280 }])
          }
          return rpcOk(reqId, [])
        }

        if (model === 'pos.order' && method === 'search_count') {
          return rpcOk(reqId, 280)
        }

        if (model === 'pos.order.line' && method === 'read_group') {
          const domainClauses = (methodArgs[0] as unknown[][]) ?? []
          const gteClause = domainClauses.find(
            (c) => Array.isArray(c) && c[0] === 'order_id.date_order' && c[1] === '>=',
          )
          const ltClause = domainClauses.find(
            (c) => Array.isArray(c) && c[0] === 'order_id.date_order' && c[1] === '<',
          )
          if (opts?.failBrandsMonth && isExactMonthWindow(gteClause?.[2], ltClause?.[2])) {
            return rpcFault(reqId, 'brands.month unavailable')
          }
          return rpcOk(reqId, [{ product_id: [99, 'Sweet & Sour'], price_subtotal: 300, qty: 20 }])
        }

        if (model === 'pos.payment' && method === 'read_group') {
          const domainClauses = (methodArgs[0] as unknown[][]) ?? []
          const gteClause = domainClauses.find(
            (c) => Array.isArray(c) && c[0] === 'pos_order_id.date_order' && c[1] === '>=',
          )
          const ltClause = domainClauses.find(
            (c) => Array.isArray(c) && c[0] === 'pos_order_id.date_order' && c[1] === '<',
          )
          if (opts?.failChannelsMonth && isExactMonthWindow(gteClause?.[2], ltClause?.[2])) {
            return rpcFault(reqId, 'channels.month unavailable')
          }
          const isCount = domainStr.includes('["pos_order_id.amount_total",">=",0]')
          if (isCount) {
            return rpcOk(reqId, [{ session_id: [501, 'POS/501'], payment_method_id: [7, 'Keeta'], __count: 6 }])
          }
          return rpcOk(reqId, [
            { session_id: [501, 'POS/501'], payment_method_id: [7, 'Keeta'], amount: 180, __count: 6 },
          ])
        }

        if (model === 'stock.picking') {
          if (opts?.failStockTransfers) return rpcFault(reqId, 'stock.picking unavailable')
          if (opts?.failStockCountOnly && method === 'search_count') {
            return rpcFault(reqId, 'stock.picking search_count unavailable')
          }
          if (method === 'search_count') return rpcOk(reqId, 5)
          return rpcOk(reqId, [
            {
              id: 900,
              state: 'done',
              scheduled_date: '2026-11-15 08:00:00',
              date_done: '2026-11-15 09:00:00',
              location_id: [10, 'CK/Stock'],
              location_dest_id: [11, 'PRM/Stock'],
            },
          ])
        }

        if (model === 'account.move.line') {
          if (domainStr.includes('asset_receivable')) {
            if (opts?.failReceivables) return rpcFault(reqId, 'receivables unavailable')
            if (
              opts?.failReceivablesAgingOnly &&
              method === 'read_group' &&
              domainStr.includes('"date"')
            ) {
              return rpcFault(reqId, 'receivables aging read_group unavailable')
            }
            if (method === 'read_group') {
              return rpcOk(reqId, [
                { account_id: [105, '10501 Talabat Receivable'], amount_residual: 450, __count: 12 },
              ])
            }
            return rpcOk(reqId, [{ date: '2026-11-15', date_maturity: '2026-11-20' }])
          }
          if (opts?.includePostedGl && method === 'read_group') {
            return rpcOk(reqId, [
              { account_id: [401, '4000 Food Sales'], balance: -1000, __count: 5 },
              { account_id: [501, '5000 Raw Food COGS'], balance: 300, __count: 3 },
              { account_id: [612, '6120 Talabat Commission'], balance: 100, __count: 2 },
              { account_id: [620, '6200 Branch Rent'], balance: 150, __count: 1 },
              { account_id: [700, '7000 Equipment Depreciation'], balance: 50, __count: 1 },
            ])
          }
          return rpcOk(reqId, [])
        }

        return rpcOk(reqId, [])
      })
    }

    const TypedLangProvider = LanguageProvider as React.ComponentType<{
      initialLocale: 'ar' | 'en'
      children?: React.ReactNode
    }>
    const TypedCoresHubStudio = CoresHubStudio as React.ComponentType<{
      initialTab?: 'sales' | 'menu' | 'marketing'
    }>

    it('A1: SalesScorecardStudio renders "—" / "غير متاح" (never 0 KWD, 0.0%, or China Garden default) when brands.month, channels.month, or year fails', async () => {
      // 1. brands.month failed
      installCustomPhaseAMock({ failBrandsMonth: true })
      const brandFailedEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      if (!brandFailedEnv.summary) throw new Error('Expected summary')
      mockGlobalFilterState.current = buildMockGlobalFilterContext(
        { ...DEFAULT_GLOBAL_FILTERS, period: 'month' },
        brandFailedEnv.summary,
      )

      const scorecardBrandsAr = renderToStaticMarkup(
        React.createElement(TypedLangProvider, { initialLocale: 'ar' }, React.createElement(SalesScorecardStudio)),
      )
      expect(scorecardBrandsAr).toContain('data-odoo-partial-warning="true"')
      expect(scorecardBrandsAr).toContain('غير متاح')
      // Top Performing Brand card must NOT default to China Garden when brand sales are unavailable
      expect(scorecardBrandsAr).not.toContain('truncate">تشاينا جاردن<')

      const scorecardBrandsEn = renderToStaticMarkup(
        React.createElement(TypedLangProvider, { initialLocale: 'en' }, React.createElement(SalesScorecardStudio)),
      )
      expect(scorecardBrandsEn).not.toContain('truncate">China Garden<')
      // China Garden row must show "—" rather than "0 KWD" / "0.0%"
      const brandSectionEn =
        scorecardBrandsEn.split('7 Active Branches Scorecard')[0]?.split('6 Brands Scorecard')[1] ?? ''
      expect(brandSectionEn).toContain('—')
      expect(brandSectionEn).not.toContain('>0 KWD<')
      expect(brandSectionEn).not.toContain('0.0%')

      // 2. channels.month failed
      vi.restoreAllMocks()
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      installCustomPhaseAMock({ failChannelsMonth: true })
      const chFailedEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      if (!chFailedEnv.summary) throw new Error('Expected summary')
      mockGlobalFilterState.current = buildMockGlobalFilterContext(
        { ...DEFAULT_GLOBAL_FILTERS, period: 'month' },
        chFailedEnv.summary,
      )
      const scorecardChannelsEn = renderToStaticMarkup(
        React.createElement(TypedLangProvider, { initialLocale: 'en' }, React.createElement(SalesScorecardStudio)),
      )
      const channelSectionEn = scorecardChannelsEn.split('8 Sales Channels Scorecard')[1] ?? ''
      expect(channelSectionEn).toContain('—')
      expect(channelSectionEn).not.toContain('>0 KWD<')
      expect(channelSectionEn).not.toContain('0.0%')

      // 3. year failed -> all 3 columns (Brands, Branches, Channels) and Top Brand are unavailable
      vi.restoreAllMocks()
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      installCustomPhaseAMock({ failYear: true })
      const yrFailedEnv = await fetchLiveOdooSnapshot({
        period: 'year',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      if (!yrFailedEnv.summary) throw new Error('Expected summary')
      mockGlobalFilterState.current = buildMockGlobalFilterContext(
        { ...DEFAULT_GLOBAL_FILTERS, period: 'year' },
        yrFailedEnv.summary,
      )
      const scorecardYearEn = renderToStaticMarkup(
        React.createElement(TypedLangProvider, { initialLocale: 'en' }, React.createElement(SalesScorecardStudio)),
      )
      expect(scorecardYearEn).not.toContain('>0 KWD<')
      expect(scorecardYearEn).not.toContain('0.0%')
      expect(scorecardYearEn).not.toContain('truncate">China Garden<')
    })

    it('A2: ExecutivePnlStudio renders "—" / "غير متاح" with no 2% progress bar when brands.month or year fails', async () => {
      // 1. brands.month failed
      installCustomPhaseAMock({ failBrandsMonth: true, includePostedGl: true })
      const brandFailedEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      if (!brandFailedEnv.summary) throw new Error('Expected summary')
      mockGlobalFilterState.current = buildMockGlobalFilterContext(
        { ...DEFAULT_GLOBAL_FILTERS, period: 'month' },
        brandFailedEnv.summary,
      )

      const pnlBrandsAr = renderToStaticMarkup(
        React.createElement(TypedLangProvider, { initialLocale: 'ar' }, React.createElement(ExecutivePnlStudio)),
      )
      const brandsBlockAr = pnlBrandsAr.split('مساهمة الـ 7 فروع')[0]?.split('مساهمة الـ 6 علامات')[1] ?? ''
      expect(brandsBlockAr).toContain('غير متاح')
      expect(brandsBlockAr).not.toContain('0 د.ك (0.0%)')
      expect(brandsBlockAr).not.toContain('width:2%')

      // 2. year failed -> both brand & branch contribution sections show "—" with zero 2% bars
      vi.restoreAllMocks()
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      installCustomPhaseAMock({ failYear: true, includePostedGl: true })
      const yrFailedEnv = await fetchLiveOdooSnapshot({
        period: 'year',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      if (!yrFailedEnv.summary) throw new Error('Expected summary')
      mockGlobalFilterState.current = buildMockGlobalFilterContext(
        { ...DEFAULT_GLOBAL_FILTERS, period: 'year' },
        yrFailedEnv.summary,
      )

      const pnlYearEn = renderToStaticMarkup(
        React.createElement(TypedLangProvider, { initialLocale: 'en' }, React.createElement(ExecutivePnlStudio)),
      )
      const contribTailEn = pnlYearEn.split('Revenue Contribution Across 6 Brands')[1] ?? ''
      expect(contribTailEn).toContain('—')
      expect(contribTailEn).not.toContain('0 KWD (0.0%)')
      expect(contribTailEn).not.toContain('width:2%')
    })

    it('A3: computeCoresHubSnapshot & CoresHubStudio expose branchesUnavailable, brandsUnavailable, menuUnavailable and render "—" / "غير متاح" instead of 0.000 KWD / 0 orders / 0 SKUs', async () => {
      // 1. year failed -> branchesUnavailable, brandsUnavailable, menuUnavailable all true
      installCustomPhaseAMock({ failYear: true })
      const yrFailedEnv = await fetchLiveOdooSnapshot({
        period: 'year',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      if (!yrFailedEnv.summary) throw new Error('Expected summary')
      const yrFilters: Required<GlobalFilters> = { ...DEFAULT_GLOBAL_FILTERS, period: 'year' }
      const yrCoresSnap = computeCoresHubSnapshot(yrFilters, [], yrFailedEnv.summary, null)
      expect((yrCoresSnap.sales as Record<string, unknown>).branchesUnavailable).toBe(true)
      expect((yrCoresSnap.sales as Record<string, unknown>).brandsUnavailable).toBe(true)
      expect((yrCoresSnap.menu as Record<string, unknown>).menuUnavailable).toBe(true)
      expect(yrCoresSnap.sales.branchRanking).toEqual([])
      expect(yrCoresSnap.sales.brandShare).toEqual([])

      mockGlobalFilterState.current = buildMockGlobalFilterContext(yrFilters, yrFailedEnv.summary)
      const coresSalesEn = renderToStaticMarkup(
        React.createElement(
          TypedLangProvider,
          { initialLocale: 'en' },
          React.createElement(TypedCoresHubStudio, { initialTab: 'sales' }),
        ),
      )
      expect(coresSalesEn).toContain('data-odoo-partial-warning="true"')
      expect(coresSalesEn).not.toContain('0.000 KWD')
      expect(coresSalesEn).not.toContain('0 orders on unmapped POS configs')
      const branchesAndBrandsEn =
        coresSalesEn.split('Sales &amp; Delivery Channels')[0]?.split('7 Branches + Unattributed Row')[1] ?? ''
      expect(branchesAndBrandsEn).toContain('—')
      expect(branchesAndBrandsEn).not.toContain('0 orders · 0.0%')

      // 2. brands.month failed -> brands card on Sales tab and SKUs/Units/Net Sales on Menu tab show "غير متاح" / "—"
      vi.restoreAllMocks()
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      installCustomPhaseAMock({ failBrandsMonth: true })
      const brFailedEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      if (!brFailedEnv.summary) throw new Error('Expected summary')
      const moFilters: Required<GlobalFilters> = { ...DEFAULT_GLOBAL_FILTERS, period: 'month' }
      const moCoresSnap = computeCoresHubSnapshot(moFilters, [], brFailedEnv.summary, null)
      expect((moCoresSnap.sales as Record<string, unknown>).brandsUnavailable).toBe(true)
      expect((moCoresSnap.menu as Record<string, unknown>).menuUnavailable).toBe(true)

      mockGlobalFilterState.current = buildMockGlobalFilterContext(moFilters, brFailedEnv.summary)
      const coresBrandsCardAr = renderToStaticMarkup(
        React.createElement(
          TypedLangProvider,
          { initialLocale: 'ar' },
          React.createElement(TypedCoresHubStudio, { initialTab: 'sales' }),
        ),
      )
      const brandsColAr =
        coresBrandsCardAr.split('قنوات البيع والتوصيل')[0]?.split('العلامات التجارية الست')[1] ?? ''
      expect(brandsColAr).toContain('غير متاح')

      const coresMenuEn = renderToStaticMarkup(
        React.createElement(
          TypedLangProvider,
          { initialLocale: 'en' },
          React.createElement(TypedCoresHubStudio, { initialTab: 'menu' }),
        ),
      )
      expect(coresMenuEn).toContain('data-odoo-partial-warning="true"')
      expect(coresMenuEn).toContain('—')
      expect(coresMenuEn).not.toContain('0.000')
      expect(coresMenuEn).not.toContain('No matching POS items in this period')
    })

    it('A4: receivables & stockTransfers failures set workspace.receivables.unavailable=true and render "—" / "غير متاح" (never 0) across all 7 consumers plus VF-POS-01 brand guard', async () => {
      installCustomPhaseAMock({
        failReceivables: true,
        failStockTransfers: true,
        failBrandsMonth: true,
        includePostedGl: true,
      })
      const env = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      expect(env.partial).toBe(true)
      expect(env.unavailableSections).toContain('receivables')
      expect(env.unavailableSections).toContain('stockTransfers')
      expect(env.aggregatorReceivables).toBeNull()
      expect(env.stockTransfers).toBeNull()
      expect(env.summary?.aggregatorReceivables).toBeNull()
      expect(env.summary?.stockTransfers).toBeNull()
      if (!env.summary) throw new Error('Expected summary')

      const moFilters: Required<GlobalFilters> = { ...DEFAULT_GLOBAL_FILTERS, period: 'month' }
      const ctx = buildMockGlobalFilterContext(moFilters, env.summary)
      mockGlobalFilterState.current = ctx
      const ws = ctx.workspace

      // 1. global-filter-engine receivables & summaryCards[2] ('delivery-dues')
      expect((ws.receivables as unknown as Record<string, unknown>).unavailable).toBe(true)
      const duesCard = ws.summaryCards.find((c) => c.id === 'delivery-dues')
      expect(duesCard?.valueAr).toBe('غير متاح')
      expect(duesCard?.valueEn).toBe('—')
      expect(duesCard?.statusDot).toBe('🟠')
      expect(duesCard?.descAr).not.toContain('0.00')
      expect(duesCard?.descEn).not.toContain('0.00')

      // 2. FullJourney360 (receivables + stockTransfers === null)
      const journeyEn = renderToStaticMarkup(
        React.createElement(TypedLangProvider, { initialLocale: 'en' }, React.createElement(FullJourney360)),
      )
      const journeyAr = renderToStaticMarkup(
        React.createElement(TypedLangProvider, { initialLocale: 'ar' }, React.createElement(FullJourney360)),
      )
      expect(journeyEn).toContain('data-odoo-partial-warning="true"')
      expect(journeyEn).not.toContain('0 unreconciled lines')
      expect(journeyAr).not.toContain('0 قيد غير مسوّى')
      const arBlockEn = journeyEn.split('Ask Feryal About Odoo Data')[0]?.split('Unreconciled Open Receivables')[1] ?? ''
      expect(arBlockEn).toContain('—')
      expect(arBlockEn).not.toContain('0.000')

      // 3. DeliveryRadarV5
      const radarEn = renderToStaticMarkup(
        React.createElement(TypedLangProvider, { initialLocale: 'en' }, React.createElement(DeliveryRadarV5)),
      )
      expect(radarEn).toContain('data-odoo-partial-warning="true"')
      expect(radarEn).not.toContain('0 unreconciled receivable lines')
      const radarArCardEn = radarEn.split('Sales by Delivery Platform')[0]?.split('Open Unreconciled Receivables')[1] ?? ''
      expect(radarArCardEn).toContain('—')
      expect(radarArCardEn).not.toContain('0.000')

      // 4. ReceivablesAgingStudio (+ OdooPartialWarningBanner)
      const agingEn = renderToStaticMarkup(
        React.createElement(TypedLangProvider, { initialLocale: 'en' }, React.createElement(ReceivablesAgingStudio)),
      )
      const agingAr = renderToStaticMarkup(
        React.createElement(TypedLangProvider, { initialLocale: 'ar' }, React.createElement(ReceivablesAgingStudio)),
      )
      expect(agingEn).toContain('data-odoo-partial-warning="true"')
      expect(agingAr).toContain('data-odoo-partial-warning="true"')
      expect(agingEn).not.toContain('0.000 KWD')
      expect(agingEn).not.toContain('+0.000 KWD')
      expect(agingEn).not.toContain('-0.000 KWD')
      expect(agingEn).not.toContain('0 POS clearing')
      expect(agingAr).toContain('غير متاح')

      // 5 & 6. VentureAccountingHub (!embeddedInErp banner + receivables tab) & OdooAccountingAnalyticsHub
      const ventureGlEn = renderToStaticMarkup(
        React.createElement(
          TypedLangProvider,
          { initialLocale: 'en' },
          React.createElement(VentureAccountingHub, { locale: 'en', embeddedInErp: false }),
        ),
      )
      expect(ventureGlEn).toContain('data-odoo-partial-warning="true"')
      expect(ventureGlEn).not.toContain('0 unreconciled AR lines')
      const glArCardEn = ventureGlEn.split('Net Open Receivables (AR)')[1] ?? ''
      expect(glArCardEn).toContain('—')
      expect(glArCardEn).not.toContain('0.000 KWD')

      const ventureRecTabEn = renderToStaticMarkup(
        React.createElement(
          TypedLangProvider,
          { initialLocale: 'en' },
          React.createElement(
            VentureAccountingHub as unknown as React.ComponentType<Record<string, unknown>>,
            { locale: 'en', embeddedInErp: false, initialTab: 'receivables' },
          ),
        ),
      )
      expect(ventureRecTabEn).toContain('data-odoo-partial-warning="true"')
      expect(ventureRecTabEn).toContain('Credit Clearing Offset')
      expect(ventureRecTabEn).toContain('—')
      expect(ventureRecTabEn).not.toContain('0.000 KWD')

      const analyticsAr = renderToStaticMarkup(
        React.createElement(
          TypedLangProvider,
          { initialLocale: 'ar' },
          React.createElement(OdooAccountingAnalyticsHub, { isAr: true, locale: 'ar' }),
        ),
      )
      expect(analyticsAr).not.toContain('0 سطر ذمم غير مسوّى')
      const analyticsArTail = analyticsAr.split('صافي الذمم المدينة المفتوحة')[1] ?? ''
      expect(analyticsArTail).toContain('غير متاح')
      expect(analyticsArTail).not.toContain('0.000')

      // 7. enterprise-reports-registry.ts (VF-FIN-02 & VF-POS-01)
      const deptsAr = buildLiveEnterpriseDepartments(ws, env.summary, true)
      const deptsEn = buildLiveEnterpriseDepartments(ws, env.summary, false)
      const fin02Ar = deptsAr.flatMap((d) => d.reports).find((r) => r.code === 'VF-FIN-02')
      const fin02En = deptsEn.flatMap((d) => d.reports).find((r) => r.code === 'VF-FIN-02')
      expect(fin02Ar?.headlineMetricAr).toBe('غير متاح')
      expect(fin02En?.headlineMetricEn).toBe('—')
      expect(fin02Ar?.kpis.every((k) => k.value === 'غير متاح')).toBe(true)
      expect(fin02En?.kpis.every((k) => k.value === '—')).toBe(true)

      const pos01Ar = deptsAr.flatMap((d) => d.reports).find((r) => r.code === 'VF-POS-01')
      const pos01En = deptsEn.flatMap((d) => d.reports).find((r) => r.code === 'VF-POS-01')
      expect(pos01Ar?.recordCount).toBe(0)
      expect(pos01Ar?.headlineMetricAr).toBe('غير متاح')
      expect(pos01En?.headlineMetricEn).toBe('—')
    })

    it('A5: companyTotals emits null grossPreExclusionKwd/reconciliationGapKwd (reconciledExact=false) on bucket failure and Summary Card #6 Quiet Hours renders "غير متاح" / "—" with 🟠', async () => {
      // 1. year bucket failed -> companyTotals on period='year' must not claim 0 / reconciledExact: true
      installCustomPhaseAMock({ failYear: true })
      const yrEnv = await fetchLiveOdooSnapshot({
        period: 'year',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      expect(yrEnv.companyTotals?.grossPreExclusionKwd).toBeNull()
      expect(yrEnv.companyTotals?.reconciliationGapKwd).toBeNull()
      expect(yrEnv.companyTotals?.reconciledExact).toBe(false)
      expect(yrEnv.summary?.companyTotals?.grossPreExclusionKwd).toBeNull()
      expect(yrEnv.summary?.companyTotals?.reconciliationGapKwd).toBeNull()
      expect(yrEnv.summary?.companyTotals?.reconciledExact).toBe(false)

      const yrWs = computeGlobalWorkspace({ ...DEFAULT_GLOBAL_FILTERS, period: 'year' }, yrEnv.summary)
      const yrQuietCard = yrWs.summaryCards.find((c) => c.id === 'kitchen-capacity')
      expect(yrQuietCard?.valueAr).toBe('غير متاح')
      expect(yrQuietCard?.valueEn).toBe('—')
      expect(yrQuietCard?.statusDot).toBe('🟠')

      // 2. hourly failed on period='month' -> Summary Card #6 must also be "غير متاح" / "—" with 🟠
      vi.restoreAllMocks()
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      installCustomPhaseAMock({ failHourly: true })
      const hrEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      const hrWs = computeGlobalWorkspace({ ...DEFAULT_GLOBAL_FILTERS, period: 'month' }, hrEnv.summary)
      const hrQuietCard = hrWs.summaryCards.find((c) => c.id === 'kitchen-capacity')
      expect(hrQuietCard?.valueAr).toBe('غير متاح')
      expect(hrQuietCard?.valueEn).toBe('—')
      expect(hrQuietCard?.statusDot).toBe('🟠')
    })

    it('A6a: sync-odoo-live & build-odoo-dataset emit null (never 100% dine-in or china-garden) on AccessError for pos.payment or pos.order.line and preserve null in pct1/dataset', async () => {
      vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new Error(`process.exit(${code})`)
      }) as never)
      vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {})

      const syncMod = (await import('../../../scripts/sync-odoo-live.mjs')) as Record<string, unknown>
      const buildMod = (await import('../../../scripts/build-odoo-dataset.mjs')) as Record<string, unknown>
      const runSyncOdooLive = syncMod.runSyncOdooLive as (opts: Record<string, unknown>) => Promise<{
        permissions: { missingRead: string[] }
        brands: { id: string; netKwd: number | null; orders: number | null; aovKwd: number | null; sharePct: number | null }[]
        buckets: Record<
          string,
          {
            uiChannels: Record<string, { netKwd: number | null; orders: number | null }>
            byBrand: Record<string, { netKwd: number | null; orders: number | null }>
            byLocation: Record<string, { uiChannels: Record<string, { netKwd: number | null; orders: number | null }> }>
          }
        >
      }>
      const buildOdooDataset = buildMod.buildOdooDataset as (
        snap: unknown,
        reg: unknown,
      ) => {
        brands: { id: string; netKwd: number | null; orders: number | null; aovKwd: number | null; sharePct: number | null }[]
      }

      let capturedJson = ''
      const snapshot = await runSyncOdooLive({
        odooUrl: 'https://odoo-test.example.com',
        odooDb: 'vf_test_db',
        odooLogin: 'svc@example.com',
        odooApiKey: '0123456789abcdef0123456789abcdef',
        period: { from: '2026-10-16', to: '2026-11-15' },
        today: '2026-11-15',
        skipJourney: true,
        silent: true,
        writeFileImpl: (_fp: string, content: string) => {
          capturedJson = content
        },
        rpcImpl: async (service: string, method: string, args: unknown[]) => {
          if (service === 'common' && method === 'version') return { server_version: '17.0' }
          if (service === 'common' && method === 'authenticate') return 7
          const model = String(args[3] ?? '')
          const kwMethod = String(args[4] ?? '')
          if (model === 'pos.config' && kwMethod === 'search_read') {
            return [{ id: 8, name: 'Promenade 1', active: true, company_id: [1, 'Venture Foods'] }]
          }
          if (model === 'pos.category' && kwMethod === 'search_read') {
            return [{ id: 10, name: 'CG', parent_id: false }]
          }
          if (model === 'pos.payment.method' && kwMethod === 'search_read') {
            return [{ id: 7, name: 'Keeta' }]
          }
          if (model === 'pos.session' && kwMethod === 'read') {
            return [{ id: 501, config_id: [8, 'Promenade 1'] }]
          }
          if (model === 'pos.order' && kwMethod === 'read_group') {
            return [{ session_id: [501, 'POS/501'], amount_total: 240, amount_tax: 0, __count: 20 }]
          }
          if (model === 'pos.order' && kwMethod === 'search_read') {
            return [{ date_order: '2026-11-15 10:00:00', amount_total: 240, amount_tax: 0 }]
          }
          if (model === 'pos.payment') {
            throw new Error('AccessError: You are not allowed to access pos.payment records.')
          }
          if (model === 'pos.order.line') {
            throw new Error('AccessError: You are not allowed to access pos.order.line records.')
          }
          return []
        },
      })

      expect(snapshot.permissions.missingRead).toContain('pos.payment')
      expect(snapshot.permissions.missingRead).toContain('pos.order.line')

      // Bucket channels must NOT dump 240 KWD into 'dine-in' or 0 into siblings on AccessError
      expect(snapshot.buckets.month.uiChannels['dine-in']).toEqual({ netKwd: null, orders: null })
      expect(snapshot.buckets.month.uiChannels.keeta).toEqual({ netKwd: null, orders: null })
      expect(snapshot.buckets.month.byLocation.promenade.uiChannels['dine-in']).toEqual({
        netKwd: null,
        orders: null,
      })

      // Bucket brands must NOT dump 240 KWD into 'china-garden' or 0 into siblings on AccessError
      expect(snapshot.buckets.month.byBrand['china-garden'].netKwd).toBeNull()
      expect(snapshot.buckets.month.byBrand['china-garden'].orders).toBeNull()
      expect(snapshot.buckets.month.byBrand.franks.netKwd).toBeNull()

      // Rolling-30 brands must also emit null (never 0) on pos.order.line AccessError
      for (const b of snapshot.brands) {
        expect(b.netKwd).toBeNull()
        expect(b.orders).toBeNull()
        expect(b.aovKwd).toBeNull()
        expect(b.sharePct).toBeNull()
      }

      const registry = JSON.parse(
        await readFile(path.join(process.cwd(), 'src', 'lib', 'odoo', 'pos-registry.json'), 'utf8'),
      )
      const ds = buildOdooDataset(JSON.parse(capturedJson), registry)
      for (const dsBrand of ds.brands) {
        expect(dsBrand.netKwd).toBeNull()
        expect(dsBrand.orders).toBeNull()
        expect(dsBrand.aovKwd).toBeNull()
        expect(dsBrand.sharePct).toBeNull()
      }
    })

    it.each([
      'pos_config_search_read',
      'pos_category_search_read',
      'pos_payment_method_search_read',
      'journey_pulse_pos_order',
      'journey_brand_pulse_pos_order_line',
      'journey_orders_search_read',
      'journey_payments_search_read',
    ] as const)(
      'A6b: aborts non-zero without writing any file when %s fails with a non-permission error',
      async (failurePoint) => {
        vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
          throw new Error(`process.exit(${code})`)
        }) as never)
        const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {})
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        const syncMod = (await import('../../../scripts/sync-odoo-live.mjs')) as Record<string, unknown>
        const runSyncOdooLive = syncMod.runSyncOdooLive as (opts: Record<string, unknown>) => Promise<unknown>

        let posOrderReadGroups = 0
        let posLineReadGroups = 0
        let posOrderSearchReads = 0
        const writtenFiles: string[] = []

        await expect(
          runSyncOdooLive({
            odooUrl: 'https://odoo-test.example.com',
            odooDb: 'vf_test_db',
            odooLogin: 'svc@example.com',
            odooApiKey: '0123456789abcdef0123456789abcdef',
            period: { from: '2026-10-16', to: '2026-11-15' },
            today: '2026-11-15',
            skipJourney: !failurePoint.startsWith('journey_'),
            silent: true,
            writeFileImpl: (fp: string) => {
              writtenFiles.push(fp)
            },
            rpcImpl: async (service: string, method: string, args: unknown[]) => {
              if (service === 'common' && method === 'version') return { server_version: '17.0' }
              if (service === 'common' && method === 'authenticate') return 7
              const model = String(args[3] ?? '')
              const kwMethod = String(args[4] ?? '')
              if (model === 'pos.config' && kwMethod === 'search_read') {
                if (failurePoint === 'pos_config_search_read') throw new Error('HTTP 502 Bad Gateway')
                return [{ id: 8, name: 'Promenade 1', active: true, company_id: [1, 'Venture Foods'] }]
              }
              if (model === 'pos.category' && kwMethod === 'search_read') {
                if (failurePoint === 'pos_category_search_read') throw new Error('HTTP 502 Bad Gateway')
                return [{ id: 10, name: 'CG', parent_id: false }]
              }
              if (model === 'pos.payment.method' && kwMethod === 'search_read') {
                if (failurePoint === 'pos_payment_method_search_read') {
                  throw new Error('HTTP 502 Bad Gateway')
                }
                return [{ id: 7, name: 'Keeta' }]
              }
              if (model === 'pos.session' && kwMethod === 'read') {
                return [{ id: 501, config_id: [8, 'Promenade 1'] }]
              }
              if (model === 'product.product' && kwMethod === 'read') {
                return [{ id: 99, pos_categ_id: [10, 'CG'], lst_price: 12, standard_price: 4 }]
              }
              if (model === 'pos.order' && kwMethod === 'read_group') {
                posOrderReadGroups += 1
                // 1 main + up to 4 buckets (today + 7 fallback? no, 20 orders so 4 buckets = 5 calls), then journey pulse starts on call >= 6
                if (failurePoint === 'journey_pulse_pos_order' && posOrderReadGroups >= 6) {
                  throw new Error('HTTP 502 Bad Gateway')
                }
                return [{ session_id: [501, 'POS/501'], amount_total: 240, amount_tax: 0, __count: 20 }]
              }
              if (model === 'pos.order.line' && kwMethod === 'read_group') {
                posLineReadGroups += 1
                if (failurePoint === 'journey_brand_pulse_pos_order_line' && posLineReadGroups >= 8) {
                  throw new Error('HTTP 502 Bad Gateway')
                }
                return [{ product_id: [99, 'Sweet & Sour'], price_subtotal: 240, qty: 20 }]
              }
              if (model === 'pos.payment' && kwMethod === 'read_group') {
                return [
                  { session_id: [501, 'POS/501'], payment_method_id: [7, 'Keeta'], amount: 240, __count: 20 },
                ]
              }
              if (model === 'pos.order' && kwMethod === 'search_count') {
                return 20
              }
              if (model === 'pos.order' && kwMethod === 'search_read') {
                const kwargs = (args[6] as Record<string, unknown>) ?? {}
                // Access audit uses limit: 1; orderTimes uses limit: 200000; journey orders uses limit: 5000
                if (kwargs.limit === 5000) {
                  posOrderSearchReads += 1
                  if (failurePoint === 'journey_orders_search_read' && posOrderSearchReads >= 1) {
                    throw new Error('HTTP 502 Bad Gateway')
                  }
                }
                return []
              }
              if (model === 'pos.payment' && kwMethod === 'search_read') {
                const kwargs = (args[6] as Record<string, unknown>) ?? {}
                if (failurePoint === 'journey_payments_search_read' && kwargs.limit === 5000) {
                  throw new Error('HTTP 502 Bad Gateway')
                }
                return []
              }
              return []
            },
          }),
        ).rejects.toThrow(/502/)

        consoleSpy.mockRestore()
        expect(writtenFiles).toEqual([])
        expect(writeSpy).not.toHaveBeenCalled()
      },
    )

    it('A7: pos.category failure marks unavailable and skips line aggregation, and products failure propagates to brandsUnavailable across all 4 buckets', async () => {
      // 1. product.product.read fails -> all 4 buckets have byBrand === null and envelope.brands === null
      installCustomPhaseAMock({ failProducts: true })
      const prodEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      expect(prodEnv.partial).toBe(true)
      expect(prodEnv.diagnosticCode).toBe('PARTIAL_LIVE')
      expect(prodEnv.unavailableSections).toContain('products')
      expect(prodEnv.brands).toBeNull()
      expect(prodEnv.summary?.buckets?.today?.byBrand).toBeNull()
      expect(prodEnv.summary?.buckets?.week?.byBrand).toBeNull()
      expect(prodEnv.summary?.buckets?.month?.byBrand).toBeNull()
      expect(prodEnv.summary?.buckets?.year?.byBrand).toBeNull()

      // 2. pos.category.search_read fails -> marked unavailable, PARTIAL_LIVE, and all 4 buckets have byBrand === null
      vi.restoreAllMocks()
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      installCustomPhaseAMock({ failPosCategory: true })
      const catEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      expect(catEnv.partial).toBe(true)
      expect(catEnv.diagnosticCode).toBe('PARTIAL_LIVE')
      expect(catEnv.unavailableSections).toContain('pos.category')
      expect(catEnv.brands).toBeNull()
      expect(catEnv.summary?.buckets?.today?.byBrand).toBeNull()
      expect(catEnv.summary?.buckets?.week?.byBrand).toBeNull()
      expect(catEnv.summary?.buckets?.month?.byBrand).toBeNull()
      expect(catEnv.summary?.buckets?.year?.byBrand).toBeNull()
    })

    it('A8: pos.session.read failure fails closed (connected=false) instead of emitting 0 branches and 100% unattributed', async () => {
      installCustomPhaseAMock({ failSessions: true })
      const sessEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      expect(sessEnv.connected).toBe(false)
      expect(sessEnv.summary).toBeNull()
    })

    it('A9: excluded.month failure nulls companyTotals exclusions, gl.accounts failure marks PARTIAL_LIVE with accounting=null, and inner stockTransfers/receivables aging errors trigger outer null', async () => {
      // 1. excluded.month fails when decommissionedConfigIds.size > 0
      installCustomPhaseAMock({ includeDecommissionedConfig: true, failExcludedMonth: true })
      const exclEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      expect(exclEnv.partial).toBe(true)
      expect(exclEnv.diagnosticCode).toBe('PARTIAL_LIVE')
      expect(exclEnv.unavailableSections).toContain('excluded.month')
      expect(exclEnv.companyTotals?.excludedEntitiesKwd).toBeNull()
      expect(exclEnv.companyTotals?.excludedEntitiesOrders).toBeNull()
      expect(exclEnv.companyTotals?.grossPreExclusionKwd).toBeNull()
      expect(exclEnv.companyTotals?.reconciliationGapKwd).toBeNull()
      expect(exclEnv.companyTotals?.reconciledExact).toBe(false)

      // 2. account.account search_read fails -> partial=true, PARTIAL_LIVE, accounting=null on all 4 buckets
      vi.restoreAllMocks()
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      installCustomPhaseAMock({ failGlAccounts: true })
      const glAccEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      expect(glAccEnv.partial).toBe(true)
      expect(glAccEnv.diagnosticCode).toBe('PARTIAL_LIVE')
      expect(glAccEnv.unavailableSections).toContain('gl.accounts')
      expect(glAccEnv.summary?.buckets?.today?.accounting).toBeNull()
      expect(glAccEnv.summary?.buckets?.week?.accounting).toBeNull()
      expect(glAccEnv.summary?.buckets?.month?.accounting).toBeNull()
      expect(glAccEnv.summary?.buckets?.year?.accounting).toBeNull()

      // 3. Inner stock.picking search_count failure triggers outer markFailure('stockTransfers') -> stockTransfers === null
      vi.restoreAllMocks()
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      installCustomPhaseAMock({ failStockCountOnly: true })
      const stockCntEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      expect(stockCntEnv.partial).toBe(true)
      expect(stockCntEnv.unavailableSections).toContain('stockTransfers')
      expect(stockCntEnv.stockTransfers).toBeNull()

      // 4. Inner receivables aging read_group failure triggers outer markFailure('receivables') -> aggregatorReceivables === null
      vi.restoreAllMocks()
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      installCustomPhaseAMock({ failReceivablesAgingOnly: true })
      const agingErrEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      expect(agingErrEnv.partial).toBe(true)
      expect(agingErrEnv.unavailableSections).toContain('receivables')
      expect(agingErrEnv.aggregatorReceivables).toBeNull()
    })
  })
})
