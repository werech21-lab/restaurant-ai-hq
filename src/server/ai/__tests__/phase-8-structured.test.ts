import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { claimResponse, structuredClaim } from '@/server/ai/__tests__/claim-fixture'
import type { FeryalContextPack } from '@/lib/feryal-context-types'
import { assembleBriefReport, reviewModelText } from '@/server/ai/consensus'
import { COUNCIL_MODEL_FALLBACK_NOTE, runFeryalCouncil, type RunCouncilOptions } from '@/server/ai/council'
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
    expect(split.disputed).toEqual([])
    expect(split.dropped.map((item) => item.provider)).toEqual(['anthropic'])
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

  it('derives a delta sign from the earlier date and rejects a mismatched direction', () => {
    const delta = structuredClaim([later, earlier], {
      action: 'monitor',
      operation: 'delta',
      direction: 'up',
      targetType: 'company',
      targetName: 'company',
    })
    const figure = computeClaimFigure(delta, [later, earlier])
    expect(figure?.value).toBe('100')
    expect(figure?.sign).toBe(1)
    expect(computeClaimFigure({ ...delta, direction: 'down' }, [later, earlier])).toBeNull()
  })
})

function makePhase8Pack(): FeryalContextPack {
  const src = { model: 'pos.order', period: { from: '2026-11-15', to: '2026-11-15' }, lastSyncAt: '2026-11-16T00:00:00.000Z' }
  const unavail = (model: string) => ({ status: 'unavailable' as const, reason: 'not_loaded', source: { ...src, model } })
  return {
    generatedAtIso: '2026-11-16T00:00:00.000Z',
    connected: true,
    period: { from: '2026-11-15', to: '2026-11-15', days: 1, labelAr: '2026-11-15', labelEn: '2026-11-15' },
    previousPeriod: { from: '2026-11-14', to: '2026-11-14' },
    elapsedDaysInMonth: 15,
    totalDaysInMonth: 30,
    companyTotals: { status: 'ok', source: src, data: { netSalesKwd: 10.5, orders: 3, aovKwd: 3.5, mappedBranchesNetKwd: 10.5, unattributedSalesKwd: 0 } },
    branches: {
      status: 'ok',
      source: src,
      data: {
        items: [
          { branchId: 'avenues', nameAr: 'الأفنيوز', nameEn: 'Avenues', netKwd: 7.5, orders: 2, aovKwd: 3.75, group: 'restaurant' },
          { branchId: 'salmiya', nameAr: 'السالمية', nameEn: 'Salmiya', netKwd: 3, orders: 1, aovKwd: 3, group: 'restaurant' },
        ],
      },
    },
    unattributed: unavail('pos.order'),
    channels: unavail('pos.payment'),
    brands: unavail('pos.order.line'),
    topProducts: unavail('pos.order.line'),
    hourly: unavail('pos.order'),
    deltas: unavail('pos.order'),
    gl: unavail('account.move.line'),
    receivables: unavail('account.move.line'),
    purchases: unavail('purchase.order'),
    stock: unavail('stock.move'),
    hr: unavail('hr.employee'),
    advisorReports: [],
    companyContext: '',
  }
}

function makePhase8Agent(pack: FeryalContextPack) {
  return {
    reply: 'صافي المبيعات 10.5',
    status: 'answered' as const,
    executedQueries: [],
    verifier: { valid: true, extractedNumbers: [10.5], unverifiedNumbers: [] },
    toolNumbers: [10.5],
    period: { from: '2026-11-15', to: '2026-11-15' },
    facts: [],
    source: null,
    contextPack: pack,
    auditEntry: {
      id: 'audit-p8',
      timestampIso: '2026-11-16T00:00:00.000Z',
      userSub: 'p8',
      userRole: 'admin',
      question: 'قارن الأفنيوز والسالمية',
      status: 'answered' as const,
      executedQueries: [],
      verifier: { valid: true, extractedNumbers: [10.5], unverifiedNumbers: [] },
      finalReply: 'صافي المبيعات 10.5',
    },
  }
}

describe('phase 8 feryal comparisons', () => {
  const chatBreaks = [
    ['الأفنيوز أفضل من السالمية', 'السالمية أفضل من الأفنيوز'],
    ['الأقوى', 'الأضعف'],
    ['جيد', 'سيئ'],
    ['top', 'bottom'],
  ]
  const keys = {
    anthropic: 'test-anthropic-key-0001',
    google: 'test-google-key-00000001',
    xai: 'test-grok-key-0000000001',
  }
  const models = { anthropic: 'claude', google: 'gemini', xai: 'grok' }

  it('rejects every free-text chat paraphrase and keeps verified Odoo deterministic truth', async () => {
    const pack = makePhase8Pack()
    for (const [left, right] of chatBreaks) {
      const fetchImpl: typeof fetch = async (input) => {
        const url = String(input)
        if (url.includes('api.anthropic.com')) {
          return Response.json({ model: 'claude', content: [{ type: 'text', text: left }], usage: { input_tokens: 1, output_tokens: 1 } })
        }
        if (url.includes('generativelanguage.googleapis.com')) {
          return Response.json({ modelVersion: 'gemini', candidates: [{ content: { parts: [{ text: right }] } }] })
        }
        return Response.json({ model: 'grok', choices: [{ message: { content: left } }] })
      }
      const res = await runFeryalCouncil(
        { question: 'قارن الأفنيوز والسالمية', userId: 'u8', userRole: 'admin' },
        {
          askOdoo: (async () => makePhase8Agent(pack)) as RunCouncilOptions['askOdoo'],
          fetchImpl,
          keys,
          models,
          persist: async () => undefined,
        },
      )
      expect(res.status).toBe('answered')
      expect(res.agreed).toEqual([])
      expect(res.participants.every((p) => p.status === 'guard_rejected')).toBe(true)
      expect(res.reply).toContain('صافي المبيعات 10.5')
      expect(res.reply).toContain(COUNCIL_MODEL_FALLBACK_NOTE)
    }
  })

  it('drops claims citing unavailable sections or unverified numbers while keeping verified claims', async () => {
    const pack = makePhase8Pack()
    const partialContract = JSON.stringify({
      answer_ar: 'سجل الأفنيوز 7.5 د.ك من إجمالي 10.5 د.ك.',
      claims: [
        { text: 'سجل الأفنيوز 7.5 د.ك من إجمالي 10.5 د.ك.', numbers: [{ value: 7.5, section: 'branches' }, { value: 10.5, section: 'companyTotals' }] },
        { text: 'بلغت المشتريات 888 د.ك.', numbers: [{ value: 888, section: 'purchases' }] },
      ],
      proposals: [{ text: 'تعزيز متوسط الطلب في السالمية.', owner: 'مدير العمليات', kind: 'proposal' }],
      missing_metrics: [],
    })
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url.includes('api.anthropic.com')) {
        return Response.json({ model: 'claude', content: [{ type: 'text', text: partialContract }], usage: { input_tokens: 1, output_tokens: 1 } })
      }
      return Response.json({ modelVersion: 'gemini', candidates: [{ content: { parts: [{ text: JSON.stringify({ status: 'ok', note: '' }) }] } }] })
    }
    const res = await runFeryalCouncil(
      { question: 'قارن الأفنيوز والسالمية', userId: 'u8', userRole: 'admin' },
      {
        askOdoo: (async () => makePhase8Agent(pack)) as RunCouncilOptions['askOdoo'],
        fetchImpl,
        keys,
        models,
        persist: async () => undefined,
      },
    )
    expect(res.status).toBe('answered')
    expect(res.reply).toContain('7.5')
    expect(res.reply).toContain('10.5')
    expect(res.reply).not.toContain('888')
  })

  it('normalises Y worse than X to X better than Y and accepts server-derived differences in council contract', async () => {
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
    const pack = makePhase8Pack()
    const derivedContract = JSON.stringify({
      answer_ar: 'الأفنيوز (7.5 د.ك) أفضل من السالمية (3 د.ك) بفارق 4.5 د.ك.',
      claims: [{ text: 'الأفنيوز (7.5 د.ك) أفضل من السالمية (3 د.ك) بفارق 4.5 د.ك.', numbers: [{ value: 7.5, section: 'branches' }, { value: 3, section: 'branches' }, { value: 4.5, section: 'branches' }] }],
      proposals: [{ text: 'مراجعة جدول السالمية في الساعات الهادئة.', owner: 'مدير العمليات', kind: 'proposal' }],
      missing_metrics: [],
    })
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url.includes('api.anthropic.com')) {
        return Response.json({ model: 'claude', content: [{ type: 'text', text: derivedContract }], usage: { input_tokens: 1, output_tokens: 1 } })
      }
      return Response.json({ modelVersion: 'gemini', candidates: [{ content: { parts: [{ text: JSON.stringify({ status: 'ok', note: '' }) }] } }] })
    }
    const res = await runFeryalCouncil(
      { question: 'قارن الأفنيوز والسالمية', userId: 'u8', userRole: 'admin' },
      {
        askOdoo: (async () => makePhase8Agent(pack)) as RunCouncilOptions['askOdoo'],
        fetchImpl,
        keys,
        models,
        persist: async () => undefined,
      },
    )
    expect(res.status).toBe('answered')
    expect(res.agreed.map((item) => item.provider).sort()).toEqual(['anthropic', 'google'])
    expect(res.reply).toContain('4.5')
  })
})

describe('phase 8 gates', () => {
  it('does not use the free-text number guard as the consensus or chat gate', () => {
    const consensus = readFileSync(path.join(process.cwd(), 'src/server/ai/consensus.ts'), 'utf8')
    const council = readFileSync(path.join(process.cwd(), 'src/server/ai/council.ts'), 'utf8')
    expect(consensus).not.toContain('guardAnswerAgainstFacts')
    expect(council).not.toContain('guardAnswerAgainstFacts')
    expect(consensus).toContain('structuredClaimSchema')
    expect(council).not.toContain('comparisonSchema')
    expect(council).toContain('parseFeryalLlmContract')
    expect(council).toContain('verifyFeryalContractPerClaim')
    expect(council).toContain('renderFeryalContractReply')
  })
})
