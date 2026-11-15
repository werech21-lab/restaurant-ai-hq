import { existsSync, readFileSync, writeFileSync } from 'node:fs'
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
import posRegistry from '@/lib/odoo/pos-registry.json'

const KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000

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

export type ApprovedFeryalBranchId =
  | '360-mall'
  | 'salmiya'
  | 'al-kout'
  | 'ardiya'
  | 'promenade'
  | 'avenues'
  | 'assima'

export type ApprovedFeryalBrandId =
  | 'china-garden'
  | 'franks'
  | 'tahina'
  | 'farm-brown'
  | 'noodle-bar'
  | 'karak-cafeteria'

export interface FeryalBranchMeta {
  id: ApprovedFeryalBranchId
  nameAr: string
  nameEn: string
  aliases: readonly string[]
}

export const APPROVED_FERYAL_BRANCHES: readonly FeryalBranchMeta[] = [
  {
    id: '360-mall',
    nameAr: 'مول 360',
    nameEn: '360 Mall',
    aliases: ['مول 360', '360 مول', '360 mall', '360-mall', 'فرع 360', 'مجمع 360', '360'],
  },
  {
    id: 'salmiya',
    nameAr: 'السالمية',
    nameEn: 'Salmiya',
    aliases: ['السالمية', 'سالمية', 'السالميه', 'سالميه', 'salmiya'],
  },
  {
    id: 'al-kout',
    nameAr: 'الكوت',
    nameEn: 'Al-Kout',
    aliases: ['الكوت', 'كوت', 'الفحاحيل', 'al-kout', 'alkout', 'al kout', 'kout'],
  },
  {
    id: 'ardiya',
    nameAr: 'العارضية',
    nameEn: 'Ardiya',
    aliases: ['العارضية', 'عارضية', 'العارضيه', 'عارضيه', 'ardiya', 'ardhiya'],
  },
  {
    id: 'promenade',
    nameAr: 'بروميناد',
    nameEn: 'Promenade',
    aliases: ['بروميناد', 'البروميناد', 'promenade'],
  },
  {
    id: 'avenues',
    nameAr: 'الأفنيوز',
    nameEn: 'Avenues',
    aliases: ['الأفنيوز', 'الافنيوز', 'أفنيوز', 'افنيوز', 'avenues', 'the avenues'],
  },
  {
    id: 'assima',
    nameAr: 'العاصمة',
    nameEn: 'Assima',
    aliases: ['العاصمة', 'العاصمه', 'عاصمة مول', 'assima', 'al-assima'],
  },
] as const

export const APPROVED_FERYAL_BRANDS: Readonly<Record<ApprovedFeryalBrandId, string>> = {
  'china-garden': 'تشاينا جاردن',
  franks: 'فرانكس',
  tahina: 'طحينة',
  'farm-brown': 'فارم براون',
  'noodle-bar': 'ذا نودل بار',
  'karak-cafeteria': 'كافيتيريا كرك',
}

export interface FeryalBrandMeta {
  id: ApprovedFeryalBrandId
  nameAr: string
  nameEn: string
  aliases: readonly string[]
}

export const APPROVED_FERYAL_BRAND_LIST: readonly FeryalBrandMeta[] = [
  {
    id: 'china-garden',
    nameAr: 'تشاينا جاردن',
    nameEn: 'China Garden',
    aliases: ['تشاينا جاردن', 'تشاينا غاردن', 'شينا جاردن', 'china garden', 'china-garden'],
  },
  {
    id: 'franks',
    nameAr: 'فرانكس',
    nameEn: "Frank's",
    aliases: ['فرانكس', "frank's", 'franks'],
  },
  {
    id: 'tahina',
    nameAr: 'طحينة',
    nameEn: 'Tahina',
    aliases: ['طحينة', 'طحينه', 'شاورما طحينة', 'شاورما طحينه', 'tahina'],
  },
  {
    id: 'farm-brown',
    nameAr: 'فارم براون',
    nameEn: 'Farm Brown',
    aliases: ['فارم براون', 'farm brown', 'farm-brown'],
  },
  {
    id: 'noodle-bar',
    nameAr: 'ذا نودل بار',
    nameEn: 'The Noodle Bar',
    aliases: ['ذا نودل بار', 'نودل بار', 'the noodle bar', 'noodle bar', 'noodle-bar'],
  },
  {
    id: 'karak-cafeteria',
    nameAr: 'كافيتيريا كرك',
    nameEn: 'Karak Cafeteria',
    aliases: ['كافيتيريا كرك', 'كرك كافيتيريا', 'كرك كافتيريا', 'شاي كرك', 'karak cafeteria', 'karak-cafeteria'],
  },
] as const

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
  auditEntry: FeryalAuditLogEntry
}

const BRANCH_META_BY_ID = new Map<ApprovedFeryalBranchId, FeryalBranchMeta>(
  APPROVED_FERYAL_BRANCHES.map((b) => [b.id, b]),
)

function normalizeDigits(text: string): string {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩'
  const extendedArabic = '۰۱۲۳۴۵۶۷۸۹'
  let out = ''
  for (const ch of text) {
    const idx1 = arabicIndic.indexOf(ch)
    if (idx1 >= 0) {
      out += String(idx1)
      continue
    }
    const idx2 = extendedArabic.indexOf(ch)
    if (idx2 >= 0) {
      out += String(idx2)
      continue
    }
    if (ch === '٫') {
      out += '.'
      continue
    }
    if (ch === '٬') {
      out += ','
      continue
    }
    out += ch
  }
  return out
}

function normalizeArabicText(text: string): string {
  return normalizeDigits(text)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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

function getKuwaitCalendarParts(nowMs = Date.now()): {
  year: number
  month: number
  day: number
  iso: string
} {
  const kwDate = new Date(nowMs + KUWAIT_OFFSET_MS)
  const year = kwDate.getUTCFullYear()
  const month = kwDate.getUTCMonth() + 1
  const day = kwDate.getUTCDate()
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return { year, month, day, iso }
}

function shiftIsoDateDays(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map((x) => Number(x))
  const utcMs = Date.UTC(y, m - 1, d) + deltaDays * 86_400_000
  const dt = new Date(utcMs)
  return `${String(dt.getUTCFullYear()).padStart(4, '0')}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false
  }
  const dt = new Date(Date.UTC(year, month - 1, day))
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() + 1 === month &&
    dt.getUTCDate() === day
  )
}

function buildAllowedDateStrings(fromIso: string, toIso: string): string[] {
  const out = new Set<string>()
  for (const iso of [fromIso, toIso]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue
    out.add(iso)
    const [yyyy, mm, dd] = iso.split('-')
    const dNum = Number(dd)
    const mNum = Number(mm)
    out.add(`${dd}/${mm}/${yyyy}`)
    out.add(`${dNum}/${mNum}/${yyyy}`)
    out.add(`${dd}/${mm}`)
    out.add(`${dNum}/${mNum}`)
  }
  return [...out]
}

export function resolveFeryalQuestionPeriod(
  question: string,
  referenceNowMs = Date.now(),
): {
  from: string
  to: string
  periodLabelAr: string
  allowedDateStrings: string[]
  hasExplicitPeriod: boolean
} {
  const normDigits = normalizeDigits(question)
  const normAr = normalizeArabicText(question)
  const kwToday = getKuwaitCalendarParts(referenceNowMs)

  // 1. Explicit ISO YYYY-MM-DD dates
  const isoMatches = [...normDigits.matchAll(/\b(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/g)]
  if (isoMatches.length > 0) {
    const parsedIsos: string[] = []
    for (const m of isoMatches) {
      const y = Number(m[1])
      const mo = Number(m[2])
      const d = Number(m[3])
      if (isValidCalendarDate(y, mo, d)) {
        parsedIsos.push(
          `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        )
      }
    }
    if (parsedIsos.length >= 2) {
      const sorted = [...parsedIsos].sort()
      const from = sorted[0]
      const to = sorted[sorted.length - 1]
      return {
        from,
        to,
        periodLabelAr: from === to ? from : `${from} إلى ${to}`,
        allowedDateStrings: buildAllowedDateStrings(from, to),
        hasExplicitPeriod: true,
      }
    }
    if (parsedIsos.length === 1) {
      const d = parsedIsos[0]
      return {
        from: d,
        to: d,
        periodLabelAr: d,
        allowedDateStrings: buildAllowedDateStrings(d, d),
        hasExplicitPeriod: true,
      }
    }
  }

  // 2. Explicit DD/MM/YYYY or DD/MM dates (e.g. `14/11/2026` or `14/11`)
  const slashMatches = [
    ...normDigits.matchAll(/(?:^|[^\d])(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])(?:\/(20\d{2}))?(?=[^\d]|$)/g),
  ]
  if (slashMatches.length > 0) {
    const parsedSlashIsos: string[] = []
    for (const m of slashMatches) {
      const day = Number(m[1])
      const month = Number(m[2])
      let year = m[3] ? Number(m[3]) : kwToday.year
      if (!m[3]) {
        const candidateIso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        if (candidateIso > kwToday.iso) {
          year -= 1
        }
      }
      if (isValidCalendarDate(year, month, day)) {
        parsedSlashIsos.push(
          `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        )
      }
    }
    if (parsedSlashIsos.length >= 2) {
      const sorted = [...parsedSlashIsos].sort()
      const from = sorted[0]
      const to = sorted[sorted.length - 1]
      return {
        from,
        to,
        periodLabelAr: from === to ? from : `${from} إلى ${to}`,
        allowedDateStrings: buildAllowedDateStrings(from, to),
        hasExplicitPeriod: true,
      }
    }
    if (parsedSlashIsos.length === 1) {
      const d = parsedSlashIsos[0]
      return {
        from: d,
        to: d,
        periodLabelAr: d,
        allowedDateStrings: buildAllowedDateStrings(d, d),
        hasExplicitPeriod: true,
      }
    }
  }

  // 3. Relative day / range keywords in Kuwait timezone
  if (/\b(day before yesterday)\b/i.test(normDigits) || /(اول امس|قبل امس)/.test(normAr)) {
    const d = shiftIsoDateDays(kwToday.iso, -2)
    return {
      from: d,
      to: d,
      periodLabelAr: d,
      allowedDateStrings: buildAllowedDateStrings(d, d),
      hasExplicitPeriod: true,
    }
  }

  if (/\b(yesterday)\b/i.test(normDigits) || /(^|\s)(امس|الامس|البارحه)(?=[\s؟?.,!؛:()«»"']|$)/.test(normAr)) {
    const d = shiftIsoDateDays(kwToday.iso, -1)
    return {
      from: d,
      to: d,
      periodLabelAr: d,
      allowedDateStrings: buildAllowedDateStrings(d, d),
      hasExplicitPeriod: true,
    }
  }

  if (/\b(today)\b/i.test(normDigits) || /(^|\s)(اليوم|نهار اليوم)(?=[\s؟?.,!؛:()«»"']|$)/.test(normAr)) {
    return {
      from: kwToday.iso,
      to: kwToday.iso,
      periodLabelAr: kwToday.iso,
      allowedDateStrings: buildAllowedDateStrings(kwToday.iso, kwToday.iso),
      hasExplicitPeriod: true,
    }
  }

  if (/\b(last week)\b/i.test(normDigits) || /(الاسبوع الماضي|الاسبوع السابق)/.test(normAr)) {
    const from = shiftIsoDateDays(kwToday.iso, -7)
    const to = shiftIsoDateDays(kwToday.iso, -1)
    return {
      from,
      to,
      periodLabelAr: `${from} إلى ${to}`,
      allowedDateStrings: buildAllowedDateStrings(from, to),
      hasExplicitPeriod: true,
    }
  }

  if (/\b(this week|week)\b/i.test(normDigits) || /(هذا الاسبوع|الاسبوع الحالي|اخر اسبوع|الاسبوع)/.test(normAr)) {
    const from = shiftIsoDateDays(kwToday.iso, -6)
    const to = kwToday.iso
    return {
      from,
      to,
      periodLabelAr: `${from} إلى ${to}`,
      allowedDateStrings: buildAllowedDateStrings(from, to),
      hasExplicitPeriod: true,
    }
  }

  if (/\b(last month)\b/i.test(normDigits) || /(الشهر الماضي|الشهر السابق)/.test(normAr)) {
    const prevMonthYear = kwToday.month === 1 ? kwToday.year - 1 : kwToday.year
    const prevMonth = kwToday.month === 1 ? 12 : kwToday.month - 1
    const lastDay = new Date(Date.UTC(prevMonthYear, prevMonth, 0)).getUTCDate()
    const from = `${String(prevMonthYear).padStart(4, '0')}-${String(prevMonth).padStart(2, '0')}-01`
    const to = `${String(prevMonthYear).padStart(4, '0')}-${String(prevMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return {
      from,
      to,
      periodLabelAr: `${from} إلى ${to}`,
      allowedDateStrings: buildAllowedDateStrings(from, to),
      hasExplicitPeriod: true,
    }
  }

  if (/\b(this year|year)\b/i.test(normDigits) || /(هذه السنه|هذا العام|السنه الحاليه|من بدايه السنه|العام)/.test(normAr)) {
    const from = `${String(kwToday.year).padStart(4, '0')}-01-01`
    const to = kwToday.iso
    return {
      from,
      to,
      periodLabelAr: `${from} إلى ${to}`,
      allowedDateStrings: buildAllowedDateStrings(from, to),
      hasExplicitPeriod: true,
    }
  }

  if (/\b(last 30 days|30 days)\b/i.test(normDigits) || /(اخر 30 يوم|اخر 30 يوما|خلال 30 يوم|ثلاثين يوم)/.test(normAr)) {
    const from = shiftIsoDateDays(kwToday.iso, -29)
    const to = kwToday.iso
    return {
      from,
      to,
      periodLabelAr: `${from} إلى ${to}`,
      allowedDateStrings: buildAllowedDateStrings(from, to),
      hasExplicitPeriod: true,
    }
  }

  if (/\b(this month|month)\b/i.test(normDigits) || /(هذا الشهر|الشهر الحالي|من بدايه الشهر|الشهر)/.test(normAr)) {
    const from = `${String(kwToday.year).padStart(4, '0')}-${String(kwToday.month).padStart(2, '0')}-01`
    const to = kwToday.iso
    return {
      from,
      to,
      periodLabelAr: `${from} إلى ${to}`,
      allowedDateStrings: buildAllowedDateStrings(from, to),
      hasExplicitPeriod: true,
    }
  }

  // Default active 30-day window up to Kuwait today
  const defaultFrom = shiftIsoDateDays(kwToday.iso, -29)
  return {
    from: defaultFrom,
    to: kwToday.iso,
    periodLabelAr: `${defaultFrom} إلى ${kwToday.iso}`,
    allowedDateStrings: buildAllowedDateStrings(defaultFrom, kwToday.iso),
    hasExplicitPeriod: false,
  }
}

export function detectTargetBranchFromQuestion(question: string): {
  branchId: ApprovedFeryalBranchId | null
  unknownBranchRequested: boolean
} {
  const normAr = normalizeArabicText(question)

  // If explicitly asking for breakdown across branches ("حسب الفرع" / "لكل فرع" / "جميع الفروع"), keep all branches
  const asksByBranchBreakdown =
    /(حسب الفرع|حسب الفروع|لكل فرع|جميع الفروع|كل الفروع|مقارنه الفروع|توزيع الفروع|\bby branch\b|\ball branches\b)/i.test(
      normAr,
    )

  const matchedIds: ApprovedFeryalBranchId[] = []
  for (const branch of APPROVED_FERYAL_BRANCHES) {
    for (const rawAlias of branch.aliases) {
      const aliasNorm = normalizeArabicText(rawAlias)
      if (!aliasNorm) continue
      if (aliasNorm === '360') {
        if (/(^|[^\d])360([^\d]|$)/.test(normAr)) {
          matchedIds.push(branch.id)
          break
        }
      } else if (normAr.includes(aliasNorm)) {
        matchedIds.push(branch.id)
        break
      }
    }
  }

  if (matchedIds.length === 1 && !asksByBranchBreakdown) {
    return { branchId: matchedIds[0], unknownBranchRequested: false }
  }
  if (matchedIds.length > 1) {
    return { branchId: null, unknownBranchRequested: false }
  }

  // Check if user asked for "فرع <name>" where <name> is NOT one of our 7 approved branches
  if (!asksByBranchBreakdown) {
    const branchWordMatch = normAr.match(/(?:^|\s)فرع\s+([^\s،؟?.,]+)/)
    if (branchWordMatch) {
      const candidateToken = branchWordMatch[1]
      const genericWords = new Set([
        'معين',
        'محدد',
        'واحد',
        'الشركه',
        'المطعم',
        'نقاط',
        'البيع',
        'الاعلي',
        'الاقل',
        'افضل',
        'اسوا',
        'اي',
      ])
      if (!genericWords.has(candidateToken)) {
        return { branchId: null, unknownBranchRequested: true }
      }
    }
  }

  return { branchId: null, unknownBranchRequested: false }
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
    case 'stock_no_data':
      return `${FERYAL_NO_ODOO_DATA_REPLY} — يلزم اعتماد حركات المخزن وأوامر الإتلاف في stock.move وstock.scrap داخل Odoo للفترة المطلوبة.`
    case 'generic':
    default:
      return `${FERYAL_NO_ODOO_DATA_REPLY} — يلزم ربط المصدر التشغيلي المختص بموديولات Odoo المعتمدة وتحديد المؤشر أو الفترة المطلوبة.`
  }
}

export function detectTargetBrandFromQuestion(question: string): {
  brandId: ApprovedFeryalBrandId | null
  asksByBrandBreakdown: boolean
} {
  const normAr = normalizeArabicText(question)
  const asksByBrandBreakdown =
    /(حسب العلامه|حسب العلامات|لكل علامه|العلامات التجاريه|العلامات الست|العلامات السته|جميع العلامات|كل العلامات|حسب البراند|البراندات|لكل براند|مبيعات العلامات|\bby brand\b|\ball brands\b|\bbrands\b)/i.test(
      normAr,
    )

  const matched: ApprovedFeryalBrandId[] = []
  for (const b of APPROVED_FERYAL_BRAND_LIST) {
    for (const alias of b.aliases) {
      const aNorm = normalizeArabicText(alias)
      if (aNorm && normAr.includes(aNorm)) {
        matched.push(b.id)
        break
      }
    }
  }

  if (matched.length === 1 && !asksByBrandBreakdown) {
    return { brandId: matched[0], asksByBrandBreakdown: false }
  }
  return { brandId: null, asksByBrandBreakdown }
}

export function resolveFeryalComparisonPeriods(
  question: string,
  referenceNowMs = Date.now(),
): {
  periodA: { from: string; to: string; periodLabelAr: string }
  periodB: { from: string; to: string; periodLabelAr: string }
  allowedDateStrings: string[]
} | null {
  const normDigits = normalizeDigits(question)
  const normAr = normalizeArabicText(question)
  const hasComparisonCue =
    /(قارن|مقارنه|بالمقارنه|مقابل|ضد|الفرق بين|\bvs\.?\b|\bversus\b|\bcompare\b)/i.test(normAr)
  if (!hasComparisonCue) return null

  const kwToday = getKuwaitCalendarParts(referenceNowMs)

  // 1. Two explicit ISO dates
  const isoMatches = [
    ...normDigits.matchAll(/\b(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/g),
  ]
  if (isoMatches.length >= 2) {
    const isos: string[] = []
    for (const m of isoMatches) {
      const y = Number(m[1])
      const mo = Number(m[2])
      const d = Number(m[3])
      if (isValidCalendarDate(y, mo, d)) {
        const iso = `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        if (!isos.includes(iso)) isos.push(iso)
      }
    }
    if (isos.length >= 2) {
      const a = isos[0]
      const b = isos[1]
      return {
        periodA: { from: a, to: a, periodLabelAr: a },
        periodB: { from: b, to: b, periodLabelAr: b },
        allowedDateStrings: [
          ...new Set([
            ...buildAllowedDateStrings(a, a),
            ...buildAllowedDateStrings(b, b),
          ]),
        ],
      }
    }
  }

  // 2. Two explicit DD/MM or DD/MM/YYYY dates
  const slashMatches = [
    ...normDigits.matchAll(
      /(?:^|[^\d])(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])(?:\/(20\d{2}))?(?=[^\d]|$)/g,
    ),
  ]
  if (slashMatches.length >= 2) {
    const isos: string[] = []
    for (const m of slashMatches) {
      const day = Number(m[1])
      const month = Number(m[2])
      let year = m[3] ? Number(m[3]) : kwToday.year
      if (!m[3]) {
        const cand = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        if (cand > kwToday.iso) year -= 1
      }
      if (isValidCalendarDate(year, month, day)) {
        const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        if (!isos.includes(iso)) isos.push(iso)
      }
    }
    if (isos.length >= 2) {
      const a = isos[0]
      const b = isos[1]
      return {
        periodA: { from: a, to: a, periodLabelAr: a },
        periodB: { from: b, to: b, periodLabelAr: b },
        allowedDateStrings: [
          ...new Set([
            ...buildAllowedDateStrings(a, a),
            ...buildAllowedDateStrings(b, b),
          ]),
        ],
      }
    }
  }

  // 3. Relative day/period pairs
  if (/(اول امس|قبل امس|\bday before yesterday\b)/i.test(normAr) && /(امس|الامس|\byesterday\b)/i.test(normAr)) {
    const a = shiftIsoDateDays(kwToday.iso, -1)
    const b = shiftIsoDateDays(kwToday.iso, -2)
    return {
      periodA: { from: a, to: a, periodLabelAr: a },
      periodB: { from: b, to: b, periodLabelAr: b },
      allowedDateStrings: [...new Set([...buildAllowedDateStrings(a, a), ...buildAllowedDateStrings(b, b)])],
    }
  }

  if (
    /(^|\s)(اليوم|\btoday\b)(?=[\s؟?.,!؛:()«»"']|$)/i.test(normAr) &&
    /(^|\s)(امس|الامس|\byesterday\b)(?=[\s؟?.,!؛:()«»"']|$)/i.test(normAr)
  ) {
    const a = kwToday.iso
    const b = shiftIsoDateDays(kwToday.iso, -1)
    return {
      periodA: { from: a, to: a, periodLabelAr: a },
      periodB: { from: b, to: b, periodLabelAr: b },
      allowedDateStrings: [...new Set([...buildAllowedDateStrings(a, a), ...buildAllowedDateStrings(b, b)])],
    }
  }

  if (/(هذا الاسبوع|الاسبوع الحالي|\bthis week\b)/i.test(normAr) && /(الاسبوع الماضي|الاسبوع السابق|\blast week\b)/i.test(normAr)) {
    const aFrom = shiftIsoDateDays(kwToday.iso, -6)
    const aTo = kwToday.iso
    const bFrom = shiftIsoDateDays(kwToday.iso, -13)
    const bTo = shiftIsoDateDays(kwToday.iso, -7)
    return {
      periodA: { from: aFrom, to: aTo, periodLabelAr: `${aFrom} إلى ${aTo}` },
      periodB: { from: bFrom, to: bTo, periodLabelAr: `${bFrom} إلى ${bTo}` },
      allowedDateStrings: [
        ...new Set([
          ...buildAllowedDateStrings(aFrom, aTo),
          ...buildAllowedDateStrings(bFrom, bTo),
        ]),
      ],
    }
  }

  if (/(هذا الشهر|الشهر الحالي|\bthis month\b)/i.test(normAr) && /(الشهر الماضي|الشهر السابق|\blast month\b)/i.test(normAr)) {
    const aFrom = `${String(kwToday.year).padStart(4, '0')}-${String(kwToday.month).padStart(2, '0')}-01`
    const aTo = kwToday.iso
    const prevMonthYear = kwToday.month === 1 ? kwToday.year - 1 : kwToday.year
    const prevMonth = kwToday.month === 1 ? 12 : kwToday.month - 1
    const lastDay = new Date(Date.UTC(prevMonthYear, prevMonth, 0)).getUTCDate()
    const bFrom = `${String(prevMonthYear).padStart(4, '0')}-${String(prevMonth).padStart(2, '0')}-01`
    const bTo = `${String(prevMonthYear).padStart(4, '0')}-${String(prevMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return {
      periodA: { from: aFrom, to: aTo, periodLabelAr: `${aFrom} إلى ${aTo}` },
      periodB: { from: bFrom, to: bTo, periodLabelAr: `${bFrom} إلى ${bTo}` },
      allowedDateStrings: [
        ...new Set([
          ...buildAllowedDateStrings(aFrom, aTo),
          ...buildAllowedDateStrings(bFrom, bTo),
        ]),
      ],
    }
  }

  return null
}

type DetectedToolKind =
  | 'pos_comparison'
  | 'pos_brands'
  | 'pos_orders'
  | 'pos_order_lines'
  | 'account_move_lines'
  | 'purchase_orders'
  | 'stock_moves'
  | 'hr_employees'
  | 'unknown'

function detectOdooToolKind(
  question: string,
  targetBranchId: ApprovedFeryalBranchId | null,
  brandDetection: { brandId: ApprovedFeryalBrandId | null; asksByBrandBreakdown: boolean },
  hasComparisonPeriods: boolean,
): DetectedToolKind {
  const normAr = normalizeArabicText(question)

  // 0. HR Employees (`hr.employee`)
  if (
    /(hr\.employee|عدد الموظفين|اجمالي الموظفين|كم موظف|الموظفين|موظفي|الموظفون|الكادر الوظيفي|القوي العامله|الموارد البشريه|\bemployees?\b|\bheadcount\b|\bworkforce\b)/i.test(
      normAr,
    )
  ) {
    return 'hr_employees'
  }

  // 1. Purchase orders / supplier costs (`purchase.order` / `purchase.order.line`)
  if (
    /(purchase\.order|امر شراء|اوامر الشراء|اوامر شراء|مشتريات|تكلفه مورد|تكلفه المورد|تكاليف الموردين|مورد|المورد|موردين|الموردين|فاتوره مورد|\bsupplier\b|\bsuppliers\b|\bvendor\b|\bvendors\b|\bprocurement\b)/i.test(
      normAr,
    )
  ) {
    return 'purchase_orders'
  }

  // 2. Warehouse transfers / stock moves / scrap (`stock.move` / `stock.scrap`)
  if (
    /(stock\.move|stock\.scrap|التحويل المخزني|التحويلات المخزنيه|تحويل مخزني|تحويلات المخزن|حركات المخزن|حركه المخزون|سلسله المخزن|الهدر|تالف|التالف|اتلاف|\bwarehouse transfer\b|\bstock move\b|\bscrap\b|\bwaste\b)/i.test(
      normAr,
    )
  ) {
    return 'stock_moves'
  }

  // 3. General Ledger / accounting / receivables (`account.move.line`)
  if (
    /(account\.move\.line|دفتر الاستاذ|القيود المحاسبيه|قيود اليوميه|الذمم المدينه|ذمم المنصات|مستحقات المنصات|صافي الربح|الارباح والخسائر|المصروفات|المصاريف|تكلفه البضاعه|\bledger\b|\breceivables\b|\bnet profit\b|\bexpenses\b)/i.test(
      normAr,
    )
  ) {
    return 'account_move_lines'
  }

  // 4. Two-period POS comparison (`pos.order`)
  if (hasComparisonPeriods) {
    return 'pos_comparison'
  }

  // 5. Top selling products / POS line items / item discounts (`pos.order.line`)
  if (
    /(pos\.order\.line|اعلي \d+ اصناف|اعلي اصناف|اعلي الاصناف|افضل الاصناف|افضل \d+ اصناف|الاصناف الاكثر|مبيعات الاصناف|الاصناف|الاطباق|المنتجات|الخصومات|نسبه الخصم|خصومات الاصناف|\btop \d* ?items\b|\btop \d* ?products\b|\bbest selling\b|\bdiscounts\b)/i.test(
      normAr,
    )
  ) {
    return 'pos_order_lines'
  }

  // 6. Brand sales breakdown or single brand (`pos.order.line` + `pos.order`)
  if (brandDetection.asksByBrandBreakdown || brandDetection.brandId !== null) {
    return 'pos_brands'
  }

  // 7. POS sales / orders / branches (`pos.order`)
  if (
    targetBranchId !== null ||
    /(pos\.order|مبيعات|المبيعات|ايرادات|الطلبات|عدد الطلبات|متوسط السله|الفروع|حسب الفرع|غير منسوب|\bsales\b|\borders\b|\brevenue\b|\bbranches\b)/i.test(
      normAr,
    )
  ) {
    return 'pos_orders'
  }

  return 'unknown'
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
  referenceNowMs?: number
}): Promise<ToolExecutionOutput> {
  const { dataSource, period, targetBranchId, referenceNowMs } = params
  const cube = await dataSource.fetchPeriodCube(period.from, period.to, referenceNowMs)

  const domain: unknown[] = [
    ['date_order', '>=', `${period.from} 00:00:00`],
    ['date_order', '<=', `${period.to} 23:59:59`],
    ['state', 'in', ['paid', 'done', 'invoiced']],
  ]
  if (cube?.odooCompanyId) {
    domain.push(['company_id', '=', cube.odooCompanyId])
  }

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

  const branchRows = APPROVED_FERYAL_BRANCHES.map((meta) => {
    const raw = cube.byBranch[meta.id] ?? { netKwd: 0, orders: 0, aovKwd: 0 }
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

  const totalNet1 = round1(cube.totals.netSalesKwd)
  const totalOrdersInt = Math.round(cube.totals.orders)
  const totalAov1 = totalOrdersInt > 0 ? round1(cube.totals.netSalesKwd / totalOrdersInt) : 0
  const mappedRoundedSum1 = round1(branchRows.reduce((acc, r) => acc + r.netKwd, 0))
  const rawUnattributed1 = round1(cube.unattributed.netKwd)
  const residualUnattributed1 = round1(Math.max(0, totalNet1 - mappedRoundedSum1))
  const unattributedNet1 =
    cube.unattributed.netKwd > 0 && Math.abs(residualUnattributed1 - cube.unattributed.netKwd) <= 0.15
      ? residualUnattributed1
      : rawUnattributed1
  const unattributedOrdersInt = Math.round(cube.unattributed.orders)

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
      cube.totals.netSalesKwd,
      totalNet1,
      totalOrdersInt,
      topBranch.rawNetKwd,
      topBranch.netKwd,
      topBranch.orders,
    ]
    const allowedEntityNames: string[] = [targetRow.nameAr, topBranch.nameAr]

    const causeComparison =
      topBranch.id === targetRow.id
        ? `تصدر فرع ${targetRow.nameAr} جميع الفروع بصافي ${formatKwd1(targetRow.netKwd)} د.ك من ${formatIntCount(targetRow.orders)} طلبات بمتوسط سلة ${formatKwd1(targetRow.aovKwd)} د.ك.`
        : `حقق فرع ${targetRow.nameAr} صافي ${formatKwd1(targetRow.netKwd)} د.ك من ${formatIntCount(targetRow.orders)} طلبات بمتوسط سلة ${formatKwd1(targetRow.aovKwd)} د.ك مقارنة بأعلى فرع للفترة وهو ${topBranch.nameAr} بقيمة ${formatKwd1(topBranch.netKwd)} د.ك.`

    const reply = [
      `• الرقم: وفق موديل pos.order في Odoo للفترة ${period.periodLabelAr}، سجل فرع ${targetRow.nameAr} صافي مبيعات ${formatKwd1(targetRow.netKwd)} د.ك و${formatIntCount(targetRow.orders)} طلبات بمتوسط سلة ${formatKwd1(targetRow.aovKwd)} د.ك من إجمالي الشركة البالغ ${formatKwd1(totalNet1)} د.ك.`,
      `• السبب من البيانات: ${causeComparison}`,
      `• الإجراء المحدد: يراجع مدير فرع ${targetRow.nameAr} ومشرف العمليات اليوم أداء فترات الذروة واقتراحات الإضافات في نقاط البيع خلال الوردية القادمة.`,
      `• الأثر المتوقع (تقدير): تقدير — تحسن متوسط السلة فوق مستوى ${formatKwd1(targetRow.aovKwd)} د.ك الحالي ورفع مساهمة فرع ${targetRow.nameAr} ضمن مبيعات الشركة.`,
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
        branch: targetRow,
        companyTotalNetKwd: totalNet1,
        companyTotalOrders: totalOrdersInt,
        topBranch: { nameAr: topBranch.nameAr, netKwd: topBranch.netKwd },
      },
    }
  }

  // All 7 branches + غير منسوب لفرع breakdown
  const toolNumbers: number[] = [
    cube.totals.netSalesKwd,
    totalNet1,
    totalOrdersInt,
    totalAov1,
    cube.unattributed.netKwd,
    unattributedNet1,
    unattributedOrdersInt,
  ]
  const allowedEntityNames: string[] = [UNATTRIBUTED_BRANCH_LABEL_AR]

  for (const r of branchRows) {
    toolNumbers.push(r.rawNetKwd, r.netKwd, r.orders, r.aovKwd)
    allowedEntityNames.push(r.nameAr)
  }

  const branchListText = branchRows
    .map((r) => `${r.nameAr} ${formatKwd1(r.netKwd)} د.ك`)
    .join('، ')

  const topBranch = branchRows[0]
  const secondBranch = branchRows[1]
  const lowestBranch = branchRows[branchRows.length - 1]

  const unattributedSegment =
    unattributedNet1 > 0
      ? `، منها ${formatKwd1(unattributedNet1)} د.ك غير منسوبة (${UNATTRIBUTED_BRANCH_LABEL_AR})`
      : `، وبند ${UNATTRIBUTED_BRANCH_LABEL_AR} بقيمة ${formatKwd1(unattributedNet1)} د.ك`

  const reply = [
    `• الرقم: وفق موديل pos.order في Odoo للفترة ${period.periodLabelAr}، توزعت المبيعات حسب الفرع كالتالي: ${branchListText}، والإجمالي ${formatKwd1(totalNet1)} د.ك عبر ${formatIntCount(totalOrdersInt)} طلبات${unattributedSegment}.`,
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
      totalNetKwd: totalNet1,
      totalOrders: totalOrdersInt,
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
  if (targetBranchId) {
    domain.push(['branch_scope', '=', targetBranchId])
  }

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
      domain: [['order_id.state', 'in', ['purchase', 'done']]],
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
  const buildDomain = (p: { from: string; to: string }): unknown[] => [
    ['date_order', '>=', `${p.from} 00:00:00`],
    ['date_order', '<=', `${p.to} 23:59:59`],
    ['state', 'in', ['paid', 'done', 'invoiced']],
    ...(companyId ? [['company_id', '=', companyId]] : []),
  ]

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
  ]

  const directionWord = diff1 > 0 ? 'بارتفاع' : diff1 < 0 ? 'بانخفاض' : 'بفارق'
  const pctSegment = netB1 > 0 ? ` (${formatKwd1(absPct1)}%)` : ''
  const ordersDirection =
    ordersDiffInt > 0
      ? `زيادة الطلبات بعدد ${formatIntCount(absOrdersDiffInt)} طلبات`
      : ordersDiffInt < 0
        ? `تراجع الطلبات بعدد ${formatIntCount(absOrdersDiffInt)} طلبات`
        : `ثبات عدد الطلبات بفارق ${formatIntCount(absOrdersDiffInt)} طلبات`

  const reply = [
    `• الرقم: وفق موديل pos.order في Odoo (${scopeLabelAr})، بلغ صافي مبيعات الفترة ${periodA.periodLabelAr} قيمة ${formatKwd1(netA1)} د.ك عبر ${formatIntCount(ordersAInt)} طلبات مقابل ${formatKwd1(netB1)} د.ك عبر ${formatIntCount(ordersBInt)} طلبات في الفترة ${periodB.periodLabelAr}، ${directionWord} قدره ${formatKwd1(absDiff1)} د.ك${pctSegment}.`,
    `• السبب من البيانات: يعود الفارق البالغ ${formatKwd1(absDiff1)} د.ك بين الفترتين إلى ${ordersDirection} بين ${periodA.periodLabelAr} (${formatIntCount(ordersAInt)} طلبات) و${periodB.periodLabelAr} (${formatIntCount(ordersBInt)} طلبات).`,
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
  if (targetBranchId) {
    domain.push(['branch_scope', '=', targetBranchId])
  }

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
    llmCandidateRejected?: boolean
  }): Promise<AskFeryalOdooAgentResult> => {
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

  // 3. Branch Scope Check (7 approved branches only)
  const branchDetection = detectTargetBranchFromQuestion(rawQuestion)
  if (branchDetection.unknownBranchRequested) {
    return finalizeNoData('unknown_branch')
  }

  // 4. Period, Brand, Comparison & Tool Resolution
  const brandDetection = detectTargetBrandFromQuestion(rawQuestion)
  const comparisonPeriods = resolveFeryalComparisonPeriods(rawQuestion, nowMs)
  const resolvedPeriod = resolveFeryalQuestionPeriod(rawQuestion, nowMs)
  const toolKind = detectOdooToolKind(
    rawQuestion,
    branchDetection.branchId,
    brandDetection,
    comparisonPeriods !== null,
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
        targetBranchId: branchDetection.branchId,
        referenceNowMs: nowMs,
      })
      break
    }
    case 'pos_brands':
      toolOutput = await runPosBrandsTool({
        dataSource,
        period: resolvedPeriod,
        targetBrandId: brandDetection.brandId,
        targetBranchId: branchDetection.branchId,
        referenceNowMs: nowMs,
      })
      break
    case 'pos_orders':
      toolOutput = await runPosOrdersTool({
        dataSource,
        period: resolvedPeriod,
        targetBranchId: branchDetection.branchId,
        referenceNowMs: nowMs,
      })
      break
    case 'pos_order_lines':
      toolOutput = await runPosOrderLinesTool({
        dataSource,
        period: resolvedPeriod,
        targetBranchId: branchDetection.branchId,
        question: rawQuestion,
        referenceNowMs: nowMs,
      })
      break
    case 'account_move_lines':
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
    llmCandidateRejected,
  })
}
