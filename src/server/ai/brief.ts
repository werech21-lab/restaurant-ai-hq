import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { logger, errorFields } from '@/lib/logger'
import { assembleBriefReport, reviewModelText } from './consensus'
import { missingCouncilKeyNames, readCouncilKeys, type CouncilKeys } from './env'
import {
  briefPromptPayload,
  buildBriefFactPack,
  kuwaitBriefDays,
  type BriefCubeInput,
  type BriefPurchaseInput,
  type BriefReceivableInput,
} from './facts'
import { resolveCouncilModels, type CouncilModels } from './models'
import { persistAiRuns, persistDailyBrief, type AiDailyBriefDraft, type AiRunDraft } from './persist'
import { callProvider, COUNCIL_PROVIDERS, estimateCostMicroUsd, type ProviderId } from './providers'
import type { BriefModelState, BriefProvider, StoredBriefReport } from './brief-types'

export const BRIEF_TIMEOUT_MS = 20_000
export const BRIEF_MAX_TOKENS = 1_400

const BRIEF_SYSTEM = [
  'You receive Odoo facts as JSON. Return one JSON object and no other text.',
  'A finding or recommendation is {"claim":{"action":"expand|close|reduce|increase|stop|start|hire|cut|monitor|none","target":{"type":"branch|product|shift|staff|discount|brand|company|warehouse","name":"exact scope or odoo_id"},"metric":"fact metric","direction":"up|down|flat","polarity":"do|do_not","cited_fact_ids":["id"],"operation":"delta|pct_change|ratio|share"}}',
  'Shape: {"findings":[{"claim":{}}],"recommendations":[{"claim":{}}],"advisory":[{"topic":"organization","text":"Arabic"}]}',
  'Copy cited_fact_ids, metric, and the target name from the facts. Do not write a number. operation is optional and names the figure the server will compute.',
  'direction up or down is allowed only with operation delta or pct_change. Otherwise use flat.',
  'advisory topic is organization, strategic_plan, or app_capability. Advisory text must not contain a number.',
  'Ignore a section whose status is not_linked or unverified.',
  'app_capability is only a possible future change. Do not say it was built, applied, or deployed.',
].join('\n')

export interface BriefSources {
  fetchCube: (from: string, to: string, now: number) => Promise<BriefCubeInput | null>
  fetchPurchases: (from: string, to: string, now: number) => Promise<BriefPurchaseInput | null>
  fetchReceivables: () => Promise<BriefReceivableInput | null>
}

export interface RunBriefInput {
  trigger: 'schedule' | 'manual'
  userId: string
  referenceNowMs?: number
}

export interface RunBriefOptions {
  keys?: CouncilKeys
  models?: CouncilModels
  sources?: BriefSources
  fetchImpl?: typeof fetch
  timeoutMs?: number
  persistReport?: (brief: AiDailyBriefDraft) => Promise<void>
  persistRuns?: (rows: readonly AiRunDraft[]) => Promise<void>
}

export interface RunBriefResult {
  status: 'not_configured' | 'no_odoo_data' | 'reported'
  report: StoredBriefReport
}

function hashPeriod(periods: { yesterday: string; prior: string }): string {
  return createHash('sha256').update(`background:${periods.yesterday}:${periods.prior}`).digest('hex')
}

function idleModels(status: BriefModelState['status'], errorCode: string): BriefModelState[] {
  return COUNCIL_PROVIDERS.map((provider) => ({
    provider,
    modelId: '',
    status,
    errorCode,
  }))
}

async function defaultSources(): Promise<BriefSources> {
  const mod = await import('@/lib/odoo-live-connector')
  return {
    fetchCube: (from, to, now) => mod.fetchLiveOdooPeriodCube(from, to, now),
    fetchPurchases: (from, to, now) => mod.fetchLiveOdooPurchaseOrders(from, to, { referenceNowMs: now }),
    fetchReceivables: async () => {
      const snap = await mod.fetchLiveOdooSnapshot({ period: 'month' })
      if (!snap.connected || snap.source === 'disconnected') return null
      return snap.aggregatorReceivables ?? null
    },
  }
}

async function readSource<T>(label: string, read: () => Promise<T | null>): Promise<T | null> {
  try {
    return await read()
  } catch (error) {
    logger.error('brief odoo read failed', { source: label, ...errorFields(error) })
    return null
  }
}

function providerKey(keys: CouncilKeys, provider: ProviderId): string {
  if (provider === 'anthropic') return keys.anthropic
  if (provider === 'google') return keys.google
  return keys.xai
}

export async function runBackgroundAnalysis(input: RunBriefInput, options: RunBriefOptions = {}): Promise<RunBriefResult> {
  const now = input.referenceNowMs ?? Date.now()
  const periods = kuwaitBriefDays(now)
  const keys = options.keys ?? readCouncilKeys()
  const missing = missingCouncilKeyNames(keys)
  const generatedAt = new Date(now).toISOString()
  if (missing.length > 0) {
    const report: StoredBriefReport = {
      generatedAt,
      trigger: input.trigger,
      configuration: 'not_configured',
      missingKeys: missing,
      odoo: 'not_linked',
      periods,
      sections: [],
      findings: [],
      unadoptedFindings: [],
      recommendations: [],
      disputed: [],
      dropped: [],
      advisory: [],
      proposals: [],
      models: idleModels('not_configured', 'NOT_CONFIGURED'),
    }
    await storeReport(report, input.userId, options)
    return { status: 'not_configured', report }
  }

  const sources = options.sources ?? (await defaultSources())
  const [current, priorCube, purchases, receivables] = await Promise.all([
    readSource('cube', () => sources.fetchCube(periods.yesterday, periods.yesterday, now)),
    readSource('prior', () => sources.fetchCube(periods.prior, periods.prior, now)),
    readSource('purchases', () => sources.fetchPurchases(periods.yesterday, periods.yesterday, now)),
    readSource('receivables', () => sources.fetchReceivables()),
  ])
  const pack = buildBriefFactPack({
    yesterday: periods.yesterday,
    prior: periods.prior,
    current,
    priorCube,
    purchases,
    receivables,
  })
  if (pack.odoo !== 'linked') {
    const report: StoredBriefReport = {
      generatedAt,
      trigger: input.trigger,
      configuration: 'configured',
      missingKeys: [],
      odoo: 'not_linked',
      periods,
      sections: pack.sections,
      findings: [],
      unadoptedFindings: [],
      recommendations: [],
      disputed: [],
      dropped: [],
      advisory: [],
      proposals: [],
      models: idleModels('not_called', 'NO_ODOO_DATA'),
    }
    await storeReport(report, input.userId, options)
    return { status: 'no_odoo_data', report }
  }

  const models = options.models ?? resolveCouncilModels()
  const payload = briefPromptPayload(pack)
  const calls = await Promise.all(
    COUNCIL_PROVIDERS.map((provider) =>
      callProvider({
        provider,
        apiKey: providerKey(keys, provider),
        model: models[provider],
        system: BRIEF_SYSTEM,
        user: payload,
        timeoutMs: options.timeoutMs ?? BRIEF_TIMEOUT_MS,
        maxTokens: BRIEF_MAX_TOKENS,
        fetchImpl: options.fetchImpl,
      }),
    ),
  )
  const reviewed = calls.map((call) => {
    if (call.status !== 'ok') {
      return {
        provider: call.provider as BriefProvider,
        modelId: call.modelId,
        status: 'failed' as const,
        errorCode: call.errorCode,
        findings: [],
        recommendations: [],
        advisory: [],
      }
    }
    return reviewModelText({
      provider: call.provider,
      modelId: call.modelId,
      text: call.text,
      facts: pack.facts,
    })
  })
  const report = assembleBriefReport({
    generatedAt,
    trigger: input.trigger,
    periods,
    sections: pack.sections,
    facts: pack.facts,
    models: reviewed,
  })
  const runs: AiRunDraft[] = calls.map((call) => {
    const review = reviewed.find((item) => item.provider === call.provider)
    const status = review?.status === 'ran' ? 'ok' : review?.status === 'rejected' ? 'guard_rejected' : 'error'
    return {
      id: randomUUID(),
      userId: input.userId,
      questionHash: hashPeriod(periods),
      provider: call.provider,
      modelId: call.modelId,
      latencyMs: call.latencyMs,
      tokensIn: call.tokensIn,
      tokensOut: call.tokensOut,
      estCostMicroUsd: estimateCostMicroUsd(call.provider, call.tokensIn, call.tokensOut),
      status,
      errorCode: review?.errorCode ?? call.errorCode,
    }
  })
  await storeReport(report, input.userId, options, runs)
  return { status: 'reported', report }
}

async function storeReport(
  report: StoredBriefReport,
  _userId: string,
  options: RunBriefOptions,
  runs: readonly AiRunDraft[] = [],
): Promise<void> {
  const draft: AiDailyBriefDraft = {
    id: randomUUID(),
    questionHash: hashPeriod(report.periods ?? { yesterday: '', prior: '' }),
    status: report.configuration === 'not_configured' ? 'not_configured' : report.odoo === 'not_linked' ? 'no_odoo_data' : 'reported',
    reply: JSON.stringify(report),
    agreedModels: JSON.stringify(report.models),
  }
  const saveReport = options.persistReport ?? persistDailyBrief
  const saveRuns = options.persistRuns ?? persistAiRuns
  try {
    await saveReport(draft)
  } catch (error) {
    logger.error('brief persist failed', errorFields(error))
  }
  if (runs.length === 0) return
  try {
    await saveRuns(runs)
  } catch (error) {
    logger.error('brief run persist failed', errorFields(error))
  }
}
