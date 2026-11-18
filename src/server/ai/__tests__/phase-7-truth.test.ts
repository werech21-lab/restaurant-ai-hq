import { describe, expect, it } from 'vitest'
import type { FeryalContextPack } from '@/lib/feryal-context-types'
import { assembleBriefReport, reviewModelText } from '@/server/ai/consensus'
import { COUNCIL_MODEL_FALLBACK_NOTE, runFeryalCouncil, type RunCouncilOptions } from '@/server/ai/council'
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
  it('rejects ungrounded free-text provider replies and degrades cleanly to the verified Odoo pack answer', async () => {
    const src = { model: 'pos.order', period: { from: '2026-11-15', to: '2026-11-15' }, lastSyncAt: '2026-11-16T00:00:00.000Z' }
    const unavail = (model: string) => ({ status: 'unavailable' as const, reason: 'not_loaded', source: { ...src, model } })
    const pack: FeryalContextPack = {
      generatedAtIso: '2026-11-16T00:00:00.000Z',
      connected: true,
      period: { from: '2026-11-15', to: '2026-11-15', days: 1, labelAr: '2026-11-15', labelEn: '2026-11-15' },
      previousPeriod: { from: '2026-11-14', to: '2026-11-14' },
      elapsedDaysInMonth: 15,
      totalDaysInMonth: 30,
      companyTotals: { status: 'ok', source: src, data: { netSalesKwd: 1000, orders: 100, aovKwd: 10, mappedBranchesNetKwd: 1000, unattributedSalesKwd: 0 } },
      branches: {
        status: 'ok',
        source: src,
        data: { items: [{ branchId: 'avenues', nameAr: 'الأفنيوز', nameEn: 'Avenues', netKwd: 1000, orders: 100, aovKwd: 10, group: 'restaurant' }] },
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
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url.includes('api.anthropic.com')) {
        return Response.json({ model: 'claude', content: [{ type: 'text', text: 'الأفنيوز هو الأفضل بصافي 1000' }], usage: { input_tokens: 1, output_tokens: 1 } })
      }
      if (url.includes('generativelanguage.googleapis.com')) {
        return Response.json({ modelVersion: 'gemini', candidates: [{ content: { parts: [{ text: 'الأفنيوز هو الأسوأ بصافي 1000' }] } }] })
      }
      return Response.json({ model: 'grok', choices: [{ message: { content: 'نص حر غير مهيكل 1000' } }] })
    }
    const result = await runFeryalCouncil(
      { question: 'شو أداء الأفنيوز؟', userId: 'u7', userRole: 'admin' },
      {
        askOdoo: (async () => ({
          reply: 'صافي 1000',
          status: 'answered',
          executedQueries: [],
          verifier: { valid: true, extractedNumbers: [1000], unverifiedNumbers: [] },
          toolNumbers: [1000],
          period: { from: '2026-11-15', to: '2026-11-15' },
          facts: [],
          source: null,
          contextPack: pack,
          auditEntry: {
            id: 'audit-p7',
            timestampIso: '2026-11-16T00:00:00.000Z',
            userSub: 'u7',
            userRole: 'admin',
            question: 'شو أداء الأفنيوز؟',
            status: 'answered',
            executedQueries: [],
            verifier: { valid: true, extractedNumbers: [1000], unverifiedNumbers: [] },
            finalReply: 'صافي 1000',
          },
        })) as RunCouncilOptions['askOdoo'],
        fetchImpl,
        keys: { anthropic: 'test-anthropic-key-0001', google: 'test-google-key-00000001', xai: 'test-grok-key-0000000001' },
        models: { anthropic: 'claude', google: 'gemini', xai: 'grok' },
        persist: async () => undefined,
      },
    )
    expect(result.status).toBe('answered')
    expect(result.agreed).toEqual([])
    expect(result.participants.every((p) => p.status === 'guard_rejected' && p.errorCode === 'MALFORMED_JSON')).toBe(true)
    expect(result.reply).toContain('صافي 1000')
    expect(result.reply).toContain(COUNCIL_MODEL_FALLBACK_NOTE)
    expect(result.reply).not.toContain('هو الأسوأ')
  })
})
