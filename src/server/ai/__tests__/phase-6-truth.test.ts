import { describe, expect, it } from 'vitest'
import { claimResponse, structuredClaim } from '@/server/ai/__tests__/claim-fixture'
import type { FeryalContextPack } from '@/lib/feryal-context-types'
import { assembleBriefReport, reviewModelText } from '@/server/ai/consensus'
import { runFeryalCouncil, type RunCouncilOptions } from '@/server/ai/council'
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

function makePhase6Pack(): FeryalContextPack {
  const src = { model: 'pos.order', period: { from: '2026-11-15', to: '2026-11-15' }, lastSyncAt: '2026-11-16T00:00:00.000Z' }
  const unavail = (model: string) => ({ status: 'unavailable' as const, reason: 'not_loaded', source: { ...src, model } })
  return {
    generatedAtIso: '2026-11-16T00:00:00.000Z',
    connected: true,
    period: { from: '2026-11-15', to: '2026-11-15', days: 1, labelAr: '2026-11-15', labelEn: '2026-11-15' },
    previousPeriod: { from: '2026-11-14', to: '2026-11-14' },
    elapsedDaysInMonth: 15,
    totalDaysInMonth: 30,
    companyTotals: { status: 'ok', source: src, data: { netSalesKwd: 14.5, orders: 14, aovKwd: 1.036, mappedBranchesNetKwd: 14.5, unattributedSalesKwd: 0 } },
    branches: {
      status: 'ok',
      source: src,
      data: {
        items: [
          { branchId: 'avenues', nameAr: 'الأفنيوز', nameEn: 'Avenues', netKwd: 10.5, orders: 10, aovKwd: 1.05, group: 'restaurant' },
          { branchId: 'salmiya', nameAr: 'السالمية', nameEn: 'Salmiya', netKwd: 4, orders: 4, aovKwd: 1, group: 'restaurant' },
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

function makePhase6AgentResult(pack: FeryalContextPack) {
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
      id: 'audit-p6',
      timestampIso: '2026-11-16T00:00:00.000Z',
      userSub: 'p6',
      userRole: 'admin',
      question: 'قارن الأفنيوز والسالمية',
      status: 'answered' as const,
      executedQueries: [],
      verifier: { valid: true, extractedNumbers: [10.5], unverifiedNumbers: [] },
      finalReply: 'صافي المبيعات 10.5',
    },
  }
}

describe('phase 6 feryal agreement', () => {
  const keys = {
    anthropic: 'test-anthropic-key-0001',
    google: 'test-google-key-00000001',
    xai: 'test-grok-key-0000000001',
  }
  const models = { anthropic: 'claude', google: 'gemini', xai: 'grok' }
  const primaryJson = JSON.stringify({
    answer_ar: 'الأفنيوز سجل 10.5 د.ك مقابل 4 د.ك في السالمية.',
    claims: [{ text: 'الأفنيوز سجل 10.5 د.ك مقابل 4 د.ك في السالمية.', numbers: [{ value: 10.5, section: 'branches' }, { value: 4, section: 'branches' }] }],
    proposals: [{ text: 'مراجعة ورديات السالمية لرفع المتوسط.', owner: 'مدير العمليات', kind: 'proposal' }],
    missing_metrics: [],
  })

  it('answers from the primary grounded provider even when the reviewer flags (no 2-of-3 gate)', async () => {
    const pack = makePhase6Pack()
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url.includes('api.anthropic.com')) {
        return Response.json({ model: 'claude', content: [{ type: 'text', text: primaryJson }], usage: { input_tokens: 1, output_tokens: 1 } })
      }
      return Response.json({
        modelVersion: 'gemini',
        candidates: [{ content: { parts: [{ text: JSON.stringify({ status: 'flag', note: 'راجع أداء السالمية' }) }] } }],
      })
    }
    const result = await runFeryalCouncil(
      { question: 'قارن الأفنيوز والسالمية', userId: 'u1', userRole: 'admin' },
      {
        askOdoo: (async () => makePhase6AgentResult(pack)) as RunCouncilOptions['askOdoo'],
        fetchImpl,
        keys,
        models,
        persist: async () => undefined,
      },
    )
    expect(result.status).toBe('answered')
    expect(result.agreed.map((item) => item.provider)).toEqual(['anthropic'])
    expect(result.reply).toContain('10.5')
    expect(result.reply).toContain('ملاحظة المراجع: راجع أداء السالمية')
    expect(result.reply).not.toContain('لا اتفاق')
  })

  it('lists primary and approving reviewer in agreed without calling extra providers', async () => {
    const pack = makePhase6Pack()
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url.includes('api.anthropic.com')) {
        return Response.json({ model: 'claude', content: [{ type: 'text', text: primaryJson }], usage: { input_tokens: 1, output_tokens: 1 } })
      }
      if (url.includes('generativelanguage.googleapis.com')) {
        return Response.json({
          modelVersion: 'gemini',
          candidates: [{ content: { parts: [{ text: JSON.stringify({ status: 'ok', note: '' }) }] } }],
        })
      }
      throw new Error('xai should not be called when primary and reviewer succeed')
    }
    const result = await runFeryalCouncil(
      { question: 'قارن الأفنيوز والسالمية', userId: 'u1', userRole: 'admin' },
      {
        askOdoo: (async () => makePhase6AgentResult(pack)) as RunCouncilOptions['askOdoo'],
        fetchImpl,
        keys,
        models,
        persist: async () => undefined,
      },
    )
    expect(result.status).toBe('answered')
    expect(result.agreed.map((item) => item.provider).sort()).toEqual(['anthropic', 'google'])
    expect(result.participants.some((item) => item.provider === 'xai')).toBe(false)
    expect(result.reply).toContain('الأفنيوز سجل 10.5 د.ك')
    expect(result.reply).toContain('اقتراح')
  })
})
