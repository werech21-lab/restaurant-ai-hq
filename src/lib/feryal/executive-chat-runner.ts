import 'server-only'
import { randomUUID } from 'node:crypto'
import {
  askFeryalOdooAgent,
  buildFeryalNoOdooDataSuggestion,
  detectTargetBranchFromQuestion,
  detectTargetBrandFromQuestion,
  detectTargetChannelFromQuestion,
  resolveFeryalQuestionPeriod,
  validateFeryalContextDefaults,
  verifyFeryalReplyNumbers,
  type AskFeryalOdooAgentInput,
  type AskFeryalOdooAgentResult,
  type FeryalAuditLogEntry,
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
  collectExecutiveGroundedNumbers,
  detectExecutiveLocale,
  fetchExecutiveContextPackFromOdoo,
  isExecutiveAdvisorQuestion,
  renderDeterministicExecutiveBrief,
  simulateExecutivePricingOptions,
  UNCONFIRMED_DRAFT_REJECTED_ERROR,
  type ExecutiveContextPack,
  type ExecutiveGroundedNumbers,
  type FetchExecutiveContextPackInput,
  type ScenarioSimulationResult,
  type SkuVelocityRow,
} from '@/lib/feryal/executive-advisor'
import { asksMarginOrCogs } from '@/lib/feryal/item-pricing'
import { ACTIVE_VENTURE_BRANCH_IDS } from '@/lib/odoo-terminal-mappings'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import {
  runFeryalCouncil,
  type CouncilParticipant,
  type CouncilResult,
  type RunCouncilOptions,
} from '@/server/ai/council'
import { Decimal } from '@/server/ai/decimal'
import { extractCanonicalDecimals, reviewGroundedNumbers } from '@/server/ai/number-guard'
import {
  getProviderCooldownSnapshot,
  type ProviderHealthSnapshot,
  type ProviderId,
} from '@/server/ai/providers'
import type { ComparableFact } from '@/server/ai/structured-claim'

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

export interface ExecutivePricingAskOdooState {
  frozenScope: FeryalFrozenScope | null
  activePriceSheetSummary: ActivePriceSheetResponseSummary | null
}

export interface CreateExecutivePricingAskOdooOptions {
  confirmedPriceSheet?: ConfirmedPriceSheet | null
  isFollowUpOnConfirmedSheet?: boolean
  activePriceSheetSummary?: string | null
  periodLabel?: string | null
  executivePack?: ExecutiveContextPack | null
  fetchExecutivePack?: (input: FetchExecutiveContextPackInput) => Promise<ExecutiveContextPack | null>
  state?: ExecutivePricingAskOdooState
}

export interface ExecutivePricingChatResult extends CouncilResult {
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

export interface RunExecutivePricingChatOptions extends Omit<RunCouncilOptions, 'askOdoo'> {
  fetchExecutivePack?: (input: FetchExecutiveContextPackInput) => Promise<ExecutiveContextPack | null>
  executivePack?: ExecutiveContextPack | null
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

function assertValidConfirmedPriceSheet(sheet: unknown): asserts sheet is ConfirmedPriceSheet | null | undefined {
  if (sheet !== undefined && sheet !== null) {
    if (isUnconfirmedDocumentDraft(sheet) || !isConfirmedPriceSheet(sheet)) {
      throw new Error(UNCONFIRMED_DRAFT_REJECTED_ERROR)
    }
  }
}

export function shouldRunExecutivePricingChat(
  question: string,
  input: Pick<RunExecutivePricingChatInput, 'confirmedPriceSheet' | 'isFollowUpOnConfirmedSheet'>,
  options?: Pick<RunExecutivePricingChatOptions, 'executivePack' | 'fetchExecutivePack'>,
): boolean {
  assertValidConfirmedPriceSheet(input.confirmedPriceSheet)
  if (input.confirmedPriceSheet !== undefined && input.confirmedPriceSheet !== null) {
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

function verifyExecutiveBrief(
  reply: string,
  question: string,
  grounded: ExecutiveGroundedNumbers,
  confirmedUserInputs: readonly string[],
  allowedDateStrings: readonly string[],
  extraEntityNames: readonly string[],
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

  const simulationNumbers = extractSimulationNumbers(grounded)
  const parsedSimulationNums = simulationNumbers
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
    -10,
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
  ]

  const numericVerifier = verifyFeryalReplyNumbers(sanitizedForNumericScan, augmentedToolNumbers, {
    allowedDateStrings,
    allowedEntityNames: [...grounded.allowedEntityNames, ...extraEntityNames],
  })

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

  const groundCheck = reviewGroundedNumbers(
    reply,
    {
      toolNumbers: grounded.toolNumbers,
      canonicalDecimals: grounded.canonicalDecimals,
      simulationNumbers,
      labeledFacts: grounded.labeledFacts,
      cogsReadable: false,
    },
    {
      question,
      userInputs: confirmedUserInputs,
      simulationNumbers,
      allowedDecimals: [
        ...grounded.canonicalDecimals,
        ...simulationNumbers,
        ...confirmedUserInputs,
        ...extractCanonicalDecimals(allowedDateStrings.join(' ')),
      ],
      allowedPercents,
      allowedEntityNames: [...grounded.allowedEntityNames, ...extraEntityNames],
      forbidPosCogsMarginClaims: true,
      executiveBriefMode: true,
    },
  )

  if (!groundCheck.ok) {
    return {
      valid: false,
      extractedNumbers: numericVerifier.extractedNumbers,
      unverifiedNumbers: numericVerifier.unverifiedNumbers,
      reason: 'GUARD_REJECTED',
    }
  }

  return numericVerifier
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

/**
 * Builds deterministic `ComparableFact[]` for the unified `runFeryalCouncil` comparison gate.
 * Every emitted fact uses canonical Decimal values and real Odoo / confirmed-sheet entity IDs.
 */
export function buildExecutiveComparableFacts(
  pack: ExecutiveContextPack,
  simulation: ScenarioSimulationResult,
): ComparableFact[] {
  const from = pack.period.from
  const to = pack.period.to
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return []
  }

  const periodKey = from === to ? from : `${from}..${to}`
  const facts: ComparableFact[] = []
  const seen = new Set<string>()

  const pushFact = (
    metric: string,
    entityType: string,
    entityId: string,
    entityName: string,
    rawAmount: string | number | null | undefined,
    unit: 'KWD' | 'qty' | 'orders',
  ): void => {
    if (rawAmount === null || rawAmount === undefined) return
    const parsed = Decimal.parse(String(rawAmount).trim())
    if (!parsed) return
    const cleanId = entityId.trim()
    const cleanName = entityName.trim() || cleanId
    if (!cleanId || isExcludedOdooEntity(cleanId) || isExcludedOdooEntity(cleanName)) return
    const id = `${metric}|${cleanId}|${periodKey}`
    if (seen.has(id)) return
    seen.add(id)
    facts.push({
      id,
      metric,
      period: periodKey,
      date: periodKey,
      unit,
      value: parsed.canonical(),
      entityType,
      entityId: cleanId,
      entityName: cleanName,
    })
  }

  for (const opt of simulation.options) {
    pushFact(
      'stress_test_delta_kwd',
      'pricing_option',
      opt.optionKey,
      opt.label,
      opt.stressTestDeltaKwd,
      'KWD',
    )
    pushFact(
      'conservative_delta_kwd',
      'pricing_option',
      opt.optionKey,
      opt.label,
      opt.conservativeDeltaKwd,
      'KWD',
    )
    pushFact('base_delta_kwd', 'pricing_option', opt.optionKey, opt.label, opt.baseDeltaKwd, 'KWD')
    pushFact(
      'stress_test_projected_revenue_kwd',
      'pricing_option',
      opt.optionKey,
      opt.label,
      opt.stressTestCase.projectedRevenueKwd,
      'KWD',
    )
  }

  const selectedSkuIds = new Set<number>()
  const selectedSkus: SkuVelocityRow[] = []
  const addSku = (sku: SkuVelocityRow | undefined): void => {
    if (!sku || selectedSkuIds.has(sku.productId)) return
    selectedSkuIds.add(sku.productId)
    selectedSkus.push(sku)
  }

  for (const sku of pack.skus.slice(0, 30)) {
    addSku(sku)
  }
  const skuById = new Map<number, SkuVelocityRow>(pack.skus.map((sku) => [sku.productId, sku]))
  for (const opt of simulation.options) {
    for (const line of opt.lines) {
      if (line.matched && line.productId !== null) {
        addSku(skuById.get(line.productId))
      }
    }
  }
  if (pack.skus.length > 0) {
    addSku(pack.skus[pack.skus.length - 1])
  }

  for (const sku of selectedSkus) {
    const skuEntityId = String(sku.productId)
    pushFact('item_net_kwd', 'product', skuEntityId, sku.name, sku.netSalesKwd, 'KWD')
    pushFact('item_qty', 'product', skuEntityId, sku.name, sku.qty, 'qty')
    if (sku.avgRealizedPriceKwd !== null) {
      pushFact(
        'item_unit_price_kwd',
        'product',
        skuEntityId,
        sku.name,
        sku.avgRealizedPriceKwd,
        'KWD',
      )
    }
  }

  const primaryOption =
    simulation.options.find((opt) => opt.optionKey === simulation.recommendedOptionKey) ??
    simulation.options[0] ??
    null
  if (primaryOption) {
    for (const line of primaryOption.lines) {
      if (line.matched && line.productId !== null && line.feryalRecKwd !== null) {
        pushFact(
          'feryal_rec_price_kwd',
          'product',
          String(line.productId),
          line.matchedOdooName ?? line.itemName,
          line.feryalRecKwd,
          'KWD',
        )
      }
    }
  }

  const brandEntityId = pack.scope.brandId ?? 'venture-foods'
  const brandEntityName = pack.scope.brandLabelEn ?? 'Venture Foods'
  pushFact(
    'brand_net_sales_kwd',
    'brand',
    brandEntityId,
    brandEntityName,
    pack.totals.totalNetSalesKwd,
    'KWD',
  )
  pushFact('brand_qty', 'brand', brandEntityId, brandEntityName, pack.totals.totalQty, 'qty')

  if (pack.branchChannelMix?.available) {
    for (const ch of pack.branchChannelMix.channels) {
      pushFact(
        'channel_net_sales_kwd',
        'channel',
        ch.channelKey,
        ch.channelKey,
        ch.netSalesKwd,
        'KWD',
      )
    }
    const activeBranchSet = new Set<string>(ACTIVE_VENTURE_BRANCH_IDS)
    for (const br of pack.branchChannelMix.topBranches) {
      if (!activeBranchSet.has(br.branchId)) continue
      pushFact('net_sales_kwd', 'branch', br.branchId, br.labelEn, br.netSalesKwd, 'KWD')
      pushFact('orders', 'branch', br.branchId, br.labelEn, br.orders, 'orders')
    }
  }

  return facts
}

/**
 * Pure deterministic `askOdoo` adapter for `runFeryalCouncil` on executive pricing and
 * confirmed price-sheet questions. Performs zero LLM calls; `runFeryalCouncil` executes
 * the single unified 3-model Council and structured comparison consensus gate.
 */
export function createExecutivePricingAskOdoo(
  config: CreateExecutivePricingAskOdooOptions = {},
): typeof askFeryalOdooAgent {
  assertValidConfirmedPriceSheet(config.confirmedPriceSheet)
  const activeSheet = config.confirmedPriceSheet ?? null

  return async function executivePricingAskOdoo(
    agentInput: AskFeryalOdooAgentInput,
  ): Promise<AskFeryalOdooAgentResult> {
    const question = agentInput.question.trim()
    const rawPeriodInput = agentInput.context?.period ?? agentInput.period ?? null
    const validatedDefaults = validateFeryalContextDefaults({
      period: rawPeriodInput,
      customFrom: agentInput.context?.customFrom ?? agentInput.customFrom,
      customTo: agentInput.context?.customTo ?? agentInput.customTo,
      branch: agentInput.context?.branch ?? agentInput.branch,
      brand: agentInput.context?.brand ?? agentInput.brand,
      channel: agentInput.context?.channel ?? agentInput.channel,
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
      agentInput.referenceNowMs,
      validatedDefaults,
    )

    const initialFrozenScope = buildFeryalFrozenScope({
      dateFrom: resolvedPeriod.from,
      dateTo: resolvedPeriod.to,
      validatedPeriod: validatedDefaults.period,
      rawPeriodKey: rawPeriodInput,
      requestedPeriodLabel: config.periodLabel,
      hasExplicitPeriod: resolvedPeriod.hasExplicitPeriod,
      brandId: effectiveBrandId,
      branchId: effectiveBranchId,
      channelId: effectiveChannelId,
      referenceNowMs: agentInput.referenceNowMs,
    })

    if (config.state) {
      config.state.frozenScope = initialFrozenScope
      config.state.activePriceSheetSummary = buildActivePriceSheetSummary(
        activeSheet,
        null,
        initialFrozenScope,
      )
    }

    const pack =
      config.executivePack !== undefined
        ? config.executivePack
        : await (config.fetchExecutivePack ?? fetchExecutiveContextPackFromOdoo)({
            fromIso: resolvedPeriod.from,
            toIso: resolvedPeriod.to,
            periodKey: validatedDefaults.period ?? 'custom',
            periodLabelAr: resolvedPeriod.periodLabelAr,
            brandId: effectiveBrandId,
            branchId: effectiveBranchId,
            referenceNowMs: agentInput.referenceNowMs,
          })

    const timestampIso = new Date(agentInput.referenceNowMs ?? Date.now()).toISOString()

    if (!pack || (pack.skus.length === 0 && !activeSheet)) {
      const noDataReply = buildFeryalNoOdooDataSuggestion('pos_no_data')
      const noDataQueries: FeryalExecutedOdooQuery[] = pack
        ? [
            {
              model: pack.odooQueryMeta.model,
              method: pack.odooQueryMeta.method,
              domain: pack.odooQueryMeta.domain,
              groupby: [...pack.odooQueryMeta.groupby],
              period: { from: pack.period.from, to: pack.period.to },
            },
          ]
        : []
      const noDataVerifier = verifyFeryalReplyNumbers(noDataReply, [])
      const noDataAudit: FeryalAuditLogEntry = {
        id: randomUUID(),
        timestampIso,
        userSub: agentInput.userSub ?? 'anonymous',
        userRole: agentInput.userRole ?? 'executive',
        ...(agentInput.userNameAr ? { userNameAr: agentInput.userNameAr } : {}),
        question,
        status: 'no_odoo_data',
        executedQueries: noDataQueries,
        verifier: noDataVerifier,
        finalReply: noDataReply,
      }
      return {
        reply: noDataReply,
        status: 'no_odoo_data',
        executedQueries: noDataQueries,
        verifier: noDataVerifier,
        toolNumbers: [],
        period: { from: resolvedPeriod.from, to: resolvedPeriod.to },
        facts: [],
        source: null,
        auditEntry: noDataAudit,
      }
    }

    const finalFrozenScope = buildFeryalFrozenScope({
      dateFrom: pack.period.from,
      dateTo: pack.period.to,
      validatedPeriod: validatedDefaults.period,
      rawPeriodKey: rawPeriodInput,
      requestedPeriodLabel: config.periodLabel,
      hasExplicitPeriod: resolvedPeriod.hasExplicitPeriod,
      brandId: pack.scope.brandId ?? effectiveBrandId,
      branchId: pack.scope.branchId ?? effectiveBranchId,
      channelId: effectiveChannelId,
      referenceNowMs: agentInput.referenceNowMs,
    })

    const simulation: ScenarioSimulationResult = simulateExecutivePricingOptions({
      pack,
      sheet: activeSheet,
      prompt: question,
    })

    if (config.state) {
      config.state.frozenScope = finalFrozenScope
      config.state.activePriceSheetSummary = buildActivePriceSheetSummary(
        activeSheet,
        simulation,
        finalFrozenScope,
      )
    }

    const locale = detectExecutiveLocale(question)
    const asksCogs = asksMarginOrCogs(question)
    const grounded = collectExecutiveGroundedNumbers(pack, simulation)
    const deterministicBrief = renderDeterministicExecutiveBrief(
      pack,
      simulation,
      locale,
      asksCogs,
    )
    const confirmedUserInputs = collectConfirmedSheetInputs(activeSheet)
    const extraEntityNames = activeSheet?.fileName ? [activeSheet.fileName] : []
    const allowedDates = [
      ...new Set([...resolvedPeriod.allowedDateStrings, pack.period.from, pack.period.to]),
    ]

    const verifier = verifyExecutiveBrief(
      deterministicBrief,
      question,
      grounded,
      confirmedUserInputs,
      allowedDates,
      extraEntityNames,
    )

    const executedQueries: FeryalExecutedOdooQuery[] = [
      {
        model: pack.odooQueryMeta.model,
        method: pack.odooQueryMeta.method,
        domain: pack.odooQueryMeta.domain,
        groupby: [...pack.odooQueryMeta.groupby],
        period: { from: pack.period.from, to: pack.period.to },
      },
    ]

    const status = verifier.valid ? 'answered' : 'verifier_rejected'
    const facts = verifier.valid ? buildExecutiveComparableFacts(pack, simulation) : []
    const auditEntry: FeryalAuditLogEntry = {
      id: randomUUID(),
      timestampIso,
      userSub: agentInput.userSub ?? 'anonymous',
      userRole: agentInput.userRole ?? 'executive',
      ...(agentInput.userNameAr ? { userNameAr: agentInput.userNameAr } : {}),
      question,
      status,
      executedQueries,
      verifier,
      finalReply: deterministicBrief,
    }

    return {
      reply: deterministicBrief,
      status,
      executedQueries,
      verifier,
      toolNumbers: [...grounded.toolNumbers],
      period: { from: pack.period.from, to: pack.period.to },
      facts,
      source: {
        system: 'Odoo 17',
        model: pack.odooQueryMeta.model,
        period: { from: pack.period.from, to: pack.period.to },
        lastSyncAt: null,
      },
      auditEntry,
    }
  }
}

/**
 * Thin unified wrapper that routes executive pricing & confirmed price-sheet questions
 * through `runFeryalCouncil` (`src/server/ai/council.ts`) using `createExecutivePricingAskOdoo`.
 */
export async function runExecutivePricingChat(
  input: RunExecutivePricingChatInput,
  options: RunExecutivePricingChatOptions = {},
): Promise<ExecutivePricingChatResult> {
  assertValidConfirmedPriceSheet(input.confirmedPriceSheet)

  const state: ExecutivePricingAskOdooState = {
    frozenScope: null,
    activePriceSheetSummary: null,
  }

  const askOdoo = createExecutivePricingAskOdoo({
    confirmedPriceSheet: input.confirmedPriceSheet,
    isFollowUpOnConfirmedSheet: input.isFollowUpOnConfirmedSheet,
    activePriceSheetSummary: input.activePriceSheetSummary,
    periodLabel: input.periodLabel,
    executivePack: options.executivePack,
    fetchExecutivePack: options.fetchExecutivePack,
    state,
  })

  const councilResult = await runFeryalCouncil(
    {
      question: input.question,
      userId: input.userId,
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
    },
    {
      askOdoo,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
      keys: options.keys,
      models: options.models,
      persist: options.persist,
    },
  )

  const rawPeriodInput = input.context?.period ?? input.period ?? null
  const frozenScope =
    state.frozenScope ??
    computeFeryalChatFrozenScope({
      question: input.question,
      period: councilResult.period,
      rawPeriodInput,
      requestedPeriodLabel: input.periodLabel ?? null,
      context: input.context,
      referenceNowMs: input.referenceNowMs,
    })

  const diagnostics = buildFeryalChatDiagnostics(
    'executive_pricing',
    councilResult.participants,
    councilResult.agreed.length >= 2,
    councilResult.status === 'answered' && councilResult.agreed.length < 2,
  )

  return {
    ...councilResult,
    frozenScope,
    activePriceSheetSummary: state.activePriceSheetSummary,
    diagnostics,
  }
}
