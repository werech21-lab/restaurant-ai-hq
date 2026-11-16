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
import { collectAllowedDecimals, guardAnswerNumbers } from './number-guard'
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
  'You explain only the Odoo facts in the user message.',
  'Copy every numeral exactly as it appears in the facts. Do not calculate, round, convert, or introduce a numeral.',
  'Mention only names that appear in the facts. Do not name a brand, branch, product, or person that is absent from the facts.',
  'Do not forecast, and do not add a cause that the facts do not state.',
  'Reply in Arabic.',
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

export function composeCouncilReply(input: {
  odooReply: string
  passed: ReadonlyArray<{ provider: ProviderId; modelId: string; text: string }>
  failed: ReadonlyArray<{ provider: ProviderId; modelId: string; errorCode: string | null }>
}): { reply: string; agreed: CouncilAgreement[] } {
  const agreed = input.passed.map((item) => ({ provider: item.provider, modelId: item.modelId }))
  const failureLines = input.failed.map(
    (item) => `- ${attribution(item.provider, item.modelId)}: ${item.errorCode ?? 'ERROR'}`,
  )
  if (agreed.length === 0) {
    return {
      agreed,
      reply: [
        'تعذّر التحليل. لم ينجح أي نموذج في شرح حقائق Odoo ضمن فاحص الأرقام.',
        ...failureLines,
        'حقائق Odoo 17 دون تحليل:',
        input.odooReply,
      ].join('\n'),
    }
  }
  const blocks = input.passed.map((item) => `${attribution(item.provider, item.modelId)}\n${item.text}`)
  return {
    agreed,
    reply: [
      'حقائق Odoo 17:',
      input.odooReply,
      ...blocks,
      `اجتازت الفحص: ${agreed.map((item) => attribution(item.provider, item.modelId)).join('، ')}`,
      ...failureLines,
    ].join('\n\n'),
  }
}

function factsForModel(result: AskFeryalOdooAgentResult): unknown {
  const full = {
    reply: result.reply,
    toolNumbers: result.toolNumbers,
    period: result.period,
    executedQueries: result.executedQueries,
  }
  if (JSON.stringify(full).length <= 24_000) return full
  return {
    reply: result.reply,
    toolNumbers: result.toolNumbers,
    period: result.period,
  }
}

function reviewAnswer(
  text: string,
  allowed: ReadonlySet<string>,
  factsJson: string,
): { status: 'ok' | 'guard_rejected'; errorCode: string | null; offending: string[] } {
  const numbers = guardAnswerNumbers(text, allowed)
  if (!numbers.ok) {
    return { status: 'guard_rejected', errorCode: 'GUARD_REJECTED', offending: numbers.offending }
  }
  if (isExcludedOdooEntity(text) && !isExcludedOdooEntity(factsJson)) {
    return { status: 'guard_rejected', errorCode: 'EXCLUDED_ENTITY', offending: [] }
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
  const allowed = collectAllowedDecimals(facts)
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
    const review = call.status === 'ok' ? reviewAnswer(call.text, allowed, factsJson) : null
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
    status: passed.length === 0 ? 'council_failed' : 'answered',
    participants,
    agreed: composed.agreed,
    executedQueries: odoo.executedQueries,
    verifier: odoo.verifier,
    period: odoo.period,
    questionHash,
    auditEntry: odoo.auditEntry,
  }
}
