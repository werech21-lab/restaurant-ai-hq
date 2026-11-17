/**
 * Fixtures for the Executive Dashboard reconcile tests.
 *
 * `loadLiveTodaySummary` is the trimmed live payload behind the 17 Nov 2026 China Garden screen
 * (product-line brand basis, no per-branch brand split). `buildAllocatedTodaySummary` adds a
 * SYNTHETIC per-order brand allocation whose branch totals match the live payload, so the
 * parity rules can be checked for the exact (order-allocated) path as well.
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  allocateBrandsFromOrders,
  type PosOrderHeader,
  type PosOrderLineInput,
} from '@/lib/odoo/brand-order-allocation'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'

export const FIXTURE_DAY = '2026-11-17'
export const BRAND_IDS = ['china-garden', 'franks', 'tahina', 'farm-brown', 'noodle-bar', 'karak-cafeteria'] as const
export const LOCATION_KEYS = [
  'avenues',
  '360-mall',
  'assima',
  'promenade',
  'salmiya',
  'al-kout',
  'ardiya',
  'school-canteens',
  'unattributed',
] as const

export function loadLiveTodaySummary(): OdooLiveSummary {
  const file = path.resolve(import.meta.dirname, '../fixtures/dashboard-today-2026-11-17.json')
  return JSON.parse(fs.readFileSync(file, 'utf8')).summary as OdooLiveSummary
}

interface SyntheticOrder {
  location: string
  lines: { brand: string | null; kwd: number }[]
}

/** 24 synthetic orders whose per-branch net equals the live payload (Ardiya 99.35/13 …). */
export function syntheticTodayOrders(): SyntheticOrder[] {
  const orders: SyntheticOrder[] = []
  const push = (location: string, lines: SyntheticOrder['lines']) => orders.push({ location, lines })
  // Ardiya 13 orders = 99.35, including one China Garden + Frank's order with a −1.60 discount.
  for (let i = 0; i < 11; i++) push('ardiya', [{ brand: 'china-garden', kwd: 7 }])
  push('ardiya', [{ brand: 'china-garden', kwd: 10 }, { brand: 'franks', kwd: 5 }, { brand: null, kwd: -1.6 }])
  push('ardiya', [{ brand: 'franks', kwd: 8.95 }])
  // Promenade 7 orders = 31.55, one Noodle Bar order and a −4.00 reward line.
  for (let i = 0; i < 5; i++) push('promenade', [{ brand: 'china-garden', kwd: 5 }])
  push('promenade', [{ brand: 'noodle-bar', kwd: 3.25 }])
  push('promenade', [{ brand: 'franks', kwd: 7.3 }, { brand: null, kwd: -4 }])
  // Salmiya 3 orders = 18.35.
  push('salmiya', [{ brand: 'china-garden', kwd: 6 }])
  push('salmiya', [{ brand: 'china-garden', kwd: 6 }])
  push('salmiya', [{ brand: 'franks', kwd: 6.35 }])
  // Al-Kout 1 order = 5.45.
  push('al-kout', [{ brand: 'china-garden', kwd: 5.45 }])
  return orders
}

export function allocateSyntheticToday() {
  const headers: PosOrderHeader[] = []
  const lines: PosOrderLineInput[] = []
  syntheticTodayOrders().forEach((o, idx) => {
    const orderId = idx + 1
    const net = o.lines.reduce((s, l) => s + l.kwd, 0)
    headers.push({ orderId, locationKey: o.location, dayIso: FIXTURE_DAY, netKwd: net, isRefund: net < 0 })
    for (const l of o.lines) {
      lines.push({
        orderId,
        netKwd: l.kwd,
        lineClass: l.brand ? { kind: 'brand', brandId: l.brand } : { kind: 'unbranded' },
      })
    }
  })
  return allocateBrandsFromOrders({ orders: headers, lines, brandIds: BRAND_IDS, locationKeys: LOCATION_KEYS })
}

/** Live payload with the synthetic exact brand allocation attached to the today bucket. */
export function buildAllocatedTodaySummary(): OdooLiveSummary {
  const summary = loadLiveTodaySummary()
  const allocation = allocateSyntheticToday()
  const today = summary.buckets!.today!
  today.byBrand = Object.fromEntries(
    BRAND_IDS.map((bid) => [bid, { ...allocation.byBrand[bid], qty: today.byBrand?.[bid]?.qty ?? 0 }]),
  )
  today.brandBasis = 'order-allocated'
  today.brandBasisGapKwd = 0
  today.byBrandByLocation = allocation.byBrandByLocation
  today.byBrandDaily = allocation.byBrandDaily
  today.unbrandedNetKwd = allocation.unbrandedNetKwd
  today.excludedLineNetKwd = allocation.excludedLineNetKwd
  return summary
}

/**
 * Selected-period cube for the live 2026-11-17 payload, shaped exactly like the
 * `/api/erp/live-comparison` `cubeA` response. Totals, branches, channels, brands and the daily row
 * are the payload's real "today" values (154.700 KWD / 24 orders, synced 06:00 Kuwait).
 *
 * The payload carries no per-hour split for that day, so `hourlySeries` below is a TEST split of
 * those same 24 orders across 00:00–05:59 (before the 06:00 sync). It sums exactly to the real
 * day total, so Σ(hourly) === period total holds to the fils.
 */
export function buildLiveTodayCube(): OdooPeriodCube {
  const summary = loadLiveTodaySummary()
  const today = summary.buckets!.today!
  const channelKeys = ['dine-in', 'takeaway-direct', 'talabat-tgo', 'talabat-tmp', 'keeta', 'deliveroo', 'jahez', 'snoonu'] as const
  const channelsOf = (src?: Record<string, { netKwd: number; orders: number }> | null) =>
    Object.fromEntries(channelKeys.map((k) => [k, { netKwd: src?.[k]?.netKwd ?? 0, orders: src?.[k]?.orders ?? 0 }]))
  const locations = (today.byLocation ?? {}) as Record<string, { netKwd: number; orders: number; uiChannels?: Record<string, { netKwd: number; orders: number }> }>
  const byBranch: Record<string, unknown> = {}
  for (const id of ['promenade', '360-mall', 'ardiya', 'assima', 'salmiya', 'al-kout', 'avenues', 'school-canteens']) {
    const loc = locations[id]
    const net = loc?.netKwd ?? 0
    const orders = loc?.orders ?? 0
    byBranch[id] = { netKwd: net, orders, aovKwd: orders > 0 ? Math.round((net / orders) * 1000) / 1000 : 0, channels: channelsOf(loc?.uiChannels) }
  }
  const brands = (today.byBrand ?? {}) as Record<string, { netKwd: number; orders: number | null; qty?: number }>
  const byBrand = Object.fromEntries(
    Object.entries(brands).map(([id, b]) => [id, { netKwd: b.netKwd, qty: b.qty ?? 0, linesCount: b.qty ?? 0, orders: b.orders, avgDiscountPct: 0, discountKwd: 0 }]),
  )
  // TEST hourly split of the real 154.700 KWD / 24 orders (see doc comment).
  const split: Record<number, [number, number]> = { 0: [52.15, 8], 1: [41.3, 6], 2: [27, 4], 3: [18.3, 3], 4: [9, 2], 5: [6.95, 1] }
  const hourlySeries = Array.from({ length: 24 }, (_, hour) => ({ hour, netKwd: split[hour]?.[0] ?? 0, orders: split[hour]?.[1] ?? 0 }))
  const totals = today.totals as { netSalesKwd: number; orders: number; aovKwd: number }
  return {
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    odooCompanyId: summary.odooCompanyId ?? null,
    lastSyncAt: summary.lastSyncAt ?? null,
    isStale24h: false,
    dateRange: { from: today.from, to: shiftDay(today.to, -1) >= today.from ? shiftDay(today.to, -1) : today.from },
    days: 1,
    totals: {
      netSalesKwd: totals.netSalesKwd,
      orders: totals.orders,
      aovKwd: totals.aovKwd,
      mappedBranchesNetKwd: totals.netSalesKwd,
      mappedBranchesOrders: totals.orders,
      unattributedSalesKwd: today.unattributedSalesKwd ?? 0,
      unattributedOrders: today.unattributedOrders ?? 0,
      excludedEntitiesKwd: 0,
      excludedEntitiesOrders: 0,
      totalDiscountKwd: 0,
      avgDiscountPct: 0,
      discountedLinesCount: 0,
    },
    byBranch,
    unattributed: { id: 'unattributed', labelAr: 'غير منسوب لفرع', labelEn: 'Unattributed to Branch', netKwd: 0, orders: 0, aovKwd: 0, channels: channelsOf(null) },
    byBrand,
    brandByBranch: {},
    byChannel: channelsOf(today.uiChannels as Record<string, { netKwd: number; orders: number }>),
    dailySeries: (summary.dailySeries ?? []).map((d) => ({ ...d, unattributedNetKwd: 0, unattributedOrders: 0 })),
    dailyByBranch: {},
    dailyUnattributed: {},
    hourlySeries,
    hourlyByBranch: {},
    topProducts: [],
  } as unknown as OdooPeriodCube
}

function shiftDay(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}
