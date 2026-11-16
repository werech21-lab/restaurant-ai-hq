import { describe, expect, it } from 'vitest'
import { assembleBriefReport, reviewModelText } from '@/server/ai/consensus'
import { runBackgroundAnalysis } from '@/server/ai/brief'
import { kuwaitBriefDays, type BriefCubeInput } from '@/server/ai/facts'
import { guardAnswerNumbers } from '@/server/ai/number-guard'
import type { BriefFact } from '@/server/ai/brief-types'
import type { AiRunDraft } from '@/server/ai/persist'

const KEY = 'phase-three-test-key-01'

function fact(id: string, value: string): BriefFact {
  const [metric, scope, period] = id.split('|')
  return {
    id,
    metric,
    period,
    scope,
    value,
    unit: metric === 'orders' ? 'orders' : 'KWD',
  }
}

describe('phase 3 truth guard', () => {
  it('accepts only the exact decimal from the fact pack', () => {
    const allowed = new Set(['10.5', '4'])
    expect(guardAnswerNumbers('القيمة 10.50', allowed).ok).toBe(true)
    expect(guardAnswerNumbers('القيمة ١٠٫٥', allowed).ok).toBe(true)
    expect(guardAnswerNumbers('القيمة 10.501', allowed)).toMatchObject({ ok: false, offending: ['10.501'] })
    expect(guardAnswerNumbers('القيمة 1e2', allowed).ok).toBe(false)
    expect(guardAnswerNumbers('الطلبات 4', allowed).ok).toBe(true)
  })

  it('keeps a finding only when two models cite the same Odoo value', () => {
    const sales = fact('net_sales_kwd|company|2026-11-15', '40.5')
    const orders = fact('orders|company|2026-11-15', '4')
    const facts = [sales, orders]
    const agreed = JSON.stringify({
      findings: [{ factIds: [sales.id], text: 'صافي المبيعات 40.5' }],
      recommendations: [{ factIds: [sales.id], solution: 'راجع صافي 40.5', stance: 'support' }],
      advisory: [],
    })
    const alone = JSON.stringify({
      findings: [{ factIds: [orders.id], text: 'الطلبات 4' }],
      recommendations: [],
      advisory: [],
    })
    const rejected = JSON.stringify({
      findings: [{ factIds: [sales.id], text: 'صافي المبيعات 99' }],
      recommendations: [],
      advisory: [],
    })
    const anthropic = reviewModelText({ provider: 'anthropic', modelId: 'claude-test', text: agreed, facts })
    const google = reviewModelText({ provider: 'google', modelId: 'gemini-test', text: agreed, facts })
    const xaiAgreed = reviewModelText({ provider: 'xai', modelId: 'grok-test', text: alone, facts })
    const xaiRejected = reviewModelText({ provider: 'xai', modelId: 'grok-test', text: rejected, facts })

    const adopted = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'schedule',
      periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
      sections: [],
      facts,
      models: [anthropic, google, xaiAgreed],
    })
    expect(adopted.findings).toHaveLength(1)
    expect(adopted.findings[0]?.citations[0]?.value).toBe('40.5')
    expect(adopted.findings[0]?.notes.map((note) => note.provider).sort()).toEqual(['anthropic', 'google'])
    expect(adopted.unadoptedFindings.map((item) => item.provider)).toEqual(['xai'])
    expect(adopted.recommendations).toHaveLength(1)
    expect(adopted.recommendations[0]?.supporters).toHaveLength(2)
    expect(xaiRejected.status).toBe('rejected')
    expect(xaiRejected.errorCode).toBe('GUARD_REJECTED')

    const guarded = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'schedule',
      periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
      sections: [],
      facts,
      models: [anthropic, google, xaiRejected],
    })
    expect(guarded.findings).toHaveLength(1)
    expect(guarded.unadoptedFindings).toEqual([])
    expect(JSON.stringify(guarded)).not.toContain('99')
  })

  it('persists one AiRun row per model after the guard', async () => {
    const now = Date.parse('2026-11-16T03:00:00.000Z')
    const periods = kuwaitBriefDays(now)
    const salesId = `net_sales_kwd|company|${periods.yesterday}`
    const cube: BriefCubeInput = {
      connected: true,
      noData: false,
      dateRange: { from: periods.yesterday, to: periods.yesterday },
      totals: { netSalesKwd: 40.5, orders: 4 },
    }
    const agreed = JSON.stringify({
      findings: [{ factIds: [salesId], text: 'صافي المبيعات 40.5' }],
      recommendations: [],
      advisory: [],
    })
    const rejected = JSON.stringify({
      findings: [{ factIds: [salesId], text: 'صافي المبيعات 99' }],
      recommendations: [],
      advisory: [],
    })
    const saved: AiRunDraft[][] = []
    const result = await runBackgroundAnalysis(
      { trigger: 'schedule', userId: 'system:phase-3', referenceNowMs: now },
      {
        keys: { anthropic: KEY, google: KEY, xai: KEY },
        models: { anthropic: 'claude-test', google: 'gemini-test', xai: 'grok-test' },
        sources: {
          fetchCube: async (from) => (from === periods.yesterday ? cube : null),
          fetchPurchases: async () => null,
          fetchReceivables: async () => null,
        },
        persistReport: async () => undefined,
        persistRuns: async (rows) => {
          saved.push([...rows])
        },
        fetchImpl: async (input) => {
          const url = String(input)
          const provider = url.includes('api.anthropic.com') ? 'anthropic' : url.includes('googleapis.com') ? 'google' : 'xai'
          const text = provider === 'xai' ? rejected : agreed
          const body =
            provider === 'anthropic'
              ? { model: 'claude-returned', content: [{ type: 'text', text }] }
              : provider === 'google'
                ? { modelVersion: 'gemini-returned', candidates: [{ content: { parts: [{ text }] } }] }
                : { model: 'grok-returned', choices: [{ message: { content: text } }] }
          return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
        },
      },
    )

    expect(result.status).toBe('reported')
    expect(result.report.findings).toHaveLength(1)
    expect(result.report.findings[0]?.notes).toHaveLength(2)
    expect(saved).toHaveLength(1)
    const runs = saved[0] ?? []
    expect(runs.map((row) => row.provider).sort()).toEqual(['anthropic', 'google', 'xai'])
    expect(runs.find((row) => row.provider === 'anthropic')).toMatchObject({ status: 'ok', modelId: 'claude-returned' })
    expect(runs.find((row) => row.provider === 'google')).toMatchObject({ status: 'ok', modelId: 'gemini-returned' })
    expect(runs.find((row) => row.provider === 'xai')).toMatchObject({
      status: 'guard_rejected',
      modelId: 'grok-returned',
      errorCode: 'GUARD_REJECTED',
    })
    expect(new Set(runs.map((row) => row.questionHash)).size).toBe(1)
  })
})
