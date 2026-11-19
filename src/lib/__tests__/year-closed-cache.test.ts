import { describe, expect, it } from 'vitest'
import {
  clearYearClosedCache,
  mergeProductLineGroups,
  readClosedYearPlusToday,
  yearClosedWindow,
} from '@/lib/odoo/pos-order-query'

describe('year closed-day cache', () => {
  it('reads closed days once and today on every call', async () => {
    clearYearClosedCache()
    const calls: string[] = []
    const read = async (window: { fromUtc: string; toUtc: string }) => {
      calls.push(`${window.fromUtc}|${window.toUtc}`)
      return [{ product_id: [7, 'Chicken'] as [number, string], price_subtotal: 10, qty: 1 }]
    }
    const first = await readClosedYearPlusToday({
      cacheKey: 'brands.year|test',
      closed: yearClosedWindow('2026-01-01 00:00:00', '2026-11-19 00:00:00'),
      today: { fromUtc: '2026-11-19 00:00:00', toUtc: '2026-11-20 00:00:00' },
      read,
      merge: mergeProductLineGroups,
    })
    const second = await readClosedYearPlusToday({
      cacheKey: 'brands.year|test',
      closed: yearClosedWindow('2026-01-01 00:00:00', '2026-11-19 00:00:00'),
      today: { fromUtc: '2026-11-19 00:00:00', toUtc: '2026-11-20 00:00:00' },
      read,
      merge: mergeProductLineGroups,
    })
    expect(calls.filter((call) => call.startsWith('2026-01-01'))).toHaveLength(1)
    expect(calls.filter((call) => call.startsWith('2026-11-19'))).toHaveLength(2)
    expect(first[0]?.price_subtotal).toBe(20)
    expect(second[0]?.price_subtotal).toBe(20)
  })
})
