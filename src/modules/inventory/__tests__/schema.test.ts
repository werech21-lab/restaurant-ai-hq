import { describe, expect, it } from 'vitest'
import {
  createItemSchema,
  createMovementSchema,
  createWarehouseSchema,
  listBalancesQuerySchema,
  listItemsQuerySchema,
  summaryQuerySchema,
  updateItemSchema,
  updateWarehouseSchema,
} from '@/modules/inventory/schemas/inventory'
const ID_A = '33333333-3333-4333-8333-333333333333'
const ID_B = '44444444-4444-4444-8444-444444444444'
const ITEM = '11111111-1111-4111-8111-111111111111'

const item = { sku: 'cola-33', name: 'Cola 330ml', unit: 'piece', unitCostMinor: 150, sellingPriceMinor: 250, reorderLevel: 10 }

describe('createItemSchema', () => {
  it('upper-cases the SKU and defaults to active', () => {
    const parsed = createItemSchema.parse(item)
    expect(parsed.sku).toBe('COLA-33')
    expect(parsed.isActive).toBe(true)
  })

  it('rejects bad SKUs, empty names and unknown units', () => {
    expect(createItemSchema.safeParse({ ...item, sku: 'has space' }).success).toBe(false)
    expect(createItemSchema.safeParse({ ...item, sku: '' }).success).toBe(false)
    expect(createItemSchema.safeParse({ ...item, name: '  ' }).success).toBe(false)
    expect(createItemSchema.safeParse({ ...item, unit: 'barrel' }).success).toBe(false)
  })

  it('accepts zero and rejects negative or fractional money and levels', () => {
    expect(createItemSchema.safeParse({ ...item, unitCostMinor: 0, sellingPriceMinor: 0, reorderLevel: 0 }).success).toBe(true)
    expect(createItemSchema.safeParse({ ...item, unitCostMinor: -1 }).success).toBe(false)
    expect(createItemSchema.safeParse({ ...item, sellingPriceMinor: 1.5 }).success).toBe(false)
    expect(createItemSchema.safeParse({ ...item, reorderLevel: -1 }).success).toBe(false)
    expect(createItemSchema.safeParse({ ...item, reorderLevel: 2.5 }).success).toBe(false)
    expect(createItemSchema.safeParse({ ...item, unitCostMinor: 1_000_000_001 }).success).toBe(false)
  })
})

describe('updateItemSchema', () => {
  it('needs a version and does not accept SKU or unit changes', () => {
    const body = { version: 2, name: 'Cola', unitCostMinor: 1, sellingPriceMinor: 2, reorderLevel: 0, isActive: true }
    expect(updateItemSchema.safeParse(body).success).toBe(true)
    expect(updateItemSchema.safeParse({ ...body, version: undefined }).success).toBe(false)
    expect('sku' in updateItemSchema.parse({ ...body, sku: 'NEW' })).toBe(false)
  })
})

describe('warehouse schemas', () => {
  it('upper-cases the code, nulls an empty location and defaults to active', () => {
    const parsed = createWarehouseSchema.parse({ code: 'main', name: 'Main store', location: '', capacity: undefined })
    expect(parsed).toMatchObject({ code: 'MAIN', location: null, capacity: null, status: 'active' })
  })

  it('rejects a negative or fractional capacity and an unknown status', () => {
    expect(createWarehouseSchema.safeParse({ code: 'A', name: 'A', capacity: -1 }).success).toBe(false)
    expect(createWarehouseSchema.safeParse({ code: 'A', name: 'A', capacity: 1.5 }).success).toBe(false)
    expect(createWarehouseSchema.safeParse({ code: 'A', name: 'A', status: 'closed' }).success).toBe(false)
  })

  it('needs a version to update', () => {
    expect(updateWarehouseSchema.safeParse({ name: 'A', status: 'active' }).success).toBe(false)
    expect(updateWarehouseSchema.safeParse({ version: 1, name: 'A', status: 'inactive', capacity: 0 }).success).toBe(true)
  })
})

describe('createMovementSchema', () => {
  it('accepts IN, OUT and TRANSFER', () => {
    expect(createMovementSchema.safeParse({ type: 'IN', itemId: ITEM, warehouseId: ID_A, quantity: 5 }).success).toBe(true)
    expect(createMovementSchema.safeParse({ type: 'OUT', itemId: ITEM, warehouseId: ID_A, quantity: 5, note: 'Damaged' }).success).toBe(true)
    expect(createMovementSchema.safeParse({ type: 'TRANSFER', itemId: ITEM, fromWarehouseId: ID_A, toWarehouseId: ID_B, quantity: 5 }).success).toBe(true)
  })

  it('rejects zero, negative and fractional quantities', () => {
    for (const quantity of [0, -3, 1.5, 1_000_001]) {
      expect(createMovementSchema.safeParse({ type: 'IN', itemId: ITEM, warehouseId: ID_A, quantity }).success).toBe(false)
    }
  })

  it('rejects a transfer to the same warehouse and an unknown type', () => {
    expect(createMovementSchema.safeParse({ type: 'TRANSFER', itemId: ITEM, fromWarehouseId: ID_A, toWarehouseId: ID_A, quantity: 1 }).success).toBe(false)
    expect(createMovementSchema.safeParse({ type: 'ADJUST', itemId: ITEM, warehouseId: ID_A, quantity: 1 }).success).toBe(false)
  })

  it('rejects ids that are not UUIDs', () => {
    expect(createMovementSchema.safeParse({ type: 'IN', itemId: 'x', warehouseId: ID_A, quantity: 1 }).success).toBe(false)
  })
})

describe('list queries', () => {
  it('defaults to active items sorted by name with a page size', () => {
    const parsed = listItemsQuerySchema.parse({})
    expect(parsed).toMatchObject({ status: 'active', sort: 'name', direction: 'asc', lowStock: false })
    expect(parsed.limit).toBeGreaterThan(0)
  })

  it('reads lowStock=true and rejects an oversized page and an unknown sort', () => {
    expect(listItemsQuerySchema.parse({ lowStock: 'true' }).lowStock).toBe(true)
    expect(listItemsQuerySchema.safeParse({ limit: '101' }).success).toBe(false)
    expect(listItemsQuerySchema.safeParse({ sort: 'cost' }).success).toBe(false)
    expect(listBalancesQuerySchema.safeParse({ itemId: 'nope' }).success).toBe(false)
  })

  it('bounds the summary window', () => {
    expect(summaryQuerySchema.parse({}).days).toBe(30)
    expect(summaryQuerySchema.parse({ days: '7' }).days).toBe(7)
    expect(summaryQuerySchema.safeParse({ days: '0' }).success).toBe(false)
    expect(summaryQuerySchema.safeParse({ days: '366' }).success).toBe(false)
  })
})