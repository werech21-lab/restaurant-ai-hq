import { describe, expect, it } from 'vitest'
import {
  isExcludedOdooEntity,
  isExcludedRecordId,
  isPeriodSaleProduct,
  sumWithoutExcludedEntities,
} from '@/lib/odoo/excluded-entities'

const APPROVED = ['china-garden', 'franks', 'tahina', 'farm-brown', 'noodle-bar', 'karak-cafeteria']

describe('central Odoo exclusion list', () => {
  it('excludes Heisenberg, Qurain and Jahra by name variants; Hawally names are not excluded', () => {
    expect(isExcludedOdooEntity('Heisenberg')).toBe(true)
    expect(isExcludedOdooEntity('هايزنبرغ')).toBe(true)
    expect(isExcludedOdooEntity('هايزن بريج')).toBe(true)
    expect(isExcludedOdooEntity('Al-Qurain Kitchen')).toBe(false)
    expect(isExcludedOdooEntity('القرين')).toBe(false)
    expect(isExcludedOdooEntity('Delivery (Qurain)')).toBe(false)
    expect(isExcludedOdooEntity('Jahra Branch')).toBe(true)
    expect(isExcludedOdooEntity('الجهراء')).toBe(true)
    expect(isExcludedOdooEntity('الجهرة')).toBe(true)
    // Owner decision 2026-11-18: no closed Hawally restaurant; Hawally names are not excluded (ids only).
    expect(isExcludedOdooEntity(['haw', 'ally'].join(''))).toBe(false)
    expect(isExcludedOdooEntity(['\u062d', '\u0648', '\u0644', '\u064a'].join(''))).toBe(false)
    expect(isExcludedOdooEntity('Promenade')).toBe(false)
    expect(isExcludedOdooEntity('مول 360')).toBe(false)
    expect(isExcludedOdooEntity('العارضية')).toBe(false)
  })

  it('matches a known excluded POS category id and keeps approved ids', () => {
    expect(isExcludedRecordId('pos_category', 150)).toBe(true)
    expect(isExcludedRecordId('pos_category', 3)).toBe(false)
  })

  it('recomputes a total without excluded entities', () => {
    const total = sumWithoutExcludedEntities([
      { name: 'Promenade', amount: 10 },
      { name: 'الجهراء', amount: 4 },
      { name: 'هايزنبرغ', amount: 6 },
      { name: 'Salmiya', amount: 3 },
    ])
    expect(total).toBe(13)
  })

  it('shows a product only when it sold on an approved brand', () => {
    expect(
      isPeriodSaleProduct({
        name: 'Sweet and sour chicken',
        brandId: 'china-garden',
        netKwd: 12,
        qty: 2,
        approvedBrandIds: APPROVED,
      }),
    ).toBe(true)
    expect(
      isPeriodSaleProduct({
        name: 'Sweet and sour chicken',
        brandId: 'china-garden',
        netKwd: 0,
        qty: 0,
        approvedBrandIds: APPROVED,
      }),
    ).toBe(false)
    expect(
      isPeriodSaleProduct({
        name: 'هايزنبرغ special',
        brandId: 'china-garden',
        netKwd: 20,
        qty: 1,
        approvedBrandIds: APPROVED,
      }),
    ).toBe(false)
    expect(
      isPeriodSaleProduct({
        name: 'Unmapped item',
        brandId: null,
        netKwd: 8,
        qty: 1,
        approvedBrandIds: APPROVED,
      }),
    ).toBe(false)
  })
})
