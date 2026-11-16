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
import { FullJourney360 } from '@/components/aether/FullJourney360'
import {
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import { fmt, kwd } from '@/lib/aether/ledger'
import { LanguageProvider } from '@/lib/i18n'
import { bustOdooLiveCache, fetchLiveOdooSnapshot } from '@/lib/odoo-live-connector'
import { describePosOrderQuery } from '@/lib/odoo/pos-order-query'

const TEST_REF_NOW_MS = Date.parse('2026-11-15T12:00:00.000Z') // 15:00 Asia/Kuwait on 2026-11-15
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
      'journeyPulse',
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

          if (section === 'journeyPulse') {
            expect(envelope.summary?.journeyPulse).toBeNull()
            expect(envelope.journeyPulse).toBeNull()
          } else {
            expect(envelope.summary?.journeyPulse).toEqual(normalEnvelope.summary?.journeyPulse)
          }

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
})
