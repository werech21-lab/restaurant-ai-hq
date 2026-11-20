import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import posRegistry from '@/lib/odoo/pos-registry.json'
import {
  CLOSED_YEAR_CACHE_KEY_PREFIX,
  buildClosedYearStorageKey,
  createPostgresYearClosedStore,
  type ClosedYearSqlQueryable,
} from '@/lib/odoo/closed-year-store'
import {
  YEAR_CLOSED_MAX,
  YEAR_CLOSED_READ_TIMEOUT_MS,
  YEAR_CLOSED_TTL_MS,
  clearYearClosedCache,
  clearYearClosedMemoryCache,
  configureYearClosedPersistentStore,
  getYearClosedCacheStats,
  mergeProductLineGroups,
  readClosedYearPlusToday,
  yearClosedWindow,
  yearReadCall,
  type UtcWindow,
  type YearClosedPersistentStore,
} from '@/lib/odoo/pos-order-query'
import {
  bustOdooLiveCache,
  fetchLiveOdooPeriodCube,
  fetchLiveOdooSnapshot,
} from '@/lib/odoo-live-connector'

const ODOO_ENV_KEYS = ['ODOO_URL', 'ODOO_DB', 'ODOO_USERNAME', 'ODOO_LOGIN', 'ODOO_API_KEY'] as const

function createInMemoryGovernanceTable(): {
  rowsById: Map<string, { payload: string; pinHash: string }>
  queryable: ClosedYearSqlQueryable
  selectCount: () => number
  upsertCount: () => number
} {
  const rowsById = new Map<string, { payload: string; pinHash: string }>()
  let selects = 0
  let upserts = 0

  const queryable: ClosedYearSqlQueryable = {
    async query<R extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      params: unknown[] = [],
    ): Promise<{ rows: R[] }> {
      const normalized = text.replace(/\s+/g, ' ').trim().toUpperCase()
      if (normalized.startsWith('SELECT PAYLOAD FROM PUBLIC.VF_EXECUTIVE_GOVERNANCE_SYNC')) {
        selects += 1
        const id = String(params[0] ?? '')
        const hit = rowsById.get(id)
        if (!hit) return { rows: [] }
        return { rows: [{ payload: hit.payload } as unknown as R] }
      }
      if (normalized.startsWith('INSERT INTO PUBLIC.VF_EXECUTIVE_GOVERNANCE_SYNC')) {
        upserts += 1
        const id = String(params[0] ?? '')
        const payload = String(params[1] ?? '{}')
        const pinHash = String(params[2] ?? '')
        rowsById.set(id, { payload, pinHash })
        return { rows: [] }
      }
      if (normalized.startsWith('DELETE FROM PUBLIC.VF_EXECUTIVE_GOVERNANCE_SYNC')) {
        const likePattern = String(params[0] ?? '')
        const prefix = likePattern.endsWith('%') ? likePattern.slice(0, -1) : likePattern
        for (const key of [...rowsById.keys()]) {
          if (key.startsWith(prefix)) {
            rowsById.delete(key)
          }
        }
        return { rows: [] }
      }
      return { rows: [] }
    },
  }

  return {
    rowsById,
    queryable,
    selectCount: () => selects,
    upsertCount: () => upserts,
  }
}

describe('year closed-day cache & 45s cold-fill cap (Boudi QA Item #5)', () => {
  const savedEnv: Partial<Record<(typeof ODOO_ENV_KEYS)[number], string | undefined>> = {}

  beforeEach(() => {
    for (const key of ODOO_ENV_KEYS) {
      savedEnv[key] = process.env[key]
    }
    configureYearClosedPersistentStore(null)
    clearYearClosedCache()
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true, clearClosedYear: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    configureYearClosedPersistentStore(undefined)
    clearYearClosedCache()
    for (const key of ODOO_ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    }
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true, clearClosedYear: true })
  })

  it('Test 1: Cold Cache vs Warm Cache — reads closed window once under 45s cap, keeps today on fast slice, and serves warm reads in <5ms even 2h later within 24h TTL', async () => {
    expect(YEAR_CLOSED_READ_TIMEOUT_MS).toBe(45_000)
    expect(YEAR_CLOSED_TTL_MS).toBe(24 * 60 * 60 * 1000)
    expect(YEAR_CLOSED_MAX).toBe(128)

    const closedWindow = yearClosedWindow('2026-01-01 00:00:00', '2026-11-19 00:00:00')
    const todayWindow: UtcWindow = {
      fromUtc: '2026-11-19 00:00:00',
      toUtc: '2026-11-20 00:00:00',
    }
    const baseNowMs = Date.parse('2026-11-20T07:00:00.000Z')

    const callLog: Array<{
      window: string
      timeoutMs: number | undefined
      timeoutCapMs: number | undefined
      yearLiveSlice: boolean
    }> = []

    const read = async (window: UtcWindow) => {
      const spec = yearReadCall(window)
      callLog.push({
        window: `${window.fromUtc}|${window.toUtc}`,
        timeoutMs: spec.timeout?.timeoutMs,
        timeoutCapMs: spec.timeout?.timeoutCapMs,
        yearLiveSlice: Boolean(spec.kwargs.context?.year_live_slice),
      })
      const isClosed = window.fromUtc.startsWith('2026-01-01')
      return [
        {
          product_id: [7, 'Chicken'] as [number, string],
          price_subtotal: isClosed ? 1_000 : 25,
          qty: isClosed ? 100 : 3,
        },
      ]
    }

    // 1st request: Cold Cache miss -> populates closed window with 45s cap + reads today on fast slice
    const first = await readClosedYearPlusToday({
      cacheKey: 'brands.year|cold-vs-warm',
      closed: closedWindow,
      today: todayWindow,
      read,
      merge: mergeProductLineGroups,
      nowMs: baseNowMs,
    })

    expect(first[0]?.price_subtotal).toBe(1_025)
    expect(first[0]?.qty).toBe(103)
    expect(callLog).toHaveLength(2)
    expect(callLog[0]).toEqual({
      window: '2026-01-01 00:00:00|2026-11-19 00:00:00',
      timeoutMs: 45_000,
      timeoutCapMs: 45_000,
      yearLiveSlice: false,
    })
    expect(callLog[1]).toEqual({
      window: '2026-11-19 00:00:00|2026-11-20 00:00:00',
      timeoutMs: undefined,
      timeoutCapMs: undefined,
      yearLiveSlice: true,
    })

    // Verify globalThis singleton holds the L1 entry
    const globalRef = globalThis as unknown as {
      __vfYearClosedRowsCache?: Map<string, unknown>
      __vfYearClosedInflight?: Map<string, unknown>
    }
    expect(globalRef.__vfYearClosedRowsCache?.has('brands.year|cold-vs-warm')).toBe(true)
    expect(globalRef.__vfYearClosedInflight?.size).toBe(0)

    // 2nd & 3rd requests (immediate + 2 hours later + 23 hours later): <5ms warm hits, 0 closed-window calls!
    const twoHoursLaterMs = baseNowMs + 2 * 60 * 60 * 1000
    const twentyThreeHoursLaterMs = baseNowMs + 23 * 60 * 60 * 1000

    const tStart2 = performance.now()
    const second = await readClosedYearPlusToday({
      cacheKey: 'brands.year|cold-vs-warm',
      closed: closedWindow,
      today: todayWindow,
      read,
      merge: mergeProductLineGroups,
      nowMs: twoHoursLaterMs,
    })
    const warmElapsed2Ms = performance.now() - tStart2

    const tStart3 = performance.now()
    const third = await readClosedYearPlusToday({
      cacheKey: 'brands.year|cold-vs-warm',
      closed: closedWindow,
      today: todayWindow,
      read,
      merge: mergeProductLineGroups,
      nowMs: twentyThreeHoursLaterMs,
    })
    const warmElapsed3Ms = performance.now() - tStart3

    expect(warmElapsed2Ms).toBeLessThan(5)
    expect(warmElapsed3Ms).toBeLessThan(5)
    expect(second[0]?.price_subtotal).toBe(1_025)
    expect(third[0]?.price_subtotal).toBe(1_025)

    // Closed window was called ONLY ONCE across all 3 requests; today was called 3 times; 45s cap used ONLY once!
    expect(callLog.filter((c) => c.window.startsWith('2026-01-01'))).toHaveLength(1)
    expect(callLog.filter((c) => c.timeoutMs === 45_000)).toHaveLength(1)
    expect(callLog.filter((c) => c.window.startsWith('2026-11-19'))).toHaveLength(3)
    expect(callLog.filter((c) => c.window.startsWith('2026-11-19')).every((c) => c.timeoutMs === undefined)).toBe(true)

    //Note: at >24h from initial write (24h + 1ms), TTL expires and refreshes cleanly
    await readClosedYearPlusToday({
      cacheKey: 'brands.year|cold-vs-warm',
      closed: closedWindow,
      today: todayWindow,
      read,
      merge: mergeProductLineGroups,
      nowMs: baseNowMs + YEAR_CLOSED_TTL_MS + 1,
    })
    expect(callLog.filter((c) => c.window.startsWith('2026-01-01'))).toHaveLength(2)
  })

  it('Test 2: Concurrent Cold Cache stampede protection — 5 simultaneous cold calls trigger exactly 1 closed-window Odoo read', async () => {
    const closedWindow = yearClosedWindow('2026-01-01 00:00:00', '2026-11-19 00:00:00')
    const todayWindow: UtcWindow = {
      fromUtc: '2026-11-19 00:00:00',
      toUtc: '2026-11-20 00:00:00',
    }

    let closedReads = 0
    let todayReads = 0
    let releaseClosedRead: () => void = () => {}
    const closedGate = new Promise<void>((resolve) => {
      releaseClosedRead = resolve
    })

    const read = async (window: UtcWindow) => {
      if (window.fromUtc.startsWith('2026-01-01')) {
        closedReads += 1
        await closedGate
        return [{ product_id: [11, 'Shawarma'] as [number, string], price_subtotal: 500, qty: 50 }]
      }
      todayReads += 1
      return [{ product_id: [11, 'Shawarma'] as [number, string], price_subtotal: 40, qty: 4 }]
    }

    const concurrentPromises = Array.from({ length: 5 }, () =>
      readClosedYearPlusToday({
        cacheKey: 'channels.year.net|stampede-test',
        closed: closedWindow,
        today: todayWindow,
        read,
        merge: mergeProductLineGroups,
      }),
    )

    // While in flight, exactly 1 closed read is active and inflight map holds 1 deduplicated promise
    await Promise.resolve()
    expect(closedReads).toBe(1)
    expect(getYearClosedCacheStats().inflightSize).toBe(1)

    releaseClosedRead()
    const results = await Promise.all(concurrentPromises)

    expect(closedReads).toBe(1)
    expect(todayReads).toBe(5)
    expect(getYearClosedCacheStats().inflightSize).toBe(0)
    expect(getYearClosedCacheStats().memorySize).toBe(1)
    for (const rows of results) {
      expect(rows[0]?.price_subtotal).toBe(540)
      expect(rows[0]?.qty).toBe(54)
    }
  })

  it('Test 3: Cross-instance L2 durable cache hydration — clearing L1 RAM hydrates closed-year rows from L2 with 0 45s Odoo RPC calls', async () => {
    const fakePg = createInMemoryGovernanceTable()
    const l2Store = createPostgresYearClosedStore(() => fakePg.queryable)
    configureYearClosedPersistentStore(l2Store)

    const cacheKey = 'year.net|1|8,17,24,36|2026-11-20|150,151'
    const expectedStorageKey = `${CLOSED_YEAR_CACHE_KEY_PREFIX}${createHash('sha256').update(cacheKey).digest('hex')}`
    expect(buildClosedYearStorageKey(cacheKey)).toBe(expectedStorageKey)

    const closedWindow = yearClosedWindow('2026-01-01 00:00:00', '2026-11-19 00:00:00')
    const todayWindow: UtcWindow = {
      fromUtc: '2026-11-19 00:00:00',
      toUtc: '2026-11-20 00:00:00',
    }
    const baseNowMs = Date.parse('2026-11-20T08:00:00.000Z')

    let closedOdooCalls = 0
    let todayOdooCalls = 0
    const read = async (window: UtcWindow) => {
      if (window.fromUtc.startsWith('2026-01-01')) {
        closedOdooCalls += 1
        return [{ product_id: [21, 'Karak'] as [number, string], price_subtotal: 2_400, qty: 800 }]
      }
      todayOdooCalls += 1
      return [{ product_id: [21, 'Karak'] as [number, string], price_subtotal: 30, qty: 10 }]
    }

    // Instance 1 (Cold): populates L1 + durable L2 PostgreSQL store
    const warmResult1 = await readClosedYearPlusToday({
      cacheKey,
      closed: closedWindow,
      today: todayWindow,
      read,
      merge: mergeProductLineGroups,
      nowMs: baseNowMs,
    })
    expect(warmResult1[0]?.price_subtotal).toBe(2_430)
    expect(closedOdooCalls).toBe(1)
    expect(todayOdooCalls).toBe(1)
    expect(fakePg.rowsById.has(expectedStorageKey)).toBe(true)
    expect(fakePg.upsertCount()).toBe(1)

    // Simulate a brand-new Vercel Serverless Lambda cold start (empty L1 RAM)
    clearYearClosedMemoryCache()
    expect(getYearClosedCacheStats().memorySize).toBe(0)

    // Instance 2 (Cold L1, Warm L2, 3 hours later): hydrates from L2 with ZERO 45s closed-window Odoo calls!
    const coldInstanceResults = await Promise.all(
      Array.from({ length: 3 }, () =>
        readClosedYearPlusToday({
          cacheKey,
          closed: closedWindow,
          today: todayWindow,
          read,
          merge: mergeProductLineGroups,
          nowMs: baseNowMs + 3 * 60 * 60 * 1000,
        }),
      ),
    )

    expect(closedOdooCalls).toBe(1)
    expect(todayOdooCalls).toBe(4)
    expect(getYearClosedCacheStats().memorySize).toBe(1)
    for (const res of coldInstanceResults) {
      expect(res[0]?.price_subtotal).toBe(2_430)
    }

    // Also verify L2 failure fails open silently to L1/Odoo without throwing
    const brokenStore: YearClosedPersistentStore = {
      async get() {
        throw new Error('simulated_db_unreachable')
      },
      async set() {
        throw new Error('simulated_db_readonly')
      },
    }
    configureYearClosedPersistentStore(brokenStore)
    clearYearClosedMemoryCache()

    const fallbackRes = await readClosedYearPlusToday({
      cacheKey,
      closed: closedWindow,
      today: todayWindow,
      read,
      merge: mergeProductLineGroups,
      nowMs: baseNowMs + 4 * 60 * 60 * 1000,
    })
    expect(fallbackRes[0]?.price_subtotal).toBe(2_430)
    expect(closedOdooCalls).toBe(2)
  })

  it('Test 4: Failed or timed-out cold read is NOT cached — next request retries cleanly and caches once successful', async () => {
    const fakePg = createInMemoryGovernanceTable()
    configureYearClosedPersistentStore(createPostgresYearClosedStore(() => fakePg.queryable))

    const closedWindow = yearClosedWindow('2026-01-01 00:00:00', '2026-11-19 00:00:00')
    const todayWindow: UtcWindow = {
      fromUtc: '2026-11-19 00:00:00',
      toUtc: '2026-11-20 00:00:00',
    }

    let closedAttempts = 0
    let shouldFailClosed = true
    const read = async (window: UtcWindow) => {
      if (window.fromUtc.startsWith('2026-01-01')) {
        closedAttempts += 1
        if (shouldFailClosed) {
          throw new Error('AbortError: Cold closed-year Odoo read timed out at 45000ms')
        }
        return [{ product_id: [33, 'Steak Sandwich'] as [number, string], price_subtotal: 700, qty: 70 }]
      }
      return [{ product_id: [33, 'Steak Sandwich'] as [number, string], price_subtotal: 50, qty: 5 }]
    }

    await expect(
      readClosedYearPlusToday({
        cacheKey: 'brands.year|retry-after-timeout',
        closed: closedWindow,
        today: todayWindow,
        read,
        merge: mergeProductLineGroups,
      }),
    ).rejects.toThrow(/45000ms/)

    // Nothing cached in L1, nothing persisted in L2, and inflight map cleaned up
    expect(closedAttempts).toBe(1)
    expect(getYearClosedCacheStats()).toEqual({ memorySize: 0, inflightSize: 0 })
    expect(fakePg.rowsById.size).toBe(0)

    // Next request retries cleanly and succeeds
    shouldFailClosed = false
    const recovered = await readClosedYearPlusToday({
      cacheKey: 'brands.year|retry-after-timeout',
      closed: closedWindow,
      today: todayWindow,
      read,
      merge: mergeProductLineGroups,
    })
    expect(closedAttempts).toBe(2)
    expect(recovered[0]?.price_subtotal).toBe(750)
    expect(getYearClosedCacheStats().memorySize).toBe(1)
    expect(fakePg.rowsById.size).toBe(1)

    // Subsequent warm request does NOT call closed read again
    const subsequent = await readClosedYearPlusToday({
      cacheKey: 'brands.year|retry-after-timeout',
      closed: closedWindow,
      today: todayWindow,
      read,
      merge: mergeProductLineGroups,
    })
    expect(closedAttempts).toBe(2)
    expect(subsequent[0]?.price_subtotal).toBe(750)
  })

  it('enforces LRU refresh at capacity 128 and bounds sequential batch deadlines within a single 45s budget', async () => {
    const closedWindow = yearClosedWindow('2026-01-01 00:00:00', '2026-11-19 00:00:00')!
    const todayWindow: UtcWindow = {
      fromUtc: '2026-11-19 00:00:00',
      toUtc: '2026-11-20 00:00:00',
    }
    const startMs = 1_700_000_000_000
    const deadlineAtMs = startMs + YEAR_CLOSED_READ_TIMEOUT_MS

    // Sequential waves share one 45s deadline instead of 3 x 45s = 135s
    const wave1 = yearReadCall(closedWindow, { deadlineAtMs, nowMs: startMs })
    const wave2 = yearReadCall(closedWindow, { deadlineAtMs, nowMs: startMs + 20_000 })
    const wave3 = yearReadCall(closedWindow, { deadlineAtMs, nowMs: startMs + 41_500 })
    expect(wave1.timeout).toEqual({ timeoutMs: 45_000, timeoutCapMs: 45_000 })
    expect(wave2.timeout).toEqual({ timeoutMs: 25_000, timeoutCapMs: 25_000 })
    expect(wave3.timeout).toEqual({ timeoutMs: 3_500, timeoutCapMs: 3_500 })
    expect(() =>
      yearReadCall(closedWindow, { deadlineAtMs, nowMs: startMs + 45_000 }),
    ).toThrow(/45000ms/)

    // Live today slice NEVER receives a 45s timeout even if deadlineAtMs is supplied
    const liveCall = yearReadCall(todayWindow, { deadlineAtMs, nowMs: startMs + 20_000 })
    expect(liveCall).toEqual({
      kwargs: { lazy: false, context: { year_live_slice: true } },
    })

    // Fill 128 closed-year keys, touch key-0 (LRU refresh), insert key-128 -> key-1 evicted, key-0 retained
    const coldFills: string[] = []
    const fillKey = (idx: number) =>
      readClosedYearPlusToday({
        cacheKey: `lru-key-${idx}`,
        closed: closedWindow,
        today: todayWindow,
        nowMs: startMs,
        read: async (w) => {
          if (w.fromUtc.startsWith('2026-01-01')) coldFills.push(`lru-key-${idx}`)
          return [{ product_id: [1, 'Item'] as [number, string], price_subtotal: idx, qty: 1 }]
        },
        merge: mergeProductLineGroups,
      })

    for (let i = 0; i < YEAR_CLOSED_MAX; i += 1) {
      await fillKey(i)
    }
    expect(getYearClosedCacheStats().memorySize).toBe(128)
    expect(coldFills).toHaveLength(128)

    // Touch lru-key-0 so it moves to MRU, then add lru-key-128
    await fillKey(0)
    expect(coldFills).toHaveLength(128)
    await fillKey(128)
    expect(getYearClosedCacheStats().memorySize).toBe(128)

    // lru-key-0 is STILL warm (0 new cold fills), whereas lru-key-1 was evicted (triggers cold fill)
    await fillKey(0)
    expect(coldFills).toHaveLength(129)
    await fillKey(1)
    expect(coldFills).toHaveLength(130)
  })

  it('persists closed historical year period cubes (toIso < todayKwIso) for 24h + L2 across routine cache busts & cold starts', async () => {
    process.env.ODOO_URL = 'https://odoo-closed-cube.example.com'
    process.env.ODOO_DB = 'vf_closed_cube'
    process.env.ODOO_USERNAME = 'bi@venturefoodskw.com'
    process.env.ODOO_API_KEY = 'test-cube'

    const fakePg = createInMemoryGovernanceTable()
    configureYearClosedPersistentStore(createPostgresYearClosedStore(() => fakePg.queryable))

    const refNowMs = Date.parse('2026-11-20T09:00:00.000Z')
    let posOrderReadGroups = 0

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        id?: number
        params?: { service?: string; method?: string; args?: unknown[] }
      }
      const reply = (result: unknown) =>
        new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, result }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      if (body.params?.service === 'common' && body.params?.method === 'authenticate') {
        return reply(7)
      }
      const args = body.params?.args ?? []
      const model = String(args[3] ?? '')
      const method = String(args[4] ?? '')
      if (model === 'pos.config' && method === 'search_read') {
        return reply([
          { id: 8, name: 'Promenade 1', active: true, company_id: [1, 'Venture Foods'] },
        ])
      }
      if (model === 'res.users' && method === 'read') {
        return reply([{ id: 7, company_id: [1, 'Venture Foods'] }])
      }
      if (model === 'pos.session' && method === 'read') {
        return reply([{ id: 501, config_id: [8, 'Promenade 1'] }])
      }
      if (model === 'pos.order' && method === 'read_group') {
        const callArgs = Array.isArray(args[5]) ? (args[5] as unknown[]) : []
        const groupby = Array.isArray(callArgs[2]) ? (callArgs[2] as string[]) : []
        if (groupby.includes('date_order:day')) {
          posOrderReadGroups += 1
          return reply([
            {
              session_id: [501, 'POS/501'],
              pricelist_id: [1, 'Dine-In'],
              amount_total: 12_500,
              amount_tax: 0,
              __count: 1_250,
              __range: {
                'date_order:day': { from: '2025-06-14 21:00:00', to: '2025-06-15 21:00:00' },
              },
            },
          ])
        }
      }
      return reply([])
    })

    // 1. Cold fill of closed historical year 2025-01-01..2025-12-31
    const coldCube = await fetchLiveOdooPeriodCube('2025-01-01', '2025-12-31', refNowMs)
    expect(coldCube.connected).toBe(true)
    expect(coldCube.totals.netSalesKwd).toBe(12_500)
    expect(posOrderReadGroups).toBe(2) // net + non-refund count pair
    expect(fakePg.rowsById.size).toBe(1)

    // 2. Routine bustOdooLiveCache() (no clearClosedYear) + 6 hours later -> STILL WARM in L1 (0 Odoo RPCs!)
    bustOdooLiveCache()
    const warmCube = await fetchLiveOdooPeriodCube(
      '2025-01-01',
      '2025-12-31',
      refNowMs + 6 * 60 * 60 * 1000,
    )
    expect(warmCube.totals.netSalesKwd).toBe(12_500)
    expect(posOrderReadGroups).toBe(2)

    // 3. Simulate serverless cold start (clear L1 memory only) -> hydrates 2025 cube from L2 with 0 Odoo RPCs!
    bustOdooLiveCache({ clearClosedYear: true, memoryOnly: true })
    const hydratedCube = await fetchLiveOdooPeriodCube(
      '2025-01-01',
      '2025-12-31',
      refNowMs + 8 * 60 * 60 * 1000,
    )
    expect(hydratedCube.totals.netSalesKwd).toBe(12_500)
    expect(posOrderReadGroups).toBe(2)

    // 4. Explicit bustOdooLiveCache({ clearClosedYear: true }) clears both L1 and L2
    bustOdooLiveCache({ clearClosedYear: true })
    await Promise.resolve()
    const refetchedCube = await fetchLiveOdooPeriodCube(
      '2025-01-01',
      '2025-12-31',
      refNowMs + 9 * 60 * 60 * 1000,
    )
    expect(refetchedCube.totals.netSalesKwd).toBe(12_500)
    expect(posOrderReadGroups).toBe(4)
  })

  it('bounds multi-wave readYearPayments within a single 45s cold budget and serves subsequent year snapshots with 0 closed-window RPCs', async () => {
    process.env.ODOO_URL = 'https://odoo-year-snapshot.example.com'
    process.env.ODOO_DB = 'vf_year_snapshot'
    process.env.ODOO_USERNAME = 'bi@venturefoodskw.com'
    process.env.ODOO_API_KEY = 'test-year'

    const refNowMs = Date.parse('2026-11-20T09:00:00.000Z')
    let closedYearPaymentRpcCount = 0
    let closedYearOrderRpcCount = 0
    let todayLiveSliceRpcCount = 0

    // 10 approved register ids (> YEAR_REGISTER_READ_CONCURRENCY = 8 -> 2 sequential register waves)
    const tenRegisters = posRegistry.allowedPosConfigIds.slice(0, 10)
    expect(tenRegisters).toHaveLength(10)

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        id?: number
        params?: { service?: string; method?: string; args?: unknown[] }
      }
      const reply = (result: unknown) =>
        new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, result }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      if (body.params?.service === 'common' && body.params?.method === 'authenticate') {
        return reply(7)
      }
      const args = body.params?.args ?? []
      const model = String(args[3] ?? '')
      const method = String(args[4] ?? '')
      const kwargs = (args[6] as { context?: { year_live_slice?: boolean } } | undefined) ?? {}

      if (model === 'pos.config' && method === 'search_read') {
        return reply(
          tenRegisters.map((id) => ({
            id,
            name: `Register ${id}`,
            active: id !== 24,
            company_id: [1, 'Venture Foods'],
          })),
        )
      }
      if (model === 'res.users' && method === 'read') {
        return reply([{ id: 7, company_id: [1, 'Venture Foods'] }])
      }
      if (model === 'pos.session' && method === 'read') {
        return reply([{ id: 501, config_id: [8, 'Promenade 1'] }])
      }
      if (kwargs.context?.year_live_slice) {
        todayLiveSliceRpcCount += 1
        return reply([])
      }
      if (model === 'pos.payment' && method === 'read_group') {
        const callArgs = Array.isArray(args[5]) ? (args[5] as unknown[]) : []
        const domain = Array.isArray(callArgs[0]) ? (callArgs[0] as unknown[]) : []
        const gte = domain.find(
          (clause): clause is [string, string, string] =>
            Array.isArray(clause) && clause[0] === 'pos_order_id.date_order' && clause[1] === '>=',
        )
        if (gte && String(gte[2]).startsWith('2025-12-31')) {
          closedYearPaymentRpcCount += 1
          return reply([
            {
              session_id: [501, 'POS/501'],
              payment_method_id: [1, 'Cash'],
              amount: 100,
              __count: 5,
            },
          ])
        }
      }
      if (model === 'pos.order' && method === 'read_group') {
        const callArgs = Array.isArray(args[5]) ? (args[5] as unknown[]) : []
        const groupby = Array.isArray(callArgs[2]) ? (callArgs[2] as string[]) : []
        if (groupby.length === 1 && groupby[0] === 'session_id') {
          closedYearOrderRpcCount += 1
          return reply([
            {
              session_id: [501, 'POS/501'],
              amount_total: 1_000,
              amount_tax: 0,
              __count: 50,
            },
          ])
        }
        if (groupby.includes('date_order:day')) {
          return reply([
            {
              session_id: [501, 'POS/501'],
              pricelist_id: [1, 'Dine-In'],
              amount_total: 1_000,
              amount_tax: 0,
              __count: 50,
              __range: {
                'date_order:day': { from: '2026-11-18 21:00:00', to: '2026-11-19 21:00:00' },
              },
            },
          ])
        }
      }
      return reply([])
    })

    // 1st call (Cold): populates all closed-year sections across 2 register waves (10 x 2 = 20 payment RPCs + 2 order RPCs)
    const firstYearSnap = await fetchLiveOdooSnapshot({
      period: 'year',
      forceRefresh: true,
      referenceNowMs: refNowMs,
    })
    expect(firstYearSnap.connected).toBe(true)
    expect(closedYearPaymentRpcCount).toBe(20)
    expect(closedYearOrderRpcCount).toBe(2)
    const firstTodaySlices = todayLiveSliceRpcCount
    expect(firstTodaySlices).toBeGreaterThan(0)

    // 2nd call (forceRefresh: true, 3 hours later on same Kuwait day): 0 closed-year RPCs, only today live slices!
    const secondYearSnap = await fetchLiveOdooSnapshot({
      period: 'year',
      forceRefresh: true,
      referenceNowMs: refNowMs + 3 * 60 * 60 * 1000,
    })
    expect(secondYearSnap.connected).toBe(true)
    expect(closedYearPaymentRpcCount).toBe(20)
    expect(closedYearOrderRpcCount).toBe(2)
    expect(todayLiveSliceRpcCount).toBeGreaterThan(firstTodaySlices)
  })
})
