import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { claimResponse, comparisonResponse, structuredClaim } from '@/server/ai/__tests__/claim-fixture'
import { assembleBriefReport, reviewModelText } from '@/server/ai/consensus'
import { composeCouncilReply } from '@/server/ai/council'
import type { BriefFact } from '@/server/ai/brief-types'
import { computeClaimFigure, normalizeComparison, renderClaimText } from '@/server/ai/structured-claim'

function fact(id: string, value: string, unit: BriefFact['unit'] = 'KWD'): BriefFact {
  const [metric, scope, period] = id.split('|')
  return { id, metric, period, scope, value, unit }
}

function prosePair(left: string, right: string) {
  const sales = fact('net_sales_kwd|avenues|2026-11-15', '1000')
  const model = (provider: 'anthropic' | 'google', text: string) =>
    reviewModelText({
      provider,
      modelId: provider,
      text: JSON.stringify({
        findings: [{ factIds: [sales.id], text }],
        recommendations: [{ factIds: [sales.id], solution: text, stance: 'support' }],
      }),
      facts: [sales],
    })
  const models = [model('anthropic', left), model('google', right)]
  const report = assembleBriefReport({
    generatedAt: '2026-11-16T03:00:00.000Z',
    trigger: 'manual',
    periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
    sections: [],
    facts: [sales],
    models,
  })
  return { models, report }
}

const consensusBreaks: Array<[string, string]> = [
  ['لا ينبغي إغلاق الفرع', 'أغلق الفرع'],
  ["We shouldn't close the branch", 'Close the branch'],
  ['You should not ever close the branch', 'Close the branch'],
  ['إغلاق الفرع خطأ كبير', 'أغلق الفرع'],
  ['Close the morning shift only', 'Close the branch permanently'],
  ['Stop the discounts', 'Stop the branch'],
  ['Review the branch', 'Review then close the branch'],
]

const numberBreaks = [
  'sales fell from 900 to 1000 while orders rose from 50 to 40',
  'صعدت المبيعات from 1000 to 900',
  'تحسنت المبيعات from 1000 to 900',
  'were up from 1000 to 900',
  'improved from 1000 to 900',
  'سجلت المبيعات ارتفاعاً من 1000 إلى 900',
  'growth of -10% from 900 to 1000',
  '90% of sales came from one branch',
  'sales rose 1000 → 900',
  'ارتفعت المبيعات: 900 مقابل 1000 أمس',
  'المبيعات ضعف الأمس 1000',
  'الفرق كبير: 100 طلب',
]

describe('phase 8 structured claims', () => {
  it('rejects every reviewer consensus break', () => {
    for (const [left, right] of consensusBreaks) {
      const { models, report } = prosePair(left, right)
      expect(models.every((model) => model.status === 'rejected' && model.errorCode === 'GUARD_REJECTED')).toBe(true)
      expect(report.recommendations).toEqual([])
      expect(report.findings).toEqual([])
      expect(report.disputed).toEqual([])
    }
  })

  it('adopts only when action, target, direction, polarity and a cited fact match', () => {
    const sales = fact('net_sales_kwd|avenues|2026-11-15', '1000')
    const same = claimResponse({
      recommendations: [structuredClaim([sales], { action: 'close', targetType: 'branch', targetName: 'avenues' })],
    })
    const otherTarget = claimResponse({
      recommendations: [structuredClaim([sales], { action: 'close', targetType: 'shift', targetName: 'avenues' })],
    })
    const agreed = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'manual',
      periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
      sections: [],
      facts: [sales],
      models: [
        reviewModelText({ provider: 'anthropic', modelId: 'a', text: same, facts: [sales] }),
        reviewModelText({ provider: 'google', modelId: 'g', text: same, facts: [sales] }),
      ],
    })
    expect(agreed.recommendations).toHaveLength(1)
    expect(agreed.recommendations[0]?.supporters).toHaveLength(2)
    expect(agreed.recommendations[0]?.supporters[0]?.solution).toContain('إغلاق')
    expect(agreed.recommendations[0]?.supporters[0]?.solution).toContain('Close')
    expect(agreed.recommendations[0]?.supporters[0]?.solution).not.toContain('أغلق')

    const split = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'manual',
      periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
      sections: [],
      facts: [sales],
      models: [
        reviewModelText({ provider: 'anthropic', modelId: 'a', text: same, facts: [sales] }),
        reviewModelText({ provider: 'google', modelId: 'g', text: otherTarget, facts: [sales] }),
      ],
    })
    expect(split.recommendations).toEqual([])
    expect(split.disputed).toHaveLength(1)
  })

  it('does not adopt action none', () => {
    const sales = fact('net_sales_kwd|avenues|2026-11-15', '1000')
    const none = claimResponse({
      recommendations: [structuredClaim([sales], { action: 'none', targetType: 'branch', targetName: 'avenues' })],
    })
    const report = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'manual',
      periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
      sections: [],
      facts: [sales],
      models: [
        reviewModelText({ provider: 'anthropic', modelId: 'a', text: none, facts: [sales] }),
        reviewModelText({ provider: 'google', modelId: 'g', text: none, facts: [sales] }),
      ],
    })
    expect(report.recommendations).toEqual([])
    expect(report.dropped.length).toBeGreaterThan(0)
  })

  it('rejects a claim whose target is not in the cited facts', () => {
    const sales = fact('net_sales_kwd|avenues|2026-11-15', '1000')
    const reviewed = reviewModelText({
      provider: 'anthropic',
      modelId: 'a',
      text: claimResponse({
        recommendations: [structuredClaim([sales], { action: 'close', targetType: 'branch', targetName: 'salmiya' })],
      }),
      facts: [sales],
    })
    expect(reviewed.status).toBe('rejected')
    expect(reviewed.errorCode).toBe('MISSING_CITATION')
  })
})

describe('phase 8 number computer', () => {
  const earlier = fact('net_sales_kwd|company|2026-11-14', '900')
  const later = fact('net_sales_kwd|company|2026-11-15', '1000')
  const ordersEarlier = fact('orders|company|2026-11-14', '50', 'orders')
  const ordersLater = fact('orders|company|2026-11-15', '40', 'orders')

  it('rejects every reviewer number sentence', () => {
    for (const text of numberBreaks) {
      const reviewed = reviewModelText({
        provider: 'anthropic',
        modelId: 'a',
        text: JSON.stringify({ findings: [{ text }], recommendations: [] }),
        facts: [earlier, later, ordersEarlier, ordersLater],
      })
      expect(reviewed.status).toBe('rejected')
      expect(reviewed.errorCode).toBe('GUARD_REJECTED')
      expect(JSON.stringify(reviewed)).not.toContain(text)
    }
  })

  it('displays 11 for a rise from 900 to 1000 and rejects the opposite direction', () => {
    const up = structuredClaim([earlier, later], {
      action: 'monitor',
      operation: 'pct_change',
      direction: 'up',
      targetType: 'company',
      targetName: 'company',
    })
    const figure = computeClaimFigure(up, [earlier, later])
    expect(figure?.value).toBe('11')
    expect(renderClaimText(up, figure!).includes('ارتفاع')).toBe(true)
    expect(renderClaimText(up, figure!).includes('11%')).toBe(true)
    const down = { ...up, direction: 'down' as const }
    expect(computeClaimFigure(down, [earlier, later])).toBeNull()
    const reviewed = reviewModelText({
      provider: 'anthropic',
      modelId: 'a',
      text: claimResponse({ findings: [down] }),
      facts: [earlier, later],
    })
    expect(reviewed.status).toBe('rejected')
  })

  it('derives a delta sign from the facts and rejects a mismatched direction', () => {
    const delta = structuredClaim([later, earlier], {
      action: 'monitor',
      operation: 'delta',
      direction: 'down',
      targetType: 'company',
      targetName: 'company',
    })
    const figure = computeClaimFigure(delta, [later, earlier])
    expect(figure?.value).toBe('-100')
    expect(figure?.sign).toBe(-1)
    expect(computeClaimFigure({ ...delta, direction: 'up' }, [later, earlier])).toBeNull()
  })
})

describe('phase 8 feryal comparisons', () => {
  const chatBreaks = [
    ['الأفنيوز أفضل من السالمية', 'السالمية أفضل من الأفنيوز'],
    ['الأقوى', 'الأضعف'],
    ['جيد', 'سيئ'],
    ['top', 'bottom'],
  ]

  it('rejects every reviewer chat paraphrase', () => {
    for (const [left, right] of chatBreaks) {
      const composed = composeCouncilReply({
        odooReply: 'صافي المبيعات 10.5',
        passed: [
          { provider: 'anthropic', modelId: 'claude', text: left },
          { provider: 'google', modelId: 'gemini', text: right },
        ],
        failed: [],
      })
      expect(composed.agreed).toEqual([])
      expect(composed.reply).toContain('لا اتفاق')
      expect(composed.reply).toContain('صافي المبيعات 10.5')
    }
  })

  it('does not treat best and worst as the same structure', () => {
    const best = comparisonResponse({
      subject_id: 'avenues',
      relation: 'best',
      object_id: null,
      metric: 'net_sales',
      cited_fact_ids: ['fact-avenues'],
    })
    const worst = comparisonResponse({
      subject_id: 'avenues',
      relation: 'worst',
      object_id: null,
      metric: 'net_sales',
      cited_fact_ids: ['fact-avenues'],
    })
    const composed = composeCouncilReply({
      odooReply: 'صافي المبيعات 10.5',
      passed: [
        { provider: 'anthropic', modelId: 'claude', text: best },
        { provider: 'google', modelId: 'gemini', text: worst },
      ],
      failed: [],
    })
    expect(composed.agreed).toEqual([])
    expect(composed.reply).toContain('لا اتفاق')
  })

  it('normalises Y worse than X to X better than Y', () => {
    const worse = {
      subject_id: 'salmiya',
      relation: 'worse' as const,
      object_id: 'avenues',
      metric: 'net_sales',
      cited_fact_ids: ['fact-avenues'],
    }
    expect(normalizeComparison(worse)).toMatchObject({
      subject_id: 'avenues',
      relation: 'better',
      object_id: 'salmiya',
    })
    const composed = composeCouncilReply({
      odooReply: 'صافي المبيعات 10.5',
      passed: [
        { provider: 'anthropic', modelId: 'claude', text: comparisonResponse(worse) },
        {
          provider: 'google',
          modelId: 'gemini',
          text: comparisonResponse({
            subject_id: 'avenues',
            relation: 'better',
            object_id: 'salmiya',
            metric: 'net_sales',
            cited_fact_ids: ['fact-avenues'],
          }),
        },
      ],
      failed: [],
    })
    expect(composed.agreed.map((item) => item.provider).sort()).toEqual(['anthropic', 'google'])
    expect(composed.reply).toContain('avenues أفضل من salmiya')
    expect(composed.reply).not.toContain('worse')
  })
})

describe('phase 8 gates', () => {
  it('does not use the free-text number guard as the consensus or chat gate', () => {
    const consensus = readFileSync(path.join(process.cwd(), 'src/server/ai/consensus.ts'), 'utf8')
    const council = readFileSync(path.join(process.cwd(), 'src/server/ai/council.ts'), 'utf8')
    expect(consensus).not.toContain('guardAnswerAgainstFacts')
    expect(council).not.toContain('guardAnswerAgainstFacts')
    expect(consensus).toContain('structuredClaimSchema')
    expect(council).toContain('comparisonSchema')
  })
})
