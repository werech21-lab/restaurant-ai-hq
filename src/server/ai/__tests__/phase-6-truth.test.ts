import { describe, expect, it } from 'vitest'
import { assembleBriefReport, reviewModelText } from '@/server/ai/consensus'
import { composeCouncilReply } from '@/server/ai/council'
import type { BriefFact } from '@/server/ai/brief-types'
import { guardAnswerAgainstFacts } from '@/server/ai/number-guard'

function fact(id: string, value: string): BriefFact {
  const [metric, scope, period] = id.split('|')
  return { id, metric, period, scope, value, unit: 'KWD' }
}

describe('phase 6 claim consensus', () => {
  it('drops expand versus close even when both cite the same fact', () => {
    const sales = fact('net_sales_kwd|avenues|2026-11-15', '1000')
    const facts = [sales]
    const expand = JSON.stringify({
      findings: [{ factIds: [sales.id], text: 'صافي 1000' }],
      recommendations: [{ factIds: [sales.id], solution: 'وسّع الفرع 1000', stance: 'support' }],
      advisory: [],
    })
    const close = JSON.stringify({
      findings: [{ factIds: [sales.id], text: 'صافي 1000' }],
      recommendations: [{ factIds: [sales.id], solution: 'أغلق الفرع 1000', stance: 'support' }],
      advisory: [],
    })
    const report = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'manual',
      periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
      sections: [],
      facts,
      models: [
        reviewModelText({ provider: 'anthropic', modelId: 'claude-test', text: expand, facts }),
        reviewModelText({ provider: 'google', modelId: 'gemini-test', text: close, facts }),
      ],
    })
    expect(report.recommendations).toEqual([])
    expect(report.disputed).toHaveLength(1)
    expect(report.disputed[0]?.support[0]?.solution).toContain('وسّع')
    expect(report.disputed[0]?.dispute[0]?.solution).toContain('أغلق')
  })

  it('adopts a recommendation only when two models share the claim', () => {
    const sales = fact('net_sales_kwd|avenues|2026-11-15', '1000')
    const text = JSON.stringify({
      findings: [{ factIds: [sales.id], text: 'صافي 1000' }],
      recommendations: [{ factIds: [sales.id], solution: 'راجع صافي 1000', stance: 'support' }],
      advisory: [],
    })
    const lone = JSON.stringify({
      findings: [{ factIds: [sales.id], text: 'صافي 1000' }],
      recommendations: [{ factIds: [sales.id], solution: 'وسّع الفرع 1000', stance: 'support' }],
      advisory: [],
    })
    const report = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'manual',
      periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
      sections: [],
      facts: [sales],
      models: [
        reviewModelText({ provider: 'anthropic', modelId: 'a', text, facts: [sales] }),
        reviewModelText({ provider: 'google', modelId: 'g', text, facts: [sales] }),
        reviewModelText({ provider: 'xai', modelId: 'x', text: lone, facts: [sales] }),
      ],
    })
    expect(report.recommendations).toHaveLength(1)
    expect(report.recommendations[0]?.supporters.map((side) => side.provider).sort()).toEqual(['anthropic', 'google'])
    expect(report.dropped.map((item) => item.provider)).toEqual(['xai'])
  })
})

describe('phase 6 number guard', () => {
  it('rejects a percent that only matches an hour', () => {
    const facts = [{ id: 'hour-row', metric: 'net_sales_kwd', period: '2026-11-15', scope: '20', value: '1000' }]
    const result = guardAnswerAgainstFacts('20% of sales', facts)
    expect(result.ok).toBe(false)
    expect(result.offending).toContain('20')
  })

  it('rejects a rise whose written endpoints move the other way', () => {
    const facts = [
      { metric: 'net_sales_kwd', period: '2026-11-14', scope: 'company', value: '1000' },
      { metric: 'net_sales_kwd', period: '2026-11-15', scope: 'company', value: '900' },
    ]
    expect(guardAnswerAgainstFacts('rose from 1000 to 900', facts).ok).toBe(false)
    expect(guardAnswerAgainstFacts('rose from 1000 to 900', facts).offending).toContain('DIRECTION')
    expect(guardAnswerAgainstFacts('انخفض من 1000 إلى 900', facts).ok).toBe(true)
  })

  it('accepts a percent only after recomputing it from fact values', () => {
    const facts = [
      { metric: 'part', period: '2026-11-15', scope: 'company', value: '50' },
      { metric: 'whole', period: '2026-11-15', scope: 'company', value: '200' },
    ]
    expect(guardAnswerAgainstFacts('25% of sales', facts).ok).toBe(true)
    expect(guardAnswerAgainstFacts('20% of sales', facts).ok).toBe(false)
  })
})

describe('phase 6 feryal agreement', () => {
  it('returns no agreement when the models reach opposite conclusions', () => {
    const composed = composeCouncilReply({
      odooReply: 'صافي المبيعات 10.5',
      passed: [
        { provider: 'anthropic', modelId: 'claude', text: 'وسّع الفرع والصافي 10.5' },
        { provider: 'google', modelId: 'gemini', text: 'أغلق الفرع والصافي 10.5' },
      ],
      failed: [],
    })
    expect(composed.agreed).toEqual([])
    expect(composed.reply).toContain('لا اتفاق')
    expect(composed.reply).toContain('صافي المبيعات 10.5')
  })

  it('lists only the models that share the conclusion', () => {
    const composed = composeCouncilReply({
      odooReply: 'صافي المبيعات 10.5',
      passed: [
        { provider: 'anthropic', modelId: 'claude', text: 'راجع الصافي 10.5' },
        { provider: 'google', modelId: 'gemini', text: 'راجع الصافي 10.5' },
        { provider: 'xai', modelId: 'grok', text: 'أغلق الفرع والصافي 10.5' },
      ],
      failed: [],
    })
    expect(composed.agreed.map((item) => item.provider).sort()).toEqual(['anthropic', 'google'])
    expect(composed.reply).toContain('اجتازت الفحص:')
    expect(composed.reply).not.toContain('xai/grok')
  })
})
