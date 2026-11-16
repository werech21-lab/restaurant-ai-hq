import { describe, expect, it } from 'vitest'
import { assembleBriefReport, reviewModelText } from '@/server/ai/consensus'
import { composeCouncilReply } from '@/server/ai/council'
import type { BriefFact } from '@/server/ai/brief-types'

function fact(id: string, value: string): BriefFact {
  const [metric, scope, period] = id.split('|')
  return { id, metric, period, scope, value, unit: 'KWD' }
}

function proseReport(left: string, right: string, sales: BriefFact) {
  const model = (provider: 'anthropic' | 'google', solution: string) =>
    reviewModelText({
      provider,
      modelId: provider,
      text: JSON.stringify({
        findings: [{ factIds: [sales.id], text: `راجع ${sales.value}` }],
        recommendations: [{ factIds: [sales.id], solution, stance: 'support' }],
        advisory: [],
      }),
      facts: [sales],
    })
  const models = [model('anthropic', left), model('google', right)]
  return {
    models,
    report: assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'manual',
      periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
      sections: [],
      facts: [sales],
      models,
    }),
  }
}

const sales = fact('net_sales_kwd|avenues|2026-11-15', '1000')

describe('phase 7 claim consensus', () => {
  it('rejects free text instead of adopting a word match', () => {
    const { models, report } = proseReport('راقب الوضع 1000', 'راقب الوضع 1000', sales)
    expect(models.every((model) => model.status === 'rejected')).toBe(true)
    expect(report.recommendations).toEqual([])
    expect(report.disputed).toEqual([])
  })

  it('rejects a negated close written as free text', () => {
    const english = proseReport('Close the branch 1000', 'Do not close the branch 1000', sales)
    const arabic = proseReport('أغلق الفرع 1000', 'لا تغلق الفرع 1000', sales)
    expect(english.report.recommendations).toEqual([])
    expect(arabic.report.recommendations).toEqual([])
    expect(english.models.every((model) => model.errorCode === 'GUARD_REJECTED')).toBe(true)
  })

  it('rejects closely and close as free text', () => {
    const { report } = proseReport('Monitor the branch closely 1000', 'Close the branch 1000', sales)
    expect(report.recommendations).toEqual([])
  })

  it('rejects the reviewer opposite pairs as free text', () => {
    const promote = proseReport('ادعم الفرع بحملة تسويق 1000', 'أوقف الفرع نهائياً 1000', sales)
    const staffing = proseReport('وظّف موظفين إضافيين 1000', 'سرّح موظفين 1000', sales)
    expect(promote.report.recommendations).toEqual([])
    expect(staffing.report.recommendations).toEqual([])
  })
})

describe('phase 7 number guard', () => {
  it('rejects prose direction words instead of accepting them as a gate', () => {
    const earlier = fact('net_sales_kwd|company|2026-11-14', '1000')
    const later = fact('net_sales_kwd|company|2026-11-15', '900')
    for (const text of ['jumped from 1000 to 900', 'هبط من 1000 إلى 900', 'الفرق 100', 'from 900 to 1000 is 11%']) {
      const reviewed = reviewModelText({
        provider: 'anthropic',
        modelId: 'claude',
        text: JSON.stringify({ findings: [{ text }], recommendations: [] }),
        facts: [earlier, later],
      })
      expect(reviewed.status).toBe('rejected')
      expect(reviewed.errorCode).toBe('GUARD_REJECTED')
    }
  })
})

describe('phase 7 feryal opposites', () => {
  it('does not agree when one model says best and the other says worst', () => {
    const composed = composeCouncilReply({
      odooReply: 'صافي 1000',
      passed: [
        { provider: 'anthropic', modelId: 'claude', text: 'الأفنيوز هو الأفضل بصافي 1000' },
        { provider: 'google', modelId: 'gemini', text: 'الأفنيوز هو الأسوأ بصافي 1000' },
      ],
      failed: [],
    })
    expect(composed.agreed).toEqual([])
    expect(composed.reply).toContain('لا اتفاق')
  })
})
