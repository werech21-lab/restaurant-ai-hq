import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { formatKuwaitDateTime } from '@/lib/format'
import os from 'node:os'
import path from 'node:path'
import { Pool } from 'pg'
import { sslOptions } from '@/lib/db-ssl'
import { prisma } from '@/lib/db'
import type {
  OdooLiveHrSummary,
  OdooLivePurchaseSummary,
  OdooLiveWarehouseChainPayload,
  OdooPeriodCube,
  OdooPeriodCubeProductRow,
} from '@/lib/odoo-live-connector'
import type { OdooReceivableClearingSummary } from '@/lib/odoo/live-sync-core'
import {
  PER_CUSTOMER_DUE_DATE_AGING_VERIFIED,
  RECEIVABLES_PENDING_DETAIL,
  RECEIVABLES_PENDING_STATUS,
} from '@/lib/aether/receivables-status'
import { closedMonthWithheldReason, isWindowWithinClosedMonths } from '@/lib/aether/closed-month-policy'
import { appendOdooNameExclusion, isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { logger, errorFields } from '@/lib/logger'
import { numericFactsFromStructured } from '@/lib/feryal-council-facts'
import type {
  FeryalChatHistoryTurn,
  FeryalContextPack,
} from '@/lib/feryal-context-types'
import {
  buildFeryalContextPack,
  collectPackSectionNumbers,
} from '@/server/ai/feryal-context'
import {
  computeRunRateProjection,
  RUN_RATE_PROJECTION_LABEL_AR,
} from '@/server/ai/derived-numbers'
import {
  ALL_FERYAL_BRANCHES,
  EXHIBITION_FERYAL_BRANCH,
  APPROVED_FERYAL_BRAND_LIST,
  APPROVED_FERYAL_BRANDS,
  APPROVED_FERYAL_BRANCHES,
  APPROVED_FERYAL_CHANNEL_LIST,
  buildAllowedDateStrings,
  containsExcludedEntityText,
  detectMissingMetricTopics,
  detectOdooToolKind,
  detectTargetBranchFromQuestion,
  detectTargetBrandFromQuestion,
  detectTargetChannelFromQuestion,
  isBranchRankingQuestion,
  isCentralKitchenQurainQuestion,
  isSmallTalkOrMetaQuestion,
  KUWAIT_OFFSET_MS,
  normalizeArabicText,
  normalizeDigits,
  resolveFeryalComparisonPeriods,
  resolveFeryalQuestionPeriod,
  sanitizeFeryalChatHistory,
  SCHOOL_CANTEEN_FERYAL_BRANCH,
  validateFeryalContextDefaults,
  type ApprovedFeryalBranchId,
  type ApprovedFeryalBrandId,
  type ApprovedFeryalChannelId,
  type ApprovedFeryalPeriodId,
  type FeryalBrandMeta,
  type FeryalBranchMeta,
  type FeryalChannelMeta,
  type FeryalContextDefaults,
  type ResolvedFeryalComparisonPeriods,
  type ValidatedFeryalContextDefaults,
  AGGREGATOR_CHANNEL_IDS,
  getKuwaitCalendarParts,
  isLowestBranchQuestion,
  underlyingChannelIds,
} from '@/lib/feryal-intent'
import type { ComparableFact } from '@/server/ai/structured-claim'
import posRegistry from '@/lib/odoo/pos-registry.json'

/** FAS Fahaheel school-canteen register, read from the pos.config registry (owner-confirmed 43). */
const FAS_FAHAHEEL_POS_CONFIG_ID: number | null = (() => {
  const id = 43
  const reg = posRegistry as { schoolCanteenPosConfigIds?: number[]; registers?: Record<string, { location?: string }> }
  return reg.schoolCanteenPosConfigIds?.includes(id) && reg.registers?.[String(id)]?.location === 'school-canteens'
    ? id
    : null
})()

export {
  ALL_FERYAL_BRANCHES,
  APPROVED_FERYAL_BRAND_LIST,
  APPROVED_FERYAL_BRANDS,
  APPROVED_FERYAL_BRANCHES,
  APPROVED_FERYAL_CHANNEL_LIST,
  detectOdooToolKind,
  detectTargetBranchFromQuestion,
  detectTargetBrandFromQuestion,
  detectTargetChannelFromQuestion,
  isBranchRankingQuestion,
  resolveFeryalComparisonPeriods,
  resolveFeryalQuestionPeriod,
  SCHOOL_CANTEEN_FERYAL_BRANCH,
  validateFeryalContextDefaults,
  type ApprovedFeryalBranchId,
  type ApprovedFeryalBrandId,
  type ApprovedFeryalChannelId,
  type ApprovedFeryalPeriodId,
  type FeryalBrandMeta,
  type FeryalBranchMeta,
  type FeryalChannelMeta,
  type FeryalContextDefaults,
  type ResolvedFeryalComparisonPeriods,
  type ValidatedFeryalContextDefaults,
}

/**
 * Data-Only Feryal Odoo 17 Server Engine (`src/lib/feryal-odoo-agent.ts`)
 *
 * Strict guarantees:
 * 1. Queries ONLY live Odoo 17 data across the 6 approved Venture Foods brands and 7 mapped branches
 *    (`360-mall`, `salmiya`, `al-kout`, `ardiya`, `promenade`, `avenues`, `assima`) + `غير منسوب لفرع`.
 * 2. Competitor questions ALWAYS return the sole literal string `لا أعرف`.
 * 3. Missing, unlinked, or disconnected Odoo queries ALWAYS return `لا أملك بيانات من Odoo عن هذا`.
 * 4. Every data-backed reply uses the mandatory 4-part structure (`• الرقم:`, `• السبب من البيانات:`,
 *    `• الإجراء المحدد:`, `• الأثر المتوقع (تقدير):`) and passes `verifyFeryalReplyNumbers` with zero
 *    unverified numbers permitted.
 * 5. Every turn is recorded in a server-side Audit Log (`vf_feryal_chat_audit_log` + tmp/memory cache).
 */

export const FERYAL_COMPETITOR_REFUSAL = 'لا أعرف' as const
export const FERYAL_NO_ODOO_DATA_REPLY = 'لا أملك بيانات من Odoo عن هذا' as const
export const FERYAL_INCOMPLETE_GL_WARNING = 'قيود غير مكتملة لهذه الفترة' as const
export const UNATTRIBUTED_BRANCH_LABEL_AR = 'غير منسوب لفرع' as const

export type FeryalOdooModelName =
  | 'pos.order'
  | 'pos.order.line'
  | 'account.move.line'
  | 'purchase.order'
  | 'purchase.order.line'
  | 'stock.move'
  | 'stock.scrap'
  | 'hr.employee'

export interface FeryalExecutedOdooQuery {
  model: FeryalOdooModelName
  method: string
  domain: unknown[]
  groupby: string[]
  period: { from: string; to: string }
}

export interface FeryalNumericVerificationResult {
  valid: boolean
  extractedNumbers: number[]
  unverifiedNumbers: number[]
  reason?: string
}

export interface FeryalVerifierOptions {
  /** Explicit ISO or DD/MM dates from the queried period that may appear as date labels in the reply. */
  allowedDateStrings?: readonly string[]
  /** Exact verbatim entity names returned by Odoo tools in the same turn (e.g. `'مول 360'`, product names). */
  allowedEntityNames?: readonly string[]
}

export type FeryalReplyStatus =
  | 'answered'
  | 'competitor_refusal'
  | 'no_odoo_data'
  | 'verifier_rejected'

export interface FeryalAuditLogEntry {
  id: string
  timestampIso: string
  userSub: string
  userRole: string
  userNameAr?: string
  question: string
  status: FeryalReplyStatus
  executedQueries: FeryalExecutedOdooQuery[]
  verifier: FeryalNumericVerificationResult
  llmCandidateRejected?: boolean
  finalReply: string
}

export interface FeryalOdooDataSource {
  fetchPeriodCube: (
    fromIso: string,
    toIso: string,
    referenceNowMs?: number,
  ) => Promise<OdooPeriodCube | null>
  fetchPurchaseOrders: (
    fromIso: string,
    toIso: string,
    referenceNowMs?: number,
  ) => Promise<OdooLivePurchaseSummary | null>
  fetchWarehouseChain: (
    fromIso: string,
    toIso: string,
    referenceNowMs?: number,
  ) => Promise<OdooLiveWarehouseChainPayload | null>
  fetchReceivablesSummary: () => Promise<OdooReceivableClearingSummary | null>
  /** Last successful Odoo sync (ISO). Optional so fixtures without it still work. */
  getLastSyncAt?: () => Promise<string | null>
  fetchBranchTopProducts: (
    fromIso: string,
    toIso: string,
    branchId: ApprovedFeryalBranchId,
    limit: number,
  ) => Promise<OdooPeriodCubeProductRow[] | null>
  fetchHrEmployees?: (referenceNowMs?: number) => Promise<OdooLiveHrSummary | null>
}

export interface AskFeryalOdooAgentInput {
  question: string
  userSub?: string
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
  dataSource?: Partial<FeryalOdooDataSource>
  /** Optional candidate LLM phrasing function; output is strictly checked by `verifyFeryalReplyNumbers`. */
  candidatePhraser?: (context: {
    question: string
    toolModel: FeryalOdooModelName
    period: { from: string; to: string }
    structuredFactsJson: string
    deterministicDraft: string
  }) => Promise<string | null>
  skipAuditLog?: boolean
}

export interface AskFeryalOdooAgentResult {
  reply: string
  status: FeryalReplyStatus
  executedQueries: FeryalExecutedOdooQuery[]
  verifier: FeryalNumericVerificationResult
  toolNumbers: number[]
  period: { from: string; to: string } | null
  /** Numeric Odoo facts from structuredFacts. Comparisons cite these ids. */
  facts: ComparableFact[]
  /** Phase 5 · Item 3: exact data source & last sync attached to every answered reply. */
  source: FeryalAnswerSource | null
  contextPack?: FeryalContextPack
  missingMetrics?: string[]
  auditEntry: FeryalAuditLogEntry
}

export interface FeryalAnswerSource {
  system: 'Odoo 17'
  model: FeryalOdooModelName | string
  period: { from: string; to: string } | null
  lastSyncAt: string | null
}

/** Footer appended after numeric verification (dates/times are provenance, not claims). */
export function formatFeryalSourceFooter(src: FeryalAnswerSource): string {
  const window = src.period ? `${src.period.from} → ${src.period.to}` : 'غير متاح'
  const sync = src.lastSyncAt ? formatKuwaitDateTime(src.lastSyncAt, 'ar') : 'غير متاح'
  return `• المصدر: ${src.system} · ${src.model} · الفترة ${window} · آخر مزامنة: ${sync}`
}

const BRANCH_META_BY_ID = new Map<ApprovedFeryalBranchId, FeryalBranchMeta>(
  ALL_FERYAL_BRANCHES.map((b) => [b.id, b]),
)

function configIdsForBranch(branchId: string): number[] {
  return Object.entries(posRegistry.registers)
    .filter(([, meta]) => meta.location === branchId)
    .map(([id]) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0)
}

function withCentralExclusion(domain: unknown[], nameField: string, branchId?: string | null, lineModel = false): unknown[] {
  appendOdooNameExclusion(domain, nameField)
  if (lineModel) domain.push(['product_id.pos_categ_id', '!=', 150])
  if (branchId) {
    const ids = configIdsForBranch(branchId)
    if (ids.length > 0) domain.push([lineModel ? 'order_id.config_id' : 'config_id', 'in', ids])
  }
  return domain
}

export function round1(val: number): number {
  if (!Number.isFinite(val)) return 0
  return Math.round(val * 10) / 10
}

export function formatKwd1(val: number): string {
  const r = round1(val)
  return r.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

export function formatIntCount(val: number): string {
  return Math.round(Number.isFinite(val) ? val : 0).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesToolValue(candidate: number, toolNumbers: readonly number[]): boolean {
  if (!Number.isFinite(candidate)) return false
  for (const raw of toolNumbers) {
    if (!Number.isFinite(raw)) continue
    if (Math.abs(candidate - raw) < 1e-6) return true
    const r1 = Math.round(raw * 10) / 10
    if (Math.abs(candidate - r1) < 1e-6) return true
    const r2 = Math.round(raw * 100) / 100
    if (Math.abs(candidate - r2) < 1e-6) return true
    const r3 = Math.round(raw * 1000) / 1000
    if (Math.abs(candidate - r3) < 1e-6) return true
  }
  return false
}

/**
 * Mandatory Post-Generation Numeric Verifier (`verifyFeryalReplyNumbers`).
 *
 * Inspects EVERY number appearing in `replyText` and compares it strictly against `toolNumbers`
 * returned by Odoo tools in the same conversation turn (allowing only explicit queried period dates
 * and verbatim Odoo entity names returned by the tool).
 *
 * Any single unverified number causes immediate rejection (`valid: false`).
 */
export function verifyFeryalReplyNumbers(
  replyText: string,
  toolNumbers: readonly number[],
  options?: FeryalVerifierOptions,
): FeryalNumericVerificationResult {
  const normalized = normalizeDigits(replyText ?? '')
  let working = normalized

  // 1. Mask exact verbatim entity names returned by the Odoo tool (sorted longest-first)
  if (options?.allowedEntityNames && options.allowedEntityNames.length > 0) {
    const sortedEntities = [...options.allowedEntityNames]
      .map((s) => normalizeDigits(s).trim())
      .filter((s) => s.length >= 3)
      .sort((a, b) => b.length - a.length)

    for (const entity of sortedEntities) {
      const re = new RegExp(escapeRegExp(entity), 'gi')
      working = working.replace(re, ' ')
    }
  }

  // 2. Mask explicit date labels belonging to the queried period (bounded by non-digits)
  if (options?.allowedDateStrings && options.allowedDateStrings.length > 0) {
    const sortedDates = [...options.allowedDateStrings]
      .map((d) => normalizeDigits(d).trim())
      .filter((d) => d.length >= 4)
      .sort((a, b) => b.length - a.length)

    for (const dt of sortedDates) {
      const re = new RegExp(`(^|[^\\d])${escapeRegExp(dt)}(?=[^\\d]|$)`, 'g')
      working = working.replace(re, '$1 ')
    }
  }

  // 3. Extract every remaining number in the reply
  const numberTokenRegex =
    /(?:(?<=^|[\s:(«"'،,])[-−])?\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?:(?<=^|[\s:(«"'،,])[-−])?\d+(?:\.\d+)?/g

  const extractedNumbers: number[] = []
  const unverifiedNumbers: number[] = []

  const matches = working.matchAll(numberTokenRegex)
  for (const match of matches) {
    const rawToken = match[0].replace(/−/g, '-').replace(/,/g, '')
    const parsed = Number(rawToken)
    if (!Number.isFinite(parsed)) continue
    extractedNumbers.push(parsed)
    if (!matchesToolValue(parsed, toolNumbers)) {
      unverifiedNumbers.push(parsed)
    }
  }

  if (unverifiedNumbers.length > 0) {
    return {
      valid: false,
      extractedNumbers,
      unverifiedNumbers,
      reason: `UNVERIFIED_NUMBERS_DETECTED: ${unverifiedNumbers.join(', ')}`,
    }
  }

  return {
    valid: true,
    extractedNumbers,
    unverifiedNumbers: [],
  }
}

export function enforceVerifiedFeryalReply(
  candidateReply: string,
  toolNumbers: readonly number[],
  options?: FeryalVerifierOptions & {
    requireFourPartStructure?: boolean
    requireGlIncompleteWarning?: boolean
  },
): { accepted: boolean; reply: string; verifier: FeryalNumericVerificationResult } {
  const trimmed = (candidateReply ?? '').trim()
  const verifier = verifyFeryalReplyNumbers(trimmed, toolNumbers, options)
  if (!verifier.valid) {
    return { accepted: false, reply: FERYAL_NO_ODOO_DATA_REPLY, verifier }
  }

  if (options?.requireFourPartStructure) {
    const hasPart1 = trimmed.includes('الرقم')
    const hasPart2 = trimmed.includes('السبب من البيانات')
    const hasPart3 = trimmed.includes('الإجراء المحدد')
    const hasEstimateTag = trimmed.includes('تقدير')
    if (!hasPart1 || !hasPart2 || !hasPart3 || !hasEstimateTag) {
      return {
        accepted: false,
        reply: FERYAL_NO_ODOO_DATA_REPLY,
        verifier: {
          ...verifier,
          valid: false,
          reason: 'MISSING_MANDATORY_FOUR_PART_STRUCTURE_OR_ESTIMATE_TAG',
        },
      }
    }
  }

  if (
    options?.requireGlIncompleteWarning &&
    !trimmed.includes(FERYAL_INCOMPLETE_GL_WARNING)
  ) {
    return {
      accepted: false,
      reply: FERYAL_NO_ODOO_DATA_REPLY,
      verifier: {
        ...verifier,
        valid: false,
        reason: 'MISSING_MANDATORY_GL_INCOMPLETE_WARNING',
      },
    }
  }

  return { accepted: true, reply: trimmed, verifier }
}

function isCompetitorQuestion(question: string): boolean {
  const normAr = normalizeArabicText(question)
  if (
    /(منافس|منافسين|المنافس|المنافسين|منافسينا|منافسه السوق|شركه منافسه|شركات منافسه|مطعم منافس|مطاعم منافسه|\bcompetitor\b|\bcompetitors\b|\brival\b|\brivals\b)/i.test(
      normAr,
    )
  ) {
    return true
  }
  return false
}

const FORECAST_OR_TARGET_RE =
  /(توقعات|توقع|المستهدف|مستهدف المبيعات|تنبؤ|نهايه الشهر|خلال الشهر الكامل|run[- ]?rate|\bforecast\b|\bprojection\b|\bsales target\b)/i

const BOOTH_FEASIBILITY_RE = /(جدوي البوث|جدوي المعرض|دراسه جدوي|\bbooth feasibility\b)/i

const PLANS_BUDGETS_RE =
  /(خطه النمو|خطط النمو|خطط غير مسجله|المستهدف|مستهدف المبيعات|الموازنه التقديريه|توقعات الشهر القادم|توقعات الشهر|تنبؤ الطلب|جدوي البوث|دراسه جدوي|\bsales target\b|\bbudget plan\b|\bforecast\b)/i

const OVERTIME_RE =
  /(اوفر\s*تايم|ساعات\s+اضافيه|العمل\s+الاضافي|ساعات اضافيه|\bovertime\b)/i

const WHY_OR_DROP_INQUIRY_RE =
  /(?:^|\s)(?:ليش|لماذا|ليه|شو سبب|ما سبب|وش سبب|سبب التراجع|سبب الانخفاض|سبب النزول|عم تنزل|بتنزل|نازله|تراجع|هبوط|\bwhy\b|\bdrop(?:ping)?\b|\bdeclin(?:e|ing)\b)/i

function isWhyOrDropInquiry(question: string): boolean {
  const normAr = normalizeArabicText(question)
  if (!normAr) return false
  if (isBranchRankingQuestion(question)) return false
  if (resolveFeryalComparisonPeriods(question) !== null) return false
  return WHY_OR_DROP_INQUIRY_RE.test(normAr)
}

interface QuestionMissingAnalysis {
  missingMetrics: string[]
  isForecast: boolean
  isOvertime: boolean
  isBoothFeasibility: boolean
  fallbackReasonKey: NoOdooDataReasonKey
}

function collectQuestionMissingMetrics(question: string): QuestionMissingAnalysis {
  const normAr = normalizeArabicText(question)
  const detected = [...detectMissingMetricTopics(question)]
  const seen = new Set(detected.map((m) => normalizeArabicText(m)))

  const pushUnique = (label: string) => {
    const norm = normalizeArabicText(label)
    if (!seen.has(norm)) {
      seen.add(norm)
      detected.push(label)
    }
  }

  const isForecast = FORECAST_OR_TARGET_RE.test(normAr)
  const isBoothFeasibility = BOOTH_FEASIBILITY_RE.test(normAr)
  const isOvertime = OVERTIME_RE.test(normAr)

  if (isForecast || PLANS_BUDGETS_RE.test(normAr)) {
    pushUnique(
      isBoothFeasibility
        ? 'دراسة الجدوى التفصيلية وتكاليف الإيجار والموازنة التقديرية (crossovered.budget) غير متاحة في Odoo'
        : 'الموازنات التقديرية ومستهدفات المبيعات الرسمية (crossovered.budget) غير متاحة في Odoo',
    )
  }

  if (isOvertime) {
    const hasHrUnlinked = detected.some((m) =>
      /(الرواتب|بصمه الحضور|hr\.payslip|hr\.attendance)/i.test(normalizeArabicText(m)),
    )
    if (!hasHrUnlinked) {
      pushUnique(
        'سجلات البصمة وساعات العمل الإضافي ومسيرات الرواتب (hr.attendance / hr.payslip) غير متاحة في Odoo',
      )
    }
  }

  let fallbackReasonKey: NoOdooDataReasonKey = 'generic'
  if (/(kds|تحضير|شاشه المطبخ)/i.test(normAr)) fallbackReasonKey = 'kds'
  else if (/(سائق|gps|drivers|riders)/i.test(normAr)) fallbackReasonKey = 'drivers'
  else if (/(تقييمات|مراجعات|اعلان|مشاهير|roas)/i.test(normAr)) fallbackReasonKey = 'reviews_marketing'
  else if (/(تبريد|ثلاجات|بلديه|تراخيص|iot)/i.test(normAr)) fallbackReasonKey = 'iot_compliance'
  else if (isForecast || PLANS_BUDGETS_RE.test(normAr)) fallbackReasonKey = 'plans_budgets'
  else if (/(وصفه|وصفات|bom|recipe)/i.test(normAr)) fallbackReasonKey = 'recipes_bom'
  else if (isOvertime || /(رواتب|بصمه|payslip|biometric)/i.test(normAr)) fallbackReasonKey = 'hr_unlinked'

  return {
    missingMetrics: detected,
    isForecast,
    isOvertime,
    isBoothFeasibility,
    fallbackReasonKey,
  }
}

type NoOdooDataReasonKey =
  | 'kds'
  | 'drivers'
  | 'reviews_marketing'
  | 'iot_compliance'
  | 'plans_budgets'
  | 'recipes_bom'
  | 'hr_unlinked'
  | 'hr_employees_no_access'
  | 'hr_employees_no_data'
  | 'vendor_no_data'
  | 'unknown_branch'
  | 'pos_no_data'
  | 'gl_no_data'
  | 'stock_no_data'
  /** Phase 5 · Item 3: stock on hand (`stock.quant`) is not linked for executives. */
  | 'inventory_on_hand'
  /** Phase 5 · Item 3: GL lines are not analytically split per branch in the live feed. */
  | 'gl_branch_not_partitioned'
  /** «الفحاحيل» = school-canteen register FAS Fahaheel (pos.config 43), never Al-Kout. */
  | 'fas_fahaheel_canteen'
  | 'generic'

/**
 * Builds a strict zero-digit refusal starting with `لا أملك بيانات من Odoo عن هذا`
 * plus a clear Arabic sentence suggesting the exact Odoo integration required.
 */
export function buildFeryalNoOdooDataSuggestion(reasonKey: NoOdooDataReasonKey): string {
  switch (reasonKey) {
    case 'kds':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — يلزم تفعيل وربط موديول شاشة تحضير المطبخ pos_preparation_display في Odoo لتسجيل طوابع بدء وانتهاء تحضير الطلبات.`
    case 'drivers':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — يلزم ربط موديول الأسطول fleet أو واجهة تتبع مندوبي التوصيل مع طلبات نقاط البيع في Odoo لقراءة أزمنة التوصيل ومسارات السائقين.`
    case 'reviews_marketing':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — يلزم ربط واجهات تقييمات المنصات وحملات التسويق بموديول التسويق الاجتماعي social ومراكز التكلفة التحليلية في Odoo.`
    case 'iot_compliance':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — يلزم ربط حساسات التبريد وموديول الجودة والصيانة quality وmaintenance في Odoo لتسجيل قراءات الحرارة وتراخيص الفروع.`
    case 'plans_budgets':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — يلزم إدخال وربط الموازنات التقديرية ومستهدفات الفروع عبر موديول الموازنة المحاسبية crossovered.budget والحسابات التحليلية في Odoo.`
    case 'recipes_bom':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — يلزم ربط قوائم المواد والوصفات المعيارية عبر موديول التصنيع mrp.bom بأصناف نقاط البيع في Odoo.`
    case 'hr_unlinked':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — يلزم ربط موديولات الرواتب والحضور hr.payslip وhr.attendance وحقول الوثائق الرسمية للموظفين في Odoo.`
    case 'hr_employees_no_access':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — يلزم منح صلاحية قراءة موديول الموظفين hr.employee لحساب الربط وتفعيل سجلات الموظفين على مستوى الشركة في Odoo.`
    case 'hr_employees_no_data':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — يلزم تسجيل الموظفين النشطين وربطهم بالأقسام ومواقع العمل في موديول hr.employee داخل Odoo.`
    case 'vendor_no_data':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — يلزم تسجيل المورد في سجل الشركاء res.partner وتأكيد أوامر الشراء في purchase.order أو فواتير الموردين في account.move داخل Odoo.`
    case 'unknown_branch':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — يلزم تعريف الفرع وصناديق البيع التابعة له في pos.config وربطها بالشركة الفعالة داخل Odoo.`
    case 'pos_no_data':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — يلزم التحقق من اتصال Odoo وترحيل جلسات وطلبات نقاط البيع في pos.order وpos.order.line للفترة المطلوبة.`
    case 'gl_no_data':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — يلزم ترحيل قيود اليومية المحاسبية في account.move.line وإقفال مسودات الفواتير في Odoo للفترة المطلوبة.`
    case 'inventory_on_hand':
      return 'غير متاح — رصيد المخزون الحالي (stock.quant) غير مربوط بعد بلوحة الإدارة؛ لا تُستخدم أرقام المبيعات بدلاً منه.'
    case 'fas_fahaheel_canteen':
      return `غير متاح — «الفحاحيل» ليس فرع مطاعم؛ يقابله في Odoo مقصف مدرسة FAS Fahaheel (pos.config ${FAS_FAHAHEEL_POS_CONFIG_ID}) ضمن مقاصف المدارس، ومبيعات هذا الصندوق غير مفصولة عن بقية المقاصف في البيانات الحالية.`
    case 'gl_branch_not_partitioned':
      return 'غير متاح — مصاريف الفرع غير مقسّمة تحليلياً حسب الفرع في قيود account.move.line الحالية؛ لا تُستخدم أرقام المبيعات بدلاً منها.'
    case 'stock_no_data':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — يلزم اعتماد حركات المخزن وأوامر الإتلاف في stock.move وstock.scrap داخل Odoo للفترة المطلوبة.`
    case 'generic':
    default:
      return `${FERYAL_NO_ODOO_DATA_REPLY} — يلزم ربط المصدر التشغيلي المختص بموديولات Odoo المعتمدة وتحديد المؤشر أو الفترة المطلوبة.`
  }
}

function extractRequestedTopLimit(question: string): number {
  const norm = normalizeArabicText(question)
  const m = norm.match(/(?:اعلي|افضل|اول|اكثر|top)\s+(\d{1,2})/i)
  if (m) {
    const n = Number(m[1])
    if (Number.isFinite(n) && n >= 1 && n <= 25) return n
  }
  return 5
}

function extractVendorQueryTarget(question: string): {
  mode: 'all_vendors' | 'specific_vendor' | 'placeholder_vendor'
  vendorQuery: string
} {
  const norm = normalizeArabicText(question)

  // Literal placeholder like "تكلفة مورد معين" / "مورد محدد"
  if (/(مورد معين|مورد محدد|مورد ما|احد الموردين)/.test(norm)) {
    return { mode: 'placeholder_vendor', vendorQuery: 'معين' }
  }

  // Plural general query ("الموردين" / "أوامر الشراء" / "إجمالي المشتريات")
  if (/(الموردين|موردين|جميع الموردين|كل الموردين|اوامر الشراء|اجمالي المشتريات|\bsuppliers\b|\bvendors\b)/i.test(norm)) {
    return { mode: 'all_vendors', vendorQuery: '' }
  }

  // Singular vendor extraction after "مورد" or "المورد" or "supplier" or "vendor"
  const arMatch = norm.match(/(?:تكلفه|مشتريات|اوامر شراء|حساب|فاتوره)?\s*(?:المورد|مورد)\s+(.+)$/)
  if (arMatch) {
    const cleaned = arMatch[1]
      .replace(
        /(اليوم|امس|الامس|هذا الشهر|الشهر الحالي|للشهر الحالي|للشهر|الشهر الماضي|هذا الاسبوع|الاسبوع الماضي|اخر 30 يوم|اخر 30 يوما|هذه السنه|خلال.*|في الفتره.*|(?:في|لشهر|شهر)\s+(?:يناير|فبراير|مارس|ابريل|مايو|يونيو|يوليو|اغسطس|سبتمبر|اكتوبر|نوفمبر|ديسمبر)(?:\s+20\d{2})?|يوم\s+\d{1,2}\/\d{1,2}(?:\/\d{4})?|\b20\d{2}-\d{2}-\d{2}\b|[«»"'()\[\]؟?.,!])/g,
        '',
      )
      .trim()
    if (!cleaned || cleaned === 'معين' || cleaned === 'محدد') {
      return { mode: 'placeholder_vendor', vendorQuery: cleaned || 'معين' }
    }
    return { mode: 'specific_vendor', vendorQuery: cleaned }
  }

  const enMatch = norm.match(/(?:supplier|vendor)\s+([a-z0-9\s\-&]+)/i)
  if (enMatch) {
    const cleaned = enMatch[1]
      .replace(/\b(today|yesterday|this month|last month|this year)\b/gi, '')
      .trim()
    if (cleaned) {
      return { mode: 'specific_vendor', vendorQuery: cleaned }
    }
  }

  return { mode: 'all_vendors', vendorQuery: '' }
}

type OdooLiveConnectorModule = typeof import('@/lib/odoo-live-connector')

let cachedOdooConnectorPromise: Promise<OdooLiveConnectorModule | null> | null = null

async function loadOdooConnector(): Promise<OdooLiveConnectorModule | null> {
  if (!cachedOdooConnectorPromise) {
    cachedOdooConnectorPromise = import('@/lib/odoo-live-connector').catch((error) => {
      logger.warn('feryal odoo data source failed', {
        section: 'connectorImport',
        ...errorFields(error),
      })
      return null
    })
  }
  return cachedOdooConnectorPromise
}

const DEFAULT_ODOO_DATA_SOURCE: FeryalOdooDataSource = {
  fetchPeriodCube: async (fromIso, toIso, referenceNowMs) => {
    try {
      const mod = await loadOdooConnector()
      if (!mod) return null
      return await mod.fetchLiveOdooPeriodCube(fromIso, toIso, referenceNowMs)
    } catch (error) {
      logger.warn('feryal odoo data source failed', {
        section: 'periodCube',
        ...errorFields(error),
      })
      return null
    }
  },
  fetchPurchaseOrders: async (fromIso, toIso, referenceNowMs) => {
    try {
      const mod = await loadOdooConnector()
      if (!mod) return null
      return await mod.fetchLiveOdooPurchaseOrders(fromIso, toIso, { referenceNowMs })
    } catch (error) {
      logger.warn('feryal odoo data source failed', {
        section: 'purchaseOrders',
        ...errorFields(error),
      })
      return null
    }
  },
  fetchWarehouseChain: async (fromIso, toIso, referenceNowMs) => {
    try {
      const mod = await loadOdooConnector()
      if (!mod) return null
      return await mod.fetchLiveOdooWarehouseChain(fromIso, toIso, referenceNowMs)
    } catch (error) {
      logger.warn('feryal odoo data source failed', {
        section: 'warehouseChain',
        ...errorFields(error),
      })
      return null
    }
  },
  fetchReceivablesSummary: async () => {
    try {
      const mod = await loadOdooConnector()
      if (!mod) return null
      const snap = await mod.fetchLiveOdooSnapshot({ period: 'month' })
      if (!snap.connected || snap.source === 'disconnected') return null
      return snap.aggregatorReceivables ?? null
    } catch (error) {
      logger.warn('feryal odoo data source failed', {
        section: 'receivablesSummary',
        ...errorFields(error),
      })
      return null
    }
  },
  getLastSyncAt: async () => {
    try {
      const mod = await loadOdooConnector()
      if (!mod) return null
      const snap = await mod.fetchLiveOdooSnapshot({ period: 'month' })
      if (!snap.connected || snap.source === 'disconnected') return null
      return snap.lastSyncAt ?? snap.syncedAt ?? null
    } catch (error) {
      logger.warn('feryal odoo data source failed', {
        section: 'lastSyncAt',
        ...errorFields(error),
      })
      return null
    }
  },
  fetchBranchTopProducts: async (fromIso, toIso, branchId, limit) => {
    try {
      const mod = await loadOdooConnector()
      if (!mod) return null
      const registersMap = posRegistry.registers as Record<string, { location?: string }>
      const branchConfigIds = Object.entries(registersMap)
        .filter(([, meta]) => meta?.location === branchId)
        .map(([idStr]) => Number(idStr))
        .filter((n) => Number.isFinite(n) && n > 0)

      if (branchConfigIds.length === 0) return null

      const [fy, fm, fd] = fromIso.split('-').map((x) => Number(x))
      const [ty, tm, td] = toIso.split('-').map((x) => Number(x))
      const fromUtc = new Date(Date.UTC(fy, fm - 1, fd, 0, 0, 0) - KUWAIT_OFFSET_MS)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ')
      const toExclusiveUtc = new Date(Date.UTC(ty, tm - 1, td + 1, 0, 0, 0) - KUWAIT_OFFSET_MS)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ')

      type RawPosLineGroup = {
        product_id?: [number, string] | false
        price_subtotal?: number
        qty?: number
        discount?: number
        __count?: number
      }

      const rows = await mod.executeOdooKw<RawPosLineGroup[]>(
        'pos.order.line',
        'read_group',
        [
          [
            ['order_id.date_order', '>=', fromUtc],
            ['order_id.date_order', '<', toExclusiveUtc],
            ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
            ['order_id.config_id', 'in', branchConfigIds],
          ],
          ['price_subtotal:sum', 'qty:sum', 'discount:avg'],
          ['product_id'],
        ],
        { lazy: false },
      )

      if (!Array.isArray(rows) || rows.length === 0) return []

      const mapped: OdooPeriodCubeProductRow[] = rows
        .filter((r) => Array.isArray(r.product_id) && typeof r.product_id[0] === 'number')
        .map((r) => {
          const tuple = r.product_id as [number, string]
          const net = Math.max(0, Number(r.price_subtotal) || 0)
          const qty = Math.max(0, Number(r.qty) || 0)
          const disc = Math.max(0, Number(r.discount) || 0)
          return {
            productId: tuple[0],
            name: String(tuple[1] || '').trim(),
            brandId: 'china-garden' as const,
            netKwd: Math.round(net * 1000) / 1000,
            qty: Math.round(qty * 1000) / 1000,
            linesCount: Math.max(0, Math.round(Number(r.__count) || 0)),
            avgDiscountPct: Math.round(disc * 100) / 100,
            discountKwd: 0,
          }
        })
        .sort((a, b) => b.netKwd - a.netKwd)
        .slice(0, limit)

      return mapped
    } catch (error) {
      logger.warn('feryal odoo data source failed', {
        section: 'branchTopProducts',
        ...errorFields(error),
      })
      return null
    }
  },
  fetchHrEmployees: async (referenceNowMs) => {
    try {
      const mod = await loadOdooConnector()
      if (!mod) return null
      return await mod.fetchLiveOdooHrSummary(referenceNowMs)
    } catch (error) {
      logger.warn('feryal odoo data source failed', {
        section: 'hrEmployees',
        ...errorFields(error),
      })
      return null
    }
  },
}

interface ToolExecutionOutput {
  hasData: boolean
  noDataReasonKey?: NoOdooDataReasonKey
  primaryModel: FeryalOdooModelName
  executedQueries: FeryalExecutedOdooQuery[]
  toolNumbers: number[]
  allowedEntityNames: string[]
  deterministicReply: string
  structuredFacts: Record<string, unknown>
  requireGlIncompleteWarning?: boolean
  skipFourPartStructure?: boolean
  skipSourceFooter?: boolean
  missingMetrics?: string[]
}

async function runPosOrdersTool(params: {
  dataSource: FeryalOdooDataSource
  period: { from: string; to: string; periodLabelAr: string }
  targetBranchId: ApprovedFeryalBranchId | null
  targetChannelId?: ApprovedFeryalChannelId | null
  isBranchRanking?: boolean
  /** 'lowest' for weakest/lowest/worst-branch questions (headline the lowest restaurant branch). */
  rankDirection?: 'top' | 'lowest'
  referenceNowMs?: number
}): Promise<ToolExecutionOutput> {
  const {
    dataSource,
    period,
    targetBranchId,
    targetChannelId = null,
    isBranchRanking = false,
    rankDirection = 'top',
    referenceNowMs,
  } = params
  // Aggregator channels count payouts/batches (دفعات), never orders (Phase 5 · Item 5).
  const countNoun = targetChannelId && AGGREGATOR_CHANNEL_IDS.has(targetChannelId) ? 'دفعات' : 'طلبات'
  const avgNoun = countNoun === 'دفعات' ? 'بمتوسط دفعة' : 'بمتوسط سلة'
  const cellOf = (
    channels: Partial<Record<string, { netKwd: number; orders: number }>> | undefined,
  ): { netKwd: number; orders: number } => {
    if (!targetChannelId) return { netKwd: 0, orders: 0 }
    return underlyingChannelIds(targetChannelId).reduce(
      (acc, id) => ({
        netKwd: acc.netKwd + (channels?.[id]?.netKwd ?? 0),
        orders: acc.orders + (channels?.[id]?.orders ?? 0),
      }),
      { netKwd: 0, orders: 0 },
    )
  }
  const cube = await dataSource.fetchPeriodCube(period.from, period.to, referenceNowMs)

  const domain: unknown[] = [
    ['date_order', '>=', `${period.from} 00:00:00`],
    ['date_order', '<=', `${period.to} 23:59:59`],
    ['state', 'in', ['paid', 'done', 'invoiced']],
  ]
  if (cube?.odooCompanyId) {
    domain.push(['company_id', '=', cube.odooCompanyId])
  }
  withCentralExclusion(domain, 'session_id.config_id.name', targetBranchId)

  const executedQueries: FeryalExecutedOdooQuery[] = [
    {
      model: 'pos.order',
      method: 'read_group',
      domain,
      groupby: targetBranchId ? ['session_id'] : ['date_order:day', 'session_id'],
      period: { from: period.from, to: period.to },
    },
  ]

  if (!cube || !cube.connected || cube.noData) {
    return {
      hasData: false,
      noDataReasonKey: 'pos_no_data',
      primaryModel: 'pos.order',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('pos_no_data'),
      structuredFacts: {},
    }
  }

  const channelMeta = targetChannelId
    ? APPROVED_FERYAL_CHANNEL_LIST.find((c) => c.id === targetChannelId) ?? null
    : null
  const channelClause = channelMeta ? ` (قناة ${channelMeta.nameAr})` : ''

  // Company groups (school canteens, exhibition booths) appear when asked for or when they have sales.
  const groupMetas = [SCHOOL_CANTEEN_FERYAL_BRANCH, EXHIBITION_FERYAL_BRANCH].filter((meta) => {
    const entry = cube.byBranch[meta.id as 'school-canteens' | 'exhibitions']
    const raw = targetChannelId ? cellOf(entry?.channels) : entry
    return targetBranchId === meta.id || (raw?.netKwd ?? 0) !== 0 || (raw?.orders ?? 0) > 0
  })
  const activeBranchMetas: readonly FeryalBranchMeta[] = [...APPROVED_FERYAL_BRANCHES, ...groupMetas]

  const branchRows = activeBranchMetas.map((meta) => {
    const branchEntry = cube.byBranch[meta.id]
    const raw = targetChannelId
      ? cellOf(branchEntry?.channels)
      : branchEntry ?? { netKwd: 0, orders: 0, aovKwd: 0 }
    const net1 = round1(raw.netKwd)
    const ordersInt = Math.round(raw.orders)
    const aov1 = ordersInt > 0 ? round1(raw.netKwd / ordersInt) : 0
    return {
      id: meta.id,
      nameAr: meta.nameAr,
      rawNetKwd: raw.netKwd,
      netKwd: net1,
      orders: ordersInt,
      aovKwd: aov1,
    }
  }).sort((a, b) => b.netKwd - a.netKwd || b.rawNetKwd - a.rawNetKwd)

  const rawCompanyNet = targetChannelId ? cellOf(cube.byChannel).netKwd : cube.totals.netSalesKwd
  const rawCompanyOrders = targetChannelId ? cellOf(cube.byChannel).orders : cube.totals.orders
  const rawUnattrEntry = targetChannelId ? cellOf(cube.unattributed.channels) : cube.unattributed

  const totalNet1 = round1(rawCompanyNet)
  const totalOrdersInt = Math.round(rawCompanyOrders)
  const totalAov1 = totalOrdersInt > 0 ? round1(rawCompanyNet / totalOrdersInt) : 0
  const mappedRoundedSum1 = round1(branchRows.reduce((acc, r) => acc + r.netKwd, 0))
  const rawUnattributed1 = round1(rawUnattrEntry.netKwd)
  const residualUnattributed1 = round1(Math.max(0, totalNet1 - mappedRoundedSum1))
  const unattributedNet1 =
    rawUnattrEntry.netKwd > 0 && Math.abs(residualUnattributed1 - rawUnattrEntry.netKwd) <= 0.15
      ? residualUnattributed1
      : rawUnattributed1
  const unattributedOrdersInt = Math.round(rawUnattrEntry.orders)

  if (targetBranchId) {
    const targetRow = branchRows.find((r) => r.id === targetBranchId)
    const allowZeroExhibitionRow =
      targetBranchId === 'exhibitions' &&
      Boolean(targetRow) &&
      (totalNet1 > 0 || totalOrdersInt > 0)
    if (!targetRow || (!allowZeroExhibitionRow && targetRow.orders <= 0 && targetRow.netKwd <= 0)) {
      return {
        hasData: false,
        noDataReasonKey: 'pos_no_data',
        primaryModel: 'pos.order',
        executedQueries,
        toolNumbers: [],
        allowedEntityNames: [],
        deterministicReply: buildFeryalNoOdooDataSuggestion('pos_no_data'),
        structuredFacts: {},
      }
    }

    const topBranch = branchRows[0]
    const toolNumbers: number[] = [
      targetRow.rawNetKwd,
      targetRow.netKwd,
      targetRow.orders,
      targetRow.aovKwd,
      rawCompanyNet,
      totalNet1,
      totalOrdersInt,
      topBranch.rawNetKwd,
      topBranch.netKwd,
      topBranch.orders,
    ]
    const allowedEntityNames: string[] = [
      targetRow.nameAr,
      topBranch.nameAr,
      ...(channelMeta ? [channelMeta.nameAr] : []),
    ]

    const causeComparison =
      topBranch.id === targetRow.id
        ? `تصدر فرع ${targetRow.nameAr} جميع الفروع بصافي ${formatKwd1(targetRow.netKwd)} د.ك من ${formatIntCount(targetRow.orders)} ${countNoun} ${avgNoun} ${formatKwd1(targetRow.aovKwd)} د.ك.`
        : `حقق فرع ${targetRow.nameAr} صافي ${formatKwd1(targetRow.netKwd)} د.ك من ${formatIntCount(targetRow.orders)} ${countNoun} ${avgNoun} ${formatKwd1(targetRow.aovKwd)} د.ك مقارنة بأعلى فرع للفترة وهو ${topBranch.nameAr} بقيمة ${formatKwd1(topBranch.netKwd)} د.ك.`

    const reply = [
      `• الرقم: وفق موديل pos.order في Odoo للفترة ${period.periodLabelAr}${channelClause}، سجل فرع ${targetRow.nameAr} صافي مبيعات ${formatKwd1(targetRow.netKwd)} د.ك و${formatIntCount(targetRow.orders)} ${countNoun} ${avgNoun} ${formatKwd1(targetRow.aovKwd)} د.ك من إجمالي الشركة البالغ ${formatKwd1(totalNet1)} د.ك.`,
      `• السبب من البيانات: ${causeComparison}`,
      `• الإجراء المحدد: يراجع مدير فرع ${targetRow.nameAr} ومشرف العمليات اليوم أداء فترات الذروة واقتراحات الإضافات في نقاط البيع خلال الوردية القادمة.`,
      `• الأثر المتوقع (تقدير): تقدير — تحسن ${countNoun === 'دفعات' ? 'متوسط الدفعة' : 'متوسط السلة'} فوق مستوى ${formatKwd1(targetRow.aovKwd)} د.ك الحالي ورفع مساهمة فرع ${targetRow.nameAr} ضمن مبيعات الشركة.`,
    ].join('\n')

    return {
      hasData: true,
      primaryModel: 'pos.order',
      executedQueries,
      toolNumbers,
      allowedEntityNames,
      deterministicReply: reply,
      structuredFacts: {
        model: 'pos.order',
        period: { from: period.from, to: period.to },
        ...(targetChannelId ? { channelId: targetChannelId } : {}),
        branch: targetRow,
        branches: branchRows,
        companyTotalNetKwd: totalNet1,
        companyTotalOrders: totalOrdersInt,
        topBranch: { nameAr: topBranch.nameAr, netKwd: topBranch.netKwd },
      },
    }
  }

  if (
    totalNet1 <= 0 &&
    totalOrdersInt <= 0 &&
    branchRows.every((r) => r.netKwd <= 0 && r.orders <= 0)
  ) {
    return {
      hasData: false,
      noDataReasonKey: 'pos_no_data',
      primaryModel: 'pos.order',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('pos_no_data'),
      structuredFacts: {},
    }
  }

  // All 7 branches + غير منسوب لفرع breakdown / ranking
  const toolNumbers: number[] = [
    rawCompanyNet,
    totalNet1,
    totalOrdersInt,
    totalAov1,
    rawUnattrEntry.netKwd,
    unattributedNet1,
    unattributedOrdersInt,
  ]
  const allowedEntityNames: string[] = [
    UNATTRIBUTED_BRANCH_LABEL_AR,
    ...(channelMeta ? [channelMeta.nameAr] : []),
  ]

  for (const r of branchRows) {
    toolNumbers.push(r.rawNetKwd, r.netKwd, r.orders, r.aovKwd)
    allowedEntityNames.push(r.nameAr)
  }

  const branchListText = branchRows
    .map((r) => `${r.nameAr} ${formatKwd1(r.netKwd)} د.ك`)
    .join('، ')

  const topBranch = branchRows[0]
  const secondBranch = branchRows[1]
  const restaurantRows = branchRows.filter((r) => r.id !== 'school-canteens' && r.id !== 'exhibitions')
  const lowestBranch = restaurantRows[restaurantRows.length - 1] ?? branchRows[branchRows.length - 1]

  const unattributedSegment =
    unattributedNet1 > 0
      ? `، منها ${formatKwd1(unattributedNet1)} د.ك غير منسوبة (${UNATTRIBUTED_BRANCH_LABEL_AR})`
      : `، وبند ${UNATTRIBUTED_BRANCH_LABEL_AR} بقيمة ${formatKwd1(unattributedNet1)} د.ك`

  const firstBullet = isBranchRanking && rankDirection === 'lowest'
    ? `• الرقم: وفق موديل pos.order في Odoo للفترة ${period.periodLabelAr}${channelClause}، أضعف فرع مطاعم هو ${lowestBranch.nameAr} بصافي ${formatKwd1(lowestBranch.netKwd)} د.ك و${formatIntCount(lowestBranch.orders)} ${countNoun}، مقابل أعلى فرع ${topBranch.nameAr} بصافي ${formatKwd1(topBranch.netKwd)} د.ك. توزيع الفروع: ${branchListText}.`
    : isBranchRanking
    ? `• الرقم: وفق موديل pos.order في Odoo للفترة ${period.periodLabelAr}${channelClause}، تصدر فرع ${topBranch.nameAr} المبيعات بصافي ${formatKwd1(topBranch.netKwd)} د.ك و${formatIntCount(topBranch.orders)} ${countNoun}، وتوزعت المبيعات حسب الفرع كالتالي: ${branchListText}، والإجمالي ${formatKwd1(totalNet1)} د.ك عبر ${formatIntCount(totalOrdersInt)} ${countNoun}${unattributedSegment}.`
    : `• الرقم: وفق موديل pos.order في Odoo للفترة ${period.periodLabelAr}${channelClause}، توزعت المبيعات حسب الفرع كالتالي: ${branchListText}، والإجمالي ${formatKwd1(totalNet1)} د.ك عبر ${formatIntCount(totalOrdersInt)} ${countNoun}${unattributedSegment}.`

  const reply = [
    firstBullet,
    `• السبب من البيانات: تصدر فرع ${topBranch.nameAr} بقيمة ${formatKwd1(topBranch.netKwd)} د.ك تلاه ${secondBranch.nameAr} بقيمة ${formatKwd1(secondBranch.netKwd)} د.ك بينما سجل فرع ${lowestBranch.nameAr} ${formatKwd1(lowestBranch.netKwd)} د.ك، مع تسجيل ${formatKwd1(unattributedNet1)} د.ك ضمن بند ${UNATTRIBUTED_BRANCH_LABEL_AR} نتيجة صناديق بيع غير مربوطة بفرع محدد.`,
    `• الإجراء المحدد: يربط مسؤول النظام اليوم صناديق البيع المفتوحة ضمن ${UNATTRIBUTED_BRANCH_LABEL_AR} بالفروع الفعلية، ويراجع مدير العمليات أداء فرع ${lowestBranch.nameAr} خلال الوردية القادمة.`,
    `• الأثر المتوقع (تقدير): تقدير — نسب مبلغ ${formatKwd1(unattributedNet1)} د.ك من بند ${UNATTRIBUTED_BRANCH_LABEL_AR} إلى الفروع الفعلية يرفع دقة تقارير الربحية ويدعم تحسين مبيعات الفروع الأقل أداءً.`,
  ].join('\n')

  return {
    hasData: true,
    primaryModel: 'pos.order',
    executedQueries,
    toolNumbers,
    allowedEntityNames,
    deterministicReply: reply,
    structuredFacts: {
      model: 'pos.order',
      period: { from: period.from, to: period.to },
      ...(targetChannelId ? { channelId: targetChannelId } : {}),
      totalNetKwd: totalNet1,
      totalOrders: totalOrdersInt,
      topBranch: { id: topBranch.id, nameAr: topBranch.nameAr, netKwd: topBranch.netKwd, orders: topBranch.orders },
      unattributed: { labelAr: UNATTRIBUTED_BRANCH_LABEL_AR, netKwd: unattributedNet1, orders: unattributedOrdersInt },
      branches: branchRows,
    },
  }
}

async function runPosOrderLinesTool(params: {
  dataSource: FeryalOdooDataSource
  period: { from: string; to: string; periodLabelAr: string }
  targetBranchId: ApprovedFeryalBranchId | null
  question: string
  referenceNowMs?: number
}): Promise<ToolExecutionOutput> {
  const { dataSource, period, targetBranchId, question, referenceNowMs } = params
  const topLimit = extractRequestedTopLimit(question)
  const normAr = normalizeArabicText(question)
  const asksDiscounts = /(الخصومات|خصومات|نسبه الخصم|\bdiscounts?\b)/i.test(normAr)

  const cube = await dataSource.fetchPeriodCube(period.from, period.to, referenceNowMs)

  const domain: unknown[] = [
    ['order_id.date_order', '>=', `${period.from} 00:00:00`],
    ['order_id.date_order', '<=', `${period.to} 23:59:59`],
    ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
  ]
  if (cube?.odooCompanyId) {
    domain.push(['company_id', '=', cube.odooCompanyId])
  }
  withCentralExclusion(domain, 'order_id.config_id.name', targetBranchId, true)

  const executedQueries: FeryalExecutedOdooQuery[] = [
    {
      model: 'pos.order.line',
      method: 'read_group',
      domain,
      groupby: ['product_id'],
      period: { from: period.from, to: period.to },
    },
  ]

  if (!cube || !cube.connected || cube.noData) {
    return {
      hasData: false,
      noDataReasonKey: 'pos_no_data',
      primaryModel: 'pos.order.line',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('pos_no_data'),
      structuredFacts: {},
    }
  }

  let items: OdooPeriodCubeProductRow[] = cube.topProducts.slice(0, topLimit)
  let scopeLabelAr = 'جميع الفروع المعتمدة'
  const allowedEntityNames: string[] = []

  if (targetBranchId) {
    const branchMeta = BRANCH_META_BY_ID.get(targetBranchId)
    scopeLabelAr = branchMeta ? `فرع ${branchMeta.nameAr}` : targetBranchId
    if (branchMeta) allowedEntityNames.push(branchMeta.nameAr)
    const branchItems = await dataSource.fetchBranchTopProducts(
      period.from,
      period.to,
      targetBranchId,
      topLimit,
    )
    if (!branchItems || branchItems.length === 0) {
      return {
        hasData: false,
        noDataReasonKey: 'pos_no_data',
        primaryModel: 'pos.order.line',
        executedQueries,
        toolNumbers: [],
        allowedEntityNames: [],
        deterministicReply: buildFeryalNoOdooDataSuggestion('pos_no_data'),
        structuredFacts: {},
      }
    }
    items = branchItems
  }

  if (items.length === 0) {
    return {
      hasData: false,
      noDataReasonKey: 'pos_no_data',
      primaryModel: 'pos.order.line',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('pos_no_data'),
      structuredFacts: {},
    }
  }

  const toolNumbers: number[] = [
    items.length,
    cube.totals.totalDiscountKwd,
    round1(cube.totals.totalDiscountKwd),
    cube.totals.avgDiscountPct,
    round1(cube.totals.avgDiscountPct),
    cube.totals.discountedLinesCount,
  ]

  const formattedItems = items.map((item) => {
    const net1 = round1(item.netKwd)
    const qty1 = Number.isInteger(Math.round(item.qty * 10) / 10)
      ? Math.round(item.qty)
      : round1(item.qty)
    toolNumbers.push(item.netKwd, net1, item.qty, qty1, item.discountKwd, round1(item.discountKwd))
    allowedEntityNames.push(item.name)
    return {
      name: item.name,
      net1,
      qtyDisplay: Number.isInteger(qty1) ? formatIntCount(qty1) : formatKwd1(qty1),
      discount1: round1(item.discountKwd),
    }
  })

  const itemsSummary = formattedItems
    .map((it) => `${it.name} (${formatKwd1(it.net1)} د.ك — الكمية ${it.qtyDisplay})`)
    .join('، ')

  const leader = formattedItems[0]
  const totalDisc1 = round1(cube.totals.totalDiscountKwd)
  const discCountInt = Math.round(cube.totals.discountedLinesCount)

  const reply = asksDiscounts
    ? [
        `• الرقم: وفق موديل pos.order.line في Odoo للفترة ${period.periodLabelAr} (${scopeLabelAr})، بلغ إجمالي الخصومات المسجلة ${formatKwd1(totalDisc1)} د.ك عبر ${formatIntCount(discCountInt)} سطور مخصومة، وأعلى الأصناف مبيعاً: ${itemsSummary}.`,
        `• السبب من البيانات: تركزت السطور المخصومة في ${formatIntCount(discCountInt)} عملية خصم بإجمالي ${formatKwd1(totalDisc1)} د.ك بينما تصدر الصنف ${leader.name} المبيعات بقيمة ${formatKwd1(leader.net1)} د.ك.`,
        `• الإجراء المحدد: يراجع المدير المالي ومدير العمليات اليوم صلاحيات الخصم اليدوي في نقاط البيع للتحقق من مطابقتها للسقوف المعتمدة.`,
        `• الأثر المتوقع (تقدير): تقدير — ضبط الخصومات المسجلة البالغة ${formatKwd1(totalDisc1)} د.ك يحافظ على هامش ربح الأصناف الأعلى طلباً.`,
      ].join('\n')
    : [
        `• الرقم: وفق موديل pos.order.line في Odoo للفترة ${period.periodLabelAr} (${scopeLabelAr})، جاءت أعلى ${formatIntCount(items.length)} أصناف مبيعاً كالتالي: ${itemsSummary}.`,
        `• السبب من البيانات: تصدر الصنف ${leader.name} قائمة الأصناف بصافي ${formatKwd1(leader.net1)} د.ك وكمية ${leader.qtyDisplay} وحدة وفق سطور نقاط البيع المرحلة.`,
        `• الإجراء المحدد: يوجه مدير المطبخ المركزي ومديرو الفروع اليوم بتأمين مخزون المواد الأولية للصنف ${leader.name} وبقية الأصناف الأعلى مبيعاً قبل ذروة الوردية المسائية.`,
        `• الأثر المتوقع (تقدير): تقدير — ضمان توفر الأصناف الأعلى طلباً يمنع انقطاع الصنف المتصدر (${formatKwd1(leader.net1)} د.ك) خلال ساعات الذروة.`,
      ].join('\n')

  return {
    hasData: true,
    primaryModel: 'pos.order.line',
    executedQueries,
    toolNumbers,
    allowedEntityNames,
    deterministicReply: reply,
    structuredFacts: {
      model: 'pos.order.line',
      period: { from: period.from, to: period.to },
      scope: scopeLabelAr,
      topItems: formattedItems,
      totalDiscountKwd: totalDisc1,
      discountedLinesCount: discCountInt,
    },
  }
}

async function runAccountMoveLinesTool(params: {
  dataSource: FeryalOdooDataSource
  period: { from: string; to: string; periodLabelAr: string }
  question: string
  referenceNowMs?: number
}): Promise<ToolExecutionOutput> {
  const { dataSource, period, question, referenceNowMs } = params
  const normAr = normalizeArabicText(question)
  const asksReceivables = /(الذمم المدينه|ذمم المنصات|مستحقات المنصات|ذمم|\breceivables?\b)/i.test(
    normAr,
  )

  const [cube, receivables] = await Promise.all([
    dataSource.fetchPeriodCube(period.from, period.to, referenceNowMs),
    asksReceivables ? dataSource.fetchReceivablesSummary() : Promise.resolve(null),
  ])

  const domain: unknown[] = [
    ['parent_state', '=', 'posted'],
    ['date', '>=', period.from],
    ['date', '<=', period.to],
  ]
  if (cube?.odooCompanyId) {
    domain.push(['company_id', '=', cube.odooCompanyId])
  }
  withCentralExclusion(domain, 'name')

  const executedQueries: FeryalExecutedOdooQuery[] = [
    {
      model: 'account.move.line',
      method: 'read_group',
      domain,
      groupby: ['account_id'],
      period: { from: period.from, to: period.to },
    },
  ]

  const acc = cube?.accounting
  const hasAccData = Boolean(
    cube?.connected && acc && acc.available !== false && (acc.lineCount ?? 1) > 0,
  )
  const hasRecData = Boolean(receivables && receivables.readable)

  if ((!cube || !cube.connected) && !hasRecData) {
    return {
      hasData: false,
      noDataReasonKey: 'gl_no_data',
      primaryModel: 'account.move.line',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('gl_no_data'),
      structuredFacts: {},
    }
  }

  if (!hasAccData && !hasRecData) {
    return {
      hasData: false,
      noDataReasonKey: 'gl_no_data',
      primaryModel: 'account.move.line',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('gl_no_data'),
      structuredFacts: {},
    }
  }

  const toolNumbers: number[] = []
  const allowedEntityNames: string[] = []

  if (asksReceivables && receivables && receivables.readable && !PER_CUSTOMER_DUE_DATE_AGING_VERIFIED) {
    // Phase 5 · Item 2: never quote a signed net / ledger balance as overdue until per-customer
    // due-date aging is verified. Report the neutral status plus the factual open-line count only.
    const openLines = Math.round(receivables.openLinesCount)
    toolNumbers.push(openLines)
    const reply = [
      `• الرقم: الذمم المدينة — ${RECEIVABLES_PENDING_STATUS.ar}؛ يوجد ${formatIntCount(openLines)} قيد ذمم غير مسوّى في account.move.line.`,
      `• السبب من البيانات: ${RECEIVABLES_PENDING_DETAIL.ar}`,
      `• الإجراء المحدد: يستكمل قسم المحاسبة مطابقة تحصيلات المنصات والعملاء مع القيود المفتوحة وبناء أعمار الذمم لكل عميل.`,
      `• الأثر المتوقع (تقدير): لا يوجد تقدير — لا تُعرض مبالغ متأخرة قبل اكتمال المطابقة.`,
    ].join('\n')
    return {
      hasData: true,
      primaryModel: 'account.move.line',
      executedQueries,
      toolNumbers,
      allowedEntityNames,
      deterministicReply: reply,
      structuredFacts: {
        model: 'account.move.line',
        period: { from: period.from, to: period.to },
        receivablesStatus: 'pending-reconciliation',
        openLinesCount: openLines,
      },
    }
  }

  if (asksReceivables && receivables && receivables.readable) {
    const openRec1 = round1(receivables.openReceivableKwd)
    const openLines = Math.round(receivables.openLinesCount)
    toolNumbers.push(receivables.openReceivableKwd, openRec1, openLines)

    const incompleteFlag = Boolean(acc?.glIncomplete)
    const warningSuffix = incompleteFlag ? ` — تنبيه: ${FERYAL_INCOMPLETE_GL_WARNING}.` : ''

    const reply = [
      `• الرقم: وفق موديل account.move.line في Odoo حتى الفترة ${period.periodLabelAr}، بلغ صافي الذمم المدينة المفتوحة ${formatKwd1(openRec1)} د.ك موزعة على ${formatIntCount(openLines)} قيد مستحق غير مسوى${warningSuffix}`,
      `• السبب من البيانات: يمثل الرصيد البالغ ${formatKwd1(openRec1)} د.ك عبر ${formatIntCount(openLines)} سطر محاسبي ذمم التحصيل المفتوحة في حسابات الذمم المدينة المرحلة.`,
      `• الإجراء المحدد: يطابق قسم المحاسبة اليوم كشوف التسوية البنكية وتحصيلات المنصات مع القيود المفتوحة في دفتر الأستاذ لإقفال الأرصدة المسددة.`,
      `• الأثر المتوقع (تقدير): تقدير — تسوية القيود المفتوحة البالغة ${formatIntCount(openLines)} سطراً يوضح التدفق النقدي المحصل فعلياً من رصيد ${formatKwd1(openRec1)} د.ك.`,
    ].join('\n')

    return {
      hasData: true,
      primaryModel: 'account.move.line',
      executedQueries,
      toolNumbers,
      allowedEntityNames,
      deterministicReply: reply,
      structuredFacts: {
        model: 'account.move.line',
        period: { from: period.from, to: period.to },
        openReceivableKwd: openRec1,
        openLinesCount: openLines,
        glIncomplete: incompleteFlag,
      },
      requireGlIncompleteWarning: incompleteFlag,
    }
  }

  if (!acc) {
    return {
      hasData: false,
      noDataReasonKey: 'gl_no_data',
      primaryModel: 'account.move.line',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('gl_no_data'),
      structuredFacts: {},
    }
  }

  const rawRevenue = acc.totalRevenue ?? acc.income + acc.otherIncome
  const revenue1 = round1(rawRevenue)
  const rawTotalExpenses = acc.cogs + acc.expense + acc.depreciation
  const expenses1 = round1(rawTotalExpenses)
  const netProfit1 = round1(acc.operatingProfit)
  const netProfitAbs1 = round1(Math.abs(acc.operatingProfit))
  const incompleteFlag = Boolean(acc.glIncomplete || acc.completeAccrualPosted === false)

  // Phase 5 · Item 7: Net Profit only for closed GL months. Open-month windows report posted
  // revenue/expenses to date and state that Net Profit is unavailable until month close.
  if (!isWindowWithinClosedMonths(acc.to ?? period.to, acc.glClosedThroughDate)) {
    const withheld = closedMonthWithheldReason(acc.glClosedThroughDate)
    toolNumbers.push(rawRevenue, revenue1, rawTotalExpenses, expenses1)
    const warningClause = incompleteFlag ? ` (تحذير: ${FERYAL_INCOMPLETE_GL_WARNING})` : ''
    const reply = [
      `• الرقم: وفق موديل account.move.line في Odoo للفترة ${period.periodLabelAr}، بلغت الإيرادات المرحلة حتى الآن ${formatKwd1(revenue1)} د.ك وإجمالي المصروفات والتكاليف المرحلة ${formatKwd1(expenses1)} د.ك${warningClause}. صافي الربح: غير متاح.`,
      `• السبب من البيانات: ${withheld.ar}؛ الفترة المطلوبة تشمل شهراً لم يُقفل بعد في دفتر الأستاذ العام.`,
      `• الإجراء المحدد: يُقفل قسم المحاسبة الشهر في Odoo (تاريخ قفل الفترة) ثم يُعرض صافي الربح والهامش تلقائياً.`,
      `• الأثر المتوقع (تقدير): لا يوجد تقدير — لا يُحتسب صافي ربح لشهر مفتوح.`,
    ].join('\n')
    return {
      hasData: true,
      primaryModel: 'account.move.line',
      executedQueries,
      toolNumbers,
      allowedEntityNames,
      deterministicReply: reply,
      structuredFacts: {
        model: 'account.move.line',
        period: { from: period.from, to: period.to },
        revenueKwd: revenue1,
        expensesKwd: expenses1,
        operatingProfitKwd: null,
        netProfitWithheld: true,
        glClosedThroughDate: acc.glClosedThroughDate ?? null,
        glIncomplete: incompleteFlag,
      },
      requireGlIncompleteWarning: incompleteFlag,
    }
  }

  toolNumbers.push(
    rawRevenue,
    revenue1,
    rawTotalExpenses,
    expenses1,
    acc.operatingProfit,
    netProfit1,
    netProfitAbs1,
    acc.cogs,
    round1(acc.cogs),
    acc.expense,
    round1(acc.expense),
  )

  const netLabel =
    netProfit1 >= 0
      ? `صافي ربح تشغيلي ${formatKwd1(netProfit1)} د.ك`
      : `صافي خسارة دفترية ${formatKwd1(netProfitAbs1)} د.ك`

  const warningClause = incompleteFlag ? ` (تحذير: ${FERYAL_INCOMPLETE_GL_WARNING})` : ''

  const reply = [
    `• الرقم: وفق موديل account.move.line في Odoo للفترة ${period.periodLabelAr}، بلغت الإيرادات المرحلة ${formatKwd1(revenue1)} د.ك وإجمالي المصروفات والتكاليف ${formatKwd1(expenses1)} د.ك، والنتيجة ${netLabel}${warningClause}.`,
    `• السبب من البيانات: نتجت القراءة عن مقارنة إيرادات دفتر الأستاذ (${formatKwd1(revenue1)} د.ك) مع التكاليف والمصروفات المرحلة (${formatKwd1(expenses1)} د.ك)${incompleteFlag ? ` مع وجود ${FERYAL_INCOMPLETE_GL_WARNING} لعدم ترحيل كامل قيود الاستحقاق` : ''}.`,
    `• الإجراء المحدد: يستكمل المدير المالي ورئيس الحسابات اليوم مراجعة وترحيل قيود الاستحقاق ومطابقة إيرادات نقاط البيع مع دفتر الأستاذ للفترة.`,
    `• الأثر المتوقع (تقدير): تقدير — اكتمال ترحيل القيود يمنح قراءة ختامية دقيقة لصافي الربح البالغ حالياً ${formatKwd1(netProfit1)} د.ك قبل إقفال الفترة.`,
  ].join('\n')

  return {
    hasData: true,
    primaryModel: 'account.move.line',
    executedQueries,
    toolNumbers,
    allowedEntityNames,
    deterministicReply: reply,
    structuredFacts: {
      model: 'account.move.line',
      period: { from: period.from, to: period.to },
      revenueKwd: revenue1,
      expensesKwd: expenses1,
      operatingProfitKwd: netProfit1,
      glIncomplete: incompleteFlag,
    },
    requireGlIncompleteWarning: incompleteFlag,
  }
}

async function runPurchaseOrdersTool(params: {
  dataSource: FeryalOdooDataSource
  period: { from: string; to: string; periodLabelAr: string }
  question: string
  referenceNowMs?: number
}): Promise<ToolExecutionOutput> {
  const { dataSource, period, question, referenceNowMs } = params
  const po = await dataSource.fetchPurchaseOrders(period.from, period.to, referenceNowMs)

  const domain: unknown[] = [
    ['state', 'in', ['purchase', 'done']],
    ['date_order', '>=', `${period.from} 00:00:00`],
    ['date_order', '<=', `${period.to} 23:59:59`],
  ]
  if (po?.odooCompanyId) {
    domain.push(['company_id', '=', po.odooCompanyId])
  }
  withCentralExclusion(domain, 'partner_id.name')
  const lineDomain: unknown[] = [['order_id.state', 'in', ['purchase', 'done']]]
  withCentralExclusion(lineDomain, 'product_id.name')

  const executedQueries: FeryalExecutedOdooQuery[] = [
    {
      model: 'purchase.order',
      method: 'search_read',
      domain,
      groupby: ['partner_id'],
      period: { from: period.from, to: period.to },
    },
    {
      model: 'purchase.order.line',
      method: 'read_group',
      domain: lineDomain,
      groupby: ['partner_id', 'product_id'],
      period: { from: period.from, to: period.to },
    },
  ]

  if (!po || !po.connected || po.noData || po.byVendor.length === 0) {
    return {
      hasData: false,
      noDataReasonKey: 'vendor_no_data',
      primaryModel: 'purchase.order',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('vendor_no_data'),
      structuredFacts: {},
    }
  }

  const vendorTarget = extractVendorQueryTarget(question)

  // Literal placeholder like "تكلفة مورد معين" -> no vendor named "معين" in Odoo
  if (vendorTarget.mode === 'placeholder_vendor') {
    return {
      hasData: false,
      noDataReasonKey: 'vendor_no_data',
      primaryModel: 'purchase.order',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('vendor_no_data'),
      structuredFacts: {},
    }
  }

  if (vendorTarget.mode === 'specific_vendor') {
    const queryNorm = normalizeArabicText(vendorTarget.vendorQuery)
    const matchedVendor = po.byVendor.find((v) => {
      const vNorm = normalizeArabicText(v.vendorName)
      return vNorm.includes(queryNorm) || queryNorm.includes(vNorm)
    })

    if (!matchedVendor) {
      return {
        hasData: false,
        noDataReasonKey: 'vendor_no_data',
        primaryModel: 'purchase.order',
        executedQueries,
        toolNumbers: [],
        allowedEntityNames: [],
        deterministicReply: buildFeryalNoOdooDataSuggestion('vendor_no_data'),
        structuredFacts: {},
      }
    }

    const untaxed1 = round1(matchedVendor.totalUntaxedKwd)
    const total1 = round1(matchedVendor.totalAmountKwd)
    const ordersInt = Math.round(matchedVendor.ordersCount)
    const linesInt = Math.round(matchedVendor.linesCount)
    const companyTotal1 = round1(po.totals.totalAmountKwd)

    const toolNumbers: number[] = [
      matchedVendor.totalUntaxedKwd,
      untaxed1,
      matchedVendor.totalAmountKwd,
      total1,
      ordersInt,
      linesInt,
      po.totals.totalAmountKwd,
      companyTotal1,
    ]
    const allowedEntityNames: string[] = [matchedVendor.vendorName]

    const reply = [
      `• الرقم: وفق موديل purchase.order وpurchase.order.line في Odoo للفترة ${period.periodLabelAr}، بلغت تكلفة أوامر الشراء المؤكدة للمورد ${matchedVendor.vendorName} إجمالي ${formatKwd1(total1)} د.ك (${formatKwd1(untaxed1)} د.ك قبل الضريبة) عبر ${formatIntCount(ordersInt)} أوامر شراء و${formatIntCount(linesInt)} سطور أصناف من إجمالي مشتريات الشركة البالغ ${formatKwd1(companyTotal1)} د.ك.`,
      `• السبب من البيانات: سجلت أوامر الشراء المعتمدة للمورد ${matchedVendor.vendorName} عدد ${formatIntCount(ordersInt)} طلبات توريد بقيمة ${formatKwd1(total1)} د.ك خلال الفترة المستعلم عنها.`,
      `• الإجراء المحدد: يراجع مسؤول المشتريات وأمين مخزن العارضية اليوم مطابقة أسعار الوحدات المستلمة من ${matchedVendor.vendorName} مع اتفاقية التوريد المعتمدة قبل إصدار دفعة السداد.`,
      `• الأثر المتوقع (تقدير): تقدير — تدقيق سطور التوريد البالغة ${formatIntCount(linesInt)} سطراً يضبط تكلفة الشراء الفعلية البالغة ${formatKwd1(total1)} د.ك ويمنع أي انحراف سعري.`,
    ].join('\n')

    return {
      hasData: true,
      primaryModel: 'purchase.order',
      executedQueries,
      toolNumbers,
      allowedEntityNames,
      deterministicReply: reply,
      structuredFacts: {
        model: 'purchase.order',
        period: { from: period.from, to: period.to },
        vendor: matchedVendor,
        companyTotalKwd: companyTotal1,
      },
    }
  }

  // Summary across top actual vendors in `purchase.order`
  const topVendors = po.byVendor.slice(0, 5)
  const totalKwd1 = round1(po.totals.totalAmountKwd)
  const untaxedKwd1 = round1(po.totals.totalUntaxedKwd)
  const ordersCountInt = Math.round(po.totals.ordersCount)
  const vendorsCountInt = Math.round(po.totals.vendorsCount)

  const toolNumbers: number[] = [
    po.totals.totalAmountKwd,
    totalKwd1,
    po.totals.totalUntaxedKwd,
    untaxedKwd1,
    ordersCountInt,
    vendorsCountInt,
  ]
  const allowedEntityNames: string[] = []

  const vendorsText = topVendors
    .map((v) => {
      const vTotal1 = round1(v.totalAmountKwd)
      const vOrders = Math.round(v.ordersCount)
      toolNumbers.push(v.totalAmountKwd, vTotal1, vOrders)
      allowedEntityNames.push(v.vendorName)
      return `${v.vendorName} (${formatKwd1(vTotal1)} د.ك — ${formatIntCount(vOrders)} أوامر)`
    })
    .join('، ')

  const topOne = topVendors[0]
  const topOneTotal1 = round1(topOne.totalAmountKwd)

  const reply = [
    `• الرقم: وفق موديل purchase.order في Odoo للفترة ${period.periodLabelAr}، بلغ إجمالي أوامر الشراء المؤكدة ${formatKwd1(totalKwd1)} د.ك عبر ${formatIntCount(ordersCountInt)} أوامر شراء موزعة على ${formatIntCount(vendorsCountInt)} موردين، وأبرزهم: ${vendorsText}.`,
    `• السبب من البيانات: تصدر المورد ${topOne.vendorName} تكاليف التوريد بقيمة ${formatKwd1(topOneTotal1)} د.ك من إجمالي المشتريات البالغ ${formatKwd1(totalKwd1)} د.ك.`,
    `• الإجراء المحدد: يراجع مدير المشتريات اليوم عقود التوريد لأعلى الموردين قيمة ويطابق سندات الاستلام المخزني مع الفواتير المرحلة.`,
    `• الأثر المتوقع (تقدير): تقدير — التفاوض على شروط التوريد مع الموردين الأعلى حصة يحسن كفاءة الإنفاق الشرائي البالغ ${formatKwd1(totalKwd1)} د.ك.`,
  ].join('\n')

  return {
    hasData: true,
    primaryModel: 'purchase.order',
    executedQueries,
    toolNumbers,
    allowedEntityNames,
    deterministicReply: reply,
    structuredFacts: {
      model: 'purchase.order',
      period: { from: period.from, to: period.to },
      totals: po.totals,
      topVendors,
    },
  }
}

async function runStockMovesAndScrapTool(params: {
  dataSource: FeryalOdooDataSource
  period: { from: string; to: string; periodLabelAr: string }
  referenceNowMs?: number
}): Promise<ToolExecutionOutput> {
  const { dataSource, period, referenceNowMs } = params
  const wh = await dataSource.fetchWarehouseChain(period.from, period.to, referenceNowMs)

  const moveDomain: unknown[] = [
    ['state', '=', 'done'],
    ['date', '>=', `${period.from} 00:00:00`],
    ['date', '<=', `${period.to} 23:59:59`],
  ]
  const scrapDomain: unknown[] = [
    ['state', '=', 'done'],
    ['date_done', '>=', `${period.from} 00:00:00`],
    ['date_done', '<=', `${period.to} 23:59:59`],
  ]
  if (wh?.odooCompanyId) {
    moveDomain.push(['company_id', '=', wh.odooCompanyId])
    scrapDomain.push(['company_id', '=', wh.odooCompanyId])
  }
  withCentralExclusion(moveDomain, 'product_id.name')
  withCentralExclusion(scrapDomain, 'product_id.name')

  const executedQueries: FeryalExecutedOdooQuery[] = [
    {
      model: 'stock.move',
      method: 'read_group',
      domain: moveDomain,
      groupby: ['product_id', 'location_id', 'location_dest_id'],
      period: { from: period.from, to: period.to },
    },
    {
      model: 'stock.scrap',
      method: 'search_read',
      domain: scrapDomain,
      groupby: ['product_id', 'location_id'],
      period: { from: period.from, to: period.to },
    },
  ]

  if (!wh || !wh.connected || wh.noData) {
    return {
      hasData: false,
      noDataReasonKey: 'stock_no_data',
      primaryModel: 'stock.move',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('stock_no_data'),
      structuredFacts: {},
    }
  }

  const transfer1 = round1(wh.totals.ckToBranchTransferKwd)
  const inbound1 = round1(wh.totals.inboundSupplierKwd)
  const scrap1 = round1(wh.totals.scrapKwd)
  const movesInt = Math.round(wh.totals.doneMovesCount)
  const scrapsInt = Math.round(wh.totals.scrapOrdersCount)

  const toolNumbers: number[] = [
    wh.totals.ckToBranchTransferKwd,
    transfer1,
    wh.totals.inboundSupplierKwd,
    inbound1,
    wh.totals.scrapKwd,
    scrap1,
    movesInt,
    scrapsInt,
  ]
  const allowedEntityNames: string[] = []

  const reply = [
    `• الرقم: وفق موديل stock.move وstock.scrap في Odoo للفترة ${period.periodLabelAr}، سجل المخزن ${formatIntCount(movesInt)} حركة مخزنية مكتملة بقيمة تحويلات للمطاعم ${formatKwd1(transfer1)} د.ك وتوريد مستلم ${formatKwd1(inbound1)} د.ك، فيما بلغ الهدر المسجل ${formatKwd1(scrap1)} د.ك عبر ${formatIntCount(scrapsInt)} أوامر إتلاف.`,
    `• السبب من البيانات: تعكس الحركات البالغة ${formatIntCount(movesInt)} حركة نشاط التوريد والتحويل من مخزن العارضية إلى الفروع مقابل ${formatIntCount(scrapsInt)} عمليات إتلاف مسجلة بقيمة ${formatKwd1(scrap1)} د.ك.`,
    `• الإجراء المحدد: يدقق مدير المخزن ومشرف الجودة اليوم أسباب أوامر الإتلاف المسجلة في stock.scrap ويطابقون كميات التحويل الصادرة للفروع مع سندات الاستلام.`,
    `• الأثر المتوقع (تقدير): تقدير — خفض الهدر المخزني المسجل حالياً بقيمة ${formatKwd1(scrap1)} د.ك ورفع دقة مطابقة التحويلات البالغة ${formatKwd1(transfer1)} د.ك.`,
  ].join('\n')

  return {
    hasData: true,
    primaryModel: 'stock.move',
    executedQueries,
    toolNumbers,
    allowedEntityNames,
    deterministicReply: reply,
    structuredFacts: {
      model: 'stock.move',
      period: { from: period.from, to: period.to },
      totals: wh.totals,
    },
  }
}

async function runPosComparisonTool(params: {
  dataSource: FeryalOdooDataSource
  comparison: {
    periodA: { from: string; to: string; periodLabelAr: string }
    periodB: { from: string; to: string; periodLabelAr: string }
    allowedDateStrings: string[]
  }
  targetBranchId: ApprovedFeryalBranchId | null
  referenceNowMs?: number
}): Promise<ToolExecutionOutput> {
  const { dataSource, comparison, targetBranchId, referenceNowMs } = params
  const { periodA, periodB } = comparison

  const [cubeA, cubeB] = await Promise.all([
    dataSource.fetchPeriodCube(periodA.from, periodA.to, referenceNowMs),
    dataSource.fetchPeriodCube(periodB.from, periodB.to, referenceNowMs),
  ])

  const companyId = cubeA?.odooCompanyId ?? cubeB?.odooCompanyId ?? null
  const buildDomain = (p: { from: string; to: string }): unknown[] => {
    const domain: unknown[] = [
      ['date_order', '>=', `${p.from} 00:00:00`],
      ['date_order', '<=', `${p.to} 23:59:59`],
      ['state', 'in', ['paid', 'done', 'invoiced']],
      ...(companyId ? [['company_id', '=', companyId]] : []),
    ]
    return withCentralExclusion(domain, 'session_id.config_id.name', targetBranchId)
  }

  const executedQueries: FeryalExecutedOdooQuery[] = [
    {
      model: 'pos.order',
      method: 'read_group',
      domain: buildDomain(periodA),
      groupby: targetBranchId ? ['session_id'] : ['date_order:day', 'session_id'],
      period: { from: periodA.from, to: periodA.to },
    },
    {
      model: 'pos.order',
      method: 'read_group',
      domain: buildDomain(periodB),
      groupby: targetBranchId ? ['session_id'] : ['date_order:day', 'session_id'],
      period: { from: periodB.from, to: periodB.to },
    },
  ]

  if ((!cubeA || !cubeA.connected) && (!cubeB || !cubeB.connected)) {
    return {
      hasData: false,
      noDataReasonKey: 'pos_no_data',
      primaryModel: 'pos.order',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('pos_no_data'),
      structuredFacts: {},
    }
  }

  let rawNetA = 0
  let rawOrdersA = 0
  let rawNetB = 0
  let rawOrdersB = 0
  let scopeLabelAr = 'جميع الفروع المعتمدة'
  const allowedEntityNames: string[] = []

  if (targetBranchId) {
    const branchMeta = BRANCH_META_BY_ID.get(targetBranchId)
    scopeLabelAr = branchMeta ? `فرع ${branchMeta.nameAr}` : targetBranchId
    if (branchMeta) allowedEntityNames.push(branchMeta.nameAr)
    const bA = cubeA?.byBranch?.[targetBranchId]
    const bB = cubeB?.byBranch?.[targetBranchId]
    rawNetA = bA?.netKwd ?? 0
    rawOrdersA = bA?.orders ?? 0
    rawNetB = bB?.netKwd ?? 0
    rawOrdersB = bB?.orders ?? 0
  } else {
    rawNetA = cubeA?.totals.netSalesKwd ?? 0
    rawOrdersA = cubeA?.totals.orders ?? 0
    rawNetB = cubeB?.totals.netSalesKwd ?? 0
    rawOrdersB = cubeB?.totals.orders ?? 0
  }

  // Phase 5 · Item 3: a single-day comparison that includes today (partial) is like-for-like only
  // when both days are cut at the same completed Kuwait hour. Without hourly data for both days,
  // the reply states the "until HH:MM" boundary explicitly.
  const nowForCutoff = referenceNowMs ?? Date.now()
  const kwNow = new Date(nowForCutoff + 3 * 60 * 60 * 1000)
  const cutoffHour = kwNow.getUTCHours()
  const cutoffMinute = kwNow.getUTCMinutes()
  const todayIso = getKuwaitCalendarParts(nowForCutoff).iso
  const singleDayWithToday =
    periodA.from === periodA.to &&
    periodB.from === periodB.to &&
    periodA.from !== periodB.from &&
    (periodA.from === todayIso || periodB.from === todayIso)
  const hourlyOf = (c: typeof cubeA) =>
    (targetBranchId ? c?.hourlyByBranch?.[targetBranchId] : c?.hourlySeries) ?? []
  const hasHourly = (rows: { netKwd: number }[]) => rows.some((r) => (r.netKwd ?? 0) !== 0)
  const pad2 = (n: number) => String(n).padStart(2, '0')
  let windowClause = ''
  const cutoffNumbers: number[] = []
  if (singleDayWithToday) {
    const hA = hourlyOf(cubeA)
    const hB = hourlyOf(cubeB)
    if (hasHourly(hA) && hasHourly(hB)) {
      const upTo = (rows: { hour: number; netKwd: number; orders: number }[]) =>
        rows
          .filter((r) => r.hour < cutoffHour)
          .reduce((acc, r) => ({ net: acc.net + (r.netKwd ?? 0), orders: acc.orders + (r.orders ?? 0) }), { net: 0, orders: 0 })
      const a = upTo(hA)
      const b = upTo(hB)
      rawNetA = a.net
      rawOrdersA = a.orders
      rawNetB = b.net
      rawOrdersB = b.orders
      windowClause = ` — مقارنة نفس الساعات حتى الساعة ${pad2(cutoffHour)}:00 بتوقيت الكويت`
      cutoffNumbers.push(cutoffHour, 0)
    } else {
      windowClause = ` — تنبيه: اليوم غير مكتمل (حتى ${pad2(cutoffHour)}:${pad2(cutoffMinute)} بتوقيت الكويت) مقابل يوم كامل`
      cutoffNumbers.push(cutoffHour, cutoffMinute)
    }
  }

  if (rawNetA <= 0 && rawOrdersA <= 0 && rawNetB <= 0 && rawOrdersB <= 0) {
    return {
      hasData: false,
      noDataReasonKey: 'pos_no_data',
      primaryModel: 'pos.order',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('pos_no_data'),
      structuredFacts: {},
    }
  }

  const netA1 = round1(rawNetA)
  const ordersAInt = Math.round(rawOrdersA)
  const netB1 = round1(rawNetB)
  const ordersBInt = Math.round(rawOrdersB)
  const rawDiff = rawNetA - rawNetB
  const diff1 = round1(netA1 - netB1)
  const absDiff1 = round1(Math.abs(diff1))
  const ordersDiffInt = ordersAInt - ordersBInt
  const absOrdersDiffInt = Math.abs(ordersDiffInt)
  const pct1 = netB1 > 0 ? round1(((netA1 - netB1) / netB1) * 100) : 0
  const absPct1 = round1(Math.abs(pct1))

  const toolNumbers: number[] = [
    rawNetA,
    netA1,
    ordersAInt,
    rawNetB,
    netB1,
    ordersBInt,
    rawDiff,
    diff1,
    absDiff1,
    ordersDiffInt,
    absOrdersDiffInt,
    pct1,
    absPct1,
    ...cutoffNumbers,
  ]

  const directionWord = diff1 > 0 ? 'بارتفاع' : diff1 < 0 ? 'بانخفاض' : 'بفارق'
  const pctSegment = netB1 > 0 ? ` (${formatKwd1(absPct1)}%)` : ''
  const ordersDirection =
    ordersDiffInt > 0
      ? `زيادة الطلبات بعدد ${formatIntCount(absOrdersDiffInt)} طلبات`
      : ordersDiffInt < 0
        ? `تراجع الطلبات بعدد ${formatIntCount(absOrdersDiffInt)} طلبات`
        : `ثبات عدد الطلبات بفارق ${formatIntCount(absOrdersDiffInt)} طلبات`
  // Phase 5 · Item 3: when sales and orders move in opposite directions (or orders are flat while
  // sales move), the gap is NOT explained by order count — it comes from the average basket.
  const aovA1 = ordersAInt > 0 ? round1(rawNetA / ordersAInt) : 0
  const aovB1 = ordersBInt > 0 ? round1(rawNetB / ordersBInt) : 0
  const salesSign = Math.sign(diff1)
  const ordersSign = Math.sign(ordersDiffInt)
  const directionsDisagree = salesSign !== 0 && salesSign !== ordersSign
  toolNumbers.push(aovA1, aovB1)
  const causeSentence = directionsDisagree
    ? `${diff1 > 0 ? 'ارتفعت' : 'انخفضت'} المبيعات ${ordersSign === 0 ? 'مع ثبات عدد الطلبات' : ordersSign > 0 ? `رغم زيادة الطلبات بعدد ${formatIntCount(absOrdersDiffInt)} طلبات` : `رغم تراجع الطلبات بعدد ${formatIntCount(absOrdersDiffInt)} طلبات`}، لذلك يعود الفارق البالغ ${formatKwd1(absDiff1)} د.ك إلى تغيّر متوسط الطلب من ${formatKwd1(aovB1)} د.ك في ${periodB.periodLabelAr} إلى ${formatKwd1(aovA1)} د.ك في ${periodA.periodLabelAr}.`
    : `يعود الفارق البالغ ${formatKwd1(absDiff1)} د.ك بين الفترتين إلى ${ordersDirection} بين ${periodA.periodLabelAr} (${formatIntCount(ordersAInt)} طلبات) و${periodB.periodLabelAr} (${formatIntCount(ordersBInt)} طلبات).`

  const reply = [
    `• الرقم: وفق موديل pos.order في Odoo (${scopeLabelAr})${windowClause}، بلغ صافي مبيعات الفترة ${periodA.periodLabelAr} قيمة ${formatKwd1(netA1)} د.ك عبر ${formatIntCount(ordersAInt)} طلبات مقابل ${formatKwd1(netB1)} د.ك عبر ${formatIntCount(ordersBInt)} طلبات في الفترة ${periodB.periodLabelAr}، ${directionWord} قدره ${formatKwd1(absDiff1)} د.ك${pctSegment}.`,
    `• السبب من البيانات: ${causeSentence}`,
    `• الإجراء المحدد: يراجع مدير العمليات ومديرو الفروع اليوم توزيع الورديات وتوافر الأصناف الأكثر طلباً لمحاكاة أعلى قراءة مسجلة بين الفترتين.`,
    `• الأثر المتوقع (تقدير): تقدير — استدامة مستوى الأداء الأعلى يغلق فجوة المبيعات البالغة ${formatKwd1(absDiff1)} د.ك ويرفع استقرار الإيراد اليومي.`,
  ].join('\n')

  return {
    hasData: true,
    primaryModel: 'pos.order',
    executedQueries,
    toolNumbers,
    allowedEntityNames,
    deterministicReply: reply,
    structuredFacts: {
      model: 'pos.order',
      scope: scopeLabelAr,
      periodA: { ...periodA, netKwd: netA1, orders: ordersAInt },
      periodB: { ...periodB, netKwd: netB1, orders: ordersBInt },
      deltaNetKwd: diff1,
      deltaOrders: ordersDiffInt,
      deltaPct: pct1,
      ...(singleDayWithToday ? { sameHoursCutoff: windowClause.includes(':00 ') ? `${pad2(cutoffHour)}:00` : null } : {}),
    },
  }
}

async function runPosBrandsTool(params: {
  dataSource: FeryalOdooDataSource
  period: { from: string; to: string; periodLabelAr: string }
  targetBrandId: ApprovedFeryalBrandId | null
  targetBranchId: ApprovedFeryalBranchId | null
  referenceNowMs?: number
}): Promise<ToolExecutionOutput> {
  const { dataSource, period, targetBrandId, targetBranchId, referenceNowMs } = params
  const cube = await dataSource.fetchPeriodCube(period.from, period.to, referenceNowMs)

  const domain: unknown[] = [
    ['order_id.date_order', '>=', `${period.from} 00:00:00`],
    ['order_id.date_order', '<=', `${period.to} 23:59:59`],
    ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
  ]
  if (cube?.odooCompanyId) {
    domain.push(['company_id', '=', cube.odooCompanyId])
  }
  withCentralExclusion(domain, 'order_id.config_id.name', targetBranchId, true)

  const executedQueries: FeryalExecutedOdooQuery[] = [
    {
      model: 'pos.order.line',
      method: 'read_group',
      domain,
      groupby: ['product_id'],
      period: { from: period.from, to: period.to },
    },
  ]

  if (!cube || !cube.connected || cube.noData) {
    return {
      hasData: false,
      noDataReasonKey: 'pos_no_data',
      primaryModel: 'pos.order.line',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('pos_no_data'),
      structuredFacts: {},
    }
  }

  const branchMeta = targetBranchId ? BRANCH_META_BY_ID.get(targetBranchId) : null
  const scopeLabelAr = branchMeta ? `فرع ${branchMeta.nameAr}` : 'جميع الفروع المعتمدة'
  const scopeNetRaw = targetBranchId
    ? cube.byBranch?.[targetBranchId]?.netKwd ?? 0
    : cube.totals.netSalesKwd
  const scopeNet1 = round1(scopeNetRaw)

  const brandRows = APPROVED_FERYAL_BRAND_LIST.map((meta) => {
    const raw = targetBranchId
      ? cube.brandByBranch?.[targetBranchId]?.[meta.id]
      : cube.byBrand?.[meta.id]
    const rawNetKwd = raw?.netKwd ?? 0
    const netKwd = round1(rawNetKwd)
    const rawQty = raw?.qty ?? 0
    const qtyInt = Math.round(rawQty)
    const linesInt = Math.round(raw?.linesCount ?? 0)
    const sharePct1 = scopeNet1 > 0 ? round1((netKwd / scopeNet1) * 100) : 0
    return {
      id: meta.id,
      nameAr: meta.nameAr,
      nameEn: meta.nameEn,
      rawNetKwd,
      netKwd,
      rawQty,
      qtyInt,
      linesInt,
      sharePct1,
    }
  }).sort((a, b) => b.netKwd - a.netKwd || b.rawNetKwd - a.rawNetKwd)

  const rawBrandsTotal = brandRows.reduce((s, r) => s + r.rawNetKwd, 0)
  const brandsTotal1 = round1(brandRows.reduce((s, r) => s + r.netKwd, 0))

  const allowedEntityNames: string[] = []
  if (branchMeta) allowedEntityNames.push(branchMeta.nameAr)
  for (const r of brandRows) {
    allowedEntityNames.push(r.nameAr, r.nameEn)
  }

  if (targetBrandId) {
    const targetBrand = brandRows.find((r) => r.id === targetBrandId)
    if (!targetBrand || (targetBrand.netKwd <= 0 && targetBrand.qtyInt <= 0 && targetBrand.linesInt <= 0)) {
      return {
        hasData: false,
        noDataReasonKey: 'pos_no_data',
        primaryModel: 'pos.order.line',
        executedQueries,
        toolNumbers: [],
        allowedEntityNames: [],
        deterministicReply: buildFeryalNoOdooDataSuggestion('pos_no_data'),
        structuredFacts: {},
      }
    }

    const topBrand = brandRows[0]
    const toolNumbers: number[] = [
      targetBrand.rawNetKwd,
      targetBrand.netKwd,
      targetBrand.rawQty,
      targetBrand.qtyInt,
      targetBrand.linesInt,
      targetBrand.sharePct1,
      scopeNetRaw,
      scopeNet1,
      topBrand.rawNetKwd,
      topBrand.netKwd,
    ]

    const reply = [
      `• الرقم: وفق موديل pos.order.line في Odoo للفترة ${period.periodLabelAr} (${scopeLabelAr})، سجلت علامة ${targetBrand.nameAr} صافي مبيعات ${formatKwd1(targetBrand.netKwd)} د.ك عبر ${formatIntCount(targetBrand.qtyInt)} وحدة مباعة بحصة ${formatKwd1(targetBrand.sharePct1)}% من صافي المبيعات البالغ ${formatKwd1(scopeNet1)} د.ك.`,
      `• السبب من البيانات: حققت علامة ${targetBrand.nameAr} قيمة ${formatKwd1(targetBrand.netKwd)} د.ك من ${formatIntCount(targetBrand.linesInt)} سطور بيع مرحلة خلال الفترة.`,
      `• الإجراء المحدد: يراجع مدير العلامة ومدير العمليات اليوم أداء أصناف ${targetBrand.nameAr} وتوافرها على شاشات نقاط البيع ومنصات التوصيل.`,
      `• الأثر المتوقع (تقدير): تقدير — رفع توافر واقتراحات أصناف ${targetBrand.nameAr} يعزز مساهمتها فوق مستوى ${formatKwd1(targetBrand.netKwd)} د.ك المسجل حالياً.`,
    ].join('\n')

    return {
      hasData: true,
      primaryModel: 'pos.order.line',
      executedQueries,
      toolNumbers,
      allowedEntityNames,
      deterministicReply: reply,
      structuredFacts: {
        model: 'pos.order.line',
        period: { from: period.from, to: period.to },
        scope: scopeLabelAr,
        brand: targetBrand,
        scopeNetKwd: scopeNet1,
      },
    }
  }

  if (brandsTotal1 <= 0) {
    return {
      hasData: false,
      noDataReasonKey: 'pos_no_data',
      primaryModel: 'pos.order.line',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('pos_no_data'),
      structuredFacts: {},
    }
  }

  const toolNumbers: number[] = [
    brandRows.length,
    rawBrandsTotal,
    brandsTotal1,
    scopeNetRaw,
    scopeNet1,
    Math.round(cube.totals.orders),
  ]
  for (const r of brandRows) {
    toolNumbers.push(r.rawNetKwd, r.netKwd, r.rawQty, r.qtyInt, r.linesInt, r.sharePct1)
  }

  const brandListText = brandRows
    .map((r) => `${r.nameAr} ${formatKwd1(r.netKwd)} د.ك (${formatKwd1(r.sharePct1)}%)`)
    .join('، ')

  const topBrand = brandRows[0]
  const secondBrand = brandRows[1]
  const lowestBrand = brandRows[brandRows.length - 1]

  const reply = [
    `• الرقم: وفق موديل pos.order.line في Odoo للفترة ${period.periodLabelAr} (${scopeLabelAr})، توزعت مبيعات العلامات التجارية الـ ${formatIntCount(brandRows.length)} كالتالي: ${brandListText}، بإجمالي مبيعات منسوبة للعلامات ${formatKwd1(brandsTotal1)} د.ك من صافي مبيعات ${formatKwd1(scopeNet1)} د.ك.`,
    `• السبب من البيانات: تصدرت علامة ${topBrand.nameAr} بقيمة ${formatKwd1(topBrand.netKwd)} د.ك (${formatKwd1(topBrand.sharePct1)}%) تلتها ${secondBrand.nameAr} بقيمة ${formatKwd1(secondBrand.netKwd)} د.ك بينما سجلت ${lowestBrand.nameAr} قيمة ${formatKwd1(lowestBrand.netKwd)} د.ك.`,
    `• الإجراء المحدد: يوجه مدير العمليات وفريق التسويق اليوم بمراجعة ظهور وقوائم علامة ${lowestBrand.nameAr} في الفروع ومنصات التوصيل مع تأمين مخزون العلامة المتصدرة ${topBrand.nameAr}.`,
    `• الأثر المتوقع (تقدير): تقدير — تنشيط مبيعات ${lowestBrand.nameAr} فوق ${formatKwd1(lowestBrand.netKwd)} د.ك يرفع إجمالي مبيعات العلامات البالغ حالياً ${formatKwd1(brandsTotal1)} د.ك.`,
  ].join('\n')

  return {
    hasData: true,
    primaryModel: 'pos.order.line',
    executedQueries,
    toolNumbers,
    allowedEntityNames,
    deterministicReply: reply,
    structuredFacts: {
      model: 'pos.order.line',
      period: { from: period.from, to: period.to },
      scope: scopeLabelAr,
      brandsTotalKwd: brandsTotal1,
      scopeNetKwd: scopeNet1,
      brands: brandRows,
    },
  }
}

async function runHrEmployeesTool(params: {
  dataSource: FeryalOdooDataSource
  period: { from: string; to: string; periodLabelAr: string }
  referenceNowMs?: number
}): Promise<ToolExecutionOutput> {
  const { dataSource, period, referenceNowMs } = params
  const hr = dataSource.fetchHrEmployees ? await dataSource.fetchHrEmployees(referenceNowMs) : null

  const domain: unknown[] = [['active', '=', true]]
  if (hr?.odooCompanyId) {
    domain.push(['company_id', '=', hr.odooCompanyId])
  }
  withCentralExclusion(domain, 'name')

  const executedQueries: FeryalExecutedOdooQuery[] = [
    {
      model: 'hr.employee',
      method: 'search_read',
      domain,
      groupby: ['department_id', 'work_location_id'],
      period: { from: period.from, to: period.to },
    },
  ]

  if (!hr || !hr.connected || !hr.accessGranted) {
    return {
      hasData: false,
      noDataReasonKey: 'hr_employees_no_access',
      primaryModel: 'hr.employee',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('hr_employees_no_access'),
      structuredFacts: {},
    }
  }

  if (hr.noData || hr.totals.activeEmployeesCount <= 0) {
    return {
      hasData: false,
      noDataReasonKey: 'hr_employees_no_data',
      primaryModel: 'hr.employee',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('hr_employees_no_data'),
      structuredFacts: {},
    }
  }

  const activeCountInt = Math.round(hr.totals.activeEmployeesCount)
  const deptsCountInt = Math.round(hr.totals.departmentsCount)
  const locsCountInt = Math.round(hr.totals.workLocationsCount)
  const topDepts = hr.byDepartment.slice(0, 5)

  const toolNumbers: number[] = [activeCountInt, deptsCountInt, locsCountInt, topDepts.length]
  const allowedEntityNames: string[] = []

  const deptText = topDepts
    .map((d) => {
      const c = Math.round(d.employeesCount)
      toolNumbers.push(c)
      allowedEntityNames.push(d.departmentName)
      return `${d.departmentName} (${formatIntCount(c)} موظف)`
    })
    .join('، ')

  for (const loc of hr.byWorkLocation.slice(0, 5)) {
    toolNumbers.push(Math.round(loc.employeesCount))
    allowedEntityNames.push(loc.locationName)
  }

  const topDept = topDepts[0]
  const topDeptCountInt = topDept ? Math.round(topDept.employeesCount) : activeCountInt
  const topDeptName = topDept ? topDept.departmentName : 'بدون قسم محدد'
  allowedEntityNames.push(topDeptName)

  const reply = [
    `• الرقم: وفق موديل hr.employee في Odoo، يبلغ إجمالي الموظفين النشطين ${formatIntCount(activeCountInt)} موظف موزعين على ${formatIntCount(deptsCountInt)} أقسام معرفة و${formatIntCount(locsCountInt)} مواقع عمل، وأبرز الأقسام: ${deptText}.`,
    `• السبب من البيانات: يتركز أكبر عدد ضمن ${topDeptName} بواقع ${formatIntCount(topDeptCountInt)} موظف من إجمالي الكادر المسجل والبالغ ${formatIntCount(activeCountInt)} موظف.`,
    `• الإجراء المحدد: يراجع مدير الموارد البشرية اليوم اكتمال ربط جميع سجلات hr.employee بالأقسام الفعلية ومواقع الفروع المعتمدة داخل Odoo.`,
    `• الأثر المتوقع (تقدير): تقدير — توحيد تسكين الموظفين البالغ عددهم ${formatIntCount(activeCountInt)} موظف يرفع دقة توزيع القوى العاملة وتقارير الفروع.`,
  ].join('\n')

  return {
    hasData: true,
    primaryModel: 'hr.employee',
    executedQueries,
    toolNumbers,
    allowedEntityNames,
    deterministicReply: reply,
    structuredFacts: {
      model: 'hr.employee',
      totals: hr.totals,
      topDepartments: topDepts,
      topWorkLocations: hr.byWorkLocation.slice(0, 5),
    },
  }
}

// ============================================================================
// SERVER-SIDE AUDIT LOG PERSISTENCE (`vf_feryal_chat_audit_log` + tmp + memory)
// ============================================================================

const AUDIT_TMP_PATH = path.join(os.tmpdir(), 'vf-feryal-chat-audit-log-v1.json')
const MAX_AUDIT_ENTRIES = 250

let auditSeqCounter = 0
function nextAuditEntryId(nowMs = Date.now()): string {
  auditSeqCounter = (auditSeqCounter + 1) % 1_000_000
  return `feryal-audit-${nowMs}-${auditSeqCounter}`
}

const globalForFeryalAudit = globalThis as unknown as {
  __vfFeryalAuditEntries?: FeryalAuditLogEntry[]
  __vfFeryalAuditPgPool?: Pool | null
  __vfFeryalAuditPgHealthy?: boolean
  __vfFeryalAuditPgCheckedAt?: number
}

function readLocalAuditCache(): FeryalAuditLogEntry[] {
  if (Array.isArray(globalForFeryalAudit.__vfFeryalAuditEntries)) {
    return globalForFeryalAudit.__vfFeryalAuditEntries
  }
  try {
    if (existsSync(AUDIT_TMP_PATH)) {
      const parsed = JSON.parse(readFileSync(AUDIT_TMP_PATH, 'utf8')) as unknown
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(
          (item): item is FeryalAuditLogEntry =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as FeryalAuditLogEntry).id === 'string' &&
            typeof (item as FeryalAuditLogEntry).question === 'string',
        )
        globalForFeryalAudit.__vfFeryalAuditEntries = valid.slice(0, MAX_AUDIT_ENTRIES)
        return globalForFeryalAudit.__vfFeryalAuditEntries
      }
    }
  } catch {
    // ignore fs read errors on read-only containers
  }
  globalForFeryalAudit.__vfFeryalAuditEntries = []
  return globalForFeryalAudit.__vfFeryalAuditEntries
}

function writeLocalAuditCache(entries: FeryalAuditLogEntry[]): void {
  const capped = entries.slice(0, MAX_AUDIT_ENTRIES)
  globalForFeryalAudit.__vfFeryalAuditEntries = capped
  try {
    writeFileSync(AUDIT_TMP_PATH, JSON.stringify(capped), 'utf8')
  } catch {
    // ignore fs write errors on read-only containers
  }
}

function getAuditPgPool(): Pool | null {
  const dbUrl = (process.env.DATABASE_URL ?? '').trim()
  if (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://')) {
    return null
  }
  if (
    globalForFeryalAudit.__vfFeryalAuditPgHealthy === false &&
    globalForFeryalAudit.__vfFeryalAuditPgCheckedAt &&
    Date.now() - globalForFeryalAudit.__vfFeryalAuditPgCheckedAt < 30_000
  ) {
    return null
  }
  if (globalForFeryalAudit.__vfFeryalAuditPgPool) {
    return globalForFeryalAudit.__vfFeryalAuditPgPool
  }
  try {
    const rawSsl = (process.env.DATABASE_SSL ?? 'require').trim()
    const sslMode: 'require' | 'verify' | 'disable' =
      rawSsl === 'disable' || rawSsl === 'verify' ? rawSsl : 'require'
    const ssl = sslOptions(sslMode, process.env.DATABASE_SSL_CA)
    const pool = new Pool({
      connectionString: dbUrl,
      ssl,
      max: 2,
      connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 10_000,
    })
    pool.on('error', () => {
      globalForFeryalAudit.__vfFeryalAuditPgHealthy = false
      globalForFeryalAudit.__vfFeryalAuditPgCheckedAt = Date.now()
    })
    globalForFeryalAudit.__vfFeryalAuditPgPool = pool
    return pool
  } catch {
    globalForFeryalAudit.__vfFeryalAuditPgHealthy = false
    globalForFeryalAudit.__vfFeryalAuditPgCheckedAt = Date.now()
    return null
  }
}

export async function recordFeryalAuditEntry(entry: FeryalAuditLogEntry): Promise<void> {
  const existing = readLocalAuditCache()
  writeLocalAuditCache([entry, ...existing])

  const pgPool = getAuditPgPool()
  if (pgPool) {
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS vf_feryal_chat_audit_log (
          id TEXT PRIMARY KEY,
          timestamp_iso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          user_sub TEXT NOT NULL,
          user_role TEXT NOT NULL,
          question TEXT NOT NULL,
          status TEXT NOT NULL,
          executed_queries JSONB NOT NULL,
          verifier JSONB NOT NULL,
          final_reply TEXT NOT NULL
        )
      `)
      await pgPool.query(
        `INSERT INTO vf_feryal_chat_audit_log
          (id, timestamp_iso, user_sub, user_role, question, status, executed_queries, verifier, final_reply)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          entry.id,
          entry.timestampIso,
          entry.userSub,
          entry.userRole,
          entry.question,
          entry.status,
          JSON.stringify(entry.executedQueries),
          JSON.stringify(entry.verifier),
          entry.finalReply,
        ],
      )
      globalForFeryalAudit.__vfFeryalAuditPgHealthy = true
      globalForFeryalAudit.__vfFeryalAuditPgCheckedAt = Date.now()
      return
    } catch {
      globalForFeryalAudit.__vfFeryalAuditPgHealthy = false
      globalForFeryalAudit.__vfFeryalAuditPgCheckedAt = Date.now()
    }
  }

  if (process.env.VERCEL || process.env.VF_GOVERNANCE_PRISMA === '1') {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS vf_feryal_chat_audit_log (
          id TEXT PRIMARY KEY,
          timestamp_iso TEXT NOT NULL,
          user_sub TEXT NOT NULL,
          user_role TEXT NOT NULL,
          question TEXT NOT NULL,
          status TEXT NOT NULL,
          executed_queries TEXT NOT NULL,
          verifier TEXT NOT NULL,
          final_reply TEXT NOT NULL
        )
      `)
      await prisma.$executeRawUnsafe(
        `INSERT OR IGNORE INTO vf_feryal_chat_audit_log
          (id, timestamp_iso, user_sub, user_role, question, status, executed_queries, verifier, final_reply)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        entry.id,
        entry.timestampIso,
        entry.userSub,
        entry.userRole,
        entry.question,
        entry.status,
        JSON.stringify(entry.executedQueries),
        JSON.stringify(entry.verifier),
        entry.finalReply,
      )
    } catch {
      // Local tmp/memory cache already updated
    }
  }
}

export async function listFeryalAuditEntries(limit = 50): Promise<FeryalAuditLogEntry[]> {
  const safeLimit = Math.max(1, Math.min(200, Math.round(limit)))
  const pgPool = getAuditPgPool()
  if (pgPool) {
    try {
      const res = await pgPool.query<{
        id: string
        timestamp_iso: string | Date
        user_sub: string
        user_role: string
        question: string
        status: FeryalReplyStatus
        executed_queries: FeryalExecutedOdooQuery[]
        verifier: FeryalNumericVerificationResult
        final_reply: string
      }>(
        `SELECT id, timestamp_iso, user_sub, user_role, question, status, executed_queries, verifier, final_reply
         FROM vf_feryal_chat_audit_log
         ORDER BY timestamp_iso DESC
         LIMIT $1`,
        [safeLimit],
      )
      if (res.rows.length > 0) {
        return res.rows.map((r) => ({
          id: r.id,
          timestampIso:
            r.timestamp_iso instanceof Date
              ? r.timestamp_iso.toISOString()
              : String(r.timestamp_iso),
          userSub: r.user_sub,
          userRole: r.user_role,
          question: r.question,
          status: r.status,
          executedQueries: Array.isArray(r.executed_queries) ? r.executed_queries : [],
          verifier: r.verifier ?? { valid: true, extractedNumbers: [], unverifiedNumbers: [] },
          finalReply: r.final_reply,
        }))
      }
    } catch {
      globalForFeryalAudit.__vfFeryalAuditPgHealthy = false
      globalForFeryalAudit.__vfFeryalAuditPgCheckedAt = Date.now()
    }
  }

  return readLocalAuditCache().slice(0, safeLimit)
}

export function resetFeryalAuditCache(): void {
  globalForFeryalAudit.__vfFeryalAuditEntries = []
  try {
    if (existsSync(AUDIT_TMP_PATH)) {
      writeFileSync(AUDIT_TMP_PATH, '[]', 'utf8')
    }
  } catch {
    // ignore fs errors
  }
}

// ============================================================================
// PACK-GROUNDED HELPERS & HANDLERS (PART 5)
// ============================================================================

const padHour2 = (h: number): string => String(Math.max(0, Math.min(23, Math.round(h)))).padStart(2, '0')

const CHANNEL_META_BY_ID = new Map<ApprovedFeryalChannelId, FeryalChannelMeta>(
  APPROVED_FERYAL_CHANNEL_LIST.map((c) => [c.id, c]),
)

function channelDisplayNameAr(channelId: string): string {
  const meta = CHANNEL_META_BY_ID.get(channelId as ApprovedFeryalChannelId)
  return meta ? meta.nameAr : channelId
}

function collectPackAllowedEntityNames(pack: FeryalContextPack, extra: readonly string[] = []): string[] {
  const names = new Set<string>([
    'Odoo 17',
    'Odoo17',
    UNATTRIBUTED_BRANCH_LABEL_AR,
    'بوثات المعارض',
    'مقاصف المدارس',
    'طلبات (TGO + TMP)',
    'TGO + TMP',
    'TGO',
    'TMP',
    'pos.order',
    'pos.order.line',
    'pos.payment',
    'account.move.line',
    'purchase.order',
    'stock.move',
    'stock.scrap',
    'stock.quant',
    'hr.employee',
    'hr.payslip',
    'hr.attendance',
    'mrp.bom',
    'pos_preparation_display',
    'crossovered.budget',
    RUN_RATE_PROJECTION_LABEL_AR,
    ...extra,
  ])

  for (const b of ALL_FERYAL_BRANCHES) {
    names.add(b.nameAr)
    names.add(b.nameEn)
    names.add(b.id)
    for (const alias of b.aliases) {
      if (!/^\d+$/.test(alias.trim()) && alias.trim().length >= 3) {
        names.add(alias)
      }
    }
  }
  for (const br of APPROVED_FERYAL_BRAND_LIST) {
    names.add(br.nameAr)
    names.add(br.nameEn)
    names.add(br.id)
  }
  for (const ch of APPROVED_FERYAL_CHANNEL_LIST) {
    names.add(ch.nameAr)
    names.add(ch.nameEn)
    names.add(ch.id)
  }
  if (pack.branches.status === 'ok' && pack.branches.data) {
    for (const item of pack.branches.data.items) {
      if (!isExcludedOdooEntity(item.nameAr)) names.add(item.nameAr)
      if (!isExcludedOdooEntity(item.nameEn)) names.add(item.nameEn)
    }
  }
  if (pack.topProducts.status === 'ok' && pack.topProducts.data) {
    for (const item of pack.topProducts.data.items) {
      if (item.name && !isExcludedOdooEntity(item.name)) names.add(item.name)
    }
  }
  if (pack.purchases.status === 'ok' && pack.purchases.data?.topVendors) {
    for (const v of pack.purchases.data.topVendors) {
      if (v.name && !isExcludedOdooEntity(v.name)) names.add(v.name)
    }
  }

  return [...names].filter((s) => s.trim().length >= 3)
}

function collectPackAllowedDateStrings(pack: FeryalContextPack): string[] {
  const dates = new Set<string>([
    ...buildAllowedDateStrings(pack.period.from, pack.period.to),
    ...buildAllowedDateStrings(pack.previousPeriod.from, pack.previousPeriod.to),
  ])
  if (pack.gl.data?.glClosedThroughDate) {
    for (const d of buildAllowedDateStrings(
      pack.gl.data.glClosedThroughDate,
      pack.gl.data.glClosedThroughDate,
    )) {
      dates.add(d)
    }
  }
  return [...dates]
}

function pushNumberWithRounded(target: number[], value: number | null | undefined): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) return
  target.push(value, round1(value), Math.round(value))
  if (value < 0) {
    const absVal = Math.abs(value)
    target.push(absVal, round1(absVal), Math.round(absVal))
  }
}

function collectPackToolNumbers(pack: FeryalContextPack, extra: readonly number[] = []): number[] {
  const out: number[] = []
  const sectionMap = collectPackSectionNumbers(pack)
  for (const set of sectionMap.values()) {
    for (const v of set) {
      pushNumberWithRounded(out, v)
    }
  }

  if (pack.hourly.status === 'ok' && pack.hourly.data) {
    const { peakHour, weakestHours } = pack.hourly.data
    if (peakHour) {
      out.push(peakHour.hour, 0)
      pushNumberWithRounded(out, peakHour.orders)
      pushNumberWithRounded(out, peakHour.netKwd)
    }
    for (const w of weakestHours) {
      out.push(w.hour, 0)
      pushNumberWithRounded(out, w.orders)
      pushNumberWithRounded(out, w.netKwd)
    }
  }

  if (pack.channels.status === 'ok' && pack.channels.data) {
    const tgo = pack.channels.data.company.find((c) => c.channelId === 'talabat-tgo')
    const tmp = pack.channels.data.company.find((c) => c.channelId === 'talabat-tmp')
    if (tgo || tmp) {
      const talabatNet = (tgo?.netKwd ?? 0) + (tmp?.netKwd ?? 0)
      const talabatPayments = (tgo?.payments ?? 0) + (tmp?.payments ?? 0)
      pushNumberWithRounded(out, talabatNet)
      pushNumberWithRounded(out, talabatPayments)
      const denom =
        pack.companyTotals.status === 'ok' &&
        pack.companyTotals.data &&
        pack.companyTotals.data.netSalesKwd > 0
          ? pack.companyTotals.data.netSalesKwd
          : 0
      if (denom > 0) {
        pushNumberWithRounded(out, (talabatNet / denom) * 100)
      }
    }
  }

  if (pack.deltas.status === 'ok' && pack.deltas.data) {
    const d = pack.deltas.data
    const ordersDiff = d.currentOrders - d.previousOrders
    pushNumberWithRounded(out, ordersDiff)
  }

  for (const n of extra) {
    pushNumberWithRounded(out, n)
  }

  return out
}

function buildPackStructuredFacts(pack: FeryalContextPack): Record<string, unknown> {
  const branches =
    pack.branches.status === 'ok' && pack.branches.data
      ? pack.branches.data.items.map((item) => ({
          id: item.branchId,
          nameAr: item.nameAr,
          netKwd: round1(item.netKwd),
          orders: item.orders,
        }))
      : []

  return {
    model: 'pos.order',
    period: { from: pack.period.from, to: pack.period.to },
    ...(pack.companyTotals.status === 'ok' && pack.companyTotals.data
      ? {
          totalNetKwd: round1(pack.companyTotals.data.netSalesKwd),
          totalOrders: pack.companyTotals.data.orders,
        }
      : {}),
    ...(branches.length > 0 ? { branches } : {}),
  }
}

function summarizeHistoryContextForGreeting(history: readonly FeryalChatHistoryTurn[]): {
  hasHistory: boolean
  topicHintAr: string | null
} {
  if (history.length === 0) {
    return { hasHistory: false, topicHintAr: null }
  }
  const recentCombined = history
    .slice(-4)
    .map((h) => h.text)
    .join(' ')

  const branchDet = detectTargetBranchFromQuestion(recentCombined)
  if (branchDet.branchId) {
    const branchMeta = BRANCH_META_BY_ID.get(branchDet.branchId)
    if (branchMeta) {
      return { hasHistory: true, topicHintAr: branchMeta.nameAr }
    }
  }
  const brandDet = detectTargetBrandFromQuestion(recentCombined)
  if (brandDet.brandId) {
    const meta = APPROVED_FERYAL_BRAND_LIST.find((b) => b.id === brandDet.brandId)
    if (meta) return { hasHistory: true, topicHintAr: `علامة ${meta.nameAr}` }
  }
  const chanDet = detectTargetChannelFromQuestion(recentCombined)
  if (chanDet.channelId) {
    return { hasHistory: true, topicHintAr: `قناة ${channelDisplayNameAr(chanDet.channelId)}` }
  }

  const lastUserTurn = [...history].reverse().find((h) => h.role === 'user')
  if (lastUserTurn) {
    const cleanedTopic = normalizeDigits(lastUserTurn.text)
      .replace(/\d[\d,.]*/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60)
      .trim()
    if (cleanedTopic && !isExcludedOdooEntity(cleanedTopic)) {
      return { hasHistory: true, topicHintAr: cleanedTopic }
    }
  }
  return { hasHistory: true, topicHintAr: null }
}

function buildSmallTalkPackOutcome(params: {
  rawQuestion: string
  history: readonly FeryalChatHistoryTurn[]
  pack: FeryalContextPack
}): ToolExecutionOutput {
  const { rawQuestion, history, pack } = params
  const normAr = normalizeArabicText(rawQuestion)
  const { hasHistory, topicHintAr } = summarizeHistoryContextForGreeting(history)

  const asksOldChats =
    /(محادثات قديم|محادثه قديم|تاريخ المحادثات|تتذكر|تذكر|\bhistory\b|\bprevious chats?\b|\bold chats?\b)/i.test(
      normAr,
    )
  const asksUnderstood =
    /(فهمت|فاهمه|شو فهمت|ايش فهمت|\bunderstand\b)/i.test(normAr)

  let openingLine: string
  if (hasHistory) {
    openingLine = topicHintAr
      ? `أهلاً بك! نعم أتابع سياق محادثتنا الأخيرة حول «${topicHintAr}» وأبني عليها مباشرة.`
      : 'أهلاً بك! نعم أتذكر آخر رسائل محادثتنا الحالية وأتابع معك من نفس السياق.'
  } else if (asksOldChats) {
    openingLine =
      'أهلاً بك! أتابع سياق الرسائل المرسلة ضمن هذه الجلسة مباشرة، ولا يتوفر أرشيف محادثات قديمة منفصل إذا لم تُرسل رسائل سابقة في الجلسة.'
  } else if (asksUnderstood) {
    openingLine =
      'أهلاً بك! أنا جاهزة معك لقراءة بيانات فنتشر فودز مباشرة — في سؤالك الحالي لم يُحدد مؤشر أو فرع بعد، أخبريني بما ترغبين بمراجعته.'
  } else {
    openingLine =
      'أهلاً بك! أنا فريال، المديرة التنفيذية لفنتشر فودز، وجاهزة نراجع أداء الشركة معاً.'
  }

  const extraNumbers: number[] = []
  const snapshotLines: string[] = []
  if (
    pack.connected &&
    pack.companyTotals.status === 'ok' &&
    pack.companyTotals.data &&
    pack.companyTotals.data.netSalesKwd > 0
  ) {
    const net1 = round1(pack.companyTotals.data.netSalesKwd)
    const ordersInt = Math.round(pack.companyTotals.data.orders)
    extraNumbers.push(pack.companyTotals.data.netSalesKwd, net1, ordersInt)
    snapshotLines.push(
      `• نبضة الفترة الحالية (${pack.period.from} → ${pack.period.to}): صافي المبيعات ${formatKwd1(net1)} د.ك عبر ${formatIntCount(ordersInt)} طلبات.`,
    )
  }

  const offersBlock = [
    '• تحليلات جاهزة يمكنني تنفيذها لكِ الآن:',
    '- أداء الفروع السبعة وبوثات المعارض ومقاصف المدارس ومقارنة الفترات.',
    '- طلبات TGO وTMP ومنصات التوصيل (كيتا، ديليفيرو، جاهز، سنونو).',
    '- ساعات الذروة والمبيعات بالساعة وأعلى الأصناف والعلامات الست.',
  ].join('\n')

  const reply = [openingLine, ...snapshotLines, offersBlock].join('\n\n')

  return {
    hasData: true,
    primaryModel: 'pos.order',
    executedQueries: [],
    toolNumbers: collectPackToolNumbers(pack, extraNumbers),
    allowedEntityNames: collectPackAllowedEntityNames(pack),
    deterministicReply: reply,
    structuredFacts: buildPackStructuredFacts(pack),
    skipFourPartStructure: true,
    skipSourceFooter: !pack.connected,
  }
}

function buildQurainCentralKitchenOutcome(params: {
  pack: FeryalContextPack
  warehouse: OdooLiveWarehouseChainPayload | null
  period: { from: string; to: string }
  missingMetrics: readonly string[]
}): ToolExecutionOutput {
  const { pack, warehouse, period, missingMetrics: initialMissing } = params
  const hasWarehouse = Boolean(warehouse && warehouse.connected && !warehouse.noData)
  const hasPackStock = pack.stock.status === 'ok' && Boolean(pack.stock.data)

  if (!pack.connected && !hasWarehouse && !hasPackStock) {
    return {
      hasData: false,
      noDataReasonKey: 'stock_no_data',
      primaryModel: 'stock.move',
      executedQueries: [],
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('stock_no_data'),
      structuredFacts: {},
      missingMetrics: [...initialMissing],
    }
  }

  const missingList = [
    ...new Set([
      ...initialMissing,
      'مبيعات نقاط البيع للمطبخ المركزي (القرين) غير متاحة في Odoo (المطبخ المركزي ليس منفذ بيع POS)',
    ]),
  ]

  const extraNumbers: number[] = []
  const executedQueries: FeryalExecutedOdooQuery[] = []
  const dataLines: string[] = [
    'المطبخ المركزي (القرين) ليس منفذ بيع POS — لا توجد له مبيعات نقاط بيع في المكعب.',
  ]

  if (hasWarehouse && warehouse) {
    const movesInt = Math.round(warehouse.totals.doneMovesCount)
    const scrapsInt = Math.round(warehouse.totals.scrapOrdersCount)
    const transfer1 = round1(warehouse.totals.ckToBranchTransferKwd)
    const inbound1 = round1(warehouse.totals.inboundSupplierKwd)
    const scrap1 = round1(warehouse.totals.scrapKwd)
    extraNumbers.push(
      movesInt,
      scrapsInt,
      warehouse.totals.ckToBranchTransferKwd,
      transfer1,
      warehouse.totals.inboundSupplierKwd,
      inbound1,
      warehouse.totals.scrapKwd,
      scrap1,
    )
    executedQueries.push(
      {
        model: 'stock.move',
        method: 'read_group',
        domain: [['state', '=', 'done']],
        groupby: ['product_id', 'location_id', 'location_dest_id'],
        period,
      },
      {
        model: 'stock.scrap',
        method: 'search_read',
        domain: [['state', '=', 'done']],
        groupby: ['product_id', 'location_id'],
        period,
      },
    )
    dataLines.push(
      `- نشاط المخازن والتحويلات للفترة (${period.from} → ${period.to}): ${formatIntCount(movesInt)} حركة مخزنية مكتملة في stock.move بقيمة تحويلات للفروع ${formatKwd1(transfer1)} د.ك وتوريد مستلم ${formatKwd1(inbound1)} د.ك، مقابل ${formatIntCount(scrapsInt)} أوامر إتلاف في stock.scrap بقيمة ${formatKwd1(scrap1)} د.ك.`,
    )
  } else if (hasPackStock && pack.stock.data) {
    const transfers = Math.round(pack.stock.data.transferCount)
    const scraps = Math.round(pack.stock.data.scrapCount)
    extraNumbers.push(transfers, scraps)
    const scrapQtySegment =
      pack.stock.data.scrapQty !== undefined
        ? ` بكمية ${formatKwd1(round1(pack.stock.data.scrapQty))} وحدة`
        : ''
    if (pack.stock.data.scrapQty !== undefined) {
      extraNumbers.push(pack.stock.data.scrapQty, round1(pack.stock.data.scrapQty))
    }
    executedQueries.push(
      {
        model: 'stock.move',
        method: 'read_group',
        domain: [['state', '=', 'done']],
        groupby: ['product_id'],
        period,
      },
      {
        model: 'stock.scrap',
        method: 'search_read',
        domain: [['state', '=', 'done']],
        groupby: ['product_id'],
        period,
      },
    )
    dataLines.push(
      `- حركات المخزن للفترة (${period.from} → ${period.to}): ${formatIntCount(transfers)} حركة تحويل مخزني مكتملة في stock.move و${formatIntCount(scraps)} أوامر إتلاف في stock.scrap${scrapQtySegment}.`,
    )
  } else {
    missingList.push('حركات المخزن التفصيلية (stock.move / stock.scrap) غير متاحة لهذه الفترة في Odoo')
  }

  if (pack.companyTotals.status === 'ok' && pack.companyTotals.data) {
    const companyNet1 = round1(pack.companyTotals.data.netSalesKwd)
    const companyOrdersInt = Math.round(pack.companyTotals.data.orders)
    extraNumbers.push(pack.companyTotals.data.netSalesKwd, companyNet1, companyOrdersInt)
    dataLines.push(
      `- سياق الشركة (POS المعتمدة): صافي مبيعات الفروع والمنافذ المعتمدة ${formatKwd1(companyNet1)} د.ك عبر ${formatIntCount(companyOrdersInt)} طلبات.`,
    )
  }

  const reply = [
    `• قيود تغطية البيانات:\n${formatMissingMetricsBulletLines(missingList)}`,
    `• التحليل والأرقام المتاحة من Odoo:\n${dataLines.join('\n')}`,
    '• الاستنتاج:\n- استنتاج: دور المطبخ المركزي تشغيلي وإنتاجي لتغذية الفروع، لذا يظهر أثره في تحويلات stock.move ومشتريات التوريد والهدر لا في فواتير نقاط البيع.',
    [
      '• التوصيات:',
      '- اقتراح (مدير المطبخ المركزي وأمين المخزن): مطابقة تحويلات stock.move الصادرة يومياً مع سندات الاستلام في الفروع السبعة.',
      '- اقتراح (مشرف الجودة): مراجعة أسباب أوامر الإتلاف في stock.scrap لتقليص الهدر قبل التحويل للفروع.',
    ].join('\n'),
  ].join('\n\n')

  return {
    hasData: true,
    primaryModel: 'stock.move',
    executedQueries,
    toolNumbers: collectPackToolNumbers(pack, extraNumbers),
    allowedEntityNames: collectPackAllowedEntityNames(pack),
    deterministicReply: reply,
    structuredFacts: buildPackStructuredFacts(pack),
    skipFourPartStructure: true,
    missingMetrics: missingList,
  }
}

function buildForecastPackOutcome(params: {
  pack: FeryalContextPack
  missingMetrics: readonly string[]
}): ToolExecutionOutput {
  const { pack, missingMetrics: initialMissing } = params
  if (!pack.connected || pack.companyTotals.status !== 'ok' || !pack.companyTotals.data) {
    return {
      hasData: false,
      noDataReasonKey: 'pos_no_data',
      primaryModel: 'pos.order',
      executedQueries: [],
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('pos_no_data'),
      structuredFacts: {},
      missingMetrics: [...initialMissing],
    }
  }

  const missingList = [
    ...new Set([
      ...initialMissing,
      'الموازنات التقديرية ومستهدفات المبيعات الرسمية (crossovered.budget) غير متاحة في Odoo',
    ]),
  ]

  const actualToDateKwd = pack.companyTotals.data.netSalesKwd
  const actual1 = round1(actualToDateKwd)
  const ordersInt = Math.round(pack.companyTotals.data.orders)
  const elapsedDays = pack.elapsedDaysInMonth
  const totalDaysInMonth = pack.totalDaysInMonth
  const projection = computeRunRateProjection({
    actualToDateKwd,
    elapsedDays,
    totalDaysInMonth,
  })

  const extraNumbers: number[] = [
    actualToDateKwd,
    actual1,
    ordersInt,
    elapsedDays,
    totalDaysInMonth,
    projection.projectedKwd,
    round1(projection.projectedKwd),
  ]

  const lines: string[] = [
    `- المبيعات الفعلية المسجلة في Odoo (${pack.period.from} → ${pack.period.to}): ${formatKwd1(actual1)} د.ك عبر ${formatIntCount(ordersInt)} طلبات.`,
    `- التوقع بنهاية الشهر (${RUN_RATE_PROJECTION_LABEL_AR}): ${projection.formulaAr}`,
  ]

  if (pack.branches.status === 'ok' && pack.branches.data && pack.branches.data.items.length > 0) {
    const topBranches = pack.branches.data.items.slice(0, 2)
    for (const b of topBranches) {
      extraNumbers.push(b.netKwd, round1(b.netKwd), b.orders)
    }
    const branchSummary = topBranches
      .map((b) => `${b.nameAr} (${formatKwd1(round1(b.netKwd))} د.ك)`)
      .join(' و')
    lines.push(`- أعلى الفروع مساهمة في الأساس الفعلي: ${branchSummary}.`)
  }

  if (pack.deltas.status === 'ok' && pack.deltas.data && pack.deltas.data.deltaPct !== null) {
    const d = pack.deltas.data
    const absPct1 = round1(Math.abs(d.deltaPct ?? 0))
    const absDelta1 = round1(Math.abs(d.deltaKwd))
    extraNumbers.push(d.deltaKwd, absDelta1, d.deltaPct ?? 0, absPct1)
    if (absDelta1 > 0) {
      const dir = d.deltaKwd > 0 ? 'ارتفاع' : 'تراجع'
      lines.push(
        `- المقارنة مع الفترة السابقة (${pack.previousPeriod.from} → ${pack.previousPeriod.to}): ${dir} بمقدار ${formatKwd1(absDelta1)} د.ك (${formatKwd1(absPct1)}%).`,
      )
    }
  }

  const reply = [
    `• قيود تغطية البيانات:\n${formatMissingMetricsBulletLines(missingList)}`,
    `• ${RUN_RATE_PROJECTION_LABEL_AR}:\n${lines.join('\n')}`,
    `• الاستنتاج:\n- استنتاج: يفترض هذا الإسقاط الخطي ثبات وتيرة المبيعات الفعلية الحالية (${formatKwd1(actual1)} د.ك) حتى نهاية الشهر دون احتساب مواسم أو حملات غير مسجلة في Odoo.`,
    [
      '• التوصيات:',
      '- اقتراح (مدير العمليات ومديرو الفروع): متابعة متوسط السلة وساعات الذروة أسبوعياً لتعويض أي فجوة في الفروع الأقل أداءً.',
      '- اقتراح (المدير المالي): إدخال المستهدف الشهري الرسمي لكل فرع في موديول crossovered.budget داخل Odoo للمقارنة المباشرة.',
    ].join('\n'),
  ].join('\n\n')

  return {
    hasData: true,
    primaryModel: 'pos.order',
    executedQueries: [
      {
        model: 'pos.order',
        method: 'read_group',
        domain: [
          ['date_order', '>=', `${pack.period.from} 00:00:00`],
          ['date_order', '<=', `${pack.period.to} 23:59:59`],
          ['state', 'in', ['paid', 'done', 'invoiced']],
        ],
        groupby: ['session_id'],
        period: { from: pack.period.from, to: pack.period.to },
      },
    ],
    toolNumbers: collectPackToolNumbers(pack, extraNumbers),
    allowedEntityNames: collectPackAllowedEntityNames(pack),
    deterministicReply: reply,
    structuredFacts: buildPackStructuredFacts(pack),
    skipFourPartStructure: true,
    missingMetrics: missingList,
  }
}

function formatMissingMetricsBulletLines(missingList: readonly string[]): string {
  return missingList
    .map((m) => {
      const cleaned = m
        .replace(/\s*غير متاح(?:ة)?\s+(?:لهذه الفترة\s+)?(?:في|من)\s+Odoo(?:\s+حالياً)?/gi, '')
        .replace(/\s*غير متاح(?:ة)?\s+حالياً\s+من\s+Odoo/gi, '')
        .replace(/[:.\s]+$/, '')
        .trim()
      return `- ${cleaned || m}: غير متاح في Odoo.`
    })
    .join('\n')
}

function findHistoryBranchHint(history: readonly FeryalChatHistoryTurn[]): ApprovedFeryalBranchId | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const det = detectTargetBranchFromQuestion(history[i].text)
    if (det.branchId) return det.branchId
  }
  return null
}

function buildPackGroundedOutcome(params: {
  rawQuestion: string
  history: readonly FeryalChatHistoryTurn[]
  pack: FeryalContextPack
  missingMetrics: readonly string[]
  fallbackReasonKey: NoOdooDataReasonKey
  targetBranchId: ApprovedFeryalBranchId | null
  targetChannelId: ApprovedFeryalChannelId | null
  targetBrandId: ApprovedFeryalBrandId | null
  isOvertime: boolean
  isBoothFeasibility: boolean
  isWhyOrDrop: boolean
}): ToolExecutionOutput {
  const {
    rawQuestion,
    history,
    pack,
    missingMetrics,
    fallbackReasonKey,
    targetBranchId,
    targetChannelId,
    targetBrandId,
    isOvertime,
    isBoothFeasibility,
    isWhyOrDrop,
  } = params

  if (!pack.connected) {
    return {
      hasData: false,
      noDataReasonKey: fallbackReasonKey === 'generic' ? 'pos_no_data' : fallbackReasonKey,
      primaryModel: 'pos.order',
      executedQueries: [],
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion(
        fallbackReasonKey === 'generic' ? 'pos_no_data' : fallbackReasonKey,
      ),
      structuredFacts: {},
      missingMetrics: [...missingMetrics],
    }
  }

  const normAr = normalizeArabicText(rawQuestion)
  const wantsHourly =
    isOvertime ||
    /(ساع|ذروه|ذروة|وقت|اوقات|متي|صباح|مساء|ليل|هدوء|ابطا|اضعف ساع|افضل ساع|احسن ساع|تحضير|تجهيز|سائق|\bhour\b|\bpeak\b|\bovertime\b|\bprep\b|\bkds\b|\bdriver)/i.test(
      normAr,
    )
  const wantsChannels =
    isWhyOrDrop ||
    targetChannelId !== null ||
    /(طلبات|توصيل|منص|قناه|قنوات|كيتا|ديليفيرو|جاهز|سنونو|صاله|سفري|تنزل|نزول|انخفاض|تراجع|هبوط|سائق|تسويق|تقييم|اعلان|مشاهير|\btalabat\b|\btgo\b|\btmp\b|\bkeeta\b|\bdeliveroo\b|\bdelivery\b|\bchannel|\bdrop|\bdeclin|\bwhy\b)/i.test(
      normAr,
    )
  const wantsExhibitions =
    isBoothFeasibility ||
    targetBranchId === 'exhibitions' ||
    /(بوث|بوثات|معرض|معارض|exhibitions?|booths?)/i.test(normAr)
  const wantsBrands =
    targetBrandId !== null ||
    /(علامه|علامات|براند|تشاينا|فرانكس|طحينه|فارم براون|نودل|كرك|تسويق|تقييم|اعلان|\bbrand|\broas\b)/i.test(
      normAr,
    )
  const wantsProducts =
    /(صنف|اصناف|منتج|منتجات|طبق|اطباق|وصفه|وصفات|مكونات|خصم|خصومات|تحضير|\bproduct|\bitem|\bbom\b|\brecipe)/i.test(
      normAr,
    )
  const wantsFollowUpSecond = /(التاني|الثاني|ثاني|\bsecond\b|\bnext branch\b)/i.test(normAr)
  const wantsBranches =
    wantsFollowUpSecond ||
    targetBranchId !== null ||
    /(فرع|فروع|الفرع|الفروع|مقارنه|توزيع|\bbranch)/i.test(normAr)
  const wantsHr =
    isOvertime ||
    /(موظف|كادر|بصمه|رواتب|اوفر تايم|اضافي|\bhr\b|\bemployee|\bovertime|\bpayslip)/i.test(normAr)
  const wantsStock =
    /(مخزن|مخزون|تحويل|هدر|تالف|تبريد|ثلاجات|\bstock\b|\bscrap|\biot)/i.test(normAr)

  const hasSpecificTopic =
    wantsHourly ||
    wantsChannels ||
    wantsExhibitions ||
    wantsBrands ||
    wantsProducts ||
    wantsBranches ||
    wantsHr ||
    wantsStock

  const extraNumbers: number[] = []
  const extraEntities: string[] = []
  const analysisLines: string[] = []
  const executedQueries: FeryalExecutedOdooQuery[] = [
    {
      model: 'pos.order',
      method: 'read_group',
      domain: [
        ['date_order', '>=', `${pack.period.from} 00:00:00`],
        ['date_order', '<=', `${pack.period.to} 23:59:59`],
        ['state', 'in', ['paid', 'done', 'invoiced']],
      ],
      groupby: ['session_id'],
      period: { from: pack.period.from, to: pack.period.to },
    },
  ]

  // 1. Company totals baseline
  if (pack.companyTotals.status === 'ok' && pack.companyTotals.data) {
    const ct = pack.companyTotals.data
    const net1 = round1(ct.netSalesKwd)
    const ordersInt = Math.round(ct.orders)
    const aov1 = round1(ct.aovKwd)
    extraNumbers.push(ct.netSalesKwd, net1, ordersInt, ct.aovKwd, aov1)
    analysisLines.push(
      `- إجمالي الشركة للفترة (${pack.period.from} → ${pack.period.to}): صافي ${formatKwd1(net1)} د.ك عبر ${formatIntCount(ordersInt)} طلبات بمتوسط سلة ${formatKwd1(aov1)} د.ك.`,
    )
  }

  // 2. Hourly load (peak hour & weakest hours)
  if ((wantsHourly || !hasSpecificTopic) && pack.hourly.status === 'ok' && pack.hourly.data) {
    const { peakHour, weakestHours } = pack.hourly.data
    if (peakHour) {
      const peakNet1 = round1(peakHour.netKwd)
      const peakOrdersInt = Math.round(peakHour.orders)
      extraNumbers.push(peakHour.hour, 0, peakHour.netKwd, peakNet1, peakOrdersInt)
      analysisLines.push(
        `- ساعة الذروة الأعلى: الساعة ${padHour2(peakHour.hour)}:00 بصافي ${formatKwd1(peakNet1)} د.ك و${formatIntCount(peakOrdersInt)} طلبات.`,
      )
    }
    if (weakestHours.length > 0) {
      const weakDesc = weakestHours
        .map((w) => {
          const wNet1 = round1(w.netKwd)
          const wOrdInt = Math.round(w.orders)
          extraNumbers.push(w.hour, 0, w.netKwd, wNet1, wOrdInt)
          return `الساعة ${padHour2(w.hour)}:00 (${formatKwd1(wNet1)} د.ك — ${formatIntCount(wOrdInt)} طلبات)`
        })
        .join('، ')
      analysisLines.push(`- أهدأ الساعات المسجلة: ${weakDesc}.`)
    }
  } else if (wantsHourly && pack.hourly.status !== 'ok') {
    analysisLines.push('- توزيع المبيعات بالساعة غير متاح في المكعب لهذه الفترة.')
  }

  // 3. Channels (Talabat TGO + TMP, Keeta, etc.) & Period Deltas
  if ((wantsChannels || !hasSpecificTopic) && pack.channels.status === 'ok' && pack.channels.data) {
    const tgo = pack.channels.data.company.find((c) => c.channelId === 'talabat-tgo')
    const tmp = pack.channels.data.company.find((c) => c.channelId === 'talabat-tmp')
    const talabatNet = (tgo?.netKwd ?? 0) + (tmp?.netKwd ?? 0)
    const talabatPayments = (tgo?.payments ?? 0) + (tmp?.payments ?? 0)
    const nonZeroChannels = pack.channels.data.company.filter((c) => c.netKwd > 0 || c.payments > 0)

    if (talabatNet > 0 || talabatPayments > 0 || wantsChannels) {
      const tgoNet1 = round1(tgo?.netKwd ?? 0)
      const tmpNet1 = round1(tmp?.netKwd ?? 0)
      const talabatNet1 = round1(talabatNet)
      const tgoPay = Math.round(tgo?.payments ?? 0)
      const tmpPay = Math.round(tmp?.payments ?? 0)
      const talPay = Math.round(talabatPayments)
      extraNumbers.push(
        tgo?.netKwd ?? 0,
        tgoNet1,
        tgoPay,
        tmp?.netKwd ?? 0,
        tmpNet1,
        tmpPay,
        talabatNet,
        talabatNet1,
        talPay,
      )
      analysisLines.push(
        `- قناة طلبات (TGO + TMP): إجمالي ${formatKwd1(talabatNet1)} د.ك (${formatIntCount(talPay)} دفعات) — موزعة بين طلبات أسطول المنصة (talabat-tgo) بقيمة ${formatKwd1(tgoNet1)} د.ك (${formatIntCount(tgoPay)} دفعات) وطلبات سائقي الشركة (talabat-tmp) بقيمة ${formatKwd1(tmpNet1)} د.ك (${formatIntCount(tmpPay)} دفعات).`,
      )
    }

    const otherChannels = nonZeroChannels
      .filter((c) => c.channelId !== 'talabat-tgo' && c.channelId !== 'talabat-tmp')
      .slice(0, 4)
    if (otherChannels.length > 0) {
      const otherText = otherChannels
        .map((c) => {
          const cNet1 = round1(c.netKwd)
          const cPay = Math.round(c.payments)
          const cShare1 = round1(c.sharePct)
          extraNumbers.push(c.netKwd, cNet1, cPay, c.sharePct, cShare1)
          const noun = AGGREGATOR_CHANNEL_IDS.has(c.channelId as ApprovedFeryalChannelId)
            ? 'دفعات'
            : 'طلبات'
          return `${channelDisplayNameAr(c.channelId)}: ${formatKwd1(cNet1)} د.ك (${formatIntCount(cPay)} ${noun} — ${formatKwd1(cShare1)}%)`
        })
        .join('، ')
      analysisLines.push(`- باقي القنوات النشطة: ${otherText}.`)
    }
  }

  if ((wantsChannels || isWhyOrDrop || !hasSpecificTopic) && pack.deltas.status === 'ok' && pack.deltas.data) {
    const d = pack.deltas.data
    const curNet1 = round1(d.currentNetKwd)
    const prevNet1 = round1(d.previousNetKwd)
    const absDelta1 = round1(Math.abs(d.deltaKwd))
    const absOrdersDelta = Math.abs(d.currentOrders - d.previousOrders)
    extraNumbers.push(
      d.currentNetKwd,
      curNet1,
      d.previousNetKwd,
      prevNet1,
      d.deltaKwd,
      absDelta1,
      d.currentOrders,
      d.previousOrders,
      absOrdersDelta,
    )
    const pctPart =
      d.deltaPct !== null
        ? ` (${formatKwd1(round1(Math.abs(d.deltaPct)))}%)`
        : ''
    if (d.deltaPct !== null) {
      extraNumbers.push(d.deltaPct, round1(Math.abs(d.deltaPct)))
    }
    const dirWord =
      absDelta1 === 0 ? 'ثبات في' : d.deltaKwd > 0 ? 'ارتفاع' : 'انخفاض'
    analysisLines.push(
      `- التغير مقابل الفترة السابقة (${pack.previousPeriod.from} → ${pack.previousPeriod.to}): ${dirWord} المبيعات بمقدار ${formatKwd1(absDelta1)} د.ك${pctPart} من ${formatKwd1(prevNet1)} د.ك (${formatIntCount(d.previousOrders)} طلبات) إلى ${formatKwd1(curNet1)} د.ك (${formatIntCount(d.currentOrders)} طلبات).`,
    )
  }

  // 4. Exhibition Booths & Branches (including follow-up "الفرع التاني")
  if (pack.branches.status === 'ok' && pack.branches.data) {
    const items = pack.branches.data.items
    const exhibitionItem = items.find((b) => b.branchId === 'exhibitions')

    if (wantsExhibitions || (exhibitionItem && (exhibitionItem.netKwd > 0 || exhibitionItem.orders > 0) && !hasSpecificTopic)) {
      if (exhibitionItem) {
        const exNet1 = round1(exhibitionItem.netKwd)
        const exAov1 = round1(exhibitionItem.aovKwd)
        extraNumbers.push(exhibitionItem.netKwd, exNet1, exhibitionItem.orders, exhibitionItem.aovKwd, exAov1)
        analysisLines.push(
          `- بوثات المعارض: صافي ${formatKwd1(exNet1)} د.ك عبر ${formatIntCount(exhibitionItem.orders)} طلبات بمتوسط سلة ${formatKwd1(exAov1)} د.ك.`,
        )
      } else {
        extraNumbers.push(0)
        analysisLines.push('- بوثات المعارض: لم تسجل مبيعات في المكعب الحالي (0.0 د.ك).')
      }
    }

    if (wantsFollowUpSecond && items.length >= 2) {
      const priorBranchId = findHistoryBranchHint(history)
      const firstBranch = items[0]
      const secondBranch =
        priorBranchId && items[1].branchId === priorBranchId && items.length >= 3
          ? items[2]
          : items[1]
      extraNumbers.push(
        firstBranch.netKwd,
        round1(firstBranch.netKwd),
        firstBranch.orders,
        secondBranch.netKwd,
        round1(secondBranch.netKwd),
        secondBranch.orders,
        secondBranch.aovKwd,
        round1(secondBranch.aovKwd),
      )
      analysisLines.push(
        `- متابعة الفرع الثاني بالترتيب: جاء فرع ${secondBranch.nameAr} بصافي ${formatKwd1(round1(secondBranch.netKwd))} د.ك و${formatIntCount(secondBranch.orders)} طلبات بمتوسط سلة ${formatKwd1(round1(secondBranch.aovKwd))} د.ك بعد المتصدر ${firstBranch.nameAr} (${formatKwd1(round1(firstBranch.netKwd))} د.ك).`,
      )
    } else if (targetBranchId && targetBranchId !== 'exhibitions') {
      const targetItem = items.find((b) => b.branchId === targetBranchId)
      if (targetItem) {
        extraNumbers.push(
          targetItem.netKwd,
          round1(targetItem.netKwd),
          targetItem.orders,
          targetItem.aovKwd,
          round1(targetItem.aovKwd),
        )
        analysisLines.push(
          `- فرع ${targetItem.nameAr}: صافي ${formatKwd1(round1(targetItem.netKwd))} د.ك عبر ${formatIntCount(targetItem.orders)} طلبات بمتوسط سلة ${formatKwd1(round1(targetItem.aovKwd))} د.ك.`,
        )
      }
    } else if ((wantsBranches || !hasSpecificTopic) && items.length > 0) {
      const topThree = items.slice(0, 3)
      const branchSummary = topThree
        .map((b) => {
          extraNumbers.push(b.netKwd, round1(b.netKwd), b.orders)
          return `${b.nameAr} (${formatKwd1(round1(b.netKwd))} د.ك — ${formatIntCount(b.orders)} طلبات)`
        })
        .join('، ')
      analysisLines.push(`- أبرز الفروع مبيعاً: ${branchSummary}.`)
    }
  }

  // 5. Brands
  if (wantsBrands && pack.brands.status === 'ok' && pack.brands.data) {
    const brandItems = targetBrandId
      ? pack.brands.data.items.filter((b) => b.brandId === targetBrandId)
      : pack.brands.data.items.slice(0, 3)
    if (brandItems.length > 0) {
      const brandDesc = brandItems
        .map((b) => {
          extraNumbers.push(b.netKwd, round1(b.netKwd))
          return `${b.nameAr} (${formatKwd1(round1(b.netKwd))} د.ك)`
        })
        .join('، ')
      analysisLines.push(`- العلامات التجارية: ${brandDesc}.`)
    }
  }

  // 6. Top Products
  if (wantsProducts && pack.topProducts.status === 'ok' && pack.topProducts.data) {
    const prods = pack.topProducts.data.items.slice(0, 3)
    if (prods.length > 0) {
      const prodDesc = prods
        .map((p) => {
          extraEntities.push(p.name)
          extraNumbers.push(p.netKwd, round1(p.netKwd), p.qty, round1(p.qty))
          return `${p.name} (${formatKwd1(round1(p.netKwd))} د.ك)`
        })
        .join('، ')
      analysisLines.push(`- أعلى الأصناف مبيعاً: ${prodDesc}.`)
    }
  }

  // 7. HR headcount (for overtime / attendance questions)
  if (wantsHr && pack.hr.status === 'ok' && pack.hr.data) {
    const empCount = Math.round(pack.hr.data.activeEmployeeCount)
    extraNumbers.push(empCount)
    executedQueries.push({
      model: 'hr.employee',
      method: 'search_read',
      domain: [['active', '=', true]],
      groupby: ['department_id'],
      period: { from: pack.period.from, to: pack.period.to },
    })
    analysisLines.push(`- القوى العاملة النشطة المسجلة في hr.employee: ${formatIntCount(empCount)} موظف.`)
  }

  // 8. Stock moves/scrap
  if (wantsStock && pack.stock.status === 'ok' && pack.stock.data) {
    const transfers = Math.round(pack.stock.data.transferCount)
    const scraps = Math.round(pack.stock.data.scrapCount)
    extraNumbers.push(transfers, scraps)
    executedQueries.push({
      model: 'stock.move',
      method: 'read_group',
      domain: [['state', '=', 'done']],
      groupby: ['product_id'],
      period: { from: pack.period.from, to: pack.period.to },
    })
    analysisLines.push(
      `- حركات المخزن: ${formatIntCount(transfers)} حركة تحويل و${formatIntCount(scraps)} أوامر إتلاف مسجلة.`,
    )
  }

  // Root-cause hypothesis + concrete proposals labelled «اقتراح»
  let hypothesisLine: string
  const proposals: string[] = []

  if (isOvertime) {
    hypothesisLine =
      '- استنتاج: ضغط الساعات الإضافية يرتبط غالباً بعدم مواءمة جدول الورديات مع الفجوة بين ساعات الهدوء وساعة الذروة.'
    proposals.push(
      '- اقتراح (مدير العمليات والموارد البشرية): ترحيل جزء من ساعات التحضير من أهدأ الساعات إلى ما قبل ساعة الذروة لتقليص الأوفر تايم.',
      '- اقتراح (مديرو الفروع): ربط ساعات البصمة الأسبوعية بحجم الطلبات بالساعة في كل فرع قبل اعتماد أي ساعات إضافية.',
    )
  } else if (wantsChannels || isWhyOrDrop) {
    hypothesisLine =
      '- استنتاج: تذبذب الطلبات يرتبط بتحول مزيج القنوات بين طلبات TGO وTMP والمنصات المنافسة أو تغيّر حجم الطلبات في الساعات خارج الذروة.'
    proposals.push(
      '- اقتراح (مسؤول قنوات التوصيل): مقارنة توافر القوائم ورسوم التوصيل بين talabat-tgo وtalabat-tmp ومنصة كيتا خلال هذا الأسبوع.',
      '- اقتراح (مدير العمليات): إطلاق عروض باقات أو خصومات موجهة خلال الساعات الأقل طلباً لرفع معدل الطلبات ومتوسط السلة.',
    )
  } else if (wantsHourly) {
    hypothesisLine =
      '- استنتاج: تركز المبيعات في ساعة الذروة مقابل انخفاض واضح في ساعات الهدوء يعكس فرصة لإعادة توزيع الطاقم والعروض الترويجية.'
    proposals.push(
      '- اقتراح (مديرو الفروع): تأمين كامل طاقم المطبخ والكاشير قبل ساعة الذروة لضمان سرعة التسليم ومنع فقدان الطلبات.',
      '- اقتراح (فريق التسويق): اختبار عروض وقتية خلال ساعات الهدوء لرفع الإشغال دون تكلفة ثابتة إضافية.',
    )
  } else if (wantsExhibitions) {
    hypothesisLine =
      '- استنتاج: تقييم جدوى البوثات يتطلب مقابلة صافي مبيعات بوثات المعارض الظاهرة في Odoo مع تكلفة الإيجار والتشغيل الفعلية خارج مكعب POS.'
    proposals.push(
      '- اقتراح (المدير المالي): مطابقة إيراد بوثات المعارض مع عقد إيجار الموقع وتكلفة الطاقم لحساب نقطة التعادل قبل التجديد.',
      '- اقتراح (مدير العمليات): التركيز في البوثات على الأصناف الأعلى هامشاً وسرعة في التقديم.',
    )
  } else {
    hypothesisLine =
      '- استنتاج: المؤشرات المتاحة في المكعب توضح مواطن التركز في المبيعات بين الفروع والقنوات والساعات.'
    proposals.push(
      '- اقتراح (مدير العمليات): مراجعة أداء الفروع والقنوات الأقل مساهمة خلال الاجتماع الأسبوعي وتحديد خطة تنشيط واضحة.',
      '- اقتراح (المدير المالي): استكمال ربط المصادر التشغيلية غير المربوطة في Odoo لمتابعة الأثر التشغيلي والمالي بدقة.',
    )
  }

  const blocks: string[] = []
  if (missingMetrics.length > 0) {
    blocks.push(`• قيود تغطية البيانات:\n${formatMissingMetricsBulletLines(missingMetrics)}`)
  }
  if (analysisLines.length > 0) {
    blocks.push(`• التحليل والأرقام المتاحة من Odoo:\n${analysisLines.join('\n')}`)
  }
  blocks.push(`• الاستنتاج:\n${hypothesisLine}`)
  blocks.push(`• التوصيات:\n${proposals.join('\n')}`)

  return {
    hasData: true,
    primaryModel: 'pos.order',
    executedQueries,
    toolNumbers: collectPackToolNumbers(pack, extraNumbers),
    allowedEntityNames: collectPackAllowedEntityNames(pack, extraEntities),
    deterministicReply: blocks.join('\n\n'),
    structuredFacts: buildPackStructuredFacts(pack),
    skipFourPartStructure: true,
    missingMetrics: [...missingMetrics],
  }
}

// ============================================================================
// MAIN ENTRYPOINT: `askFeryalOdooAgent`
// ============================================================================

export async function askFeryalOdooAgent(
  input: AskFeryalOdooAgentInput,
): Promise<AskFeryalOdooAgentResult> {
  const rawQuestion = (input.question ?? '').trim()
  const nowMs = input.referenceNowMs ?? Date.now()
  const timestampIso = new Date().toISOString()
  const userSub = (input.userSub ?? 'anonymous').trim() || 'anonymous'
  const userRole = (input.userRole ?? 'executive').trim() || 'executive'
  const sanitizedHistory = sanitizeFeryalChatHistory(input.history)

  const rawDataSource: FeryalOdooDataSource = {
    ...DEFAULT_ODOO_DATA_SOURCE,
    ...input.dataSource,
  }

  type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown }
  const thrownSections = new Set<string>()
  const cubePromises = new Map<string, Promise<Settled<OdooPeriodCube | null>>>()
  const poPromises = new Map<string, Promise<Settled<OdooLivePurchaseSummary | null>>>()
  const whPromises = new Map<string, Promise<Settled<OdooLiveWarehouseChainPayload | null>>>()
  const topProdPromises = new Map<string, Promise<Settled<OdooPeriodCubeProductRow[] | null>>>()
  let recPromise: Promise<Settled<OdooReceivableClearingSummary | null>> | null = null
  let hrPromise: Promise<Settled<OdooLiveHrSummary | null>> | null = null
  let syncPromise: Promise<Settled<string | null>> | null = null

  const settle = async <T>(section: string, fn: () => Promise<T>): Promise<Settled<T>> => {
    try {
      const value = await fn()
      return { ok: true, value }
    } catch (error) {
      thrownSections.add(section)
      return { ok: false, error }
    }
  }

  const getCubeSettled = (fromIso: string, toIso: string, ref?: number) => {
    const key = `${fromIso}..${toIso}`
    let p = cubePromises.get(key)
    if (!p) {
      p = settle('periodCube', () => rawDataSource.fetchPeriodCube(fromIso, toIso, ref))
      cubePromises.set(key, p)
    }
    return p
  }

  const getPoSettled = (fromIso: string, toIso: string, ref?: number) => {
    const key = `${fromIso}..${toIso}`
    let p = poPromises.get(key)
    if (!p) {
      p = settle('purchases', () => rawDataSource.fetchPurchaseOrders(fromIso, toIso, ref))
      poPromises.set(key, p)
    }
    return p
  }

  const getWhSettled = (fromIso: string, toIso: string, ref?: number) => {
    const key = `${fromIso}..${toIso}`
    let p = whPromises.get(key)
    if (!p) {
      p = settle('stock', () => rawDataSource.fetchWarehouseChain(fromIso, toIso, ref))
      whPromises.set(key, p)
    }
    return p
  }

  const getRecSettled = () => {
    if (!recPromise) {
      recPromise = settle('receivables', () => rawDataSource.fetchReceivablesSummary())
    }
    return recPromise
  }

  const getHrSettled = (ref?: number) => {
    if (!hrPromise) {
      hrPromise = settle('hr', () =>
        rawDataSource.fetchHrEmployees ? rawDataSource.fetchHrEmployees(ref) : Promise.resolve(null),
      )
    }
    return hrPromise
  }

  const getSyncSettled = () => {
    if (!syncPromise) {
      syncPromise = settle('lastSyncAt', () =>
        rawDataSource.getLastSyncAt ? rawDataSource.getLastSyncAt() : Promise.resolve(null),
      )
    }
    return syncPromise
  }

  const getTopProdSettled = (
    fromIso: string,
    toIso: string,
    branchId: ApprovedFeryalBranchId,
    limit: number,
  ) => {
    const key = `${fromIso}..${toIso}..${branchId}..${limit}`
    let p = topProdPromises.get(key)
    if (!p) {
      p = settle('branchTopProducts', () =>
        rawDataSource.fetchBranchTopProducts(fromIso, toIso, branchId, limit),
      )
      topProdPromises.set(key, p)
    }
    return p
  }

  const packDataSource: FeryalOdooDataSource = {
    fetchPeriodCube: async (fromIso, toIso, ref) => {
      const res = await getCubeSettled(fromIso, toIso, ref)
      if (!res.ok) throw res.error
      return res.value
    },
    fetchPurchaseOrders: async (fromIso, toIso, ref) => {
      const res = await getPoSettled(fromIso, toIso, ref)
      if (!res.ok) throw res.error
      return res.value
    },
    fetchWarehouseChain: async (fromIso, toIso, ref) => {
      const res = await getWhSettled(fromIso, toIso, ref)
      if (!res.ok) throw res.error
      return res.value
    },
    fetchReceivablesSummary: async () => {
      const res = await getRecSettled()
      if (!res.ok) throw res.error
      return res.value
    },
    fetchHrEmployees: async (ref) => {
      const res = await getHrSettled(ref)
      if (!res.ok) throw res.error
      return res.value
    },
    getLastSyncAt: async () => {
      const res = await getSyncSettled()
      if (!res.ok) throw res.error
      return res.value
    },
    fetchBranchTopProducts: async (fromIso, toIso, branchId, limit) => {
      const res = await getTopProdSettled(fromIso, toIso, branchId, limit)
      if (!res.ok) throw res.error
      return res.value
    },
  }

  const toolDataSource: FeryalOdooDataSource = {
    fetchPeriodCube: async (fromIso, toIso, ref) => {
      const res = await getCubeSettled(fromIso, toIso, ref)
      return res.ok ? res.value : null
    },
    fetchPurchaseOrders: async (fromIso, toIso, ref) => {
      const res = await getPoSettled(fromIso, toIso, ref)
      return res.ok ? res.value : null
    },
    fetchWarehouseChain: async (fromIso, toIso, ref) => {
      const res = await getWhSettled(fromIso, toIso, ref)
      return res.ok ? res.value : null
    },
    fetchReceivablesSummary: async () => {
      const res = await getRecSettled()
      return res.ok ? res.value : null
    },
    fetchHrEmployees: async (ref) => {
      const res = await getHrSettled(ref)
      return res.ok ? res.value : null
    },
    getLastSyncAt: async () => {
      const res = await getSyncSettled()
      return res.ok ? res.value : null
    },
    fetchBranchTopProducts: async (fromIso, toIso, branchId, limit) => {
      const res = await getTopProdSettled(fromIso, toIso, branchId, limit)
      return res.ok ? res.value : null
    },
  }

  const finalize = async (params: {
    reply: string
    status: FeryalReplyStatus
    executedQueries: FeryalExecutedOdooQuery[]
    verifier: FeryalNumericVerificationResult
    toolNumbers: number[]
    period: { from: string; to: string } | null
    structuredFacts?: Record<string, unknown>
    llmCandidateRejected?: boolean
    sourceModel?: string
    contextPack?: FeryalContextPack
    missingMetrics?: string[]
  }): Promise<AskFeryalOdooAgentResult> => {
    let source: FeryalAnswerSource | null = null
    if (params.status === 'answered' && params.sourceModel) {
      let lastSyncAt: string | null = null
      try {
        lastSyncAt = (await toolDataSource.getLastSyncAt?.()) ?? null
      } catch (error) {
        logger.warn('feryal odoo data source failed', {
          section: 'lastSyncAt',
          ...errorFields(error),
        })
        lastSyncAt = null
      }
      source = { system: 'Odoo 17', model: params.sourceModel, period: params.period, lastSyncAt }
      params = { ...params, reply: `${params.reply}\n${formatFeryalSourceFooter(source)}` }
    }
    const auditEntry: FeryalAuditLogEntry = {
      id: nextAuditEntryId(),
      timestampIso,
      userSub,
      userRole,
      ...(input.userNameAr ? { userNameAr: input.userNameAr } : {}),
      question: rawQuestion,
      status: params.status,
      executedQueries: params.executedQueries,
      verifier: params.verifier,
      ...(params.llmCandidateRejected ? { llmCandidateRejected: true } : {}),
      finalReply: params.reply,
    }
    if (!input.skipAuditLog) {
      await recordFeryalAuditEntry(auditEntry)
    }
    return {
      reply: params.reply,
      status: params.status,
      executedQueries: params.executedQueries,
      verifier: params.verifier,
      toolNumbers: params.toolNumbers,
      period: params.period,
      facts: numericFactsFromStructured(params.structuredFacts ?? null, params.period),
      source,
      ...(params.contextPack ? { contextPack: params.contextPack } : {}),
      ...(params.missingMetrics && params.missingMetrics.length > 0
        ? { missingMetrics: params.missingMetrics }
        : {}),
      auditEntry,
    }
  }

  const finalizeNoData = (
    reasonKey: NoOdooDataReasonKey,
    executedQueries: FeryalExecutedOdooQuery[] = [],
    period: { from: string; to: string } | null = null,
    extras?: { contextPack?: FeryalContextPack; missingMetrics?: string[] },
  ): Promise<AskFeryalOdooAgentResult> => {
    const reply = buildFeryalNoOdooDataSuggestion(reasonKey)
    const verifier = verifyFeryalReplyNumbers(reply, [])
    return finalize({
      reply,
      status: 'no_odoo_data',
      executedQueries,
      verifier,
      toolNumbers: [],
      period,
      contextPack: extras?.contextPack,
      missingMetrics: extras?.missingMetrics,
    })
  }

  if (!rawQuestion) {
    return finalizeNoData('generic')
  }

  // 1. Strict Competitor Refusal -> literal `لا أعرف` ONLY
  if (isCompetitorQuestion(rawQuestion)) {
    return finalize({
      reply: FERYAL_COMPETITOR_REFUSAL,
      status: 'competitor_refusal',
      executedQueries: [],
      verifier: verifyFeryalReplyNumbers(FERYAL_COMPETITOR_REFUSAL, []),
      toolNumbers: [],
      period: null,
    })
  }

  // 2. «الفحاحيل» is the FAS Fahaheel school-canteen register, never Al-Kout.
  if (
    FAS_FAHAHEEL_POS_CONFIG_ID !== null &&
    /(الفحاحيل|فحاحيل|\bfahaheel\b)/i.test(normalizeArabicText(rawQuestion))
  ) {
    return finalizeNoData('fas_fahaheel_canteen')
  }

  // 3. Branch Scope Check (excluded retail districts & unknown branches, while allowing Qurain central kitchen)
  const qurainAsked = isCentralKitchenQurainQuestion(rawQuestion)
  const branchDetection = detectTargetBranchFromQuestion(rawQuestion)
  if (branchDetection.unknownBranchRequested) {
    return finalizeNoData('unknown_branch')
  }

  // 4. Context Defaults + Explicit Question Entity Resolution (explicit question entities win)
  const validatedDefaults = validateFeryalContextDefaults({
    period: input.context?.period ?? input.period,
    customFrom: input.context?.customFrom ?? input.customFrom,
    customTo: input.context?.customTo ?? input.customTo,
    branch: input.context?.branch ?? input.branch,
    brand: input.context?.brand ?? input.brand,
    channel: input.context?.channel ?? input.channel,
  })

  const effectiveBranchId: ApprovedFeryalBranchId | null =
    branchDetection.branchId !== null
      ? branchDetection.branchId
      : branchDetection.isBranchRanking || branchDetection.asksByBranchBreakdown
        ? null
        : validatedDefaults.branchId

  const rawBrandDetection = detectTargetBrandFromQuestion(rawQuestion)
  const effectiveBrandDetection =
    rawBrandDetection.asksByBrandBreakdown || rawBrandDetection.brandId !== null
      ? rawBrandDetection
      : !branchDetection.isBranchRanking &&
          !branchDetection.asksByBranchBreakdown &&
          branchDetection.branchId === null &&
          validatedDefaults.brandId !== null
        ? { brandId: validatedDefaults.brandId, asksByBrandBreakdown: false }
        : rawBrandDetection

  const channelDetection = detectTargetChannelFromQuestion(rawQuestion)
  const effectiveChannelId: ApprovedFeryalChannelId | null = channelDetection.asksByChannelBreakdown
    ? null
    : channelDetection.channelId ?? validatedDefaults.channelId

  const comparisonPeriods = resolveFeryalComparisonPeriods(rawQuestion, nowMs)
  const questionMissing = collectQuestionMissingMetrics(rawQuestion)
  const isSmallTalk = !qurainAsked && isSmallTalkOrMetaQuestion(rawQuestion)

  let resolvedPeriod = resolveFeryalQuestionPeriod(rawQuestion, nowMs, validatedDefaults)
  if (questionMissing.isForecast && !resolvedPeriod.hasExplicitPeriod && !validatedDefaults.period) {
    resolvedPeriod = resolveFeryalQuestionPeriod('هذا الشهر', nowMs, validatedDefaults)
  }

  const toolKind = detectOdooToolKind(
    rawQuestion,
    effectiveBranchId,
    effectiveBrandDetection,
    comparisonPeriods !== null,
    branchDetection.isBranchRanking,
  )

  // Keep real truthfulness guards on stock-on-hand and branch-level GL expenses
  if (!isSmallTalk && !qurainAsked) {
    if (toolKind === 'inventory_on_hand') {
      return finalizeNoData(
        'inventory_on_hand',
        [],
        { from: resolvedPeriod.from, to: resolvedPeriod.to },
        {
          contextPack: input.contextPack,
          missingMetrics: ['رصيد المخزون الحالي (stock.quant) غير متاح في Odoo'],
        },
      )
    }
    if (toolKind === 'account_move_lines' && effectiveBranchId && branchDetection.branchId !== null) {
      return finalizeNoData(
        'gl_branch_not_partitioned',
        [],
        { from: resolvedPeriod.from, to: resolvedPeriod.to },
        {
          contextPack: input.contextPack,
          missingMetrics: ['مصاريف الفرع غير مقسّمة تحليلياً حسب الفرع في Odoo'],
        },
      )
    }
  }

  let activePeriod = { from: resolvedPeriod.from, to: resolvedPeriod.to }
  let activeAllowedDateStrings = resolvedPeriod.allowedDateStrings
  if (toolKind === 'pos_comparison' && comparisonPeriods) {
    const minFrom =
      comparisonPeriods.periodA.from <= comparisonPeriods.periodB.from
        ? comparisonPeriods.periodA.from
        : comparisonPeriods.periodB.from
    const maxTo =
      comparisonPeriods.periodA.to >= comparisonPeriods.periodB.to
        ? comparisonPeriods.periodA.to
        : comparisonPeriods.periodB.to
    activePeriod = { from: minFrom, to: maxTo }
    activeAllowedDateStrings = comparisonPeriods.allowedDateStrings
  }

  // 5. Build or reuse FeryalContextPack once per turn
  const contextPack: FeryalContextPack =
    input.contextPack ??
    (await buildFeryalContextPack({
      period: {
        from: resolvedPeriod.from,
        to: resolvedPeriod.to,
        labelAr: resolvedPeriod.periodLabelAr,
      },
      dataSource: packDataSource,
      referenceNowMs: nowMs,
    }))

  activeAllowedDateStrings = [
    ...new Set([...activeAllowedDateStrings, ...collectPackAllowedDateStrings(contextPack)]),
  ]

  let toolOutput: ToolExecutionOutput

  if (isSmallTalk) {
    toolOutput = buildSmallTalkPackOutcome({
      rawQuestion,
      history: sanitizedHistory,
      pack: contextPack,
    })
  } else if (qurainAsked) {
    const wh = await toolDataSource.fetchWarehouseChain(
      resolvedPeriod.from,
      resolvedPeriod.to,
      nowMs,
    )
    toolOutput = buildQurainCentralKitchenOutcome({
      pack: contextPack,
      warehouse: wh,
      period: { from: resolvedPeriod.from, to: resolvedPeriod.to },
      missingMetrics: questionMissing.missingMetrics,
    })
  } else if (questionMissing.isForecast) {
    toolOutput = buildForecastPackOutcome({
      pack: contextPack,
      missingMetrics: questionMissing.missingMetrics,
    })
  } else if (
    questionMissing.missingMetrics.length > 0 ||
    toolKind === 'unknown' ||
    isWhyOrDropInquiry(rawQuestion) ||
    /(التاني|الثاني|ثاني|\bsecond\b|\bnext branch\b)/i.test(normalizeArabicText(rawQuestion))
  ) {
    toolOutput = buildPackGroundedOutcome({
      rawQuestion,
      history: sanitizedHistory,
      pack: contextPack,
      missingMetrics: questionMissing.missingMetrics,
      fallbackReasonKey: questionMissing.fallbackReasonKey,
      targetBranchId: effectiveBranchId,
      targetChannelId: effectiveChannelId,
      targetBrandId: effectiveBrandDetection.brandId,
      isOvertime: questionMissing.isOvertime,
      isBoothFeasibility: questionMissing.isBoothFeasibility,
      isWhyOrDrop: isWhyOrDropInquiry(rawQuestion),
    })
  } else {
    switch (toolKind) {
      case 'pos_comparison': {
        toolOutput = await runPosComparisonTool({
          dataSource: toolDataSource,
          comparison: comparisonPeriods!,
          targetBranchId: effectiveBranchId,
          referenceNowMs: nowMs,
        })
        break
      }
      case 'pos_brands':
        toolOutput = await runPosBrandsTool({
          dataSource: toolDataSource,
          period: resolvedPeriod,
          targetBrandId: effectiveBrandDetection.brandId,
          targetBranchId: effectiveBranchId,
          referenceNowMs: nowMs,
        })
        break
      case 'pos_orders':
        toolOutput = await runPosOrdersTool({
          dataSource: toolDataSource,
          period: resolvedPeriod,
          targetBranchId: effectiveBranchId,
          targetChannelId: effectiveChannelId,
          isBranchRanking: branchDetection.isBranchRanking || isLowestBranchQuestion(rawQuestion),
          rankDirection: isLowestBranchQuestion(rawQuestion) ? 'lowest' : 'top',
          referenceNowMs: nowMs,
        })
        break
      case 'pos_order_lines':
        toolOutput = await runPosOrderLinesTool({
          dataSource: toolDataSource,
          period: resolvedPeriod,
          targetBranchId: effectiveBranchId,
          question: rawQuestion,
          referenceNowMs: nowMs,
        })
        break
      case 'account_move_lines':
        toolOutput = await runAccountMoveLinesTool({
          dataSource: toolDataSource,
          period: resolvedPeriod,
          question: rawQuestion,
          referenceNowMs: nowMs,
        })
        break
      case 'purchase_orders':
        toolOutput = await runPurchaseOrdersTool({
          dataSource: toolDataSource,
          period: resolvedPeriod,
          question: rawQuestion,
          referenceNowMs: nowMs,
        })
        break
      case 'stock_moves':
        toolOutput = await runStockMovesAndScrapTool({
          dataSource: toolDataSource,
          period: resolvedPeriod,
          referenceNowMs: nowMs,
        })
        break
      case 'hr_employees':
        toolOutput = await runHrEmployeesTool({
          dataSource: toolDataSource,
          period: resolvedPeriod,
          referenceNowMs: nowMs,
        })
        break
      default:
        toolOutput = buildPackGroundedOutcome({
          rawQuestion,
          history: sanitizedHistory,
          pack: contextPack,
          missingMetrics: [],
          fallbackReasonKey: 'generic',
          targetBranchId: effectiveBranchId,
          targetChannelId: effectiveChannelId,
          targetBrandId: effectiveBrandDetection.brandId,
          isOvertime: false,
          isBoothFeasibility: false,
          isWhyOrDrop: false,
        })
    }

    // If a data-source section threw (e.g. purchases/stock/hr/receivables) while other pack sections succeeded,
    // answer cleanly from available pack sections and report the failed section as unavailable.
    if (!toolOutput.hasData && contextPack.connected) {
      const thrownSectionMissing: string[] = []
      if (toolKind === 'purchase_orders' && thrownSections.has('purchases')) {
        thrownSectionMissing.push('بيانات المشتريات وأوامر الشراء (purchase.order) غير متاحة حالياً من Odoo')
      } else if (toolKind === 'stock_moves' && thrownSections.has('stock')) {
        thrownSectionMissing.push('بيانات حركات المخزن والهدر (stock.move / stock.scrap) غير متاحة حالياً من Odoo')
      } else if (toolKind === 'hr_employees' && thrownSections.has('hr')) {
        thrownSectionMissing.push('بيانات الموظفين (hr.employee) غير متاحة حالياً من Odoo')
      } else if (toolKind === 'account_move_lines' && thrownSections.has('receivables')) {
        thrownSectionMissing.push('بيانات الذمم المدينة (account.move.line) غير متاحة حالياً من Odoo')
      }

      if (thrownSectionMissing.length > 0 || (input.contextPack && !input.dataSource)) {
        toolOutput = buildPackGroundedOutcome({
          rawQuestion,
          history: sanitizedHistory,
          pack: contextPack,
          missingMetrics: thrownSectionMissing,
          fallbackReasonKey: toolOutput.noDataReasonKey ?? 'generic',
          targetBranchId: effectiveBranchId,
          targetChannelId: effectiveChannelId,
          targetBrandId: effectiveBrandDetection.brandId,
          isOvertime: false,
          isBoothFeasibility: false,
          isWhyOrDrop: false,
        })
      }
    }
  }

  const effectiveMissingMetrics =
    toolOutput.missingMetrics && toolOutput.missingMetrics.length > 0
      ? toolOutput.missingMetrics
      : questionMissing.missingMetrics

  if (!toolOutput.hasData) {
    return finalizeNoData(
      toolOutput.noDataReasonKey ?? 'generic',
      toolOutput.executedQueries,
      activePeriod,
      {
        contextPack,
        missingMetrics: effectiveMissingMetrics,
      },
    )
  }

  const deterministicVerifierOptions = {
    allowedDateStrings: activeAllowedDateStrings,
    allowedEntityNames: toolOutput.allowedEntityNames,
    requireFourPartStructure: !toolOutput.skipFourPartStructure,
    requireGlIncompleteWarning: toolOutput.requireGlIncompleteWarning,
  }

  const candidateVerifierOptions = {
    allowedDateStrings: activeAllowedDateStrings,
    allowedEntityNames: toolOutput.allowedEntityNames,
    requireFourPartStructure: false,
    requireGlIncompleteWarning: toolOutput.requireGlIncompleteWarning,
  }

  // 6. Optional candidate phrasing strictly gated by numeric verification & excluded-entity check
  let llmCandidateRejected = false
  if (input.candidatePhraser) {
    try {
      const candidateText = await input.candidatePhraser({
        question: rawQuestion,
        toolModel: toolOutput.primaryModel,
        period: activePeriod,
        structuredFactsJson: JSON.stringify(toolOutput.structuredFacts),
        deterministicDraft: toolOutput.deterministicReply,
      })
      if (candidateText && candidateText.trim()) {
        const candidateCheck = enforceVerifiedFeryalReply(
          candidateText,
          toolOutput.toolNumbers,
          candidateVerifierOptions,
        )
        const leaked = containsExcludedEntityText(candidateCheck.reply, {
          allowQurainCentralKitchen: qurainAsked,
        })
        if (candidateCheck.accepted && !leaked) {
          return finalize({
            reply: candidateCheck.reply,
            status: 'answered',
            executedQueries: toolOutput.executedQueries,
            verifier: candidateCheck.verifier,
            toolNumbers: toolOutput.toolNumbers,
            period: activePeriod,
            structuredFacts: toolOutput.structuredFacts,
            sourceModel: toolOutput.skipSourceFooter ? undefined : toolOutput.primaryModel,
            contextPack,
            missingMetrics: effectiveMissingMetrics,
          })
        }
        llmCandidateRejected = true
      }
    } catch {
      llmCandidateRejected = true
    }
  }

  // 7. Mandatory Numeric Verification on Final Grounded Reply
  const verified = enforceVerifiedFeryalReply(
    toolOutput.deterministicReply,
    toolOutput.toolNumbers,
    deterministicVerifierOptions,
  )

  const deterministicLeaked = containsExcludedEntityText(verified.reply, {
    allowQurainCentralKitchen: qurainAsked,
  })

  if (!verified.accepted || deterministicLeaked) {
    const fallbackReply = buildFeryalNoOdooDataSuggestion(toolOutput.noDataReasonKey ?? 'generic')
    return finalize({
      reply: fallbackReply,
      status: 'verifier_rejected',
      executedQueries: toolOutput.executedQueries,
      verifier: verified.verifier,
      toolNumbers: toolOutput.toolNumbers,
      period: activePeriod,
      structuredFacts: toolOutput.structuredFacts,
      llmCandidateRejected,
      contextPack,
      missingMetrics: effectiveMissingMetrics,
    })
  }

  return finalize({
    reply: verified.reply,
    status: 'answered',
    executedQueries: toolOutput.executedQueries,
    verifier: verified.verifier,
    toolNumbers: toolOutput.toolNumbers,
    period: activePeriod,
    structuredFacts: toolOutput.structuredFacts,
    llmCandidateRejected,
    sourceModel: toolOutput.skipSourceFooter ? undefined : toolOutput.primaryModel,
    contextPack,
    missingMetrics: effectiveMissingMetrics,
  })
}
