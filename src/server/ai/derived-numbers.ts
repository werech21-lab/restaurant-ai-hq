import { z } from 'zod'
import { formatKuwaitDateTime } from '@/lib/format'
import type {
  FeryalContextPack,
  FeryalLlmClaim,
  FeryalLlmContract,
  FeryalLlmProposal,
  FeryalLlmRootCause,
  FeryalPackSection,
  FeryalPackSectionKey,
} from '@/lib/feryal-context-types'
import {
  ALL_FERYAL_BRANCHES,
  APPROVED_FERYAL_BRAND_LIST,
  APPROVED_FERYAL_CHANNEL_LIST,
  buildAllowedDateStrings,
  containsExcludedEntityText,
  normalizeArabicText,
  normalizeDigits,
} from '@/lib/feryal-intent'
import { collectPackSectionNumbers } from './feryal-context'

export const RUN_RATE_PROJECTION_LABEL_AR = 'تقدير/اقتراح — ليس رقماً من Odoo' as const

const feryalLlmCitationSchema = z.object({
  value: z.number().finite(),
  section: z.string().trim().min(1),
})

const feryalLlmClaimSchema = z.object({
  text: z.string().trim().min(1),
  numbers: z.array(feryalLlmCitationSchema).default([]),
})

const feryalLlmProposalSchema = z.object({
  text: z.string().trim().min(1),
  owner: z
    .string()
    .trim()
    .transform((v) => v || 'الإدارة')
    .default('الإدارة'),
  kind: z.literal('proposal').default('proposal'),
})

const feryalLlmRootCauseSchema = z.object({
  text: z.string().trim().min(1),
  kind: z.literal('hypothesis').default('hypothesis'),
})

export const feryalLlmContractSchema = z.object({
  answer_ar: z.string(),
  claims: z.array(feryalLlmClaimSchema).default([]),
  proposals: z.array(feryalLlmProposalSchema).default([]),
  missing_metrics: z.array(z.string().trim().min(1)).default([]),
  root_causes: z.array(feryalLlmRootCauseSchema).optional(),
})

export interface FeryalRunRateProjection {
  projectedKwd: number
  formulaAr: string
  formulaEn: string
  labelAr: string
}

export interface FeryalDroppedClaim extends FeryalLlmClaim {
  reason: string
}

export interface FeryalVerifiedContractResult {
  verifiedAnswerAr: string
  verifiedClaims: FeryalLlmClaim[]
  droppedClaims: FeryalDroppedClaim[]
  verifiedProposals: FeryalLlmProposal[]
  missingMetrics: string[]
  rootCauses: FeryalLlmRootCause[]
  allDropped: boolean
}

const DECLINE_CUE_RE =
  /(انخفاض|انخفض|انخفضت|تراجع|تراجعت|هبوط|هبط|هبطت|نقص|نقصت|سالب|خساره|خسارة|عجز|اقل|بانخفاض|بتراجع|\bdown\b|\bdrop(?:ped)?\b|\bdeclin(?:e|ed|ing)\b|\bdecreas(?:e|ed|ing)\b|\bloss\b)/i
const NUMBER_TOKEN_RE =
  /(?:(?<=^|[\s:(«"'،,=+])[-−])?\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?:(?<=^|[\s:(«"'،,=+])[-−])?\d+(?:\.\d+)?/g

const SECTION_ALIASES: Readonly<Record<string, string>> = {
  totals: 'companyTotals',
  company: 'companyTotals',
  company_totals: 'companyTotals',
  companytotals: 'companyTotals',
  branch: 'branches',
  branches: 'branches',
  unattributed: 'unattributed',
  channel: 'channels',
  channels: 'channels',
  brand: 'brands',
  brands: 'brands',
  product: 'topProducts',
  products: 'topProducts',
  top_products: 'topProducts',
  topproducts: 'topProducts',
  hourly: 'hourly',
  hours: 'hourly',
  delta: 'deltas',
  deltas: 'deltas',
  comparison: 'deltas',
  accounting: 'gl',
  gl: 'gl',
  receivable: 'receivables',
  receivables: 'receivables',
  purchase: 'purchases',
  purchases: 'purchases',
  warehouse: 'stock',
  stock: 'stock',
  employees: 'hr',
  hr: 'hr',
  period: 'period',
}

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

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function canonicalSectionName(raw: string): string {
  const trimmed = raw.trim()
  const lower = trimmed.toLowerCase()
  return SECTION_ALIASES[lower] ?? trimmed
}

function containsExcludedEntity(
  text: string | null | undefined,
  allowQurainCentralKitchen = false,
): boolean {
  return containsExcludedEntityText(text, { allowQurainCentralKitchen })
}

function stripMarkdownJsonFences(raw: string): string {
  const trimmed = raw.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  if (fenced) return fenced[1].trim()
  return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

export function parseFeryalLlmContract(rawText: string): FeryalLlmContract | null {
  if (typeof rawText !== 'string') return null
  const cleaned = stripMarkdownJsonFences(rawText)
  if (!cleaned) return null

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
        return null
      }
    } else {
      return null
    }
  }

  const validated = feryalLlmContractSchema.safeParse(parsed)
  if (!validated.success) return null
  return validated.data
}

function formatNumberForFormula(value: number, minDecimals = 0): string {
  if (!Number.isFinite(value)) return '0'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: 3,
  })
}

export function computeRunRateProjection(input: {
  actualToDateKwd: number
  elapsedDays: number
  totalDaysInMonth: number
}): FeryalRunRateProjection {
  const actual = Number.isFinite(input.actualToDateKwd) ? input.actualToDateKwd : 0
  const elapsed =
    Number.isFinite(input.elapsedDays) && input.elapsedDays > 0 ? input.elapsedDays : 0
  const totalDays =
    Number.isFinite(input.totalDaysInMonth) && input.totalDaysInMonth > 0
      ? input.totalDaysInMonth
      : 0

  const projectedKwd =
    elapsed > 0 && totalDays > 0
      ? Math.round(((actual / elapsed) * totalDays) * 1000) / 1000
      : 0

  const actualStr = formatNumberForFormula(actual)
  const elapsedStr = formatNumberForFormula(elapsed)
  const totalDaysStr = formatNumberForFormula(totalDays)
  const projectedStr = formatNumberForFormula(projectedKwd, 1)

  return {
    projectedKwd,
    formulaAr: `المبيعات الفعلية (${actualStr} د.ك) ÷ الأيام المنقضية (${elapsedStr}) × أيام الشهر (${totalDaysStr}) = ${projectedStr} د.ك`,
    formulaEn: `Actual to date (${actualStr} KWD) ÷ elapsed days (${elapsedStr}) × days in month (${totalDaysStr}) = ${projectedStr} KWD`,
    labelAr: RUN_RATE_PROJECTION_LABEL_AR,
  }
}

export function matchesRoundedValue(candidate: number, target: number): boolean {
  if (!Number.isFinite(candidate) || !Number.isFinite(target)) return false
  if (Math.abs(candidate - target) < 1e-6) return true
  const absTarget = Math.abs(target)
  const sign = target < 0 ? -1 : 1
  for (const factor of [10, 100, 1000]) {
    const jsRounded = Math.round(target * factor) / factor
    if (Math.abs(candidate - jsRounded) < 1e-6) return true
    const symRounded = sign * (Math.round(absTarget * factor + 1e-12) / factor)
    if (Math.abs(candidate - symRounded) < 1e-6) return true
  }
  return false
}

export function isAllowedDerivedNumber(
  candidate: number,
  operands: readonly number[],
  runRateSpec?: { elapsedDays: number; totalDaysInMonth: number },
): boolean {
  if (!Number.isFinite(candidate)) return false

  // Preserve up to 2 copies of each finite value so identical metrics from two entities can sum
  // without permitting a singleton value to sum with itself.
  const counts = new Map<number, number>()
  const ops: number[] = []
  for (const raw of operands) {
    if (!Number.isFinite(raw)) continue
    const val = raw === 0 ? 0 : raw
    const count = counts.get(val) ?? 0
    if (count < 2) {
      counts.set(val, count + 1)
      ops.push(val)
    }
  }

  for (const a of ops) {
    if (matchesRoundedValue(candidate, a)) return true
  }

  if (
    runRateSpec &&
    Number.isFinite(runRateSpec.elapsedDays) &&
    runRateSpec.elapsedDays > 0 &&
    Number.isFinite(runRateSpec.totalDaysInMonth) &&
    runRateSpec.totalDaysInMonth > 0
  ) {
    for (const a of ops) {
      const projected = (a / runRateSpec.elapsedDays) * runRateSpec.totalDaysInMonth
      if (matchesRoundedValue(candidate, projected)) return true
    }
  }

  for (let i = 0; i < ops.length; i += 1) {
    const a = ops[i]
    for (let j = 0; j < ops.length; j += 1) {
      if (i === j) continue
      const b = ops[j]
      if (i < j && matchesRoundedValue(candidate, a + b)) return true
      if (matchesRoundedValue(candidate, a - b)) return true
      if (matchesRoundedValue(candidate, Math.abs(a - b))) return true
      if (Math.abs(b) > 1e-9) {
        if (matchesRoundedValue(candidate, a / b)) return true
        if (matchesRoundedValue(candidate, (a / b) * 100)) return true
        if (matchesRoundedValue(candidate, ((a - b) / Math.abs(b)) * 100)) return true
      }
    }
  }

  return false
}

interface PackMaskingContext {
  allowedEntities: string[]
  allowedDates: string[]
}

function buildPackMaskingContext(pack: FeryalContextPack): PackMaskingContext {
  const entities = new Set<string>(['Odoo 17', 'Odoo17', '360-mall', '360 Mall', 'مول 360', '360 مول', 'فرع 360', 'مجمع 360'])

  for (const b of ALL_FERYAL_BRANCHES) {
    entities.add(b.id)
    entities.add(b.nameAr)
    entities.add(b.nameEn)
    for (const alias of b.aliases) {
      // Never mask bare "360" by itself because 360 can appear as a numeric KWD/order figure.
      if (/^\d+$/.test(alias.trim())) continue
      entities.add(alias)
    }
  }
  for (const br of APPROVED_FERYAL_BRAND_LIST) {
    entities.add(br.id)
    entities.add(br.nameAr)
    entities.add(br.nameEn)
  }
  for (const ch of APPROVED_FERYAL_CHANNEL_LIST) {
    entities.add(ch.id)
    entities.add(ch.nameAr)
    entities.add(ch.nameEn)
  }
  if (pack.branches.status === 'ok' && pack.branches.data) {
    for (const item of pack.branches.data.items) {
      entities.add(item.nameAr)
      entities.add(item.nameEn)
      entities.add(item.branchId)
    }
  }
  if (pack.topProducts.status === 'ok' && pack.topProducts.data) {
    for (const item of pack.topProducts.data.items) {
      if (item.name.trim().length >= 3) entities.add(item.name)
    }
  }
  if (pack.purchases.status === 'ok' && pack.purchases.data?.topVendors) {
    for (const v of pack.purchases.data.topVendors) {
      if (v.name.trim().length >= 3) entities.add(v.name)
    }
  }

  const dateCandidates = [
    pack.period.from,
    pack.period.to,
    pack.previousPeriod.from,
    pack.previousPeriod.to,
    pack.gl.data?.glClosedThroughDate ?? '',
    pack.receivables.data?.fromDate ?? '',
    pack.receivables.data?.toDate ?? '',
  ].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))

  const dates = new Set<string>()
  for (const iso of dateCandidates) {
    for (const variant of buildAllowedDateStrings(iso, iso)) {
      dates.add(variant)
    }
    dates.add(iso.slice(0, 7))
  }

  return {
    allowedEntities: [...entities]
      .map((s) => normalizeDigits(s).trim())
      .filter((s) => s.length >= 3 && !/^\d+$/.test(s))
      .sort((a, b) => b.length - a.length),
    allowedDates: [...dates]
      .map((d) => normalizeDigits(d).trim())
      .filter((d) => d.length >= 4)
      .sort((a, b) => b.length - a.length),
  }
}

function maskEntitiesAndDates(
  rawText: string,
  ctx: PackMaskingContext,
  options?: { stripListPrefix?: boolean },
): string {
  let working = normalizeDigits(rawText ?? '')

  if (options?.stripListPrefix) {
    working = working.replace(/(^|\n)\s*\d{1,2}[.)]\s+(?=[^\d])/g, '$1')
  }

  for (const entity of ctx.allowedEntities) {
    const re = new RegExp(escapeRegExp(entity), 'gi')
    working = working.replace(re, ' ')
  }

  for (const dt of ctx.allowedDates) {
    const re = new RegExp(`(^|[^\\d])${escapeRegExp(dt)}(?=[^\\d]|$)`, 'g')
    working = working.replace(re, '$1 ')
  }

  // Whole-hour clock labels like "20:00" represent the hour integer (20), not separate 20 and 0.
  working = working.replace(/(^|[^\d.])([01]?\d|2[0-3]):00(?=[^\d]|$)/g, '$1$2')

  return working
}

function extractNumbersFromMasked(maskedText: string): number[] {
  const numbers: number[] = []
  NUMBER_TOKEN_RE.lastIndex = 0
  for (const match of maskedText.matchAll(NUMBER_TOKEN_RE)) {
    const rawToken = match[0].replace(/−/g, '-').replace(/,/g, '')
    const parsed = Number(rawToken)
    if (Number.isFinite(parsed)) {
      numbers.push(parsed === 0 ? 0 : parsed)
    }
  }
  return numbers
}

function collectFallbackOperands(
  pack: FeryalContextPack,
  sectionMap: Map<string, Set<number>>,
): { allOperands: number[]; periodDays: number[] } {
  const allOperands: number[] = []

  for (const key of PACK_SECTION_KEYS) {
    if (key === 'hourly') {
      if (pack.hourly.status === 'ok' && pack.hourly.data) {
        if (pack.hourly.data.peakHour) {
          allOperands.push(
            pack.hourly.data.peakHour.hour,
            pack.hourly.data.peakHour.orders,
            pack.hourly.data.peakHour.netKwd,
          )
        }
        for (const w of pack.hourly.data.weakestHours) {
          allOperands.push(w.hour, w.orders, w.netKwd)
        }
        for (const pt of pack.hourly.data.hourlySeries) {
          if (pt.orders > 0 || pt.netKwd > 0) {
            allOperands.push(pt.hour, pt.orders, pt.netKwd)
          }
        }
      }
      continue
    }
    const vals = sectionMap.get(key)
    if (!vals) continue
    for (const v of vals) {
      allOperands.push(v)
    }
  }

  const periodDays = [...(sectionMap.get('period') ?? [])]
  return { allOperands, periodDays }
}

function isValueAllowedWithOperands(
  value: number,
  operands: readonly number[],
  periodDays: readonly number[],
  runRateSpec: { elapsedDays: number; totalDaysInMonth: number },
  allowDeclineNegation: boolean,
): boolean {
  if (periodDays.some((d) => matchesRoundedValue(value, d))) {
    return true
  }
  if (isAllowedDerivedNumber(value, operands, runRateSpec)) {
    return true
  }
  if (allowDeclineNegation && value > 0) {
    return isAllowedDerivedNumber(-value, operands, runRateSpec)
  }
  return false
}

function isKnownPackSection(section: string): boolean {
  return (PACK_SECTION_KEYS as readonly string[]).includes(section)
}

function isSectionUnavailableInPack(pack: FeryalContextPack, canonicalSection: string): boolean {
  if (!isKnownPackSection(canonicalSection)) return false
  const sectionObj = pack[canonicalSection as FeryalPackSectionKey] as FeryalPackSection<unknown>
  return sectionObj.status !== 'ok'
}

function splitSentencesPreservingDecimals(line: string): string[] {
  const parts = line.split(/(?:(?<=[؟!])|(?<!\d)(?<!د)\.(?!\d|ك))(?=\s|$)/)
  return parts.map((p) => p.trim()).filter(Boolean)
}

function sanitizeProposalText(
  text: string,
  maskCtx: PackMaskingContext,
  allOperands: readonly number[],
  periodDays: readonly number[],
  runRateSpec: { elapsedDays: number; totalDaysInMonth: number },
  allowQurainCentralKitchen = false,
): string | null {
  if (containsExcludedEntity(text, allowQurainCentralKitchen)) return null
  const sentences = splitSentencesPreservingDecimals(text)
  const kept: string[] = []

  for (const sentence of sentences) {
    if (containsExcludedEntity(sentence, allowQurainCentralKitchen)) continue
    const masked = maskEntitiesAndDates(sentence, maskCtx, { stripListPrefix: true })
    const nums = extractNumbersFromMasked(masked)
    const allowNeg = DECLINE_CUE_RE.test(normalizeArabicText(sentence))
    const allOk = nums.every((n) =>
      isValueAllowedWithOperands(n, allOperands, periodDays, runRateSpec, allowNeg),
    )
    if (allOk) {
      kept.push(sentence)
    }
  }

  if (kept.length > 0) {
    return kept.join(' ').trim()
  }

  // Single-sentence proposal containing an unverified number: strip the unverified numeric phrase
  // so valid qualitative guidance survives without broken units or unverified numbers.
  const stripped = normalizeDigits(text)
    .replace(
      /(?:بنسبة|بمقدار|بقيمة|نحو|حوالي|قرابة|عند|فوق|تحت|أكثر من|أقل من)?\s*[+-]?\d[\d,.]*(?:\s*(?:%|د\.?ك|kwd|طلب(?:ات)?|ساع(?:ة|ات)|موظف(?:ين)?|وحدة))?/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .replace(/\s+([،.!؟])/g, '$1')
    .trim()

  const remainingNums = extractNumbersFromMasked(
    maskEntitiesAndDates(stripped, maskCtx, { stripListPrefix: true }),
  )
  if (
    stripped.length >= 8 &&
    !containsExcludedEntity(stripped, allowQurainCentralKitchen) &&
    remainingNums.every((n) =>
      isValueAllowedWithOperands(n, allOperands, periodDays, runRateSpec, false),
    )
  ) {
    return stripped
  }

  return null
}

export function verifyFeryalContractPerClaim(
  contract: FeryalLlmContract,
  pack: FeryalContextPack,
  options?: { allowQurainCentralKitchen?: boolean },
): FeryalVerifiedContractResult {
  const allowQurainCentralKitchen = Boolean(options?.allowQurainCentralKitchen)
  const sectionMap = collectPackSectionNumbers(pack)
  const maskCtx = buildPackMaskingContext(pack)
  const { allOperands, periodDays } = collectFallbackOperands(pack, sectionMap)
  const runRateSpec = {
    elapsedDays: pack.elapsedDaysInMonth,
    totalDaysInMonth: pack.totalDaysInMonth,
  }

  const verifiedClaims: FeryalLlmClaim[] = []
  const droppedClaims: FeryalDroppedClaim[] = []
  const droppedClaimTexts = new Set<string>()
  const verifiedClaimExactValues: number[] = []

  for (const claim of contract.claims) {
    if (containsExcludedEntity(claim.text, allowQurainCentralKitchen)) {
      droppedClaims.push({ ...claim, reason: 'excluded_entity' })
      droppedClaimTexts.add(normalizeArabicText(claim.text))
      continue
    }

    const allowDeclineNeg = DECLINE_CUE_RE.test(normalizeArabicText(claim.text))
    const canonicalCited = claim.numbers.map((item) => ({
      value: item.value,
      rawSection: item.section,
      section: canonicalSectionName(item.section),
    }))

    const citedUnavailable = canonicalCited.find((c) =>
      isSectionUnavailableInPack(pack, c.section),
    )
    if (citedUnavailable) {
      droppedClaims.push({
        ...claim,
        reason: `unavailable_section:${citedUnavailable.section}`,
      })
      droppedClaimTexts.add(normalizeArabicText(claim.text))
      continue
    }

    const citedUnionOperands: number[] = []
    for (const c of canonicalCited) {
      const secNums = sectionMap.get(c.section)
      if (secNums) {
        for (const v of secNums) citedUnionOperands.push(v)
      }
    }

    let claimFailureReason: string | null = null
    for (const c of canonicalCited) {
      const ownSectionNums = [...(sectionMap.get(c.section) ?? [])]
      const primaryOps =
        ownSectionNums.length > 0
          ? [...new Set([...ownSectionNums, ...citedUnionOperands])]
          : citedUnionOperands
      const okPrimary =
        primaryOps.length > 0 &&
        isValueAllowedWithOperands(c.value, primaryOps, periodDays, runRateSpec, allowDeclineNeg)
      const okFallback =
        !okPrimary &&
        isValueAllowedWithOperands(c.value, allOperands, periodDays, runRateSpec, allowDeclineNeg)

      if (!okPrimary && !okFallback) {
        claimFailureReason = `unverified_number:${c.value}`
        break
      }
    }

    const textNums = extractNumbersFromMasked(maskEntitiesAndDates(claim.text, maskCtx))
    if (!claimFailureReason) {
      const proseOperands = citedUnionOperands.length > 0 ? citedUnionOperands : allOperands
      for (const n of textNums) {
        const okPrimary = isValueAllowedWithOperands(
          n,
          proseOperands,
          periodDays,
          runRateSpec,
          allowDeclineNeg,
        )
        const okFallback =
          !okPrimary &&
          isValueAllowedWithOperands(n, allOperands, periodDays, runRateSpec, allowDeclineNeg)
        if (!okPrimary && !okFallback) {
          claimFailureReason = `unverified_prose_number:${n}`
          break
        }
      }
    }

    if (claimFailureReason) {
      droppedClaims.push({ ...claim, reason: claimFailureReason })
      droppedClaimTexts.add(normalizeArabicText(claim.text))
      continue
    }

    for (const c of canonicalCited) {
      if (Number.isFinite(c.value)) verifiedClaimExactValues.push(c.value)
    }
    for (const n of textNums) {
      if (Number.isFinite(n)) verifiedClaimExactValues.push(n)
    }
    verifiedClaims.push(claim)
  }

  const verifiedProposals: FeryalLlmProposal[] = []
  for (const proposal of contract.proposals) {
    if (containsExcludedEntity(proposal.owner, allowQurainCentralKitchen)) continue
    const cleanText = sanitizeProposalText(
      proposal.text,
      maskCtx,
      allOperands,
      periodDays,
      runRateSpec,
      allowQurainCentralKitchen,
    )
    if (!cleanText) continue
    verifiedProposals.push({
      text: cleanText,
      owner: proposal.owner,
      kind: 'proposal',
    })
  }

  const rootCauses: FeryalLlmRootCause[] = []
  for (const rc of contract.root_causes ?? []) {
    const cleanText = sanitizeProposalText(
      rc.text,
      maskCtx,
      allOperands,
      periodDays,
      runRateSpec,
      allowQurainCentralKitchen,
    )
    if (!cleanText) continue
    rootCauses.push({ text: cleanText, kind: 'hypothesis' })
  }

  const missingMetrics: string[] = []
  const seenMissing = new Set<string>()
  for (const metric of contract.missing_metrics) {
    const trimmed = metric.trim()
    if (!trimmed || containsExcludedEntity(trimmed, allowQurainCentralKitchen)) continue
    const norm = normalizeArabicText(trimmed)
    if (seenMissing.has(norm)) continue
    seenMissing.add(norm)
    missingMetrics.push(trimmed)
  }

  const filteredLines: string[] = []
  const rawLines = (contract.answer_ar ?? '').split(/\r?\n/)
  for (const line of rawLines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue
    if (containsExcludedEntity(trimmedLine, allowQurainCentralKitchen)) continue

    const sentences = splitSentencesPreservingDecimals(trimmedLine)
    const keptSentences: string[] = []
    for (const sentence of sentences) {
      if (containsExcludedEntity(sentence, allowQurainCentralKitchen)) continue
      if (droppedClaimTexts.has(normalizeArabicText(sentence))) continue

      const masked = maskEntitiesAndDates(sentence, maskCtx, { stripListPrefix: true })
      const nums = extractNumbersFromMasked(masked)
      const allowNeg = DECLINE_CUE_RE.test(normalizeArabicText(sentence))
      const allNumsValid = nums.every(
        (n) =>
          verifiedClaimExactValues.some((v) => matchesRoundedValue(n, v)) ||
          isValueAllowedWithOperands(n, allOperands, periodDays, runRateSpec, allowNeg),
      )
      if (allNumsValid) {
        keptSentences.push(sentence)
      }
    }

    if (keptSentences.length > 0) {
      filteredLines.push(keptSentences.join(' '))
    }
  }

  const verifiedAnswerAr = filteredLines.join('\n').trim()
  const allDropped =
    (contract.claims.length > 0 && verifiedClaims.length === 0 && verifiedProposals.length === 0) ||
    (contract.claims.length === 0 &&
      contract.proposals.length === 0 &&
      verifiedAnswerAr.length === 0)

  return {
    verifiedAnswerAr,
    verifiedClaims,
    droppedClaims,
    verifiedProposals,
    missingMetrics,
    rootCauses,
    allDropped,
  }
}

function collectPackSourcesSummary(pack: FeryalContextPack): {
  modelsLabel: string
  lastSyncLabel: string
} {
  const models = new Set<string>()
  let latestSyncIso: string | null = null

  for (const key of PACK_SECTION_KEYS) {
    const section = pack[key] as FeryalPackSection<unknown>
    if (section.status !== 'ok') continue
    if (section.source.model) models.add(section.source.model)
    if (
      section.source.lastSyncAt &&
      (!latestSyncIso || section.source.lastSyncAt > latestSyncIso)
    ) {
      latestSyncIso = section.source.lastSyncAt
    }
  }

  const modelsLabel = models.size > 0 ? [...models].join(' · ') : 'pos.order'
  const lastSyncLabel = latestSyncIso ? formatKuwaitDateTime(latestSyncIso, 'ar') : 'غير متاح'
  return { modelsLabel, lastSyncLabel }
}

export function renderFeryalContractReply(
  verified: FeryalVerifiedContractResult,
  pack: FeryalContextPack,
  options?: { reviewerNote?: string; isFallback?: boolean; allowQurainCentralKitchen?: boolean },
): string {
  const blocks: string[] = []

  const analysisParts: string[] = []
  if (verified.verifiedAnswerAr.trim()) {
    analysisParts.push(verified.verifiedAnswerAr.trim())
  }
  const normalizedAnswer = normalizeArabicText(verified.verifiedAnswerAr)
  for (const claim of verified.verifiedClaims) {
    const normClaim = normalizeArabicText(claim.text)
    if (!normalizedAnswer || !normalizedAnswer.includes(normClaim)) {
      analysisParts.push(`- ${claim.text}`)
    }
  }
  if (analysisParts.length > 0) {
    blocks.push(`• التحليل والأرقام:\n${analysisParts.join('\n')}`)
  }

  if (verified.rootCauses.length > 0) {
    const rcLines = verified.rootCauses.map((rc) => `- استنتاج: ${rc.text}`)
    blocks.push(`• استنتاج:\n${rcLines.join('\n')}`)
  }

  if (verified.verifiedProposals.length > 0) {
    const proposalLines = verified.verifiedProposals.map(
      (p) => `- اقتراح (${p.owner}): ${p.text}`,
    )
    blocks.push(`• اقتراح:\n${proposalLines.join('\n')}`)
  }

  if (verified.missingMetrics.length > 0) {
    const missingLines = verified.missingMetrics.map((m) => {
      const cleaned = m
        .replace(/\s*غير متاح(?:ة)?\s+(?:لهذه الفترة\s+)?(?:في|من)\s+Odoo(?:\s+حالياً)?/gi, '')
        .replace(/\s*غير متاح(?:ة)?\s+حالياً\s+من\s+Odoo/gi, '')
        .replace(/[:.\s]+$/, '')
        .trim()
      return `- ${cleaned || m}: غير متاح في Odoo.`
    })
    blocks.push(`• قيود تغطية البيانات:\n${missingLines.join('\n')}`)
  }

  if (
    options?.reviewerNote &&
    !containsExcludedEntity(options.reviewerNote, Boolean(options.allowQurainCentralKitchen))
  ) {
    blocks.push(`• ملاحظة المراجع: ${options.reviewerNote.trim()}`)
  }

  if (options?.isFallback) {
    blocks.push('• ملاحظة: تم عرض الملخص الموثّق مباشرة لعدم توفر استجابة النموذج حالياً.')
  }

  const { modelsLabel, lastSyncLabel } = collectPackSourcesSummary(pack)
  const footer = `• المصدر: Odoo 17 · ${modelsLabel} · الفترة ${pack.period.from} → ${pack.period.to} · آخر مزامنة: ${lastSyncLabel}`
  blocks.push(footer)

  return blocks.join('\n\n')
}
