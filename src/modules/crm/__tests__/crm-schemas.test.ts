import { describe, expect, it } from 'vitest'
import { createLeadSchema, listLeadsQuerySchema, moveLeadSchema, updateLeadSchema } from '@/modules/crm/schemas/lead'
import {
  createQuotationSchema,
  listQuotationsQuerySchema,
  updateQuotationSchema,
} from '@/modules/crm/schemas/quotation'

const CUSTOMER = '11111111-1111-4111-8111-111111111111'
const ITEM = '22222222-2222-4222-8222-222222222222'
const WAREHOUSE = '33333333-3333-4333-8333-333333333333'

const lead = { customerId: CUSTOMER, title: 'Catering contract', expectedRevenueMinor: 5_000_000, probability: 40 }
const line = { description: 'Cola', quantity: 3, unitPriceMinor: 1_500, taxRateBps: 500 }

describe('createLeadSchema', () => {
  it('starts in stage new and fills optional fields with null', () => {
    expect(createLeadSchema.parse(lead)).toEqual({
      ...lead,
      stage: 'new',
      assignedTo: null,
      expectedCloseDate: null,
      notes: null,
    })
  })

  it('cannot create a lead that is already won or lost', () => {
    expect(createLeadSchema.safeParse({ ...lead, stage: 'proposal' }).success).toBe(true)
    expect(createLeadSchema.safeParse({ ...lead, stage: 'won' }).success).toBe(false)
    expect(createLeadSchema.safeParse({ ...lead, stage: 'lost' }).success).toBe(false)
  })

  it('bounds probability to 0..100 and revenue to whole non-negative fils', () => {
    expect(createLeadSchema.safeParse({ ...lead, probability: 0 }).success).toBe(true)
    expect(createLeadSchema.safeParse({ ...lead, probability: 100 }).success).toBe(true)
    expect(createLeadSchema.safeParse({ ...lead, probability: 101 }).success).toBe(false)
    expect(createLeadSchema.safeParse({ ...lead, probability: -1 }).success).toBe(false)
    expect(createLeadSchema.safeParse({ ...lead, probability: 50.5 }).success).toBe(false)
    expect(createLeadSchema.safeParse({ ...lead, expectedRevenueMinor: -1 }).success).toBe(false)
    expect(createLeadSchema.safeParse({ ...lead, expectedRevenueMinor: 10.5 }).success).toBe(false)
    expect(createLeadSchema.safeParse({ ...lead, expectedRevenueMinor: 1_000_000_000_001 }).success).toBe(false)
  })

  it('needs a real calendar date and a uuid for the assignee', () => {
    expect(createLeadSchema.safeParse({ ...lead, expectedCloseDate: '2026-02-30' }).success).toBe(false)
    expect(createLeadSchema.safeParse({ ...lead, expectedCloseDate: '2026-12-31' }).success).toBe(true)
    expect(createLeadSchema.safeParse({ ...lead, assignedTo: 'not-a-uuid' }).success).toBe(false)
  })
})

describe('updateLeadSchema and moveLeadSchema', () => {
  it('need a version', () => {
    const { customerId: _customerId, ...fields } = lead
    expect(updateLeadSchema.safeParse(fields).success).toBe(false)
    expect(updateLeadSchema.safeParse({ ...fields, version: 1 }).success).toBe(true)
    expect(moveLeadSchema.safeParse({ stage: 'won' }).success).toBe(false)
    expect(moveLeadSchema.safeParse({ stage: 'won', version: 2 }).success).toBe(true)
    expect(moveLeadSchema.safeParse({ stage: 'negotiation', version: 2 }).success).toBe(false)
  })
})

describe('listLeadsQuerySchema', () => {
  it('defaults, caps the page size and whitelists the sort', () => {
    expect(listLeadsQuerySchema.parse({})).toMatchObject({ limit: 25, sort: 'createdAt', direction: 'desc' })
    expect(listLeadsQuerySchema.safeParse({ limit: '101' }).success).toBe(false)
    expect(listLeadsQuerySchema.safeParse({ sort: 'probability; drop table' }).success).toBe(false)
    expect(listLeadsQuerySchema.safeParse({ stage: 'negotiation' }).success).toBe(false)
  })
})

describe('createQuotationSchema', () => {
  const quote = { customerId: CUSTOMER, validUntil: '2026-12-31', lines: [line] }

  it('parses a quotation and fills the optional fields', () => {
    expect(createQuotationSchema.parse(quote)).toEqual({
      customerId: CUSTOMER,
      leadId: null,
      validUntil: '2026-12-31',
      notes: null,
      lines: [{ ...line, itemId: null, warehouseId: null }],
    })
  })

  it('needs at least one line and at most 200', () => {
    expect(createQuotationSchema.safeParse({ ...quote, lines: [] }).success).toBe(false)
    expect(createQuotationSchema.safeParse({ ...quote, lines: Array.from({ length: 200 }, () => line) }).success).toBe(true)
    expect(createQuotationSchema.safeParse({ ...quote, lines: Array.from({ length: 201 }, () => line) }).success).toBe(false)
  })

  it('takes an item and a warehouse together or not at all', () => {
    const both = { ...line, itemId: ITEM, warehouseId: WAREHOUSE }
    expect(createQuotationSchema.safeParse({ ...quote, lines: [both] }).success).toBe(true)
    expect(createQuotationSchema.safeParse({ ...quote, lines: [{ ...line, itemId: ITEM }] }).success).toBe(false)
    expect(createQuotationSchema.safeParse({ ...quote, lines: [{ ...line, warehouseId: WAREHOUSE }] }).success).toBe(false)
  })

  it('rejects fractional or out-of-range quantities, prices and tax rates', () => {
    const bad = (override: object) => createQuotationSchema.safeParse({ ...quote, lines: [{ ...line, ...override }] }).success
    expect(bad({ quantity: 0 })).toBe(false)
    expect(bad({ quantity: 1.5 })).toBe(false)
    expect(bad({ quantity: 1_000_001 })).toBe(false)
    expect(bad({ unitPriceMinor: -1 })).toBe(false)
    expect(bad({ unitPriceMinor: 0.5 })).toBe(false)
    expect(bad({ taxRateBps: 10_001 })).toBe(false)
    expect(bad({ taxRateBps: 10_000 })).toBe(true)
    expect(bad({ description: '   ' })).toBe(false)
  })

  it('needs a real valid-until date', () => {
    expect(createQuotationSchema.safeParse({ ...quote, validUntil: '31/12/2026' }).success).toBe(false)
    expect(createQuotationSchema.safeParse({ ...quote, validUntil: '2026-13-01' }).success).toBe(false)
  })
})

describe('updateQuotationSchema and listQuotationsQuerySchema', () => {
  it('update needs a version', () => {
    const body = { customerId: CUSTOMER, validUntil: '2026-12-31', lines: [line] }
    expect(updateQuotationSchema.safeParse(body).success).toBe(false)
    expect(updateQuotationSchema.safeParse({ ...body, version: 2 }).success).toBe(true)
  })

  it('list whitelists status and sort', () => {
    expect(listQuotationsQuerySchema.parse({ status: 'accepted' }).status).toBe('accepted')
    expect(listQuotationsQuerySchema.safeParse({ status: 'approved' }).success).toBe(false)
    expect(listQuotationsQuerySchema.safeParse({ sort: 'notes' }).success).toBe(false)
    expect(listQuotationsQuerySchema.safeParse({ limit: '1000' }).success).toBe(false)
  })
})
