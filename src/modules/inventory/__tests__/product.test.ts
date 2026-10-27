import { describe, expect, it } from 'vitest'
import { parseKwdToMinor } from '@/lib/money'
import { DEFAULT_PRODUCT_CATEGORY, MAX_PRODUCT_PRICE_MINOR } from '@/modules/inventory/domain/types'
import {
  createProductSchema,
  deleteProductSchema,
  listProductsQuerySchema,
  productIdSchema,
  updateProductSchema,
} from '@/modules/inventory/schemas/product'

const product = { name: 'Chicken burger', category: 'Burgers', priceMinor: 1_500, available: true }

describe('createProductSchema', () => {
  it('accepts a valid product and trims text', () => {
    expect(createProductSchema.parse({ ...product, name: '  Chicken burger  ' })).toEqual(product)
  })

  it('gives a blank category the default one', () => {
    expect(createProductSchema.parse({ ...product, category: '   ' }).category).toBe(DEFAULT_PRODUCT_CATEGORY)
  })

  it('accepts price zero and the largest price the column holds, and rejects one fils more', () => {
    expect(createProductSchema.safeParse({ ...product, priceMinor: 0 }).success).toBe(true)
    expect(createProductSchema.safeParse({ ...product, priceMinor: MAX_PRODUCT_PRICE_MINOR }).success).toBe(true)
    expect(createProductSchema.safeParse({ ...product, priceMinor: MAX_PRODUCT_PRICE_MINOR + 1 }).success).toBe(false)
  })

  it('rejects negative, fractional and non-integer prices (money is whole fils)', () => {
    for (const priceMinor of [-1, 0.5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(createProductSchema.safeParse({ ...product, priceMinor }).success, String(priceMinor)).toBe(false)
    }
  })

  it('rejects an empty or over-long name and an over-long category', () => {
    expect(createProductSchema.safeParse({ ...product, name: '   ' }).success).toBe(false)
    expect(createProductSchema.safeParse({ ...product, name: 'x'.repeat(201) }).success).toBe(false)
    expect(createProductSchema.safeParse({ ...product, category: 'x'.repeat(81) }).success).toBe(false)
  })

  it('ignores a tenant id sent in the body, so a client cannot choose the company', () => {
    const parsed = createProductSchema.parse({ ...product, tenantId: '11111111-1111-4111-8111-111111111111', tenant_id: 'x' })
    expect(parsed).toEqual(product)
  })
})

describe('updateProductSchema and deleteProductSchema', () => {
  it('require a version of at least 1', () => {
    expect(updateProductSchema.safeParse({ ...product, version: 1 }).success).toBe(true)
    expect(updateProductSchema.safeParse(product).success).toBe(false)
    expect(updateProductSchema.safeParse({ ...product, version: 0 }).success).toBe(false)
    expect(deleteProductSchema.safeParse({ version: 3 }).success).toBe(true)
    expect(deleteProductSchema.safeParse({}).success).toBe(false)
  })

  it('validates product ids as UUIDs', () => {
    expect(productIdSchema.safeParse('11111111-1111-4111-8111-111111111111').success).toBe(true)
    expect(productIdSchema.safeParse("1' or '1'='1").success).toBe(false)
  })
})

describe('listProductsQuerySchema', () => {
  it('defaults to page 1 and caps the search text', () => {
    expect(listProductsQuerySchema.parse({}).page).toBe(1)
    expect(listProductsQuerySchema.safeParse({ page: 0 }).success).toBe(false)
    expect(listProductsQuerySchema.safeParse({ q: 'x'.repeat(101) }).success).toBe(false)
  })
})

describe('typing a price in the admin form', () => {
  it('turns KWD text into exact fils with no float error', () => {
    expect(parseKwdToMinor('1.500')).toBe(1_500)
    expect(parseKwdToMinor('0.001')).toBe(1)
    expect(parseKwdToMinor('0')).toBe(0)
    expect(parseKwdToMinor('0.1')).toBe(100)
    expect(parseKwdToMinor('9999999.999')).toBe(MAX_PRODUCT_PRICE_MINOR)
  })

  it('refuses a fourth decimal, a sign and text', () => {
    for (const text of ['1.0005', '-1', '1,5.5.5', 'abc', '']) expect(parseKwdToMinor(text), text).toBeNull()
  })
})
