import { describe, expect, it } from 'vitest'
import { claimAction, normalizeClaim, readClaim } from '@/server/ai/claims'
import { assembleBriefReport, reviewModelText } from '@/server/ai/consensus'
import { composeCouncilReply } from '@/server/ai/council'
import type { BriefFact } from '@/server/ai/brief-types'
import { guardAnswerAgainstFacts } from '@/server/ai/number-guard'

function fact(id: string, value: string): BriefFact {
  const [metric, scope, period] = id.split('|')
  return { id, metric, period, scope, value, unit: 'KWD' }
}

function reportFor(left: string, right: string, sales: BriefFact) {
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
  return assembleBriefReport({
    generatedAt: '2026-11-16T03:00:00.000Z',
    trigger: 'manual',
    periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
    sections: [],
    facts: [sales],
    models: [model('anthropic', left), model('google', right)],
  })
}

const sales = fact('net_sales_kwd|avenues|2026-11-15', '1000')
const ends = [
  { metric: 'net_sales_kwd', period: '2026-11-14', scope: 'company', value: '1000' },
  { metric: 'net_sales_kwd', period: '2026-11-15', scope: 'company', value: '900' },
]

describe('phase 7 claim consensus', () => {
  it('does not adopt a claim the matcher does not recognise', () => {
    const report = reportFor('راقب الوضع 1000', 'راقب الوضع 1000', sales)
    expect(report.recommendations).toEqual([])
    expect(report.dropped).toHaveLength(2)
  })

  it('treats a negated close as the opposite of close', () => {
    expect(readClaim('Close the branch')).toEqual({ action: 'close', negated: false })
    expect(readClaim('Do not close the branch')).toEqual({ action: 'close', negated: true })
    expect(readClaim('لا تغلق الفرع').negated).toBe(true)
    expect(claimAction('لا تغلق الفرع')).toBe('close')
    const english = reportFor('Close the branch 1000', 'Do not close the branch 1000', sales)
    const arabic = reportFor('أغلق الفرع 1000', 'لا تغلق الفرع 1000', sales)
    expect(english.recommendations).toEqual([])
    expect(english.disputed).toHaveLength(1)
    expect(arabic.recommendations).toEqual([])
    expect(arabic.disputed).toHaveLength(1)
  })

  it('does not treat closely as close', () => {
    expect(claimAction('Monitor the branch closely')).toBe('none')
    expect(normalizeClaim('closely', []).action).toBe('none')
    const report = reportFor('Monitor the branch closely 1000', 'Close the branch 1000', sales)
    expect(report.recommendations).toEqual([])
  })

  it('drops the reviewer opposite pairs', () => {
    const promote = reportFor('ادعم الفرع بحملة تسويق 1000', 'أوقف الفرع نهائياً 1000', sales)
    const staffing = reportFor('وظّف موظفين إضافيين 1000', 'سرّح موظفين 1000', sales)
    expect(promote.recommendations).toEqual([])
    expect(promote.disputed).toHaveLength(1)
    expect(staffing.recommendations).toEqual([])
    expect(staffing.disputed).toHaveLength(1)
    expect(claimAction('ادعم الفرع بحملة تسويق')).toBe('promote')
    expect(claimAction('أوقف الفرع نهائياً')).toBe('stop')
    expect(claimAction('وظّف موظفين إضافيين')).toBe('hire')
    expect(claimAction('سرّح موظفين')).toBe('fire')
  })
})

describe('phase 7 number guard', () => {
  it('reads a direction word on either side of a from-to pair', () => {
    expect(guardAnswerAgainstFacts('jumped from 1000 to 900', ends).ok).toBe(false)
    expect(guardAnswerAgainstFacts('from 1000 to 900, an increase', ends).offending).toContain('DIRECTION')
    expect(guardAnswerAgainstFacts('قفزت المبيعات من 1000 إلى 900', ends).ok).toBe(false)
    expect(guardAnswerAgainstFacts('نمو من 1000 إلى 900', ends).ok).toBe(false)
    expect(guardAnswerAgainstFacts('هبط من 1000 إلى 900', ends).ok).toBe(true)
  })

  it('rejects an unexplained ratio or difference and accepts real growth', () => {
    expect(guardAnswerAgainstFacts('فرع 1 فقط', ends).ok).toBe(false)
    expect(guardAnswerAgainstFacts('100 طلب', ends).ok).toBe(false)
    expect(guardAnswerAgainstFacts('90% من المبيعات', ends).ok).toBe(false)
    expect(guardAnswerAgainstFacts('الفرق 100', ends).ok).toBe(true)
    const growth = [
      { metric: 'net_sales_kwd', period: '2026-11-14', scope: 'company', value: '900' },
      { metric: 'net_sales_kwd', period: '2026-11-15', scope: 'company', value: '1000' },
    ]
    expect(guardAnswerAgainstFacts('from 900 to 1000 is 11%', growth).ok).toBe(true)
    expect(guardAnswerAgainstFacts('from 900 to 1000 is 11%', growth).offending).not.toContain('11')
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
