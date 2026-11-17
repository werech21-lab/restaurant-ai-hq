import { describe, expect, it } from 'vitest'
import { claimResponse, comparisonResponse, structuredClaim } from '@/server/ai/__tests__/claim-fixture'
import { assembleBriefReport, reviewModelText } from '@/server/ai/consensus'
import { composeCouncilReply } from '@/server/ai/council'
import type { BriefFact } from '@/server/ai/brief-types'
import { computeClaimFigure } from '@/server/ai/structured-claim'

function fact(id: string, value: string): BriefFact {
  const [metric, scope, period] = id.split('|')
  return { id, metric, period, scope, value, unit: 'KWD' }
}

describe('phase 6 claim consensus', () => {
  it('drops expand versus close even when both cite the same fact', () => {
    const sales = fact('net_sales_kwd|avenues|2026-11-15', '1000')
    const facts = [sales]
    const expand = claimResponse({
      recommendations: [structuredClaim([sales], { action: 'expand', targetType: 'branch', targetName: 'avenues' })],
    })
    const close = claimResponse({
      recommendations: [structuredClaim([sales], { action: 'close', targetType: 'branch', targetName: 'avenues' })],
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
    const text = report.disputed[0]?.support.concat(report.disputed[0]?.dispute ?? []).map((item) => item.solution).join(' ')
    expect(text).toContain('توسيع')
    expect(text).toContain('إغلاق')
  })

  it('does not adopt a shared fact when a third model names a different action', () => {
    const sales = fact('net_sales_kwd|avenues|2026-11-15', '1000')
    const text = claimResponse({
      recommendations: [structuredClaim([sales], { action: 'close', targetType: 'branch', targetName: 'avenues' })],
    })
    const lone = claimResponse({
      recommendations: [structuredClaim([sales], { action: 'expand', targetType: 'branch', targetName: 'avenues' })],
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
    expect(report.recommendations).toEqual([])
    expect(report.disputed).toHaveLength(1)
  })
})

describe('phase 6 number guard', () => {
  it('rejects prose that only matches an hour', () => {
    const hour = fact('net_sales_kwd|20|2026-11-15', '1000')
    const reviewed = reviewModelText({
      provider: 'anthropic',
      modelId: 'claude-test',
      text: JSON.stringify({ findings: [{ factIds: [hour.id], text: '20% of sales' }], recommendations: [] }),
      facts: [hour],
    })
    expect(reviewed.status).toBe('rejected')
    expect(reviewed.errorCode).toBe('GUARD_REJECTED')
  })

  it('rejects a written rise whose endpoints move the other way', () => {
    const earlier = fact('net_sales_kwd|company|2026-11-14', '1000')
    const later = fact('net_sales_kwd|company|2026-11-15', '900')
    const reviewed = reviewModelText({
      provider: 'anthropic',
      modelId: 'claude-test',
      text: JSON.stringify({ findings: [{ text: 'انخفض من 1000 إلى 900' }], recommendations: [] }),
      facts: [earlier, later],
    })
    expect(reviewed.status).toBe('rejected')
  })

  it('computes a share from cited facts and rejects a mismatched percent', () => {
    const part = fact('part|company|2026-11-15', '50')
    const whole = fact('whole|company|2026-11-15', '200')
    const figure = computeClaimFigure(
      structuredClaim([part, whole], { operation: 'share', direction: 'flat', targetType: 'company', targetName: 'company' }),
      [part, whole],
    )
    expect(figure?.value).toBe('25')
    const wrong = computeClaimFigure(
      {
        ...structuredClaim([part, whole], { operation: 'share', direction: 'flat', targetType: 'company', targetName: 'company' }),
        direction: 'up',
      },
      [part, whole],
    )
    expect(wrong).toBeNull()
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
    const shared = comparisonResponse({
      subject_id: 'avenues',
      relation: 'better',
      object_id: 'salmiya',
      metric: 'net_sales',
      cited_fact_ids: ['fact-avenues'],
    })
    const other = comparisonResponse({
      subject_id: 'salmiya',
      relation: 'better',
      object_id: 'avenues',
      metric: 'net_sales',
      cited_fact_ids: ['fact-avenues'],
    })
    const composed = composeCouncilReply({
      odooReply: 'صافي المبيعات 10.5',
      passed: [
        { provider: 'anthropic', modelId: 'claude', text: shared },
        { provider: 'google', modelId: 'gemini', text: shared },
        { provider: 'xai', modelId: 'grok', text: other },
      ],
      failed: [],
    })
    expect(composed.agreed.map((item) => item.provider).sort()).toEqual(['anthropic', 'google'])
    expect(composed.reply).toContain('اجتازت الفحص:')
    expect(composed.reply).not.toContain('xai/grok')
    expect(composed.reply).toContain('avenues أفضل من salmiya')
  })
})
