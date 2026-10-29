import { describe, expect, it } from 'vitest'
import { analyzeContract } from '@/modules/governance/domain/analyze'
import { CLOSE_BLOCKED_MESSAGE, closeBlocked, violationTransition, taskTransition } from '@/modules/governance/domain/desk'
import { blockMessage, gateDecision, workedMinutes } from '@/modules/governance/domain/gate'
import { nextMemory } from '@/modules/governance/domain/learning'
import { extractArchive } from '@/modules/governance/domain/ocr'
import { radarAdvice } from '@/modules/governance/domain/radar'

const license = { ruleCode: 'CIRC-KW-2026-01', ruleType: 'expired_driver_license' as const, thresholdValue: 0 }
const hours = { ruleCode: 'CIRC-KW-2026-02', ruleType: 'max_working_hours' as const, thresholdValue: 8 }
const cash = { ruleCode: 'CIRC-KW-2026-03', ruleType: 'cash_ceiling_kwd' as const, thresholdValue: 50_000 }

describe('compliance gate', () => {
  it('uses the exact Arabic hard-stop message', () => {
    expect(blockMessage('CIRC-KW-2026-01')).toBe('تم إيقاف الإجراء لمخالفته التعميم الرقابي المعتمد رقم [CIRC-KW-2026-01]')
  })

  it('blocks an expired license, a shift over eight hours, and cash above the ceiling', () => {
    expect(gateDecision([license], 'delivery.assign_driver', { licenseExpiry: '2020-01-01' }, '2026-10-29').blocked).toBe(true)
    expect(gateDecision([license], 'delivery.assign_driver', { licenseExpiry: '2026-10-29' }, '2026-10-29').blocked).toBe(false)
    expect(workedMinutes('2026-10-29T06:00:00.000Z', '2026-10-29T14:00:00.000Z')).toBe(480)
    expect(gateDecision([hours], 'hr.attendance.hours', { workedMinutes: 480 }, '2026-10-29').blocked).toBe(false)
    expect(gateDecision([hours], 'hr.attendance.hours', { workedMinutes: 481 }, '2026-10-29').blocked).toBe(true)
    expect(gateDecision([cash], 'hr.expense.cash', { cashMinor: 50_000 }, '2026-10-29').blocked).toBe(false)
    expect(gateDecision([cash], 'hr.expense.cash', { cashMinor: 50_001 }, '2026-10-29')).toEqual({ blocked: true, ruleCode: 'CIRC-KW-2026-03' })
    expect(gateDecision([], 'hr.expense.cash', { cashMinor: 80_000 }, '2026-10-29').blocked).toBe(false)
  })
})

describe('contract analysis and archive routing', () => {
  it('scores the seeded vegetable contract at 80 on 29 Oct 2026', () => {
    const draft = analyzeContract({
      title: 'عقد توريد خضار',
      counterparty: 'مؤسسة النخيل',
      startDate: '2026-01-01',
      endDate: '2026-11-15',
      valueMinor: 2_400_000,
      renewalAlertDays: 30,
    }, '2026-10-29')
    expect(draft.riskScore).toBe(80)
    expect(draft.clausesSummaryAr).toContain('2,400.000')
    expect(draft.negotiationRecommendationsAr).toContain('لا تُجدَّد')
  })

  it('routes a fuel invoice to HR and reads the fils amount from the text', () => {
    const extracted = extractArchive('فاتورة-وقود.pdf', 'المبلغ 12.500 د.ك', 'fuel_invoice')
    expect(extracted.route).toBe('/erp/hr')
    expect(extracted.amountMinor).toBe(12_500)
    expect(extracted.fileType).toBe('pdf')
    expect(extractArchive('بوليصة.png', '4.500', 'delivery_waybill').route).toBe('/erp/delivery')
    expect(extractArchive('عقد.txt', 'الطرف: مؤسسة النخيل', 'contract').counterparty).toBe('مؤسسة النخيل')
  })
})

describe('learning and competitive advice', () => {
  it('moves the weight by a fixed integer and stays inside the cap', () => {
    expect(nextMemory({ weight: 20, confidence: 80 }, 'approved')).toEqual({ weight: 25, confidence: 83 })
    expect(nextMemory({ weight: 100, confidence: 100 }, 'approved')).toEqual({ weight: 100, confidence: 100 })
    expect(nextMemory({ weight: 0, confidence: 40 }, 'blocked')).toEqual({ weight: 2, confidence: 41 })
  })

  it('states the KWD gap without a float', () => {
    expect(radarAdvice('طلبات', 'رسوم التوصيل', 1250, 900).insightAr).toContain('0.350')
    expect(radarAdvice('كارفور', 'سلة خضار', 1800, 2100).insightAr).toContain('أقل')
  })
})

describe('government violation closure', () => {
  it('refuses a verified close until the statement and the proof are both present', () => {
    expect(closeBlocked(null, null)).toBe(true)
    expect(closeBlocked('إفادة', null)).toBe(true)
    expect(closeBlocked(null, 'archive:proof')).toBe(true)
    expect(closeBlocked('إفادة', 'archive:proof')).toBe(false)
    expect(() => violationTransition('assigned', 'close', null, null)).toThrow(CLOSE_BLOCKED_MESSAGE)
    expect(() => violationTransition('proof_uploaded', 'close', 'إفادة', null)).toThrow(CLOSE_BLOCKED_MESSAGE)
    expect(violationTransition('proof_uploaded', 'close', 'إفادة', 'archive:proof')).toBe('closed_verified')
    expect(taskTransition('alert_pending', 'dispatch')).toBe('task_dispatched')
  })
})
