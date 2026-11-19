import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import {
  askFeryalOdooAgent,
  buildFeryalNoOdooDataSuggestion,
  detectTargetBranchFromQuestion,
  detectTargetBrandFromQuestion,
  resolveFeryalQuestionPeriod,
  validateFeryalContextDefaults,
  verifyFeryalReplyNumbers,
  type AskFeryalOdooAgentResult,
  type FeryalContextDefaults,
  type FeryalExecutedOdooQuery,
  type FeryalNumericVerificationResult,
  type FeryalReplyStatus,
} from '@/lib/feryal-odoo-agent'
import { isExecutivePricingOrMenuStrategyQuestion } from '@/lib/feryal-intent'
import {
  isConfirmedPriceSheet,
  isUnconfirmedDocumentDraft,
  type ConfirmedPriceSheet,
} from '@/lib/feryal/document-intake-types'
import {
  buildExecutiveCouncilPromptPayload,
  detectExecutiveLocale,
  fetchExecutiveContextPackFromOdoo,
  isExecutiveAdvisorQuestion,
  ODOO_VERIFIED_ACTUAL_TAG,
  renderDeterministicExecutiveBrief,
  simulateExecutivePricingOptions,
  UNCONFIRMED_DRAFT_REJECTED_ERROR,
  USER_INPUT_CONFIRMED_TAG,
  DETERMINISTIC_SIMULATION_TAG,
  type ExecutiveContextPack,
  type ExecutiveGroundedNumbers,
  type FetchExecutiveContextPackInput,
  type ScenarioSimulationResult,
} from '@/lib/feryal/executive-advisor'
import { asksMarginOrCogs, COGS_UNAVAILABLE_REPLY } from '@/lib/feryal/item-pricing'
import { ACTIVE_VENTURE_BRANCH_IDS } from '@/lib/odoo-terminal-mappings'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { logger, errorFields } from '@/lib/logger'
import { missingCouncilKeyNames, readCouncilKeys, type CouncilKeys } from './env'
import { resolveCouncilModels, type CouncilModels } from './models'
import { reviewGroundedNumbers } from './number-guard'
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
  EXECUTIVE_COUNCIL_MAX_TOKENS,
  type ProviderCallResult,
  type ProviderId,
} from './providers'

export const DAILY_BRIEF_QUESTION =
  'لخّص حقائق مبيعات أمس من Odoo حسب الفرع والعلامة، واذكر فقط ما هو مكتوب في الحقائق.'

export const COUNCIL_ANALYSIS_TIMEOUT_MS = 20_000

export const COUNCIL_AI_EXPLANATION_UNAVAILABLE_NOTE =
  'ملاحظة: الشرح التحليلي الإضافي من النماذج غير متاح حالياً — الأرقام أعلاه موثّقة مباشرة من Odoo. | Note: AI analytical explanation is currently unavailable — the figures above are verified directly from Odoo.' as const

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
  context?: FeryalContextDefaults
  period?: string
  customFrom?: string
  customTo?: string
  branch?: string
  brand?: string
  channel?: string
  confirmedPriceSheet?: ConfirmedPriceSheet | null
}

export interface RunCouncilOptions {
  askOdoo?: typeof askFeryalOdooAgent
  fetchExecutivePack?: (input: FetchExecutiveContextPackInput) => Promise<ExecutiveContextPack | null>
  executivePack?: ExecutiveContextPack | null
  fetchImpl?: typeof fetch
  timeoutMs?: number
  maxTokens?: number
  keys?: CouncilKeys
  models?: CouncilModels
  persist?: (rows: readonly AiRunDraft[]) => Promise<void>
  sleepImpl?: (ms: number) => Promise<void>
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

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    JSON.parse(trimmed)
    return trimmed
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    const slice = trimmed.slice(start, end + 1)
    try {
      JSON.parse(slice)
      return slice
    } catch {
      return null
    }
  }
}

function reviewAnswer(
  text: string,
  facts: readonly ComparableFact[],
  factsJson: string,
  question: string,
): { status: 'ok' | 'guard_rejected'; errorCode: string | null; offending: string[] } {
  if (isExcludedOdooEntity(text) && !isExcludedOdooEntity(factsJson)) {
    return { status: 'guard_rejected', errorCode: 'EXCLUDED_ENTITY', offending: [] }
  }
  const grounded = reviewGroundedNumbers(text, facts, { question })
  const json = extractJsonObject(text)
  const parsed = json ? parseComparisonText(json) : null
  if (json && !parsed) {
    return { status: 'guard_rejected', errorCode: 'GUARD_REJECTED', offending: grounded.offending }
  }
  if (parsed && json) {
    let body: unknown
    try {
      body = JSON.parse(json)
    } catch {
      return { status: 'guard_rejected', errorCode: 'GUARD_REJECTED', offending: grounded.offending }
    }
    const record = body && typeof body === 'object' && !Array.isArray(body) ? (body as { comparison?: unknown }) : null
    const candidate = record && 'comparison' in record ? record.comparison : body
    const result = comparisonSchema.safeParse(candidate)
    const matches =
      result.success && comparisonMatchesFacts(result.data, facts, { activeBranchIds: ACTIVE_VENTURE_BRANCH_IDS })
    if (!matches) {
      return { status: 'guard_rejected', errorCode: 'GUARD_REJECTED', offending: grounded.offending }
    }
    const outside = text.replace(json, ' ')
    const extra = reviewGroundedNumbers(outside, facts, { question })
    if (!extra.ok) return { status: 'guard_rejected', errorCode: 'GUARD_REJECTED', offending: extra.offending }
    return { status: 'ok', errorCode: null, offending: [] }
  }
  if (!grounded.ok) return { status: 'guard_rejected', errorCode: 'GUARD_REJECTED', offending: grounded.offending }
  if (!/\d/.test(text)) return { status: 'guard_rejected', errorCode: 'GUARD_REJECTED', offending: [] }
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

function asksAboutCompetitor(question: string): boolean {
  return /(منافس|منافسين|المنافس|المنافسين|منافسينا|\bcompetitors?\b|\brivals?\b)/iu.test(question)
}

function shouldRunExecutiveCouncilMode(
  question: string,
  input: RunCouncilInput,
  options: RunCouncilOptions,
): boolean {
  if (input.confirmedPriceSheet !== undefined && input.confirmedPriceSheet !== null) {
    return true
  }
  if (options.executivePack !== undefined || options.fetchExecutivePack !== undefined) {
    return true
  }
  if (options.askOdoo !== undefined) {
    return false
  }
  if (asksAboutCompetitor(question)) {
    return false
  }
  return isExecutivePricingOrMenuStrategyQuestion(question) || isExecutiveAdvisorQuestion(question)
}

function collectConfirmedSheetInputs(sheet: ConfirmedPriceSheet | null | undefined): string[] {
  if (!sheet) return []
  const values: string[] = []
  for (const row of sheet.rows) {
    if (row.currentPriceKwd) values.push(row.currentPriceKwd)
    for (const opt of row.proposedOptions) {
      values.push(opt.proposedPriceKwd)
    }
  }
  return values
}

function reviewExecutiveAnswer(
  text: string,
  grounded: ExecutiveGroundedNumbers,
  question: string,
  confirmedUserInputs: readonly string[],
): { status: 'ok' | 'guard_rejected'; errorCode: string | null; offending: string[] } {
  if (isExcludedOdooEntity(text)) {
    return { status: 'guard_rejected', errorCode: 'EXCLUDED_ENTITY', offending: [] }
  }
  const allowedPercents = [
    ...grounded.labeledFacts
      .filter((fact) => fact.label.includes('(%)') || /_pct(?:_|$)|_share/i.test(fact.id))
      .map((fact) => fact.value),
    '0',
    '-5',
    '5',
    '10',
    '-10',
    '15',
    '20',
    '30',
    '35',
    '60',
    '80',
    '95',
    '100',
  ]
  const executiveFacts = {
    toolNumbers: grounded.toolNumbers,
    canonicalDecimals: grounded.canonicalDecimals,
    labeledFacts: grounded.labeledFacts,
    cogsReadable: false,
  }
  const check = reviewGroundedNumbers(text, executiveFacts, {
    question,
    userInputs: confirmedUserInputs,
    allowedDecimals: grounded.canonicalDecimals,
    allowedPercents,
    allowedEntityNames: grounded.allowedEntityNames,
    forbidPosCogsMarginClaims: true,
    executiveBriefMode: true,
  })
  if (!check.ok) {
    return { status: 'guard_rejected', errorCode: 'GUARD_REJECTED', offending: check.offending }
  }
  if (!/\d/.test(text)) {
    return { status: 'guard_rejected', errorCode: 'GUARD_REJECTED', offending: [] }
  }
  return { status: 'ok', errorCode: null, offending: [] }
}

function scoreExecutiveSynthesis(text: string): number {
  let score = 0
  if (/\|.*\|/.test(text)) score += 3
  if (
    text.includes(ODOO_VERIFIED_ACTUAL_TAG) ||
    text.includes(USER_INPUT_CONFIRMED_TAG) ||
    text.includes(DETERMINISTIC_SIMULATION_TAG)
  ) {
    score += 3
  }
  if (/standard_price|225/.test(text)) score += 2
  const headingCount = (text.match(/^\s*#{1,4}\s+/gm) ?? []).length
  if (headingCount >= 4) score += 2
  return score
}

function verifyExecutiveFinalReply(
  reply: string,
  grounded: ExecutiveGroundedNumbers,
  allowedDateStrings: readonly string[],
  modelTokens: readonly string[],
): FeryalNumericVerificationResult {
  const sanitizedForNumericScan = reply
    .replace(/^\s*(?:#{1,6}\s*)?\d{1,2}[.)]\s+/gm, ' ')
    .replace(/\b(?:odoo|أودو|اودو)\s+17\b/giu, ' ')
    .replace(/\b(?:integration\s+user|user|مستخدم(?:\s+الربط)?)\s+225\b/giu, ' ')
  const augmentedToolNumbers = [
    ...grounded.toolNumbers,
    0,
    5,
    -5,
    10,
    -10,
    15,
    80,
    95,
    100,
    225,
  ]
  return verifyFeryalReplyNumbers(sanitizedForNumericScan, augmentedToolNumbers, {
    allowedDateStrings,
    allowedEntityNames: [...grounded.allowedEntityNames, ...modelTokens],
  })
}

async function runExecutiveCouncilMode(
  question: string,
  questionHash: string,
  input: RunCouncilInput,
  options: RunCouncilOptions,
): Promise<CouncilResult> {
  if (input.confirmedPriceSheet !== undefined && input.confirmedPriceSheet !== null) {
    if (
      isUnconfirmedDocumentDraft(input.confirmedPriceSheet) ||
      !isConfirmedPriceSheet(input.confirmedPriceSheet)
    ) {
      throw new Error(UNCONFIRMED_DRAFT_REJECTED_ERROR)
    }
  }

  const validatedDefaults = validateFeryalContextDefaults({
    period: input.context?.period ?? input.period,
    customFrom: input.context?.customFrom ?? input.customFrom,
    customTo: input.context?.customTo ?? input.customTo,
    branch: input.context?.branch ?? input.branch,
    brand: input.context?.brand ?? input.brand,
    channel: input.context?.channel ?? input.channel,
  })

  const branchDetection = detectTargetBranchFromQuestion(question)
  const brandDetection = detectTargetBrandFromQuestion(question)
  const effectiveBranchId = branchDetection.branchId ?? validatedDefaults.branchId
  const effectiveBrandId = brandDetection.brandId ?? validatedDefaults.brandId
  const resolvedPeriod = resolveFeryalQuestionPeriod(question, input.referenceNowMs, validatedDefaults)

  let pack: ExecutiveContextPack | null = null
  try {
    if (options.executivePack !== undefined) {
      pack = options.executivePack
    } else {
      const fetchPack = options.fetchExecutivePack ?? fetchExecutiveContextPackFromOdoo
      pack = await fetchPack({
        fromIso: resolvedPeriod.from,
        toIso: resolvedPeriod.to,
        periodKey: validatedDefaults.period ?? 'custom',
        periodLabelAr: resolvedPeriod.periodLabelAr,
        brandId: effectiveBrandId,
        branchId: effectiveBranchId,
        referenceNowMs: input.referenceNowMs,
      })
    }
  } catch (error) {
    logger.error('feryal executive odoo read failed', errorFields(error))
    return {
      reply: 'تعذّر قراءة بيانات Odoo لهذا التحليل التنفيذي.',
      status: 'council_failed',
      participants: [],
      agreed: [],
      executedQueries: [],
      verifier: emptyVerifier(),
      period: { from: resolvedPeriod.from, to: resolvedPeriod.to },
      questionHash,
      auditEntry: null,
    }
  }

  if (!pack || (pack.skus.length === 0 && !input.confirmedPriceSheet)) {
    const noDataReply = buildFeryalNoOdooDataSuggestion('pos_no_data')
    return {
      reply: noDataReply,
      status: 'no_odoo_data',
      participants: [],
      agreed: [],
      executedQueries: pack
        ? [
            {
              model: pack.odooQueryMeta.model,
              method: pack.odooQueryMeta.method,
              domain: pack.odooQueryMeta.domain,
              groupby: [...pack.odooQueryMeta.groupby],
              period: { from: pack.period.from, to: pack.period.to },
            },
          ]
        : [],
      verifier: verifyFeryalReplyNumbers(noDataReply, []),
      period: { from: resolvedPeriod.from, to: resolvedPeriod.to },
      questionHash,
      auditEntry: null,
    }
  }

  const simulation: ScenarioSimulationResult = simulateExecutivePricingOptions({
    pack,
    sheet: input.confirmedPriceSheet ?? null,
    prompt: question,
  })
  const locale = detectExecutiveLocale(question)
  const asksCogs = asksMarginOrCogs(question)
  const promptPayload = buildExecutiveCouncilPromptPayload(pack, simulation, locale, asksCogs)
  const grounded = promptPayload.grounded
  const deterministicBrief = renderDeterministicExecutiveBrief(pack, simulation, locale, asksCogs)
  const confirmedUserInputs = collectConfirmedSheetInputs(input.confirmedPriceSheet)

  const executedQueries: FeryalExecutedOdooQuery[] = [
    {
      model: pack.odooQueryMeta.model,
      method: pack.odooQueryMeta.method,
      domain: pack.odooQueryMeta.domain,
      groupby: [...pack.odooQueryMeta.groupby],
      period: { from: pack.period.from, to: pack.period.to },
    },
  ]

  const executiveSystemPrompt = [
    promptPayload.systemPrompt,
    'Use the exact SKU Playbook action labels where applicable: "Approve", "Cap Increase", "Hold / Protect Traffic", "Bundle / Upsell", "Fix Typo First".',
    'Write like a board-ready F&B CFO & COO advisor — zero robotic filler, concrete KWD impact ranges across Base, Conservative, and Stress-Test scenarios, and explicit Kuwait dine-in vs delivery aggregator execution guidance.',
  ].join('\n')

  const userMessage = [
    `Executive Question (${locale.toUpperCase()}):`,
    question,
    '',
    'Deterministic Executive Facts & 3-Scenario Financial Simulation JSON:',
    promptPayload.userFactsPayload,
  ].join('\n')

  const keys = options.keys ?? readCouncilKeys()
  const missingKeyNames = missingCouncilKeyNames(keys)
  const configuredProviderCount = COUNCIL_PROVIDERS.length - missingKeyNames.length
  const models = options.models ?? resolveCouncilModels()

  const calls = await Promise.all(
    COUNCIL_PROVIDERS.map((provider) =>
      callProvider({
        provider,
        apiKey: keys[provider],
        model: models[provider],
        system: executiveSystemPrompt,
        user: userMessage,
        timeoutMs: options.timeoutMs ?? COUNCIL_ANALYSIS_TIMEOUT_MS,
        maxTokens: options.maxTokens ?? EXECUTIVE_COUNCIL_MAX_TOKENS,
        fetchImpl: options.fetchImpl,
        sleepImpl: options.sleepImpl,
      }),
    ),
  )

  const passed: Array<{ provider: ProviderId; modelId: string; text: string }> = []
  const failed: Array<{ provider: ProviderId; modelId: string; errorCode: string | null }> = []
  const participants: CouncilParticipant[] = []
  const drafts: AiRunDraft[] = []

  for (const call of calls) {
    const review =
      call.status === 'ok'
        ? reviewExecutiveAnswer(call.text, grounded, question, confirmedUserInputs)
        : null
    const participant = participantFrom(call, review)
    participants.push(participant)
    if (participant.status === 'ok') {
      passed.push({ provider: call.provider, modelId: call.modelId, text: call.text.trim() })
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

  const persist = options.persist ?? persistAiRuns
  try {
    await persist(drafts)
  } catch (error) {
    logger.error('ai run persist failed', errorFields(error))
  }

  const modelTokens: string[] = []
  for (const p of participants) {
    if (p.modelId) {
      modelTokens.push(p.modelId)
      modelTokens.push(attribution(p.provider, p.modelId))
    }
  }

  if (passed.length >= 2) {
    const agreed: CouncilAgreement[] = passed.map((item) => ({
      provider: item.provider,
      modelId: item.modelId,
    }))
    const rankedPassed = [...passed].sort(
      (a, b) => scoreExecutiveSynthesis(b.text) - scoreExecutiveSynthesis(a.text),
    )
    let winningBody = rankedPassed[0]?.text ?? deterministicBrief
    if (asksCogs && !winningBody.includes('standard_price')) {
      winningBody = `${winningBody}\n\n${COGS_UNAVAILABLE_REPLY}`
    }
    const consensusLine =
      locale === 'ar'
        ? `اجتازت الفحص ومجلس النماذج: ${agreed.map((item) => attribution(item.provider, item.modelId)).join(' · ')}`
        : `Verified by Feryal Council: ${agreed.map((item) => attribution(item.provider, item.modelId)).join(' · ')}`
    const nonMissingFailed = failed.filter((f) => f.errorCode !== 'MISSING_API_KEY')
    const failedNotes = nonMissingFailed.map(
      (item) => `- ${attribution(item.provider, item.modelId)}: ${item.errorCode ?? 'ERROR'}`,
    )
    const candidateReply = [winningBody, consensusLine, ...failedNotes].join('\n\n')
    const candidateVerifier = verifyExecutiveFinalReply(
      candidateReply,
      grounded,
      resolvedPeriod.allowedDateStrings,
      modelTokens,
    )
    if (candidateVerifier.valid) {
      return {
        reply: candidateReply,
        status: 'answered',
        participants,
        agreed,
        executedQueries,
        verifier: candidateVerifier,
        period: { from: pack.period.from, to: pack.period.to },
        questionHash,
        auditEntry: null,
      }
    }
  }

  const allConfiguredGuardRejected =
    configuredProviderCount >= 2 &&
    participants.length > 0 &&
    participants
      .filter((item) => item.errorCode !== 'MISSING_API_KEY')
      .every((item) => item.status === 'guard_rejected')

  const fallbackVerifier = verifyExecutiveFinalReply(
    deterministicBrief,
    grounded,
    resolvedPeriod.allowedDateStrings,
    modelTokens,
  )

  if (allConfiguredGuardRejected) {
    const rejectHeader =
      locale === 'ar'
        ? 'تعذّر اعتماد صياغة النماذج لوجود أرقام خارج نطاق التحقق البرمجي — أدناه التحليل التنفيذي الحتمي الموثق من Odoo:'
        : 'Council model drafts were withheld by the numeric guard — displaying verified deterministic executive brief below:'
    return {
      reply: [rejectHeader, deterministicBrief].join('\n\n'),
      status: 'council_failed',
      participants,
      agreed: [],
      executedQueries,
      verifier: fallbackVerifier,
      period: { from: pack.period.from, to: pack.period.to },
      questionHash,
      auditEntry: null,
    }
  }

  return {
    reply: deterministicBrief,
    status: 'answered',
    participants,
    agreed: [],
    executedQueries,
    verifier: fallbackVerifier,
    period: { from: pack.period.from, to: pack.period.to },
    questionHash,
    auditEntry: null,
  }
}

export async function runFeryalCouncil(
  input: RunCouncilInput,
  options: RunCouncilOptions = {},
): Promise<CouncilResult> {
  const question = input.question.trim()
  const questionHash = hashQuestion(question)

  if (shouldRunExecutiveCouncilMode(question, input, options)) {
    return runExecutiveCouncilMode(question, questionHash, input, options)
  }

  const ask = options.askOdoo ?? askFeryalOdooAgent
  let odoo: AskFeryalOdooAgentResult
  try {
    odoo = await ask({
      question,
      userSub: input.userId,
      userRole: input.userRole,
      userNameAr: input.userNameAr,
      referenceNowMs: input.referenceNowMs,
      context: input.context,
      period: input.period,
      customFrom: input.customFrom,
      customTo: input.customTo,
      branch: input.branch,
      brand: input.brand,
      channel: input.channel,
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
  const missingKeyNames = missingCouncilKeyNames(keys)
  const configuredProviderCount = COUNCIL_PROVIDERS.length - missingKeyNames.length
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
        maxTokens: options.maxTokens,
        fetchImpl: options.fetchImpl,
        sleepImpl: options.sleepImpl,
      }),
    ),
  )

  const passed: Array<{ provider: ProviderId; modelId: string; text: string }> = []
  const failed: Array<{ provider: ProviderId; modelId: string; errorCode: string | null }> = []
  const participants: CouncilParticipant[] = []
  const drafts: AiRunDraft[] = []

  for (const call of calls) {
    const review = call.status === 'ok' ? reviewAnswer(call.text, facts, factsJson, question) : null
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

  if (composed.agreed.length >= 2) {
    return {
      reply: composed.reply,
      status: 'answered',
      participants,
      agreed: composed.agreed,
      executedQueries: odoo.executedQueries,
      verifier: odoo.verifier,
      period: odoo.period,
      questionHash,
      auditEntry: odoo.auditEntry,
    }
  }

  const groundedExplanations = passed
    .filter((item) => parseComparisonText(item.text) === null && extractJsonObject(item.text) === null)
    .map((item) => item.text.trim())
    .filter((text) => text.length > 0)
  if (odoo.verifier.valid && groundedExplanations.length > 0) {
    const failureLines = failed.map(
      (item) => `- ${attribution(item.provider, item.modelId)}: ${item.errorCode ?? 'ERROR'}`,
    )
    return {
      reply: [odoo.reply, ...groundedExplanations, ...failureLines].filter((line) => line.length > 0).join('\n\n'),
      status: 'answered',
      participants,
      agreed: [],
      executedQueries: odoo.executedQueries,
      verifier: odoo.verifier,
      period: odoo.period,
      questionHash,
      auditEntry: odoo.auditEntry,
    }
  }

  const allConfiguredGuardRejected =
    configuredProviderCount >= 2 &&
    participants.length > 0 &&
    participants.every((item) => item.status === 'guard_rejected')

  if (odoo.verifier.valid && !allConfiguredGuardRejected) {
    return {
      reply: [odoo.reply, COUNCIL_AI_EXPLANATION_UNAVAILABLE_NOTE].join('\n\n'),
      status: 'answered',
      participants,
      agreed: [],
      executedQueries: odoo.executedQueries,
      verifier: odoo.verifier,
      period: odoo.period,
      questionHash,
      auditEntry: odoo.auditEntry,
    }
  }

  return {
    reply: composed.reply,
    status: 'council_failed',
    participants,
    agreed: composed.agreed,
    executedQueries: odoo.executedQueries,
    verifier: odoo.verifier,
    period: odoo.period,
    questionHash,
    auditEntry: odoo.auditEntry,
  }
}
