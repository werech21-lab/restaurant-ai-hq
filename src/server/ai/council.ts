import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import type {
  AdvisorReport,
  FeryalChatHistoryTurn,
  FeryalContextPack,
  FeryalGlData,
  FeryalHourlyData,
  FeryalLlmContract,
  FeryalPackSection,
  FeryalPackSectionKey,
  FeryalTopProductsData,
  FeryalChannelsData,
} from '@/lib/feryal-context-types'
import {
  containsExcludedEntityText,
  isCentralKitchenQurainQuestion,
  normalizeArabicText,
  normalizeDigits,
} from '@/lib/feryal-intent'
import {
  askFeryalOdooAgent,
  FERYAL_COMPETITOR_REFUSAL,
  type AskFeryalOdooAgentInput,
  type AskFeryalOdooAgentResult,
  type FeryalContextDefaults,
  type FeryalExecutedOdooQuery,
  type FeryalNumericVerificationResult,
  type FeryalReplyStatus,
} from '@/lib/feryal-odoo-agent'
import { logger, errorFields } from '@/lib/logger'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { loadFeryalCompanyContext, loadLatestAdvisorReports } from './advisor-reports'
import {
  isAllowedDerivedNumber,
  parseFeryalLlmContract,
  renderFeryalContractReply,
  verifyFeryalContractPerClaim,
  type FeryalVerifiedContractResult,
} from './derived-numbers'
import { readCouncilKeys, type CouncilKeys } from './env'
import { collectPackSectionNumbers } from './feryal-context'
import { resolveCouncilModels, type CouncilModels } from './models'
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

export const COUNCIL_AI_EXPLANATION_UNAVAILABLE_NOTE =
  'ملاحظة: الشرح التحليلي الإضافي من النماذج غير متاح حالياً — الأرقام أعلاه موثّقة مباشرة من Odoo. | Note: AI analytical explanation is currently unavailable — the figures above are verified directly from Odoo.' as const

export const COUNCIL_MODEL_FALLBACK_NOTE =
  'ملاحظة: تعذّر الاتصال بنماذج التحليل حالياً — الإجابة أعلاه مبنية مباشرة على حزمة بيانات Odoo.' as const

const MIN_KEY_LENGTH = 20
const PRIMARY_MAX_TOKENS = 1_200
const REVIEWER_MAX_TOKENS = 300
const MAX_HISTORY_TURNS = 10
const MAX_HISTORY_TURN_CHARS = 1_200
const MAX_COMPANY_CONTEXT_CHARS = 4_000

const PACK_SECTION_KEYS: readonly FeryalPackSectionKey[] = [
  'companyTotals',
  'branches',
  'unattributed',
  'channels',
  'brands',
  'topProducts',
  'hourly',
  'deltas',
  'gl',
  'receivables',
  'purchases',
  'stock',
  'hr',
]

const NUMBER_TOKEN_RE =
  /(?:(?<=^|[\s:(«"'،,=+])[-−])?\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?:(?<=^|[\s:(«"'،,=+])[-−])?\d+(?:\.\d+)?/g

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
  history?: FeryalChatHistoryTurn[]
  contextPack?: FeryalContextPack
}

export interface RunCouncilOptions {
  askOdoo?: typeof askFeryalOdooAgent
  fetchImpl?: typeof fetch
  timeoutMs?: number
  keys?: CouncilKeys
  models?: CouncilModels
  persist?: (rows: readonly AiRunDraft[]) => Promise<void>
  contextPack?: FeryalContextPack
}

type AgentAskInput = AskFeryalOdooAgentInput & {
  history?: FeryalChatHistoryTurn[]
  contextPack?: FeryalContextPack
}

type AgentAskResult = AskFeryalOdooAgentResult & {
  contextPack?: FeryalContextPack
  missingMetrics?: string[]
}

export function hashQuestion(question: string): string {
  return createHash('sha256').update(question.trim()).digest('hex')
}

function providerKey(keys: CouncilKeys, provider: ProviderId): string {
  if (provider === 'anthropic') return keys.anthropic ?? ''
  if (provider === 'google') return keys.google ?? ''
  return keys.xai ?? ''
}

function sanitizeHistory(
  raw: readonly FeryalChatHistoryTurn[] | undefined,
): FeryalChatHistoryTurn[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  const cleaned: FeryalChatHistoryTurn[] = []
  for (const item of raw) {
    if (!item || (item.role !== 'user' && item.role !== 'assistant')) continue
    if (typeof item.text !== 'string') continue
    const text = item.text.replace(/\s+/g, ' ').trim().slice(0, MAX_HISTORY_TURN_CHARS)
    if (!text) continue
    cleaned.push({ role: item.role, text })
  }
  return cleaned.slice(-MAX_HISTORY_TURNS)
}

function hasExcludedEntityLeak(
  text: string | null | undefined,
  allowQurainCentralKitchen = false,
): boolean {
  return containsExcludedEntityText(text, { allowQurainCentralKitchen })
}

function emptyVerifier(): FeryalNumericVerificationResult {
  return { valid: false, extractedNumbers: [], unverifiedNumbers: [], reason: 'ODOO_READ_FAILED' }
}

function compactSectionData(key: FeryalPackSectionKey, data: unknown): unknown {
  if (!data || typeof data !== 'object') return data
  if (key === 'branches') {
    const b = data as { items?: Array<{ branchId?: string; nameAr?: string; nameEn?: string }> }
    if (Array.isArray(b.items)) {
      return {
        ...b,
        items: b.items.filter(
          (item) =>
            !isExcludedOdooEntity(item.branchId) &&
            !isExcludedOdooEntity(item.nameAr) &&
            !isExcludedOdooEntity(item.nameEn),
        ),
      }
    }
  }
  if (key === 'brands') {
    const br = data as { items?: Array<{ brandId?: string; nameAr?: string; nameEn?: string }> }
    if (Array.isArray(br.items)) {
      return {
        ...br,
        items: br.items.filter(
          (item) =>
            !isExcludedOdooEntity(item.brandId) &&
            !isExcludedOdooEntity(item.nameAr) &&
            !isExcludedOdooEntity(item.nameEn),
        ),
      }
    }
  }
  if (key === 'purchases') {
    const p = data as { topVendors?: Array<{ name?: string }> }
    if (Array.isArray(p.topVendors)) {
      return {
        ...p,
        topVendors: p.topVendors.filter((v) => !isExcludedOdooEntity(v.name)),
      }
    }
  }
  if (key === 'topProducts') {
    const tp = data as FeryalTopProductsData
    return {
      ...tp,
      items: tp.items.filter((item) => !isExcludedOdooEntity(item.name)).slice(0, 15),
    }
  }
  if (key === 'gl') {
    const gl = data as FeryalGlData
    return {
      ...gl,
      operatingProfitKwd: gl.profitWithheld ? null : gl.operatingProfitKwd,
    }
  }
  if (key === 'channels') {
    const ch = data as FeryalChannelsData
    const byBranch: Record<string, FeryalChannelsData['byBranch'][string]> = {}
    for (const [branchId, rows] of Object.entries(ch.byBranch)) {
      if (isExcludedOdooEntity(branchId)) continue
      const activeRows = rows.filter((row) => row.netKwd !== 0 || row.payments !== 0)
      if (activeRows.length > 0) byBranch[branchId] = activeRows
    }
    return { company: ch.company, byBranch }
  }
  if (key === 'hourly') {
    const h = data as FeryalHourlyData
    return {
      peakHour: h.peakHour,
      weakestHours: h.weakestHours,
      hourlySeries: h.hourlySeries.filter((pt) => pt.orders > 0 || pt.netKwd > 0),
    }
  }
  return data
}

async function resolveCompanyContext(pack: FeryalContextPack): Promise<{
  companyContext: string
  advisorReports: AdvisorReport[]
}> {
  let companyContext = typeof pack.companyContext === 'string' ? pack.companyContext.trim() : ''
  if (!companyContext) {
    try {
      companyContext = loadFeryalCompanyContext().trim()
    } catch {
      companyContext = ''
    }
  }
  let advisorReports = Array.isArray(pack.advisorReports) ? pack.advisorReports : []
  if (advisorReports.length === 0) {
    try {
      advisorReports = await loadLatestAdvisorReports()
    } catch {
      advisorReports = []
    }
  }
  const safeReports = advisorReports.filter(
    (r) =>
      r.evidence.every((e) => !hasExcludedEntityLeak(e.text)) &&
      r.rootCauses.every((c) => !hasExcludedEntityLeak(c.text)) &&
      r.proposals.every((p) => !hasExcludedEntityLeak(p.text) && !hasExcludedEntityLeak(p.owner)),
  )
  return {
    companyContext: companyContext.slice(0, MAX_COMPANY_CONTEXT_CHARS),
    advisorReports: safeReports,
  }
}

function buildCompactPackPayload(
  pack: FeryalContextPack,
  advisorReports: readonly AdvisorReport[],
): Record<string, unknown> {
  const sections: Record<string, unknown> = {}
  const unavailableSections: Array<{ section: string; reason: string }> = []
  let latestSyncAt: string | null = null

  for (const key of PACK_SECTION_KEYS) {
    const section = pack[key] as FeryalPackSection<unknown>
    if (section.status === 'ok' && section.data !== undefined) {
      sections[key] = compactSectionData(key, section.data)
      if (section.source?.lastSyncAt && (!latestSyncAt || section.source.lastSyncAt > latestSyncAt)) {
        latestSyncAt = section.source.lastSyncAt
      }
    } else {
      unavailableSections.push({
        section: key,
        reason: section.reason ?? 'unavailable',
      })
    }
  }

  return {
    connected: pack.connected,
    period: pack.period,
    previousPeriod: pack.previousPeriod,
    elapsedDaysInMonth: pack.elapsedDaysInMonth,
    totalDaysInMonth: pack.totalDaysInMonth,
    lastSyncAt: latestSyncAt,
    sections,
    unavailableSections,
    ...(advisorReports.length > 0 ? { advisorReports } : {}),
  }
}

function buildExecutiveSystemPrompt(companyContext: string): string {
  const lines = [
    'أنتِ فريال، المديرة التنفيذية لشركة فنتشر فودز ذ.م.م. (Feryal, Executive Director of Venture Foods W.L.L., Kuwait).',
    'Answer the user directly as Feryal in rich, natural Gulf/Levantine Executive Arabic (or crisp Executive English if the question is written in English).',
    'Be specific to Venture Foods W.L.L. operations (the 7 restaurants, school canteens, exhibition booths «بوثات المعارض», Ardiya central kitchen, brands, and delivery channels such as talabat-tgo vs talabat-tmp, keeta, deliveroo, jahez, snoonu, dine-in, takeaway-direct). Never give generic textbook advice.',
    '',
    'Analytical Requirements:',
    '1. Directly answer the question, comparing periods, branches, channels, peak/weakest hours, brands, products, purchases, stock moves/scrap, GL, receivables, or HR headcount as relevant.',
    '2. State underlying root causes explicitly as hypotheses ("kind": "hypothesis" / استنتاج), never as proven causal facts unless directly observed in data.',
    '3. Provide 3–5 concrete, owner-actionable proposals specifying who, what, and when ("kind": "proposal" / اقتراح). Avoid unverified numeric targets in proposal text.',
    '4. For conversational greetings, meta-questions, or follow-ups, respond warmly in character using the conversation history and suggest 2–3 concrete analyses available in the pack.',
    '',
    'Strict Grounding & Truthfulness Rules:',
    '- EVERY number you write MUST come directly from an "ok" section of the supplied FeryalContextPack JSON and cite its exact section name (companyTotals, branches, unattributed, channels, brands, topProducts, hourly, deltas, gl, receivables, purchases, stock, hr, period), OR be direct arithmetic / run-rate (actual ÷ elapsedDaysInMonth × totalDaysInMonth) computed from operands in those sections.',
    '- NEVER invent, estimate from memory, or extrapolate numbers not grounded in the pack.',
    '- When reporting a month-end forecast/run-rate, label it clearly with «تقدير/اقتراح — ليس رقماً من Odoo» and show the exact operands.',
    '- If any metric requested by the user is not in Odoo (or belongs to unavailableSections / knownMissingMetrics), add a concise entry inside missing_metrics including «غير متاح في Odoo», and STILL answer thoroughly using all available "ok" sections.',
    '- NEVER mention excluded entities (POS config IDs 24, 25, 39, 40, or canceled/decommissioned locations/brands).',
    '- Respect accounting guards: never split company GL expenses by branch, never invent operating profit when gl.profitWithheld is true, and never invent per-customer receivable aging when receivables.pendingReconciliation is true.',
    '',
    'Return ONE valid JSON object and NO markdown fences or extra text:',
    '{"answer_ar":"...","claims":[{"text":"...","numbers":[{"value":123,"section":"companyTotals"}]}],"root_causes":[{"text":"...","kind":"hypothesis"}],"proposals":[{"text":"...","owner":"...","kind":"proposal"}],"missing_metrics":["..."]}',
    'Ensure every numeric figure appearing in answer_ar or claims[].text is listed in claims[].numbers with its exact pack section.',
  ]

  if (companyContext) {
    lines.push(
      '',
      'Owner Strategic Context (qualitative background only — never cite as numeric figures):',
      companyContext,
    )
  }

  return lines.join('\n')
}

function buildExecutiveUserPrompt(input: {
  question: string
  history: readonly FeryalChatHistoryTurn[]
  packPayload: Record<string, unknown>
  knownMissingMetrics: readonly string[]
}): string {
  const parts: string[] = [`Question:\n${input.question}`]

  if (input.history.length > 0) {
    const turns = input.history.map((turn) => `- ${turn.role}: ${turn.text}`).join('\n')
    parts.push(`Conversation history (most recent ${input.history.length} turns):\n${turns}`)
  }

  if (input.knownMissingMetrics.length > 0) {
    parts.push(
      `Known unavailable Odoo metrics for this query (include in missing_metrics and continue answering from available pack sections):\n${JSON.stringify(input.knownMissingMetrics)}`,
    )
  }

  parts.push(`FeryalContextPack JSON:\n${JSON.stringify(input.packPayload)}`)
  return parts.join('\n\n')
}

function collectOffendingNumbers(verified: FeryalVerifiedContractResult): string[] {
  const offending = new Set<string>()
  for (const dropped of verified.droppedClaims) {
    const match = /:([-−]?\d+(?:\.\d+)?)$/.exec(dropped.reason)
    if (match) offending.add(match[1])
    for (const n of dropped.numbers) {
      if (Number.isFinite(n.value)) offending.add(String(n.value))
    }
  }
  return [...offending]
}

function buildDraftRow(
  userId: string,
  questionHash: string,
  call: ProviderCallResult,
  status: AiRunDraft['status'],
  errorCode: string | null,
): AiRunDraft {
  return {
    id: randomUUID(),
    userId: userId || 'anonymous',
    questionHash,
    provider: call.provider,
    modelId: call.modelId,
    latencyMs: call.latencyMs,
    tokensIn: call.tokensIn,
    tokensOut: call.tokensOut,
    estCostMicroUsd: estimateCostMicroUsd(call.provider, call.tokensIn, call.tokensOut),
    status,
    errorCode,
  }
}

function buildReviewerSystemPrompt(): string {
  return [
    'You are a lightweight numeric and consistency reviewer for Venture Foods W.L.L. executive answers.',
    'Compare the draft claims, root causes, and proposals against the FeryalContextPack numeric summary.',
    'Check:',
    '1. Numbers in claims match the pack summary or direct arithmetic/run-rate from those pack values.',
    '2. No excluded entities (IDs 24, 25, 39, 40 or decommissioned entities) appear.',
    '3. No contradictory proposals and no withheld operating profit reported when profitWithheld is true.',
    'Return ONE valid JSON object and nothing else:',
    '{"status":"ok","note":""}',
    'or if an issue is detected:',
    '{"status":"flag","note":"concise factual Arabic note without inventing numbers"}',
  ].join('\n')
}

function buildReviewerUserPrompt(input: {
  question: string
  verified: FeryalVerifiedContractResult
  pack: FeryalContextPack
  sectionNumbers: Map<string, Set<number>>
}): string {
  const packNumbersSummary: Record<string, number[]> = {}
  for (const [section, nums] of input.sectionNumbers.entries()) {
    packNumbersSummary[section] = [...nums]
  }
  return JSON.stringify({
    question: input.question,
    draft: {
      claims: input.verified.verifiedClaims,
      rootCauses: input.verified.rootCauses,
      proposals: input.verified.verifiedProposals,
      missingMetrics: input.verified.missingMetrics,
    },
    packSummary: {
      period: input.pack.period,
      elapsedDaysInMonth: input.pack.elapsedDaysInMonth,
      totalDaysInMonth: input.pack.totalDaysInMonth,
      profitWithheld:
        input.pack.gl.status === 'ok' ? Boolean(input.pack.gl.data?.profitWithheld) : undefined,
      packNumbersSummary,
    },
  })
}

interface ParsedReviewerOutcome {
  status: 'ok' | 'flag' | 'invalid'
  note: string
}

function parseReviewerOutcome(rawText: string): ParsedReviewerOutcome {
  const trimmed = rawText.trim()
  if (/^ok$/i.test(trimmed)) {
    return { status: 'ok', note: '' }
  }
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  let parsed: unknown = null
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1))
      } catch {
        return { status: 'invalid', note: '' }
      }
    } else {
      return { status: 'invalid', note: '' }
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { status: 'invalid', note: '' }
  }
  const rec = parsed as { status?: unknown; note?: unknown }
  const statusRaw = typeof rec.status === 'string' ? rec.status.trim().toLowerCase() : ''
  const note = typeof rec.note === 'string' ? rec.note.trim() : ''
  if (statusRaw === 'ok') return { status: 'ok', note }
  if (statusRaw === 'flag') return { status: 'flag', note }
  return { status: 'invalid', note: '' }
}

function sanitizeReviewerNote(
  note: string,
  pack: FeryalContextPack,
  sectionNumbers: Map<string, Set<number>>,
  allowQurainCentralKitchen = false,
): string | undefined {
  const trimmed = note.trim()
  if (!trimmed || hasExcludedEntityLeak(trimmed, allowQurainCentralKitchen)) return undefined
  const operands: number[] = []
  for (const nums of sectionNumbers.values()) {
    for (const v of nums) operands.push(v)
  }
  const normalized = normalizeDigits(trimmed)
  NUMBER_TOKEN_RE.lastIndex = 0
  for (const match of normalized.matchAll(NUMBER_TOKEN_RE)) {
    const value = Number(match[0].replace(/−/g, '-').replace(/,/g, ''))
    if (!Number.isFinite(value)) return undefined
    if (
      !isAllowedDerivedNumber(value, operands, {
        elapsedDays: pack.elapsedDaysInMonth,
        totalDaysInMonth: pack.totalDaysInMonth,
      })
    ) {
      return undefined
    }
  }
  return trimmed
}

function mergeMissingMetrics(
  verified: FeryalVerifiedContractResult,
  agentMissing: readonly string[] | undefined,
  allowQurainCentralKitchen = false,
): FeryalVerifiedContractResult {
  if (verified.missingMetrics.length > 0 || !agentMissing || agentMissing.length === 0) {
    return verified
  }
  const merged: string[] = []
  const seen = new Set<string>()
  for (const raw of agentMissing) {
    const trimmed = raw.trim()
    if (!trimmed || hasExcludedEntityLeak(trimmed, allowQurainCentralKitchen)) continue
    const norm = normalizeArabicText(trimmed)
    if (seen.has(norm)) continue
    seen.add(norm)
    merged.push(trimmed)
  }
  return merged.length > 0 ? { ...verified, missingMetrics: merged } : verified
}

function verifierFromVerifiedContract(
  verified: FeryalVerifiedContractResult,
  fallbackVerifier: FeryalNumericVerificationResult,
): FeryalNumericVerificationResult {
  const extracted = new Set<number>()
  for (const claim of verified.verifiedClaims) {
    for (const citation of claim.numbers) {
      if (Number.isFinite(citation.value)) extracted.add(citation.value)
    }
  }
  return {
    valid: true,
    extractedNumbers:
      extracted.size > 0 ? [...extracted] : [...fallbackVerifier.extractedNumbers],
    unverifiedNumbers: [],
  }
}

function buildFallbackReply(odooReply: string): string {
  const trimmed = odooReply.trim()
  if (!trimmed) return COUNCIL_MODEL_FALLBACK_NOTE
  if (trimmed.includes(COUNCIL_MODEL_FALLBACK_NOTE)) return trimmed
  return `${trimmed}\n\n${COUNCIL_MODEL_FALLBACK_NOTE}`
}

async function safePersistDrafts(
  persist: (rows: readonly AiRunDraft[]) => Promise<void>,
  drafts: readonly AiRunDraft[],
): Promise<void> {
  if (drafts.length === 0) return
  try {
    await persist(drafts)
  } catch (error) {
    logger.error('ai run persist failed', errorFields(error))
  }
}

export async function runFeryalCouncil(
  input: RunCouncilInput,
  options: RunCouncilOptions = {},
): Promise<CouncilResult> {
  const question = input.question.trim()
  const allowQurainCentralKitchen = isCentralKitchenQurainQuestion(question)
  const questionHash = hashQuestion(question)
  const sanitizedHistory = sanitizeHistory(input.history)
  const initialContextPack = input.contextPack ?? options.contextPack
  const ask = options.askOdoo ?? askFeryalOdooAgent

  let odoo: AgentAskResult
  try {
    const agentInput: AgentAskInput = {
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
      ...(input.history !== undefined ? { history: sanitizedHistory } : {}),
      ...(initialContextPack !== undefined ? { contextPack: initialContextPack } : {}),
    }
    odoo = (await ask(agentInput as AskFeryalOdooAgentInput)) as AgentAskResult
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

  if (odoo.status === 'competitor_refusal') {
    return {
      reply: FERYAL_COMPETITOR_REFUSAL,
      status: 'competitor_refusal',
      participants: [],
      agreed: [],
      executedQueries: odoo.executedQueries,
      verifier: odoo.verifier,
      period: odoo.period,
      questionHash,
      auditEntry: odoo.auditEntry,
    }
  }

  const pack = odoo.contextPack ?? initialContextPack
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

  if (!pack) {
    return {
      reply: buildFallbackReply(odoo.reply),
      status: 'answered',
      participants: [],
      agreed: [],
      executedQueries: odoo.executedQueries,
      verifier: odoo.verifier,
      period: odoo.period,
      questionHash,
      auditEntry: odoo.auditEntry,
    }
  }

  const keys = options.keys ?? readCouncilKeys()
  const models = options.models ?? resolveCouncilModels()
  const timeoutMs = options.timeoutMs ?? COUNCIL_ANALYSIS_TIMEOUT_MS
  const persist = options.persist ?? persistAiRuns
  const configuredProviders = COUNCIL_PROVIDERS.filter(
    (provider) => providerKey(keys, provider).trim().length >= MIN_KEY_LENGTH,
  )

  if (configuredProviders.length === 0) {
    return {
      reply: buildFallbackReply(odoo.reply),
      status: 'answered',
      participants: [],
      agreed: [],
      executedQueries: odoo.executedQueries,
      verifier: odoo.verifier,
      period: odoo.period,
      questionHash,
      auditEntry: odoo.auditEntry,
    }
  }

  const { companyContext, advisorReports } = await resolveCompanyContext(pack)
  const systemPrompt = buildExecutiveSystemPrompt(companyContext)
  const packPayload = buildCompactPackPayload(pack, advisorReports)
  const userPrompt = buildExecutiveUserPrompt({
    question,
    history: sanitizedHistory,
    packPayload,
    knownMissingMetrics: odoo.missingMetrics ?? [],
  })

  const participants: CouncilParticipant[] = []
  const drafts: AiRunDraft[] = []

  let primarySuccess: {
    index: number
    provider: ProviderId
    modelId: string
    verified: FeryalVerifiedContractResult
  } | null = null

  for (let i = 0; i < configuredProviders.length; i += 1) {
    const provider = configuredProviders[i]
    const apiKey = providerKey(keys, provider).trim()
    let call: ProviderCallResult
    try {
      call = await callProvider({
        provider,
        apiKey,
        model: models[provider],
        system: systemPrompt,
        user: userPrompt,
        maxTokens: PRIMARY_MAX_TOKENS,
        timeoutMs,
        fetchImpl: options.fetchImpl,
      })
    } catch {
      call = {
        provider,
        requestedModel: models[provider],
        modelId: '',
        text: '',
        latencyMs: 0,
        tokensIn: null,
        tokensOut: null,
        status: 'error',
        errorCode: 'NETWORK',
      }
    }

    if (call.status !== 'ok') {
      participants.push({
        provider,
        modelId: call.modelId,
        status: 'error',
        errorCode: call.errorCode,
        latencyMs: call.latencyMs,
        offendingNumbers: [],
      })
      drafts.push(buildDraftRow(input.userId, questionHash, call, 'error', call.errorCode))
      continue
    }

    const contract: FeryalLlmContract | null = parseFeryalLlmContract(call.text)
    if (!contract) {
      participants.push({
        provider,
        modelId: call.modelId,
        status: 'guard_rejected',
        errorCode: 'MALFORMED_JSON',
        latencyMs: call.latencyMs,
        offendingNumbers: [],
      })
      drafts.push(
        buildDraftRow(input.userId, questionHash, call, 'guard_rejected', 'MALFORMED_JSON'),
      )
      continue
    }

    const verified = mergeMissingMetrics(
      verifyFeryalContractPerClaim(contract, pack, { allowQurainCentralKitchen }),
      odoo.missingMetrics,
      allowQurainCentralKitchen,
    )
    const candidateReply = renderFeryalContractReply(verified, pack, {
      allowQurainCentralKitchen,
    })

    if (hasExcludedEntityLeak(candidateReply, allowQurainCentralKitchen)) {
      participants.push({
        provider,
        modelId: call.modelId,
        status: 'guard_rejected',
        errorCode: 'EXCLUDED_ENTITY',
        latencyMs: call.latencyMs,
        offendingNumbers: [],
      })
      drafts.push(
        buildDraftRow(input.userId, questionHash, call, 'guard_rejected', 'EXCLUDED_ENTITY'),
      )
      continue
    }

    if (verified.allDropped || !candidateReply.trim()) {
      const offendingNumbers = collectOffendingNumbers(verified)
      const excludedTriggered =
        verified.droppedClaims.some((claim) => claim.reason === 'excluded_entity') ||
        hasExcludedEntityLeak(call.text, allowQurainCentralKitchen)
      const errorCode = excludedTriggered ? 'EXCLUDED_ENTITY' : 'GUARD_REJECTED'
      participants.push({
        provider,
        modelId: call.modelId,
        status: 'guard_rejected',
        errorCode,
        latencyMs: call.latencyMs,
        offendingNumbers,
      })
      drafts.push(buildDraftRow(input.userId, questionHash, call, 'guard_rejected', errorCode))
      continue
    }

    participants.push({
      provider,
      modelId: call.modelId,
      status: 'ok',
      errorCode: null,
      latencyMs: call.latencyMs,
      offendingNumbers: [],
    })
    drafts.push(buildDraftRow(input.userId, questionHash, call, 'ok', null))
    primarySuccess = {
      index: i,
      provider,
      modelId: call.modelId,
      verified,
    }
    break
  }

  if (!primarySuccess) {
    await safePersistDrafts(persist, drafts)
    return {
      reply: buildFallbackReply(odoo.reply),
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

  const agreed: CouncilAgreement[] = [
    { provider: primarySuccess.provider, modelId: primarySuccess.modelId },
  ]
  let reviewerNote: string | undefined

  const secondProvider = configuredProviders[primarySuccess.index + 1]
  if (secondProvider) {
    const sectionNumbers = collectPackSectionNumbers(pack)
    const reviewerApiKey = providerKey(keys, secondProvider).trim()
    let reviewerCall: ProviderCallResult
    try {
      reviewerCall = await callProvider({
        provider: secondProvider,
        apiKey: reviewerApiKey,
        model: models[secondProvider],
        system: buildReviewerSystemPrompt(),
        user: buildReviewerUserPrompt({
          question,
          verified: primarySuccess.verified,
          pack,
          sectionNumbers,
        }),
        maxTokens: REVIEWER_MAX_TOKENS,
        timeoutMs,
        fetchImpl: options.fetchImpl,
      })
    } catch {
      reviewerCall = {
        provider: secondProvider,
        requestedModel: models[secondProvider],
        modelId: '',
        text: '',
        latencyMs: 0,
        tokensIn: null,
        tokensOut: null,
        status: 'error',
        errorCode: 'REVIEWER_ERROR',
      }
    }

    if (reviewerCall.status !== 'ok') {
      participants.push({
        provider: secondProvider,
        modelId: reviewerCall.modelId,
        status: 'error',
        errorCode: reviewerCall.errorCode,
        latencyMs: reviewerCall.latencyMs,
        offendingNumbers: [],
      })
      drafts.push(
        buildDraftRow(input.userId, questionHash, reviewerCall, 'error', reviewerCall.errorCode),
      )
    } else {
      const outcome = parseReviewerOutcome(reviewerCall.text)
      if (outcome.status === 'ok') {
        participants.push({
          provider: secondProvider,
          modelId: reviewerCall.modelId,
          status: 'ok',
          errorCode: null,
          latencyMs: reviewerCall.latencyMs,
          offendingNumbers: [],
        })
        agreed.push({ provider: secondProvider, modelId: reviewerCall.modelId })
        drafts.push(buildDraftRow(input.userId, questionHash, reviewerCall, 'ok', null))
      } else if (outcome.status === 'flag') {
        participants.push({
          provider: secondProvider,
          modelId: reviewerCall.modelId,
          status: 'guard_rejected',
          errorCode: 'REVIEWER_FLAGGED',
          latencyMs: reviewerCall.latencyMs,
          offendingNumbers: [],
        })
        drafts.push(
          buildDraftRow(
            input.userId,
            questionHash,
            reviewerCall,
            'guard_rejected',
            'REVIEWER_FLAGGED',
          ),
        )
        reviewerNote = sanitizeReviewerNote(
          outcome.note,
          pack,
          sectionNumbers,
          allowQurainCentralKitchen,
        )
      } else {
        participants.push({
          provider: secondProvider,
          modelId: reviewerCall.modelId,
          status: 'error',
          errorCode: 'INVALID_REVIEW_RESPONSE',
          latencyMs: reviewerCall.latencyMs,
          offendingNumbers: [],
        })
        drafts.push(
          buildDraftRow(
            input.userId,
            questionHash,
            reviewerCall,
            'error',
            'INVALID_REVIEW_RESPONSE',
          ),
        )
      }
    }
  }

  await safePersistDrafts(persist, drafts)

  const finalReply = renderFeryalContractReply(primarySuccess.verified, pack, {
    reviewerNote,
    allowQurainCentralKitchen,
  })
  return {
    reply: finalReply,
    status: 'answered',
    participants,
    agreed,
    executedQueries: odoo.executedQueries,
    verifier: verifierFromVerifiedContract(primarySuccess.verified, odoo.verifier),
    period: odoo.period,
    questionHash,
    auditEntry: odoo.auditEntry,
  }
}
