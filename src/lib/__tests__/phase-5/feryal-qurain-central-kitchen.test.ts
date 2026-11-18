/**
 * Feryal understands «القرين» / «المطبخ المركزي» (owner, 2026-11-18: Qurain is the active central
 * kitchen). Its POS sales are not in company totals until the read-only double-counting audit
 * (scripts/audit-qurain-double-count.mjs) is approved, so every Qurain question is answered
 * «غير متاح» — never 0.000 and never another branch's figure. No figures are asserted here.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { askFeryalOdooAgent, isQurainCentralKitchenQuestion, resetFeryalAuditCache } from '@/lib/feryal-odoo-agent'
import { createDialectDataSource, DIALECT_NOW_MS } from './support/feryal-dialect-fixture'

const QUESTIONS = [
  'كم مبيعات القرين اليوم؟',
  'كم مبيعات المطبخ المركزي هالشهر؟',
  'شو مبيعات بالقرين امبارح؟',
  'Qurain sales this month',
  'Central kitchen sales yesterday',
]

describe('Feryal — Qurain (Central Kitchen)', () => {
  beforeEach(() => resetFeryalAuditCache())

  it.each(QUESTIONS)('«%s» → غير متاح naming القرين (المطبخ المركزي), no 0.000', async (question) => {
    expect(isQurainCentralKitchenQuestion(question)).toBe(true)
    const res = await askFeryalOdooAgent({
      question,
      userSub: 'phase5-qurain',
      userRole: 'gm',
      referenceNowMs: DIALECT_NOW_MS,
      dataSource: createDialectDataSource(),
      skipAuditLog: true,
    })
    expect(res.status, res.reply).toBe('no_odoo_data')
    expect(res.reply).toContain('غير متاح')
    expect(res.reply).toContain('القرين (المطبخ المركزي)')
    expect(res.reply).not.toMatch(/0\.000|\d[\d,]*\.\d+\s*د\.ك/)
  })

  it('does not catch look-alike words or other branches', () => {
    for (const q of ['تمر قريني', 'Qurainy Dates', 'كم مبيعات الأفنيوز؟', 'مبيعات العارضية امس']) {
      expect(isQurainCentralKitchenQuestion(q), q).toBe(false)
    }
  })
})
