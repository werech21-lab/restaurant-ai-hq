import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { runBackgroundAnalysis, type BriefSources } from '@/server/ai/brief'
import { assembleBriefReport, reviewModelText } from '@/server/ai/consensus'
import type { CouncilKeys } from '@/server/ai/env'
import { buildBriefFactPack, kuwaitBriefDays, type BriefCubeInput } from '@/server/ai/facts'
import type { CouncilModels } from '@/server/ai/models'
import type { AiDailyBriefDraft, AiRunDraft } from '@/server/ai/persist'

const NOW = Date.parse('2026-11-16T03:00:00.000Z')
const KEYS: CouncilKeys = {
  anthropic: 'test-anthropic-key-0001',
  google: 'test-google-key-00000001',
  xai: 'test-provider-c-key-0001',
}
const MODELS: CouncilModels = {
  anthropic: 'claude-sonnet-4-6',
  google: 'gemini-3.1-pro-preview',
  xai: 'grok-4',
}
const RETURNED = {
  anthropic: 'claude-sonnet-4-6-20251101',
  google: 'gemini-3.1-pro-preview-001',
  xai: 'grok-4-0709',
}

function cube(date: string, net: number, accounting?: BriefCubeInput['accounting']): BriefCubeInput {
  return {
    connected: true,
    noData: false,
    dateRange: { from: date, to: date },
    totals: { netSalesKwd: net, orders: 3 },
    byBranch: {
      avenues: { netKwd: net, orders: 2 },
      '360-mall': { netKwd: 1.25, orders: 1 },
    },
    byBrand: { 'china-garden': { netKwd: net } },
    unattributed: { netKwd: 0.5, orders: 1 },
    hourlySeries: [
      { hour: 13, netKwd: 4.5, orders: 2 },
      { hour: 3, netKwd: 0, orders: 0 },
    ],
    topProducts: [
      { productId: 9, name: 'Noodles', netKwd: 4.5 },
      { productId: 8, name: 'هايزنبرغ', netKwd: 9 },
      { productId: 7, name: 'Unsold', netKwd: 0 },
    ],
    accounting,
  }
}

function packFor(accounting?: BriefCubeInput['accounting']) {
  const days = kuwaitBriefDays(NOW)
  return buildBriefFactPack({
    yesterday: days.yesterday,
    prior: days.prior,
    current: cube(days.yesterday, 10.5, accounting),
    priorCube: cube(days.prior, 8.25, accounting),
    purchases: { connected: true, noData: false, totals: { totalAmountKwd: 6.75 } },
    receivables: { readable: true, openReceivableKwd: 2.5 },
  })
}

function claim(factIds: string[], values: string[], stance: 'support' | 'dispute' = 'support'): string {
  const quoted = values.join(' و ')
  return JSON.stringify({
    findings: [{ factIds, text: `ملاحظة ${quoted}` }],
    recommendations: [{ factIds, solution: `إجراء ${quoted}`, stance }],
  })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function analysisBody(provider: 'anthropic' | 'google' | 'xai', text: string): Response {
  if (provider === 'anthropic') {
    return jsonResponse({
      model: RETURNED.anthropic,
      content: [{ type: 'text', text }],
      usage: { input_tokens: 20, output_tokens: 10 },
    })
  }
  if (provider === 'google') {
    return jsonResponse({
      modelVersion: RETURNED.google,
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 8 },
    })
  }
  return jsonResponse({
    model: RETURNED.xai,
    choices: [{ message: { content: text } }],
    usage: { prompt_tokens: 18, completion_tokens: 6 },
  })
}

function providerOf(url: string): 'anthropic' | 'google' | 'xai' | null {
  if (url.includes('api.anthropic.com')) return 'anthropic'
  if (url.includes('generativelanguage.googleapis.com')) return 'google'
  if (url.includes('api.x.ai')) return 'xai'
  return null
}

describe('background Odoo brief', () => {
  it('schedules the morning run in Kuwait and keeps it on unless the flag is off', () => {
    const vercel = JSON.parse(readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8')) as {
      crons: { path: string; schedule: string }[]
    }
    expect(vercel.crons.find((cron) => cron.path === '/api/cron/ai-daily-brief')?.schedule).toBe('0 3 * * *')
    const days = kuwaitBriefDays(NOW)
    expect(days).toEqual({ yesterday: '2026-11-15', prior: '2026-11-14' })
  })

  it('keeps only real Odoo rows and omits unlinked cost figures', () => {
    const pack = packFor({
      available: true,
      glIncomplete: true,
      cogs: 99,
      deliveryCommissions: 50,
      aggregatorCommissionUnposted: true,
    })
    const values = pack.facts.map((fact) => fact.value)
    expect(pack.facts.some((fact) => fact.scope === 'avenues' && fact.period === '2026-11-15' && fact.value === '10.5')).toBe(true)
    expect(pack.facts.some((fact) => fact.scope === 'avenues' && fact.period === '2026-11-14' && fact.value === '8.25')).toBe(true)
    expect(pack.facts.some((fact) => fact.metric === 'brand_net_sales_kwd' && fact.scope === 'china-garden')).toBe(true)
    expect(pack.facts.some((fact) => fact.metric === 'product_net_sales_kwd' && fact.scope === 'Noodles')).toBe(true)
    expect(pack.facts.some((fact) => fact.scope === 'هايزنبرغ' || fact.scope === 'Unsold')).toBe(false)
    expect(pack.facts.some((fact) => fact.metric === 'hourly_net_sales_kwd' && fact.scope === '13')).toBe(true)
    expect(pack.facts.some((fact) => fact.metric === 'hourly_net_sales_kwd' && fact.scope === '3')).toBe(false)
    expect(pack.facts.some((fact) => fact.metric === 'purchase_total_kwd' && fact.value === '6.75')).toBe(true)
    expect(pack.facts.some((fact) => fact.metric === 'open_receivable_kwd' && fact.value === '2.5')).toBe(true)
    expect(values).not.toContain('99')
    expect(values).not.toContain('50')
    expect(pack.sections.find((section) => section.id === 'cogs')?.status).toBe('unverified')
    expect(pack.sections.find((section) => section.id === 'commissions')?.status).toBe('unverified')
    expect(pack.sections.find((section) => section.id === 'receivables_aging')?.status).toBe('unverified')
  })

  it('includes posted cost and commission figures when the ledger is complete', () => {
    const pack = packFor({
      available: true,
      glIncomplete: false,
      cogs: 3.5,
      deliveryCommissions: 1.5,
      aggregatorCommissionUnposted: false,
    })
    expect(pack.facts.some((fact) => fact.metric === 'cogs_kwd' && fact.value === '3.5')).toBe(true)
    expect(pack.facts.some((fact) => fact.metric === 'delivery_commission_kwd' && fact.value === '1.5')).toBe(true)
  })

  it('keeps a recommendation only when two models cite the same facts', () => {
    const pack = packFor()
    const yesterday = pack.facts.find((fact) => fact.scope === 'avenues' && fact.period === '2026-11-15' && fact.metric === 'net_sales_kwd')
    const prior = pack.facts.find((fact) => fact.scope === 'avenues' && fact.period === '2026-11-14' && fact.metric === 'net_sales_kwd')
    expect(yesterday && prior).toBeTruthy()
    const pair = [yesterday!.id, prior!.id]
    const agreed = reviewModelText({
      provider: 'anthropic',
      modelId: RETURNED.anthropic,
      text: claim(pair, [yesterday!.value, prior!.value]),
      facts: pack.facts,
    })
    const also = reviewModelText({
      provider: 'google',
      modelId: RETURNED.google,
      text: claim(pair, [prior!.value, yesterday!.value]),
      facts: pack.facts,
    })
    const alone = reviewModelText({
      provider: 'xai',
      modelId: RETURNED.xai,
      text: claim([yesterday!.id], [yesterday!.value]),
      facts: pack.facts,
    })
    const report = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'schedule',
      periods: pack.periods,
      sections: pack.sections,
      facts: pack.facts,
      models: [agreed, also, alone],
    })
    expect(report.recommendations).toHaveLength(1)
    expect(report.recommendations[0].supporters.map((item) => item.provider).sort()).toEqual(['anthropic', 'google'])
    expect(report.recommendations[0].citations.map((item) => item.value).sort()).toEqual(['10.5', '8.25'])
    expect(report.dropped.map((item) => item.provider)).toEqual(['xai'])
    expect(report.disputed).toHaveLength(0)
  })

  it('marks a contested recommendation as disputed and drops a single supporter', () => {
    const pack = packFor()
    const fact = pack.facts.find((item) => item.scope === 'company' && item.metric === 'purchase_total_kwd')
    expect(fact).toBeTruthy()
    const support = reviewModelText({
      provider: 'anthropic',
      modelId: 'model-a',
      text: claim([fact!.id], [fact!.value], 'support'),
      facts: pack.facts,
    })
    const dispute = reviewModelText({
      provider: 'google',
      modelId: 'model-b',
      text: claim([fact!.id], [fact!.value], 'dispute'),
      facts: pack.facts,
    })
    const report = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'manual',
      periods: pack.periods,
      sections: pack.sections,
      facts: pack.facts,
      models: [support, dispute],
    })
    expect(report.recommendations).toHaveLength(0)
    expect(report.disputed).toHaveLength(1)
    expect(report.disputed[0].support.map((item) => item.provider)).toEqual(['anthropic'])
    expect(report.disputed[0].dispute.map((item) => item.provider)).toEqual(['google'])
  })

  it('rejects a number or a name that is not in the cited facts', () => {
    const pack = packFor()
    const fact = pack.facts.find((item) => item.scope === 'Noodles')
    expect(fact).toBeTruthy()
    const invented = reviewModelText({
      provider: 'google',
      modelId: 'model-b',
      text: claim([fact!.id], ['999.9']),
      facts: pack.facts,
    })
    const excluded = reviewModelText({
      provider: 'anthropic',
      modelId: 'model-a',
      text: JSON.stringify({
        findings: [],
        recommendations: [{ factIds: [fact!.id], solution: `إجراء ${fact!.value} هايزنبرغ`, stance: 'support' }],
      }),
      facts: pack.facts,
    })
    const uncited = reviewModelText({
      provider: 'xai',
      modelId: 'model-c',
      text: JSON.stringify({
        findings: [],
        recommendations: [{ factIds: [], solution: 'راجع التسعير عموماً', stance: 'support' }],
      }),
      facts: pack.facts,
    })
    expect(invented.status).toBe('rejected')
    expect(invented.errorCode).toBe('GUARD_REJECTED')
    expect(excluded.status).toBe('rejected')
    expect(uncited.status).toBe('rejected')
  })

  it('does not call a provider when a key is missing and says not configured', async () => {
    let reads = 0
    let fetches = 0
    const sources: BriefSources = {
      fetchCube: async () => {
        reads += 1
        return null
      },
      fetchPurchases: async () => {
        reads += 1
        return null
      },
      fetchReceivables: async () => {
        reads += 1
        return null
      },
    }
    const saved: AiDailyBriefDraft[] = []
    const result = await runBackgroundAnalysis(
      { trigger: 'schedule', userId: 'system:daily-brief', referenceNowMs: NOW },
      {
        keys: { ...KEYS, xai: 'missing' },
        sources,
        fetchImpl: async () => {
          fetches += 1
          throw new Error('should not fetch')
        },
        persistReport: async (brief) => {
          saved.push(brief)
        },
        persistRuns: async () => {
          throw new Error('no runs')
        },
      },
    )
    expect(result.status).toBe('not_configured')
    expect(result.report.missingKeys).toEqual(['XAI_API_KEY'])
    expect(result.report.models.map((model) => model.status)).toEqual(['not_configured', 'not_configured', 'not_configured'])
    expect(reads).toBe(0)
    expect(fetches).toBe(0)
    expect(saved[0]?.status).toBe('not_configured')
  })

  it('does not call models when Odoo has no linked facts', async () => {
    let fetches = 0
    const result = await runBackgroundAnalysis(
      { trigger: 'manual', userId: 'admin-1', referenceNowMs: NOW },
      {
        keys: KEYS,
        models: MODELS,
        sources: {
          fetchCube: async () => ({ connected: false, noData: true }),
          fetchPurchases: async () => null,
          fetchReceivables: async () => ({ readable: false }),
        },
        fetchImpl: async () => {
          fetches += 1
          throw new Error('should not fetch')
        },
        persistReport: async () => undefined,
        persistRuns: async () => undefined,
      },
    )
    expect(result.status).toBe('no_odoo_data')
    expect(result.report.recommendations).toHaveLength(0)
    expect(result.report.models.map((model) => model.status)).toEqual(['not_called', 'not_called', 'not_called'])
    expect(fetches).toBe(0)
  })

  it('stores the returned model ids and only the two-model recommendation', async () => {
    const days = kuwaitBriefDays(NOW)
    const pack = packFor()
    const fact = pack.facts.find((item) => item.scope === 'avenues' && item.period === days.yesterday && item.metric === 'net_sales_kwd')
    expect(fact).toBeTruthy()
    const texts = {
      anthropic: claim([fact!.id], [fact!.value]),
      google: claim([fact!.id], [fact!.value]),
      xai: 'this is not json',
    }
    const saved: AiDailyBriefDraft[] = []
    const runs: AiRunDraft[] = []
    const result = await runBackgroundAnalysis(
      { trigger: 'schedule', userId: 'system:daily-brief', referenceNowMs: NOW },
      {
        keys: KEYS,
        models: MODELS,
        sources: {
          fetchCube: async (from) => cube(from, from === days.yesterday ? 10.5 : 8.25, {
            available: false,
            glIncomplete: true,
            aggregatorCommissionUnposted: true,
          }),
          fetchPurchases: async () => ({ connected: true, noData: false, totals: { totalAmountKwd: 6.75 } }),
          fetchReceivables: async () => ({ readable: true, openReceivableKwd: 2.5 }),
        },
        fetchImpl: async (input) => {
          const provider = providerOf(String(input))
          if (!provider) throw new Error('unknown provider')
          return analysisBody(provider, texts[provider])
        },
        persistReport: async (brief) => {
          saved.push(brief)
        },
        persistRuns: async (rows) => {
          runs.push(...rows)
        },
      },
    )
    expect(result.status).toBe('reported')
    expect(result.report.recommendations).toHaveLength(1)
    expect(result.report.recommendations[0].supporters.map((item) => `${item.provider}/${item.modelId}`).sort()).toEqual([
      `anthropic/${RETURNED.anthropic}`,
      `google/${RETURNED.google}`,
    ])
    expect(result.report.models.find((model) => model.provider === 'xai')).toMatchObject({
      status: 'rejected',
      modelId: RETURNED.xai,
      errorCode: 'BAD_RESPONSE',
    })
    expect(saved[0]?.status).toBe('reported')
    expect(runs.map((run) => run.modelId).sort()).toEqual(Object.values(RETURNED).sort())
    expect(runs.find((run) => run.provider === 'xai')?.status).toBe('guard_rejected')
  })
})
