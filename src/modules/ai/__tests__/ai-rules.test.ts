import { describe, expect, it } from 'vitest'
import {
  bpsOf,
  coverDays,
  evaluateCreditHold,
  evaluateDiscountIncentive,
  evaluateFastDepleting,
  evaluateLowStock,
  evaluateMarginFloor,
  evaluatePaymentReminder,
  evaluateStalledLeads,
  marginBps,
  planRestock,
  priceForMargin,
} from '@/modules/ai/domain/rules'
import { parseThresholds } from '@/modules/ai/domain/thresholds'
import type { StalledLead } from '@/modules/crm/client'
import type { ReceivableSignal } from '@/modules/finance/client'
import type { StockSignal } from '@/modules/inventory/client'

const ITEM = '11111111-1111-4111-8111-111111111111'
const WAREHOUSE = '22222222-2222-4222-8222-222222222222'
const CUSTOMER = '33333333-3333-4333-8333-333333333333'
const LEAD = '44444444-4444-4444-8444-444444444444'
const QUOTE = '55555555-5555-4555-8555-555555555555'
const INVOICE = '66666666-6666-4666-8666-666666666666'

const lowStock = parseThresholds('inventory.low_stock', {})
const fastDepleting = parseThresholds('inventory.fast_depleting', {})
const reminder = parseThresholds('finance.payment_reminder', {})
const creditHold = parseThresholds('finance.credit_hold', {})
const margin = parseThresholds('finance.margin_floor', {})
const stalled = parseThresholds('crm.stalled_leads', {})
const discount = parseThresholds('crm.discount_incentive', {})

function ok<T>(parsed: { ok: true; value: T } | { ok: false; message: string }): T {
  if (!parsed.ok) throw new Error(parsed.message)
  return parsed.value
}

function signal(overrides: Partial<StockSignal> = {}): StockSignal {
  return {
    itemId: ITEM,
    sku: 'COLA',
    name: 'كولا',
    unit: 'piece',
    currentStock: 5,
    reorderLevel: 10,
    unitCostMinor: 500,
    sellingPriceMinor: 1_000,
    version: 1,
    outQuantity: 0,
    restockWarehouse: { id: WAREHOUSE, code: 'MAIN', name: 'Main' },
    ...overrides,
  }
}

function receivable(overrides: Partial<ReceivableSignal> = {}): ReceivableSignal {
  return {
    customerId: CUSTOMER,
    customerName: 'شركة النور',
    overdueMinor: 2_000_000,
    overdueInvoiceCount: 1,
    oldestDaysOverdue: 10,
    invoices: [{ id: INVOICE, number: 'INV-000001', dueDate: '2026-01-01', balanceMinor: 2_000_000, daysOverdue: 10 }],
    ...overrides,
  }
}

function lead(overrides: Partial<StalledLead> = {}): StalledLead {
  return {
    leadId: LEAD,
    title: 'عقد توريد',
    stage: 'proposal',
    probability: 70,
    expectedRevenueMinor: 5_000_000,
    daysStalled: 20,
    customerId: CUSTOMER,
    customerName: 'شركة النور',
    customerStatus: 'active',
    customerPhone: null,
    draftQuotation: { id: QUOTE, quoteNumber: 'QT-000001', version: 3, subtotalMinor: 10_000, totalMinor: 10_500 },
    ...overrides,
  }
}

describe('planRestock', () => {
  const params = { restockMultiplier: 2, targetCoverDays: 30, windowDays: 30 }

  it('aims for twice the reorder level and prices the order at unit cost', () => {
    expect(planRestock(signal(), params)).toEqual({ quantity: 15, targetStock: 20, totalCostMinor: 7_500 })
  })

  it('aims for the days of cover when sales ask for more than the reorder level', () => {
    // 90 sold in 30 days is 3 a day, so 30 days of cover is 90 units.
    expect(planRestock(signal({ outQuantity: 90 }), params)).toEqual({ quantity: 85, targetStock: 90, totalCostMinor: 42_500 })
  })

  it('rounds the cover target up, never down', () => {
    // 31 sold in 30 days, cover for 30 days is exactly 31. 1 sold in 30 days, cover for 10 days is 1/3, so 1.
    expect(planRestock(signal({ reorderLevel: 0, currentStock: 0, outQuantity: 31 }), params)?.quantity).toBe(31)
    expect(
      planRestock(signal({ reorderLevel: 0, currentStock: 0, outQuantity: 1 }), { ...params, targetCoverDays: 10 })?.quantity
    ).toBe(1)
  })

  it('has nothing to order with no reorder level and no sales', () => {
    expect(planRestock(signal({ reorderLevel: 0, currentStock: 0 }), params)).toBeNull()
  })

  it('has nothing to order when stock already reaches the target', () => {
    expect(planRestock(signal({ currentStock: 20, reorderLevel: 10 }), params)).toBeNull()
    expect(planRestock(signal({ currentStock: 21, reorderLevel: 10 }), params)).toBeNull()
  })

  it('stays inside the per-movement limit and the stock ceiling', () => {
    expect(planRestock(signal({ currentStock: 0, reorderLevel: 900_000 }), { ...params, restockMultiplier: 20 })?.quantity).toBe(1_000_000)
    expect(planRestock(signal({ currentStock: 99_999_999, reorderLevel: 100_000_000 }), params)?.quantity).toBe(1)
    expect(planRestock(signal({ currentStock: 100_000_000, reorderLevel: 100_000_000 }), params)).toBeNull()
  })

  it('costs nothing when the unit cost is zero', () => {
    expect(planRestock(signal({ unitCostMinor: 0 }), params)?.totalCostMinor).toBe(0)
  })
})

describe('coverDays', () => {
  it('rounds down and is null with no sales', () => {
    expect(coverDays(30, 90, 30)).toBe(10)
    expect(coverDays(41, 90, 30)).toBe(13)
    expect(coverDays(0, 90, 30)).toBe(0)
    expect(coverDays(30, 0, 30)).toBeNull()
  })
})

describe('evaluateLowStock', () => {
  const t = ok(lowStock)

  it('flags an item at its reorder level and not above it', () => {
    expect(evaluateLowStock([signal({ currentStock: 10 })], t)).toHaveLength(1)
    expect(evaluateLowStock([signal({ currentStock: 11 })], t)).toHaveLength(0)
  })

  it('proposes a restock with the quantity, cost and a negative impact', () => {
    const [finding] = evaluateLowStock([signal()], t)
    expect(finding.fingerprint).toBe(`inventory.low_stock:${ITEM}`)
    expect(finding.insight).toMatchObject({ severity: 'warning', category: 'inventory', metricValue: 5, metricUnit: 'count', sourceEntityType: 'item' })
    expect(finding.proposal).toMatchObject({ actionType: 'auto_reorder', estimatedImpactFils: -7_500 })
    expect(finding.proposal?.payload).toMatchObject({
      itemId: ITEM,
      warehouseId: WAREHOUSE,
      quantity: 15,
      totalCostMinor: 7_500,
      targetStock: 20,
      windowDays: 30,
    })
  })

  it('is critical with no stock left', () => {
    const [finding] = evaluateLowStock([signal({ currentStock: 0 })], t)
    expect(finding.insight.severity).toBe('critical')
    expect(finding.insight.titleAr).toContain('نفد')
  })

  it('gives an insight but no proposal when there is no active warehouse to receive stock', () => {
    const [finding] = evaluateLowStock([signal({ restockWarehouse: null })], t)
    expect(finding.proposal).toBeNull()
    expect(finding.insight.descriptionAr).toContain('لا يوجد مستودع نشط')
  })

  it('never reports a negative zero impact', () => {
    const [finding] = evaluateLowStock([signal({ unitCostMinor: 0 })], t)
    expect(Object.is(finding.proposal?.estimatedImpactFils, 0)).toBe(true)
  })
})

describe('evaluateFastDepleting', () => {
  const t = ok(fastDepleting)

  it('flags stock that lasts fewer days than the threshold, and not exactly the threshold', () => {
    // 90 sold in 30 days is 3 a day. 14 days of cover is 42 units.
    expect(evaluateFastDepleting([signal({ currentStock: 41, reorderLevel: 5, outQuantity: 90 })], t)).toHaveLength(1)
    expect(evaluateFastDepleting([signal({ currentStock: 42, reorderLevel: 5, outQuantity: 90 })], t)).toHaveLength(0)
  })

  it('reports the days left as the metric', () => {
    const [finding] = evaluateFastDepleting([signal({ currentStock: 30, reorderLevel: 5, outQuantity: 90 })], t)
    expect(finding.insight).toMatchObject({ metricValue: 10, metricUnit: 'days', severity: 'warning' })
    expect(finding.proposal?.actionType).toBe('auto_reorder')
  })

  it('leaves items that are already low, or not selling, to other rules', () => {
    expect(evaluateFastDepleting([signal({ currentStock: 5, reorderLevel: 10, outQuantity: 90 })], t)).toHaveLength(0)
    expect(evaluateFastDepleting([signal({ currentStock: 30, reorderLevel: 5, outQuantity: 0 })], t)).toHaveLength(0)
  })
})

describe('evaluatePaymentReminder', () => {
  const t = ok(reminder)

  it('needs the overdue amount and age to reach the thresholds', () => {
    expect(evaluatePaymentReminder([receivable({ overdueMinor: 1_000_000 })], t)).toHaveLength(1)
    expect(evaluatePaymentReminder([receivable({ overdueMinor: 999_999 })], t)).toHaveLength(0)
    expect(evaluatePaymentReminder([receivable({ oldestDaysOverdue: 7 })], t)).toHaveLength(1)
    expect(evaluatePaymentReminder([receivable({ oldestDaysOverdue: 6 })], t)).toHaveLength(0)
  })

  it('raises a critical finance alert with a positive collection impact', () => {
    const [finding] = evaluatePaymentReminder([receivable()], t)
    expect(finding.insight).toMatchObject({ severity: 'critical', category: 'finance', metricValue: 2_000_000, metricUnit: 'fils', sourceEntityType: 'customer' })
    expect(finding.proposal).toMatchObject({ actionType: 'payment_reminder', estimatedImpactFils: 2_000_000 })
    expect(finding.fingerprint).toBe(`finance.payment_reminder:${CUSTOMER}`)
  })

  it('ignores a customer with nothing overdue even when the threshold is zero', () => {
    const none = ok(parseThresholds('finance.payment_reminder', { minOverdueMinor: 0, minOverdueDays: 1 }))
    expect(evaluatePaymentReminder([receivable({ overdueMinor: 0 })], none)).toHaveLength(0)
  })
})

describe('evaluateCreditHold', () => {
  const t = ok(creditHold)

  it('needs 30 days overdue by default', () => {
    expect(evaluateCreditHold([receivable({ oldestDaysOverdue: 30 })], new Set(), t)).toHaveLength(1)
    expect(evaluateCreditHold([receivable({ oldestDaysOverdue: 29 })], new Set(), t)).toHaveLength(0)
  })

  it('skips customers that are already blocked', () => {
    expect(evaluateCreditHold([receivable({ oldestDaysOverdue: 40 })], new Set([CUSTOMER]), t)).toHaveLength(0)
  })

  it('proposes the hold with the exposed amount as the impact', () => {
    const [finding] = evaluateCreditHold([receivable({ oldestDaysOverdue: 40 })], new Set(), t)
    expect(finding.proposal).toMatchObject({ actionType: 'credit_hold', estimatedImpactFils: 2_000_000 })
    expect(finding.insight.severity).toBe('critical')
  })
})

describe('margin', () => {
  it('rounds the margin down, also below zero', () => {
    expect(marginBps(1_000, 800)).toBe(2_000)
    expect(marginBps(999, 800)).toBe(1_991)
    expect(marginBps(700, 800)).toBe(-1_429)
    expect(marginBps(0, 500)).toBeNull()
  })

  it('finds the lowest price that reaches the floor, rounded up', () => {
    expect(priceForMargin(800, 2_000)).toBe(1_000)
    expect(priceForMargin(801, 2_000)).toBe(1_002)
    expect(priceForMargin(900_000_000, 2_000)).toBeNull()
  })
})

describe('evaluateMarginFloor', () => {
  const t = ok(margin)

  it('flags only a margin strictly below the floor', () => {
    expect(evaluateMarginFloor([signal({ sellingPriceMinor: 1_000, unitCostMinor: 800 })], t)).toHaveLength(0)
    expect(evaluateMarginFloor([signal({ sellingPriceMinor: 999, unitCostMinor: 800 })], t)).toHaveLength(1)
    expect(evaluateMarginFloor([signal({ sellingPriceMinor: 1_000, unitCostMinor: 0 })], t)).toHaveLength(0)
  })

  it('proposes the floor price and values it on the window volume', () => {
    const [finding] = evaluateMarginFloor([signal({ sellingPriceMinor: 900, unitCostMinor: 800, outQuantity: 50 })], t)
    expect(finding.insight).toMatchObject({ severity: 'warning', metricUnit: 'bps', metricValue: 1_111 })
    expect(finding.proposal).toMatchObject({ actionType: 'price_adjustment', estimatedImpactFils: 5_000 })
    expect(finding.proposal?.payload).toMatchObject({ currentPriceMinor: 900, newPriceMinor: 1_000, newMarginBps: 2_000, currentMarginBps: 1_111 })
  })

  it('is critical when the item sells at or below cost', () => {
    const [below] = evaluateMarginFloor([signal({ sellingPriceMinor: 700, unitCostMinor: 800 })], t)
    expect(below.insight.severity).toBe('critical')
    expect(below.insight.titleAr).toContain('بخسارة')
    const [equal] = evaluateMarginFloor([signal({ sellingPriceMinor: 800, unitCostMinor: 800 })], t)
    expect(equal.insight.severity).toBe('critical')
  })

  it('handles a zero price', () => {
    const [finding] = evaluateMarginFloor([signal({ sellingPriceMinor: 0, unitCostMinor: 500 })], t)
    expect(finding.insight.metricValue).toBe(-10_000)
    expect(finding.proposal?.payload).toMatchObject({ currentMarginBps: null, newPriceMinor: 625 })
  })

  it('gives an insight but no proposal when the needed price is above the price limit', () => {
    const [finding] = evaluateMarginFloor([signal({ sellingPriceMinor: 1_000, unitCostMinor: 900_000_000 })], t)
    expect(finding.proposal).toBeNull()
  })
})

describe('bpsOf', () => {
  it('rounds half up', () => {
    expect(bpsOf(1_010, 500)).toBe(51)
    expect(bpsOf(12_345, 500)).toBe(617)
    expect(bpsOf(0, 500)).toBe(0)
  })
})

describe('evaluateStalledLeads', () => {
  const t = ok(stalled)

  it('needs the probability and the quiet period', () => {
    expect(evaluateStalledLeads([lead({ probability: 60 })], t)).toHaveLength(1)
    expect(evaluateStalledLeads([lead({ probability: 59 })], t)).toHaveLength(0)
    expect(evaluateStalledLeads([lead({ daysStalled: 14 })], t)).toHaveLength(1)
    expect(evaluateStalledLeads([lead({ daysStalled: 13 })], t)).toHaveLength(0)
  })

  it('is an opportunity worth the expected revenue', () => {
    const [finding] = evaluateStalledLeads([lead()], t)
    expect(finding.insight).toMatchObject({ severity: 'opportunity', category: 'crm', metricValue: 5_000_000, sourceEntityType: 'lead' })
    expect(finding.proposal).toMatchObject({ actionType: 'lead_followup', estimatedImpactFils: 5_000_000 })
  })

  it('leaves a blocked customer alone', () => {
    expect(evaluateStalledLeads([lead({ customerStatus: 'blocked' })], t)).toHaveLength(0)
  })
})

describe('evaluateDiscountIncentive', () => {
  const t = ok(discount)

  it('needs a draft quotation with a subtotal', () => {
    expect(evaluateDiscountIncentive([lead({ draftQuotation: null })], t)).toHaveLength(0)
    expect(
      evaluateDiscountIncentive([lead({ draftQuotation: { id: QUOTE, quoteNumber: 'QT-1', version: 1, subtotalMinor: 0, totalMinor: 0 } })], t)
    ).toHaveLength(0)
  })

  it('proposes the percentage on the draft, with the discount as a negative impact', () => {
    const [finding] = evaluateDiscountIncentive([lead()], t)
    expect(finding.proposal).toMatchObject({ actionType: 'discount_approval', estimatedImpactFils: -500 })
    expect(finding.proposal?.payload).toMatchObject({ quotationId: QUOTE, quotationVersion: 3, discountBps: 500, estimatedDiscountMinor: 500, subtotalMinor: 10_000 })
    expect(finding.fingerprint).toBe(`crm.discount_incentive:${LEAD}`)
  })

  it('does nothing when the discount rounds to zero', () => {
    const tiny = ok(parseThresholds('crm.discount_incentive', { discountBps: 1 }))
    expect(
      evaluateDiscountIncentive([lead({ draftQuotation: { id: QUOTE, quoteNumber: 'QT-1', version: 1, subtotalMinor: 10, totalMinor: 10 } })], tiny)
    ).toHaveLength(0)
  })
})
