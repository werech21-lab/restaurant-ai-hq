import type { CouncilDataGap, CouncilSnapshot } from '@/lib/council/types'
import { buildAdvisoryBlock, detectAdvisoryTopic } from '@/lib/feryal/advisor-synthesis'
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
import { appendOdooNameExclusion } from '@/lib/odoo/excluded-entities'
import { numericFactsFromStructured } from '@/lib/feryal-council-facts'
import {
  ALL_FERYAL_BRANCHES,
  EXHIBITION_FERYAL_BRANCH,
  QURAIN_FERYAL_BRANCH,
  APPROVED_FERYAL_BRAND_LIST,
  APPROVED_FERYAL_BRANDS,
  APPROVED_FERYAL_BRANCHES,
  APPROVED_FERYAL_CHANNEL_LIST,
  detectOdooToolKind,
  detectTargetBranchFromQuestion,
  detectTargetBrandFromQuestion,
  detectTargetChannelFromQuestion,
  isBranchRankingQuestion,
  isQurainRegistryEnabled,
  isSalarySeasonReadinessQuestion,
  KUWAIT_OFFSET_MS,
  normalizeArabicText,
  normalizeDigits,
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
  AGGREGATOR_CHANNEL_IDS,
  buildAllowedDateStrings,
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
  EXHIBITION_FERYAL_BRANCH,
  QURAIN_FERYAL_BRANCH,
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
  /**
   * Latest advisor-council snapshot. When present, Feryal adds the why, 2–3 specific proposals and
   * a follow-up after the Odoo number (every figure checked by the number guard).
   */
  council?: CouncilSnapshot | null
  /** Findings already shown earlier in the conversation (suppresses repeats; mutated if a `Set`). */
  seenFingerprints?: Set<string> | ReadonlySet<string> | readonly string[]
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
  /** Phase 5 · Item 3: exact data source & last sync attached to every reply. */
  source: FeryalAnswerSource | null
  auditEntry: FeryalAuditLogEntry
  /** Finding fingerprints surfaced in this turn (for conversation-wide repeat suppression). */
  usedFingerprints: string[]
  /** Advisor findings, advisors, and dataGaps used in the reply (empty when no council was given). */
  advisory?: { findings: string[]; advisors: string[]; dataGaps?: CouncilDataGap[] }
}

export interface FeryalAnswerSource {
  system: 'Odoo 17'
  model: FeryalOdooModelName | string
  period: { from: string; to: string } | null
  lastSyncAt: string | null
}

/** Footer appended on every reply (provenance: system, Odoo model, period, last sync). */
export function formatFeryalSourceFooter(src: FeryalAnswerSource): string {
  const window = src.period ? `${src.period.from} → ${src.period.to}` : 'غير متاح'
  const sync = src.lastSyncAt ? formatKuwaitDateTime(src.lastSyncAt, 'ar') : 'غير متاح'
  return `• المصدر: ${src.system} · ${src.model} · الفترة: ${window} · آخر مزامنة: ${sync}`
}

const BRANCH_META_BY_ID = new Map<ApprovedFeryalBranchId, FeryalBranchMeta>(
  [...ALL_FERYAL_BRANCHES, QURAIN_FERYAL_BRANCH].map((b) => [b.id, b]),
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
  const r = Math.round(val * 10) / 10
  return Object.is(r, -0) ? 0 : r
}

export function round3(val: number): number {
  if (!Number.isFinite(val)) return 0
  const r = Math.round(val * 1000) / 1000
  return Object.is(r, -0) ? 0 : r
}

export function formatKwd3(val: number): string {
  return round3(val).toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
}

export function formatPct1(val: number): string {
  return round1(val).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

export function formatKwd1(val: number): string {
  return formatKwd3(val)
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
    requireGlIncompleteWarning?: boolean
  },
): { accepted: boolean; reply: string; verifier: FeryalNumericVerificationResult } {
  const trimmed = (candidateReply ?? '').trim()
  const verifier = verifyFeryalReplyNumbers(trimmed, toolNumbers, options)
  if (!verifier.valid) {
    return { accepted: false, reply: FERYAL_NO_ODOO_DATA_REPLY, verifier }
  }

  // Never permit an impact / estimate line without an explicit numeric value + `=` + formula.
  const unsubstantiatedEstimate = trimmed
    .split('\n')
    .some((line) => /الأثر المتوقع|تقدير/.test(line) && !/تقدير:\s*.+\s*=\s*.+/.test(line))
  if (unsubstantiatedEstimate) {
    return {
      accepted: false,
      reply: FERYAL_NO_ODOO_DATA_REPLY,
      verifier: {
        ...verifier,
        valid: false,
        reason: 'UNSUBSTANTIATED_ESTIMATE_WITHOUT_FORMULA',
      },
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

function isUnlinkedNonOdooTopic(question: string): {
  unlinked: boolean
  reasonKey:
    | 'kds'
    | 'drivers'
    | 'reviews_marketing'
    | 'iot_compliance'
    | 'plans_budgets'
    | 'recipes_bom'
    | 'hr_unlinked'
    | null
} {
  const normAr = normalizeArabicText(question)

  // Kitchen ticket prep duration / KDS SLA (not in Odoo 17)
  if (
    /(تذاكر تحضير|تذاكر المطبخ|زمن التحضير|سرعه التحضير|وقت التحضير|مده التجهيز|شاشه المطبخ|\bkds\b|\bprep time\b|\bprep sla\b)/i.test(
      normAr,
    )
  ) {
    return { unlinked: true, reasonKey: 'kds' }
  }

  // Delivery drivers / fleet GPS
  if (
    /(السائقين|سائقين|سائقي التوصيل|مندوبي التوصيل|تتبع السائق|رحلات التوصيل|\bdrivers\b|\briders\b)/i.test(
      normAr,
    )
  ) {
    return { unlinked: true, reasonKey: 'drivers' }
  }

  // Social reviews, customer ratings, ad spend / influencers
  if (
    /(تقييمات العملاء|التقييمات|مراجعات العملاء|مراجعات جوجل|مراجعات السوشيال|تقييمات السوشيال|تعليقات العملاء|حملات اعلانيه|اعلانات سناب|اعلانات انستقرام|المشاهير|مشاهير|\bcustomer reviews\b|\bsocial reviews\b|\bratings\b|\binfluencer\b|\broas\b)/i.test(
      normAr,
    )
  ) {
    return { unlinked: true, reasonKey: 'reviews_marketing' }
  }

  // IoT fridge temperature sensors / municipal violations
  if (/(حساسات التبريد|حراره الثلاجات|مخالفات البلديه|تراخيص الاطفاء|\biot\b)/.test(normAr)) {
    return { unlinked: true, reasonKey: 'iot_compliance' }
  }

  // Unregistered strategic plans, sales targets, budgets, forecasts, booth feasibility
  if (
    /(خطه النمو|خطط النمو|خطط غير مسجله|المستهدف|مستهدف المبيعات|الموازنه التقديريه|توقعات الشهر القادم|تنبؤ الطلب|جدوي البوث|دراسه جدوي|\bsales target\b|\bbudget plan\b|\bforecast\b)/i.test(
      normAr,
    )
  ) {
    return { unlinked: true, reasonKey: 'plans_budgets' }
  }

  // Standard BOM recipes / portion weights
  if (/(الوصفه المعياريه|وصفات المطبخ|تكلفه الوصفه|مكونات الطبق|\bbom\b|\brecipe cost\b)/i.test(normAr)) {
    return { unlinked: true, reasonKey: 'recipes_bom' }
  }

  // Unlinked HR sub-modules (payslips, biometric attendance, residency renewals)
  if (
    /(مسيرات الرواتب|مسير الرواتب|قسائم الرواتب|بصمه الحضور|تاخير البصمه|انتهاء الاقامات|نهايه الخدمه|\bpayslips?\b|\bbiometric\b)/i.test(
      normAr,
    )
  ) {
    return { unlinked: true, reasonKey: 'hr_unlinked' }
  }

  return { unlinked: false, reasonKey: null }
}

type NoOdooDataReasonKey =
  | 'kds'
  | 'drivers'
  | 'reviews_marketing'
  | 'iot_compliance'
  | 'plans_budgets'
  | 'recipes_bom'
  | 'hr_unlinked'
  | 'hr_overtime'
  | 'hr_employees_no_access'
  | 'hr_employees_no_data'
  | 'vendor_no_data'
  | 'unknown_branch'
  | 'pos_no_data'
  | 'pos_order_lines_no_data'
  | 'pos_channel_no_data'
  | 'delivery_pause_matrix'
  | 'season_window_no_data'
  | 'gl_no_data'
  | 'stock_no_data'
  /** Phase 5 · Item 3: stock on hand (`stock.quant`) is not linked for executives. */
  | 'inventory_on_hand'
  /** Phase 5 · Item 3: GL lines are not analytically split per branch in the live feed. */
  | 'gl_branch_not_partitioned'
  /** «الفحاحيل» = school-canteen register FAS Fahaheel (pos.config 43), never Al-Kout. */
  | 'fas_fahaheel_canteen'
  | 'qurain_central_kitchen'
  | 'generic'

function sourceModelForNoDataReason(
  reasonKey: NoOdooDataReasonKey,
  executedQueries: readonly FeryalExecutedOdooQuery[],
  question: string,
): string {
  if (executedQueries[0]?.model) return executedQueries[0].model
  switch (reasonKey) {
    case 'kds':
      return 'pos_preparation_display'
    case 'drivers':
      return 'fleet'
    case 'reviews_marketing':
      return 'social'
    case 'iot_compliance':
      return 'quality / maintenance'
    case 'plans_budgets':
      return 'crossovered.budget'
    case 'recipes_bom':
      return 'mrp.bom'
    case 'hr_unlinked':
      return 'hr.attendance / hr.payslip'
    case 'hr_overtime':
      return 'hr.attendance'
    case 'hr_employees_no_access':
    case 'hr_employees_no_data':
      return 'hr.employee'
    case 'vendor_no_data':
      return 'purchase.order'
    case 'unknown_branch':
    case 'fas_fahaheel_canteen':
      return 'pos.config'
    case 'qurain_central_kitchen':
    case 'pos_no_data':
    case 'season_window_no_data':
      return 'pos.order'
    case 'pos_order_lines_no_data':
      return 'pos.order.line'
    case 'pos_channel_no_data':
    case 'delivery_pause_matrix':
      return 'pos.payment'
    case 'gl_no_data':
    case 'gl_branch_not_partitioned':
      return 'account.move.line'
    case 'inventory_on_hand':
      return 'stock.quant'
    case 'stock_no_data':
      return 'stock.move / stock.scrap'
    case 'generic':
    default: {
      const topic = detectAdvisoryTopic(question)
      if (topic === 'delivery') return 'pos.payment'
      if (topic === 'hr') return 'hr.attendance'
      if (topic === 'inventory') return 'stock.quant'
      return 'pos.order'
    }
  }
}

/**
 * Builds a specific 1-line opener naming the exact missing Odoo model/field/metric
 * (never generic «يلزم التحقق من اتصال Odoo»).
 */
export function buildFeryalNoOdooDataSuggestion(reasonKey: NoOdooDataReasonKey): string {
  switch (reasonKey) {
    case 'kds':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — طوابع بدء وانتهاء تحضير الطلبات غير مسجلة؛ يلزم تفعيل موديول pos_preparation_display في Odoo.`
    case 'drivers':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — مسارات وأزمنة مندوبي التوصيل غير مسجلة؛ يلزم ربط موديول fleet بطلبات نقاط البيع في Odoo.`
    case 'reviews_marketing':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — تقييمات العملاء وحملات التسويق غير مربوطة؛ يلزم ربط موديول social ومراكز التكلفة التحليلية في Odoo.`
    case 'iot_compliance':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — قراءات حساسات التبريد وتراخيص الفروع غير مربوطة؛ يلزم تفعيل موديولي quality وmaintenance في Odoo.`
    case 'plans_budgets':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — الموازنات التقديرية ومستهدفات الفروع غير مدخلة؛ يلزم تسجيلها في موديول crossovered.budget داخل Odoo.`
    case 'recipes_bom':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — قوائم المواد والوصفات المعيارية غير مسجلة؛ يلزم تعريفها في موديول mrp.bom وربطها بأصناف نقاط البيع في Odoo.`
    case 'hr_unlinked':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — مسيرات الرواتب التفصيلية والوثائق غير مربوطة؛ يلزم ربط hr.payslip وhr.attendance في Odoo.`
    case 'hr_overtime':
      return 'غير متاح — ساعات العمل الإضافي المعتمدة لكل فرع غير مربوطة مباشرة في Odoo؛ يلزم تعيين hr.employee.work_location_id وتفعيل hr.attendance.overtime.'
    case 'hr_employees_no_access':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — قراءة سجلات الموظفين النشطين في hr.employee غير متاحة لحساب الربط الحالي؛ يلزم منح صلاحية القراءة لموديول hr.employee في Odoo.`
    case 'hr_employees_no_data':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — لا توجد سجلات موظفين نشطين مرتبطة بالأقسام ومواقع العمل؛ يلزم استكمال hr.employee وwork_location_id في Odoo.`
    case 'vendor_no_data':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — لا توجد أوامر شراء مؤكدة لهذا المورد في الفترة المطلوبة؛ يلزم تسجيل المورد في res.partner وتأكيد أوامره في purchase.order داخل Odoo.`
    case 'unknown_branch':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — هذا الفرع غير معرّف ضمن صناديق البيع المعتمدة للشركة؛ يلزم تعريف الصندوق في pos.config داخل Odoo.`
    case 'pos_no_data':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — لا توجد طلبات نقاط بيع مرحلة في pos.order للشريحة أو الفترة المطلوبة؛ يلزم مزامنة جلسات pos.order المكتملة لهذه الفترة.`
    case 'pos_order_lines_no_data':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — سطور الأصناف المباعة في pos.order.line غير متوفرة لهذه الفترة؛ يلزم مزامنة قراءة pos.order.line مجمّعة حسب product_id.`
    case 'pos_channel_no_data':
      return 'غير متاح — توزيع الدفعات حسب قناة التوصيل في pos.payment غير متوفر لهذه الفترة في البيانات المتزامنة؛ يلزم قراءة pos.payment مجمّعة حسب طريقة الدفع والصندوق.'
    case 'delivery_pause_matrix':
      return 'غير متاح — سجل توقفات المنصات المباشر غير محفوظ كجدول مستقل في Odoo؛ يلزم قراءة مصفوفة pos.payment (الصندوق × الساعة × طريقة الدفع لآخر خمسة أسابيع).'
    case 'season_window_no_data':
      return 'غير متاح — مبيعات نافذة المناسبة الموسمية المطلوبة غير مكتملة في pos.order للبيانات المتزامنة؛ يلزم مزامنة الأيام المقابلة في pos.order.'
    case 'gl_no_data':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — لا توجد قيود يومية مرحلة في account.move.line لهذه الفترة؛ يلزم ترحيل القيود المحاسبية وإقفال الفترة في Odoo.`
    case 'inventory_on_hand':
      return 'غير متاح — رصيد المخزون الفوري والاستهلاك النظري (stock.quant / mrp.bom) غير مربوطين مباشرة بمحادثة الفروع؛ لا تُستخدم أرقام المبيعات بدلاً منهما.'
    case 'fas_fahaheel_canteen':
      return `غير متاح — «الفحاحيل» ليس فرع مطاعم؛ يقابله في Odoo مقصف مدرسة FAS Fahaheel (pos.config ${FAS_FAHAHEEL_POS_CONFIG_ID}) ضمن مقاصف المدارس، ومبيعات هذا الصندوق غير مفصولة عن بقية المقاصف في البيانات الحالية.`
    case 'qurain_central_kitchen':
      return 'غير متاح — «القرين (المطبخ المركزي)» لم يُضَف بعد إلى إجمالي الشركة: يلزم أولاً تدقيق Odoo (قراءة فقط) لاستبعاد التحويلات الداخلية ووجبات الموظفين والتوريد للفروع والطلبات المكررة مع الفروع الأخرى؛ لا يُعرض رقم قبل اعتماد هذا التدقيق.'
    case 'gl_branch_not_partitioned':
      return 'غير متاح — مصاريف الفرع غير مقسّمة تحليلياً حسب الفرع في قيود account.move.line الحالية؛ لا تُستخدم أرقام المبيعات بدلاً منها.'
    case 'stock_no_data':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — لا توجد حركات مخزنية أو أوامر إتلاف معتمدة في stock.move وstock.scrap لهذه الفترة؛ يلزم اعتماد سندات التحويل والإتلاف في Odoo.`
    case 'generic':
    default:
      return `${FERYAL_NO_ODOO_DATA_REPLY} — المؤشر المطلوب غير مسجل ضمن حقول pos.order أو account.move.line أو stock.move المتزامنة؛ يلزم تحديد الموديول والفترة المطلوبة.`
  }
}

function safeDetectBranchId(question: string): string | null {
  try {
    return detectTargetBranchFromQuestion(question).branchId ?? null
  } catch {
    return null
  }
}

/** «القرين» / «المطبخ المركزي» / Qurain / Central Kitchen as the subject of a question. */
export function isQurainCentralKitchenQuestion(question: string): boolean {
  const norm = normalizeArabicText(question)
  return (
    /(?:^|[\s«(])(?:بال|لل|وال|ال|ب|و|ل)?قرين(?=$|[\s،؟?.,!؛:)»])/.test(norm) ||
    /المطبخ\s+المركزي/.test(norm) ||
    /\b(?:al-?)?qurain\b|\bcentral\s+kitchen\b/i.test(norm)
  )
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
    cachedOdooConnectorPromise = import('@/lib/odoo-live-connector').catch(() => null)
  }
  return cachedOdooConnectorPromise
}

const DEFAULT_ODOO_DATA_SOURCE: FeryalOdooDataSource = {
  fetchPeriodCube: async (fromIso, toIso, referenceNowMs) => {
    try {
      const mod = await loadOdooConnector()
      if (!mod) return null
      return await mod.fetchLiveOdooPeriodCube(fromIso, toIso, referenceNowMs)
    } catch {
      return null
    }
  },
  fetchPurchaseOrders: async (fromIso, toIso, referenceNowMs) => {
    try {
      const mod = await loadOdooConnector()
      if (!mod) return null
      return await mod.fetchLiveOdooPurchaseOrders(fromIso, toIso, { referenceNowMs })
    } catch {
      return null
    }
  },
  fetchWarehouseChain: async (fromIso, toIso, referenceNowMs) => {
    try {
      const mod = await loadOdooConnector()
      if (!mod) return null
      return await mod.fetchLiveOdooWarehouseChain(fromIso, toIso, referenceNowMs)
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
      return null
    }
  },
  fetchHrEmployees: async (referenceNowMs) => {
    try {
      const mod = await loadOdooConnector()
      if (!mod) return null
      return await mod.fetchLiveOdooHrSummary(referenceNowMs)
    } catch {
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

  if (
    targetChannelId &&
    (cube as { channelsAvailable?: boolean }).channelsAvailable === false
  ) {
    return {
      hasData: false,
      noDataReasonKey: 'pos_channel_no_data',
      primaryModel: 'pos.order',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('pos_channel_no_data'),
      structuredFacts: {},
    }
  }

  // Company groups (school canteens, exhibition booths, and Qurain once audited into payload)
  // appear when asked for or when they have sales/orders in the cube.
  type CubeBranchCell = OdooPeriodCube['byBranch']['avenues']
  const byBranchMap = cube.byBranch as Partial<Record<ApprovedFeryalBranchId, CubeBranchCell>>
  const groupMetas = [
    SCHOOL_CANTEEN_FERYAL_BRANCH,
    EXHIBITION_FERYAL_BRANCH,
    QURAIN_FERYAL_BRANCH,
  ].filter((meta) => {
    const entry = byBranchMap[meta.id]
    const raw = targetChannelId ? cellOf(entry?.channels) : entry
    return targetBranchId === meta.id || (raw?.netKwd ?? 0) !== 0 || (raw?.orders ?? 0) > 0
  })
  const activeBranchMetas: readonly FeryalBranchMeta[] = [...APPROVED_FERYAL_BRANCHES, ...groupMetas]

  const branchRows = activeBranchMetas
    .map((meta) => {
      const branchEntry = byBranchMap[meta.id]
      const raw = targetChannelId
        ? cellOf(branchEntry?.channels)
        : branchEntry ?? { netKwd: 0, orders: 0, aovKwd: 0 }
      const net3 = round3(raw.netKwd)
      const ordersInt = Math.round(raw.orders)
      const aov3 = ordersInt > 0 ? round3(raw.netKwd / ordersInt) : 0
      return {
        id: meta.id,
        nameAr: meta.nameAr,
        rawNetKwd: raw.netKwd,
        netKwd: net3,
        orders: ordersInt,
        aovKwd: aov3,
      }
    })
    .sort((a, b) => b.netKwd - a.netKwd || b.rawNetKwd - a.rawNetKwd)

  const rawCompanyNet = targetChannelId ? cellOf(cube.byChannel).netKwd : cube.totals.netSalesKwd
  const rawCompanyOrders = targetChannelId ? cellOf(cube.byChannel).orders : cube.totals.orders
  const fallbackUnattributed = cube.unattributed ?? {
    netKwd: 0,
    orders: 0,
    channels: {} as Record<string, { netKwd: number; orders: number }>,
  }
  const rawUnattrEntry = targetChannelId
    ? cellOf(fallbackUnattributed.channels)
    : fallbackUnattributed

  const totalNet3 = round3(rawCompanyNet)
  const totalOrdersInt = Math.round(rawCompanyOrders)
  const totalAov3 = totalOrdersInt > 0 ? round3(rawCompanyNet / totalOrdersInt) : 0
  const unattributedNet3 = round3(rawUnattrEntry.netKwd)
  const unattributedOrdersInt = Math.round(rawUnattrEntry.orders)
  const hasUnattributed = Math.abs(unattributedNet3) >= 0.0005 || unattributedOrdersInt > 0

  if (targetBranchId) {
    const targetRow = branchRows.find((r) => r.id === targetBranchId)
    if (!targetRow || (targetRow.orders <= 0 && targetRow.netKwd === 0)) {
      const noDataKey: NoOdooDataReasonKey = targetChannelId ? 'pos_channel_no_data' : 'pos_no_data'
      return {
        hasData: false,
        noDataReasonKey: noDataKey,
        primaryModel: 'pos.order',
        executedQueries,
        toolNumbers: [],
        allowedEntityNames: [],
        deterministicReply: buildFeryalNoOdooDataSuggestion(noDataKey),
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
      totalNet3,
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
        ? `تصدر فرع ${targetRow.nameAr} جميع الفروع بصافي ${formatKwd3(targetRow.netKwd)} د.ك من ${formatIntCount(targetRow.orders)} ${countNoun} ${avgNoun} ${formatKwd3(targetRow.aovKwd)} د.ك.`
        : `حقق فرع ${targetRow.nameAr} صافي ${formatKwd3(targetRow.netKwd)} د.ك من ${formatIntCount(targetRow.orders)} ${countNoun} ${avgNoun} ${formatKwd3(targetRow.aovKwd)} د.ك مقارنة بأعلى فرع للفترة وهو ${topBranch.nameAr} بقيمة ${formatKwd3(topBranch.netKwd)} د.ك.`

    const reply = [
      `• الرقم: وفق موديل pos.order في Odoo للفترة ${period.periodLabelAr}${channelClause}، سجل فرع ${targetRow.nameAr} صافي مبيعات ${formatKwd3(targetRow.netKwd)} د.ك و${formatIntCount(targetRow.orders)} ${countNoun} ${avgNoun} ${formatKwd3(targetRow.aovKwd)} د.ك من إجمالي الشركة البالغ ${formatKwd3(totalNet3)} د.ك.`,
      `• السبب من البيانات: ${causeComparison}`,
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
        companyTotalNetKwd: totalNet3,
        companyTotalOrders: totalOrdersInt,
        topBranch: { nameAr: topBranch.nameAr, netKwd: topBranch.netKwd },
      },
    }
  }

  if (
    totalNet3 === 0 &&
    totalOrdersInt <= 0 &&
    branchRows.every((r) => r.netKwd === 0 && r.orders <= 0)
  ) {
    const noDataKey: NoOdooDataReasonKey = targetChannelId ? 'pos_channel_no_data' : 'pos_no_data'
    return {
      hasData: false,
      noDataReasonKey: noDataKey,
      primaryModel: 'pos.order',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion(noDataKey),
      structuredFacts: {},
    }
  }

  const toolNumbers: number[] = [rawCompanyNet, totalNet3, totalOrdersInt, totalAov3]
  const allowedEntityNames: string[] = [...(channelMeta ? [channelMeta.nameAr] : [])]
  if (hasUnattributed) {
    toolNumbers.push(rawUnattrEntry.netKwd, unattributedNet3, unattributedOrdersInt)
    allowedEntityNames.push(UNATTRIBUTED_BRANCH_LABEL_AR)
  }

  for (const r of branchRows) {
    allowedEntityNames.push(r.nameAr)
    if (r.netKwd !== 0 || r.orders > 0) {
      toolNumbers.push(r.rawNetKwd, r.netKwd, r.orders, r.aovKwd)
    }
  }

  const branchListText = branchRows
    .map((r) =>
      r.netKwd === 0 && r.orders <= 0
        ? `${r.nameAr} (لا مبيعات مسجلة)`
        : `${r.nameAr} ${formatKwd3(r.netKwd)} د.ك`,
    )
    .join('، ')

  const topBranch = branchRows[0]
  const secondBranch = branchRows[1]
  const restaurantRows = branchRows.filter(
    (r) => r.id !== 'school-canteens' && r.id !== 'exhibitions' && r.id !== 'qurain',
  )
  const activeRestaurantRows = restaurantRows.filter((r) => r.netKwd !== 0 || r.orders > 0)
  const lowestBranch =
    activeRestaurantRows[activeRestaurantRows.length - 1] ??
    restaurantRows[restaurantRows.length - 1] ??
    branchRows[branchRows.length - 1]

  const unattributedSegment =
    Math.abs(unattributedNet3) >= 0.0005
      ? `، منها ${formatKwd3(unattributedNet3)} د.ك غير منسوبة (${UNATTRIBUTED_BRANCH_LABEL_AR})`
      : ''

  const firstBullet =
    isBranchRanking && rankDirection === 'lowest'
      ? `• الرقم: وفق موديل pos.order في Odoo للفترة ${period.periodLabelAr}${channelClause}، أضعف فرع مطاعم هو ${lowestBranch.nameAr} بصافي ${formatKwd3(lowestBranch.netKwd)} د.ك و${formatIntCount(lowestBranch.orders)} ${countNoun}، مقابل أعلى فرع ${topBranch.nameAr} بصافي ${formatKwd3(topBranch.netKwd)} د.ك. توزيع الفروع: ${branchListText}.`
      : isBranchRanking
        ? `• الرقم: وفق موديل pos.order في Odoo للفترة ${period.periodLabelAr}${channelClause}، تصدر فرع ${topBranch.nameAr} المبيعات بصافي ${formatKwd3(topBranch.netKwd)} د.ك و${formatIntCount(topBranch.orders)} ${countNoun}، وتوزعت المبيعات حسب الفرع كالتالي: ${branchListText}، والإجمالي ${formatKwd3(totalNet3)} د.ك عبر ${formatIntCount(totalOrdersInt)} ${countNoun}${unattributedSegment}.`
        : `• الرقم: وفق موديل pos.order في Odoo للفترة ${period.periodLabelAr}${channelClause}، توزعت المبيعات حسب الفرع كالتالي: ${branchListText}، والإجمالي ${formatKwd3(totalNet3)} د.ك عبر ${formatIntCount(totalOrdersInt)} ${countNoun}${unattributedSegment}.`

  const secondClause =
    secondBranch && (secondBranch.netKwd !== 0 || secondBranch.orders > 0)
      ? ` تلاه ${secondBranch.nameAr} بقيمة ${formatKwd3(secondBranch.netKwd)} د.ك`
      : ''
  const lowestClause =
    lowestBranch.id !== topBranch.id && (lowestBranch.netKwd !== 0 || lowestBranch.orders > 0)
      ? ` بينما سجل فرع ${lowestBranch.nameAr} ${formatKwd3(lowestBranch.netKwd)} د.ك`
      : ''
  const unattrCauseClause =
    Math.abs(unattributedNet3) >= 0.0005
      ? `، مع تسجيل ${formatKwd3(unattributedNet3)} د.ك ضمن بند ${UNATTRIBUTED_BRANCH_LABEL_AR}`
      : ''

  const reply = [
    firstBullet,
    `• السبب من البيانات: تصدر فرع ${topBranch.nameAr} بقيمة ${formatKwd3(topBranch.netKwd)} د.ك${secondClause}${lowestClause}${unattrCauseClause}.`,
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
      totalNetKwd: totalNet3,
      totalOrders: totalOrdersInt,
      topBranch: { id: topBranch.id, nameAr: topBranch.nameAr, netKwd: topBranch.netKwd, orders: topBranch.orders },
      unattributed: { labelAr: UNATTRIBUTED_BRANCH_LABEL_AR, netKwd: unattributedNet3, orders: unattributedOrdersInt },
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
      noDataReasonKey: 'pos_order_lines_no_data',
      primaryModel: 'pos.order.line',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('pos_order_lines_no_data'),
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
        noDataReasonKey: 'pos_order_lines_no_data',
        primaryModel: 'pos.order.line',
        executedQueries,
        toolNumbers: [],
        allowedEntityNames: [],
        deterministicReply: buildFeryalNoOdooDataSuggestion('pos_order_lines_no_data'),
        structuredFacts: {},
      }
    }
    items = branchItems
  }

  if (items.length === 0) {
    return {
      hasData: false,
      noDataReasonKey: 'pos_order_lines_no_data',
      primaryModel: 'pos.order.line',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('pos_order_lines_no_data'),
      structuredFacts: {},
    }
  }

  const totalDisc3 = round3(cube.totals.totalDiscountKwd)
  const discCountInt = Math.round(cube.totals.discountedLinesCount)
  const toolNumbers: number[] = [items.length]
  if (Math.abs(totalDisc3) >= 0.0005 || discCountInt > 0) {
    toolNumbers.push(
      cube.totals.totalDiscountKwd,
      totalDisc3,
      cube.totals.avgDiscountPct,
      round1(cube.totals.avgDiscountPct),
      discCountInt,
    )
  }

  const formattedItems = items.map((item) => {
    const net3 = round3(item.netKwd)
    const qtyRounded = round3(item.qty)
    const qtyIsInt = Number.isInteger(qtyRounded)
    toolNumbers.push(item.netKwd, net3, item.qty, qtyRounded)
    if (Math.abs(item.discountKwd) >= 0.0005) {
      toolNumbers.push(item.discountKwd, round3(item.discountKwd))
    }
    allowedEntityNames.push(item.name)
    return {
      name: item.name,
      net3,
      qtyDisplay: qtyIsInt ? formatIntCount(qtyRounded) : String(qtyRounded),
      discount3: round3(item.discountKwd),
    }
  })

  const itemsSummary = formattedItems
    .map((it) => `${it.name} (${formatKwd3(it.net3)} د.ك — الكمية ${it.qtyDisplay})`)
    .join('، ')

  const leader = formattedItems[0]
  const discountPhrase =
    Math.abs(totalDisc3) >= 0.0005
      ? `بلغ إجمالي الخصومات المسجلة ${formatKwd3(totalDisc3)} د.ك عبر ${formatIntCount(discCountInt)} سطور مخصومة`
      : 'لم تُسجل خصومات يدوية على السطور المرحلة'

  const reply = asksDiscounts
    ? [
        `• الرقم: وفق موديل pos.order.line في Odoo للفترة ${period.periodLabelAr} (${scopeLabelAr})، ${discountPhrase}، وأعلى الأصناف مبيعاً: ${itemsSummary}.`,
        `• السبب من البيانات: تصدر الصنف ${leader.name} المبيعات بقيمة ${formatKwd3(leader.net3)} د.ك${Math.abs(totalDisc3) >= 0.0005 ? ` مع تركز الخصومات في ${formatIntCount(discCountInt)} عملية خصم بإجمالي ${formatKwd3(totalDisc3)} د.ك` : ''}.`,
      ].join('\n')
    : [
        `• الرقم: وفق موديل pos.order.line في Odoo للفترة ${period.periodLabelAr} (${scopeLabelAr})، جاءت أعلى ${formatIntCount(items.length)} أصناف مبيعاً كالتالي: ${itemsSummary}.`,
        `• السبب من البيانات: تصدر الصنف ${leader.name} قائمة الأصناف بصافي ${formatKwd3(leader.net3)} د.ك وكمية ${leader.qtyDisplay} وحدة وفق سطور نقاط البيع المرحلة.`,
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
      totalDiscountKwd: totalDisc3,
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
    const openRec3 = round3(receivables.openReceivableKwd)
    const openLines = Math.round(receivables.openLinesCount)
    toolNumbers.push(receivables.openReceivableKwd, openRec3, openLines)

    const incompleteFlag = Boolean(acc?.glIncomplete)
    const warningSuffix = incompleteFlag ? ` — تنبيه: ${FERYAL_INCOMPLETE_GL_WARNING}.` : ''

    const reply = [
      `• الرقم: وفق موديل account.move.line في Odoo حتى الفترة ${period.periodLabelAr}، بلغ صافي الذمم المدينة المفتوحة ${formatKwd3(openRec3)} د.ك موزعة على ${formatIntCount(openLines)} قيد مستحق غير مسوى${warningSuffix}`,
      `• السبب من البيانات: يمثل الرصيد البالغ ${formatKwd3(openRec3)} د.ك عبر ${formatIntCount(openLines)} سطر محاسبي ذمم التحصيل المفتوحة في حسابات الذمم المدينة المرحلة.`,
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
        openReceivableKwd: openRec3,
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
  const revenue3 = round3(rawRevenue)
  const rawTotalExpenses = acc.cogs + acc.expense + acc.depreciation
  const expenses3 = round3(rawTotalExpenses)
  const netProfit3 = round3(acc.operatingProfit)
  const netProfitAbs3 = round3(Math.abs(acc.operatingProfit))
  const incompleteFlag = Boolean(acc.glIncomplete || acc.completeAccrualPosted === false)

  // Phase 5 · Item 7: Net Profit only for closed GL months. Open-month windows report posted
  // revenue/expenses to date and state that Net Profit is unavailable until month close.
  if (!isWindowWithinClosedMonths(acc.to ?? period.to, acc.glClosedThroughDate)) {
    const withheld = closedMonthWithheldReason(acc.glClosedThroughDate)
    toolNumbers.push(rawRevenue, revenue3, rawTotalExpenses, expenses3)
    const warningClause = incompleteFlag ? ` (تحذير: ${FERYAL_INCOMPLETE_GL_WARNING})` : ''
    const reply = [
      `• الرقم: وفق موديل account.move.line في Odoo للفترة ${period.periodLabelAr}، بلغت الإيرادات المرحلة حتى الآن ${formatKwd3(revenue3)} د.ك وإجمالي المصروفات والتكاليف المرحلة ${formatKwd3(expenses3)} د.ك${warningClause}. صافي الربح: غير متاح.`,
      `• السبب من البيانات: ${withheld.ar}؛ الفترة المطلوبة تشمل شهراً لم يُقفل بعد في دفتر الأستاذ العام.`,
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
        revenueKwd: revenue3,
        expensesKwd: expenses3,
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
    revenue3,
    rawTotalExpenses,
    expenses3,
    acc.operatingProfit,
    netProfit3,
    netProfitAbs3,
    acc.cogs,
    round3(acc.cogs),
    acc.expense,
    round3(acc.expense),
  )

  const netLabel =
    netProfit3 >= 0
      ? `صافي ربح تشغيلي ${formatKwd3(netProfit3)} د.ك`
      : `صافي خسارة دفترية ${formatKwd3(netProfitAbs3)} د.ك`

  const warningClause = incompleteFlag ? ` (تحذير: ${FERYAL_INCOMPLETE_GL_WARNING})` : ''

  const reply = [
    `• الرقم: وفق موديل account.move.line في Odoo للفترة ${period.periodLabelAr}، بلغت الإيرادات المرحلة ${formatKwd3(revenue3)} د.ك وإجمالي المصروفات والتكاليف ${formatKwd3(expenses3)} د.ك، والنتيجة ${netLabel}${warningClause}.`,
    `• السبب من البيانات: نتجت القراءة عن مقارنة إيرادات دفتر الأستاذ (${formatKwd3(revenue3)} د.ك) مع التكاليف والمصروفات المرحلة (${formatKwd3(expenses3)} د.ك)${incompleteFlag ? ` مع وجود ${FERYAL_INCOMPLETE_GL_WARNING} لعدم ترحيل كامل قيود الاستحقاق` : ''}.`,
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
      revenueKwd: revenue3,
      expensesKwd: expenses3,
      operatingProfitKwd: netProfit3,
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

    const untaxed3 = round3(matchedVendor.totalUntaxedKwd)
    const total3 = round3(matchedVendor.totalAmountKwd)
    const ordersInt = Math.round(matchedVendor.ordersCount)
    const linesInt = Math.round(matchedVendor.linesCount)
    const companyTotal3 = round3(po.totals.totalAmountKwd)

    const toolNumbers: number[] = [
      matchedVendor.totalUntaxedKwd,
      untaxed3,
      matchedVendor.totalAmountKwd,
      total3,
      ordersInt,
      linesInt,
      po.totals.totalAmountKwd,
      companyTotal3,
    ]
    const allowedEntityNames: string[] = [matchedVendor.vendorName]

    const reply = [
      `• الرقم: وفق موديل purchase.order وpurchase.order.line في Odoo للفترة ${period.periodLabelAr}، بلغت تكلفة أوامر الشراء المؤكدة للمورد ${matchedVendor.vendorName} إجمالي ${formatKwd3(total3)} د.ك (${formatKwd3(untaxed3)} د.ك قبل الضريبة) عبر ${formatIntCount(ordersInt)} أوامر شراء و${formatIntCount(linesInt)} سطور أصناف من إجمالي مشتريات الشركة البالغ ${formatKwd3(companyTotal3)} د.ك.`,
      `• السبب من البيانات: سجلت أوامر الشراء المعتمدة للمورد ${matchedVendor.vendorName} عدد ${formatIntCount(ordersInt)} طلبات توريد بقيمة ${formatKwd3(total3)} د.ك خلال الفترة المستعلم عنها.`,
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
        companyTotalKwd: companyTotal3,
      },
    }
  }

  // Summary across top actual vendors in `purchase.order`
  const topVendors = po.byVendor.slice(0, 5)
  const totalKwd3 = round3(po.totals.totalAmountKwd)
  const untaxedKwd3 = round3(po.totals.totalUntaxedKwd)
  const ordersCountInt = Math.round(po.totals.ordersCount)
  const vendorsCountInt = Math.round(po.totals.vendorsCount)

  const toolNumbers: number[] = [
    po.totals.totalAmountKwd,
    totalKwd3,
    po.totals.totalUntaxedKwd,
    untaxedKwd3,
    ordersCountInt,
    vendorsCountInt,
  ]
  const allowedEntityNames: string[] = []

  const vendorsText = topVendors
    .map((v) => {
      const vTotal3 = round3(v.totalAmountKwd)
      const vOrders = Math.round(v.ordersCount)
      toolNumbers.push(v.totalAmountKwd, vTotal3, vOrders)
      allowedEntityNames.push(v.vendorName)
      return `${v.vendorName} (${formatKwd3(vTotal3)} د.ك — ${formatIntCount(vOrders)} أوامر)`
    })
    .join('، ')

  const topOne = topVendors[0]
  const topOneTotal3 = round3(topOne.totalAmountKwd)

  const reply = [
    `• الرقم: وفق موديل purchase.order في Odoo للفترة ${period.periodLabelAr}، بلغ إجمالي أوامر الشراء المؤكدة ${formatKwd3(totalKwd3)} د.ك عبر ${formatIntCount(ordersCountInt)} أوامر شراء موزعة على ${formatIntCount(vendorsCountInt)} موردين، وأبرزهم: ${vendorsText}.`,
    `• السبب من البيانات: تصدر المورد ${topOne.vendorName} تكاليف التوريد بقيمة ${formatKwd3(topOneTotal3)} د.ك من إجمالي المشتريات البالغ ${formatKwd3(totalKwd3)} د.ك.`,
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

  const transfer3 = round3(wh.totals.ckToBranchTransferKwd)
  const inbound3 = round3(wh.totals.inboundSupplierKwd)
  const scrap3 = round3(wh.totals.scrapKwd)
  const movesInt = Math.round(wh.totals.doneMovesCount)
  const scrapsInt = Math.round(wh.totals.scrapOrdersCount)

  const toolNumbers: number[] = [
    wh.totals.ckToBranchTransferKwd,
    transfer3,
    wh.totals.inboundSupplierKwd,
    inbound3,
    movesInt,
    scrapsInt,
  ]
  if (Math.abs(scrap3) >= 0.0005) {
    toolNumbers.push(wh.totals.scrapKwd, scrap3)
  }
  const allowedEntityNames: string[] = []

  const scrapClause =
    Math.abs(scrap3) >= 0.0005
      ? `فيما بلغ الهدر المسجل ${formatKwd3(scrap3)} د.ك عبر ${formatIntCount(scrapsInt)} أوامر إتلاف`
      : 'دون أوامر إتلاف مسجلة'

  const reply = [
    `• الرقم: وفق موديل stock.move وstock.scrap في Odoo للفترة ${period.periodLabelAr}، سجل المخزن ${formatIntCount(movesInt)} حركة مخزنية مكتملة بقيمة تحويلات للمطاعم ${formatKwd3(transfer3)} د.ك وتوريد مستلم ${formatKwd3(inbound3)} د.ك، ${scrapClause}.`,
    `• السبب من البيانات: تعكس الحركات البالغة ${formatIntCount(movesInt)} حركة نشاط التوريد والتحويل الصادر للفروع${Math.abs(scrap3) >= 0.0005 ? ` مقابل ${formatIntCount(scrapsInt)} عمليات إتلاف مسجلة بقيمة ${formatKwd3(scrap3)} د.ك` : ''}.`,
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
    type CubeBranchCell = OdooPeriodCube['byBranch']['avenues']
    const bA = (cubeA?.byBranch as Partial<Record<ApprovedFeryalBranchId, CubeBranchCell>> | undefined)?.[
      targetBranchId
    ]
    const bB = (cubeB?.byBranch as Partial<Record<ApprovedFeryalBranchId, CubeBranchCell>> | undefined)?.[
      targetBranchId
    ]
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

  const netA3 = round3(rawNetA)
  const ordersAInt = Math.round(rawOrdersA)
  const netB3 = round3(rawNetB)
  const ordersBInt = Math.round(rawOrdersB)
  const rawDiff = rawNetA - rawNetB
  const diff3 = round3(netA3 - netB3)
  const absDiff3 = round3(Math.abs(diff3))
  const ordersDiffInt = ordersAInt - ordersBInt
  const absOrdersDiffInt = Math.abs(ordersDiffInt)
  const pct1 = netB3 > 0 ? round1(((netA3 - netB3) / netB3) * 100) : 0
  const absPct1 = round1(Math.abs(pct1))

  const toolNumbers: number[] = [
    rawNetA,
    netA3,
    ordersAInt,
    rawNetB,
    netB3,
    ordersBInt,
    rawDiff,
    diff3,
    absDiff3,
    ordersDiffInt,
    absOrdersDiffInt,
    pct1,
    absPct1,
    ...cutoffNumbers,
  ]

  const directionWord = diff3 > 0 ? 'بارتفاع' : diff3 < 0 ? 'بانخفاض' : 'بفارق'
  const pctSegment = netB3 > 0 ? ` (${formatPct1(absPct1)}%)` : ''
  const ordersDirection =
    ordersDiffInt > 0
      ? `زيادة الطلبات بعدد ${formatIntCount(absOrdersDiffInt)} طلبات`
      : ordersDiffInt < 0
        ? `تراجع الطلبات بعدد ${formatIntCount(absOrdersDiffInt)} طلبات`
        : `ثبات عدد الطلبات بفارق ${formatIntCount(absOrdersDiffInt)} طلبات`
  // Phase 5 · Item 3: when sales and orders move in opposite directions (or orders are flat while
  // sales move), the gap is NOT explained by order count — it comes from the average basket.
  const aovA3 = ordersAInt > 0 ? round3(rawNetA / ordersAInt) : 0
  const aovB3 = ordersBInt > 0 ? round3(rawNetB / ordersBInt) : 0
  const salesSign = Math.sign(diff3)
  const ordersSign = Math.sign(ordersDiffInt)
  const directionsDisagree = salesSign !== 0 && salesSign !== ordersSign
  toolNumbers.push(aovA3, aovB3)
  const causeSentence = directionsDisagree
    ? `${diff3 > 0 ? 'ارتفعت' : 'انخفضت'} المبيعات ${ordersSign === 0 ? 'مع ثبات عدد الطلبات' : ordersSign > 0 ? `رغم زيادة الطلبات بعدد ${formatIntCount(absOrdersDiffInt)} طلبات` : `رغم تراجع الطلبات بعدد ${formatIntCount(absOrdersDiffInt)} طلبات`}، لذلك يعود الفارق البالغ ${formatKwd3(absDiff3)} د.ك إلى تغيّر متوسط الطلب من ${formatKwd3(aovB3)} د.ك في ${periodB.periodLabelAr} إلى ${formatKwd3(aovA3)} د.ك في ${periodA.periodLabelAr}.`
    : `يعود الفارق البالغ ${formatKwd3(absDiff3)} د.ك بين الفترتين إلى ${ordersDirection} بين ${periodA.periodLabelAr} (${formatIntCount(ordersAInt)} طلبات) و${periodB.periodLabelAr} (${formatIntCount(ordersBInt)} طلبات).`

  const reply = [
    `• الرقم: وفق موديل pos.order في Odoo (${scopeLabelAr})${windowClause}، بلغ صافي مبيعات الفترة ${periodA.periodLabelAr} قيمة ${formatKwd3(netA3)} د.ك عبر ${formatIntCount(ordersAInt)} طلبات مقابل ${formatKwd3(netB3)} د.ك عبر ${formatIntCount(ordersBInt)} طلبات في الفترة ${periodB.periodLabelAr}، ${directionWord} قدره ${formatKwd3(absDiff3)} د.ك${pctSegment}.`,
    `• السبب من البيانات: ${causeSentence}`,
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
      periodA: { ...periodA, netKwd: netA3, orders: ordersAInt },
      periodB: { ...periodB, netKwd: netB3, orders: ordersBInt },
      deltaNetKwd: diff3,
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
  type CubeBranchCell = OdooPeriodCube['byBranch']['avenues']
  const scopeNetRaw = targetBranchId
    ? (cube.byBranch as Partial<Record<ApprovedFeryalBranchId, CubeBranchCell>> | undefined)?.[
        targetBranchId
      ]?.netKwd ?? 0
    : cube.totals.netSalesKwd
  const scopeNet3 = round3(scopeNetRaw)

  const brandRows = APPROVED_FERYAL_BRAND_LIST.map((meta) => {
    const byBranchBrands = cube.brandByBranch as
      | Partial<Record<ApprovedFeryalBranchId, Record<string, { netKwd: number; qty: number; linesCount: number }>>>
      | undefined
    const raw = targetBranchId
      ? byBranchBrands?.[targetBranchId]?.[meta.id]
      : cube.byBrand?.[meta.id]
    const rawNetKwd = raw?.netKwd ?? 0
    const netKwd = round3(rawNetKwd)
    const rawQty = raw?.qty ?? 0
    const qtyInt = Math.round(rawQty)
    const linesInt = Math.round(raw?.linesCount ?? 0)
    const sharePct1 = scopeNet3 > 0 ? round1((netKwd / scopeNet3) * 100) : 0
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
  const brandsTotal3 = round3(brandRows.reduce((s, r) => s + r.netKwd, 0))

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
        noDataReasonKey: 'pos_order_lines_no_data',
        primaryModel: 'pos.order.line',
        executedQueries,
        toolNumbers: [],
        allowedEntityNames: [],
        deterministicReply: buildFeryalNoOdooDataSuggestion('pos_order_lines_no_data'),
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
      scopeNet3,
      topBrand.rawNetKwd,
      topBrand.netKwd,
    ]

    const reply = [
      `• الرقم: وفق موديل pos.order.line في Odoo للفترة ${period.periodLabelAr} (${scopeLabelAr})، سجلت علامة ${targetBrand.nameAr} صافي مبيعات ${formatKwd3(targetBrand.netKwd)} د.ك عبر ${formatIntCount(targetBrand.qtyInt)} وحدة مباعة بحصة ${formatPct1(targetBrand.sharePct1)}% من صافي المبيعات البالغ ${formatKwd3(scopeNet3)} د.ك.`,
      `• السبب من البيانات: حققت علامة ${targetBrand.nameAr} قيمة ${formatKwd3(targetBrand.netKwd)} د.ك من ${formatIntCount(targetBrand.linesInt)} سطور بيع مرحلة خلال الفترة.`,
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
        scopeNetKwd: scopeNet3,
      },
    }
  }

  if (brandsTotal3 <= 0) {
    return {
      hasData: false,
      noDataReasonKey: 'pos_order_lines_no_data',
      primaryModel: 'pos.order.line',
      executedQueries,
      toolNumbers: [],
      allowedEntityNames: [],
      deterministicReply: buildFeryalNoOdooDataSuggestion('pos_order_lines_no_data'),
      structuredFacts: {},
    }
  }

  const toolNumbers: number[] = [
    brandRows.length,
    rawBrandsTotal,
    brandsTotal3,
    scopeNetRaw,
    scopeNet3,
    Math.round(cube.totals.orders),
  ]
  for (const r of brandRows) {
    if (r.netKwd !== 0 || r.qtyInt > 0) {
      toolNumbers.push(r.rawNetKwd, r.netKwd, r.rawQty, r.qtyInt, r.linesInt, r.sharePct1)
    }
  }

  const brandListText = brandRows
    .map((r) =>
      r.netKwd === 0 && r.qtyInt <= 0
        ? `${r.nameAr} (لا مبيعات مسجلة)`
        : `${r.nameAr} ${formatKwd3(r.netKwd)} د.ك (${formatPct1(r.sharePct1)}%)`,
    )
    .join('، ')

  const topBrand = brandRows[0]
  const secondBrand = brandRows[1]
  const activeBrands = brandRows.filter((r) => r.netKwd !== 0 || r.qtyInt > 0)
  const lowestBrand = activeBrands[activeBrands.length - 1] ?? brandRows[brandRows.length - 1]

  const secondBrandClause =
    secondBrand && (secondBrand.netKwd !== 0 || secondBrand.qtyInt > 0)
      ? ` تلتها ${secondBrand.nameAr} بقيمة ${formatKwd3(secondBrand.netKwd)} د.ك`
      : ''
  const lowestBrandClause =
    lowestBrand.id !== topBrand.id && (lowestBrand.netKwd !== 0 || lowestBrand.qtyInt > 0)
      ? ` بينما سجلت ${lowestBrand.nameAr} قيمة ${formatKwd3(lowestBrand.netKwd)} د.ك`
      : ''

  const reply = [
    `• الرقم: وفق موديل pos.order.line في Odoo للفترة ${period.periodLabelAr} (${scopeLabelAr})، توزعت مبيعات العلامات التجارية الـ ${formatIntCount(brandRows.length)} كالتالي: ${brandListText}، بإجمالي مبيعات منسوبة للعلامات ${formatKwd3(brandsTotal3)} د.ك من صافي مبيعات ${formatKwd3(scopeNet3)} د.ك.`,
    `• السبب من البيانات: تصدرت علامة ${topBrand.nameAr} بقيمة ${formatKwd3(topBrand.netKwd)} د.ك (${formatPct1(topBrand.sharePct1)}%)${secondBrandClause}${lowestBrandClause}.`,
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
      brandsTotalKwd: brandsTotal3,
      scopeNetKwd: scopeNet3,
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

  const finalize = async (params: {
    reply: string
    status: FeryalReplyStatus
    executedQueries: FeryalExecutedOdooQuery[]
    verifier: FeryalNumericVerificationResult
    toolNumbers: number[]
    allowedDateStrings?: readonly string[]
    allowedEntityNames?: readonly string[]
    period: { from: string; to: string } | null
    structuredFacts?: Record<string, unknown>
    llmCandidateRejected?: boolean
    sourceModel?: string
    /** No advisor block (e.g. Qurain before audit, FAS Fahaheel canteen, unknown branch). */
    skipAdvisory?: boolean
  }): Promise<AskFeryalOdooAgentResult> => {
    let workingReply = params.reply
    let combinedToolNumbers = [...params.toolNumbers]
    const baseAllowedDates = [
      ...(params.allowedDateStrings ?? []),
      ...(params.period ? buildAllowedDateStrings(params.period.from, params.period.to) : []),
    ]
    const baseAllowedEntities = [
      ...(params.allowedEntityNames ?? []),
      'Odoo 17',
      ...(FAS_FAHAHEEL_POS_CONFIG_ID !== null ? [`pos.config ${FAS_FAHAHEEL_POS_CONFIG_ID}`] : []),
    ]

    let advisory: { findings: string[]; advisors: string[]; dataGaps?: CouncilDataGap[] } | undefined
    let usedFingerprints: string[] = []
    let combinedAllowedDates = [...baseAllowedDates]
    let combinedAllowedEntities = [...baseAllowedEntities]

    if (
      input.council &&
      !params.skipAdvisory &&
      (params.status === 'answered' || params.status === 'no_odoo_data')
    ) {
      const seenClone = input.seenFingerprints ? new Set<string>(input.seenFingerprints) : undefined
      const block = buildAdvisoryBlock(
        {
          question: rawQuestion,
          branchId: safeDetectBranchId(rawQuestion),
          council: input.council,
          seenFingerprints: seenClone,
          formatSync: (iso) => formatKuwaitDateTime(iso, 'ar'),
        },
        (text, allowed, opts) => verifyFeryalReplyNumbers(text, allowed, opts),
      )
      if (block) {
        const bridge =
          params.status === 'no_odoo_data'
            ? '\n• المتاح الآن من تقارير المستشارين (آخر بيانات Odoo المتزامنة):'
            : ''
        const candidateCombined = `${workingReply}${bridge}\n${block.text}`
        const nextToolNumbers = [...combinedToolNumbers, ...block.allowedNumbers]
        const nextAllowedDates = [...new Set([...combinedAllowedDates, ...block.allowedDateStrings])]
        const nextAllowedEntities = [
          ...new Set([...combinedAllowedEntities, ...block.allowedEntityNames]),
        ]

        // Post-synthesis number & Estimate-formula guard on the full combined reply
        const postGuard = verifyFeryalReplyNumbers(candidateCombined, nextToolNumbers, {
          allowedDateStrings: nextAllowedDates,
          allowedEntityNames: nextAllowedEntities,
        })
        const estimatesValid = candidateCombined
          .split('\n')
          .filter((l) => /الأثر المتوقع|تقدير/.test(l))
          .every((l) => /تقدير:\s*.+\s*=\s*.+/.test(l))

        if (postGuard.valid && estimatesValid) {
          workingReply = candidateCombined
          combinedToolNumbers = nextToolNumbers
          combinedAllowedDates = nextAllowedDates
          combinedAllowedEntities = nextAllowedEntities
          usedFingerprints = block.findings
          if (input.seenFingerprints instanceof Set) {
            for (const fp of usedFingerprints) input.seenFingerprints.add(fp)
          }
          advisory = {
            findings: block.findings,
            advisors: block.advisors,
            dataGaps: block.dataGaps,
          }
        }
      }
    }

    let source: FeryalAnswerSource | null = null
    let finalVerifier = params.verifier

    if (params.status !== 'competitor_refusal') {
      let lastSyncAt: string | null = null
      try {
        const getLastSyncAt = input.dataSource
          ? input.dataSource.getLastSyncAt
          : params.status === 'answered'
            ? DEFAULT_ODOO_DATA_SOURCE.getLastSyncAt
            : undefined
        lastSyncAt = (await getLastSyncAt?.()) ?? input.council?.generatedAt ?? null
      } catch {
        lastSyncAt = input.council?.generatedAt ?? null
      }

      const modelLabel = params.sourceModel ?? params.executedQueries[0]?.model ?? 'pos.order'
      source = {
        system: 'Odoo 17',
        model: modelLabel,
        period: params.period,
        lastSyncAt,
      }
      if (lastSyncAt) {
        combinedAllowedDates.push(formatKuwaitDateTime(lastSyncAt, 'ar'))
      }
      workingReply = `${workingReply}\n${formatFeryalSourceFooter(source)}`
      finalVerifier = verifyFeryalReplyNumbers(workingReply, combinedToolNumbers, {
        allowedDateStrings: [...new Set(combinedAllowedDates)],
        allowedEntityNames: [...new Set(combinedAllowedEntities)],
      })
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
      verifier: finalVerifier,
      ...(params.llmCandidateRejected ? { llmCandidateRejected: true } : {}),
      finalReply: workingReply,
    }
    if (!input.skipAuditLog) {
      await recordFeryalAuditEntry(auditEntry)
    }
    return {
      reply: workingReply,
      status: params.status,
      executedQueries: params.executedQueries,
      verifier: finalVerifier,
      toolNumbers: combinedToolNumbers,
      period: params.period,
      facts: numericFactsFromStructured(params.structuredFacts ?? null, params.period),
      source,
      auditEntry,
      usedFingerprints,
      ...(advisory ? { advisory } : {}),
    }
  }

  const defaultResolvedPeriod = rawQuestion
    ? resolveFeryalQuestionPeriod(
        rawQuestion,
        nowMs,
        validateFeryalContextDefaults({
          period: input.context?.period ?? input.period,
          customFrom: input.context?.customFrom ?? input.customFrom,
          customTo: input.context?.customTo ?? input.customTo,
          branch: input.context?.branch ?? input.branch,
          brand: input.context?.brand ?? input.brand,
          channel: input.context?.channel ?? input.channel,
        }),
      )
    : null

  const finalizeNoData = (
    reasonKey: NoOdooDataReasonKey,
    executedQueries: FeryalExecutedOdooQuery[] = [],
    period: { from: string; to: string } | null = defaultResolvedPeriod
      ? { from: defaultResolvedPeriod.from, to: defaultResolvedPeriod.to }
      : null,
  ): Promise<AskFeryalOdooAgentResult> => {
    const reply = buildFeryalNoOdooDataSuggestion(reasonKey)
    const allowedEntityNames =
      FAS_FAHAHEEL_POS_CONFIG_ID !== null ? [`pos.config ${FAS_FAHAHEEL_POS_CONFIG_ID}`] : []
    const verifier = verifyFeryalReplyNumbers(reply, [], { allowedEntityNames })
    const skipAdvisory =
      reasonKey === 'qurain_central_kitchen' ||
      reasonKey === 'fas_fahaheel_canteen' ||
      reasonKey === 'unknown_branch'
    return finalize({
      skipAdvisory,
      reply,
      status: 'no_odoo_data',
      executedQueries,
      verifier,
      toolNumbers: [],
      allowedEntityNames,
      period,
      sourceModel: sourceModelForNoDataReason(reasonKey, executedQueries, rawQuestion),
    })
  }

  if (!rawQuestion) {
    return finalizeNoData('generic', [], null)
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

  // 2. Unlinked Non-Odoo Topics -> specific 1-line missing Odoo model + linking suggestion
  const unlinkedCheck = isUnlinkedNonOdooTopic(rawQuestion)
  if (unlinkedCheck.unlinked) {
    return finalizeNoData(unlinkedCheck.reasonKey ?? 'generic')
  }

  // 2b. «الفحاحيل» is the FAS Fahaheel school-canteen register, never Al-Kout.
  if (FAS_FAHAHEEL_POS_CONFIG_ID !== null && /(الفحاحيل|فحاحيل|\bfahaheel\b)/i.test(normalizeArabicText(rawQuestion))) {
    return finalizeNoData('fas_fahaheel_canteen')
  }

  // 2c. «القرين» / «المطبخ المركزي» is the active central kitchen (owner, 2026-11-18).
  // Until `qurain` is added to pos-registry.json (after the Mac double-count audit), return «غير متاح».
  if (isQurainCentralKitchenQuestion(rawQuestion) && !isQurainRegistryEnabled()) {
    return finalizeNoData('qurain_central_kitchen')
  }

  // 3. Branch Scope Check (7 approved branches + school canteens + exhibitions, plus Qurain once audited)
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
  const resolvedPeriod = resolveFeryalQuestionPeriod(rawQuestion, nowMs, validatedDefaults)
  const toolKind = detectOdooToolKind(
    rawQuestion,
    effectiveBranchId,
    effectiveBrandDetection,
    comparisonPeriods !== null,
    branchDetection.isBranchRanking,
  )

  if (toolKind === 'hr_overtime') {
    return finalizeNoData('hr_overtime', [], { from: resolvedPeriod.from, to: resolvedPeriod.to })
  }

  if (toolKind === 'unknown') {
    const unknownReason: NoOdooDataReasonKey =
      detectAdvisoryTopic(rawQuestion) === 'delivery' ? 'delivery_pause_matrix' : 'generic'
    return finalizeNoData(unknownReason, [], { from: resolvedPeriod.from, to: resolvedPeriod.to })
  }

  const dataSource: FeryalOdooDataSource = {
    ...DEFAULT_ODOO_DATA_SOURCE,
    ...input.dataSource,
  }

  let toolOutput: ToolExecutionOutput
  let activePeriod = { from: resolvedPeriod.from, to: resolvedPeriod.to }
  let activeAllowedDateStrings = resolvedPeriod.allowedDateStrings

  switch (toolKind) {
    case 'pos_comparison': {
      const comp = comparisonPeriods!
      const minFrom = comp.periodA.from <= comp.periodB.from ? comp.periodA.from : comp.periodB.from
      const maxTo = comp.periodA.to >= comp.periodB.to ? comp.periodA.to : comp.periodB.to
      activePeriod = { from: minFrom, to: maxTo }
      activeAllowedDateStrings = comp.allowedDateStrings
      toolOutput = await runPosComparisonTool({
        dataSource,
        comparison: comp,
        targetBranchId: effectiveBranchId,
        referenceNowMs: nowMs,
      })
      break
    }
    case 'pos_brands':
      toolOutput = await runPosBrandsTool({
        dataSource,
        period: resolvedPeriod,
        targetBrandId: effectiveBrandDetection.brandId,
        targetBranchId: effectiveBranchId,
        referenceNowMs: nowMs,
      })
      break
    case 'pos_orders':
      toolOutput = await runPosOrdersTool({
        dataSource,
        period: resolvedPeriod,
        targetBranchId: effectiveBranchId,
        targetChannelId: effectiveChannelId,
        isBranchRanking: branchDetection.isBranchRanking || isLowestBranchQuestion(rawQuestion),
        rankDirection: isLowestBranchQuestion(rawQuestion) ? 'lowest' : 'top',
        referenceNowMs: nowMs,
      })
      if (!toolOutput.hasData && isSalarySeasonReadinessQuestion(rawQuestion)) {
        toolOutput = { ...toolOutput, noDataReasonKey: 'season_window_no_data' }
      }
      break
    case 'pos_order_lines':
      toolOutput = await runPosOrderLinesTool({
        dataSource,
        period: resolvedPeriod,
        targetBranchId: effectiveBranchId,
        question: rawQuestion,
        referenceNowMs: nowMs,
      })
      break
    case 'inventory_on_hand':
      return finalizeNoData('inventory_on_hand', [], { from: resolvedPeriod.from, to: resolvedPeriod.to })
    case 'account_move_lines':
      // A branch-level expense question cannot be answered from the company-wide GL feed.
      if (effectiveBranchId && branchDetection.branchId !== null) {
        return finalizeNoData('gl_branch_not_partitioned', [], { from: resolvedPeriod.from, to: resolvedPeriod.to })
      }
      toolOutput = await runAccountMoveLinesTool({
        dataSource,
        period: resolvedPeriod,
        question: rawQuestion,
        referenceNowMs: nowMs,
      })
      break
    case 'purchase_orders':
      toolOutput = await runPurchaseOrdersTool({
        dataSource,
        period: resolvedPeriod,
        question: rawQuestion,
        referenceNowMs: nowMs,
      })
      break
    case 'stock_moves':
      toolOutput = await runStockMovesAndScrapTool({
        dataSource,
        period: resolvedPeriod,
        referenceNowMs: nowMs,
      })
      break
    case 'hr_employees':
      toolOutput = await runHrEmployeesTool({
        dataSource,
        period: resolvedPeriod,
        referenceNowMs: nowMs,
      })
      break
  }

  if (!toolOutput.hasData) {
    return finalizeNoData(
      toolOutput.noDataReasonKey ?? 'generic',
      toolOutput.executedQueries,
      activePeriod,
    )
  }

  const verifierOptions = {
    allowedDateStrings: activeAllowedDateStrings,
    allowedEntityNames: toolOutput.allowedEntityNames,
    requireGlIncompleteWarning: toolOutput.requireGlIncompleteWarning,
  }

  // 5. Optional candidate phrasing strictly gated by `enforceVerifiedFeryalReply`
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
          verifierOptions,
        )
        if (candidateCheck.accepted) {
          return finalize({
            reply: candidateCheck.reply,
            status: 'answered',
            executedQueries: toolOutput.executedQueries,
            verifier: candidateCheck.verifier,
            toolNumbers: toolOutput.toolNumbers,
            allowedDateStrings: activeAllowedDateStrings,
            allowedEntityNames: toolOutput.allowedEntityNames,
            period: activePeriod,
            structuredFacts: toolOutput.structuredFacts,
            sourceModel: toolOutput.primaryModel,
          })
        }
        llmCandidateRejected = true
      }
    } catch {
      llmCandidateRejected = true
    }
  }

  // 6. Mandatory Numeric Verification on Final Grounded Reply
  const verified = enforceVerifiedFeryalReply(
    toolOutput.deterministicReply,
    toolOutput.toolNumbers,
    verifierOptions,
  )

  if (!verified.accepted) {
    const fallbackReply = buildFeryalNoOdooDataSuggestion(toolOutput.noDataReasonKey ?? 'generic')
    return finalize({
      reply: fallbackReply,
      status: 'verifier_rejected',
      executedQueries: toolOutput.executedQueries,
      verifier: verified.verifier,
      toolNumbers: toolOutput.toolNumbers,
      allowedDateStrings: activeAllowedDateStrings,
      allowedEntityNames: toolOutput.allowedEntityNames,
      period: activePeriod,
      structuredFacts: toolOutput.structuredFacts,
      llmCandidateRejected,
      sourceModel: toolOutput.primaryModel,
    })
  }

  return finalize({
    reply: verified.reply,
    status: 'answered',
    executedQueries: toolOutput.executedQueries,
    verifier: verified.verifier,
    toolNumbers: toolOutput.toolNumbers,
    allowedDateStrings: activeAllowedDateStrings,
    allowedEntityNames: toolOutput.allowedEntityNames,
    period: activePeriod,
    structuredFacts: toolOutput.structuredFacts,
    llmCandidateRejected,
    sourceModel: toolOutput.primaryModel,
  })
}
