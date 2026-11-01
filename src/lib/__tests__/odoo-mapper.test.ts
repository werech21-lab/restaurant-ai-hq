import { describe, expect, it } from 'vitest'
import { resolveScopeBounds } from '@/lib/data-scope'
import { coverageReport, mapOdooProduct } from '@/lib/odoo-mapper'

describe('odoo mapper', () => {
  it('maps product core fields and keeps extras in extended metadata', () => {
    const mapped = mapOdooProduct(
      {
        id: 12,
        name: 'دجاج طازج',
        default_code: 'CHK-01',
        barcode: '628100000001',
        list_price: 1.25,
        standard_price: 0.9,
        active: true,
        x_studio_brand: 'Farm Brown',
      },
      { brand: 'Farm Brown', branch: 'Sharq HQ' }
    )
    expect(mapped.defaultCode).toBe('CHK-01')
    expect(mapped.listPrice).toBe(1.25)
    expect(mapped.extended.some((row) => row.key === 'x_studio_brand')).toBe(true)
    expect(mapped.extended.some((row) => row.key === 'brand' && row.value === 'Farm Brown')).toBe(true)
  })

  it('reports field coverage for product.template', () => {
    const report = coverageReport('product.template', { id: 1, name: 'Test', default_code: 'T1' })
    expect(report.present).toBeGreaterThan(0)
    expect(report.missing).toContain('list_price')
  })
})

describe('data scope', () => {
  it('defaults hot scope to a 90-day from-date', () => {
    const bounds = resolveScopeBounds({ scope: 'hot' })
    expect(bounds.mode).toBe('hot')
    expect(bounds.fromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(bounds.toDate).toBeNull()
  })

  it('keeps archive open-ended unless a range is set', () => {
    expect(resolveScopeBounds({ scope: 'archive' })).toEqual({ mode: 'archive', fromDate: null, toDate: null })
    expect(resolveScopeBounds({ scope: 'archive', from: '2020-01-01', to: '2020-12-31' }).fromDate).toBe('2020-01-01')
  })
})
