import { describe, expect, it } from 'vitest'
import { permissions } from '@/lib/auth/permissions'
import {
  assertCanDecide,
  canTransition,
  inCooldown,
  isRestockStale,
  missingPermissions,
  underlyingPermissions,
} from '@/modules/ai/domain/approval'
import { normalizeArabic, parseCommand } from '@/modules/ai/domain/command'
import { sameInsight, sameProposal, stableStringify } from '@/modules/ai/domain/compare'
import {
  buildWhatsappUrl,
  formatBps,
  formatCount,
  formatKwd,
  formatPerDay,
  leadFollowupText,
  paymentReminderText,
  toDraftMessage,
} from '@/modules/ai/domain/messages'
import { parseThresholds } from '@/modules/ai/domain/thresholds'
import type { Approval, Insight, InsightDraft, ProposalDraft } from '@/modules/ai/domain/types'
import { canMoveInsight } from '@/modules/ai/services/insight-service'
import { activePipeline, monthlyRevenue } from '@/modules/ai/services/dashboard-service'
import { discountedUnitPrice } from '@/modules/crm/domain/quotation'
import type { InvoiceSummary } from '@/modules/finance/client'

describe('thresholds', () => {
  it('fills every default from an empty condition', () => {
    expect(parseThresholds('inventory.low_stock', {})).toEqual({
      ok: true,
      value: { restockMultiplier: 2, targetCoverDays: 30, windowDays: 30, cooldownDays: 7 },
    })
    expect(parseThresholds('finance.payment_reminder', {})).toEqual({
      ok: true,
      value: { minOverdueDays: 7, minOverdueMinor: 1_000_000, cooldownDays: 7 },
    })
    expect(parseThresholds('finance.margin_floor', {})).toMatchObject({ ok: true, value: { marginFloorBps: 2_000 } })
    expect(parseThresholds('crm.stalled_leads', {})).toMatchObject({ ok: true, value: { minProbability: 60, staleDays: 14 } })
    expect(parseThresholds('inventory.fast_depleting', {})).toMatchObject({ ok: true, value: { coverDays: 14 } })
  })

  it('keeps what is set and defaults the rest', () => {
    expect(parseThresholds('finance.payment_reminder', { minOverdueDays: 14 })).toMatchObject({
      ok: true,
      value: { minOverdueDays: 14, minOverdueMinor: 1_000_000 },
    })
  })

  it('rejects a typo, a fraction and an out-of-range number', () => {
    expect(parseThresholds('finance.payment_reminder', { minOverdueDay: 14 }).ok).toBe(false)
    expect(parseThresholds('finance.payment_reminder', { minOverdueDays: 1.5 }).ok).toBe(false)
    expect(parseThresholds('crm.stalled_leads', { minProbability: 101 }).ok).toBe(false)
    expect(parseThresholds('crm.stalled_leads', { minProbability: 0 }).ok).toBe(false)
    expect(parseThresholds('finance.margin_floor', { marginFloorBps: 10_000 }).ok).toBe(false)
    expect(parseThresholds('inventory.low_stock', 'not an object').ok).toBe(false)
  })
})

describe('approval rules', () => {
  it('moves pending forward only, and never out of a final state', () => {
    expect(canTransition('pending', 'approved')).toBe(true)
    expect(canTransition('pending', 'rejected')).toBe(true)
    expect(canTransition('pending', 'executed')).toBe(true)
    expect(canTransition('approved', 'executed')).toBe(true)
    expect(canTransition('approved', 'rejected')).toBe(false)
    expect(canTransition('rejected', 'executed')).toBe(false)
    expect(canTransition('executed', 'pending')).toBe(false)
    expect(canTransition('executed', 'rejected')).toBe(false)
  })

  it('refuses to decide anything that is not pending', () => {
    expect(() => assertCanDecide('pending')).not.toThrow()
    for (const status of ['approved', 'rejected', 'executed'] as const) {
      expect(() => assertCanDecide(status)).toThrow(/can no longer be decided/)
    }
  })

  it('needs the permission of the underlying action as well', () => {
    expect(underlyingPermissions('auto_reorder')).toEqual([permissions.inventoryStockAdjust])
    expect(underlyingPermissions('price_adjustment')).toEqual([permissions.inventoryItemUpdate])
    expect(underlyingPermissions('discount_approval')).toEqual([permissions.crmQuotationUpdate])
    expect(underlyingPermissions('credit_hold')).toContain(permissions.crmCustomerUpdate)
    expect(missingPermissions('auto_reorder', new Set([permissions.aiActionApprove]))).toEqual([permissions.inventoryStockAdjust])
    expect(missingPermissions('auto_reorder', new Set([permissions.inventoryStockAdjust]))).toEqual([])
  })

  it('keeps a person’s decision in cooldown for exactly the configured days', () => {
    const decided = new Date('2026-01-01T00:00:00Z')
    expect(inCooldown(decided, 7, new Date('2026-01-07T23:59:59Z'))).toBe(true)
    expect(inCooldown(decided, 7, new Date('2026-01-08T00:00:00Z'))).toBe(false)
    expect(inCooldown(decided, 0, new Date('2026-01-01T00:00:00Z'))).toBe(false)
  })

  it('calls a restock stale once the stock reaches its target', () => {
    expect(isRestockStale(19, 20)).toBe(false)
    expect(isRestockStale(20, 20)).toBe(true)
    expect(isRestockStale(0, 20)).toBe(false)
  })

  it('lets an insight move forward but never out of resolved', () => {
    expect(canMoveInsight('open', 'acknowledged')).toBe(true)
    expect(canMoveInsight('open', 'resolved')).toBe(true)
    expect(canMoveInsight('acknowledged', 'resolved')).toBe(true)
    expect(canMoveInsight('acknowledged', 'open')).toBe(false)
    expect(canMoveInsight('resolved', 'open')).toBe(false)
    expect(canMoveInsight('open', 'open')).toBe(false)
  })
})

describe('comparison', () => {
  it('writes the same text for the same value whatever the key order', () => {
    expect(stableStringify({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: null } })).toBe(stableStringify({ a: { c: null, d: [2, { y: 2, z: 1 }] }, b: 1 }))
    expect(stableStringify({ a: 1 })).not.toBe(stableStringify({ a: 2 }))
  })

  const draft: InsightDraft = {
    severity: 'warning',
    category: 'inventory',
    titleAr: 'عنوان',
    descriptionAr: 'وصف',
    metricValue: 5,
    metricUnit: 'count',
    sourceEntityType: 'item',
    sourceEntityId: '11111111-1111-4111-8111-111111111111',
  }
  const insight = { ...draft, id: 'x' } as unknown as Insight

  it('recognises an insight that has not changed', () => {
    expect(sameInsight(insight, draft)).toBe(true)
    expect(sameInsight(insight, { ...draft, metricValue: 6 })).toBe(false)
    expect(sameInsight(insight, { ...draft, severity: 'critical' })).toBe(false)
    expect(sameInsight(insight, { ...draft, descriptionAr: 'وصف آخر' })).toBe(false)
  })

  it('recognises a proposal that has not changed, whatever the payload key order', () => {
    const proposal: ProposalDraft = {
      actionType: 'auto_reorder',
      titleAr: 't',
      summaryAr: 's',
      payload: { b: 1, a: 2 },
      estimatedImpactFils: -10,
    }
    const stored = {
      insightId: 'i',
      actionType: 'auto_reorder',
      titleAr: 't',
      summaryAr: 's',
      payloadJson: { a: 2, b: 1 },
      estimatedImpactFils: -10,
    } as unknown as Approval
    expect(sameProposal(stored, proposal, 'i')).toBe(true)
    expect(sameProposal(stored, proposal, 'other')).toBe(false)
    expect(sameProposal(stored, { ...proposal, estimatedImpactFils: -11 }, 'i')).toBe(false)
    expect(sameProposal(stored, { ...proposal, payload: { a: 2, b: 2 } }, 'i')).toBe(false)
  })
})

describe('Arabic text', () => {
  it('formats fils exactly, with three decimals', () => {
    expect(formatKwd(1_234_500)).toBe('1,234.500 د.ك')
    expect(formatKwd(5)).toBe('0.005 د.ك')
    expect(formatKwd(0)).toBe('0.000 د.ك')
    expect(formatKwd(-1_500)).toBe('-1.500 د.ك')
    expect(formatKwd(999_999_999_999)).toBe('999,999,999.999 د.ك')
  })

  it('formats basis points as a percentage without a float', () => {
    expect(formatBps(2_000)).toBe('20')
    expect(formatBps(250)).toBe('2.5')
    expect(formatBps(5)).toBe('0.05')
    expect(formatBps(1_999)).toBe('19.99')
    expect(formatBps(-150)).toBe('-1.5')
    expect(formatBps(0)).toBe('0')
  })

  it('formats counts and a per-day rate', () => {
    expect(formatCount(1_234_567)).toBe('1,234,567')
    expect(formatPerDay(90, 30)).toBe('3.0')
    expect(formatPerDay(45, 30)).toBe('1.5')
    expect(formatPerDay(1, 30)).toBe('0.0')
    expect(formatPerDay(2, 30)).toBe('0.1')
  })

  it('builds a WhatsApp link from a Kuwaiti or an international number', () => {
    expect(buildWhatsappUrl('55512345', 'مرحبا')).toEqual({
      phone: '96555512345',
      url: `https://wa.me/96555512345?text=${encodeURIComponent('مرحبا')}`,
    })
    expect(buildWhatsappUrl('+965 5551 2345', 'x')?.phone).toBe('96555512345')
    expect(buildWhatsappUrl('00965-5551-2345', 'x')?.phone).toBe('96555512345')
    expect(buildWhatsappUrl('(965) 5551 2345', 'x')?.phone).toBe('96555512345')
  })

  it('makes no link from a missing or unusable number', () => {
    expect(buildWhatsappUrl(null, 'x')).toBeNull()
    expect(buildWhatsappUrl('', 'x')).toBeNull()
    expect(buildWhatsappUrl('123', 'x')).toBeNull()
    expect(buildWhatsappUrl('1234567890123456', 'x')).toBeNull()
    expect(toDraftMessage('نص', null)).toEqual({ textAr: 'نص', phone: null, whatsappUrl: null })
  })

  it('writes the reminder with each invoice and a count of the rest', () => {
    const text = paymentReminderText({
      customerName: 'شركة النور',
      overdueMinor: 2_500_000,
      overdueInvoiceCount: 5,
      invoices: [
        { number: 'INV-000001', balanceMinor: 1_500_000, daysOverdue: 12 },
        { number: 'INV-000002', balanceMinor: 1_000_000, daysOverdue: 8 },
      ],
    })
    expect(text).toContain('السيد/ة شركة النور المحترم/ة')
    expect(text).toContain('5 فاتورة مستحقة السداد بإجمالي 2,500.000 د.ك')
    expect(text).toContain('- INV-000001: 1,500.000 د.ك (متأخرة 12 يومًا)')
    expect(text).toContain('- و3 فواتير أخرى')
  })

  it('writes the follow-up with the customer and the deal', () => {
    const text = leadFollowupText({ customerName: 'شركة النور', leadTitle: 'عقد توريد' })
    expect(text).toContain('شركة النور')
    expect(text).toContain('«عقد توريد»')
  })
})

describe('copilot command parser', () => {
  it('reads the full-scan phrase', () => {
    expect(parseCommand('فحص ذكي شامل للنظام')).toEqual({ scan: true, category: null, severity: null, status: null, text: '' })
    expect(parseCommand('SCAN')).toMatchObject({ scan: true })
    expect(parseCommand('افحص النظام')).toMatchObject({ scan: true })
  })

  it('reads a category with the Arabic article, and a severity', () => {
    expect(parseCommand('الفواتير الحرجة')).toEqual({ scan: false, category: 'finance', severity: 'critical', status: null, text: '' })
    expect(parseCommand('اعرض كل تنبيهات المخزون')).toMatchObject({ category: 'inventory', text: '' })
    expect(parseCommand('عملاء')).toMatchObject({ category: 'crm' })
    expect(parseCommand('critical inventory alerts')).toEqual({ scan: false, category: 'inventory', severity: 'critical', status: null, text: '' })
    expect(parseCommand('تحذيرات المبيعات')).toMatchObject({ category: 'crm', severity: 'warning' })
  })

  it('reads a status', () => {
    expect(parseCommand('مخزون مفتوح')).toMatchObject({ category: 'inventory', status: 'open' })
    expect(parseCommand('resolved')).toMatchObject({ status: 'resolved' })
  })

  it('keeps unknown words, in their own spelling, as the search text', () => {
    expect(parseCommand('عميل أحمد')).toMatchObject({ category: 'crm', text: 'أحمد' })
    expect(parseCommand('INV-000012')).toMatchObject({ category: null, text: 'INV-000012' })
    expect(parseCommand('اذهب الى كولا 330')).toMatchObject({ text: 'كولا 330' })
  })

  it('handles empty and spaced input', () => {
    expect(parseCommand('')).toEqual({ scan: false, category: null, severity: null, status: null, text: '' })
    expect(parseCommand('   ')).toEqual({ scan: false, category: null, severity: null, status: null, text: '' })
  })

  it('normalises Arabic spellings and digits', () => {
    expect(normalizeArabic('أحمد')).toBe('احمد')
    expect(normalizeArabic('مدرسة')).toBe('مدرسه')
    expect(normalizeArabic('فَحْص')).toBe('فحص')
    expect(normalizeArabic('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789')
    expect(normalizeArabic('INV-12')).toBe('inv-12')
  })
})

describe('discounted unit price', () => {
  it('rounds half up to a whole fils', () => {
    expect(discountedUnitPrice(1_500, 500)).toBe(1_425)
    expect(discountedUnitPrice(1_501, 500)).toBe(1_426)
    expect(discountedUnitPrice(3, 5_000)).toBe(2)
    expect(discountedUnitPrice(1, 5_000)).toBe(1)
    expect(discountedUnitPrice(0, 500)).toBe(0)
    expect(discountedUnitPrice(1_000_000_000, 10_000)).toBe(0)
  })

  it('refuses a discount outside 0.01% to 100% and a bad price', () => {
    expect(() => discountedUnitPrice(1_000, 0)).toThrow(/between 0.01% and 100%/)
    expect(() => discountedUnitPrice(1_000, 10_001)).toThrow(/between 0.01% and 100%/)
    expect(() => discountedUnitPrice(1_000, 1.5)).toThrow()
    expect(() => discountedUnitPrice(-1, 500)).toThrow(/not negative/)
    expect(() => discountedUnitPrice(1.5, 500)).toThrow()
  })
})

describe('dashboard numbers', () => {
  const summary = (months: InvoiceSummary['months']): InvoiceSummary => ({
    approvalThresholdMinor: 0,
    countsByStatus: { draft: 0, pending_approval: 0, issued: 0, partially_paid: 0, paid: 0, void: 0 },
    outstandingMinor: 0,
    overdueMinor: 0,
    overdueCount: 0,
    months,
  })

  it('takes the current UTC month and the one before it', () => {
    const months = [
      { month: '2026-08', invoicedMinor: 100, collectedMinor: 0 },
      { month: '2026-09', invoicedMinor: 200, collectedMinor: 0 },
      { month: '2026-10', invoicedMinor: 300, collectedMinor: 0 },
    ]
    expect(monthlyRevenue(summary(months), new Date('2026-10-26T12:00:00Z'))).toEqual({ monthMinor: 300, previousMonthMinor: 200 })
    expect(monthlyRevenue(summary(months), new Date('2026-10-31T23:59:59Z'))).toEqual({ monthMinor: 300, previousMonthMinor: 200 })
  })

  it('is zero when the month is missing or first', () => {
    expect(monthlyRevenue(summary([]), new Date('2026-10-26T00:00:00Z'))).toEqual({ monthMinor: 0, previousMonthMinor: 0 })
    expect(monthlyRevenue(summary([{ month: '2026-10', invoicedMinor: 50, collectedMinor: 0 }]), new Date('2026-10-01T00:00:00Z'))).toEqual({
      monthMinor: 50,
      previousMonthMinor: 0,
    })
  })

  it('adds only the stages still being worked', () => {
    expect(
      activePipeline([
        { stage: 'new', count: 2, expectedRevenueMinor: 1_000 },
        { stage: 'proposal', count: 1, expectedRevenueMinor: 4_000 },
        { stage: 'won', count: 5, expectedRevenueMinor: 90_000 },
        { stage: 'lost', count: 3, expectedRevenueMinor: 70_000 },
      ])
    ).toEqual({ activeValueMinor: 5_000, activeCount: 3 })
    expect(activePipeline([])).toEqual({ activeValueMinor: 0, activeCount: 0 })
  })
})
