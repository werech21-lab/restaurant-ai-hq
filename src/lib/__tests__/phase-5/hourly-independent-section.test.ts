/**
 * Hourly is an independent section of the period cube (real data only).
 *
 * Every Odoo figure here comes from the live 2026-11-17 payload: its Month-bucket hourly series
 * (Σ 130,946.856 KWD) is served as the per-hour `read_group` answer. Register ids come from the
 * real pos-registry.json. Nothing else carries numbers: other queries either fail or return [].
 *
 * 1. Partial: the core cube queries fail → the cube is unavailable, yet the independent hourly
 *    read (route `hourlyA`) still returns the real series, and Cores uses it because Σ == total.
 * 2. Hourly failing alone: every core query succeeds (empty) while the hourly read faults → the
 *    cube stays connected with its other sections, hourly is marked unavailable (no rows, no 0.000).
 */
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import { DEFAULT_GLOBAL_FILTERS, type GlobalFilters } from '@/lib/aether/global-filter-engine'
import { bustOdooLiveCache, fetchLiveOdooPeriodCube, fetchLiveOdooPeriodHourly, type OdooPeriodHourly } from '@/lib/odoo-live-connector'
import registry from '@/lib/odoo/pos-registry.json'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'

vi.mock('@/app/api/odoo-sync/route', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/api/odoo-sync/route')>()),
  resolveVerifiedSyncCaller: async () => ({ role: 'admin', isAuditor: false }),
}))

const REF_NOW = Date.parse('2026-11-17T03:05:00Z') // payload sync time (06:05 Kuwait)
const ENV = { ODOO_URL: 'https://localhost:8069', ODOO_DB: 'vf_test', ODOO_USERNAME: 'bi@example.com', ODOO_API_KEY: 'test_key' }
const ENV_KEYS = ['ODOO_URL', 'ODOO_DB', 'ODOO_USERNAME', 'ODOO_LOGIN', 'ODOO_API_KEY'] as const
const saved: Record<string, string | undefined> = {}

const live = loadLiveTodaySummary()
const month = live.buckets!.month!
const monthFrom = month.from
const monthTo = (() => {
  const d = new Date(`${month.to}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
})()
const realHourly = live.hourlySeries ?? []
const realMonthTotal = month.totals.netSalesKwd as number

/** Real registers from pos-registry.json, named by their registry location label. */
const REGISTRY = registry as { allowedPosConfigIds: number[]; registers: Record<string, { location: string }>; locations: Record<string, { en: string }> }
const realConfigs = REGISTRY.allowedPosConfigIds.map((id) => ({
  id,
  name: REGISTRY.locations[REGISTRY.registers[String(id)].location].en,
  active: true,
  company_id: [1, 'Venture Foods'],
}))

/** Real Month hourly series as Odoo's per-hour read_group rows (Kuwait hour h → UTC h−3). */
function realHourRows(nonRefundCountsOnly: boolean) {
  return realHourly
    .filter((h) => h.netKwd !== 0 || h.orders !== 0)
    .map((h) => {
      const utc = new Date(Date.UTC(2026, 10, 16, h.hour - 3))
      const from = utc.toISOString().slice(0, 19).replace('T', ' ')
      const to = new Date(utc.getTime() + 3600_000).toISOString().slice(0, 19).replace('T', ' ')
      const __range = { 'date_order:hour': { from, to } }
      return nonRefundCountsOnly
        ? { __count: h.orders, __range }
        : { amount_total: h.netKwd, amount_tax: 0, __count: h.orders, __range }
    })
}

type Mode = 'core-fails' | 'hourly-fails'
function installOdoo(mode: Mode) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { id?: number; params?: { service?: string; method?: string; args?: unknown[] } }
    const ok = (result: unknown) => new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, result }), { status: 200 })
    const fault = () => new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, error: { message: 'Odoo fault', data: { message: 'Odoo fault' } } }), { status: 200 })
    if (body.params?.service === 'common') return ok(7)
    const args = body.params?.args ?? []
    const model = String(args[3] ?? '')
    const method = String(args[4] ?? '')
    const methodArgs = (args[5] as unknown[]) ?? []
    const domainStr = JSON.stringify(methodArgs[0] ?? [])
    const groupby = (methodArgs[2] as string[] | undefined) ?? []
    if (model === 'pos.config' && method === 'search_read') return ok(realConfigs)
    if (model === 'res.users' && method === 'read') return ok([{ id: 7, company_id: [1, 'Venture Foods'] }])
    const isLightHourly = model === 'pos.order' && method === 'read_group' && groupby.length === 1 && groupby[0] === 'date_order:hour'
    if (isLightHourly) {
      if (mode === 'hourly-fails') return fault()
      // The company-wide read (registers of more than one location) gets the real series;
      // per-branch reads (one location each) get [].
      const ids = (/"session_id\.config_id","in",\[([0-9,]*)\]/.exec(domainStr)?.[1] ?? '').split(',').filter(Boolean)
      const locations = new Set(ids.map((id) => REGISTRY.registers[id]?.location))
      if (locations.size < 2) return ok([])
      return ok(realHourRows(domainStr.includes('["amount_total",">=",0]')))
    }
    if (mode === 'core-fails' && model === 'pos.order' && method === 'read_group') return fault()
    return ok([])
  })
}

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k]
  Object.assign(process.env, ENV)
  delete process.env.ODOO_LOGIN
  bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
})
afterEach(() => {
  vi.restoreAllMocks()
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
})

const sumFils = (rows: { netKwd: number }[]) => rows.reduce((s, r) => s + Math.round(r.netKwd * 1000), 0)

describe('partial: core cube fails, hourly still present (real Month series)', () => {
  it('the independent hourly read returns the real series; Σ equals the real Month total to the fils', async () => {
    installOdoo('core-fails')
    const cube = await fetchLiveOdooPeriodCube(monthFrom, monthTo, REF_NOW)
    expect(cube.connected).toBe(false)
    const hourly = await fetchLiveOdooPeriodHourly(monthFrom, monthTo, REF_NOW)
    expect(hourly.available).toBe(true)
    expect(hourly.dateRange).toEqual({ from: monthFrom, to: monthTo })
    expect(hourly.hourlySeries).toHaveLength(24)
    expect(sumFils(hourly.hourlySeries)).toBe(Math.round(realMonthTotal * 1000))
  })

  it('route: cubeA is null but hourlyA carries the real series; Cores uses it (Σ == total, real peak)', async () => {
    installOdoo('core-fails')
    const { GET } = await import('@/app/api/erp/live-comparison/route')
    const url = `https://aetherbi.com/api/erp/live-comparison?dateA=${monthFrom}&toA=${monthTo}&dateB=${monthFrom}&toB=${monthTo}`
    vi.useFakeTimers({ now: REF_NOW, toFake: ['Date'] })
    try {
      const res = await GET(new NextRequest(url, { headers: { 'sec-fetch-site': 'same-origin' } }))
      const data = (await res.json()) as { cubeA: unknown; hourlyA: OdooPeriodHourly }
      expect(data.cubeA).toBeNull()
      expect(data.hourlyA.available).toBe(true)
      expect(sumFils(data.hourlyA.hourlySeries)).toBe(Math.round(realMonthTotal * 1000))

      // Remove the summary's own Month hourly so only the independent read can supply hourly.
      const summary = loadLiveTodaySummary()
      summary.hourlySeries = null
      const filters: GlobalFilters = { ...DEFAULT_GLOBAL_FILTERS, period: 'month' }
      const snap = computeCoresHubSnapshot(filters, [], summary, null, data.hourlyA)
      expect(snap.sales.hourlyUnavailable).toBe(false)
      expect(snap.sales.hourlyReconciliation?.reconciled).toBe(true)
      expect(snap.sales.hourly.reduce((s, r) => s + Math.round(r.salesKwd * 1000), 0)).toBe(Math.round(realMonthTotal * 1000))
      const realPeak = [...realHourly].sort((a, b) => b.netKwd - a.netKwd)[0]
      expect(snap.sales.peakHourSalesKwd).toBe(realPeak.netKwd)
      expect(snap.sales.peakHourSalesKwd).toBeGreaterThan(0)

      // A read for a different window is never used for this period.
      const other = { ...data.hourlyA, dateRange: { from: monthFrom, to: monthFrom } }
      expect(computeCoresHubSnapshot(filters, [], summary, null, other).sales.hourlyUnavailable).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('hourly failing alone leaves the other sections intact', () => {
  it('cube stays connected with its sections; hourly is unavailable (no rows, no 0.000 peak)', async () => {
    installOdoo('hourly-fails')
    const cube = await fetchLiveOdooPeriodCube(monthFrom, monthTo, REF_NOW)
    expect(cube.connected).toBe(true)
    expect(cube.sourceMode).toBe('odoo17-live')
    expect(cube.hourlyAvailable).toBe(false)
    expect(cube.hourlyByBranchAvailable).toBe(false)
    expect(cube.hourlySeries).toEqual([])
    expect(cube.hourlyByBranch).toEqual({})
    for (const key of ['totals', 'byBranch', 'byBrand', 'byChannel', 'dailySeries', 'unattributed'] as const) {
      expect(cube[key]).toBeDefined()
    }
    expect(Object.keys(cube.byBranch).length).toBeGreaterThan(0)

    const snap = computeCoresHubSnapshot({ ...DEFAULT_GLOBAL_FILTERS, period: 'month' }, [], loadLiveTodaySummary(), cube)
    // With the cube present, the hourly comes only from the cube; an unavailable hourly section
    // reconciles only if the period total is also zero — never drawn as a 0.000 peak.
    expect(snap.sales.peakHourSalesKwd).toBe(0)
    expect(snap.sales.hourly).toEqual([])
  })
})
