import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import {
  askFeryalOdooAgent,
  type AskFeryalOdooAgentResult,
  type FeryalExecutedOdooQuery,
  type FeryalNumericVerificationResult,
  type FeryalReplyStatus,
} from '@/lib/feryal-odoo-agent'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { logger, errorFields } from '@/lib/logger'
import { readCouncilKeys, type CouncilKeys } from './env'
import { resolveCouncilModels, type CouncilModels } from './models'
import { extractCanonicalDecimals } from './number-guard'
import {
  comparisonKey,
  comparisonMatchesFacts,
  comparisonSchema,
  normalizeComparison,
  renderComparisonText,
  sharesFact,
  type ComparableFact,
} from './structured-claim'
import { persistAiRuns, type AiRunDraft } from './persist'
import {
  callProvider,
  COUNCIL_PROVIDERS,
  estimateCostMicroUsd,
  type ProviderCallResult,
  type ProviderId,
} from './providers'

export const DAILY_BRIEF_QUESTION =
  'لخّص حقائق مبيعات أمس من Odoo حسب الفرع والعلامة، واذكر فقط ما هو مكتوب في الحقائق.'

export const COUNCIL_ANALYSIS_TIMEOUT_MS = 20_000

const SYSTEM_PROMPT = [
  'You receive Odoo facts as JSON. Return one JSON object and no other text.',
  'Shape: {"comparison":{"subject_id":"entity id","relation":"better|worse|best|worst|equal","object_id":"entity id or null","metric":"metric","cited_fact_ids":["fact id"]}}',
  'cited_fact_ids must be ids from facts. subject_id and object_id must be entity ids on those facts. Do not cite a name as a fact id.',
  'Do not write a number, a percent, or a sentence. The server computes every figure and writes the Arabic and English reply.',
  'relation worse means the subject is worse than the object. best and worst may use object_id null.',
].join('\n')

export type CouncilStatus = FeryalReplyStatus | 'council_failed'

export interface CouncilAgreement {
  provider: ProviderId
  modelId: string
}

export interface CouncilParticipant {
  provider: ProviderId
  modelId: string
  status: 'ok' | 'error' | 'guard_rejected'
  errorCode: string | null
  latencyMs: number
  offendingNumbers: string[]
}

export interface CouncilResult {
  reply: string
  status: CouncilStatus
  participants: CouncilParticipant[]
  agreed: CouncilAgreement[]
  executedQueries: FeryalExecutedOdooQuery[]
  verifier: FeryalNumericVerificationResult
  period: { from: string; to: string } | null
  questionHash: string
  auditEntry: AskFeryalOdooAgentResult['auditEntry'] | null
}

export interface RunCouncilInput {
  question: string
  userId: string
  userRole?: string
  userNameAr?: string
  referenceNowMs?: number
}

export interface RunCouncilOptions {
  askOdoo?: typeof askFeryalOdooAgent
  fetchImpl?: typeof fetch
  timeoutMs?: number
  keys?: CouncilKeys
  models?: CouncilModels
  persist?: (rows: readonly AiRunDraft[]) => Promise<void>
}

export function hashQuestion(question: string): string {
  return createHash('sha256').update(question.trim()).digest('hex')
}

function attribution(provider: string, modelId: string): string {
  return modelId ? `${provider}/${modelId}` : provider
}

function parseComparisonText(text: string): { key: string; rendered: string; factIds: string[] } | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }
  const body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as { comparison?: unknown }) : null
  const candidate = body && 'comparison' in body ? body.comparison : parsed
  const result = comparisonSchema.safeParse(candidate)
  if (!result.success) return null
  const normalized = normalizeComparison(result.data)
  return {
    key: comparisonKey(normalized),
    rendered: renderComparisonText(normalized),
    factIds: [...normalized.cited_fact_ids],
  }
}

export function composeCouncilReply(input: {
  odooReply: string
  passed: ReadonlyArray<{ provider: ProviderId; modelId: string; text: string }>
  failed: ReadonlyArray<{ provider: ProviderId; modelId: string; errorCode: string | null }>
}): { reply: string; agreed: CouncilAgreement[] } {
  const failureLines = input.failed.map(
    (item) => `- ${attribution(item.provider, item.modelId)}: ${item.errorCode ?? 'ERROR'}`,
  )
  const clusters = new Map<string, Array<{ provider: ProviderId; modelId: string; rendered: string; factIds: string[] }>>()
  for (const item of input.passed) {
    const parsed = parseComparisonText(item.text)
    if (!parsed) continue
    const cluster = clusters.get(parsed.key) ?? []
    cluster.push({ provider: item.provider, modelId: item.modelId, rendered: parsed.rendered, factIds: parsed.factIds })
    clusters.set(parsed.key, cluster)
  }
  const agreedCluster = [...clusters.values()]
    .map((cluster) =>
      cluster.filter((item, index) =>
        cluster.some(
          (other, otherIndex) =>
            otherIndex !== index && other.provider !== item.provider && sharesFact(item.factIds, other.factIds),
        ),
      ),
    )
    .filter((cluster) => new Set(cluster.map((item) => item.provider)).size >= 2)
    .sort((a, b) => b.length - a.length)[0]
  const agreed = (agreedCluster ?? []).map((item) => ({ provider: item.provider, modelId: item.modelId }))
  if (!agreedCluster || agreed.length < 2) {
    const headline =
      input.passed.length === 0
        ? 'تعذّر التحليل. لم ينجح أي نموذج في شرح حقائق Odoo ضمن فاحص الأرقام.'
        : 'لا اتفاق. لم يتفق نموذجان على نفس الاستنتاج.'
    return {
      agreed: [],
      reply: [headline, ...failureLines, 'حقائق Odoo 17 دون تحليل:', input.odooReply].join('\n'),
    }
  }
  return {
    agreed,
    reply: [
      'حقائق Odoo 17:',
      input.odooReply,
      agreedCluster[0]?.rendered ?? '',
      `اجتازت الفحص: ${agreed.map((item) => attribution(item.provider, item.modelId)).join('، ')}`,
      ...failureLines,
    ].join('\n\n'),
  }
}

function factsForModel(result: AskFeryalOdooAgentResult): ComparableFact[] {
  return result.facts ?? []
}

function reviewAnswer(
  text: string,
  facts: readonly ComparableFact[],
  factsJson: string,
): { status: 'ok' | 'guard_rejected'; errorCode: string | null; offending: string[] } {
  if (isExcludedOdooEntity(text) && !isExcludedOdooEntity(factsJson)) {
    return { status: 'guard_rejected', errorCode: 'EXCLUDED_ENTITY', offending: [] }
  }
  const parsed = parseComparisonText(text)
  if (!parsed) {
    return { status: 'guard_rejected', errorCode: 'GUARD_REJECTED', offending: extractCanonicalDecimals(text) }
  }
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let body: unknown
  try {
    body = JSON.parse(trimmed)
  } catch {
    return { status: 'guard_rejected', errorCode: 'GUARD_REJECTED', offending: [] }
  }
  const record = body && typeof body === 'object' && !Array.isArray(body) ? (body as { comparison?: unknown }) : null
  const candidate = record && 'comparison' in record ? record.comparison : body
  const result = comparisonSchema.safeParse(candidate)
  if (!result.success || !comparisonMatchesFacts(result.data, facts)) {
    return { status: 'guard_rejected', errorCode: 'GUARD_REJECTED', offending: extractCanonicalDecimals(text) }
  }
  return { status: 'ok', errorCode: null, offending: [] }
}

function participantFrom(call: ProviderCallResult, review: ReturnType<typeof reviewAnswer> | null): CouncilParticipant {
  if (call.status !== 'ok' || !review) {
    return {
      provider: call.provider,
      modelId: call.modelId,
      status: 'error',
      errorCode: call.errorCode,
      latencyMs: call.latencyMs,
      offendingNumbers: [],
    }
  }
  return {
    provider: call.provider,
    modelId: call.modelId,
    status: review.status,
    errorCode: review.errorCode,
    latencyMs: call.latencyMs,
    offendingNumbers: review.offending,
  }
}

function emptyVerifier(): FeryalNumericVerificationResult {
  return { valid: false, extractedNumbers: [], unverifiedNumbers: [], reason: 'ODOO_READ_FAILED' }
}

export async function runFeryalCouncil(
  input: RunCouncilInput,
  options: RunCouncilOptions = {},
): Promise<CouncilResult> {
  const question = input.question.trim()
  const questionHash = hashQuestion(question)
  const ask = options.askOdoo ?? askFeryalOdooAgent
  let odoo: AskFeryalOdooAgentResult
  try {
    odoo = await ask({
      question,
      userSub: input.userId,
      userRole: input.userRole,
      userNameAr: input.userNameAr,
      referenceNowMs: input.referenceNowMs,
    })
  } catch (error) {
    logger.error('feryal odoo read failed', errorFields(error))
    return {
      reply: 'تعذّر قراءة بيانات Odoo لهذا السؤال.',
      status: 'council_failed',
      participants: [],
      agreed: [],
      executedQueries: [],
      verifier: emptyVerifier(),
      period: null,
      questionHash,
      auditEntry: null,
    }
  }

  if (odoo.status !== 'answered') {
    return {
      reply: odoo.reply,
      status: odoo.status,
      participants: [],
      agreed: [],
      executedQueries: odoo.executedQueries,
      verifier: odoo.verifier,
      period: odoo.period,
      questionHash,
      auditEntry: odoo.auditEntry,
    }
  }

  const facts = factsForModel(odoo)
  const factsJson = JSON.stringify(facts)
  const keys = options.keys ?? readCouncilKeys()
  const models = options.models ?? resolveCouncilModels()
  const userMessage = `Question:\n${question}\n\nOdoo facts JSON:\n${factsJson}`
  const calls = await Promise.all(
    COUNCIL_PROVIDERS.map((provider) =>
      callProvider({
        provider,
        apiKey: keys[provider],
        model: models[provider],
        system: SYSTEM_PROMPT,
        user: userMessage,
        timeoutMs: options.timeoutMs ?? COUNCIL_ANALYSIS_TIMEOUT_MS,
        fetchImpl: options.fetchImpl,
      }),
    ),
  )

  const passed: Array<{ provider: ProviderId; modelId: string; text: string }> = []
  const failed: Array<{ provider: ProviderId; modelId: string; errorCode: string | null }> = []
  const participants: CouncilParticipant[] = []
  const drafts: AiRunDraft[] = []

  for (const call of calls) {
    const review = call.status === 'ok' ? reviewAnswer(call.text, facts, factsJson) : null
    const participant = participantFrom(call, review)
    participants.push(participant)
    if (participant.status === 'ok') {
      passed.push({ provider: call.provider, modelId: call.modelId, text: call.text })
    } else {
      failed.push({ provider: call.provider, modelId: call.modelId, errorCode: participant.errorCode })
    }
    drafts.push({
      id: randomUUID(),
      userId: input.userId || 'anonymous',
      questionHash,
      provider: call.provider,
      modelId: call.modelId,
      latencyMs: call.latencyMs,
      tokensIn: call.tokensIn,
      tokensOut: call.tokensOut,
      estCostMicroUsd: estimateCostMicroUsd(call.provider, call.tokensIn, call.tokensOut),
      status: participant.status,
      errorCode: participant.errorCode,
    })
  }

  const composed = composeCouncilReply({ odooReply: odoo.reply, passed, failed })
  const persist = options.persist ?? persistAiRuns
  try {
    await persist(drafts)
  } catch (error) {
    logger.error('ai run persist failed', errorFields(error))
  }

  return {
    reply: composed.reply,
    status: composed.agreed.length >= 2 ? 'answered' : 'council_failed',
    participants,
    agreed: composed.agreed,
    executedQueries: odoo.executedQueries,
    verifier: odoo.verifier,
    period: odoo.period,
    questionHash,
    auditEntry: odoo.auditEntry,
  }
}
