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
  APPROVED_FERYAL_BRAND_LIST,
  APPROVED_FERYAL_BRANDS,
  APPROVED_FERYAL_BRANCHES,
  APPROVED_FERYAL_CHANNEL_LIST,
  detectOdooToolKind,
  detectTargetBranchFromQuestion,
  detectTargetBrandFromQuestion,
  detectTargetChannelFromQuestion,
  isBranchRankingQuestion,
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

  const canteenBranchRaw = cube.byBranch['school-canteens']
  const canteenRaw = targetChannelId ? cellOf(canteenBranchRaw?.channels) : canteenBranchRaw
  const includeCanteenInRows =
    targetBranchId === 'school-canteens' ||
    (canteenRaw?.netKwd ?? 0) !== 0 ||
    (canteenRaw?.orders ?? 0) > 0
  const activeBranchMetas = includeCanteenInRows
    ? ALL_FERYAL_BRANCHES
    : APPROVED_FERYAL_BRANCHES

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
    if (!targetRow || (targetRow.orders <= 0 && targetRow.netKwd <= 0)) {
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
  const restaurantRows = branchRows.filter((r) => r.id !== 'school-canteens')
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
    period: { from: string; to: string } | null
    structuredFacts?: Record<string, unknown>
    llmCandidateRejected?: boolean
    sourceModel?: string
  }): Promise<AskFeryalOdooAgentResult> => {
    let source: FeryalAnswerSource | null = null
    if (params.status === 'answered' && params.sourceModel) {
      let lastSyncAt: string | null = null
      try {
        const getLastSyncAt = input.dataSource
          ? input.dataSource.getLastSyncAt
          : DEFAULT_ODOO_DATA_SOURCE.getLastSyncAt
        lastSyncAt = (await getLastSyncAt?.()) ?? null
      } catch {
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
      auditEntry,
    }
  }

  const finalizeNoData = (
    reasonKey: NoOdooDataReasonKey,
    executedQueries: FeryalExecutedOdooQuery[] = [],
    period: { from: string; to: string } | null = null,
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

  // 2. Unlinked Non-Odoo Topics -> starts with `لا أملك بيانات من Odoo عن هذا` + linking suggestion
  const unlinkedCheck = isUnlinkedNonOdooTopic(rawQuestion)
  if (unlinkedCheck.unlinked) {
    return finalizeNoData(unlinkedCheck.reasonKey ?? 'generic')
  }

  // 2b. «الفحاحيل» is the FAS Fahaheel school-canteen register, never Al-Kout.
  if (FAS_FAHAHEEL_POS_CONFIG_ID !== null && /(الفحاحيل|فحاحيل|\bfahaheel\b)/i.test(normalizeArabicText(rawQuestion))) {
    return finalizeNoData('fas_fahaheel_canteen')
  }

  // 3. Branch Scope Check (7 approved branches + school canteens only)
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

  if (toolKind === 'unknown') {
    return finalizeNoData('generic', [], { from: resolvedPeriod.from, to: resolvedPeriod.to })
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
    requireFourPartStructure: true,
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
      period: activePeriod,
      structuredFacts: toolOutput.structuredFacts,
      llmCandidateRejected,
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
    sourceModel: toolOutput.primaryModel,
  })
}
