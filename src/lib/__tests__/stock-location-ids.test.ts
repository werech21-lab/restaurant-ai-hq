import { describe, expect, it } from 'vitest'
import {
  CENTRAL_KITCHEN_STOCK_LOCATION_IDS,
  branchIdForStockLocation,
  isCentralKitchenStockLocation,
  isExcludedStockLocation,
  resolveStockRoots,
} from '@/lib/odoo/stock-location-ids'
import { YEAR_CLOSED_READ_TIMEOUT_MS, YEAR_PAYMENT_GROUP_BY, yearReadCall } from '@/lib/odoo/pos-order-query'
import { LAST_KNOWN_GOOD_MAX_AGE_MS, lastKnownGoodIsFresh } from '@/lib/odoo-live-connector'

describe('stock.location ids', () => {
  it('maps the quant-export locations and does not treat pos.config 41 or 42 as locations', () => {
    expect(branchIdForStockLocation(219)).toBe('360-mall')
    expect(branchIdForStockLocation(227)).toBe('al-kout')
    expect(branchIdForStockLocation(235)).toBe('assima')
    expect(branchIdForStockLocation(251)).toBe('promenade')
    expect(isCentralKitchenStockLocation(259)).toBe(true)
    expect(CENTRAL_KITCHEN_STOCK_LOCATION_IDS).toEqual([259])
    expect(branchIdForStockLocation(41)).toBeNull()
    expect(branchIdForStockLocation(42)).toBeNull()
  })

  it('resolves Avenues, Salmiya and Ardiya from warehouse lots and excludes Jahra children by parent_path', () => {
    const roots = resolveStockRoots([
      { code: 'AVN', lotStockId: 400, viewLocationId: 399 },
      { code: 'SLM', lotStockId: 410, viewLocationId: 409 },
      { code: 'ARD', lotStockId: 420, viewLocationId: 419 },
      { code: 'JHR', lotStockId: 92, viewLocationId: 90 },
      { code: 'QRN', lotStockId: 259, viewLocationId: 258 },
    ])
    expect(branchIdForStockLocation(401, '399/400/401/', roots)).toBe('avenues')
    expect(branchIdForStockLocation(411, '409/410/411/', roots)).toBe('salmiya')
    expect(branchIdForStockLocation(421, '419/420/421/', roots)).toBe('ardiya')
    expect(isExcludedStockLocation(93, '90/92/93/', roots)).toBe(true)
    expect(branchIdForStockLocation(93, '90/92/93/', roots)).toBeNull()
    expect(isCentralKitchenStockLocation(260, '258/259/260/', roots)).toBe(true)
    expect(branchIdForStockLocation(999, '1/999/', roots)).toBeNull()
    expect(isCentralKitchenStockLocation(999, '1/999/', roots)).toBe(false)
    expect(roots.excludedIds).toEqual(expect.arrayContaining([92, 90]))
  })
})

describe('closed-year reads', () => {
  it('groups yearly payments by payment method and gives the closed window 45s', () => {
    expect(YEAR_PAYMENT_GROUP_BY).toEqual(['payment_method_id'])
    const closed = yearReadCall({ fromUtc: '2026-01-01 00:00:00', toUtc: '2026-11-19 00:00:00' })
    expect(closed.timeout).toEqual({
      timeoutMs: YEAR_CLOSED_READ_TIMEOUT_MS,
      timeoutCapMs: YEAR_CLOSED_READ_TIMEOUT_MS,
    })
    expect(YEAR_CLOSED_READ_TIMEOUT_MS).toBe(45_000)
    expect(closed.kwargs.context).toBeUndefined()
    const today = yearReadCall({ fromUtc: '2026-11-19 00:00:00', toUtc: '2026-11-20 00:00:00' })
    expect(today.timeout).toBeUndefined()
    expect(today.kwargs.context).toEqual({ year_live_slice: true })
  })
})

describe('last known good snapshot', () => {
  it('serves a complete snapshot for 30 minutes and drops it after that', () => {
    const now = 1_000_000
    const fresh = { fetchedAtMs: now - LAST_KNOWN_GOOD_MAX_AGE_MS, unavailableSections: [] as string[] }
    const stale = { fetchedAtMs: now - LAST_KNOWN_GOOD_MAX_AGE_MS - 1, unavailableSections: [] as string[] }
    const partial = { fetchedAtMs: now, unavailableSections: ['channels.year'] }
    expect(LAST_KNOWN_GOOD_MAX_AGE_MS).toBe(30 * 60_000)
    expect(lastKnownGoodIsFresh(fresh, now)).toBe(true)
    expect(lastKnownGoodIsFresh(stale, now)).toBe(false)
    expect(lastKnownGoodIsFresh(partial, now)).toBe(false)
    expect(lastKnownGoodIsFresh(null, now)).toBe(false)
  })
})
