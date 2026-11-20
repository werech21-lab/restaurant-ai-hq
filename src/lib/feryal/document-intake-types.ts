import {
  checkPriceSanityDeviation,
  hasCompatibleSizePackTokens,
} from '@/lib/feryal/sku-matcher-guard'
import { Decimal } from '@/server/ai/decimal'

export const EXTRACTED_DRAFT_UNCONFIRMED_LABEL = 'Extracted Draft (Unconfirmed)' as const
export const USER_INPUT_CONFIRMED_LABEL = 'User Input (Confirmed)' as const
export const ODOO_VERIFIED_ACTUAL_LABEL = 'Odoo Verified Actual' as const
export const DETERMINISTIC_SIMULATION_LABEL = 'Deterministic Simulation' as const
export const UNMATCHED_WRONG_VARIANT_LABEL_EN = 'Unmatched / Wrong Variant' as const
export const UNMATCHED_WRONG_VARIANT_LABEL_AR = 'غير مطابق / صنف أو حجم مختلف' as const

export type FeryalGroundingSourceTag =
  | typeof EXTRACTED_DRAFT_UNCONFIRMED_LABEL
  | typeof USER_INPUT_CONFIRMED_LABEL
  | typeof ODOO_VERIFIED_ACTUAL_LABEL
  | typeof DETERMINISTIC_SIMULATION_LABEL

export type DocumentIntakeFileKind = 'xlsx' | 'csv' | 'image'

export interface ExtractedProposedOption {
  optionKey: string
  label: string
  proposedPriceKwd: string
}

export type IntakeAnomalyCode =
  | 'SUSPICIOUS_DROP_GT_30PCT'
  | 'SUSPICIOUS_LOW_PRICE'
  | 'EXTREME_JUMP_GT_60PCT'
  | 'NON_STANDARD_KWD_FILS'
  | 'DUPLICATE_SKU'
  | 'UNMATCHED_ODOO_SKU'
  | 'UNMATCHED_WRONG_VARIANT'
  | 'MISSING_OR_INVALID_PRICE'

export type IntakeAnomalySeverity = 'warning' | 'critical'

export interface IntakeAnomalyFlag {
  code: IntakeAnomalyCode
  severity: IntakeAnomalySeverity
  messageEn: string
  messageAr: string
  optionKey?: string
  referenceOdooPriceKwd?: string | null
  pctChange?: string | null
}

export interface RejectedVariantHint {
  odooName: string
  odooUnitPriceKwd: string
  diffPct: string
}

export interface DocumentIntakeRow {
  rowId: string
  brand: string | null
  itemName: string
  sheetCurrentPriceKwd: string | null
  proposedOptions: ExtractedProposedOption[]
  matchedOdooProductId: number | null
  matchedOdooProductName: string | null
  odooRealizedUnitPriceKwd: string | null
  odooQty: string | null
  odooNetSalesKwd: string | null
  rejectedVariantHint?: RejectedVariantHint | null
  excluded: boolean
  anomalies: IntakeAnomalyFlag[]
}

export interface DocumentIntakeSummary {
  totalRows: number
  matchedRows: number
  criticalCount: number
  warningCount: number
}

export interface DocumentIntakeDraft {
  draftId: string
  fileName: string
  fileKind: DocumentIntakeFileKind
  sourceTag: 'Extracted Draft (Unconfirmed)'
  requiresHumanConfirmation: true
  period: { from: string; to: string }
  brand: string | null
  branch: string | null
  rows: DocumentIntakeRow[]
  summary: DocumentIntakeSummary
}

export interface ConfirmedPriceSheetRow {
  rowId: string
  brand: string | null
  itemName: string
  currentPriceKwd: string | null
  proposedOptions: ExtractedProposedOption[]
  matchedOdooProductId: number | null
}

export interface ConfirmedPriceSheet {
  draftId: string
  fileName: string
  sourceTag: 'User Input (Confirmed)'
  confirmedAtIso: string
  rows: ConfirmedPriceSheetRow[]
}

const ZERO = Decimal.fromParts(0n, 0)
const THIRTY = Decimal.fromParts(30n, 0)
const SIXTY = Decimal.fromParts(60n, 0)
const HUNDRED = Decimal.fromParts(100n, 0)
const LOW_PRICE_THRESHOLD = Decimal.fromParts(250n, 3) // 0.250 KWD
const ABSOLUTE_LOW_MAIN_THRESHOLD = Decimal.fromParts(100n, 3) // 0.100 KWD
const MAIN_REFERENCE_THRESHOLD = Decimal.fromParts(750n, 3) // 0.750 KWD

const ADDON_HINT_RE =
  /\b(addon|add[- ]on|extra|sauce|dip|water|napkin|cutlery|bag|packaging)\b|(اضافه|إضافة|صوص|صلصه|صلصة|ماء|مياه)/i

export function normalizePriceInputText(raw: string): string {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩'
  const extendedArabic = '۰۱۲۳۴۵۶۷۸۹'
  let normalized = ''
  for (const ch of raw) {
    const idx1 = arabicIndic.indexOf(ch)
    if (idx1 >= 0) {
      normalized += String(idx1)
      continue
    }
    const idx2 = extendedArabic.indexOf(ch)
    if (idx2 >= 0) {
      normalized += String(idx2)
      continue
    }
    if (ch === '٫') {
      normalized += '.'
      continue
    }
    if (ch === '٬') {
      normalized += ','
      continue
    }
    normalized += ch
  }
  return normalized
    .replace(/(?:kwd|kd|د\.?\s*ك\.?|دينار(?:\s+كويتي)?)/gi, '')
    .replace(/,/g, '')
    .trim()
}

export function formatKwd3(value: Decimal): string {
  const rounded = value.roundHalfUp(3)
  const canonical = rounded.canonical()
  const negative = canonical.startsWith('-')
  const body = negative ? canonical.slice(1) : canonical
  const [intPart = '0', fracPart = ''] = body.split('.')
  const paddedFrac = (fracPart + '000').slice(0, 3)
  return `${negative ? '-' : ''}${intPart}.${paddedFrac}`
}

export function normalizeIntakeSkuKey(value: string): string {
  return normalizePriceInputText(value)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface ParsedPriceCandidate {
  cleaned: string
  decimal: Decimal | null
  fractionPart: string
}

function parsePriceCandidate(raw: string | null | undefined): ParsedPriceCandidate {
  if (raw == null) {
    return { cleaned: '', decimal: null, fractionPart: '' }
  }
  const cleaned = normalizePriceInputText(raw)
  if (!cleaned) {
    return { cleaned: '', decimal: null, fractionPart: '' }
  }
  const match = cleaned.match(/^([+-])?(\d+)(?:\.(\d+))?$/)
  if (!match) {
    return { cleaned, decimal: null, fractionPart: '' }
  }
  const decimal = Decimal.parse(cleaned)
  return {
    cleaned,
    decimal,
    fractionPart: match[3] ?? '',
  }
}

export function isNonStandardKwdFils(raw: string): boolean {
  const parsed = parsePriceCandidate(raw)
  if (!parsed.decimal || parsed.decimal.compare(ZERO) <= 0) return false
  if (parsed.fractionPart.length > 3) return true
  if (parsed.fractionPart.length === 3) {
    const lastFilsDigit = parsed.fractionPart[2]
    if (lastFilsDigit !== '0' && lastFilsDigit !== '5') {
      return true
    }
  }
  return false
}

function computePctChangeCanonical(candidate: Decimal, reference: Decimal): string | null {
  if (reference.compare(ZERO) <= 0) return null
  const pct = candidate.sub(reference).mul(HUNDRED).div(reference, 2)
  return pct ? pct.canonical() : null
}

function evaluatePriceAgainstReference(input: {
  rawValue: string
  optionKey: string
  optionLabel: string
  itemName: string
  referencePrice: Decimal | null
  referencePriceKwd: string | null
  isProposed: boolean
}): IntakeAnomalyFlag[] {
  const flags: IntakeAnomalyFlag[] = []
  const parsed = parsePriceCandidate(input.rawValue)

  if (!parsed.decimal || parsed.decimal.compare(ZERO) <= 0) {
    flags.push({
      code: 'MISSING_OR_INVALID_PRICE',
      severity: 'critical',
      optionKey: input.optionKey,
      referenceOdooPriceKwd: input.referencePriceKwd,
      pctChange: null,
      messageEn: `${input.optionLabel}: missing or invalid KWD price (${input.rawValue.trim() || 'empty'}).`,
      messageAr: `${input.optionLabel}: السعر مفقود أو غير صالح بالدينار الكويتي (${input.rawValue.trim() || 'فارغ'}).`,
    })
    return flags
  }

  const price = parsed.decimal
  const shownPrice = formatKwd3(price)

  if (isNonStandardKwdFils(input.rawValue)) {
    flags.push({
      code: 'NON_STANDARD_KWD_FILS',
      severity: 'warning',
      optionKey: input.optionKey,
      referenceOdooPriceKwd: input.referencePriceKwd,
      pctChange: null,
      messageEn: `${input.optionLabel} (${parsed.cleaned} KWD) uses non-standard Kuwaiti fils (expected <= 3 decimals ending in 0 or 5 fils).`,
      messageAr: `${input.optionLabel} (${parsed.cleaned} د.ك) يحتوي على فلوس غير قياسية (المعتاد حتى 3 خانات عشرية تنتهي بـ 0 أو 5 فلس).`,
    })
  }

  const ref = input.referencePrice && input.referencePrice.compare(ZERO) > 0 ? input.referencePrice : null
  const refShown = ref ? formatKwd3(ref) : null
  const pctChange = ref ? computePctChangeCanonical(price, ref) : null

  if (ref) {
    const dropAmount = ref.sub(price)
    if (dropAmount.compare(ZERO) > 0 && dropAmount.mul(HUNDRED).compare(ref.mul(THIRTY)) > 0) {
      flags.push({
        code: 'SUSPICIOUS_DROP_GT_30PCT',
        severity: 'critical',
        optionKey: input.optionKey,
        referenceOdooPriceKwd: refShown,
        pctChange,
        messageEn: `${input.optionLabel} (${shownPrice} KWD) drops ${pctChange ?? '-30'}% vs reference (${refShown} KWD) — verify potential typo.`,
        messageAr: `${input.optionLabel} (${shownPrice} د.ك) ينخفض بنسبة ${pctChange ?? '-30'}% عن السعر المرجعي (${refShown} د.ك) — يرجى التحقق من احتمال خطأ إدخال.`,
      })
    }

    const jumpAmount = price.sub(ref)
    if (jumpAmount.compare(ZERO) > 0 && jumpAmount.mul(HUNDRED).compare(ref.mul(SIXTY)) > 0) {
      const gt100 = jumpAmount.mul(HUNDRED).compare(ref.mul(HUNDRED)) > 0
      flags.push({
        code: 'EXTREME_JUMP_GT_60PCT',
        severity: gt100 ? 'critical' : 'warning',
        optionKey: input.optionKey,
        referenceOdooPriceKwd: refShown,
        pctChange,
        messageEn: `${input.optionLabel} (${shownPrice} KWD) jumps +${pctChange ?? '60'}% above reference (${refShown} KWD).`,
        messageAr: `${input.optionLabel} (${shownPrice} د.ك) يرتفع بنسبة +${pctChange ?? '60'}% فوق السعر المرجعي (${refShown} د.ك).`,
      })
    }
  }

  const isAddonItem = ADDON_HINT_RE.test(input.itemName)
  const lowVsMainRef =
    ref !== null && ref.compare(MAIN_REFERENCE_THRESHOLD) >= 0 && price.compare(LOW_PRICE_THRESHOLD) < 0
  const lowAbsoluteMain =
    !isAddonItem &&
    price.compare(ABSOLUTE_LOW_MAIN_THRESHOLD) < 0 &&
    (ref === null || ref.compare(LOW_PRICE_THRESHOLD) >= 0)

  if (lowVsMainRef || lowAbsoluteMain) {
    flags.push({
      code: 'SUSPICIOUS_LOW_PRICE',
      severity: 'critical',
      optionKey: input.optionKey,
      referenceOdooPriceKwd: refShown,
      pctChange,
      messageEn: `${input.optionLabel} (${shownPrice} KWD) is unusually low${refShown ? ` compared to ${refShown} KWD` : ''} — check decimal placement.`,
      messageAr: `${input.optionLabel} (${shownPrice} د.ك) منخفض بشكل غير معتاد${refShown ? ` مقارنةً بـ ${refShown} د.ك` : ''} — تحقق من الفاصلة العشرية.`,
    })
  }

  return flags
}

export function recomputeIntakeRowAnomalies(rows: readonly DocumentIntakeRow[]): DocumentIntakeRow[] {
  const sanitizedRows: DocumentIntakeRow[] = rows.map((row) => {
    if (row.matchedOdooProductId != null) {
      if (
        row.matchedOdooProductName &&
        !hasCompatibleSizePackTokens(row.itemName, row.matchedOdooProductName)
      ) {
        return {
          ...row,
          matchedOdooProductId: null,
          matchedOdooProductName: null,
          odooRealizedUnitPriceKwd: null,
          odooQty: null,
          odooNetSalesKwd: null,
          rejectedVariantHint: null,
        }
      }

      const sanity = checkPriceSanityDeviation(
        row.sheetCurrentPriceKwd,
        row.odooRealizedUnitPriceKwd,
      )
      if (sanity.exceedsThreshold && sanity.odooPriceKwd) {
        return {
          ...row,
          matchedOdooProductId: null,
          matchedOdooProductName: null,
          odooRealizedUnitPriceKwd: null,
          odooQty: null,
          odooNetSalesKwd: null,
          rejectedVariantHint: {
            odooName: row.matchedOdooProductName ?? row.itemName,
            odooUnitPriceKwd: sanity.odooPriceKwd,
            diffPct: sanity.diffPct ?? '35',
          },
        }
      }
    } else if (row.rejectedVariantHint) {
      const recheck = checkPriceSanityDeviation(
        row.sheetCurrentPriceKwd,
        row.rejectedVariantHint.odooUnitPriceKwd,
      )
      if (!recheck.exceedsThreshold) {
        return {
          ...row,
          rejectedVariantHint: null,
        }
      }
      return {
        ...row,
        rejectedVariantHint: {
          ...row.rejectedVariantHint,
          diffPct: recheck.diffPct ?? row.rejectedVariantHint.diffPct,
        },
      }
    }
    return row
  })

  const brandNameCounts = new Map<string, number>()
  const productIdCounts = new Map<number, number>()

  for (const row of sanitizedRows) {
    if (row.excluded) continue
    const normName = normalizeIntakeSkuKey(row.itemName)
    const normBrand = normalizeIntakeSkuKey(row.brand ?? '')
    if (normName) {
      const compositeKey = `${normBrand}::${normName}`
      brandNameCounts.set(compositeKey, (brandNameCounts.get(compositeKey) ?? 0) + 1)
    }
    if (row.matchedOdooProductId != null) {
      productIdCounts.set(
        row.matchedOdooProductId,
        (productIdCounts.get(row.matchedOdooProductId) ?? 0) + 1,
      )
    }
  }

  return sanitizedRows.map((row) => {
    const anomalies: IntakeAnomalyFlag[] = []
    const odooPriceParsed = parsePriceCandidate(row.odooRealizedUnitPriceKwd)
    const odooPrice =
      odooPriceParsed.decimal && odooPriceParsed.decimal.compare(ZERO) > 0
        ? odooPriceParsed.decimal
        : null
    const odooPriceShown = odooPrice ? formatKwd3(odooPrice) : null

    const rawCurrent = row.sheetCurrentPriceKwd?.trim() ?? ''
    let sheetCurrentDecimal: Decimal | null = null
    if (rawCurrent.length > 0) {
      const currentParsed = parsePriceCandidate(rawCurrent)
      if (currentParsed.decimal && currentParsed.decimal.compare(ZERO) > 0) {
        sheetCurrentDecimal = currentParsed.decimal
      }
      anomalies.push(
        ...evaluatePriceAgainstReference({
          rawValue: rawCurrent,
          optionKey: 'current',
          optionLabel: 'Current Price',
          itemName: row.itemName,
          referencePrice: odooPrice,
          referencePriceKwd: odooPriceShown,
          isProposed: false,
        }),
      )
    }

    const proposedRef = odooPrice ?? sheetCurrentDecimal
    const proposedRefShown = proposedRef ? formatKwd3(proposedRef) : null

    if (row.proposedOptions.length === 0) {
      anomalies.push({
        code: 'MISSING_OR_INVALID_PRICE',
        severity: 'critical',
        referenceOdooPriceKwd: proposedRefShown,
        pctChange: null,
        messageEn: 'No proposed price columns found for this item.',
        messageAr: 'لا يوجد سعر مقترح لهذا الصنف.',
      })
    } else {
      for (const option of row.proposedOptions) {
        anomalies.push(
          ...evaluatePriceAgainstReference({
            rawValue: option.proposedPriceKwd,
            optionKey: option.optionKey,
            optionLabel: option.label || option.optionKey,
            itemName: row.itemName,
            referencePrice: proposedRef,
            referencePriceKwd: proposedRefShown,
            isProposed: true,
          }),
        )
      }
    }

    if (!row.excluded) {
      const normName = normalizeIntakeSkuKey(row.itemName)
      const normBrand = normalizeIntakeSkuKey(row.brand ?? '')
      const compositeKey = `${normBrand}::${normName}`
      const duplicateByName = normName.length > 0 && (brandNameCounts.get(compositeKey) ?? 0) > 1
      const duplicateByOdooId =
        row.matchedOdooProductId != null && (productIdCounts.get(row.matchedOdooProductId) ?? 0) > 1

      if (duplicateByName || duplicateByOdooId) {
        anomalies.push({
          code: 'DUPLICATE_SKU',
          severity: 'warning',
          referenceOdooPriceKwd: odooPriceShown,
          pctChange: null,
          messageEn: `Duplicate SKU "${row.itemName.trim()}" detected across active rows.`,
          messageAr: `الصنف "${row.itemName.trim()}" مكرر في أكثر من صف نشط.`,
        })
      }
    }

    if (row.matchedOdooProductId == null) {
      if (row.rejectedVariantHint && sheetCurrentDecimal) {
        const shownCurrent = formatKwd3(sheetCurrentDecimal)
        const hint = row.rejectedVariantHint
        const signedPct = hint.diffPct.startsWith('-') ? hint.diffPct : `+${hint.diffPct}`
        anomalies.push({
          code: 'UNMATCHED_WRONG_VARIANT',
          severity: 'warning',
          referenceOdooPriceKwd: hint.odooUnitPriceKwd,
          pctChange: hint.diffPct,
          messageEn: `${UNMATCHED_WRONG_VARIANT_LABEL_EN} — sheet current price (${shownCurrent} KWD) deviates ${signedPct}% (>35%) from Odoo SKU "${hint.odooName}" (${hint.odooUnitPriceKwd} KWD).`,
          messageAr: `${UNMATCHED_WRONG_VARIANT_LABEL_AR} — السعر الحالي بالملف (${shownCurrent} د.ك) يختلف بنسبة ${signedPct}% (>35%) عن صنف Odoo "${hint.odooName}" (${hint.odooUnitPriceKwd} د.ك).`,
        })
      } else {
        anomalies.push({
          code: 'UNMATCHED_ODOO_SKU',
          severity: 'warning',
          referenceOdooPriceKwd: null,
          pctChange: null,
          messageEn: `No matching Odoo POS SKU found for "${row.itemName.trim()}" in the selected scope.`,
          messageAr: `لم يتم العثور على صنف مطابق في نقاط بيع Odoo لـ "${row.itemName.trim()}" ضمن النطاق المحدد.`,
        })
      }
    }

    return {
      ...row,
      anomalies,
    }
  })
}

export function summarizeDocumentIntakeRows(
  rows: readonly DocumentIntakeRow[],
): DocumentIntakeSummary {
  let matchedRows = 0
  let criticalCount = 0
  let warningCount = 0

  for (const row of rows) {
    if (row.excluded) continue
    if (row.matchedOdooProductId != null) {
      matchedRows += 1
    }
    for (const flag of row.anomalies) {
      if (flag.severity === 'critical') criticalCount += 1
      else warningCount += 1
    }
  }

  return {
    totalRows: rows.length,
    matchedRows,
    criticalCount,
    warningCount,
  }
}

export function recomputeDocumentIntakeDraft(draft: DocumentIntakeDraft): DocumentIntakeDraft {
  const rows = recomputeIntakeRowAnomalies(draft.rows)
  return {
    ...draft,
    sourceTag: EXTRACTED_DRAFT_UNCONFIRMED_LABEL,
    requiresHumanConfirmation: true,
    rows,
    summary: summarizeDocumentIntakeRows(rows),
  }
}

function normalizeConfirmedPriceOrNull(raw: string | null): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = parsePriceCandidate(trimmed)
  if (parsed.decimal && parsed.decimal.compare(ZERO) > 0) {
    return formatKwd3(parsed.decimal)
  }
  return trimmed
}

function normalizeConfirmedPriceRequired(raw: string): string {
  const parsed = parsePriceCandidate(raw)
  if (parsed.decimal && parsed.decimal.compare(ZERO) > 0) {
    return formatKwd3(parsed.decimal)
  }
  return raw.trim()
}

export function confirmDocumentIntakeDraft(
  draft: DocumentIntakeDraft,
  confirmedAtIso = new Date().toISOString(),
): ConfirmedPriceSheet {
  const activeRows = draft.rows.filter(
    (row) => !row.excluded && row.itemName.trim().length > 0,
  )

  return {
    draftId: draft.draftId,
    fileName: draft.fileName,
    sourceTag: USER_INPUT_CONFIRMED_LABEL,
    confirmedAtIso,
    rows: activeRows.map((row) => ({
      rowId: row.rowId,
      brand: row.brand && row.brand.trim() ? row.brand.trim() : null,
      itemName: row.itemName.trim(),
      currentPriceKwd: normalizeConfirmedPriceOrNull(row.sheetCurrentPriceKwd),
      proposedOptions: row.proposedOptions.map((opt) => ({
        optionKey: opt.optionKey,
        label: opt.label,
        proposedPriceKwd: normalizeConfirmedPriceRequired(opt.proposedPriceKwd),
      })),
      matchedOdooProductId: row.matchedOdooProductId,
    })),
  }
}

export function isConfirmedPriceSheet(value: unknown): value is ConfirmedPriceSheet {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return (
    record.sourceTag === USER_INPUT_CONFIRMED_LABEL &&
    typeof record.draftId === 'string' &&
    record.draftId.trim().length > 0 &&
    typeof record.fileName === 'string' &&
    typeof record.confirmedAtIso === 'string' &&
    Array.isArray(record.rows)
  )
}

export function isUnconfirmedDocumentDraft(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (record.requiresHumanConfirmation === true) return true
  if (record.sourceTag === EXTRACTED_DRAFT_UNCONFIRMED_LABEL) return true
  if ('sourceTag' in record && record.sourceTag !== USER_INPUT_CONFIRMED_LABEL) return true
  return false
}

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function serializePricingRowsToCsv(
  rows: ReadonlyArray<{
    brand?: string | null
    itemName: string
    currentPriceKwd?: string | null
    sheetCurrentPriceKwd?: string | null
    proposedOptions: readonly ExtractedProposedOption[]
    excluded?: boolean
  }>,
): string {
  const active = rows.filter((row) => !row.excluded && row.itemName.trim().length > 0)
  const optionColumns = new Map<string, string>()
  for (const row of active) {
    for (const opt of row.proposedOptions) {
      if (!optionColumns.has(opt.optionKey)) {
        optionColumns.set(opt.optionKey, opt.label || opt.optionKey)
      }
    }
  }
  if (optionColumns.size === 0) {
    optionColumns.set('proposed', 'Proposed')
  }
  const orderedCols = [...optionColumns.entries()]
  const header = ['Brand', 'Item Name', 'Current Price', ...orderedCols.map(([, label]) => label)]
  const csvLines = [header.map(escapeCsvCell).join(',')]

  for (const row of active) {
    const currentVal = (row.currentPriceKwd ?? row.sheetCurrentPriceKwd ?? '').trim()
    const cells = [
      (row.brand ?? '').trim(),
      row.itemName.trim(),
      currentVal,
      ...orderedCols.map(([optKey]) => {
        const found = row.proposedOptions.find((opt) => opt.optionKey === optKey)
        return (found?.proposedPriceKwd ?? '').trim()
      }),
    ]
    csvLines.push(cells.map(escapeCsvCell).join(','))
  }

  return csvLines.join('\n')
}
