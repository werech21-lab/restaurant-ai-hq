import { describe, expect, it } from 'vitest'
import { conflictDomainCodes, DomainError } from '@/lib/domain-error'
import { buildActivity } from '@/modules/crm/domain/activity'
import {
  assertLeadEditable,
  assertStageMove,
  isClosedStage,
  probabilityAfterMove,
  summarizeStages,
} from '@/modules/crm/domain/lead'
import {
  addDays,
  assertCanAccept,
  assertCanConvert,
  assertCanExpire,
  assertCanSend,
  assertEditable,
  assertTransition,
  assertValidUntil,
  assertWithinCreditLimit,
  canTransition,
  effectiveStatus,
  formatQuoteNumber,
  invoiceDates,
  isPastValidity,
  toInvoiceLines,
  utcDate,
} from '@/modules/crm/domain/quotation'
import { leadStages, quotationStatuses, type Lead, type Quotation, type QuotationLine } from '@/modules/crm/domain/types'

function codeOf(fn: () => void): string | null {
  try {
    fn()
    return null
  } catch (error) {
    return error instanceof DomainError ? error.code : 'other'
  }
}

describe('lead stage rules', () => {
  it('lets open stages move in any direction', () => {
    const open = ['new', 'contacted', 'qualified', 'proposal'] as const
    for (const from of open) {
      for (const to of [...open, 'won', 'lost'] as const) {
        if (from !== to) expect(codeOf(() => assertStageMove(from, to))).toBeNull()
      }
    }
  })

  it('refuses any move out of won or lost, and a move to the same stage', () => {
    for (const from of ['won', 'lost'] as const) {
      for (const to of leadStages) expect(codeOf(() => assertStageMove(from, to))).toBe('invalid_transition')
    }
    expect(codeOf(() => assertStageMove('new', 'new'))).toBe('invalid_transition')
  })

  it('knows which stages are closed and refuses to edit a closed lead', () => {
    expect(leadStages.filter(isClosedStage)).toEqual(['won', 'lost'])
    expect(codeOf(() => assertLeadEditable('proposal'))).toBeNull()
    expect(codeOf(() => assertLeadEditable('won'))).toBe('not_editable')
    expect(codeOf(() => assertLeadEditable('lost'))).toBe('not_editable')
  })

  it('forces probability to 100 when won and 0 when lost, otherwise keeps it', () => {
    expect(probabilityAfterMove('won', 35)).toBe(100)
    expect(probabilityAfterMove('lost', 80)).toBe(0)
    expect(probabilityAfterMove('qualified', 35)).toBe(35)
    expect(probabilityAfterMove('new', 0)).toBe(0)
  })

  it('summarises every stage, in order, including empty ones, as a plain sum', () => {
    const summary = summarizeStages([
      { stage: 'new', expectedRevenueMinor: 1_500 },
      { stage: 'new', expectedRevenueMinor: 2_500 },
      { stage: 'won', expectedRevenueMinor: 10_000 },
    ])
    expect(summary.map((entry) => entry.stage)).toEqual([...leadStages])
    expect(summary[0]).toEqual({ stage: 'new', count: 2, expectedRevenueMinor: 4_000 })
    expect(summary[1]).toEqual({ stage: 'contacted', count: 0, expectedRevenueMinor: 0 })
    expect(summary[4]).toEqual({ stage: 'won', count: 1, expectedRevenueMinor: 10_000 })
    expect(summarizeStages([]).every((entry) => entry.count === 0 && entry.expectedRevenueMinor === 0)).toBe(true)
  })
})

describe('quotation status machine', () => {
  const allowed: Array<[string, string]> = [
    ['draft', 'sent'],
    ['sent', 'accepted'],
    ['sent', 'rejected'],
    ['sent', 'expired'],
    ['accepted', 'converted'],
  ]

  it('allows exactly the documented moves and no others', () => {
    for (const from of quotationStatuses) {
      for (const to of quotationStatuses) {
        const expected = allowed.some(([a, b]) => a === from && b === to)
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected)
      }
    }
  })

  it('treats rejected, expired and converted as final', () => {
    for (const from of ['rejected', 'expired', 'converted'] as const) {
      for (const to of quotationStatuses) expect(codeOf(() => assertTransition(from, to))).toBe('invalid_transition')
    }
  })

  it('only a draft is editable', () => {
    expect(codeOf(() => assertEditable({ status: 'draft' }))).toBeNull()
    for (const status of quotationStatuses.filter((value) => value !== 'draft')) {
      expect(codeOf(() => assertEditable({ status }))).toBe('not_editable')
    }
  })

  it('converts only an accepted quotation', () => {
    expect(codeOf(() => assertCanConvert({ status: 'accepted' }))).toBeNull()
    for (const status of quotationStatuses.filter((value) => value !== 'accepted')) {
      expect(codeOf(() => assertCanConvert({ status }))).toBe('invalid_transition')
    }
  })
})

describe('quotation validity', () => {
  const today = '2026-06-15'

  it('is valid through the valid-until day and past from the next day', () => {
    expect(isPastValidity('2026-06-15', today)).toBe(false)
    expect(isPastValidity('2026-06-14', today)).toBe(true)
    expect(isPastValidity('2026-06-16', today)).toBe(false)
  })

  it('shows a sent quotation past its date as expired, and no other status', () => {
    expect(effectiveStatus({ status: 'sent', validUntil: '2026-06-14' }, today)).toBe('expired')
    expect(effectiveStatus({ status: 'sent', validUntil: '2026-06-15' }, today)).toBe('sent')
    expect(effectiveStatus({ status: 'accepted', validUntil: '2020-01-01' }, today)).toBe('accepted')
    expect(effectiveStatus({ status: 'draft', validUntil: '2020-01-01' }, today)).toBe('draft')
    expect(effectiveStatus({ status: 'converted', validUntil: '2020-01-01' }, today)).toBe('converted')
  })

  it('refuses a past valid-until date', () => {
    expect(codeOf(() => assertValidUntil('2026-06-15', today))).toBeNull()
    expect(codeOf(() => assertValidUntil('2026-06-14', today))).toBe('invalid_valid_until')
  })

  it('cannot send a quotation that is already past its date', () => {
    expect(codeOf(() => assertCanSend({ status: 'draft', validUntil: '2026-06-15' }, today))).toBeNull()
    expect(codeOf(() => assertCanSend({ status: 'draft', validUntil: '2026-06-14' }, today))).toBe('invalid_valid_until')
    expect(codeOf(() => assertCanSend({ status: 'sent', validUntil: '2026-06-20' }, today))).toBe('invalid_transition')
  })

  it('cannot accept an expired quotation, with a conflict code', () => {
    expect(codeOf(() => assertCanAccept({ status: 'sent', validUntil: '2026-06-15' }, today))).toBeNull()
    expect(codeOf(() => assertCanAccept({ status: 'sent', validUntil: '2026-06-14' }, today))).toBe('quote_expired')
    expect(codeOf(() => assertCanAccept({ status: 'draft', validUntil: '2026-06-30' }, today))).toBe('invalid_transition')
  })

  it('can mark expired only when really past the date', () => {
    expect(codeOf(() => assertCanExpire({ status: 'sent', validUntil: '2026-06-14' }, today))).toBeNull()
    expect(codeOf(() => assertCanExpire({ status: 'sent', validUntil: '2026-06-15' }, today))).toBe('invalid_transition')
    expect(codeOf(() => assertCanExpire({ status: 'accepted', validUntil: '2026-06-01' }, today))).toBe('invalid_transition')
  })
})

describe('dates and numbers', () => {
  it('adds days in UTC across month, year and leap boundaries', () => {
    expect(addDays('2026-01-01', 30)).toBe('2026-01-31')
    expect(addDays('2026-01-15', 30)).toBe('2026-02-14')
    expect(addDays('2026-12-15', 30)).toBe('2027-01-14')
    expect(addDays('2028-02-01', 30)).toBe('2028-03-02')
    expect(addDays('2027-02-01', 30)).toBe('2027-03-03')
  })

  it('formats UTC dates and the invoice dates (due net 30)', () => {
    expect(utcDate(new Date('2026-03-01T23:59:59Z'))).toBe('2026-03-01')
    expect(utcDate(new Date('2026-03-02T00:00:00Z'))).toBe('2026-03-02')
    expect(invoiceDates('2026-03-01')).toEqual({ issueDate: '2026-03-01', dueDate: '2026-03-31' })
  })

  it('formats quotation numbers and rejects bad sequences', () => {
    expect(formatQuoteNumber(1)).toBe('QT-000001')
    expect(formatQuoteNumber(123_456)).toBe('QT-123456')
    expect(formatQuoteNumber(1_234_567)).toBe('QT-1234567')
    expect(codeOf(() => formatQuoteNumber(0))).toBe('invalid_sequence')
    expect(codeOf(() => formatQuoteNumber(-3))).toBe('invalid_sequence')
    expect(codeOf(() => formatQuoteNumber(1.5))).toBe('invalid_sequence')
  })
})

describe('HTTP mapping of the CRM domain codes', () => {
  it('answers 409 for the state conflicts and 422 for plain validation failures', () => {
    for (const code of [
      'invalid_transition',
      'not_editable',
      'insufficient_stock',
      'credit_limit_exceeded',
      'customer_not_active',
      'quote_expired',
    ]) {
      expect(conflictDomainCodes.has(code), code).toBe(true)
    }
    for (const code of ['invalid_valid_until', 'customer_blocked', 'lead_closed', 'lead_customer_mismatch', 'customer_not_found']) {
      expect(conflictDomainCodes.has(code), code).toBe(false)
    }
  })
})

describe('credit limit', () => {
  const check = (creditLimitMinor: number | null, openBalanceMinor: number, newTotalMinor: number) => () =>
    assertWithinCreditLimit({ creditLimitMinor, openBalanceMinor, newTotalMinor })

  it('has no limit when the limit is null', () => {
    expect(codeOf(check(null, 999_999_999_999, 1))).toBeNull()
  })

  it('allows exactly the limit and refuses one fil above it', () => {
    expect(codeOf(check(10_000, 4_000, 6_000))).toBeNull()
    expect(codeOf(check(10_000, 4_000, 6_001))).toBe('credit_limit_exceeded')
  })

  it('treats a zero limit as no credit, but a zero-value invoice with no balance passes', () => {
    expect(codeOf(check(0, 0, 1))).toBe('credit_limit_exceeded')
    expect(codeOf(check(0, 0, 0))).toBeNull()
  })

  it('counts an open balance that is already over the limit', () => {
    expect(codeOf(check(5_000, 5_001, 0))).toBe('credit_limit_exceeded')
  })
})

describe('toInvoiceLines', () => {
  const line = (position: number, overrides: Partial<QuotationLine> = {}): QuotationLine => ({
    id: `line-${position}`,
    position,
    itemId: null,
    warehouseId: null,
    description: `Line ${position}`,
    quantity: 2,
    unitPriceMinor: 1_250,
    taxRateBps: 500,
    lineNetMinor: 2_500,
    ...overrides,
  })

  it('copies every field in position order and keeps the stock pair', () => {
    const result = toInvoiceLines([line(2, { itemId: 'item-1', warehouseId: 'wh-1' }), line(1)])
    expect(result).toEqual([
      { description: 'Line 1', quantity: 2, unitPriceMinor: 1_250, taxRateBps: 500, itemId: null, warehouseId: null },
      { description: 'Line 2', quantity: 2, unitPriceMinor: 1_250, taxRateBps: 500, itemId: 'item-1', warehouseId: 'wh-1' },
    ])
  })

  it('does not change the input', () => {
    const input = [line(2), line(1)]
    toInvoiceLines(input)
    expect(input.map((entry) => entry.position)).toEqual([2, 1])
  })
})

describe('buildActivity', () => {
  const quotation = (overrides: Partial<Quotation>): Quotation => ({
    id: 'q1',
    quoteNumber: 'QT-000001',
    customerId: 'c1',
    customerName: 'Al Noor',
    leadId: null,
    status: 'draft',
    currency: 'KWD',
    validUntil: '2026-12-31',
    notes: null,
    subtotalMinor: 1_000,
    taxMinor: 50,
    totalMinor: 1_050,
    invoiceId: null,
    sentAt: null,
    acceptedAt: null,
    convertedAt: null,
    version: 1,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    createdBy: 'u1',
    ...overrides,
  })
  const lead = (overrides: Partial<Lead>): Lead => ({
    id: 'l1',
    customerId: 'c1',
    customerName: 'Al Noor',
    title: 'Catering',
    stage: 'new',
    expectedRevenueMinor: 9_000,
    currency: 'KWD',
    probability: 20,
    assignedTo: null,
    expectedCloseDate: null,
    notes: null,
    version: 1,
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
    createdBy: 'u1',
    ...overrides,
  })

  it('merges quotations, leads and finance into one newest-first list', () => {
    const entries = buildActivity({
      quotations: [
        quotation({
          status: 'converted',
          sentAt: '2026-01-02T10:00:00.000Z',
          acceptedAt: '2026-01-03T10:00:00.000Z',
          convertedAt: '2026-01-04T10:00:00.000Z',
        }),
      ],
      leads: [lead({ stage: 'won', updatedAt: '2026-01-04T10:00:00.000Z' })],
      financials: {
        totalInvoicedMinor: 1_050,
        openBalanceMinor: 1_050,
        overdueMinor: 0,
        invoiceCount: 1,
        recentInvoices: [],
        recentPayments: [
          { id: 'p1', invoiceId: 'i1', invoiceNumber: 'INV-000001', amountMinor: 500, paidAt: '2026-01-05T10:00:00.000Z' },
        ],
      },
    })
    expect(entries.map((entry) => `${entry.kind}:${entry.action}`)).toEqual([
      'payment:recorded',
      'quotation:converted',
      'lead:won',
      'quotation:accepted',
      'quotation:sent',
      'quotation:created',
      'lead:created',
    ])
    expect(entries[0]).toMatchObject({ reference: 'INV-000001', amountMinor: 500 })
  })

  it('uses the update time for a rejected or expired quotation and skips finance when it is null', () => {
    const entries = buildActivity({
      quotations: [quotation({ status: 'rejected', sentAt: '2026-01-02T10:00:00.000Z', updatedAt: '2026-01-06T10:00:00.000Z' })],
      leads: [],
      financials: null,
    })
    expect(entries[0]).toMatchObject({ action: 'rejected', at: '2026-01-06T10:00:00.000Z' })
    expect(entries.some((entry) => entry.kind === 'payment' || entry.kind === 'invoice')).toBe(false)
  })

  it('is empty with nothing to show and capped at 30 entries', () => {
    expect(buildActivity({ quotations: [], leads: [], financials: null })).toEqual([])
    const many = Array.from({ length: 20 }, (_, index) =>
      quotation({ id: `q${index}`, createdAt: `2026-02-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`, status: 'sent', sentAt: `2026-03-${String(index + 1).padStart(2, '0')}T10:00:00.000Z` })
    )
    expect(buildActivity({ quotations: many, leads: [], financials: null })).toHaveLength(30)
  })
})
