import { describe, expect, it } from 'vitest'
import { DomainError } from '@/lib/domain-error'
import { buildCollectionLines, buildCommissionLines, buildConsumptionLines, buildRevenueLines } from '@/modules/finance/domain/operational-posting'

const cash = '10000000-0000-4000-8000-000000000001'
const receivable = '10000000-0000-4000-8000-000000000002'
const inventory = '10000000-0000-4000-8000-000000000003'
const cost = '10000000-0000-4000-8000-000000000004'
const expense = '10000000-0000-4000-8000-000000000005'
const revenue = '10000000-0000-4000-8000-000000000006'

describe('operational journals', () => {
  it('balances a customer collection as debit cash and credit receivable', () => {
    const lines = buildCollectionLines(6_000, cash, receivable, 'Collection')
    expect(lines).toEqual([
      { accountId: cash, debitMinor: 6_000, creditMinor: 0, description: 'Collection' },
      { accountId: receivable, debitMinor: 0, creditMinor: 6_000, description: 'Collection' },
    ])
    expect(lines.reduce((sum, line) => sum + line.debitMinor - line.creditMinor, 0)).toBe(0)
  })

  it('balances kitchen consumption as debit cost and credit inventory', () => {
    const lines = buildConsumptionLines(1_000, cost, inventory, 'Waste')
    expect(lines[0]).toMatchObject({ accountId: cost, debitMinor: 1_000, creditMinor: 0 })
    expect(lines[1]).toMatchObject({ accountId: inventory, debitMinor: 0, creditMinor: 1_000 })
  })

  it('balances a delivery commission as debit expense and credit cash', () => {
    const lines = buildCommissionLines(500, expense, cash, 'Commission')
    expect(lines[0]).toMatchObject({ accountId: expense, debitMinor: 500, creditMinor: 0 })
    expect(lines[1]).toMatchObject({ accountId: cash, debitMinor: 0, creditMinor: 500 })
  })

  it('balances a sales invoice as debit receivable and credit sales revenue', () => {
    const lines = buildRevenueLines(6_000, receivable, revenue, 'Sales INV-000001')
    expect(lines).toEqual([
      { accountId: receivable, debitMinor: 6_000, creditMinor: 0, description: 'Sales INV-000001' },
      { accountId: revenue, debitMinor: 0, creditMinor: 6_000, description: 'Sales INV-000001' },
    ])
    expect(lines.reduce((sum, line) => sum + line.debitMinor - line.creditMinor, 0)).toBe(0)
  })

  it('rejects a zero amount and an amount above the line limit', () => {
    expect(() => buildCollectionLines(0, cash, receivable, 'x')).toThrow(DomainError)
    expect(() => buildCommissionLines(-1, expense, cash, 'x')).toThrow(DomainError)
    expect(() => buildConsumptionLines(1_000_000_000_001, cost, inventory, 'x')).toThrow(DomainError)
    expect(() => buildRevenueLines(0, receivable, revenue, 'x')).toThrow(DomainError)
  })
})
