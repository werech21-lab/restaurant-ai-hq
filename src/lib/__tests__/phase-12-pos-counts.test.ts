import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import posRegistry from '@/lib/odoo/pos-registry.json'
import * as companyPos from '@/lib/odoo/company-pos'
import * as posOrderQuery from '@/lib/odoo/pos-order-query'
import {
  bustOdooLiveCache,
  fetchLiveOdooPeriodCube,
  isDecommissionedWarehouseRecord,
  resolveRestaurantBranchForConfig,
} from '@/lib/odoo-live-connector'
import { fetchLiveOdooSummary } from '@/lib/odoo/live-sync-core'
import { sanitizePosTerminalDisplayName } from '@/lib/odoo-terminal-mappings'

const ODOO_ENV_KEYS = [
  'ODOO_URL',
  'ODOO_DB',
  'ODOO_USERNAME',
  'ODOO_LOGIN',
  'ODOO_API_KEY',
] as const

describe('phase 12 blocker A: pinned school canteen POS config rule & branch resolution', () => {
  it('allows pinned canteen IDs (41, 42) across closed-district labels while excluding Jahra/Qurain/Heisenberg, archived, and unpinned IDs', () => {
    expect(companyPos.companyPosConfigAllowed(41, 'مقصف مدرسة حولي')).toBe(true)
    expect(companyPos.companyPosConfigAllowed(41, 'Hawally School Canteen')).toBe(true)
    expect(
      companyPos.companyPosConfigAllowed(
        41,
        'NPIS Hawally Venture Foods Restaurant Co. NPIS: PoS Orders',
      ),
    ).toBe(true)
    expect(
      companyPos.companyPosConfigAllowed(42, 'FAIPS Ahmadi Venture Foods Hawally: PoS Orders'),
    ).toBe(true)

    expect(companyPos.companyPosConfigAllowed(41, 'NPIS Jahra')).toBe(false)
    expect(companyPos.companyPosConfigAllowed(42, 'FAIPS Qurain')).toBe(false)
    expect(companyPos.companyPosConfigAllowed(41, 'Heisenberg School Canteen')).toBe(false)
    expect(companyPos.companyPosConfigAllowed(41, 'NPIS Hawally', false)).toBe(false)
    expect(companyPos.companyPosConfigAllowed(99999, 'NPIS Hawally')).toBe(false)

    expect(
      resolveRestaurantBranchForConfig(42, 'FAIPS Ahmadi', 'Venture Foods Hawally: PoS Orders'),
    ).toBe('school-canteens')
    expect(resolveRestaurantBranchForConfig(41, 'NPIS Jahra')).toBeNull()

    expect(sanitizePosTerminalDisplayName(41, 'Hawally School Canteen')).toBe('School Canteen')
  })
})

describe('phase 12 blocker B: grouped non-refund order counts, negative-net preservation & tooltip domain parity', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
  })

  it('restricts posOrderCount strictly to single orders (0 or 1) and throws RangeError for grouped counts > 1', () => {
    expect(companyPos.posOrderCount(0, 0, 0)).toBe(0)
    expect(companyPos.posOrderCount(1, 25, 0)).toBe(1)
    expect(companyPos.posOrderCount(1, -12.5, 0)).toBe(0)
    expect(() => companyPos.posOrderCount(10, 90, 0)).toThrow(RangeError)
    expect(() => companyPos.posOrderCount(10, -20, 0)).toThrow(RangeError)
  })

  it('merges session, channel/day, hourly, session+hour, and payment groups preserving nonRefundCount and signed negative net', () => {
    expect(typeof posOrderQuery.mergeSessionGroups).toBe('function')
    expect(typeof posOrderQuery.mergeDaySessionPricelistGroups).toBe('function')
    expect(typeof posOrderQuery.mergeHourGroups).toBe('function')
    expect(typeof posOrderQuery.mergeSessionHourGroups).toBe('function')
    expect(typeof posOrderQuery.mergeSessionPaymentGroups).toBe('function')

    // 1) Session groups (session_id): (count 9, net +90), (count 9, net -20), (count 0, net -15)
    const sessionMerged = posOrderQuery.mergeSessionGroups(
      [
        { session_id: [101, 'POS/101'], amount_total: 90, amount_tax: 0, __count: 10 },
        { session_id: [102, 'POS/102'], amount_total: -20, amount_tax: 0, __count: 10 },
        { session_id: [103, 'POS/103'], amount_total: -15, amount_tax: 0, __count: 1 },
      ],
      [
        { session_id: [101, 'POS/101'], __count: 9 },
        { session_id: [102, 'POS/102'], __count: 9 },
      ],
    )
    expect(sessionMerged).toEqual([
      expect.objectContaining({ sessionId: 101, orders: 9, netKwd: 90 }),
      expect.objectContaining({ sessionId: 102, orders: 9, netKwd: -20 }),
      expect.objectContaining({ sessionId: 103, orders: 0, netKwd: -15 }),
    ])

    // 2) Channel + day groups (session_id + pricelist_id + date_order:day)
    const dayRange = { 'date_order:day': { from: '2026-11-15 21:00:00', to: '2026-11-16 21:00:00' } }
    const channelDayMerged = posOrderQuery.mergeDaySessionPricelistGroups(
      [
        {
          session_id: [101, 'POS/101'],
          pricelist_id: [1, 'Talabat Go'],
          amount_total: 90,
          amount_tax: 0,
          __count: 10,
          __range: dayRange,
        },
        {
          session_id: [102, 'POS/102'],
          pricelist_id: [1, 'Talabat Go'],
          amount_total: -20,
          amount_tax: 0,
          __count: 10,
          __range: dayRange,
        },
        {
          session_id: [103, 'POS/103'],
          pricelist_id: false,
          amount_total: -15,
          amount_tax: 0,
          __count: 1,
          __range: dayRange,
        },
      ],
      [
        {
          session_id: [101, 'POS/101'],
          pricelist_id: [1, 'Talabat Go'],
          __count: 9,
          __range: dayRange,
        },
        {
          session_id: [102, 'POS/102'],
          pricelist_id: [1, 'Talabat Go'],
          __count: 9,
          __range: dayRange,
        },
      ],
    )
    expect(channelDayMerged).toEqual([
      expect.objectContaining({ sessionId: 101, pricelistId: 1, orders: 9, netKwd: 90 }),
      expect.objectContaining({ sessionId: 102, pricelistId: 1, orders: 9, netKwd: -20 }),
      expect.objectContaining({ sessionId: 103, pricelistId: null, orders: 0, netKwd: -15 }),
    ])

    // 3) Hourly groups (date_order:hour)
    const h1 = { 'date_order:hour': { from: '2026-11-16 09:00:00', to: '2026-11-16 10:00:00' } }
    const h2 = { 'date_order:hour': { from: '2026-11-16 10:00:00', to: '2026-11-16 11:00:00' } }
    const h3 = { 'date_order:hour': { from: '2026-11-16 11:00:00', to: '2026-11-16 12:00:00' } }
    const hourMerged = posOrderQuery.mergeHourGroups(
      [
        { amount_total: 90, amount_tax: 0, __count: 10, __range: h1 },
        { amount_total: -20, amount_tax: 0, __count: 10, __range: h2 },
        { amount_total: -15, amount_tax: 0, __count: 1, __range: h3 },
      ],
      [
        { __count: 9, __range: h1 },
        { __count: 9, __range: h2 },
      ],
    )
    expect(hourMerged).toEqual([
      expect.objectContaining({ hourFromUtc: '2026-11-16 09:00:00', orders: 9, netKwd: 90 }),
      expect.objectContaining({ hourFromUtc: '2026-11-16 10:00:00', orders: 9, netKwd: -20 }),
      expect.objectContaining({ hourFromUtc: '2026-11-16 11:00:00', orders: 0, netKwd: -15 }),
    ])

    // 4) Session + hour groups (session_id + date_order:hour)
    const sessionHourMerged = posOrderQuery.mergeSessionHourGroups(
      [
        { session_id: [101, 'POS/101'], amount_total: 90, amount_tax: 0, __count: 10, __range: h1 },
        { session_id: [102, 'POS/102'], amount_total: -20, amount_tax: 0, __count: 10, __range: h2 },
        { session_id: [103, 'POS/103'], amount_total: -15, amount_tax: 0, __count: 1, __range: h3 },
      ],
      [
        { session_id: [101, 'POS/101'], __count: 9, __range: h1 },
        { session_id: [102, 'POS/102'], __count: 9, __range: h2 },
      ],
    )
    expect(sessionHourMerged).toEqual([
      expect.objectContaining({ sessionId: 101, orders: 9, netKwd: 90 }),
      expect.objectContaining({ sessionId: 102, orders: 9, netKwd: -20 }),
      expect.objectContaining({ sessionId: 103, orders: 0, netKwd: -15 }),
    ])

    // 5) Session + payment groups (session_id + payment_method_id)
    const paymentMerged = posOrderQuery.mergeSessionPaymentGroups(
      [
        {
          session_id: [101, 'POS/101'],
          payment_method_id: [7, 'Talabat Go'],
          amount: 90,
          __count: 10,
        },
        {
          session_id: [102, 'POS/102'],
          payment_method_id: [7, 'Talabat Go'],
          amount: -20,
          __count: 10,
        },
        {
          session_id: [103, 'POS/103'],
          payment_method_id: [8, 'KNET'],
          amount: -15,
          __count: 1,
        },
      ],
      [
        { session_id: [101, 'POS/101'], payment_method_id: [7, 'Talabat Go'], __count: 9 },
        { session_id: [102, 'POS/102'], payment_method_id: [7, 'Talabat Go'], __count: 9 },
      ],
    )
    expect(paymentMerged).toEqual([
      expect.objectContaining({ sessionId: 101, paymentMethodId: 7, orders: 9, netKwd: 90 }),
      expect.objectContaining({ sessionId: 102, paymentMethodId: 7, orders: 9, netKwd: -20 }),
      expect.objectContaining({ sessionId: 103, paymentMethodId: 8, orders: 0, netKwd: -15 }),
    ])
  })

  it('preserves count 9 and net -20 in live-sync-core when 9 positive orders and 1 large refund occur in one session', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        id?: number
        params?: { service?: string; method?: string; args?: unknown[] }
      }
      const rpcReply = (result: unknown) =>
        new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, result }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })

      if (body.params?.service === 'common' && body.params?.method === 'authenticate') {
        return rpcReply(7)
      }
      const args = body.params?.args ?? []
      const model = String(args[3] ?? '')
      const method = String(args[4] ?? '')
      const methodArgs = (args[5] as unknown[]) ?? []
      const domain = (methodArgs[0] as unknown[][]) ?? []
      const domainStr = JSON.stringify(domain)

      if (model === 'pos.config' && method === 'search_read') {
        return rpcReply([
          { id: 8, name: 'Promenade 1', active: true },
          { id: 41, name: 'Hawally School Canteen', active: true },
        ])
      }
      if (model === 'pos.category' && method === 'search_read') {
        return rpcReply([])
      }
      if (model === 'pos.session' && method === 'read') {
        return rpcReply([
          { id: 501, config_id: [8, 'Promenade 1'] },
          { id: 502, config_id: [41, 'Hawally School Canteen'] },
        ])
      }
      if (model === 'pos.order' && method === 'read_group') {
        const groupby = (methodArgs[2] as string[]) ?? []
        if (groupby.includes('session_id')) {
          if (domainStr.includes('["amount_total",">=",0]')) {
            return rpcReply([{ session_id: [501, 'POS/501'], amount_total: 30, __count: 9 }])
          }
          if (domainStr.includes('["amount_total","<",0]')) {
            return rpcReply([{ session_id: [501, 'POS/501'], amount_total: -50, __count: 1 }])
          }
          return rpcReply([
            { session_id: [501, 'POS/501'], amount_total: -20, amount_tax: 0, __count: 10 },
            { session_id: [502, 'POS/502'], amount_total: -15, amount_tax: 0, __count: 1 },
          ])
        }
        return rpcReply([{ amount_total: -35, amount_tax: 0, __count: 11 }])
      }
      if (model === 'pos.order' && method === 'search_count') {
        if (domainStr.includes('["amount_total",">=",0]')) return rpcReply(9)
        return rpcReply(2)
      }
      if (model === 'pos.payment' && method === 'read_group') {
        if (domainStr.includes('["pos_order_id.amount_total",">=",0]')) {
          return rpcReply([
            {
              session_id: [501, 'POS/501'],
              payment_method_id: [7, 'Talabat Go'],
              amount: 30,
              __count: 9,
            },
          ])
        }
        return rpcReply([
          {
            session_id: [501, 'POS/501'],
            payment_method_id: [7, 'Talabat Go'],
            amount: -20,
            __count: 10,
          },
          {
            session_id: [502, 'POS/502'],
            payment_method_id: [8, 'KNET'],
            amount: -15,
            __count: 1,
          },
        ])
      }
      if (model === 'pos.order.line' && method === 'read_group') {
        return rpcReply([])
      }
      if (method === 'check_access_rights') {
        return rpcReply(true)
      }
      return rpcReply([])
    })

    const summary = await fetchLiveOdooSummary(
      {
        ODOO_URL: 'https://localhost:8069',
        ODOO_DB: 'vf_test',
        ODOO_USERNAME: 'bi@example.com',
        ODOO_API_KEY: 'test_key',
      },
      { from: '2026-11-15', to: '2026-11-16' },
      5_000,
      'today',
    )

    const bkt = summary.buckets?.today
    expect(bkt?.byLocation?.promenade).toMatchObject({ netKwd: -20, orders: 9 })
    expect(bkt?.byLocation?.['school-canteens']).toMatchObject({ netKwd: -15, orders: 0 })
    expect(bkt?.totals.orders).toBe(9)
    expect(bkt?.totals.netSalesKwd).toBe(-35)
    expect(bkt?.byLocation?.promenade?.uiChannels?.['talabat-tgo']).toEqual({
      netKwd: -20,
      orders: 9,
    })
    expect(summary.journeyPulse?.rolling30).toMatchObject({ netKwd: -35, orders: 9 })
  })

  it('preserves count 9 / net -20 and refund-only count 0 / negative net across daily, hourly, and payment groups in fetchLiveOdooPeriodCube', async () => {
    const saved: Record<string, string | undefined> = {}
    for (const key of ODOO_ENV_KEYS) saved[key] = process.env[key]
    process.env.ODOO_URL = 'https://localhost:8069'
    process.env.ODOO_DB = 'vf_test'
    process.env.ODOO_USERNAME = 'bi@example.com'
    process.env.ODOO_API_KEY = 'test_key'
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })

    try {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number
          params?: { service?: string; method?: string; args?: unknown[] }
        }
        const rpcReply = (result: unknown) =>
          new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, result }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })

        if (body.params?.service === 'common' && body.params?.method === 'authenticate') {
          return rpcReply(7)
        }
        const args = body.params?.args ?? []
        const model = String(args[3] ?? '')
        const method = String(args[4] ?? '')
        const methodArgs = (args[5] as unknown[]) ?? []
        const domainStr = JSON.stringify(methodArgs[0] ?? [])

        if (model === 'pos.config' && method === 'search_read') {
          return rpcReply([
            { id: 8, name: 'Promenade 1', active: true, company_id: [1, 'Venture Foods'] },
            { id: 17, name: '360 Mall 1', active: true, company_id: [1, 'Venture Foods'] },
            { id: 19, name: 'Salmiya 1', active: true, company_id: [1, 'Venture Foods'] },
          ])
        }
        if (model === 'res.users' && method === 'read') {
          return rpcReply([{ id: 7, company_id: [1, 'Venture Foods'] }])
        }
        if (model === 'pos.session' && method === 'read') {
          return rpcReply([
            { id: 601, config_id: [8, 'Promenade 1'] },
            { id: 602, config_id: [17, '360 Mall 1'] },
            { id: 603, config_id: [19, 'Salmiya 1'] },
          ])
        }
        if (model === 'pos.order' && method === 'read_group') {
          const groupby = (methodArgs[2] as string[]) ?? []
          const dayRange = {
            'date_order:day': { from: '2026-11-13 21:00:00', to: '2026-11-14 21:00:00' },
          }
          const hourRange = {
            'date_order:hour': { from: '2026-11-14 10:00:00', to: '2026-11-14 11:00:00' },
          }
          if (groupby.includes('date_order:day')) {
            if (domainStr.includes('["amount_total",">=",0]')) {
              return rpcReply([
                { session_id: [601, 'S601'], pricelist_id: false, __count: 9, __range: dayRange },
                { session_id: [602, 'S602'], pricelist_id: false, __count: 9, __range: dayRange },
              ])
            }
            return rpcReply([
              {
                session_id: [601, 'S601'],
                pricelist_id: false,
                amount_total: 90,
                amount_tax: 0,
                __count: 10,
                __range: dayRange,
              },
              {
                session_id: [602, 'S602'],
                pricelist_id: false,
                amount_total: -20,
                amount_tax: 0,
                __count: 10,
                __range: dayRange,
              },
              {
                session_id: [603, 'S603'],
                pricelist_id: false,
                amount_total: -15,
                amount_tax: 0,
                __count: 1,
                __range: dayRange,
              },
            ])
          }
          // The cube now reads hourly per register scope (`session_id.config_id in [...]`) grouped by
          // `date_order:hour` only; answer it from the same session rows, filtered to that scope.
          const hourReply = (rows: { session_id: [number, string]; amount_total?: number; amount_tax?: number; __count?: number; __range: unknown }[]) => {
            if (groupby.includes('session_id')) return rpcReply(rows)
            const cfgOfSessionId: Record<number, number> = { 601: 8, 602: 17, 603: 19 }
            const scope = /"session_id\.config_id","in",\[([0-9,]*)\]/.exec(domainStr)?.[1] ?? ''
            const allowed = new Set(scope.split(',').filter(Boolean).map(Number))
            const inScope = rows.filter((r) => allowed.has(cfgOfSessionId[r.session_id[0]]))
            if (inScope.length === 0) return rpcReply([])
            return rpcReply([
              {
                amount_total: inScope.reduce((a, r) => a + (r.amount_total ?? 0), 0),
                amount_tax: inScope.reduce((a, r) => a + (r.amount_tax ?? 0), 0),
                __count: inScope.reduce((a, r) => a + (r.__count ?? 0), 0),
                __range: inScope[0].__range,
              },
            ])
          }
          if (groupby.includes('date_order:hour')) {
            if (domainStr.includes('["amount_total",">=",0]')) {
              return hourReply([
                { session_id: [601, 'S601'], __count: 9, __range: hourRange },
                { session_id: [602, 'S602'], __count: 9, __range: hourRange },
              ])
            }
            return hourReply([
              {
                session_id: [601, 'S601'],
                amount_total: 90,
                amount_tax: 0,
                __count: 10,
                __range: hourRange,
              },
              {
                session_id: [602, 'S602'],
                amount_total: -20,
                amount_tax: 0,
                __count: 10,
                __range: hourRange,
              },
              {
                session_id: [603, 'S603'],
                amount_total: -15,
                amount_tax: 0,
                __count: 1,
                __range: hourRange,
              },
            ])
          }
          return rpcReply([])
        }
        if (model === 'pos.payment' && method === 'read_group') {
          if (domainStr.includes('["pos_order_id.amount_total",">=",0]')) {
            return rpcReply([
              { session_id: [601, 'S601'], payment_method_id: [7, 'Talabat Go'], __count: 9 },
              { session_id: [602, 'S602'], payment_method_id: [7, 'Talabat Go'], __count: 9 },
            ])
          }
          return rpcReply([
            {
              session_id: [601, 'S601'],
              payment_method_id: [7, 'Talabat Go'],
              amount: 90,
              __count: 10,
            },
            {
              session_id: [602, 'S602'],
              payment_method_id: [7, 'Talabat Go'],
              amount: -20,
              __count: 10,
            },
            {
              session_id: [603, 'S603'],
              payment_method_id: [8, 'KNET'],
              amount: -15,
              __count: 1,
            },
          ])
        }
        return rpcReply([])
      })

      const cube = await fetchLiveOdooPeriodCube(
        '2026-11-14',
        '2026-11-14',
        Date.parse('2026-11-16T09:00:00.000Z'),
      )
      expect(cube.byBranch.promenade).toMatchObject({ netKwd: 90, orders: 9 })
      expect(cube.byBranch['360-mall']).toMatchObject({ netKwd: -20, orders: 9 })
      expect(cube.byBranch.salmiya).toMatchObject({ netKwd: -15, orders: 0 })
      expect(cube.byBranch['360-mall'].channels['talabat-tgo']).toEqual({ netKwd: -20, orders: 9 })
      expect(cube.byBranch.salmiya.channels['dine-in']).toEqual({ netKwd: -15, orders: 0 })
      // 10:00 UTC = 13:00 Kuwait (UTC+3)
      expect(cube.hourlyByBranch.promenade?.[13]).toEqual({ hour: 13, orders: 9, netKwd: 90 })
      expect(cube.hourlyByBranch['360-mall']?.[13]).toEqual({ hour: 13, orders: 9, netKwd: -20 })
      expect(cube.hourlyByBranch.salmiya?.[13]).toEqual({ hour: 13, orders: 0, netKwd: -15 })
      expect(cube.hourlySeries[13]).toEqual({ hour: 13, orders: 18, netKwd: 55 })
    } finally {
      for (const key of ODOO_ENV_KEYS) {
        if (saved[key] === undefined) delete process.env[key]
        else process.env[key] = saved[key]
      }
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
    }
  })

  it('keeps tooltip search_count domain strictly equal to buildPosOrderKpiDomain with nonRefundOnly: true', () => {
    expect(typeof posOrderQuery.buildPosOrderKpiDomain).toBe('function')
    expect(typeof posOrderQuery.parseDescribedPosOrderDomain).toBe('function')

    const kpiCountDomain = posOrderQuery.buildPosOrderKpiDomain({
      fromKuwaitDate: '2026-11-16',
      toInclusiveKuwaitDate: '2026-11-16',
      companyId: 1,
      configIds: [3, 16, 41, 42],
      nonRefundOnly: true,
    })
    const describedCountQuery = posOrderQuery.describePosOrderQuery({
      fromKuwaitDate: '2026-11-16',
      toInclusiveKuwaitDate: '2026-11-16',
      companyId: 1,
      configIds: [3, 16, 41, 42],
      aggregate: 'search_count',
    })
    expect(posOrderQuery.parseDescribedPosOrderDomain(describedCountQuery)).toEqual(kpiCountDomain)

    const kpiNetDomain = posOrderQuery.buildPosOrderKpiDomain({
      fromKuwaitDate: '2026-11-16',
      toInclusiveKuwaitDate: '2026-11-16',
      companyId: 1,
      nonRefundOnly: false,
    })
    const describedNetQuery = posOrderQuery.describePosOrderQuery({
      fromKuwaitDate: '2026-11-16',
      toInclusiveKuwaitDate: '2026-11-16',
      companyId: 1,
      aggregate: 'read_group',
    })
    expect(posOrderQuery.parseDescribedPosOrderDomain(describedNetQuery)).toEqual(kpiNetDomain)
  })
})

describe('phase 12 should-fix 2: word-boundary non-operating check on cfgName only', () => {
  it('maps Delivery (Salmyia) to salmiya even when extraContext contains Latest Contest, while rejecting Test Delivery (Salmyia)', () => {
    expect(
      resolveRestaurantBranchForConfig(20, 'Delivery (Salmyia)', 'Latest Contest: PoS Orders'),
    ).toBe('salmiya')
    expect(resolveRestaurantBranchForConfig(20, 'Test Delivery (Salmyia)', '')).toBeNull()
  })
})

describe('phase 12 should-fix 3 (option b): archived pinned register #16 policy & non-decommissioned classification', () => {
  const savedEnv: Partial<Record<(typeof ODOO_ENV_KEYS)[number], string | undefined>> = {}

  afterEach(() => {
    for (const key of ODOO_ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = savedEnv[key]
      }
    }
    vi.restoreAllMocks()
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
  })

  it('excludes archived #16 from active POS while including active #16, never counting unknown 99999, and documenting TODO(Abdullah)', () => {
    expect(companyPos.companyPosConfigAllowed(16, 'Promenade', false)).toBe(false)
    expect(companyPos.companyPosConfigAllowed(16, 'Promenade', true)).toBe(true)
    expect(companyPos.companyPosConfigAllowed(99999, 'Promenade', false)).toBe(false)
    expect(companyPos.ARCHIVED_PINNED_REGISTER_POLICY).toBe('active_only_todo_abdullah')

    const companyPosSrc = readFileSync(
      path.join(process.cwd(), 'src', 'lib', 'odoo', 'company-pos.ts'),
      'utf8',
    )
    expect(companyPosSrc).toContain('ARCHIVED_PINNED_REGISTER_POLICY')
    expect(companyPosSrc).toMatch(/TODO\(Abdullah\).*16/s)
    expect(isDecommissionedWarehouseRecord('Promenade')).toBe(false)
  })

  it('does NOT classify archived #16 as a decommissioned excluded entity in fetchLiveOdooPeriodCube', async () => {
    for (const key of ODOO_ENV_KEYS) {
      savedEnv[key] = process.env[key]
    }
    process.env.ODOO_URL = 'https://localhost:8069'
    process.env.ODOO_DB = 'vf_test'
    process.env.ODOO_USERNAME = 'bi@example.com'
    process.env.ODOO_API_KEY = 'test_key'
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        id?: number
        params?: { service?: string; method?: string; args?: unknown[] }
      }
      const rpcReply = (result: unknown) =>
        new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, result }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })

      if (body.params?.service === 'common' && body.params?.method === 'authenticate') {
        return rpcReply(7)
      }
      const args = body.params?.args ?? []
      const model = String(args[3] ?? '')
      const method = String(args[4] ?? '')

      if (model === 'pos.config' && method === 'search_read') {
        return rpcReply([
          { id: 8, name: 'Promenade 1', active: true, company_id: [1, 'Venture Foods'] },
          { id: 16, name: 'Promenade', active: false, company_id: [1, 'Venture Foods'] },
          { id: 24, name: 'Qurain Dispatch', active: false, company_id: [1, 'Venture Foods'] },
          {
            id: 42,
            name: 'FAIPS Ahmadi',
            active: true,
            company_id: [1, 'Venture Foods'],
            picking_type_id: [5, 'Venture Foods Hawally: PoS Orders'],
          },
          { id: 99999, name: 'Legacy Unknown', active: false, company_id: [1, 'Venture Foods'] },
        ])
      }
      if (model === 'res.users' && method === 'read') {
        return rpcReply([{ id: 7, company_id: [1, 'Venture Foods'] }])
      }
      return rpcReply([])
    })

    const cube = await fetchLiveOdooPeriodCube(
      '2026-11-15',
      '2026-11-15',
      Date.parse('2026-11-16T09:00:00.000Z'),
    )
    expect(cube.connected).toBe(true)
    expect(cube.posConfigIds?.excludedConfigIds).not.toContain(16)
    expect(cube.posConfigIds?.excludedConfigIds).not.toContain(99999)
    expect(cube.posConfigIds?.excludedConfigIds).toContain(24)
    expect(cube.posConfigIds?.configIdsByBranch?.promenade).toEqual([8])
    expect(cube.posConfigIds?.configIdsByBranch?.['school-canteens']).toEqual([42])
  })
})

describe('pos.config 43 FAS Fahaheel is a pinned school canteen (owner decision 2026-11-17)', () => {
  it('pins config 43 as a school canteen in pos-registry.json and allows it', () => {
    expect(posRegistry.schoolCanteenPosConfigIds).toContain(43)
    expect(posRegistry.allowedPosConfigIds).toContain(43)
    expect(posRegistry.registers['43' as keyof typeof posRegistry.registers]).toEqual({
      location: 'school-canteens',
    })
    expect(companyPos.isPinnedSchoolCanteenConfigId(43)).toBe(true)
    expect(companyPos.companyPosConfigAllowed(43, 'FAS Fahaheel')).toBe(true)
    expect(companyPos.companyPosConfigAllowed(43, 'FAS Fahaheel', false)).toBe(false)
    expect(companyPos.schoolCanteenRegisterIds()).toContain(43)
    expect(companyPos.restaurantRegisterIds()).not.toContain(43)
  })

  it('maps config 43 to school-canteens and never to al-kout', () => {
    for (const ignoreAdminOverride of [true, false]) {
      expect(
        resolveRestaurantBranchForConfig(43, 'FAS Fahaheel', '', { ignoreAdminOverride }),
      ).toBe('school-canteens')
    }
    expect(resolveRestaurantBranchForConfig(43, 'FAS Fahaheel', 'Venture Foods')).not.toBe('al-kout')
  })

  it('does not map an unknown Fahaheel-named register to al-kout', () => {
    for (const name of ['Fahaheel Kiosk', 'FAS Fahaheel', 'مقصف الفحيحيل', 'Delivery (Fahaheel)']) {
      expect(resolveRestaurantBranchForConfig(9043, name, '', { ignoreAdminOverride: true })).not.toBe(
        'al-kout',
      )
    }
    expect(resolveRestaurantBranchForConfig(9043, 'China Garden (KOUT)', '', { ignoreAdminOverride: true })).toBe(
      'al-kout',
    )
  })
})
