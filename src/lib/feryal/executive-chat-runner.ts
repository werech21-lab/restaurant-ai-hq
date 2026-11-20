import 'server-only'
import { randomUUID } from 'node:crypto'
import {
  buildFeryalNoOdooDataSuggestion,
  detectTargetBranchFromQuestion,
  detectTargetBrandFromQuestion,
  detectTargetChannelFromQuestion,
  resolveFeryalQuestionPeriod,
  validateFeryalContextDefaults,
  verifyFeryalReplyNumbers,
  type FeryalContextDefaults,
  type FeryalExecutedOdooQuery,
  type FeryalNumericVerificationResult,
} from '@/lib/feryal-odoo-agent'
import {
  buildFeryalFrozenScope,
  isConfirmedSheetFollowUpQuestion,
  isExecutivePricingOrMenuStrategyQuestion,
  type ActivePriceSheetResponseSummary,
  type ApprovedFeryalBrandId,
  type FeryalFrozenScope,
} from '@/lib/feryal-intent'
import {
  isConfirmedPriceSheet,
  isUnconfirmedDocumentDraft,
  type ConfirmedPriceSheet,
} from '@/lib/feryal/document-intake-types'
import { resolveCanonicalBrandId } from '@/lib/feryal/sku-matcher-guard'
import {
  buildExecutiveCouncilPromptPayload,
  detectExecutiveLocale,
  DETERMINISTIC_SIMULATION_TAG,
  DETERMINISTIC_SIMULATION_TAG_AR,
  fetchExecutiveContextPackFromOdoo,
  isExecutiveAdvisorQuestion,
  KUWAIT_MARKET_STRATEGY_TAG_AR,
  KUWAIT_MARKET_STRATEGY_TAG_EN,
  localizeArabicExecutiveReply,
  ODOO_VERIFIED_ACTUAL_TAG,
  ODOO_VERIFIED_ACTUAL_TAG_AR,
  renderDeterministicExecutiveBrief,
  simulateExecutivePricingOptions,
  UNCONFIRMED_DRAFT_REJECTED_ERROR,
  USER_INPUT_CONFIRMED_TAG,
  USER_INPUT_CONFIRMED_TAG_AR,
  type ExecutiveContextPack,
  type ExecutiveGroundedNumbers,
  type FetchExecutiveContextPackInput,
  type ScenarioSimulationResult,
} from '@/lib/feryal/executive-advisor'
import { asksMarginOrCogs, renderCogsUnavailableReply } from '@/lib/feryal/item-pricing'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { logger, errorFields } from '@/lib/logger'
import {
  COUNCIL_ANALYSIS_TIMEOUT_MS,
  hashQuestion,
  type CouncilAgreement,
  type CouncilParticipant,
  type CouncilStatus,
} from '@/server/ai/council'
import { readCouncilKeys, type CouncilKeys } from '@/server/ai/env'
import { resolveCouncilModels, type CouncilModels } from '@/server/ai/models'
import { reviewGroundedNumbers } from '@/server/ai/number-guard'
import { persistAiRuns, type AiRunDraft } from '@/server/ai/persist'
import {
  callProvider,
  COUNCIL_PROVIDERS,
  estimateCostMicroUsd,
  EXECUTIVE_COUNCIL_MAX_TOKENS,
  getProviderCooldownSnapshot,
  orderProvidersByHealth,
  type ProviderCallResult,
  type ProviderHealthSnapshot,
  type ProviderId,
} from '@/server/ai/providers'

export interface FeryalChatDiagnostics {
  mode: 'executive_pricing' | 'odoo_council'
  usedDeterministicFallback: boolean
  quorumReached: boolean
  totalParticipants: number
  okCount: number
  errorCount: number
  guardRejectedCount: number
  maxLatencyMs: number
  participants: CouncilParticipant[]
  cooldowns: Record<ProviderId, ProviderHealthSnapshot>
}

export interface ExecutivePricingChatResult {
  reply: string
  status: CouncilStatus
  participants: CouncilParticipant[]
  agreed: CouncilAgreement[]
  executedQueries: FeryalExecutedOdooQuery[]
  verifier: FeryalNumericVerificationResult
  period: { from: string; to: string } | null
  questionHash: string
  auditEntry: null
  frozenScope: FeryalFrozenScope
  activePriceSheetSummary: ActivePriceSheetResponseSummary | null
  diagnostics: FeryalChatDiagnostics
}

export interface RunExecutivePricingChatInput {
  question: string
  userId: string
  userRole?: string
  userNameAr?: string
  referenceNowMs?: number
  context?: FeryalContextDefaults
  period?: string
  periodLabel?: string | null
  customFrom?: string
  customTo?: string
  branch?: string
  brand?: string
  channel?: string
  confirmedPriceSheet?: ConfirmedPriceSheet | null
  isFollowUpOnConfirmedSheet?: boolean
  activePriceSheetSummary?: string | null
}

export interface RunExecutivePricingChatOptions {
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

function attribution(provider: string, modelId: string): string {
  return modelId ? `${provider}/${modelId}` : provider
}

function emptyVerifier(): FeryalNumericVerificationResult {
  return { valid: false, extractedNumbers: [], unverifiedNumbers: [], reason: 'ODOO_READ_FAILED' }
}

/**
 * Infers a single canonical Venture Foods `brandId` from a `ConfirmedPriceSheet` when either
 * `sheet.brandId` / `sheet.brand` is explicitly set OR all non-excluded rows with a non-empty
 * `row.brand` resolve to the exact same canonical Venture Foods brand.
 */
export function inferBrandIdFromConfirmedSheet(
  sheet: ConfirmedPriceSheet | null | undefined,
): ApprovedFeryalBrandId | null {
  if (!sheet) return null
  const sheetMeta = sheet as ConfirmedPriceSheet & {
    brandId?: string | null
    brand?: string | null
  }
  const explicitBrand =
    resolveCanonicalBrandId(sheetMeta.brandId) ?? resolveCanonicalBrandId(sheetMeta.brand)
  if (explicitBrand) return explicitBrand

  const resolvedRowBrands = new Set<ApprovedFeryalBrandId>()
  let nonEmptyBrandRowCount = 0
  for (const row of sheet.rows) {
    const maybeExcluded = (row as { excluded?: boolean }).excluded === true
    if (maybeExcluded) continue
    if (typeof row.brand === 'string' && row.brand.trim().length > 0) {
      nonEmptyBrandRowCount += 1
      const canonical = resolveCanonicalBrandId(row.brand)
      if (!canonical) return null
      resolvedRowBrands.add(canonical)
    }
  }

  if (nonEmptyBrandRowCount > 0 && resolvedRowBrands.size === 1) {
    return [...resolvedRowBrands][0] ?? null
  }
  return null
}

export function buildFeryalChatDiagnostics(
  mode: FeryalChatDiagnostics['mode'],
  participants: CouncilParticipant[],
  quorumReached: boolean,
  usedDeterministicFallback: boolean,
): FeryalChatDiagnostics {
  let okCount = 0
  let errorCount = 0
  let guardRejectedCount = 0
  let maxLatencyMs = 0
  for (const p of participants) {
    if (p.status === 'ok') okCount += 1
    else if (p.status === 'guard_rejected') guardRejectedCount += 1
    else errorCount += 1
    if (p.latencyMs > maxLatencyMs) maxLatencyMs = p.latencyMs
  }
  return {
    mode,
    usedDeterministicFallback,
    quorumReached,
    totalParticipants: participants.length,
    okCount,
    errorCount,
    guardRejectedCount,
    maxLatencyMs,
    participants,
    cooldowns: getProviderCooldownSnapshot(),
  }
}

export function computeFeryalChatFrozenScope(params: {
  question: string
  period: { from: string; to: string } | null
  rawPeriodInput: string | null
  requestedPeriodLabel: string | null
  context?: FeryalContextDefaults
  referenceNowMs?: number
}): FeryalFrozenScope {
  const validatedDefaults = validateFeryalContextDefaults({
    period: params.context?.period ?? params.rawPeriodInput,
    customFrom: params.context?.customFrom,
    customTo: params.context?.customTo,
    branch: params.context?.branch,
    brand: params.context?.brand,
    channel: params.context?.channel,
  })
  const branchDetection = detectTargetBranchFromQuestion(params.question)
  const brandDetection = detectTargetBrandFromQuestion(params.question)
  const channelDetection = detectTargetChannelFromQuestion(params.question)
  const resolvedFallbackPeriod = resolveFeryalQuestionPeriod(
    params.question,
    params.referenceNowMs,
    validatedDefaults,
  )

  return buildFeryalFrozenScope({
    dateFrom: params.period?.from ?? resolvedFallbackPeriod.from,
    dateTo: params.period?.to ?? resolvedFallbackPeriod.to,
    validatedPeriod: validatedDefaults.period,
    rawPeriodKey: params.rawPeriodInput,
    requestedPeriodLabel: params.requestedPeriodLabel,
    hasExplicitPeriod: resolvedFallbackPeriod.hasExplicitPeriod,
    brandId: brandDetection.brandId ?? validatedDefaults.brandId,
    branchId: branchDetection.branchId ?? validatedDefaults.branchId,
    channelId: channelDetection.channelId ?? validatedDefaults.channelId,
    referenceNowMs: params.referenceNowMs,
  })
}

function asksAboutCompetitor(question: string): boolean {
  return /(منافس|منافسين|المنافس|المنافسين|منافسينا|\bcompetitors?\b|\brivals?\b)/iu.test(question)
}

function isTargetedSheetOpinionOrFollowUp(question: string, isFollowUpFlag?: boolean): boolean {
  if (isFollowUpFlag) return true
  return /\b(?:do you agree|agree|disagree|opinion|recommend(?:ed|ation)?|feryal\s*rec|justif(?:y|ication)|why\b|rationale|verdict|summarize|board)\b|(?:توافق|توافقين|موافق|راي|رايج|رايك|توصي|توصيت|موصي|مقترح|مبرر|تبرير|فقره|ليش|لماذا|شنو\s+راي|شو\s+راي|وش\s+راي)/iu.test(
    question,
  )
}

export function shouldRunExecutivePricingChat(
  question: string,
  input: Pick<RunExecutivePricingChatInput, 'confirmedPriceSheet' | 'isFollowUpOnConfirmedSheet'>,
  options?: Pick<RunExecutivePricingChatOptions, 'executivePack' | 'fetchExecutivePack'>,
): boolean {
  if (input.confirmedPriceSheet !== undefined && input.confirmedPriceSheet !== null) {
    if (
      isUnconfirmedDocumentDraft(input.confirmedPriceSheet) ||
      !isConfirmedPriceSheet(input.confirmedPriceSheet)
    ) {
      throw new Error(UNCONFIRMED_DRAFT_REJECTED_ERROR)
    }
    if (!input.isFollowUpOnConfirmedSheet || isConfirmedSheetFollowUpQuestion(question)) {
      return true
    }
    return false
  }
  if (options?.executivePack !== undefined || options?.fetchExecutivePack !== undefined) {
    return true
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
    const sheetCurrent = (row as { sheetCurrentPriceKwd?: string | null }).sheetCurrentPriceKwd
    if (sheetCurrent) values.push(sheetCurrent)
    for (const opt of row.proposedOptions) {
      values.push(opt.proposedPriceKwd)
    }
  }
  return values
}

function extractSimulationNumbers(grounded: ExecutiveGroundedNumbers): readonly (number | string)[] {
  return Array.isArray(grounded.simulationNumbers) ? grounded.simulationNumbers : []
}

function reviewExecutiveAnswer(
  text: string,
  grounded: ExecutiveGroundedNumbers,
  question: string,
  confirmedUserInputs: readonly string[],
  extraEntityNames: readonly string[],
): { status: 'ok' | 'guard_rejected'; errorCode: string | null; offending: string[] } {
  if (isExcludedOdooEntity(text)) {
    return { status: 'guard_rejected', errorCode: 'EXCLUDED_ENTITY', offending: [] }
  }
  const simulationNumbers = extractSimulationNumbers(grounded)
  const allowedPercents: Array<string | number> = [
    ...grounded.labeledFacts
      .filter((fact) => fact.label.includes('(%)') || /_pct(?:_|$)|_share/i.test(fact.id))
      .map((fact) => fact.value),
    ...simulationNumbers,
    '0',
    '5',
    '-5',
    '8',
    '-8',
    '10',
    '-10',
    '12',
    '-12',
    '15',
    '-15',
    '20',
    '-20',
    '25',
    '-25',
    '30',
    '-30',
    '35',
    '-35',
    '60',
    '80',
    '95',
    '100',
  ]
  const executiveFacts = {
    toolNumbers: grounded.toolNumbers,
    canonicalDecimals: grounded.canonicalDecimals,
    simulationNumbers,
    labeledFacts: grounded.labeledFacts,
    cogsReadable: false,
  }
  const check = reviewGroundedNumbers(text, executiveFacts, {
    question,
    userInputs: confirmedUserInputs,
    simulationNumbers,
    allowedDecimals: [...grounded.canonicalDecimals, ...simulationNumbers, ...confirmedUserInputs],
    allowedPercents,
    allowedEntityNames: [...grounded.allowedEntityNames, ...extraEntityNames],
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

function participantFrom(
  call: ProviderCallResult,
  review: ReturnType<typeof reviewExecutiveAnswer> | null,
): CouncilParticipant {
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

function scoreExecutiveSynthesis(text: string): number {
  let score = 0
  if (/\|.*\|/.test(text)) score += 3
  if (
    text.includes(ODOO_VERIFIED_ACTUAL_TAG) ||
    text.includes(ODOO_VERIFIED_ACTUAL_TAG_AR) ||
    text.includes(USER_INPUT_CONFIRMED_TAG) ||
    text.includes(USER_INPUT_CONFIRMED_TAG_AR) ||
    text.includes(DETERMINISTIC_SIMULATION_TAG) ||
    text.includes(DETERMINISTIC_SIMULATION_TAG_AR)
  ) {
    score += 3
  }
  if (
    text.includes(KUWAIT_MARKET_STRATEGY_TAG_EN) ||
    text.includes(KUWAIT_MARKET_STRATEGY_TAG_AR) ||
    /Feryal['’]?s Executive Opinion|رأي فريال التنفيذي|Feryal Rec\.|سعر فريال الموصى/iu.test(text)
  ) {
    score += 2
  }
  if (/standard_price|225/.test(text)) score += 2
  const headingCount = (text.match(/^\s*#{1,4}\s+/gm) ?? []).length
  if (headingCount >= 4) score += 2
  return score
}

function verifyExecutiveFinalReply(
  reply: string,
  grounded: ExecutiveGroundedNumbers,
  confirmedUserInputs: readonly string[],
  allowedDateStrings: readonly string[],
  modelTokens: readonly string[],
): FeryalNumericVerificationResult {
  const sanitizedForNumericScan = reply
    .replace(/^\s*(?:#{1,6}\s*)?\d{1,2}[.)]\s+/gm, ' ')
    .replace(/(^|[^\d])\.(?:000|050|250|500|750|950)(?!\d)/gu, '$1 ')
    .replace(/(^|[^\d.])(\d+(?:\.\d+)?)\s*%?\s*[-–—]\s*(\d+(?:\.\d+)?\s*%)/gu, '$1$2% to $3')
    .replace(/\b1\s*(?:-\s*to\s*-|\s+to\s+|:)\s*1\b/giu, ' ')
    .replace(/(?:^|[^\p{L}\p{N}])1\s+إلى\s+1(?=$|[^\p{L}\p{N}])/giu, ' ')
    .replace(/\b80\s*[-/]\s*15\s*[-/]\s*5\b/gu, ' ')
    .replace(/(?:^|[^\p{L}\p{N}])3(?:\s*-\s*|\s+)(?:scenarios?|سيناريوهات|خيارات)(?=$|[^\p{L}\p{N}])/giu, ' ')
    .replace(/(?:^|[^\p{L}\p{N}])(?:50|5|0)\s*(?:fils|فلس)(?=$|[^\p{L}\p{N}])/giu, ' ')
    .replace(/(?:^|[^\p{L}\p{N}])(?:odoo|أودو|اودو)\s+17(?=$|[^\p{L}\p{N}])/giu, ' ')
    .replace(
      /(?:^|[^\p{L}\p{N}])(?:integration\s+user|user|id|(?:ال)?مستخدم(?:\s+الربط)?|حساب\s+الربط|رقم)\s*#?225(?=$|[^\p{L}\p{N}])/giu,
      ' ',
    )
    .replace(/\bpos\.config\s+(?:24|36|25|39|40|43)\b/giu, ' ')
    .replace(/(?:^|[^\p{L}\p{N}])(?:pos_category|category|فئة)\s+150(?=$|[^\p{L}\p{N}])/giu, ' ')

  const parsedSimulationNums = extractSimulationNumbers(grounded)
    .map((v) => (typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim())))
    .filter((n) => Number.isFinite(n))
  const parsedUserNums = confirmedUserInputs
    .map((v) => Number(String(v).replace(/,/g, '').trim()))
    .filter((n) => Number.isFinite(n))

  const augmentedToolNumbers = [
    ...grounded.toolNumbers,
    ...parsedSimulationNums,
    ...parsedUserNums,
    0,
    0.05,
    0.25,
    0.5,
    0.75,
    0.95,
    1,
    2,
    3,
    5,
    -5,
    8,
    -8,
    10,
    '-10',
    12,
    -12,
    15,
    -15,
    17,
    20,
    -20,
    24,
    25,
    -25,
    30,
    -30,
    35,
    -35,
    36,
    39,
    40,
    43,
    50,
    60,
    80,
    95,
    100,
    150,
    225,
  ].map((n) => Number(n))

  return verifyFeryalReplyNumbers(sanitizedForNumericScan, augmentedToolNumbers, {
    allowedDateStrings,
    allowedEntityNames: [...grounded.allowedEntityNames, ...modelTokens],
  })
}

function buildActivePriceSheetSummary(
  sheet: ConfirmedPriceSheet | null | undefined,
  simulation: ScenarioSimulationResult | null,
  frozenScope: FeryalFrozenScope,
): ActivePriceSheetResponseSummary | null {
  if (!sheet) return null
  const activeRows = sheet.rows.filter((row) => !(row as { excluded?: boolean }).excluded)
  const totalRows = activeRows.length
  const matchedRows =
    simulation && simulation.options.length > 0
      ? (simulation.options[0]?.matchedSkuCount ?? 0)
      : activeRows.filter((row) => row.matchedOdooProductId != null).length

  return {
    fileName: sheet.fileName,
    draftId: sheet.draftId,
    matchedRows,
    totalRows,
    brandScope: frozenScope.brandScope,
    dateFrom: frozenScope.dateFrom,
    dateTo: frozenScope.dateTo,
  }
}

export async function runExecutivePricingChat(
  input: RunExecutivePricingChatInput,
  options: RunExecutivePricingChatOptions = {},
): Promise<ExecutivePricingChatResult> {
  const question = input.question.trim()
  const questionHash = hashQuestion(question)

  if (input.confirmedPriceSheet !== undefined && input.confirmedPriceSheet !== null) {
    if (
      isUnconfirmedDocumentDraft(input.confirmedPriceSheet) ||
      !isConfirmedPriceSheet(input.confirmedPriceSheet)
    ) {
      throw new Error(UNCONFIRMED_DRAFT_REJECTED_ERROR)
    }
  }

  const activeSheet = input.confirmedPriceSheet ?? null
  const rawPeriodInput = input.context?.period ?? input.period ?? null
  const validatedDefaults = validateFeryalContextDefaults({
    period: rawPeriodInput,
    customFrom: input.context?.customFrom ?? input.customFrom,
    customTo: input.context?.customTo ?? input.customTo,
    branch: input.context?.branch ?? input.branch,
    brand: input.context?.brand ?? input.brand,
    channel: input.context?.channel ?? input.channel,
  })

  const branchDetection = detectTargetBranchFromQuestion(question)
  const brandDetection = detectTargetBrandFromQuestion(question)
  const channelDetection = detectTargetChannelFromQuestion(question)
  const inferredSheetBrandId = inferBrandIdFromConfirmedSheet(activeSheet)

  const effectiveBranchId = branchDetection.branchId ?? validatedDefaults.branchId
  const effectiveBrandId =
    brandDetection.brandId ?? validatedDefaults.brandId ?? inferredSheetBrandId
  const effectiveChannelId = channelDetection.channelId ?? validatedDefaults.channelId
  const resolvedPeriod = resolveFeryalQuestionPeriod(
    question,
    input.referenceNowMs,
    validatedDefaults,
  )

  const initialFrozenScope = buildFeryalFrozenScope({
    dateFrom: resolvedPeriod.from,
    dateTo: resolvedPeriod.to,
    validatedPeriod: validatedDefaults.period,
    rawPeriodKey: rawPeriodInput,
    requestedPeriodLabel: input.periodLabel,
    hasExplicitPeriod: resolvedPeriod.hasExplicitPeriod,
    brandId: effectiveBrandId,
    branchId: effectiveBranchId,
    channelId: effectiveChannelId,
    referenceNowMs: input.referenceNowMs,
  })

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
      reply: 'تعذّر قراءة بيانات أودو لهذا التحليل التنفيذي.',
      status: 'council_failed',
      participants: [],
      agreed: [],
      executedQueries: [],
      verifier: emptyVerifier(),
      period: { from: resolvedPeriod.from, to: resolvedPeriod.to },
      questionHash,
      auditEntry: null,
      frozenScope: initialFrozenScope,
      activePriceSheetSummary: buildActivePriceSheetSummary(activeSheet, null, initialFrozenScope),
      diagnostics: buildFeryalChatDiagnostics('executive_pricing', [], false, false),
    }
  }

  if (!pack || (pack.skus.length === 0 && !activeSheet)) {
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
      frozenScope: initialFrozenScope,
      activePriceSheetSummary: buildActivePriceSheetSummary(activeSheet, null, initialFrozenScope),
      diagnostics: buildFeryalChatDiagnostics('executive_pricing', [], false, false),
    }
  }

  const finalFrozenScope = buildFeryalFrozenScope({
    dateFrom: pack.period.from,
    dateTo: pack.period.to,
    validatedPeriod: validatedDefaults.period,
    rawPeriodKey: rawPeriodInput,
    requestedPeriodLabel: input.periodLabel,
    hasExplicitPeriod: resolvedPeriod.hasExplicitPeriod,
    brandId: pack.scope.brandId ?? effectiveBrandId,
    branchId: pack.scope.branchId ?? effectiveBranchId,
    channelId: effectiveChannelId,
    referenceNowMs: input.referenceNowMs,
  })

  const simulation: ScenarioSimulationResult = simulateExecutivePricingOptions({
    pack,
    sheet: activeSheet,
    prompt: question,
  })
  const activePriceSheetSummary = buildActivePriceSheetSummary(
    activeSheet,
    simulation,
    finalFrozenScope,
  )

  const locale = detectExecutiveLocale(question)
  const asksCogs = asksMarginOrCogs(question)
  const promptPayload = buildExecutiveCouncilPromptPayload(pack, simulation, locale, asksCogs)
  const grounded = promptPayload.grounded
  const deterministicBrief = renderDeterministicExecutiveBrief(pack, simulation, locale, asksCogs)
  const confirmedUserInputs = collectConfirmedSheetInputs(activeSheet)
  const extraEntityNames = activeSheet?.fileName ? [activeSheet.fileName] : []

  const executedQueries: FeryalExecutedOdooQuery[] = [
    {
      model: pack.odooQueryMeta.model,
      method: pack.odooQueryMeta.method,
      domain: pack.odooQueryMeta.domain,
      groupby: [...pack.odooQueryMeta.groupby],
      period: { from: pack.period.from, to: pack.period.to },
    },
  ]

  const isSheetFollowUp =
    activeSheet !== null &&
    isTargetedSheetOpinionOrFollowUp(question, input.isFollowUpOnConfirmedSheet)

  const actionLabelsRule =
    locale === 'ar'
      ? 'استخدمي حصراً تسميات القرار التنفيذي العربية في جدول الأصناف: "اعتماد الزيادة"، "تقييد السقف"، "تثبيت السعر لحماية الإقبال"، "باقة / بيع إضافي"، "تصحيح خطأ الإدخال أولاً".'
      : 'Use the exact SKU Playbook action labels where applicable: "Approve", "Cap Increase", "Hold / Protect Traffic", "Bundle / Upsell", "Fix Typo First".'

  const followUpRule =
    locale === 'ar'
      ? 'سؤال متابعة على جدول الأسعار المؤكد: أجيبي مباشرة وبحسم في أعلى التقرير تحت عنوان "## رأي فريال التنفيذي والمبررات الإدارية"، مع ذكر الحكم التنفيذي بالعربية، والاستشهاد بعمود "سعر فريال الموصى د.ك" والمحاكاة عبر السيناريوهات الثلاثة و[استراتيجية التسعير في سوق الكويت] دون العودة لملخص باريتو عام منفصل عن الجدول.'
      : 'FOLLOW-UP EXECUTIVE QUESTION ON CONFIRMED PRICE SHEET: Directly and decisively answer the user\'s specific follow-up question right at the top under "## Feryal\'s Executive Opinion & Justification", stating your explicit Verdict (Agree / Partially Agree (Recommended) / Disagree), citing the "Feryal Rec. KWD" column, the 3-scenario simulation, and [Kuwait Market Pricing Strategy]. NEVER ignore the confirmed price sheet or fall back to a generic sheet-less Pareto/ABC summary.'

  const executiveSystemPrompt = [
    promptPayload.systemPrompt,
    actionLabelsRule,
    'Write like a board-ready F&B CFO & COO advisor — zero robotic filler, concrete KWD impact ranges across Base, Conservative, and Stress-Test scenarios, and explicit Kuwait dine-in vs delivery aggregator execution guidance.',
    ...(isSheetFollowUp ? [followUpRule] : []),
  ].join('\n')

  const userMessage = [
    ...(isSheetFollowUp && activeSheet
      ? [
          '=== FOLLOW-UP EXECUTIVE QUESTION ON CONFIRMED PRICE SHEET ===',
          `Active Confirmed Price Sheet: ${activeSheet.fileName} (draftId: ${activeSheet.draftId}, active rows: ${activeSheet.rows.length})`,
          ...(typeof input.activePriceSheetSummary === 'string' &&
          input.activePriceSheetSummary.trim().length > 0
            ? ['Prior Sheet Analysis Context:', input.activePriceSheetSummary.trim()]
            : []),
          '',
        ]
      : []),
    `Executive Question (${locale.toUpperCase()}):`,
    question,
    '',
    'Deterministic Executive Facts & 3-Scenario Financial Simulation JSON:',
    promptPayload.userFactsPayload,
  ].join('\n')

  const keys = options.keys ?? readCouncilKeys()
  const models = options.models ?? resolveCouncilModels()
  const orderedProviders = orderProvidersByHealth(COUNCIL_PROVIDERS)

  const callsByProvider = new Map<ProviderId, ProviderCallResult>()
  const rawCalls = await Promise.all(
    orderedProviders.map((provider) =>
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
  for (const call of rawCalls) {
    callsByProvider.set(call.provider, call)
  }

  const passed: Array<{ provider: ProviderId; modelId: string; text: string }> = []
  const participants: CouncilParticipant[] = []
  const drafts: AiRunDraft[] = []

  for (const provider of COUNCIL_PROVIDERS) {
    const call = callsByProvider.get(provider)
    if (!call) continue
    const candidateText =
      call.status === 'ok' && locale === 'ar'
        ? localizeArabicExecutiveReply(call.text.trim())
        : call.text.trim()
    const review =
      call.status === 'ok'
        ? reviewExecutiveAnswer(
            candidateText,
            grounded,
            question,
            confirmedUserInputs,
            extraEntityNames,
          )
        : null
    const participant = participantFrom(call, review)
    participants.push(participant)
    if (participant.status === 'ok') {
      passed.push({ provider: call.provider, modelId: call.modelId, text: candidateText })
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

  const modelTokens: string[] = [...extraEntityNames]
  for (const p of participants) {
    if (p.modelId) {
      modelTokens.push(p.modelId)
      modelTokens.push(attribution(p.provider, p.modelId))
    }
  }

  const allowedDates = [
    ...new Set([...resolvedPeriod.allowedDateStrings, pack.period.from, pack.period.to]),
  ]

  if (passed.length >= 2) {
    const agreed: CouncilAgreement[] = passed.map((item) => ({
      provider: item.provider,
      modelId: item.modelId,
    }))
    const rankedPassed = [...passed].sort(
      (a, b) => scoreExecutiveSynthesis(b.text) - scoreExecutiveSynthesis(a.text),
    )
    let winningBody = rankedPassed[0]?.text ?? deterministicBrief
    if (asksCogs) {
      const hasCogsBoundary =
        locale === 'ar'
          ? /225|حقل\s+تكلفة\s+الصنف/u.test(winningBody)
          : winningBody.includes('standard_price')
      if (!hasCogsBoundary) {
        winningBody = `${winningBody}\n\n${renderCogsUnavailableReply(locale)}`
      }
    }
    const consensusLine =
      locale === 'ar'
        ? `اجتازت الفحص ومجلس النماذج: ${agreed.map((item) => attribution(item.provider, item.modelId)).join(' · ')}`
        : `Verified by Feryal Council: ${agreed.map((item) => attribution(item.provider, item.modelId)).join(' · ')}`
    const candidateReply = [winningBody, consensusLine].join('\n\n')
    const candidateVerifier = verifyExecutiveFinalReply(
      candidateReply,
      grounded,
      confirmedUserInputs,
      allowedDates,
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
        frozenScope: finalFrozenScope,
        activePriceSheetSummary,
        diagnostics: buildFeryalChatDiagnostics('executive_pricing', participants, true, false),
      }
    }
  }

  const fallbackVerifier = verifyExecutiveFinalReply(
    deterministicBrief,
    grounded,
    confirmedUserInputs,
    allowedDates,
    modelTokens,
  )

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
    frozenScope: finalFrozenScope,
    activePriceSheetSummary,
    diagnostics: buildFeryalChatDiagnostics('executive_pricing', participants, false, true),
  }
}
