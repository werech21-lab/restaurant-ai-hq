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
