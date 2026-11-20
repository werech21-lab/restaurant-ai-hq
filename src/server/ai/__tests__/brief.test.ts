import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canTriggerManualOdooSync } from '@/lib/auth/role-access-policy'
import { prisma } from '@/lib/db'
import { claimResponse, structuredClaim } from '@/server/ai/__tests__/claim-fixture'
import { runBackgroundAnalysis, type BriefSources } from '@/server/ai/brief'
import { assembleBriefReport, parseStoredBrief, reviewModelText } from '@/server/ai/consensus'
import type { CouncilKeys } from '@/server/ai/env'
import { buildBriefFactPack, kuwaitBriefDays, type BriefCubeInput } from '@/server/ai/facts'
import { latestManualAtMs, manualRetryAt, MANUAL_RUN_COOLDOWN_MS } from '@/server/ai/manual-run'
import type { CouncilModels } from '@/server/ai/models'
import {
  AI_PG_CONNECT_TIMEOUT_MS,
  COUNCIL_DECISION_BRIEF_TAG,
  configureAiPersistQueryable,
  ensureAiTables,
  isPostgresOnlyAiStore,
  listCouncilDecisionMirrorBriefs,
  listDailyBriefs,
  listLatestDailyBrief,
  persistAiRuns,
  persistDailyBrief,
  releaseManualRunLock,
  safeListAiRuns,
  safeListDailyBriefs,
  tryAcquireManualRunLock,
  upsertCouncilDecisionMirrorBrief,
  type AiDailyBriefDraft,
  type AiRunDraft,
  type AiSqlQueryable,
} from '@/server/ai/persist'

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

function claim(
  facts: Array<{ id: string; scope: string; metric: string; period: string; value: string; unit: 'KWD' | 'orders' }>,
  polarity: 'do' | 'do_not' = 'do',
): string {
  const structured = structuredClaim(facts, { polarity })
  return claimResponse({ findings: [structured], recommendations: [structured] })
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
    expect(pack.sections.find((section) => section.id === 'receivables')?.noteAr).toBe('الرصيد المتبقي المفتوح من Odoo.')
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
      text: claim([yesterday!, prior!]),
      facts: pack.facts,
    })
    const also = reviewModelText({
      provider: 'google',
      modelId: RETURNED.google,
      text: claim([yesterday!, prior!]),
      facts: pack.facts,
    })
    const alone = reviewModelText({
      provider: 'xai',
      modelId: RETURNED.xai,
      text: claim([pack.facts.find((item) => item.metric === 'purchase_total_kwd')!]),
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
    expect(report.findings).toHaveLength(1)
    expect(report.findings[0].notes.map((item) => item.provider).sort()).toEqual(['anthropic', 'google'])
    expect(report.unadoptedFindings.map((item) => item.provider)).toEqual(['xai'])
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
      text: claim([fact!], 'do'),
      facts: pack.facts,
    })
    const dispute = reviewModelText({
      provider: 'google',
      modelId: 'model-b',
      text: claim([fact!], 'do_not'),
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
      text: JSON.stringify({
        findings: [{ factIds: [fact!.id], text: 'راجع 999.9' }],
        recommendations: [],
      }),
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
      anthropic: claim([fact!]),
      google: claim([fact!]),
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
    expect(result.report.findings).toHaveLength(1)
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

  it('keeps advisory opinion separate and saves an app idea only as a proposal', () => {
    const pack = packFor()
    const fact = pack.facts.find((item) => item.metric === 'net_sales_kwd' && item.scope === 'company' && item.period === '2026-11-15')
    expect(fact).toBeTruthy()
    const reviewed = reviewModelText({
      provider: 'anthropic',
      modelId: RETURNED.anthropic,
      text: JSON.stringify({
        findings: [],
        recommendations: [],
        advisory: [
          { topic: 'organization', text: 'رتبوا مسؤولية إغلاق اليوم على مدير الفرع.' },
          { topic: 'strategic_plan', text: `راجعوا اليوم الذي صافي مبيعاته ${fact!.value}.` },
          { topic: 'app_capability', text: 'أضيفوا شاشة توضح المقترحات دون تطبيقها.' },
          { topic: 'organization', text: 'ارفعوا الهدف إلى 999.9.' },
        ],
      }),
      facts: pack.facts,
    })
    const report = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'schedule',
      periods: pack.periods,
      sections: pack.sections,
      facts: pack.facts,
      models: [reviewed],
    })
    expect(reviewed.status).toBe('rejected')
    expect(reviewed.advisory).toEqual([])
    expect(report.findings).toHaveLength(0)
    expect(report.recommendations).toHaveLength(0)
    expect(report.advisory).toEqual([])
    expect(report.proposals).toEqual([])
    expect(JSON.stringify(report)).not.toContain('999.9')
    expect(JSON.stringify(report)).not.toContain('رتبوا مسؤولية')
    const route = readFileSync(path.join(process.cwd(), 'src/app/api/erp/ai-brief/run/route.ts'), 'utf8')
    const brief = readFileSync(path.join(process.cwd(), 'src/server/ai/brief.ts'), 'utf8')
    expect(`${route}\n${brief}`).not.toMatch(/api\.github\.com|octokit/)
    expect(canTriggerManualOdooSync('gm')).toBe(true)
    expect(canTriggerManualOdooSync('admin')).toBe(true)
    expect(canTriggerManualOdooSync('marketing')).toBe(false)
    expect(canTriggerManualOdooSync('auditor')).toBe(false)
  })

  it('rejects advisory whose only content is a number absent from Odoo', () => {
    const reviewed = reviewModelText({
      provider: 'google',
      modelId: RETURNED.google,
      text: JSON.stringify({
        findings: [],
        recommendations: [],
        advisory: [{ topic: 'strategic_plan', text: 'ارفعوا الهدف إلى 999.9.' }],
      }),
      facts: packFor().facts,
    })
    expect(reviewed.status).toBe('rejected')
    expect(reviewed.errorCode).toBe('GUARD_REJECTED')
    expect(reviewed.advisory).toEqual([])
  })

  it('reads an older report and ignores a proposal that is not proposed', () => {
    const parsed = parseStoredBrief(
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
        disputed: [],
        dropped: [],
        models: [{ provider: 'anthropic', modelId: 'claude', status: 'ran', errorCode: null }],
        proposals: [
          {
            id: 'abc',
            text: 'idea',
            provider: 'anthropic',
            modelId: 'claude',
            status: 'applied',
            kind: 'opinion',
          },
        ],
      }),
    )
    expect(parsed?.trigger).toBe('manual')
    expect(parsed?.unadoptedFindings).toEqual([])
    expect(parsed?.advisory).toEqual([])
    expect(parsed?.proposals).toEqual([])
  })

  it('allows a manual run once each ten minutes', () => {
    const now = Date.parse('2026-11-16T03:00:00.000Z')
    const last = latestManualAtMs([
      { createdAtMs: now - 60_000, trigger: 'schedule' },
      { createdAtMs: now - 60_000, trigger: 'manual' },
    ])
    expect(manualRetryAt(last, now)).toBe(new Date(now - 60_000 + MANUAL_RUN_COOLDOWN_MS).toISOString())
    expect(manualRetryAt(last, now - 60_000 + MANUAL_RUN_COOLDOWN_MS)).toBeNull()
    expect(manualRetryAt(latestManualAtMs([{ createdAtMs: now, trigger: 'schedule' }]), now)).toBeNull()
  })

  describe('PostgreSQL ai_daily_briefs & ai_runs persistence (Item 4 + Migration 0055)', () => {
    afterEach(() => {
      configureAiPersistQueryable(undefined)
    })

    it('auto-creates public.ai_daily_briefs and public.ai_runs with TIMESTAMPTZ DDL on 42P01 cold Postgres schema and persists nightly briefs end-to-end', async () => {
      const pglite = new PGlite()
      try {
        await pglite.exec('CREATE ROLE anon; CREATE ROLE authenticated;')
        const executedSql: string[] = []
        const pgAdapter: AiSqlQueryable = {
          async query<R extends Record<string, unknown> = Record<string, unknown>>(
            text: string,
            params?: unknown[],
          ): Promise<{ rows: R[]; rowCount?: number | null }> {
            executedSql.push(text.replace(/\s+/g, ' ').trim())
            const res = await pglite.query<R>(text, params)
            return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length }
          },
        }
        configureAiPersistQueryable(pgAdapter)

        // Cold schema read before tables exist: catches 42P01, runs Postgres TIMESTAMPTZ DDL (never SQLite DATETIME), returns empty
        const emptyBeforeRun = await safeListDailyBriefs(14)
        expect(emptyBeforeRun).toEqual({ briefs: [], error: false })
        expect(await listLatestDailyBrief()).toBeNull()
        expect(executedSql.some((sql) => /TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/i.test(sql))).toBe(true)
        expect(executedSql.every((sql) => !/\bDATETIME\b/i.test(sql))).toBe(true)

        // Fresh cold PGlite where first operation is scheduled nightly runBackgroundAnalysis write (42P01 on INSERT)
        const coldWritePglite = new PGlite()
        try {
          await coldWritePglite.exec('CREATE ROLE anon; CREATE ROLE authenticated;')
          const coldAdapter: AiSqlQueryable = {
            async query<R extends Record<string, unknown> = Record<string, unknown>>(
              text: string,
              params?: unknown[],
            ): Promise<{ rows: R[]; rowCount?: number | null }> {
              const res = await coldWritePglite.query<R>(text, params)
              return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length }
            },
          }
          configureAiPersistQueryable(coldAdapter)

          const days = kuwaitBriefDays(NOW)
          const pack = packFor()
          const fact = pack.facts.find(
            (item) => item.scope === 'avenues' && item.period === days.yesterday && item.metric === 'net_sales_kwd',
          )!
          const claimText = claim([fact])

          const result = await runBackgroundAnalysis(
            { trigger: 'schedule', userId: 'system:daily-brief', referenceNowMs: NOW },
            {
              keys: KEYS,
              models: MODELS,
              sources: {
                fetchCube: async (from) =>
                  cube(from, from === days.yesterday ? 10.5 : 8.25, {
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
                return analysisBody(provider, claimText)
              },
            },
          )

          expect(result.status).toBe('reported')

          const storedList = await safeListDailyBriefs(14)
          expect(storedList.error).toBe(false)
          expect(storedList.briefs).toHaveLength(1)
          expect(storedList.briefs[0]?.status).toBe('reported')
          expect(parseStoredBrief(storedList.briefs[0]!.reply)?.recommendations).toHaveLength(1)

          const adminSnapshot = await safeListAiRuns(50)
          expect(adminSnapshot.error).toBe(false)
          expect(adminSnapshot.source).toBe('postgres')
          expect(adminSnapshot.runs).toHaveLength(3)
          expect(adminSnapshot.brief?.id).toBe(storedList.briefs[0]?.id)

          const rlsState = await coldWritePglite.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
            `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname IN ('ai_daily_briefs', 'ai_runs')
             ORDER BY c.relname`,
          )
          expect(rlsState.rows).toEqual([
            { relname: 'ai_daily_briefs', relrowsecurity: true, relforcerowsecurity: false },
            { relname: 'ai_runs', relrowsecurity: true, relforcerowsecurity: false },
          ])
        } finally {
          await coldWritePglite.close()
        }
      } finally {
        await pglite.close()
      }
    })

    it('persists and reads ai_daily_briefs and ai_runs under migration 0055 as a NOSUPERUSER NOBYPASSRLS table owner', async () => {
      const pglite = new PGlite()
      try {
        await pglite.exec('CREATE ROLE anon; CREATE ROLE authenticated;')
        const migration0055 = await readFile(
          path.join(process.cwd(), 'database', 'migrations', '0055_live_gate_server_rls_and_ai_briefs.sql'),
          'utf8',
        )
        await pglite.exec(migration0055)

        await pglite.exec(`
          CREATE ROLE brief_table_owner NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
          REVOKE CREATE ON SCHEMA public FROM PUBLIC;
          GRANT USAGE ON SCHEMA public TO brief_table_owner;
          ALTER TABLE public.ai_daily_briefs OWNER TO brief_table_owner;
          ALTER TABLE public.ai_runs OWNER TO brief_table_owner;
          SET ROLE brief_table_owner;
        `)

        const adapter: AiSqlQueryable = {
          async query<R extends Record<string, unknown> = Record<string, unknown>>(
            text: string,
            params?: unknown[],
          ): Promise<{ rows: R[]; rowCount?: number | null }> {
            const res = await pglite.query<R>(text, params)
            return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length }
          },
        }
        configureAiPersistQueryable(adapter)

        await ensureAiTables()
        await persistDailyBrief({
          id: 'brief-0055-1',
          questionHash: 'qhash-0055',
          status: 'reported',
          reply: '{"trigger":"schedule"}',
          agreedModels: '["anthropic","google"]',
        })
        await persistDailyBrief({
          id: 'brief-0055-1',
          questionHash: 'qhash-0055',
          status: 'reported',
          reply: '{"trigger":"schedule","updated":true}',
          agreedModels: '["anthropic","google","xai"]',
        })
        await persistAiRuns([
          {
            id: 'run-0055-1',
            userId: 'system:daily-brief',
            questionHash: 'qhash-0055',
            provider: 'anthropic',
            modelId: RETURNED.anthropic,
            latencyMs: 850,
            tokensIn: 120,
            tokensOut: 45,
            estCostMicroUsd: 900,
            status: 'ok',
            errorCode: null,
          },
        ])

        const briefs = await listDailyBriefs(10)
        expect(briefs).toHaveLength(1)
        expect(briefs[0]?.reply).toBe('{"trigger":"schedule","updated":true}')

        const runsSnapshot = await safeListAiRuns(10)
        expect(runsSnapshot.error).toBe(false)
        expect(runsSnapshot.source).toBe('postgres')
        expect(runsSnapshot.runs).toHaveLength(1)
        expect(runsSnapshot.runs[0]?.id).toBe('run-0055-1')

        await pglite.exec('RESET ROLE;')
      } finally {
        await pglite.close()
      }
    })

    it('uses 5000ms PG connect timeout, never invokes prisma.aiDailyBrief SQLite in Postgres/production, and never suppresses writes after a transient read failure', async () => {
      expect(AI_PG_CONNECT_TIMEOUT_MS).toBe(5_000)
      expect(
        isPostgresOnlyAiStore({
          nodeEnv: 'production',
          sqliteUrl: 'file:/tmp/aetherbi-erp.db',
        }),
      ).toBe(true)
      expect(
        isPostgresOnlyAiStore({
          nodeEnv: 'development',
          databaseUrl: 'postgresql://db-host.internal:5432/erp',
        }),
      ).toBe(true)
      expect(
        isPostgresOnlyAiStore({
          nodeEnv: 'development',
          databaseUrl: 'file:./dev.db',
        }),
      ).toBe(false)

      const decisionsRouteSrc = readFileSync(
        path.join(process.cwd(), 'src/app/api/erp/council/decisions/route.ts'),
        'utf8',
      )
      expect(decisionsRouteSrc).not.toContain("from '@/lib/db'")
      expect(decisionsRouteSrc).not.toContain('prisma.aiDailyBrief')

      const findManySpy = vi.spyOn(prisma.aiDailyBrief, 'findMany')
      const findFirstSpy = vi.spyOn(prisma.aiDailyBrief, 'findFirst')
      const createBriefSpy = vi.spyOn(prisma.aiDailyBrief, 'create')
      const deleteManySpy = vi.spyOn(prisma.aiDailyBrief, 'deleteMany')
      const createRunsSpy = vi.spyOn(prisma.aiRun, 'createMany')
      const findRunsSpy = vi.spyOn(prisma.aiRun, 'findMany')
      const rawSqliteSpy = vi.spyOn(prisma, '$executeRawUnsafe')

      const pglite = new PGlite()
      try {
        await pglite.exec('CREATE ROLE anon; CREATE ROLE authenticated;')

        // 1) Production mode with unavailable PG pool: fails closed/gracefully with ZERO SQLite calls
        vi.stubEnv('NODE_ENV', 'production')
        configureAiPersistQueryable(null)

        await ensureAiTables()
        await persistDailyBrief({
          id: 'prod-no-pool-brief',
          questionHash: 'qh-no-pool',
          status: 'reported',
          reply: '{}',
          agreedModels: '[]',
        })
        await persistAiRuns([
          {
            id: 'prod-no-pool-run',
            userId: 'system:daily-brief',
            questionHash: 'qh-no-pool',
            provider: 'anthropic',
            modelId: RETURNED.anthropic,
            latencyMs: 100,
            tokensIn: 10,
            tokensOut: 5,
            estCostMicroUsd: 100,
            status: 'ok',
            errorCode: null,
          },
        ])
        expect(await safeListDailyBriefs(10)).toEqual({ briefs: [], error: true })
        expect(await safeListAiRuns(10)).toEqual({
          runs: [],
          brief: null,
          error: true,
          source: 'postgres',
        })
        expect(await listCouncilDecisionMirrorBriefs(10)).toEqual([])
        expect(
          await upsertCouncilDecisionMirrorBrief({
            questionHash: 'decision-room:fp-1',
            status: 'accepted',
            reply: '{"fingerprint":"fp-1","status":"accepted"}',
          }),
        ).toBe(false)
        expect(await tryAcquireManualRunLock('holder-prod')).toBe('unavailable')
        await releaseManualRunLock('holder-prod')

        // 2) Transient PG read failure followed immediately by PG writes (zero 30s write suppression & zero SQLite calls)
        let failNextRead = true
        const flakyPgAdapter: AiSqlQueryable = {
          async query<R extends Record<string, unknown> = Record<string, unknown>>(
            text: string,
            params?: unknown[],
          ): Promise<{ rows: R[]; rowCount?: number | null }> {
            if (failNextRead && /^\s*SELECT\b/i.test(text) && !/to_regclass/i.test(text)) {
              failNextRead = false
              const timeoutErr = Object.assign(new Error('connection timeout'), {
                code: 'ETIMEDOUT',
              })
              throw timeoutErr
            }
            const res = await pglite.query<R>(text, params)
            return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length }
          },
        }
        configureAiPersistQueryable(flakyPgAdapter)

        const failedRead = await safeListDailyBriefs(10)
        expect(failedRead).toEqual({ briefs: [], error: true })

        // Immediate write right after transient read error must execute on Postgres without 30s suppression
        await persistDailyBrief({
          id: 'brief-after-transient-read-err',
          questionHash: 'qh-recovered',
          status: 'reported',
          reply: '{"trigger":"manual"}',
          agreedModels: '["anthropic","google"]',
        })
        const mirrorSaved = await upsertCouncilDecisionMirrorBrief({
          questionHash: 'decision-room:cfo:margin:avenues',
          status: 'accepted',
          reply: JSON.stringify({
            id: 'dec-1',
            fingerprint: 'cfo:margin:avenues',
            status: 'accepted',
            decidedAt: '2026-11-18T10:00:00.000Z',
          }),
        })
        expect(mirrorSaved).toBe(true)

        // Daily brief readers return only real daily briefs, excluding council-decision mirror rows
        const recoveredBriefs = await safeListDailyBriefs(10)
        expect(recoveredBriefs.error).toBe(false)
        expect(recoveredBriefs.briefs).toHaveLength(1)
        expect(recoveredBriefs.briefs[0]?.id).toBe('brief-after-transient-read-err')
        expect(
          recoveredBriefs.briefs.every((b) => b.agreedModels !== COUNCIL_DECISION_BRIEF_TAG),
        ).toBe(true)

        // Decision mirror reader returns only council-decision rows from Postgres
        const mirroredRows = await listCouncilDecisionMirrorBriefs(10)
        expect(mirroredRows).toHaveLength(1)
        expect(mirroredRows[0]?.agreedModels).toBe(COUNCIL_DECISION_BRIEF_TAG)
        expect(mirroredRows[0]?.questionHash).toBe('decision-room:cfo:margin:avenues')

        // ZERO Prisma SQLite calls across the entire production/Postgres lifecycle
        expect(findManySpy).not.toHaveBeenCalled()
        expect(findFirstSpy).not.toHaveBeenCalled()
        expect(createBriefSpy).not.toHaveBeenCalled()
        expect(deleteManySpy).not.toHaveBeenCalled()
        expect(createRunsSpy).not.toHaveBeenCalled()
        expect(findRunsSpy).not.toHaveBeenCalled()
        expect(rawSqliteSpy).not.toHaveBeenCalled()
      } finally {
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
        configureAiPersistQueryable(undefined)
        await pglite.close()
      }
    })
  })
})
