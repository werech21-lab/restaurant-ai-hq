import { describe, expect, it } from 'vitest'
import { askFeryalOdooAgent, type FeryalOdooDataSource } from '@/lib/feryal-odoo-agent'
import { numericFactsFromStructured } from '@/lib/feryal-council-facts'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import { claimResponse, structuredClaim } from '@/server/ai/__tests__/claim-fixture'
import { COUNCIL_MODEL_FALLBACK_NOTE, runFeryalCouncil, type RunCouncilOptions } from '@/server/ai/council'
import { assembleBriefReport, parseStoredBrief, reviewModelText } from '@/server/ai/consensus'
import type { BriefFact } from '@/server/ai/brief-types'
import { computeClaimFigure, comparisonMatchesFacts, type ComparableFact, type StructuredClaim } from '@/server/ai/structured-claim'

function fact(id: string, value: string, unit: BriefFact['unit'] = 'KWD'): BriefFact {
  const [metric, scope, period] = id.split('|')
  return { id, metric, period, scope, value, unit }
}

function reportFor(facts: BriefFact[], texts: Record<'anthropic' | 'google' | 'xai', string>) {
  return assembleBriefReport({
    generatedAt: '2026-11-16T03:00:00.000Z',
    trigger: 'manual',
    periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
    sections: [],
    facts,
    models: (['anthropic', 'google', 'xai'] as const).map((provider) =>
      reviewModelText({ provider, modelId: provider, text: texts[provider], facts }),
    ),
  })
}

describe('phase 10 trend direction', () => {
  const yesterday = fact('net_sales_kwd|avenues|2026-11-14', '900')
  const today = fact('net_sales_kwd|avenues|2026-11-15', '1000')
  const salmiya = fact('net_sales_kwd|salmiya|2026-11-15', '400')
  const orders = fact('orders|avenues|2026-11-15', '50', 'orders')

  it('uses the earlier date as the base when the model lists today first', () => {
    const down = structuredClaim([today, yesterday], {
      action: 'close',
      operation: 'pct_change',
      direction: 'down',
      targetType: 'branch',
      targetName: 'avenues',
    })
    expect(computeClaimFigure(down, [today, yesterday])).toBeNull()
    const up = { ...down, direction: 'up' as const }
    expect(computeClaimFigure(up, [today, yesterday])?.value).toBe('11')
    const adopted = reportFor([yesterday, today], {
      anthropic: claimResponse({ recommendations: [up] }),
      google: claimResponse({ recommendations: [up] }),
      xai: claimResponse({ recommendations: [down] }),
    })
    expect(adopted.recommendations).toHaveLength(1)
    expect(adopted.recommendations[0]?.supporters[0]?.solution).toContain('11%')
    expect(adopted.recommendations[0]?.supporters[0]?.solution).toContain('ارتفاع')
    expect(JSON.stringify(adopted.recommendations)).not.toContain('هبوط')
    expect(JSON.stringify(adopted.recommendations)).not.toContain('-10')
  })

  it('rejects a same-day change and a mix of KWD and orders', () => {
    const sameDay = structuredClaim([today, salmiya], {
      action: 'close',
      operation: 'pct_change',
      direction: 'down',
      targetType: 'branch',
      targetName: 'avenues',
    })
    const mixed = structuredClaim([today, orders], {
      action: 'close',
      operation: 'pct_change',
      direction: 'down',
      targetType: 'branch',
      targetName: 'avenues',
    })
    expect(computeClaimFigure(sameDay, [today, salmiya])).toBeNull()
    expect(computeClaimFigure(mixed, [today, orders])).toBeNull()
    const reviewed = reviewModelText({
      provider: 'anthropic',
      modelId: 'a',
      text: claimResponse({ recommendations: [sameDay, mixed] }),
      facts: [today, salmiya, orders],
    })
    expect(reviewed.recommendations).toEqual([])
    expect(reviewed.status).toBe('rejected')
  })

  it('keeps a share when the cited ids are reversed', () => {
    const part = fact('part|avenues|2026-11-15', '50')
    const whole = fact('part|company|2026-11-15', '200')
    const claim = structuredClaim([part, whole], {
      operation: 'share',
      direction: 'flat',
      targetType: 'branch',
      targetName: 'avenues',
    })
    claim.cited_fact_ids = [whole.id, part.id]
    expect(computeClaimFigure(claim, [whole, part])?.value).toBe('25')
  })
})

describe('phase 10 target type', () => {
  it('rejects a product close cited from an hour bucket and a staff cut cited from a branch', () => {
    const hour: BriefFact = {
      id: 'hourly_net_sales_kwd|13|2026-11-15',
      metric: 'hourly_net_sales_kwd',
      period: '2026-11-15',
      scope: '13',
      value: '120',
      unit: 'KWD',
    }
    const branch = fact('net_sales_kwd|avenues|2026-11-15', '1000')
    const productClose: StructuredClaim = {
      action: 'close',
      target: { type: 'product', odoo_id: 13 },
      metric: hour.metric,
      direction: 'flat',
      polarity: 'do',
      cited_fact_ids: [hour.id],
    }
    const staffCut: StructuredClaim = {
      action: 'cut',
      target: { type: 'staff', name: 'avenues' },
      metric: branch.metric,
      direction: 'flat',
      polarity: 'do',
      cited_fact_ids: [branch.id],
    }
    const metricName: StructuredClaim = {
      action: 'close',
      target: { type: 'branch', name: branch.metric },
      metric: branch.metric,
      direction: 'flat',
      polarity: 'do',
      cited_fact_ids: [branch.id],
    }
    for (const claim of [productClose, staffCut, metricName]) {
      const reviewed = reviewModelText({
        provider: 'anthropic',
        modelId: 'a',
        text: claimResponse({ recommendations: [claim] }),
        facts: [hour, branch],
      })
      expect(reviewed.recommendations).toEqual([])
      expect(JSON.stringify(reviewed)).not.toContain('Close product')
      expect(JSON.stringify(reviewed)).not.toContain('Cut staff')
    }
  })
})

describe('phase 10 consensus', () => {
  it('keeps a 2-of-3 agreement when a third model adds an unrelated claim', () => {
    const sales = fact('net_sales_kwd|avenues|2026-11-15', '1000')
    const close = claimResponse({
      recommendations: [structuredClaim([sales], { action: 'close', targetType: 'branch', targetName: 'avenues' })],
    })
    const monitor = claimResponse({
      recommendations: [structuredClaim([sales], { action: 'monitor', targetType: 'branch', targetName: 'avenues' })],
    })
    const report = reportFor([sales], { anthropic: close, google: close, xai: monitor })
    expect(report.recommendations).toHaveLength(1)
    expect(report.recommendations[0]?.supporters).toHaveLength(2)
    expect(report.disputed).toEqual([])
    expect(report.dropped).toHaveLength(1)
  })
})

describe('phase 10 advisory', () => {
  it('drops single-model uncited advice from the brief and from a stored report', () => {
    const sales = fact('net_sales_kwd|avenues|2026-11-15', '1000')
    const advice = 'Close the Avenues branch now; sales fell by half and staff should be cut by forty percent.'
    const arabic = 'أغلق فرع الأفنيوز فوراً فقد انخفضت مبيعاته إلى النصف'
    const reviewed = reviewModelText({
      provider: 'anthropic',
      modelId: 'a',
      text: JSON.stringify({
        findings: [],
        recommendations: [],
        advisory: [
          { topic: 'organization', text: advice },
          { topic: 'strategic_plan', text: arabic },
        ],
      }),
      facts: [sales],
    })
    const report = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'manual',
      periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
      sections: [],
      facts: [sales],
      models: [reviewed],
    })
    expect(report.advisory).toEqual([])
    expect(report.proposals).toEqual([])
    expect(JSON.stringify(report)).not.toContain(advice)
    expect(JSON.stringify(report)).not.toContain(arabic)
    const stored = parseStoredBrief(
      JSON.stringify({
        generatedAt: '2026-11-16T03:00:00.000Z',
        trigger: 'manual',
        configuration: 'configured',
        missingKeys: [],
        odoo: 'linked',
        periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
        sections: [],
        findings: [],
        recommendations: [],
        models: [{ provider: 'anthropic', modelId: 'a', status: 'ran', errorCode: null }],
        advisory: [{ topic: 'organization', text: advice, provider: 'anthropic', modelId: 'a', kind: 'opinion' }],
        proposals: [
          { id: 'p1', text: advice, provider: 'anthropic', modelId: 'a', status: 'proposed', kind: 'opinion' },
        ],
      }),
    )
    expect(stored?.advisory).toEqual([])
    expect(stored?.proposals).toEqual([])
    expect(JSON.stringify(stored)).not.toContain(advice)
  })
})

function comparable(input: Partial<ComparableFact> & Pick<ComparableFact, 'id' | 'entityId' | 'value'>): ComparableFact {
  return {
    metric: 'net_sales_kwd',
    period: '2026-11-15',
    date: '2026-11-15',
    unit: 'KWD',
    entityType: 'branch',
    entityName: input.entityId,
    ...input,
  }
}

describe('phase 10 feryal comparisons', () => {
  const avenues = comparable({ id: 'net_sales_kwd|avenues|2026-11-15', entityId: 'avenues', value: '1000' })
  const salmiya = comparable({ id: 'net_sales_kwd|salmiya|2026-11-15', entityId: 'salmiya', value: '400' })

  it('rejects a relation that contradicts the cited numbers and a name used as a fact id', () => {
    expect(
      comparisonMatchesFacts(
        {
          subject_id: 'salmiya',
          relation: 'better',
          object_id: 'avenues',
          metric: 'net_sales_kwd',
          cited_fact_ids: [salmiya.id, avenues.id],
        },
        [avenues, salmiya],
      ),
    ).toBe(false)
    expect(
      comparisonMatchesFacts(
        {
          subject_id: 'avenues',
          relation: 'better',
          object_id: 'salmiya',
          metric: 'net_sales_kwd',
          cited_fact_ids: [avenues.id, salmiya.id],
        },
        [avenues, salmiya],
      ),
    ).toBe(true)
    expect(
      comparisonMatchesFacts(
        {
          subject_id: 'Avenues',
          relation: 'better',
          object_id: 'Salmiya',
          metric: 'net_sales',
          cited_fact_ids: ['Avenues'],
        },
        [avenues, salmiya],
      ),
    ).toBe(false)
  })

  it('adopts a true comparison from the real agent payload and rejects a false one', async () => {
    const cube = periodCube()
    const dataSource: Partial<FeryalOdooDataSource> = { fetchPeriodCube: async () => cube }
    const agent = await askFeryalOdooAgent({
      question: 'مبيعات الفروع 2026-11-15',
      userSub: 'phase10',
      userRole: 'admin',
      referenceNowMs: Date.parse('2026-11-16T06:00:00.000Z'),
      skipAuditLog: true,
      dataSource,
    })
    expect(agent).not.toHaveProperty('records')
    expect(agent.status).toBe('answered')
    const fromStructured = numericFactsFromStructured(
      {
        period: { from: '2026-11-15', to: '2026-11-15' },
        branches: [
          { id: 'avenues', nameAr: 'الأفنيوز', netKwd: 1000, orders: 100 },
          { id: 'salmiya', nameAr: 'السالمية', netKwd: 400, orders: 40 },
        ],
      },
      agent.period,
    )
    const avenuesFact = agent.facts.find((item) => item.entityId === 'avenues' && item.metric === 'net_sales_kwd')
    const salmiyaFact = agent.facts.find((item) => item.entityId === 'salmiya' && item.metric === 'net_sales_kwd')
    expect(avenuesFact?.id).toBe(fromStructured.find((item) => item.entityId === 'avenues')?.id)
    expect(avenuesFact?.value).toBe('1000')
    expect(salmiyaFact?.value).toBe('400')
    const validContract = JSON.stringify({
      answer_ar: 'الأفنيوز سجل 1000 د.ك مقابل 400 د.ك في السالمية بفارق 600 د.ك.',
      claims: [
        {
          text: 'الأفنيوز سجل 1000 د.ك مقابل 400 د.ك في السالمية بفارق 600 د.ك.',
          numbers: [
            { value: 1000, section: 'branches' },
            { value: 400, section: 'branches' },
            { value: 600, section: 'branches' },
          ],
        },
      ],
      proposals: [{ text: 'توجيه حملات الساعات الهادئة لفرع السالمية.', owner: 'مدير العمليات', kind: 'proposal' }],
      missing_metrics: [],
    })
    const falseContract = JSON.stringify({
      answer_ar: 'السالمية سجل 9999 د.ك.',
      claims: [{ text: 'السالمية سجل 9999 د.ك.', numbers: [{ value: 9999, section: 'branches' }] }],
      proposals: [],
      missing_metrics: [],
    })
    const reviewerOk = JSON.stringify({ status: 'ok', note: '' })
    const adopted = await runCouncil(agent, {
      anthropic: falseContract,
      google: validContract,
      xai: reviewerOk,
    })
    expect(adopted.status).toBe('answered')
    expect(adopted.agreed.map((item) => item.provider).sort()).toEqual(['google', 'xai'])
    expect(adopted.reply).toContain('1000')
    expect(adopted.reply).toContain('600')
    expect(adopted.reply).not.toContain('9999')
    expect(adopted.participants.find((item) => item.provider === 'anthropic')?.status).toBe('guard_rejected')

    const rejected = await runCouncil(agent, {
      anthropic: falseContract,
      google: falseContract,
      xai: falseContract,
    })
    expect(rejected.status).toBe('answered')
    expect(rejected.agreed).toEqual([])
    expect(rejected.participants.every((item) => item.status === 'guard_rejected')).toBe(true)
    expect(rejected.reply).toContain(COUNCIL_MODEL_FALLBACK_NOTE)
    expect(rejected.reply).not.toContain('9999')
  })
})

function runCouncil(
  agent: Awaited<ReturnType<typeof askFeryalOdooAgent>>,
  texts: Record<'anthropic' | 'google' | 'xai', string>,
) {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input)
    const provider = url.includes('api.anthropic.com') ? 'anthropic' : url.includes('generativelanguage') ? 'google' : 'xai'
    const text = texts[provider]
    if (provider === 'anthropic') {
      return Response.json({ model: 'claude-test', content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 } })
    }
    if (provider === 'google') {
      return Response.json({ modelVersion: 'gemini-test', candidates: [{ content: { parts: [{ text }] } }] })
    }
    return Response.json({ model: 'grok-test', choices: [{ message: { content: text } }] })
  }
  return runFeryalCouncil(
    { question: 'مبيعات الفروع 2026-11-15', userId: 'phase10', userRole: 'admin' },
    {
      askOdoo: (async () => agent) as RunCouncilOptions['askOdoo'],
      fetchImpl,
      timeoutMs: 1_000,
      persist: async () => undefined,
      keys: {
        anthropic: 'test-anthropic-council-key',
        google: 'test-google-council-key',
        xai: 'test-grok-council-key',
      },
      models: { anthropic: 'claude-test', google: 'gemini-test', xai: 'grok-test' },
    },
  )
}

function periodCube(): OdooPeriodCube {
  const channels = () => ({
    'dine-in': { netKwd: 0, orders: 0 },
    'takeaway-direct': { netKwd: 0, orders: 0 },
    'talabat-tgo': { netKwd: 0, orders: 0 },
    'talabat-tmp': { netKwd: 0, orders: 0 },
    keeta: { netKwd: 0, orders: 0 },
    deliveroo: { netKwd: 0, orders: 0 },
    jahez: { netKwd: 0, orders: 0 },
    snoonu: { netKwd: 0, orders: 0 },
  })
  const branch = (netKwd: number, orders: number) => ({ netKwd, orders, aovKwd: orders ? netKwd / orders : 0, channels: channels() })
  const brand = () => ({ netKwd: 0, qty: 0, linesCount: 0, orders: 0, avgDiscountPct: 0, discountKwd: 0 })
  return {
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    odooCompanyId: 1,
    lastSyncAt: '2026-11-16T06:00:00.000Z',
    isStale24h: false,
    dateRange: { from: '2026-11-15', to: '2026-11-15' },
    days: 1,
    totals: {
      netSalesKwd: 1400,
      orders: 140,
      aovKwd: 10,
      mappedBranchesNetKwd: 1400,
      mappedBranchesOrders: 140,
      unattributedSalesKwd: 0,
      unattributedOrders: 0,
      excludedEntitiesKwd: 0,
      excludedEntitiesOrders: 0,
      totalDiscountKwd: 0,
      avgDiscountPct: 0,
      discountedLinesCount: 0,
    },
    byBranch: {
      avenues: branch(1000, 100),
      salmiya: branch(400, 40),
      '360-mall': branch(0, 0),
      assima: branch(0, 0),
      promenade: branch(0, 0),
      'al-kout': branch(0, 0),
      ardiya: branch(0, 0),
      'school-canteens': branch(0, 0),
    },
    unattributed: {
      id: 'unattributed',
      labelAr: 'غير منسوب لفرع',
      labelEn: 'Unattributed to Branch',
      netKwd: 0,
      orders: 0,
      aovKwd: 0,
      channels: channels(),
    },
    byBrand: {
      'china-garden': brand(),
      franks: brand(),
      tahina: brand(),
      'farm-brown': brand(),
      'noodle-bar': brand(),
      'karak-cafeteria': brand(),
    },
    brandByBranch: {},
    byChannel: channels(),
    dailySeries: [],
    dailyByBranch: {},
    dailyUnattributed: {},
    hourlySeries: [],
    hourlyByBranch: {},
    topProducts: [],
  }
}
