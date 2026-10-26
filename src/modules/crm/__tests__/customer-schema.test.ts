import { describe, expect, it } from 'vitest'
import {
  createCustomerSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from '@/modules/crm/schemas/customer'

describe('createCustomerSchema', () => {
  it('trims, lowercases the email and turns blanks into null', () => {
    const parsed = createCustomerSchema.parse({ name: '  Al Noor  ', email: ' INFO@AlNoor.com ', phone: '', notes: '' })
    expect(parsed).toEqual({
      name: 'Al Noor',
      customerType: 'company',
      email: 'info@alnoor.com',
      phone: null,
      taxId: null,
      address: null,
      creditLimitMinor: null,
      status: 'active',
      notes: null,
    })
  })

  it('accepts a name alone and keeps the default status active', () => {
    expect(createCustomerSchema.parse({ name: 'Walk-in' })).toEqual({
      name: 'Walk-in',
      customerType: 'company',
      email: null,
      phone: null,
      taxId: null,
      address: null,
      creditLimitMinor: null,
      status: 'active',
      notes: null,
    })
  })

  it('accepts every status and the credit limit boundaries, nothing else', () => {
    for (const status of ['lead', 'prospect', 'active', 'blocked']) {
      expect(createCustomerSchema.safeParse({ name: 'A', status }).success).toBe(true)
    }
    expect(createCustomerSchema.safeParse({ name: 'A', status: 'inactive' }).success).toBe(false)
    expect(createCustomerSchema.safeParse({ name: 'A', creditLimitMinor: 0 }).success).toBe(true)
    expect(createCustomerSchema.safeParse({ name: 'A', creditLimitMinor: -1 }).success).toBe(false)
    expect(createCustomerSchema.safeParse({ name: 'A', creditLimitMinor: 1.5 }).success).toBe(false)
    expect(createCustomerSchema.safeParse({ name: 'A', creditLimitMinor: 1_000_000_000_001 }).success).toBe(false)
    expect(createCustomerSchema.safeParse({ name: 'A', customerType: 'government' }).success).toBe(false)
  })

  it('rejects an empty name, a bad email and a bad phone', () => {
    expect(createCustomerSchema.safeParse({ name: '   ' }).success).toBe(false)
    expect(createCustomerSchema.safeParse({ name: 'A', email: 'nope' }).success).toBe(false)
    expect(createCustomerSchema.safeParse({ name: 'A', phone: 'abc' }).success).toBe(false)
  })
})

describe('updateCustomerSchema', () => {
  it('needs a status and a version', () => {
    expect(updateCustomerSchema.safeParse({ name: 'A' }).success).toBe(false)
    expect(updateCustomerSchema.safeParse({ name: 'A', status: 'active', version: 0 }).success).toBe(false)
    expect(updateCustomerSchema.safeParse({ name: 'A', status: 'blocked', version: 3 }).success).toBe(true)
  })
})

describe('listCustomersQuerySchema', () => {
  it('applies defaults and caps the page size', () => {
    const parsed = listCustomersQuerySchema.parse({})
    expect(parsed).toMatchObject({ limit: 25, sort: 'name', direction: 'asc' })
    expect(listCustomersQuerySchema.safeParse({ limit: '101' }).success).toBe(false)
    expect(listCustomersQuerySchema.safeParse({ limit: '0' }).success).toBe(false)
    expect(listCustomersQuerySchema.safeParse({ sort: 'password' }).success).toBe(false)
  })

  it('filters by a known status only', () => {
    expect(listCustomersQuerySchema.parse({ status: 'prospect' }).status).toBe('prospect')
    expect(listCustomersQuerySchema.safeParse({ status: 'inactive' }).success).toBe(false)
  })
})
