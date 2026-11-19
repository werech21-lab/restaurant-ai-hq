import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SALARY_WINDOW_DAYS as CanonicalSalaryWindow,
  isSalaryWindowDay as canonicalIsSalaryWindowDay,
} from '@/lib/aether/salary-window'
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_AUDITOR_EMAIL,
  DEFAULT_CFO_EMAIL,
  DEFAULT_DGM_EMAIL,
  DEFAULT_GM_EMAIL,
  DEFAULT_MARKETING_EMAIL,
  DEFAULT_OPS_EMAIL,
  DEFAULT_SUPPLY_EMAIL,
  EXEC_SESSION_COOKIE,
  createExecSessionToken,
} from '@/lib/auth/exec-session'
import { middleware } from '@/middleware'

type RpcStubFn = (
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown>,
  options?: { timeoutMs?: number; timeoutCapMs?: number },
) => Promise<unknown>

let rpcStubImpl: RpcStubFn = async () => []

vi.mock('@/lib/odoo-live-connector', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/odoo-live-connector')>()
  return {
    ...actual,
    executeOdooKw: <T = unknown>(
      model: string,
      method: string,
      args: unknown[] = [],
      kwargs: Record<string, unknown> = {},
      options?: { timeoutMs?: number; timeoutCapMs?: number },
    ): Promise<T> => rpcStubImpl(model, method, args, kwargs, options) as Promise<T>,
  }
})

import {
  DELETE,
  GET,
  PATCH,
  POST,
  PUT,
  dynamic,
  maxDuration,
} from '@/app/api/admin/season-detection/route'
import {
  BOOTH_EVENT_GAP_DAYS,
  BOOTH_POS_CONFIG_IDS,
  CANTEEN_POS_CONFIG_IDS,
  CANTEEN_TERM_GAP_DAYS,
  ODOO_SEARCH_READ_PAGE_LIMIT,
  POS_ORDER_VALID_STATES,
  SALARY_WINDOW_DAYS,
  SEASON_DETECTION_BUDGET_MS,
  SEASON_DETECTION_TIMEZONE,
  SEASON_HISTORY_START_KUWAIT,
  analyzeCanteenHistory,
  createBudgetTracker,
  createReadOnlyOdooExecutor,
  detectBoothEventsFromPerConfigDaily,
  detectCanteenTermsFromDaily,
  fetchConfigDailyPosHistory,
  isSalaryWindowDay,
  parseKuwaitDayFromReadGroupRow,
  runSeasonDetection,
  type ReadOnlyOdooExecutor,
  type ReadOnlyOdooMethod,
} from '@/lib/aether/season-detection'

interface RecordedRpcCall {
  model: string
  method: string
  args: unknown[]
  kwargs: Record<string, unknown>
  options?: { timeoutMs?: number; timeoutCapMs?: number }
}

function extractQueriedConfigId(domain: unknown): number | null {
  if (!Array.isArray(domain)) return null
  for (const clause of domain) {
    if (
      Array.isArray(clause) &&
      clause.length >= 3 &&
      clause[0] === 'config_id' &&
      clause[1] === '=' &&
      typeof clause[2] === 'number'
    ) {
      return clause[2]
    }
  }
  return null
}

function buildAuthedRouteRequest(
  pathWithQuery: string,
  token?: string,
  method = 'GET',
): NextRequest {
  const headers: Record<string, string> = {
    accept: 'application/json',
    host: 'aetherbi.com',
  }
  if (token) {
    headers.cookie = `${EXEC_SESSION_COOKIE}=${token}`
  }
  return new NextRequest(`https://aetherbi.com${pathWithQuery}`, {
    method,
    headers,
  })
}

describe('AetherBI Historical Season Detection Suite', () => {
  beforeEach(() => {
    rpcStubImpl = async () => []
  })

  describe('1. Named POS Config ID Constants & Salary Window Invariants', () => {
    it('exports exact CANTEEN_POS_CONFIG_IDS, BOOTH_POS_CONFIG_IDS, gap thresholds, history start, and 60s budget', () => {
      expect([...CANTEEN_POS_CONFIG_IDS]).toEqual([41, 42, 43])
      expect(CANTEEN_TERM_GAP_DAYS).toBe(7)
      expect([...BOOTH_POS_CONFIG_IDS]).toEqual([26, 27, 28, 29, 30, 31, 32, 33, 37, 38])
      expect(BOOTH_EVENT_GAP_DAYS).toBe(3)
      expect(SEASON_HISTORY_START_KUWAIT).toBe('2024-12-31')
      expect(SEASON_DETECTION_TIMEZONE).toBe('Asia/Kuwait')
      expect([...POS_ORDER_VALID_STATES]).toEqual(['paid', 'done', 'invoiced'])
      expect(ODOO_SEARCH_READ_PAGE_LIMIT).toBe(5000)
      expect(SEASON_DETECTION_BUDGET_MS).toBe(60_000)
    })

    it('re-exports SALARY_WINDOW_DAYS and isSalaryWindowDay strictly by reference from salary-window.ts', () => {
      expect(SALARY_WINDOW_DAYS).toBe(CanonicalSalaryWindow)
      expect(SALARY_WINDOW_DAYS).toEqual({ start: 5, end: 10 })
      expect(isSalaryWindowDay).toBe(canonicalIsSalaryWindowDay)
      expect(isSalaryWindowDay('2025-05-04')).toBe(false)
      expect(isSalaryWindowDay('2025-05-05')).toBe(true)
      expect(isSalaryWindowDay('2025-05-10')).toBe(true)
      expect(isSalaryWindowDay('2025-05-11')).toBe(false)
    })
  })

  describe('2. Canteen Term Detection (gap >= 7 non-selling days)', () => {
    it('keeps a 6-day non-selling gap (strictly below threshold) as a single term run', () => {
      const terms = detectCanteenTermsFromDaily([
        { date: '2025-01-10', orders: 40, netKwd: 62.5 },
        { date: '2025-01-17', orders: 55, netKwd: 84.25 },
      ])

      expect(terms).toEqual([
        {
          firstSellingDay: '2025-01-10',
          lastSellingDay: '2025-01-17',
          sellingDays: 2,
          calendarDays: 8,
          orders: 95,
          netKwd: 146.75,
        },
      ])
      expect(terms[0]?.gapBeforeDays).toBeUndefined()
    })

    it('splits a 7-day non-selling gap (exact threshold) into two separate term runs', () => {
      const terms = detectCanteenTermsFromDaily([
        { date: '2025-01-10', orders: 40, netKwd: 62.5 },
        { date: '2025-01-18', orders: 55, netKwd: 84.25 },
      ])

      expect(terms).toEqual([
        {
          firstSellingDay: '2025-01-10',
          lastSellingDay: '2025-01-10',
          sellingDays: 1,
          calendarDays: 1,
          orders: 40,
          netKwd: 62.5,
        },
        {
          firstSellingDay: '2025-01-18',
          lastSellingDay: '2025-01-18',
          sellingDays: 1,
          calendarDays: 1,
          orders: 55,
          netKwd: 84.25,
          gapBeforeDays: 7,
        },
      ])
    })

    it('splits a 14-day break above threshold and ignores zero-net days when computing selling gaps', () => {
      const terms = detectCanteenTermsFromDaily([
        { date: '2025-02-01', orders: 30, netKwd: 45 },
        { date: '2025-02-02', orders: 35, netKwd: 52.5 },
        { date: '2025-02-08', orders: 0, netKwd: 0 },
        { date: '2025-02-17', orders: 50, netKwd: 75.125 },
      ])

      expect(terms).toHaveLength(2)
      expect(terms[0]).toEqual({
        firstSellingDay: '2025-02-01',
        lastSellingDay: '2025-02-02',
        sellingDays: 2,
        calendarDays: 2,
        orders: 65,
        netKwd: 97.5,
      })
      expect(terms[1]).toEqual({
        firstSellingDay: '2025-02-17',
        lastSellingDay: '2025-02-17',
        sellingDays: 1,
        calendarDays: 1,
        orders: 50,
        netKwd: 75.125,
        gapBeforeDays: 14,
      })
    })

    it('handles a single-day selling run with firstSellingDay === lastSellingDay and calendarDays === 1', () => {
      const terms = detectCanteenTermsFromDaily([
        { date: '2025-03-03', orders: 18, netKwd: 27.4 },
      ])

      expect(terms).toEqual([
        {
          firstSellingDay: '2025-03-03',
          lastSellingDay: '2025-03-03',
          sellingDays: 1,
          calendarDays: 1,
          orders: 18,
          netKwd: 27.4,
        },
      ])
    })

    it('computes per-config vs combined canteen terms when one register pauses while another keeps selling', () => {
      const result = analyzeCanteenHistory({
        fromKuwaitDate: '2025-01-01',
        toKuwaitDate: '2025-01-31',
        perConfigDaily: [
          {
            configId: 41,
            activeStatus: 'active',
            daily: [
              { date: '2025-01-05', orders: 20, netKwd: 30 },
              { date: '2025-01-20', orders: 25, netKwd: 38 },
            ],
          },
          {
            configId: 42,
            activeStatus: 'active',
            daily: [
              { date: '2025-01-10', orders: 30, netKwd: 45 },
              { date: '2025-01-15', orders: 28, netKwd: 42 },
            ],
          },
          {
            configId: 43,
            activeStatus: 'inactive',
            daily: [],
          },
        ],
      })

      const cfg41 = result.perConfig.find((c) => c.configId === 41)
      const cfg42 = result.perConfig.find((c) => c.configId === 42)
      expect(cfg41?.terms).toHaveLength(2)
      expect(cfg41?.terms[1]?.gapBeforeDays).toBe(14)
      expect(cfg42?.terms).toHaveLength(1)

      expect(result.combined.terms).toEqual([
        {
          firstSellingDay: '2025-01-05',
          lastSellingDay: '2025-01-20',
          sellingDays: 4,
          calendarDays: 16,
          orders: 103,
          netKwd: 155,
        },
      ])
    })
  })

  describe('3. Booth Event Detection (gap >= 3 non-selling days & empty name)', () => {
    it('keeps a 2-day non-selling gap (strictly below threshold) in one booth event with empty name', () => {
      const { events } = detectBoothEventsFromPerConfigDaily([
        {
          configId: 26,
          daily: [
            { date: '2025-02-01', orders: 60, netKwd: 210.5 },
            { date: '2025-02-04', orders: 75, netKwd: 265.25 },
          ],
        },
      ])

      expect(events).toEqual([
        {
          name: '',
          start: '2025-02-01',
          end: '2025-02-04',
          days: 4,
          sellingDays: 2,
          orders: 135,
          netKwd: 475.75,
          configs: [26],
        },
      ])
    })

    it('splits a 3-day non-selling gap (exact threshold) into two booth events', () => {
      const { events } = detectBoothEventsFromPerConfigDaily([
        {
          configId: 26,
          daily: [
            { date: '2025-02-01', orders: 60, netKwd: 210.5 },
            { date: '2025-02-05', orders: 75, netKwd: 265.25 },
          ],
        },
      ])

      expect(events).toEqual([
        {
          name: '',
          start: '2025-02-01',
          end: '2025-02-01',
          days: 1,
          sellingDays: 1,
          orders: 60,
          netKwd: 210.5,
          configs: [26],
        },
        {
          name: '',
          start: '2025-02-05',
          end: '2025-02-05',
          days: 1,
          sellingDays: 1,
          orders: 75,
          netKwd: 265.25,
          configs: [26],
          gapBeforeDays: 3,
        },
      ])
    })

    it('detects a single-day booth event with start === end, days === 1, sellingDays === 1, and empty name', () => {
      const { events } = detectBoothEventsFromPerConfigDaily([
        {
          configId: 26,
          daily: [{ date: '2025-03-15', orders: 42, netKwd: 158.375 }],
        },
      ])

      expect(events).toEqual([
        {
          name: '',
          start: '2025-03-15',
          end: '2025-03-15',
          days: 1,
          sellingDays: 1,
          orders: 42,
          netKwd: 158.375,
          configs: [26],
        },
      ])
    })

    it('merges multi-config booth activity with sorted unique config IDs, 3dp netKwd, and empty name', () => {
      const { daily, events } = detectBoothEventsFromPerConfigDaily([
        {
          configId: 37,
          daily: [
            { date: '2025-04-10', orders: 22, netKwd: 88.123 },
            { date: '2025-04-12', orders: 19, netKwd: 74.456 },
          ],
        },
        {
          configId: 26,
          daily: [{ date: '2025-04-10', orders: 31, netKwd: 112.421 }],
        },
      ])

      expect(daily).toEqual([
        { date: '2025-04-10', orders: 53, netKwd: 200.544, configs: [26, 37] },
        { date: '2025-04-12', orders: 19, netKwd: 74.456, configs: [37] },
      ])
      expect(events).toEqual([
        {
          name: '',
          start: '2025-04-10',
          end: '2025-04-12',
          days: 3,
          sellingDays: 2,
          orders: 72,
          netKwd: 275,
          configs: [26, 37],
        },
      ])
    })
  })

  describe('4. Inactive POS Configs (active_test: false) & ID-Only Matching', () => {
    it('queries pos.config and pos.order with active_test: false by ID only and includes inactive configs 43 and 38 in terms and events', async () => {
      const recordedCalls: RecordedRpcCall[] = []

      const executor: ReadOnlyOdooExecutor = async <T = unknown>(
        model: string,
        method: ReadOnlyOdooMethod,
        args: unknown[],
        kwargs: Record<string, unknown>,
        options?: { timeoutMs?: number; timeoutCapMs?: number },
      ): Promise<T> => {
        recordedCalls.push({ model, method, args, kwargs, options })

        if (model === 'pos.config' && method === 'search_read') {
          const allIds = [...CANTEEN_POS_CONFIG_IDS, ...BOOTH_POS_CONFIG_IDS]
          return allIds.map((id) => ({
            id,
            active: id !== 43 && id !== 38,
          })) as unknown as T
        }

        if (model === 'pos.order' && method === 'read_group') {
          const cfgId = extractQueriedConfigId(args[0])
          if (cfgId === 43) {
            return [
              {
                'date_order:day': '2025-01-12',
                __count: 24,
                amount_total: 48.5,
                amount_tax: 0,
              },
            ] as unknown as T
          }
          if (cfgId === 38) {
            return [
              {
                'date_order:day': '2025-02-20',
                __count: 33,
                amount_total: 129.75,
                amount_tax: 0,
              },
            ] as unknown as T
          }
          return [] as unknown as T
        }

        return [] as unknown as T
      }

      const report = await runSeasonDetection({
        fromKuwaitDate: '2024-12-31',
        toKuwaitDate: '2025-03-01',
        executor,
      })

      const configCalls = recordedCalls.filter((c) => c.model === 'pos.config')
      expect(configCalls).toHaveLength(1)
      expect(configCalls[0]?.method).toBe('search_read')
      expect(configCalls[0]?.args[0]).toEqual([
        ['id', 'in', [...CANTEEN_POS_CONFIG_IDS, ...BOOTH_POS_CONFIG_IDS]],
      ])
      expect(configCalls[0]?.kwargs.fields).toEqual(['id', 'active'])
      expect(configCalls[0]?.kwargs.context).toEqual({ active_test: false })
      expect(JSON.stringify(configCalls[0]?.args)).not.toContain('name')

      const orderCalls = recordedCalls.filter((c) => c.model === 'pos.order')
      expect(orderCalls).toHaveLength(
        CANTEEN_POS_CONFIG_IDS.length + BOOTH_POS_CONFIG_IDS.length,
      )
      for (const call of orderCalls) {
        expect(call.kwargs.context).toEqual({
          tz: 'Asia/Kuwait',
          active_test: false,
        })
        expect(JSON.stringify(call.args[0])).not.toContain('name')
      }

      const canteen43 = report.canteens.perConfig.find((c) => c.configId === 43)
      expect(canteen43?.activeStatus).toBe('inactive')
      expect(canteen43?.totalOrders).toBe(24)
      expect(canteen43?.totalNetKwd).toBe(48.5)
      expect(report.canteens.combined.terms).toEqual([
        {
          firstSellingDay: '2025-01-12',
          lastSellingDay: '2025-01-12',
          sellingDays: 1,
          calendarDays: 1,
          orders: 24,
          netKwd: 48.5,
        },
      ])

      const booth38 = report.booths.perConfig.find((c) => c.configId === 38)
      expect(booth38?.activeStatus).toBe('inactive')
      expect(booth38?.totalOrders).toBe(33)
      expect(booth38?.totalNetKwd).toBe(129.75)
      expect(report.booths.events).toEqual([
        {
          name: '',
          start: '2025-02-20',
          end: '2025-02-20',
          days: 1,
          sellingDays: 1,
          orders: 33,
          netKwd: 129.75,
          configs: [38],
        },
      ])
    })
  })

  describe('5. Odoo Query Safety, Kuwait Midnight Boundaries, Pagination & Read-Only Guard', () => {
    it('uses exact Asia/Kuwait UTC bounds (2024-12-30 21:00:00), valid states, single config_id domain, and never puts config_id in groupby', async () => {
      const orderCalls: RecordedRpcCall[] = []

      const executor = createReadOnlyOdooExecutor(async <T = unknown>(
        model: string,
        method: string,
        args: unknown[] = [],
        kwargs: Record<string, unknown> = {},
      ): Promise<T> => {
        if (model === 'pos.order') {
          orderCalls.push({ model, method, args, kwargs })
        }
        return [] as unknown as T
      })

      await runSeasonDetection({
        fromKuwaitDate: '2024-12-31',
        toKuwaitDate: '2025-01-05',
        mode: 'read_group',
        executor,
      })

      expect(orderCalls).toHaveLength(13)
      for (const call of orderCalls) {
        expect(call.method).toBe('read_group')
        const domain = call.args[0] as unknown[]
        const cfgId = extractQueriedConfigId(domain)
        expect(cfgId).not.toBeNull()
        expect(domain).toEqual([
          ['config_id', '=', cfgId],
          ['state', 'in', ['paid', 'done', 'invoiced']],
          ['date_order', '>=', '2024-12-30 21:00:00'],
          ['date_order', '<', '2025-01-05 21:00:00'],
        ])
        expect(call.args[2]).toEqual(['date_order:day'])
        expect(JSON.stringify(call.args[2])).not.toContain('config_id')
      }

      expect(
        parseKuwaitDayFromReadGroupRow({
          __range: { 'date_order:day': { from: '2024-12-30 21:00:00' } },
        }),
      ).toBe('2024-12-31')
      expect(
        parseKuwaitDayFromReadGroupRow({
          __domain: [['date_order', '>=', '2025-01-01 21:00:00']],
        }),
      ).toBe('2025-01-02')
      expect(parseKuwaitDayFromReadGroupRow({ 'date_order:day': '31 Dec 2024' })).toBe(
        '2024-12-31',
      )
      expect(parseKuwaitDayFromReadGroupRow({ 'date_order:day': 'Jan 05, 2025' })).toBe(
        '2025-01-05',
      )
    })

    it('blocks write RPC methods and rejects config_id in groupby at runtime', async () => {
      const guarded = createReadOnlyOdooExecutor(async <T = unknown>(): Promise<T> => {
        return [] as unknown as T
      })

      for (const forbiddenMethod of ['write', 'create', 'unlink'] as const) {
        await expect(
          guarded(
            'pos.order',
            forbiddenMethod as unknown as ReadOnlyOdooMethod,
            [],
            {},
          ),
        ).rejects.toThrow(/Write or non-read-only Odoo method blocked/)
      }

      await expect(
        guarded('pos.order', 'read_group', [[], ['amount_total:sum'], ['config_id']], {}),
      ).rejects.toThrow(/pos\.order\.config_id is not stored and must never appear in groupby/)

      await expect(
        guarded(
          'pos.order',
          'read_group',
          [[], ['amount_total:sum'], ['date_order:day']],
          { groupby: ['config_id:day'] },
        ),
      ).rejects.toThrow(/pos\.order\.config_id is not stored and must never appear in groupby/)
    })

    it('caps search_read limit at <= 5000 and paginates multi-page Asia/Kuwait midnight-crossing orders accurately', async () => {
      const limitsSent: number[] = []
      const capExecutor: ReadOnlyOdooExecutor = async <T = unknown>(
        _model: string,
        _method: ReadOnlyOdooMethod,
        _args: unknown[],
        kwargs: Record<string, unknown>,
      ): Promise<T> => {
        limitsSent.push(Number(kwargs.limit))
        return [] as unknown as T
      }

      await fetchConfigDailyPosHistory({
        configId: 41,
        scope: 'canteen',
        fromKuwaitDate: '2025-01-01',
        toKuwaitDate: '2025-01-03',
        fromUtc: '2024-12-31 21:00:00',
        toExclusiveUtc: '2025-01-03 21:00:00',
        mode: 'search_read',
        pageSize: 9999,
        executor: capExecutor,
        budget: createBudgetTracker(10_000),
      })
      expect(limitsSent).toEqual([5000])

      const offsetsVisited: number[] = []
      const pagedExecutor: ReadOnlyOdooExecutor = async <T = unknown>(
        _model: string,
        _method: ReadOnlyOdooMethod,
        _args: unknown[],
        kwargs: Record<string, unknown>,
      ): Promise<T> => {
        const offset = Number(kwargs.offset ?? 0)
        offsetsVisited.push(offset)
        if (offset === 0) {
          return [
            {
              date_order: '2025-01-01 20:45:00',
              amount_total: 10.5,
              amount_tax: 0.5,
              state: 'paid',
            },
            {
              date_order: '2025-01-01 21:30:00',
              amount_total: 15,
              amount_tax: 0,
              state: 'done',
            },
          ] as unknown as T
        }
        return [
          {
            date_order: '2025-01-01 22:15:00',
            amount_total: 8.25,
            state: 'invoiced',
          },
        ] as unknown as T
      }

      const pagedResult = await fetchConfigDailyPosHistory({
        configId: 41,
        scope: 'canteen',
        fromKuwaitDate: '2025-01-01',
        toKuwaitDate: '2025-01-03',
        fromUtc: '2024-12-31 21:00:00',
        toExclusiveUtc: '2025-01-03 21:00:00',
        mode: 'search_read',
        pageSize: 2,
        executor: pagedExecutor,
        budget: createBudgetTracker(10_000),
      })

      expect(offsetsVisited).toEqual([0, 2])
      expect(pagedResult.partial).toBe(false)
      expect(pagedResult.daily).toEqual([
        { date: '2025-01-01', orders: 1, netKwd: 10 },
        { date: '2025-01-02', orders: 2, netKwd: 23.25 },
      ])
    })
  })

  describe('6. 60s Budget Enforcement, Partial Failures & Secret Redaction', () => {
    it('returns partial: true with sanitized error text (stripping URLs, api_key, password, token) while preserving other configs', async () => {
      const executor: ReadOnlyOdooExecutor = async <T = unknown>(
        model: string,
        method: ReadOnlyOdooMethod,
        args: unknown[],
      ): Promise<T> => {
        if (model === 'pos.config' && method === 'search_read') {
          return [...CANTEEN_POS_CONFIG_IDS, ...BOOTH_POS_CONFIG_IDS].map((id) => ({
            id,
            active: true,
          })) as unknown as T
        }

        const cfgId = extractQueriedConfigId(args[0])
        if (cfgId === 42) {
          throw new Error(
            'RPC failed at https://erp-internal.example.test/xmlrpc/2/object?api_key=synthKeyAlpha99 password=synthPassBeta88 token=synthTokenGamma77',
          )
        }
        if (cfgId === 41) {
          return [
            {
              'date_order:day': '2025-01-14',
              __count: 19,
              amount_total: 31.2,
              amount_tax: 0,
            },
          ] as unknown as T
        }
        if (cfgId === 26) {
          return [
            {
              'date_order:day': '2025-02-10',
              __count: 45,
              amount_total: 180.5,
              amount_tax: 0,
            },
          ] as unknown as T
        }
        return [] as unknown as T
      }

      const report = await runSeasonDetection({
        fromKuwaitDate: '2025-01-01',
        toKuwaitDate: '2025-03-01',
        executor,
      })

      expect(report.partial).toBe(true)
      expect(report.errors).toHaveLength(1)
      const sanitizedMsg = report.errors[0]?.message ?? ''
      expect(sanitizedMsg.length).toBeGreaterThan(0)
      expect(sanitizedMsg).toContain('[REDACTED_URL]')
      expect(sanitizedMsg).not.toContain('erp-internal.example.test')
      expect(sanitizedMsg).not.toContain('synthKeyAlpha99')
      expect(sanitizedMsg).not.toContain('synthPassBeta88')
      expect(sanitizedMsg).not.toContain('synthTokenGamma77')

      expect(report.canteens.combined.terms).toEqual([
        {
          firstSellingDay: '2025-01-14',
          lastSellingDay: '2025-01-14',
          sellingDays: 1,
          calendarDays: 1,
          orders: 19,
          netKwd: 31.2,
        },
      ])
      expect(report.booths.events).toEqual([
        {
          name: '',
          start: '2025-02-10',
          end: '2025-02-10',
          days: 1,
          sellingDays: 1,
          orders: 45,
          netKwd: 180.5,
          configs: [26],
        },
      ])
    })

    it('halts cleanly with TIMEOUT / BUDGET_EXCEEDED and partial: true when budgetMs is exhausted without hanging', async () => {
      const slowExecutor: ReadOnlyOdooExecutor = async <T = unknown>(): Promise<T> => {
        await new Promise((resolve) => setTimeout(resolve, 60))
        return [] as unknown as T
      }

      const started = Date.now()
      const report = await runSeasonDetection({
        fromKuwaitDate: '2025-01-01',
        toKuwaitDate: '2025-01-15',
        budgetMs: 8,
        executor: slowExecutor,
      })
      const wallElapsed = Date.now() - started

      expect(wallElapsed).toBeLessThan(1000)
      expect(report.partial).toBe(true)
      expect(report.errors.length).toBeGreaterThan(0)
      expect(
        report.errors.some(
          (err) => err.code === 'TIMEOUT' || err.code === 'BUDGET_EXCEEDED',
        ),
      ).toBe(true)
      expect(JSON.stringify(report)).not.toContain(':null')
    })
  })

  describe('7. API Route GET /api/admin/season-detection, CSV Export, RBAC & Middleware', () => {
    it('returns 401 for unauthenticated callers and 403 for gm, dgm, ops, cfo, marketing, and supply', async () => {
      const unauthMw = await middleware(buildAuthedRouteRequest('/api/admin/season-detection'))
      expect(unauthMw.status).toBe(401)

      const unauthRoute = await GET(buildAuthedRouteRequest('/api/admin/season-detection'))
      expect(unauthRoute.status).toBe(401)

      const deniedRoles = [
        { email: DEFAULT_GM_EMAIL, role: 'gm' as const },
        { email: DEFAULT_DGM_EMAIL, role: 'dgm' as const },
        { email: DEFAULT_OPS_EMAIL, role: 'ops' as const },
        { email: DEFAULT_CFO_EMAIL, role: 'cfo' as const },
        { email: DEFAULT_MARKETING_EMAIL, role: 'marketing' as const },
        { email: DEFAULT_SUPPLY_EMAIL, role: 'supply' as const },
      ]

      for (const account of deniedRoles) {
        const token = await createExecSessionToken(account.email, account.role)
        const res = await GET(buildAuthedRouteRequest('/api/admin/season-detection', token))
        expect(res.status, `Expected 403 for role ${account.role}`).toBe(403)
        const payload = await res.json()
        expect(payload.ok).toBe(false)
        expect(payload.error).toBe('forbidden_admin_or_auditor_only')
      }
    })

    it('allows admin and auditor on GET /api/admin/season-detection (middleware + route) and blocks auditor mutations in middleware with 403', async () => {
      expect(dynamic).toBe('force-dynamic')
      expect(maxDuration).toBe(60)

      rpcStubImpl = async (model, method, args) => {
        if (model === 'pos.config' && method === 'search_read') {
          return [...CANTEEN_POS_CONFIG_IDS, ...BOOTH_POS_CONFIG_IDS].map((id) => ({
            id,
            active: id !== 43 && id !== 38,
          }))
        }
        const cfgId = extractQueriedConfigId(args[0])
        if (cfgId === 41) {
          return [{ 'date_order:day': '2025-01-12', __count: 15, amount_total: 22.5, amount_tax: 0 }]
        }
        if (cfgId === 26) {
          return [{ 'date_order:day': '2025-02-08', __count: 30, amount_total: 120, amount_tax: 0 }]
        }
        return []
      }

      const adminToken = await createExecSessionToken(DEFAULT_ADMIN_EMAIL, 'admin')
      const auditorToken = await createExecSessionToken(DEFAULT_AUDITOR_EMAIL, 'auditor')

      const auditorGetMw = await middleware(
        buildAuthedRouteRequest('/api/admin/season-detection', auditorToken, 'GET'),
      )
      expect(auditorGetMw.status).toBe(200)
      expect(auditorGetMw.headers.get('x-middleware-next')).toBe('1')

      const auditorPostMw = await middleware(
        buildAuthedRouteRequest('/api/admin/season-detection', auditorToken, 'POST'),
      )
      expect(auditorPostMw.status).toBe(403)

      for (const token of [adminToken, auditorToken]) {
        const res = await GET(
          buildAuthedRouteRequest(
            '/api/admin/season-detection?from=2025-01-01&to=2025-03-01',
            token,
          ),
        )
        expect(res.status).toBe(200)
        expect(res.headers.get('X-Season-Detection-Partial')).toBe('false')
        const body = await res.json()
        expect(body.ok).toBe(true)
        expect(body.partial).toBe(false)
        expect(body.salaryWindow).toEqual({ start: 5, end: 10 })
        expect(body.canteens.combined.terms).toHaveLength(1)
        expect(body.booths.events).toHaveLength(1)
        expect(body.booths.events[0]?.name).toBe('')
      }
    })

    it('rejects POST, PUT, PATCH, DELETE on the route handler with 405 Method Not Allowed and Allow: GET, and validates query params with 400', async () => {
      for (const mutationHandler of [POST, PUT, PATCH, DELETE]) {
        const res = await mutationHandler()
        expect(res.status).toBe(405)
        expect(res.headers.get('Allow')).toBe('GET')
        const body = await res.json()
        expect(body.error).toBe('method_not_allowed')
      }

      const adminToken = await createExecSessionToken(DEFAULT_ADMIN_EMAIL, 'admin')
      const invalidQueries = [
        '/api/admin/season-detection?mode=unlink',
        '/api/admin/season-detection?from=2025-02-30',
        '/api/admin/season-detection?to=not-a-date',
        '/api/admin/season-detection?from=2025-06-10&to=2025-06-01',
      ]

      for (const badUrl of invalidQueries) {
        const res = await GET(buildAuthedRouteRequest(badUrl, adminToken))
        expect(res.status, `Expected 400 for ${badUrl}`).toBe(400)
      }
    })

    it('serves RFC-4180 CSV for ?format=csv to admin and auditor with salary window 5-10, canteen terms, and empty booth event names', async () => {
      rpcStubImpl = async (model, method, args) => {
        if (model === 'pos.config' && method === 'search_read') {
          return [...CANTEEN_POS_CONFIG_IDS, ...BOOTH_POS_CONFIG_IDS].map((id) => ({
            id,
            active: id !== 43 && id !== 38,
          }))
        }
        const cfgId = extractQueriedConfigId(args[0])
        if (cfgId === 43) {
          return [{ 'date_order:day': '2025-01-19', __count: 21, amount_total: 39.5, amount_tax: 0 }]
        }
        if (cfgId === 38) {
          return [{ 'date_order:day': '2025-02-14', __count: 44, amount_total: 176.25, amount_tax: 0 }]
        }
        return []
      }

      const adminToken = await createExecSessionToken(DEFAULT_ADMIN_EMAIL, 'admin')
      const auditorToken = await createExecSessionToken(DEFAULT_AUDITOR_EMAIL, 'auditor')

      for (const token of [adminToken, auditorToken]) {
        const res = await GET(
          buildAuthedRouteRequest(
            '/api/admin/season-detection?format=csv&from=2025-01-01&to=2025-03-01',
            token,
          ),
        )
        expect(res.status).toBe(200)
        expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
        expect(res.headers.get('Content-Disposition')).toContain('season-detection.csv')
        expect(res.headers.get('X-Season-Detection-Partial')).toBe('false')

        const csvText = await res.text()
        const rows = csvText.trim().split('\n')
        expect(rows[0]).toBe(
          'section,scope,config_ids,name,start_date,end_date,days,selling_days,orders,net_kwd,gap_before_days,active_status,partial,error',
        )
        expect(rows).toContain(
          'salary_window,company,,monthly_salary_window_day_of_month,5,10,6,,,,,,false,',
        )
        expect(rows).toContain(
          'canteen_term,canteen_combined,41|42|43,,2025-01-19,2025-01-19,1,1,21,39.500,,,false,',
        )
        expect(rows).toContain(
          'booth_event,booth_combined,38,,2025-02-14,2025-02-14,1,1,44,176.250,,,false,',
        )
        expect(rows).toContain(
          'config_status,canteen,43,,2025-01-01,2025-03-01,,1,21,39.500,,inactive,false,',
        )
        expect(rows).toContain(
          'config_status,booth,38,,2025-01-01,2025-03-01,,1,44,176.250,,inactive,false,',
        )
      }
    })

    it('surfaces partial: true and explicit sanitized error messages in both JSON and CSV when executeOdooKw fails on a config', async () => {
      rpcStubImpl = async (model, method, args) => {
        if (model === 'pos.config' && method === 'search_read') {
          return [...CANTEEN_POS_CONFIG_IDS, ...BOOTH_POS_CONFIG_IDS].map((id) => ({
            id,
            active: true,
          }))
        }
        const cfgId = extractQueriedConfigId(args[0])
        if (cfgId === 27) {
          throw new Error(
            'Upstream reset at https://erp-internal.example.test/jsonrpc?api_key=synthKeyOmega55',
          )
        }
        if (cfgId === 41) {
          return [{ 'date_order:day': '2025-01-21', __count: 14, amount_total: 25, amount_tax: 0 }]
        }
        return []
      }

      const adminToken = await createExecSessionToken(DEFAULT_ADMIN_EMAIL, 'admin')

      const jsonRes = await GET(
        buildAuthedRouteRequest(
          '/api/admin/season-detection?from=2025-01-01&to=2025-02-01',
          adminToken,
        ),
      )
      expect(jsonRes.status).toBe(200)
      expect(jsonRes.headers.get('X-Season-Detection-Partial')).toBe('true')
      const jsonBody = await jsonRes.json()
      expect(jsonBody.partial).toBe(true)
      expect(jsonBody.errors).toHaveLength(1)
      expect(jsonBody.errors[0]?.configId).toBe(27)
      expect(jsonBody.errors[0]?.message).toContain('[REDACTED_URL]')
      expect(jsonBody.errors[0]?.message).not.toContain('synthKeyOmega55')
      expect(jsonBody.canteens.combined.terms).toHaveLength(1)

      const csvRes = await GET(
        buildAuthedRouteRequest(
          '/api/admin/season-detection?format=csv&from=2025-01-01&to=2025-02-01',
          adminToken,
        ),
      )
      expect(csvRes.status).toBe(200)
      expect(csvRes.headers.get('X-Season-Detection-Partial')).toBe('true')
      const csvText = await csvRes.text()
      expect(csvText).toContain('error,booth,27,ODOO_RPC_ERROR,2025-01-01,2025-02-01,,,,,,,true,')
      expect(csvText).toContain('[REDACTED_URL]')
      expect(csvText).not.toContain('synthKeyOmega55')
    })
  })
})
