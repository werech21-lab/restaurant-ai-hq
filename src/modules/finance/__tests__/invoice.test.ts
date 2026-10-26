import { describe, expect, it } from 'vitest'
import { DomainError } from '@/lib/domain-error'
import { CurrencyMismatchError, type Money } from '@/lib/money'
import {
  applyPayment,
  approve,
  assertEditable,
  formatInvoiceNumber,
  requiresApproval,
  submit,
  voidInvoice,
} from '@/modules/finance/domain/invoice'

const THRESHOLD = 5_000_000

function expectDomainCode(fn: () => unknown, code: string) {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe(code)
    return
  }
  throw new Error(`Expected DomainError ${code}`)
}

describe('formatInvoiceNumber', () => {
  it('pads the sequence to six digits', () => {
    expect(formatInvoiceNumber('INV', 1)).toBe('INV-000001')
    expect(formatInvoiceNumber('INV', 42)).toBe('INV-000042')
    expect(formatInvoiceNumber('K', 1234567)).toBe('K-1234567')
  })

  it('rejects zero, negative and fractional sequences', () => {
    expectDomainCode(() => formatInvoiceNumber('INV', 0), 'invalid_sequence')
    expectDomainCode(() => formatInvoiceNumber('INV', -3), 'invalid_sequence')
    expectDomainCode(() => formatInvoiceNumber('INV', 1.5), 'invalid_sequence')
  })
})

describe('approval threshold', () => {
  it('needs approval only when strictly above 5,000.000 KWD', () => {
    expect(requiresApproval(4_999_999, THRESHOLD)).toBe(false)
    expect(requiresApproval(5_000_000, THRESHOLD)).toBe(false)
    expect(requiresApproval(5_000_001, THRESHOLD)).toBe(true)
  })

  it('treats a zero threshold as approval for every positive total', () => {
    expect(requiresApproval(0, 0)).toBe(false)
    expect(requiresApproval(1, 0)).toBe(true)
  })
})

describe('submit', () => {
  it('issues a draft within the threshold', () => {
    expect(submit({ status: 'draft', totalMinor: 5_000_000, lineCount: 1 }, THRESHOLD)).toEqual({
      status: 'issued',
      requiresApproval: false,
    })
  })

  it('sends a draft above the threshold to approval', () => {
    expect(submit({ status: 'draft', totalMinor: 5_000_001, lineCount: 2 }, THRESHOLD)).toEqual({
      status: 'pending_approval',
      requiresApproval: true,
    })
  })

  it('rejects an empty invoice and a zero total', () => {
    expectDomainCode(() => submit({ status: 'draft', totalMinor: 0, lineCount: 0 }, THRESHOLD), 'empty_invoice')
    expectDomainCode(() => submit({ status: 'draft', totalMinor: 0, lineCount: 1 }, THRESHOLD), 'zero_total')
  })

  it('rejects a negative total', () => {
    expectDomainCode(() => submit({ status: 'draft', totalMinor: -1, lineCount: 1 }, THRESHOLD), 'zero_total')
  })

  it('rejects submitting anything that is not a draft', () => {
    for (const status of ['pending_approval', 'issued', 'partially_paid', 'paid', 'void'] as const) {
      expectDomainCode(() => submit({ status, totalMinor: 100, lineCount: 1 }, THRESHOLD), 'invalid_transition')
    }
  })
})

describe('approve', () => {
  it('issues an invoice that is pending approval', () => {
    expect(approve({ status: 'pending_approval' })).toEqual({ status: 'issued' })
  })

  it('rejects every other status', () => {
    for (const status of ['draft', 'issued', 'partially_paid', 'paid', 'void'] as const) {
      expectDomainCode(() => approve({ status }), 'invalid_transition')
    }
  })
})

describe('assertEditable', () => {
  it('allows drafts only', () => {
    expect(() => assertEditable({ status: 'draft' })).not.toThrow()
    expectDomainCode(() => assertEditable({ status: 'issued' }), 'not_editable')
    expectDomainCode(() => assertEditable({ status: 'pending_approval' }), 'not_editable')
  })
})

describe('voidInvoice', () => {
  it('voids draft, pending and unpaid issued invoices', () => {
    for (const status of ['draft', 'pending_approval', 'issued'] as const) {
      expect(voidInvoice({ status, paidMinor: 0 }, 'Entered twice')).toEqual({ status: 'void' })
    }
  })

  it('refuses once any payment exists', () => {
    expectDomainCode(() => voidInvoice({ status: 'partially_paid', paidMinor: 100 }, 'x'), 'cannot_void')
    expectDomainCode(() => voidInvoice({ status: 'paid', paidMinor: 100 }, 'x'), 'cannot_void')
  })

  it('refuses a second void and an empty reason', () => {
    expectDomainCode(() => voidInvoice({ status: 'void', paidMinor: 0 }, 'x'), 'invalid_transition')
    expectDomainCode(() => voidInvoice({ status: 'draft', paidMinor: 0 }, '   '), 'reason_required')
  })
})

describe('applyPayment', () => {
  const invoice = { status: 'issued', totalMinor: 10_000, paidMinor: 0, currency: 'KWD' } as const
  const pay = (amountMinor: number): Money => ({ amountMinor, currency: 'KWD' })

  it('moves to partially paid, then to paid', () => {
    const first = applyPayment(invoice, pay(4_000))
    expect(first).toEqual({ paidMinor: 4_000, balanceMinor: 6_000, status: 'partially_paid' })
    const second = applyPayment({ ...invoice, status: first.status, paidMinor: first.paidMinor }, pay(6_000))
    expect(second).toEqual({ paidMinor: 10_000, balanceMinor: 0, status: 'paid' })
  })

  it('accepts a payment of the exact full balance', () => {
    expect(applyPayment(invoice, pay(10_000)).status).toBe('paid')
  })

  it('rejects zero, negative, fractional and oversized payments', () => {
    expectDomainCode(() => applyPayment(invoice, pay(0)), 'payment_not_positive')
    expectDomainCode(() => applyPayment(invoice, pay(-5)), 'payment_not_positive')
    expectDomainCode(() => applyPayment(invoice, pay(0.5)), 'payment_not_positive')
    expectDomainCode(() => applyPayment(invoice, pay(10_001)), 'payment_exceeds_balance')
  })

  it('rejects a currency mismatch', () => {
    const usd = { amountMinor: 100, currency: 'USD' } as unknown as Money
    expect(() => applyPayment(invoice, usd)).toThrow(CurrencyMismatchError)
  })

  it('rejects payments on invoices that cannot take them', () => {
    for (const status of ['draft', 'pending_approval', 'paid', 'void'] as const) {
      expectDomainCode(() => applyPayment({ ...invoice, status }, pay(100)), 'invalid_transition')
    }
  })
})
