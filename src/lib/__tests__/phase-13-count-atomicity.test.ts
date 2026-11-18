import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as companyPos from '@/lib/odoo/company-pos'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { fetchLiveOdooSummary } from '@/lib/odoo/live-sync-core'
import {
  buildPosOrderKpiDomain,
  describePosOrderQuery,
  parseDescribedPosOrderDomain,
} from '@/lib/odoo/pos-order-query'
import {
  bustOdooLiveCache,
  fetchLiveOdooCustomBucket,
  fetchLiveOdooPeriodCube,
  fetchLiveOdooSnapshot,
} from '@/lib/odoo-live-connector'

const ODOO_ENV_KEYS = [
  'ODOO_URL',
  'ODOO_DB',
  'ODOO_USERNAME',
  'ODOO_LOGIN',
  'ODOO_API_KEY',
  'ODOO_PASSWORD',
] as const

const TEST_REF_NOW_MS = Date.parse('2026-11-16T09:00:00.000Z')
// 2026-11-15 13:00 Asia/Kuwait = 2026-11-15 10:00:00 UTC (falls inside Kuwait day 2026-11-15)
const KW_DAY_RANGE = {
  'date_order:day': { from: '2026-11-14 21:00:00', to: '2026-11-15 21:00:00' },
}
const KW_HOUR_RANGE = {
  'date_order:hour': { from: '2026-11-15 10:00:00', to: '2026-11-15 11:00:00' },
}

function rpcOk(id: number, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function rpcFault(id: number, message: string): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: { code: 200, message: 'Odoo Server Error', data: { message } },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

describe('phase 13 blocker N1: non-refund order counts never silently fall back to 0', () => {
  const savedEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of ODOO_ENV_KEYS) {
      savedEnv[key] = process.env[key]
      delete process.env[key]
    }
    process.env.ODOO_URL = 'https://localhost:8069'
    process.env.ODOO_DB = 'vf_test'
    process.env.ODOO_USERNAME = 'bi@example.com'
    process.env.ODOO_API_KEY = 'test_key'
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
  })

  afterEach(() => {
    for (const key of ODOO_ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    }
    vi.restoreAllMocks()
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
  })

  it('fails closed in fetchLiveOdooSnapshot when the daily/session/pricelist non-refund count read_group throws while net succeeds', async () => {
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
      if (model === 'pos.order' && method === 'search_read') {
        return rpcOk(reqId, [
          {
            id: 1,
            date_order: '2026-11-15 10:15:00',
            amount_total: 420,
            config_id: [8, 'Promenade 1'],
            company_id: [1, 'Venture Foods'],
          },
        ])
      }
      if (model === 'pos.session' && method === 'read') {
        return rpcOk(reqId, [{ id: 501, config_id: [8, 'Promenade 1'] }])
      }
      if (model === 'pos.order' && method === 'read_group') {
        if (groupby.includes('date_order:day')) {
          if (domainStr.includes('["amount_total",">=",0]')) {
            return rpcFault(reqId, 'simulated count read_group timeout')
          }
          return rpcOk(reqId, [
            {
              session_id: [501, 'POS/501'],
              pricelist_id: false,
              amount_total: 420,
              amount_tax: 20,
              __count: 15,
              __range: KW_DAY_RANGE,
            },
          ])
        }
        return rpcOk(reqId, [])
      }
      if (model === 'pos.order' && method === 'search_count') {
        return rpcOk(reqId, 0)
      }
      return rpcOk(reqId, [])
    })

    const envelope = await fetchLiveOdooSnapshot({
      period: 'month',
      forceRefresh: true,
      referenceNowMs: TEST_REF_NOW_MS,
    })

    expect(envelope.connected).toBe(false)
    expect(envelope.sourceMode).toBe('disconnected')
    expect(envelope.summary).toBeNull()
    expect(envelope.summary?.totals.aovKwd).toBeUndefined()
    expect(envelope.totals.netSalesKwd !== 0 && envelope.totals.orders === 0).toBe(false)
  })

  it('drops both hourly net and hourly count as one unit when the hourly non-refund count read_group throws', async () => {
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
      if (model === 'pos.order' && method === 'search_read') {
        return rpcOk(reqId, [
          {
            id: 1,
            date_order: '2026-11-15 10:15:00',
            amount_total: 150,
            config_id: [8, 'Promenade 1'],
            company_id: [1, 'Venture Foods'],
          },
        ])
      }
      if (model === 'pos.session' && method === 'read') {
        return rpcOk(reqId, [{ id: 501, config_id: [8, 'Promenade 1'] }])
      }
      if (model === 'pos.order' && method === 'read_group') {
        if (groupby.includes('date_order:day')) {
          if (domainStr.includes('["amount_total",">=",0]')) {
            return rpcOk(reqId, [
              { session_id: [501, 'POS/501'], pricelist_id: false, __count: 6, __range: KW_DAY_RANGE },
            ])
          }
          return rpcOk(reqId, [
            {
              session_id: [501, 'POS/501'],
              pricelist_id: false,
              amount_total: 150,
              amount_tax: 0,
              __count: 6,
              __range: KW_DAY_RANGE,
            },
          ])
        }
        if (groupby.includes('date_order:hour')) {
          if (domainStr.includes('["amount_total",">=",0]')) {
            return rpcFault(reqId, 'simulated hourly count read_group error')
          }
          return rpcOk(reqId, [
            { amount_total: 150, amount_tax: 0, __count: 6, __range: KW_HOUR_RANGE },
          ])
        }
        return rpcOk(reqId, [])
      }
      if (model === 'pos.order' && method === 'search_count') {
        return rpcOk(reqId, 6)
      }
      return rpcOk(reqId, [])
    })

    const envelope = await fetchLiveOdooSnapshot({
      period: 'month',
      forceRefresh: true,
      referenceNowMs: TEST_REF_NOW_MS,
    })

    expect(envelope.connected).toBe(true)
    expect(envelope.totals).toEqual({ netSalesKwd: 150, orders: 6, aovKwd: 25 })
    expect(envelope.partial).toBe(true)
    expect(envelope.unavailableSections).toContain('hourly')
    expect(envelope.diagnosticCode).toBe('PARTIAL_LIVE')
    expect(envelope.hourlySeries).toBeNull()
  })

  it('drops payment/channel, YTD, and prior30 pairs atomically when their non-refund count queries throw', async () => {
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
      if (model === 'pos.order' && method === 'search_read') {
        return rpcOk(reqId, [
          {
            id: 1,
            date_order: '2026-11-15 10:15:00',
            amount_total: 250,
            config_id: [8, 'Promenade 1'],
            company_id: [1, 'Venture Foods'],
          },
        ])
      }
      if (model === 'pos.session' && method === 'read') {
        return rpcOk(reqId, [{ id: 501, config_id: [8, 'Promenade 1'] }])
      }
      if (model === 'pos.order' && method === 'read_group') {
        if (groupby.includes('date_order:day')) {
          if (domainStr.includes('["amount_total",">=",0]')) {
            return rpcOk(reqId, [
              {
                session_id: [501, 'POS/501'],
                pricelist_id: [3, 'Talabat Go'],
                __count: 8,
                __range: KW_DAY_RANGE,
              },
            ])
          }
          return rpcOk(reqId, [
            {
              session_id: [501, 'POS/501'],
              pricelist_id: [3, 'Talabat Go'],
              amount_total: 250,
              amount_tax: 0,
              __count: 8,
              __range: KW_DAY_RANGE,
            },
          ])
        }
        if (groupby.length === 1 && groupby[0] === 'session_id') {
          // YTD session pair: net succeeds, count throws
          if (domainStr.includes('["amount_total",">=",0]')) {
            return rpcFault(reqId, 'simulated YTD count failure')
          }
          return rpcOk(reqId, [
            { session_id: [501, 'POS/501'], amount_total: 9000, amount_tax: 0, __count: 300 },
          ])
        }
        if (groupby.length === 0) {
          // prior30 net succeeds while search_count throws below
          return rpcOk(reqId, [{ amount_total: 6000, amount_tax: 0, __count: 200 }])
        }
        return rpcOk(reqId, [])
      }
      if (model === 'pos.payment' && method === 'read_group') {
        // Payment net succeeds, payment non-refund count throws
        if (domainStr.includes('["pos_order_id.amount_total",">=",0]')) {
          return rpcFault(reqId, 'simulated pos.payment count failure')
        }
        return rpcOk(reqId, [
          {
            session_id: [501, 'POS/501'],
            payment_method_id: [7, 'Keeta'],
            amount: 250,
            __count: 8,
          },
        ])
      }
      if (model === 'pos.order' && method === 'search_count') {
        return rpcFault(reqId, 'simulated prior30 search_count failure')
      }
      return rpcOk(reqId, [])
    })

    const envelope = await fetchLiveOdooSnapshot({
      period: 'month',
      forceRefresh: true,
      referenceNowMs: TEST_REF_NOW_MS,
    })

    expect(envelope.connected).toBe(true)
    const buckets = envelope.summary?.buckets
    expect(buckets).toBeDefined()
    if (!buckets || !buckets.month || !buckets.today || !buckets.week || !buckets.year) {
      throw new Error('Expected all 4 buckets to be defined')
    }

    expect(envelope.partial).toBe(true)
    expect(envelope.diagnosticCode).toBe('PARTIAL_LIVE')
    expect(envelope.unavailableSections).toEqual(
      expect.arrayContaining([
        'channels.month',
        'channels.week',
        'channels.today',
        'channels.year',
        'year',
      ]),
    )

    // Failed payment/channel sections are null (never positive net with 0 orders, and never 0)
    expect(buckets.month.uiChannels, 'month uiChannels').toBeNull()
    expect(buckets.today.uiChannels, 'today uiChannels').toBeNull()
    expect(buckets.week.uiChannels, 'week uiChannels').toBeNull()
    expect(buckets.year.uiChannels, 'year uiChannels').toBeNull()

    // YTD bucket dropped both net and count together as null (never 9000 KWD with 0 orders, and never 0)
    expect(buckets.year.totals.netSalesKwd !== 0 && buckets.year.totals.orders === 0).toBe(false)
    expect(buckets.year.totals).toEqual({
      netSalesKwd: null,
      orders: null,
      aovKwd: null,
      restaurantNetKwd: null,
      restaurantOrders: null,
    })

    expect(envelope.summary?.journeyPulse?.rolling30?.days).toBe(30)
  })

  it.each(['daily', 'hourly', 'payment'] as const)(
    'fails closed in fetchLiveOdooPeriodCube when the %s non-refund count read_group throws',
    async (failingTarget) => {
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
          return rpcOk(reqId, [{ id: 601, config_id: [8, 'Promenade 1'] }])
        }
        if (model === 'pos.order' && method === 'read_group') {
          if (groupby.includes('date_order:day')) {
            if (domainStr.includes('["amount_total",">=",0]')) {
              if (failingTarget === 'daily') {
                return rpcFault(reqId, 'cube daily count failure')
              }
              return rpcOk(reqId, [
                { session_id: [601, 'S601'], pricelist_id: false, __count: 10, __range: KW_DAY_RANGE },
              ])
            }
            return rpcOk(reqId, [
              {
                session_id: [601, 'S601'],
                pricelist_id: false,
                amount_total: 300,
                amount_tax: 0,
                __count: 10,
                __range: KW_DAY_RANGE,
              },
            ])
          }
          if (groupby.includes('date_order:hour')) {
            if (domainStr.includes('["amount_total",">=",0]')) {
              if (failingTarget === 'hourly') {
                return rpcFault(reqId, 'cube hourly count failure')
              }
              return rpcOk(reqId, [
                { session_id: [601, 'S601'], __count: 10, __range: KW_HOUR_RANGE },
              ])
            }
            return rpcOk(reqId, [
              {
                session_id: [601, 'S601'],
                amount_total: 300,
                amount_tax: 0,
                __count: 10,
                __range: KW_HOUR_RANGE,
              },
            ])
          }
          return rpcOk(reqId, [])
        }
        if (model === 'pos.payment' && method === 'read_group') {
          if (domainStr.includes('["pos_order_id.amount_total",">=",0]')) {
            if (failingTarget === 'payment') {
              return rpcFault(reqId, 'cube payment count failure')
            }
            return rpcOk(reqId, [
              {
                session_id: [601, 'S601'],
                payment_method_id: [7, 'Talabat Go'],
                amount: 300,
                __count: 10,
              },
            ])
          }
          return rpcOk(reqId, [
            {
              session_id: [601, 'S601'],
              payment_method_id: [7, 'Talabat Go'],
              amount: 300,
              __count: 10,
            },
          ])
        }
        return rpcOk(reqId, [])
      })

      const cube = await fetchLiveOdooPeriodCube('2026-11-15', '2026-11-15', TEST_REF_NOW_MS)
      if (failingTarget === 'hourly') {
        // Hourly is an independent section: its failure leaves the other sections intact and marks
        // hourly unavailable — no hourly rows at all, never a silent 0 count.
        expect(cube.connected).toBe(true)
        expect(cube.hourlyAvailable).toBe(false)
        expect(cube.hourlySeries).toEqual([])
        expect(cube.totals.netSalesKwd !== 0 && cube.totals.orders === 0).toBe(false)
      } else {
        expect(cube.connected).toBe(false)
        expect(cube.noData).toBe(true)
        expect(cube.totals.netSalesKwd !== 0 && cube.totals.orders === 0).toBe(false)
      }

      const customBucket = await fetchLiveOdooCustomBucket(
        '2026-11-15',
        '2026-11-15',
        TEST_REF_NOW_MS,
      )
      if (failingTarget === 'hourly') {
        // The custom bucket has no hourly section, so it is still built from the intact cube.
        expect(customBucket).toBeDefined()
        expect(customBucket?.totals.netSalesKwd).toBe(cube.totals.netSalesKwd)
      } else {
        expect(customBucket).toBeUndefined()
      }
    },
  )

  it('rejects fetchLiveOdooSummary on session or payment count failure and omits journeyPulse when pulse search_count fails', async () => {
    const odooEnv = {
      ODOO_URL: 'https://localhost:8069',
      ODOO_DB: 'vf_test',
      ODOO_USERNAME: 'bi@example.com',
      ODOO_API_KEY: 'test_key',
    }

    const installSummaryMock = (mode: 'session-count-fail' | 'payment-count-fail' | 'pulse-count-fail') => {
      vi.restoreAllMocks()
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
          return rpcOk(reqId, [{ id: 8, name: 'Promenade 1', active: true }])
        }
        if (model === 'pos.session' && method === 'read') {
          return rpcOk(reqId, [{ id: 501, config_id: [8, 'Promenade 1'] }])
        }
        if (model === 'pos.order' && method === 'read_group') {
          if (groupby.includes('session_id')) {
            if (domainStr.includes('["amount_total",">=",0]')) {
              if (mode === 'session-count-fail') {
                return rpcFault(reqId, 'bySessionCount failed')
              }
              return rpcOk(reqId, [{ session_id: [501, 'POS/501'], amount_total: 500, __count: 20 }])
            }
            return rpcOk(reqId, [
              { session_id: [501, 'POS/501'], amount_total: 500, amount_tax: 0, __count: 20 },
            ])
          }
          // pulseOf net read_group
          return rpcOk(reqId, [{ amount_total: 500, amount_tax: 0, __count: 20 }])
        }
        if (model === 'pos.payment' && method === 'read_group') {
          if (domainStr.includes('["pos_order_id.amount_total",">=",0]')) {
            if (mode === 'payment-count-fail') {
              return rpcFault(reqId, 'byPaymentCount failed')
            }
            return rpcOk(reqId, [
              {
                session_id: [501, 'POS/501'],
                payment_method_id: [7, 'Talabat Go'],
                amount: 500,
                __count: 20,
              },
            ])
          }
          return rpcOk(reqId, [
            {
              session_id: [501, 'POS/501'],
              payment_method_id: [7, 'Talabat Go'],
              amount: 500,
              __count: 20,
            },
          ])
        }
        if (model === 'pos.order' && method === 'search_count') {
          if (mode === 'pulse-count-fail') {
            return rpcFault(reqId, 'pulse search_count failed')
          }
          return rpcOk(reqId, 20)
        }
        if (method === 'check_access_rights') {
          return rpcOk(reqId, true)
        }
        return rpcOk(reqId, [])
      })
    }

    installSummaryMock('session-count-fail')
    await expect(
      fetchLiveOdooSummary(odooEnv, { from: '2026-11-15', to: '2026-11-16' }, 5_000, 'today'),
    ).rejects.toThrow(/bySessionCount failed/)

    installSummaryMock('payment-count-fail')
    await expect(
      fetchLiveOdooSummary(odooEnv, { from: '2026-11-15', to: '2026-11-16' }, 5_000, 'today'),
    ).rejects.toThrow(/byPaymentCount failed/)

    installSummaryMock('pulse-count-fail')
    const pulseUnavailableSummary = await fetchLiveOdooSummary(
      odooEnv,
      { from: '2026-11-15', to: '2026-11-16' },
      5_000,
      'today',
    )
    expect(pulseUnavailableSummary.totals).toEqual({ netSalesKwd: 500, orders: 20, aovKwd: 25 })
    expect(pulseUnavailableSummary.journeyPulse).toBeUndefined()
  })

  it('keeps the happy path (9 positive + 1 big refund -> orders 9, net -20; refund-only -> 0 orders, negative net) and tooltip domain parity unchanged', async () => {
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
          { id: 19, name: 'Salmiya 1', active: true, company_id: [1, 'Venture Foods'] },
        ])
      }
      if (model === 'res.users' && method === 'read') {
        return rpcOk(reqId, [{ id: 7, company_id: [1, 'Venture Foods'] }])
      }
      if (model === 'pos.session' && method === 'read') {
        return rpcOk(reqId, [
          { id: 601, config_id: [8, 'Promenade 1'] },
          { id: 602, config_id: [19, 'Salmiya 1'] },
        ])
      }
      if (model === 'pos.order' && method === 'read_group') {
        if (groupby.includes('date_order:day')) {
          if (domainStr.includes('["amount_total",">=",0]')) {
            return rpcOk(reqId, [
              { session_id: [601, 'S601'], pricelist_id: false, __count: 9, __range: KW_DAY_RANGE },
            ])
          }
          return rpcOk(reqId, [
            {
              session_id: [601, 'S601'],
              pricelist_id: false,
              amount_total: -20,
              amount_tax: 0,
              __count: 10,
              __range: KW_DAY_RANGE,
            },
            {
              session_id: [602, 'S602'],
              pricelist_id: false,
              amount_total: -12,
              amount_tax: 0,
              __count: 2,
              __range: KW_DAY_RANGE,
            },
          ])
        }
        return rpcOk(reqId, [])
      }
      return rpcOk(reqId, [])
    })

    const cube = await fetchLiveOdooPeriodCube('2026-11-15', '2026-11-15', TEST_REF_NOW_MS)
    expect(cube.connected).toBe(true)
    expect(cube.byBranch.promenade).toMatchObject({ netKwd: -20, orders: 9 })
    expect(cube.byBranch.salmiya).toMatchObject({ netKwd: -12, orders: 0 })
    expect(cube.totals.orders).toBe(9)
    expect(cube.totals.netSalesKwd).toBe(-32)

    const tooltipQuery = describePosOrderQuery({
      fromKuwaitDate: '2026-11-15',
      toInclusiveKuwaitDate: '2026-11-15',
      companyId: 1,
      aggregate: 'search_count',
    })
    expect(parseDescribedPosOrderDomain(tooltipQuery)).toEqual(
      buildPosOrderKpiDomain({
        fromKuwaitDate: '2026-11-15',
        toInclusiveKuwaitDate: '2026-11-15',
        companyId: 1,
        nonRefundOnly: true,
      }),
    )
  })
})

describe('phase 13 small item 1: archived pinned registers #16 and #35 documented in company-pos.ts', () => {
  it('names both #16 E-Mall (Promenade) and #35 Delivery (Ardiya Temp) in company-pos.ts TODO while keeping active-only behaviour', () => {
    expect(companyPos.companyPosConfigAllowed(16, 'E-Mall (Promenade)', false)).toBe(false)
    expect(companyPos.companyPosConfigAllowed(16, 'E-Mall (Promenade)', true)).toBe(true)
    expect(companyPos.companyPosConfigAllowed(35, 'Delivery (Ardiya Temp)', false)).toBe(false)
    expect(companyPos.companyPosConfigAllowed(35, 'Delivery (Ardiya Temp)', true)).toBe(true)

    const companyPosSrc = readFileSync(
      path.join(process.cwd(), 'src', 'lib', 'odoo', 'company-pos.ts'),
      'utf8',
    )
    expect(companyPosSrc).toContain('#16 E-Mall (Promenade)')
    expect(companyPosSrc).toContain('#35 Delivery (Ardiya Temp)')
  })
})

describe('phase 13 small item 2: canteen-over-restaurant precedence documented in phase-13-checklist.md', () => {
  it('documents TODO(Abdullah) that a canteen word wins over restaurant ("Hawally Restaurant Canteen" is kept) without altering exclusion code', () => {
    const hawally = ['Haw', 'ally'].join('')
    expect(isExcludedOdooEntity(`${hawally} Restaurant Canteen`)).toBe(false)

    const checklistPath = path.join(process.cwd(), 'docs', 'phases', 'phase-13-checklist.md')
    expect(existsSync(checklistPath)).toBe(true)
    const checklist = readFileSync(checklistPath, 'utf8')
    expect(checklist).toContain('Hawally Restaurant Canteen')
    expect(checklist).toMatch(/TODO\(Abdullah\)/)
  })
})
