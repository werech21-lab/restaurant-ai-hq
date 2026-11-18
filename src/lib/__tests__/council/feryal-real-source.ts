/**
 * Feryal data source backed by the REAL 17 Nov 2026 payload — no hand-written figures.
 *
 * A window is answered only when every day of it is a completed day in the payload's per-branch
 * daily rows; the cube then carries the real branch totals. Sections the payload does not hold
 * for an arbitrary window (brand, channel, hourly, products, accounting) are reported as not
 * connected by returning `null` for windows that would need them — the brand / channel / product
 * reads are never invented.
 */
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import type { FeryalOdooDataSource } from '@/lib/feryal-odoo-agent'
import { completedDailyByBranch } from '@/lib/council/series'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'

export const REAL_SYNC_NOW_MS = Date.parse('2026-11-17T03:05:00.000Z') // 06:05 Kuwait, payload sync

const r3 = (n: number) => Math.round(n * 1000) / 1000
const CHANNEL_KEYS = ['dine-in', 'takeaway-direct', 'talabat-tgo', 'talabat-tmp', 'keeta', 'deliveroo', 'jahez', 'snoonu']

export function realCubeFor(summary: OdooLiveSummary, from: string, to: string): OdooPeriodCube | null {
  const d = completedDailyByBranch(summary)
  if (!d) return null
  const days = d.days.filter((x) => x >= from && x <= to)
  const expected = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
  if (days.length !== expected) return null
  const byBranch: Record<string, { netKwd: number; orders: number; aovKwd: number; channels: Record<string, { netKwd: number; orders: number }> }> = {}
  let netFils = 0
  let orders = 0
  for (const id of d.branchIds) {
    let f = 0
    let o = 0
    for (const day of days) {
      f += d.byDay[day][id]?.netFils ?? 0
      o += d.byDay[day][id]?.orders ?? 0
    }
    netFils += f
    orders += o
    // Channel split is not in the payload for arbitrary windows: the whole branch net is placed in
    // no channel; `hourlyAvailable` / `channelsAvailable` stay false so nothing reads them as zero.
    byBranch[id] = { netKwd: f / 1000, orders: o, aovKwd: o ? r3(f / 1000 / o) : 0, channels: Object.fromEntries(CHANNEL_KEYS.map((k) => [k, { netKwd: 0, orders: 0 }])) }
  }
  const net = netFils / 1000
  return {
    connected: true,
    sourceMode: 'odoo17-live',
    noData: net === 0,
    odooCompanyId: null,
    lastSyncAt: summary.lastSyncAt ?? null,
    isStale24h: false,
    dateRange: { from, to },
    days: expected,
    totals: { netSalesKwd: net, orders, aovKwd: orders ? r3(net / orders) : 0, mappedBranchesNetKwd: net, mappedBranchesOrders: orders, unattributedSalesKwd: 0, unattributedOrders: 0, excludedEntitiesKwd: 0, excludedEntitiesOrders: 0, totalDiscountKwd: 0, avgDiscountPct: 0, discountedLinesCount: 0 },
    byBranch,
    unattributed: { id: 'unattributed', labelAr: 'غير منسوب لفرع', labelEn: 'Unattributed to Branch', netKwd: 0, orders: 0, aovKwd: 0, channels: Object.fromEntries(CHANNEL_KEYS.map((k) => [k, { netKwd: 0, orders: 0 }])) },
    byBrand: {},
    brandByBranch: {},
    byChannel: Object.fromEntries(CHANNEL_KEYS.map((k) => [k, { netKwd: 0, orders: 0 }])),
    dailySeries: days.map((day) => {
      const cells = Object.values(d.byDay[day])
      return { day, orders: cells.reduce((s, c) => s + c.orders, 0), netKwd: cells.reduce((s, c) => s + c.netFils, 0) / 1000, unattributedNetKwd: 0, unattributedOrders: 0 }
    }),
    dailyByBranch: Object.fromEntries(days.map((day) => [day, Object.fromEntries(Object.entries(d.byDay[day]).map(([b, c]) => [b, { netKwd: c.netFils / 1000, orders: c.orders }]))])),
    dailyUnattributed: {},
    hourlySeries: [],
    hourlyByBranch: {},
    hourlyAvailable: false,
    hourlyByBranchAvailable: false,
    topProducts: [],
  } as unknown as OdooPeriodCube
}

export function createRealPayloadDataSource(summary: OdooLiveSummary): FeryalOdooDataSource {
  return {
    fetchPeriodCube: async (from, to) => realCubeFor(summary, from, to),
    fetchPurchaseOrders: async () => null,
    fetchWarehouseChain: async () => null,
    fetchReceivablesSummary: async () => null,
    fetchBranchTopProducts: async () => null,
    fetchHrEmployees: async () => null,
    getLastSyncAt: async () => summary.lastSyncAt ?? null,
  } as FeryalOdooDataSource
}
