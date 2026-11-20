import { Decimal } from '@/server/ai/decimal'
import { ODOO_VERIFIED_ACTUALS_LABEL, PROPOSED_USER_INPUT_LABEL } from '@/server/ai/number-guard'
import {
  COGS_UNAVAILABLE_REPLY,
  ITEM_PRICING_CHUNK_DAYS,
  ITEM_PRICING_EXCLUDED_POS_CONFIG_IDS,
  ITEM_PRICING_QURAIN_POS_CONFIG_IDS,
  ITEM_PRICING_RPC_TIMEOUT_MS,
  asksMarginOrCogs,
  assertItemPricingReadOnly,
  brandLabel,
  fetchItemPricingFromOdoo,
  itemPricingRegisterIds,
  matchProposedPrice,
  parseProposedPrices,
  posRootForBrand,
  readItemPricingLines,
  type ItemPricingExecute,
  type ItemPricingRead,
  type ItemPricingRow,
} from '@/lib/feryal/item-pricing'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import type { ConfirmedPriceSheet, DocumentIntakeDraft } from '@/lib/feryal/document-intake-types'
import {
  areSkuBrandsCompatible,
  checkPriceSanityDeviation,
  hasCompatibleSizePackTokens,
  hasCrossBrandAmbiguity,
  inferBrandIdFromSkuName,
  resolveCanonicalBrandId,
} from '@/lib/feryal/sku-matcher-guard'
import type { OdooBucketSummary, OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import posRegistry from '@/lib/odoo/pos-registry.json'
import { logger } from '@/lib/logger'

export const ODOO_VERIFIED_ACTUAL_TAG = 'Odoo Verified Actual' as const
export const USER_INPUT_CONFIRMED_TAG = 'User Input (Confirmed)' as const
export const DETERMINISTIC_SIMULATION_TAG = 'Deterministic Simulation' as const
export const HIGH_ELASTICITY_RISK_TAG = 'High Elasticity Risk' as const
export const UNCONFIRMED_DRAFT_REJECTED_ERROR = 'UNCONFIRMED_DRAFT_REJECTED' as const

export const EXECUTIVE_COGS_BOUNDARY_EN =
  'Unit food cost (COGS) and gross or net profit margins cannot be calculated because Odoo integration user 225 lacks read permission on product.product.standard_price. Every impact figure reflects net POS revenue (price_subtotal, excluding tax) with zero fabricated cost assumptions.'

export const EXECUTIVE_COGS_BOUNDARY_AR =
  'لا يمكن احتساب تكلفة البضاعة المباعة (COGS) أو هوامش الربح الإجمالية والصافية لأن مستخدم الربط في Odoo رقم 225 لا يملك صلاحية قراءة حقل standard_price. تعكس جميع الأرقام صافي إيرادات نقاط البيع (price_subtotal بدون الضريبة) دون أي تقدير للتكلفة.'

export type ExecutiveSourceTag =
  | typeof ODOO_VERIFIED_ACTUAL_TAG
  | typeof USER_INPUT_CONFIRMED_TAG
  | typeof DETERMINISTIC_SIMULATION_TAG

export type AbcTier = 'A' | 'B' | 'C'

export type SkuPlaybookAction =
  | 'Approve'
  | 'Cap Increase'
  | 'Hold / Protect Traffic'
  | 'Bundle / Upsell'
  | 'Fix Typo First'

export interface SkuVelocityRow {
  productId: number
  name: string
  qty: string
  netSalesKwd: string
  avgRealizedPriceKwd: string | null
  revenueSharePct: string
  cumulativeSharePct: string
  abcTier: AbcTier
  rank: number
  brandId?: string | null
}

export interface AbcTierSummary {
  skuCount: number
  netSalesKwd: string
  revenueSharePct: string
  totalQty: string
}

export interface ParetoClassificationResult {
  skus: SkuVelocityRow[]
  tierSummary: Record<AbcTier, AbcTierSummary>
  skuCount: number
  totalQty: string
  totalNetSalesKwd: string
}

export interface ChannelBreakdownRow {
  channelKey: string
  group: 'direct' | 'aggregator' | 'other'
  netSalesKwd: string
  orders: number | null
  sharePct: string
  sourceTag: typeof ODOO_VERIFIED_ACTUAL_TAG
}

export interface ActiveBranchVelocityRow {
  branchId: string
  labelEn: string
  labelAr: string
  netSalesKwd: string
  orders: number
  sharePct: string
  sourceTag: typeof ODOO_VERIFIED_ACTUAL_TAG
}

export interface BranchChannelMixContext {
  available: boolean
  sourceTag: typeof ODOO_VERIFIED_ACTUAL_TAG
  companyNetSalesKwd: string | null
  companyOrders: number | null
  aovKwd: string | null
  directNetSalesKwd: string
  directOrders: number | null
  directSharePct: string
  aggregatorNetSalesKwd: string
  aggregatorOrders: number | null
  aggregatorSharePct: string
  totalChannelNetSalesKwd: string
  channels: ChannelBreakdownRow[]
  topBranches: ActiveBranchVelocityRow[]
}

export interface ExecutiveDataBoundary {
  readOnly: true
  cogsReadable: false
  restrictedOdooUserId: 225
  restrictedField: 'standard_price'
  excludedPosConfigIds: readonly number[]
  includedQurainPosConfigIds: readonly number[]
  maxRpcTimeoutMs: number
  chunkDays: number
  cogsBoundaryNoteEn: string
  cogsBoundaryNoteAr: string
  cogsUnavailableReply: string
}

export interface ExecutiveContextPack {
  sourceTag: typeof ODOO_VERIFIED_ACTUAL_TAG
  period: {
    from: string
    to: string
    labelEn: string
    labelAr: string
  }
  scope: {
    brandId: string | null
    brandLabelEn: string | null
    brandLabelAr: string | null
    posRoot: string | null
    branchId: string | null
    branchLabelEn: string | null
    branchLabelAr: string | null
  }
  totals: {
    skuCount: number
    totalQty: string
    totalNetSalesKwd: string
  }
  skus: SkuVelocityRow[]
  tierSummary: Record<AbcTier, AbcTierSummary>
  branchChannelMix: BranchChannelMixContext | null
  odooQueryMeta: {
    model: 'pos.order.line'
    method: 'read_group'
    groupby: ['product_id']
    domain: unknown[]
    chunks: number
    configIds: number[]
  }
  boundary: ExecutiveDataBoundary
}

export interface ProposedPriceOptionInput {
  optionKey: string
  label: string
  proposedPriceKwd: string
}

export interface ConfirmedPriceSheetRowInput {
  rowId?: string
  brand?: string | null
  itemName: string
  currentPriceKwd?: string | null
  sheetCurrentPriceKwd?: string | null
  proposedOptions: readonly ProposedPriceOptionInput[]
  matchedOdooProductId?: number | null
  excluded?: boolean
}

export interface PriceSheetSimulationInput {
  draftId?: string
  fileName?: string
  sourceTag: string
  requiresHumanConfirmation?: boolean
  confirmedAtIso?: string
  rows: readonly ConfirmedPriceSheetRowInput[]
}

export interface SimulatedSkuLine {
  rowId: string
  itemName: string
  matched: boolean
  productId: number | null
  matchedOdooName: string | null
  abcTier: AbcTier | null
  rank: number | null
  qty: string
  odooAvgRealizedPriceKwd: string | null
  confirmedCurrentPriceKwd: string | null
  baselineUnitPriceKwd: string | null
  proposedPriceKwd: string | null
  unitPriceDeltaKwd: string | null
  pctChange: string | null
  baselineRevenueKwd: string
  baseSimQty: string
  baseDeltaKwd: string
  conservativeSimQty: string
  conservativeDeltaKwd: string
  stressSimQty: string
  stressTestDeltaKwd: string
  stressTierAOnlyDeltaKwd: string
  highElasticityRisk: boolean
  riskTag: typeof HIGH_ELASTICITY_RISK_TAG | null
  playbookAction: SkuPlaybookAction
  anomalyCodes: string[]
  rationaleEn: string
  rationaleAr: string
}

export interface SimulatedOptionResult {
  optionKey: string
  label: string
  sourceTag: typeof DETERMINISTIC_SIMULATION_TAG
  matchedSkuCount: number
  unmatchedRowCount: number
  highElasticityRiskCount: number
  fixTypoCount: number
  baselineRevenueKwd: string
  baseCase: {
    label: 'Base Case (0% volume change)'
    projectedRevenueKwd: string
    deltaKwd: string
    deltaPct: string
  }
  conservativeCase: {
    label: 'Conservative Case (-5% volume on >10% increases)'
    projectedRevenueKwd: string
    deltaKwd: string
    deltaPct: string
  }
  stressTestCase: {
    label: 'Stress-Test Case (-10% volume on Tier-A >15% increases)'
    projectedRevenueKwd: string
    deltaKwd: string
    deltaPct: string
    stressTierAOnlyDeltaKwd: string
  }
  baseDeltaKwd: string
  conservativeDeltaKwd: string
  stressTestDeltaKwd: string
  stressTierAOnlyDeltaKwd: string
  monotonicVerified: boolean
  lines: SimulatedSkuLine[]
}

export interface OptionComparisonDelta {
  leftOptionKey: string
  leftOptionLabel: string
  rightOptionKey: string
  rightOptionLabel: string
  baseDiffKwd: string
  conservativeDiffKwd: string
  stressTestDiffKwd: string
}

export interface ScenarioSimulationResult {
  sourceTag: typeof DETERMINISTIC_SIMULATION_TAG
  inputBasisTag: typeof USER_INPUT_CONFIRMED_TAG
  hasProposals: boolean
  options: SimulatedOptionResult[]
  optionComparisons: OptionComparisonDelta[]
  recommendedOptionKey: string | null
  recommendedOptionLabel: string | null
  rankedOptionKeys: string[]
  verdictStatus: 'approve' | 'approve_with_guardrails' | 'rework_required' | 'no_proposals'
  rationaleEn: string
  rationaleAr: string
}

export interface ExecutiveLabeledFact {
  id: string
  source: ExecutiveSourceTag
  label: string
  value: string
}

export interface ExecutiveGroundedNumbers {
  toolNumbers: number[]
  canonicalDecimals: string[]
  allowedEntityNames: string[]
  labeledFacts: ExecutiveLabeledFact[]
}

export interface BuildExecutiveContextPackInput {
  fromIso: string
  toIso: string
  periodLabelEn?: string
  periodLabelAr?: string
  brandId?: string | null
  branchId?: string | null
  rows: readonly ItemPricingRow[]
  itemReadMeta?: Pick<ItemPricingRead, 'domain' | 'chunks' | 'configIds'> | null
  liveSummary?: OdooLiveSummary | OdooBucketSummary | null
}

export interface FetchExecutiveContextPackInput {
  fromIso: string
  toIso: string
  periodKey?: string | null
  periodLabelEn?: string
  periodLabelAr?: string
  brandId?: string | null
  branchId?: string | null
  execute?: ItemPricingExecute
  liveSummary?: OdooLiveSummary | OdooBucketSummary | null
  includeLiveSnapshot?: boolean
  referenceNowMs?: number
}

export interface SimulateExecutivePricingInput {
  pack: ExecutiveContextPack
  sheet?: ConfirmedPriceSheet | DocumentIntakeDraft | PriceSheetSimulationInput | null
  prompt?: string | null
}

const ZERO = Decimal.fromParts(0n, 0)
const ONE = Decimal.fromParts(1n, 0)
const FIVE = Decimal.fromParts(5n, 0)
const TEN = Decimal.fromParts(10n, 0)
const FIFTEEN = Decimal.fromParts(15n, 0)
const TWENTY = Decimal.fromParts(20n, 0)
const THIRTY_FIVE = Decimal.fromParts(35n, 0)
const EIGHTY = Decimal.fromParts(80n, 0)
const NINETY_FIVE = Decimal.fromParts(95n, 0)
const HUNDRED = Decimal.fromParts(100n, 0)
const NEG_THIRTY = Decimal.fromParts(-30n, 0)
const FACTOR_95 = Decimal.fromParts(95n, 2)
const FACTOR_90 = Decimal.fromParts(90n, 2)
const MIN_SUSPICIOUS_LOW = Decimal.fromParts(250n, 3)
const REF_FOR_SUSPICIOUS_LOW = Decimal.fromParts(750n, 3)
const ABS_SUSPICIOUS_LOW = Decimal.fromParts(100n, 3)

interface RegistryLocationEntry {
  en?: string
  ar?: string
  code?: string
  unit?: string
}

function registryLocations(): Record<string, RegistryLocationEntry> {
  return (posRegistry as { locations?: Record<string, RegistryLocationEntry> }).locations ?? {}
}

function branchLabelForId(branchId: string | null): { en: string; ar: string } | null {
  if (!branchId) return null
  const loc = registryLocations()[branchId]
  if (!loc) return { en: branchId, ar: branchId }
  return {
    en: loc.en ?? branchId,
    ar: loc.ar ?? loc.en ?? branchId,
  }
}

function parseDecimal(raw: string | number | null | undefined): Decimal | null {
  if (raw == null) return null
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null
    const str = /e/i.test(String(raw)) ? raw.toFixed(8) : String(raw)
    return Decimal.parse(str)
  }
  const cleaned = raw
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',')
    .replace(/−/g, '-')
    .replace(/,/g, '')
    .trim()
  if (!cleaned) return null
  return Decimal.parse(cleaned)
}

function formatFixed(value: Decimal, scale: number): string {
  const rounded = value.roundHalfUp(scale)
  const canon = rounded.canonical()
  if (scale <= 0) return canon
  if (canon === '0') return `0.${'0'.repeat(scale)}`
  const negative = canon.startsWith('-')
  const body = negative ? canon.slice(1) : canon
  const [intPart, fracPart = ''] = body.split('.')
  const padded = fracPart.padEnd(scale, '0').slice(0, scale)
  return `${negative ? '-' : ''}${intPart}.${padded}`
}

function formatGrouped(fixedOrCanonical: string, fractionDigits: number | null, withPlus = false): string {
  const parsed = Decimal.parse(fixedOrCanonical) ?? ZERO
  const formatted = fractionDigits == null ? parsed.canonical() : formatFixed(parsed, fractionDigits)
  const negative = formatted.startsWith('-')
  const body = negative ? formatted.slice(1) : formatted
  const [intPart = '0', fracPart] = body.split('.')
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const core = fracPart !== undefined ? `${groupedInt}.${fracPart}` : groupedInt
  if (negative) return `-${core}`
  if (withPlus && parsed.sign() > 0) return `+${core}`
  return core
}

function absDecimal(value: Decimal): Decimal {
  return value.sign() < 0 ? Decimal.fromParts(-value.scaled, value.scale) : value
}

function foldItemName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeOptionKey(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug || 'proposed'
}

function classifyChannelGroup(rawKey: string): 'direct' | 'aggregator' | 'other' {
  const key = rawKey.trim().toLowerCase()
  if (
    key === 'dine-in' ||
    key === 'dine_in' ||
    key === 'dinein' ||
    key === 'takeaway-direct' ||
    key === 'takeaway_direct' ||
    key === 'takeaway' ||
    key === 'direct'
  ) {
    return 'direct'
  }
  if (
    key.startsWith('talabat') ||
    key.startsWith('deliveroo') ||
    key.startsWith('jahez') ||
    key.startsWith('keeta') ||
    key.startsWith('snoonu')
  ) {
    return 'aggregator'
  }
  return 'other'
}

/**
 * Deterministic Pareto / ABC SKU Velocity Classifier (80 / 15 / 5 rule).
 * - Sorts SKUs with `netSalesKwd > 0` by `netSalesKwd` DESC, `qty` DESC, `productId` ASC.
 * - Walks exact cumulative share `cumBefore` before adding each SKU:
 *   - Tier A: `cumBefore < 80%` (includes the SKU that crosses 80% so top-heavy or 1-SKU menus always have Tier A).
 *   - Tier B: `80% <= cumBefore < 95%`.
 *   - Tier C: `cumBefore >= 95%` (plus zero/negative revenue SKUs).
 */
export function classifyParetoAbc(rows: readonly ItemPricingRow[]): ParetoClassificationResult {
  interface ParsedSku {
    productId: number
    name: string
    qtyDec: Decimal
    netDec: Decimal
    qtyCanonical: string
    netFixed: string
    avgUnitFixed: string | null
    brandId: string | null
  }

  const parsedRows: ParsedSku[] = []
  for (const row of rows) {
    const trimmedName = (row.name ?? '').trim()
    if (!trimmedName || isExcludedOdooEntity(trimmedName)) continue
    const qtyDec = (parseDecimal(row.qty) ?? ZERO).roundHalfUp(3)
    const netDec = (parseDecimal(row.netKwd) ?? ZERO).roundHalfUp(3)
    const unitFromRow = parseDecimal(row.unitPriceKwd)
    const computedUnit =
      qtyDec.sign() > 0 ? netDec.div(qtyDec, 3) : unitFromRow ? unitFromRow.roundHalfUp(3) : null
    const resolvedBrand =
      resolveCanonicalBrandId(row.brandId) ?? inferBrandIdFromSkuName(trimmedName) ?? null
    parsedRows.push({
      productId: row.productId,
      name: trimmedName,
      qtyDec,
      netDec,
      qtyCanonical: qtyDec.canonical(),
      netFixed: formatFixed(netDec, 3),
      avgUnitFixed: computedUnit ? formatFixed(computedUnit, 3) : null,
      brandId: resolvedBrand,
    })
  }

  const compareDeterministic = (a: ParsedSku, b: ParsedSku): number => {
    const netCmp = b.netDec.compare(a.netDec)
    if (netCmp !== 0) return netCmp
    const qtyCmp = b.qtyDec.compare(a.qtyDec)
    if (qtyCmp !== 0) return qtyCmp
    return a.productId - b.productId
  }

  const positive = parsedRows.filter((item) => item.netDec.sign() > 0).sort(compareDeterministic)
  const nonPositive = parsedRows.filter((item) => item.netDec.sign() <= 0).sort(compareDeterministic)

  let totalPositiveNet = ZERO
  for (const item of positive) {
    totalPositiveNet = totalPositiveNet.add(item.netDec)
  }

  let totalNet = ZERO
  let totalQty = ZERO
  for (const item of parsedRows) {
    totalNet = totalNet.add(item.netDec)
    totalQty = totalQty.add(item.qtyDec)
  }

  const tierAcc: Record<AbcTier, { count: number; net: Decimal; qty: Decimal }> = {
    A: { count: 0, net: ZERO, qty: ZERO },
    B: { count: 0, net: ZERO, qty: ZERO },
    C: { count: 0, net: ZERO, qty: ZERO },
  }

  const skus: SkuVelocityRow[] = []
  let cumNet = ZERO
  const threshold80 = EIGHTY.mul(totalPositiveNet)
  const threshold95 = NINETY_FIVE.mul(totalPositiveNet)

  for (let index = 0; index < positive.length; index += 1) {
    const item = positive[index]
    if (!item) continue
    const cumBeforeScaled = cumNet.mul(HUNDRED)
    let tier: AbcTier
    if (cumBeforeScaled.compare(threshold80) < 0) {
      tier = 'A'
    } else if (cumBeforeScaled.compare(threshold95) < 0) {
      tier = 'B'
    } else {
      tier = 'C'
    }

    cumNet = cumNet.add(item.netDec)
    const shareDec = item.netDec.mul(HUNDRED).div(totalPositiveNet, 2) ?? ZERO
    const cumAfterDec =
      index === positive.length - 1
        ? HUNDRED
        : (cumNet.mul(HUNDRED).div(totalPositiveNet, 2) ?? ZERO)

    tierAcc[tier].count += 1
    tierAcc[tier].net = tierAcc[tier].net.add(item.netDec)
    tierAcc[tier].qty = tierAcc[tier].qty.add(item.qtyDec)

    skus.push({
      productId: item.productId,
      name: item.name,
      qty: item.qtyCanonical,
      netSalesKwd: item.netFixed,
      avgRealizedPriceKwd: item.avgUnitFixed,
      revenueSharePct: formatFixed(shareDec, 2),
      cumulativeSharePct: formatFixed(cumAfterDec, 2),
      abcTier: tier,
      rank: skus.length + 1,
      ...(item.brandId ? { brandId: item.brandId } : {}),
    })
  }

  const tailCumShare = positive.length > 0 ? '100.00' : '0.00'
  for (const item of nonPositive) {
    tierAcc.C.count += 1
    tierAcc.C.net = tierAcc.C.net.add(item.netDec)
    tierAcc.C.qty = tierAcc.C.qty.add(item.qtyDec)

    skus.push({
      productId: item.productId,
      name: item.name,
      qty: item.qtyCanonical,
      netSalesKwd: item.netFixed,
      avgRealizedPriceKwd: item.avgUnitFixed,
      revenueSharePct: '0.00',
      cumulativeSharePct: tailCumShare,
      abcTier: 'C',
      rank: skus.length + 1,
      ...(item.brandId ? { brandId: item.brandId } : {}),
    })
  }

  const formatTier = (tier: AbcTier): AbcTierSummary => {
    const entry = tierAcc[tier]
    const share =
      totalPositiveNet.sign() > 0 && entry.net.sign() > 0
        ? entry.net.mul(HUNDRED).div(totalPositiveNet, 2) ?? ZERO
        : ZERO
    return {
      skuCount: entry.count,
      netSalesKwd: formatFixed(entry.net, 3),
      revenueSharePct: formatFixed(share, 2),
      totalQty: entry.qty.roundHalfUp(3).canonical(),
    }
  }

  return {
    skus,
    tierSummary: {
      A: formatTier('A'),
      B: formatTier('B'),
      C: formatTier('C'),
    },
    skuCount: skus.length,
    totalQty: totalQty.roundHalfUp(3).canonical(),
    totalNetSalesKwd: formatFixed(totalNet, 3),
  }
}

function isLiveSummary(input: OdooLiveSummary | OdooBucketSummary): input is OdooLiveSummary {
  return 'source' in input || 'branches' in input || 'channels' in input
}

/**
 * Extracts Direct (`dine-in` + `takeaway-direct`) vs. Delivery Aggregators
 * (`talabat`, `deliveroo`, `jahez`, `keeta`, `snoonu`) net KWD & share %,
 * plus top active Venture Foods branches, tagged strictly as `'Odoo Verified Actual'`.
 */
export function buildBranchChannelMixContext(
  summary: OdooLiveSummary | OdooBucketSummary | null | undefined,
): BranchChannelMixContext | null {
  if (!summary) return null

  let targetBucket: OdooBucketSummary | undefined
  let companyNetDec: Decimal | null = null
  let companyOrders: number | null = null
  let aovDec: Decimal | null = null

  const rawChannelsMap = new Map<string, { net: Decimal; orders: number | null }>()
  const rawBranches: Array<{
    branchId: string
    labelEn: string
    labelAr: string
    net: Decimal
    orders: number
  }> = []

  if (isLiveSummary(summary)) {
    if (summary.connected === false || summary.source === 'disconnected') {
      return null
    }
    if (summary.bucket === 'custom' && summary.customBucket) {
      targetBucket = summary.customBucket
    } else if (summary.bucket && summary.bucket !== 'custom' && summary.buckets?.[summary.bucket]) {
      targetBucket = summary.buckets[summary.bucket]
    }

    const netRaw = summary.companyTotals?.netSalesKwd ?? summary.totals?.netSalesKwd ?? null
    companyNetDec = parseDecimal(netRaw)
    companyOrders = summary.companyTotals?.orders ?? summary.totals?.orders ?? null
    aovDec = parseDecimal(summary.totals?.aovKwd ?? null)

    if (targetBucket?.uiChannels) {
      for (const [key, val] of Object.entries(targetBucket.uiChannels)) {
        if (isExcludedOdooEntity(key)) continue
        const net = (parseDecimal(val?.netKwd) ?? ZERO).roundHalfUp(3)
        rawChannelsMap.set(key, { net, orders: typeof val?.orders === 'number' ? val.orders : null })
      }
    } else if (Array.isArray(summary.channels)) {
      for (const ch of summary.channels) {
        if (!ch?.name || isExcludedOdooEntity(ch.name)) continue
        const net = (parseDecimal(ch.amountKwd) ?? ZERO).roundHalfUp(3)
        rawChannelsMap.set(ch.name, { net, orders: null })
      }
    }

    if (Array.isArray(summary.branches)) {
      for (const br of summary.branches) {
        if (!br?.id || isExcludedOdooEntity(br.id) || isExcludedOdooEntity(br.name ?? '')) continue
        const net = (parseDecimal(br.netSalesKwd) ?? ZERO).roundHalfUp(3)
        if (net.sign() <= 0 && (br.orders ?? 0) <= 0) continue
        const regLabel = branchLabelForId(br.id)
        rawBranches.push({
          branchId: br.id,
          labelEn: regLabel?.en ?? br.name ?? br.id,
          labelAr: regLabel?.ar ?? br.name ?? br.id,
          net,
          orders: Math.max(0, Math.round(br.orders ?? 0)),
        })
      }
    } else if (targetBucket?.byLocation) {
      for (const [locId, locVal] of Object.entries(targetBucket.byLocation)) {
        if (isExcludedOdooEntity(locId)) continue
        const net = (parseDecimal(locVal?.netKwd) ?? ZERO).roundHalfUp(3)
        const orders = Math.max(0, Math.round(locVal?.orders ?? 0))
        if (net.sign() <= 0 && orders <= 0) continue
        const regLabel = branchLabelForId(locId)
        rawBranches.push({
          branchId: locId,
          labelEn: regLabel?.en ?? locId,
          labelAr: regLabel?.ar ?? locId,
          net,
          orders,
        })
      }
    }
  } else {
    targetBucket = summary
    companyNetDec = parseDecimal(summary.totals?.netSalesKwd ?? summary.totals?.restaurantNetKwd ?? null)
    companyOrders = summary.totals?.orders ?? summary.totals?.restaurantOrders ?? null
    aovDec = parseDecimal(summary.totals?.aovKwd ?? null)

    if (summary.uiChannels) {
      for (const [key, val] of Object.entries(summary.uiChannels)) {
        if (isExcludedOdooEntity(key)) continue
        const net = (parseDecimal(val?.netKwd) ?? ZERO).roundHalfUp(3)
        rawChannelsMap.set(key, { net, orders: typeof val?.orders === 'number' ? val.orders : null })
      }
    }

    const locSource = summary.byLocation ?? summary.mappedByLocation
    if (locSource) {
      for (const [locId, locVal] of Object.entries(locSource)) {
        if (isExcludedOdooEntity(locId)) continue
        const net = (parseDecimal(locVal?.netKwd) ?? ZERO).roundHalfUp(3)
        const orders = Math.max(0, Math.round(locVal?.orders ?? 0))
        if (net.sign() <= 0 && orders <= 0) continue
        const regLabel = branchLabelForId(locId)
        rawBranches.push({
          branchId: locId,
          labelEn: regLabel?.en ?? locId,
          labelAr: regLabel?.ar ?? locId,
          net,
          orders,
        })
      }
    }
  }

  let directNet = ZERO
  let aggregatorNet = ZERO
  let totalChannelNet = ZERO
  let directOrdersSum = 0
  let aggregatorOrdersSum = 0
  let hasDirectOrders = false
  let hasAggregatorOrders = false

  for (const [key, entry] of rawChannelsMap.entries()) {
    if (entry.net.sign() <= 0 && (entry.orders ?? 0) <= 0) continue
    const group = classifyChannelGroup(key)
    totalChannelNet = totalChannelNet.add(entry.net)
    if (group === 'direct') {
      directNet = directNet.add(entry.net)
      if (entry.orders !== null) {
        directOrdersSum += entry.orders
        hasDirectOrders = true
      }
    } else if (group === 'aggregator') {
      aggregatorNet = aggregatorNet.add(entry.net)
      if (entry.orders !== null) {
        aggregatorOrdersSum += entry.orders
        hasAggregatorOrders = true
      }
    }
  }

  const channels: ChannelBreakdownRow[] = [...rawChannelsMap.entries()]
    .filter(([, entry]) => entry.net.sign() > 0 || (entry.orders ?? 0) > 0)
    .sort((a, b) => b[1].net.compare(a[1].net) || a[0].localeCompare(b[0]))
    .map(([key, entry]) => {
      const share =
        totalChannelNet.sign() > 0 ? entry.net.mul(HUNDRED).div(totalChannelNet, 2) ?? ZERO : ZERO
      return {
        channelKey: key,
        group: classifyChannelGroup(key),
        netSalesKwd: formatFixed(entry.net, 3),
        orders: entry.orders,
        sharePct: formatFixed(share, 2),
        sourceTag: ODOO_VERIFIED_ACTUAL_TAG,
      }
    })

  let branchNetSum = ZERO
  for (const br of rawBranches) {
    branchNetSum = branchNetSum.add(br.net)
  }
  const branchShareDenom =
    companyNetDec && companyNetDec.sign() > 0 ? companyNetDec : branchNetSum

  const topBranches: ActiveBranchVelocityRow[] = rawBranches
    .sort((a, b) => b.net.compare(a.net) || b.orders - a.orders || a.branchId.localeCompare(b.branchId))
    .map((br) => {
      const share =
        branchShareDenom.sign() > 0 ? br.net.mul(HUNDRED).div(branchShareDenom, 2) ?? ZERO : ZERO
      return {
        branchId: br.branchId,
        labelEn: br.labelEn,
        labelAr: br.labelAr,
        netSalesKwd: formatFixed(br.net, 3),
        orders: br.orders,
        sharePct: formatFixed(share, 2),
        sourceTag: ODOO_VERIFIED_ACTUAL_TAG,
      }
    })

  const directShare =
    totalChannelNet.sign() > 0 ? directNet.mul(HUNDRED).div(totalChannelNet, 2) ?? ZERO : ZERO
  const aggregatorShare =
    totalChannelNet.sign() > 0 ? aggregatorNet.mul(HUNDRED).div(totalChannelNet, 2) ?? ZERO : ZERO

  const available =
    totalChannelNet.sign() > 0 ||
    topBranches.length > 0 ||
    (companyNetDec !== null && companyNetDec.sign() > 0)

  return {
    available,
    sourceTag: ODOO_VERIFIED_ACTUAL_TAG,
    companyNetSalesKwd: companyNetDec ? formatFixed(companyNetDec, 3) : null,
    companyOrders,
    aovKwd: aovDec ? formatFixed(aovDec, 3) : null,
    directNetSalesKwd: formatFixed(directNet, 3),
    directOrders: hasDirectOrders ? directOrdersSum : null,
    directSharePct: formatFixed(directShare, 2),
    aggregatorNetSalesKwd: formatFixed(aggregatorNet, 3),
    aggregatorOrders: hasAggregatorOrders ? aggregatorOrdersSum : null,
    aggregatorSharePct: formatFixed(aggregatorShare, 2),
    totalChannelNetSalesKwd: formatFixed(totalChannelNet, 3),
    channels,
    topBranches,
  }
}

export function buildExecutiveContextPack(input: BuildExecutiveContextPackInput): ExecutiveContextPack {
  const brandId = input.brandId ?? null
  const branchId = input.branchId ?? null
  const brand = brandLabel(brandId)
  const branch = branchLabelForId(branchId)
  const posRoot = posRootForBrand(brandId)
  const pareto = classifyParetoAbc(input.rows)
  const scopedBrandId = resolveCanonicalBrandId(brandId)
  const skus = scopedBrandId
    ? pareto.skus.map((sku) => (sku.brandId ? sku : { ...sku, brandId: scopedBrandId }))
    : pareto.skus
  const branchChannelMix = buildBranchChannelMixContext(input.liveSummary)
  const defaultConfigIds = itemPricingRegisterIds(branchId)

  return {
    sourceTag: ODOO_VERIFIED_ACTUAL_TAG,
    period: {
      from: input.fromIso,
      to: input.toIso,
      labelEn: input.periodLabelEn ?? `${input.fromIso} to ${input.toIso}`,
      labelAr: input.periodLabelAr ?? `${input.fromIso} إلى ${input.toIso}`,
    },
    scope: {
      brandId,
      brandLabelEn: brand?.en ?? null,
      brandLabelAr: brand?.ar ?? null,
      posRoot,
      branchId,
      branchLabelEn: branch?.en ?? null,
      branchLabelAr: branch?.ar ?? null,
    },
    totals: {
      skuCount: pareto.skuCount,
      totalQty: pareto.totalQty,
      totalNetSalesKwd: pareto.totalNetSalesKwd,
    },
    skus,
    tierSummary: pareto.tierSummary,
    branchChannelMix,
    odooQueryMeta: {
      model: 'pos.order.line',
      method: 'read_group',
      groupby: ['product_id'],
      domain: input.itemReadMeta?.domain ? [...input.itemReadMeta.domain] : [],
      chunks: input.itemReadMeta?.chunks ?? 0,
      configIds: input.itemReadMeta?.configIds ? [...input.itemReadMeta.configIds] : defaultConfigIds,
    },
    boundary: {
      readOnly: true,
      cogsReadable: false,
      restrictedOdooUserId: 225,
      restrictedField: 'standard_price',
      excludedPosConfigIds: ITEM_PRICING_EXCLUDED_POS_CONFIG_IDS,
      includedQurainPosConfigIds: ITEM_PRICING_QURAIN_POS_CONFIG_IDS,
      maxRpcTimeoutMs: ITEM_PRICING_RPC_TIMEOUT_MS,
      chunkDays: ITEM_PRICING_CHUNK_DAYS,
      cogsBoundaryNoteEn: EXECUTIVE_COGS_BOUNDARY_EN,
      cogsBoundaryNoteAr: EXECUTIVE_COGS_BOUNDARY_AR,
      cogsUnavailableReply: COGS_UNAVAILABLE_REPLY,
    },
  }
}

/**
 * Fetches read-only POS SKU velocity (`readItemPricingLines` / `fetchItemPricingFromOdoo`)
 * and optional read-only branch/channel snapshot (`fetchLiveOdooSnapshot`) without ever
 * writing to Odoo or reading `standard_price`.
 */
export async function fetchExecutiveContextPackFromOdoo(
  input: FetchExecutiveContextPackInput,
): Promise<ExecutiveContextPack | null> {
  const brandId = input.brandId ?? null
  const branchId = input.branchId ?? null
  const posRoot = posRootForBrand(brandId)

  let itemRead: ItemPricingRead | null = null
  if (input.execute) {
    const executeFn = input.execute
    itemRead = await readItemPricingLines({
      fromIso: input.fromIso,
      toIso: input.toIso,
      branchLocation: branchId,
      posRoot,
      execute: (call) => {
        assertItemPricingReadOnly(call)
        return executeFn(call)
      },
    })
  } else {
    itemRead = await fetchItemPricingFromOdoo({
      fromIso: input.fromIso,
      toIso: input.toIso,
      branchLocation: branchId,
      posRoot,
    })
  }

  if (!itemRead) return null

  let liveSummary: OdooLiveSummary | OdooBucketSummary | null = input.liveSummary ?? null
  if (!liveSummary && input.includeLiveSnapshot !== false && !input.execute) {
    try {
      const connector = await import('@/lib/odoo-live-connector')
      const periodKey = input.periodKey ?? 'custom'
      const snapshot = await connector.fetchLiveOdooSnapshot({
        period: periodKey,
        customFrom: periodKey === 'custom' ? input.fromIso : undefined,
        customTo: periodKey === 'custom' ? input.toIso : undefined,
        readOnly: true,
        referenceNowMs: input.referenceNowMs,
      })
      if (snapshot.connected) {
        liveSummary = snapshot
      }
    } catch {
      logger.warn('feryal.executive_advisor', { code: 'live_snapshot_unavailable' })
    }
  }

  return buildExecutiveContextPack({
    fromIso: input.fromIso,
    toIso: input.toIso,
    periodLabelEn: input.periodLabelEn,
    periodLabelAr: input.periodLabelAr,
    brandId,
    branchId,
    rows: itemRead.rows,
    itemReadMeta: {
      domain: itemRead.domain,
      chunks: itemRead.chunks,
      configIds: itemRead.configIds,
    },
    liveSummary,
  })
}

function parsePipeTableProposals(prompt: string): ConfirmedPriceSheetRowInput[] {
  const lines = prompt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'))
  if (lines.length < 2) return []

  const splitCells = (line: string): string[] =>
    line
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim())

  const headerCells = splitCells(lines[0] ?? '')
  if (headerCells.length < 2) return []

  const itemColIdx = headerCells.findIndex((col) =>
    /^(item|item_name|product|sku|name|dish|الصنف|المنتج|اسم الصنف)$/i.test(col),
  )
  if (itemColIdx < 0) return []

  const currentColIdx = headerCells.findIndex((col) =>
    /^(current|current_price|old_price|price|السعر الحالي|الحالي)$/i.test(col),
  )

  const optionCols: Array<{ idx: number; key: string; label: string }> = []
  for (let i = 0; i < headerCells.length; i += 1) {
    if (i === itemColIdx || i === currentColIdx) continue
    const col = headerCells[i] ?? ''
    if (!col || /^(brand|العلامة|qty|quantity|الكمية|notes|ملاحظات)$/i.test(col)) continue
    optionCols.push({
      idx: i,
      key: normalizeOptionKey(col),
      label: col,
    })
  }
  if (optionCols.length === 0) return []

  const rows: ConfirmedPriceSheetRowInput[] = []
  for (let lineIdx = 1; lineIdx < lines.length; lineIdx += 1) {
    const rawLine = lines[lineIdx] ?? ''
    if (/^[|\s:-]+$/.test(rawLine) && rawLine.includes('-')) continue
    const cells = splitCells(rawLine)
    const itemName = (cells[itemColIdx] ?? '').trim()
    if (!itemName) continue
    const currentRaw = currentColIdx >= 0 ? (cells[currentColIdx] ?? '').trim() : null
    const currentParsed = parseDecimal(currentRaw?.replace(/\s*(kwd|د\.ك)\s*$/i, '') ?? null)
    const proposedOptions: ProposedPriceOptionInput[] = []
    for (const opt of optionCols) {
      const cellVal = (cells[opt.idx] ?? '').replace(/\s*(kwd|د\.ك)\s*$/i, '').trim()
      if (!cellVal) continue
      proposedOptions.push({
        optionKey: opt.key,
        label: opt.label,
        proposedPriceKwd: cellVal,
      })
    }
    if (proposedOptions.length > 0) {
      rows.push({
        rowId: `prompt_table_${rows.length + 1}`,
        itemName,
        currentPriceKwd: currentParsed ? formatFixed(currentParsed, 3) : null,
        proposedOptions,
      })
    }
  }
  return rows
}

function parseKeyedMultiOptionLines(prompt: string): ConfirmedPriceSheetRowInput[] {
  const rows: ConfirmedPriceSheetRowInput[] = []
  const optionPairRe = /([A-Za-z][A-Za-z0-9_-]{0,15})\s*[:=]\s*([0-9][0-9,]*(?:\.[0-9]+)?)/g

  for (const rawLine of prompt.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('|')) continue
    const colonIdx = line.indexOf(':')
    if (colonIdx <= 1) continue
    const left = line.slice(0, colonIdx).replace(/^[-*•\d.)\s]+/, '').trim()
    const right = line.slice(colonIdx + 1).trim()
    if (!left || /^(proposed price for|what[- ]if|سعر مقترح)/i.test(left)) continue

    const pairs = [...right.matchAll(optionPairRe)]
    if (pairs.length < 1) continue

    let currentPriceKwd: string | null = null
    const proposedOptions: ProposedPriceOptionInput[] = []
    for (const match of pairs) {
      const rawLabel = (match[1] ?? '').trim()
      const rawAmount = (match[2] ?? '').trim()
      if (!rawLabel || !rawAmount) continue
      if (/^(current|curr|now)$/i.test(rawLabel)) {
        const dec = parseDecimal(rawAmount)
        currentPriceKwd = dec ? formatFixed(dec, 3) : null
      } else {
        proposedOptions.push({
          optionKey: normalizeOptionKey(rawLabel),
          label: rawLabel,
          proposedPriceKwd: rawAmount,
        })
      }
    }
    if (proposedOptions.length > 0) {
      rows.push({
        rowId: `prompt_multi_${rows.length + 1}`,
        itemName: left,
        currentPriceKwd,
        proposedOptions,
      })
    }
  }
  return rows
}

/**
 * Parses single-option or multi-option (`CH` vs `AE`, pipe tables, or `parseProposedPrices`)
 * pricing proposals directly from a user prompt.
 */
export function parseExecutivePromptProposals(prompt: string): ConfirmedPriceSheetRowInput[] {
  if (!prompt || !prompt.trim()) return []

  const tableRows = parsePipeTableProposals(prompt)
  if (tableRows.length > 0) return tableRows

  const multiRows = parseKeyedMultiOptionLines(prompt)
  if (multiRows.length > 0) return multiRows

  const singleProposals = parseProposedPrices(prompt)
  return singleProposals.map((proposal, index) => ({
    rowId: `prompt_row_${index + 1}`,
    itemName: proposal.label,
    currentPriceKwd: null,
    proposedOptions: [
      {
        optionKey: 'proposed',
        label: 'Proposed',
        proposedPriceKwd: proposal.amount,
      },
    ],
  }))
}

function stripLeadingSkuBracket(value: string): string {
  return value.replace(/^\s*\[[^\]]+\]\s*/, '').trim()
}

interface ProposalSkuMatchResult {
  matchedSku: SkuVelocityRow | null
  rejectedWrongVariant: boolean
}

function evaluateProposalSkuMatch(
  row: ConfirmedPriceSheetRowInput,
  skus: readonly SkuVelocityRow[],
  asItemRows: readonly ItemPricingRow[],
  skuById: ReadonlyMap<number, SkuVelocityRow>,
  contextBrandRaw: string | null | undefined,
): ProposalSkuMatchResult {
  const contextBrandId = resolveCanonicalBrandId(contextBrandRaw)
  const explicitRowBrandId =
    resolveCanonicalBrandId(row.brand) ?? inferBrandIdFromSkuName(row.itemName)

  if (contextBrandId && explicitRowBrandId && explicitRowBrandId !== contextBrandId) {
    return { matchedSku: null, rejectedWrongVariant: false }
  }

  const effectiveRowBrandId = explicitRowBrandId ?? contextBrandId
  const sheetCurrentRaw = row.currentPriceKwd ?? row.sheetCurrentPriceKwd ?? null

  const isCandidateAllowed = (sku: SkuVelocityRow): boolean => {
    if (!sku.name || isExcludedOdooEntity(sku.name)) return false
    if (
      !areSkuBrandsCompatible({
        rowBrand: explicitRowBrandId ?? row.brand,
        sheetItemName: row.itemName,
        candidateBrand: sku.brandId,
        candidateSkuName: sku.name,
        contextBrand: contextBrandId,
      })
    ) {
      return false
    }
    if (!hasCompatibleSizePackTokens(row.itemName, sku.name)) {
      return false
    }
    return true
  }

  if (row.matchedOdooProductId != null) {
    const direct = skuById.get(row.matchedOdooProductId)
    if (direct && isCandidateAllowed(direct)) {
      const sanity = checkPriceSanityDeviation(sheetCurrentRaw, direct.avgRealizedPriceKwd)
      if (sanity.exceedsThreshold) {
        return { matchedSku: null, rejectedWrongVariant: true }
      }
      return { matchedSku: direct, rejectedWrongVariant: false }
    }
  }

  const compatibleSkus = skus.filter(isCandidateAllowed)
  if (compatibleSkus.length === 0) {
    return { matchedSku: null, rejectedWrongVariant: false }
  }

  const wanted = foldItemName(stripLeadingSkuBracket(row.itemName))
  if (wanted.length < 2) {
    return { matchedSku: null, rejectedWrongVariant: false }
  }

  let candidate: SkuVelocityRow | null = null
  const exactHits = compatibleSkus.filter((sku) => {
    const full = foldItemName(sku.name)
    const stripped = foldItemName(stripLeadingSkuBracket(sku.name))
    return full === wanted || stripped === wanted
  })

  if (exactHits.length === 1) {
    candidate = exactHits[0] ?? null
  } else if (exactHits.length > 1) {
    if (hasCrossBrandAmbiguity(exactHits, effectiveRowBrandId)) {
      return { matchedSku: null, rejectedWrongVariant: false }
    }
    const sanityPassing = sheetCurrentRaw
      ? exactHits.filter(
          (sku) => !checkPriceSanityDeviation(sheetCurrentRaw, sku.avgRealizedPriceKwd).exceedsThreshold,
        )
      : exactHits
    const pool = sanityPassing.length > 0 ? sanityPassing : exactHits
    candidate = pool.slice().sort((a, b) => a.rank - b.rank)[0] ?? null
  }

  if (!candidate) {
    const compatibleItemRows = asItemRows.filter((itemRow) => {
      const sku = skuById.get(itemRow.productId)
      return sku ? isCandidateAllowed(sku) : false
    })
    const matchedItem = matchProposedPrice({ label: row.itemName, amount: '0' }, compatibleItemRows, {
      rowBrand: explicitRowBrandId ?? row.brand,
      contextBrand: contextBrandId,
    })
    candidate = matchedItem ? (skuById.get(matchedItem.productId) ?? null) : null
  }

  if (!candidate) {
    return { matchedSku: null, rejectedWrongVariant: false }
  }

  const sanity = checkPriceSanityDeviation(sheetCurrentRaw, candidate.avgRealizedPriceKwd)
  if (sanity.exceedsThreshold) {
    return { matchedSku: null, rejectedWrongVariant: true }
  }

  return { matchedSku: candidate, rejectedWrongVariant: false }
}

function classifyPlaybookAndRationale(params: {
  matched: boolean
  rejectedWrongVariant?: boolean
  itemName: string
  abcTier: AbcTier | null
  revenueSharePct: Decimal
  currentDec: Decimal | null
  proposedDec: Decimal | null
  pctChangeExact: Decimal | null
  baseDelta: Decimal
  conservativeDelta: Decimal
  stressDelta: Decimal
}): {
  highElasticityRisk: boolean
  riskTag: typeof HIGH_ELASTICITY_RISK_TAG | null
  playbookAction: SkuPlaybookAction
  anomalyCodes: string[]
  rationaleEn: string
  rationaleAr: string
} {
  const {
    matched,
    rejectedWrongVariant,
    abcTier,
    revenueSharePct,
    currentDec,
    proposedDec,
    baseDelta,
    conservativeDelta,
    stressDelta,
  } = params

  const anomalyCodes: string[] = []

  if (!matched) {
    if (rejectedWrongVariant) {
      anomalyCodes.push('UNMATCHED_WRONG_VARIANT')
      return {
        highElasticityRisk: false,
        riskTag: null,
        playbookAction: 'Fix Typo First',
        anomalyCodes,
        rationaleEn:
          'Unmatched / Wrong Variant — sheet current unit price deviates sharply from the candidate Odoo POS SKU realized price (likely platter vs single portion); verify the exact POS variant before repricing.',
        rationaleAr:
          'غير مطابق / صنف أو حجم مختلف — يختلف السعر الحالي بالملف جذرياً عن السعر الفعلي للصنف في نقاط بيع Odoo (احتمال اختلاف الحجم أو البلاتر عن الطبق الفردي)؛ يلزم التحقق من الصنف الفعلي أولاً.',
      }
    }
    anomalyCodes.push('UNMATCHED_ODOO_SKU')
    return {
      highElasticityRisk: false,
      riskTag: null,
      playbookAction: 'Fix Typo First',
      anomalyCodes,
      rationaleEn: 'No matching POS SKU found in Odoo for the selected period/brand; verify SKU name before repricing.',
      rationaleAr: 'لم يتم العثور على صنف مطابق في نقاط بيع Odoo للفترة والعلامة المحددة؛ يلزم التحقق من اسم الصنف أولاً.',
    }
  }

  if (!proposedDec || proposedDec.sign() <= 0 || !currentDec || currentDec.sign() <= 0) {
    anomalyCodes.push('MISSING_OR_INVALID_PRICE')
    return {
      highElasticityRisk: false,
      riskTag: null,
      playbookAction: 'Fix Typo First',
      anomalyCodes,
      rationaleEn: 'Missing or non-positive unit price; correct the price entry before execution.',
      rationaleAr: 'سعر الوحدة مفقود أو غير صالح؛ يجب تصحيح السعر المدخل قبل التنفيذ.',
    }
  }

  const diff = proposedDec.sub(currentDec)
  const diffTimes100 = diff.mul(HUNDRED)
  const isSuspiciousDrop = diffTimes100.compare(currentDec.mul(NEG_THIRTY)) < 0
  const isSuspiciousLow =
    (proposedDec.compare(MIN_SUSPICIOUS_LOW) < 0 && currentDec.compare(REF_FOR_SUSPICIOUS_LOW) >= 0) ||
    proposedDec.compare(ABS_SUSPICIOUS_LOW) < 0

  if (isSuspiciousDrop) anomalyCodes.push('SUSPICIOUS_DROP_GT_30PCT')
  if (isSuspiciousLow) anomalyCodes.push('SUSPICIOUS_LOW_PRICE')

  if (isSuspiciousDrop || isSuspiciousLow) {
    return {
      highElasticityRisk: false,
      riskTag: null,
      playbookAction: 'Fix Typo First',
      anomalyCodes,
      rationaleEn:
        'Proposed price drops sharply below the Odoo realized unit price and appears to be a decimal/OCR typo; block POS update until corrected.',
      rationaleAr:
        'ينخفض السعر المقترح بحدة عن السعر الفعلي المحقق في Odoo ويشتبه بكونه خطأ إدخال أو قراءة؛ يُمنع التعديل قبل التصحيح.',
    }
  }

  const isGt15 = diffTimes100.compare(currentDec.mul(FIFTEEN)) > 0
  const isGt20 = diffTimes100.compare(currentDec.mul(TWENTY)) > 0
  const isGt35 = diffTimes100.compare(currentDec.mul(THIRTY_FIVE)) > 0
  const isGt5 = diffTimes100.compare(currentDec.mul(FIVE)) > 0

  const highElasticityRisk = abcTier === 'A' && isGt15
  const riskTag = highElasticityRisk ? HIGH_ELASTICITY_RISK_TAG : null

  if (abcTier === 'A' && (isGt20 || stressDelta.sign() < 0)) {
    if (isGt20) anomalyCodes.push('TIER_A_STEEP_HIKE_GT_20PCT')
    return {
      highElasticityRisk,
      riskTag,
      playbookAction: 'Hold / Protect Traffic',
      anomalyCodes,
      rationaleEn:
        'Core Tier-A traffic anchor: steep repricing risks dine-in guest attrition and negative downside; protect check traffic or isolate uplift to delivery platforms.',
      rationaleAr:
        'صنف أساسي من الفئة A يقود حركة الطلبات: الرفع الحاد يعرض الزيارات للتآكل؛ يُنصح بتثبيت سعر الصالة أو حصر الزيادة في منصات التوصيل.',
    }
  }

  if ((abcTier === 'A' && isGt15) || isGt35 || conservativeDelta.sign() < 0) {
    if (isGt35) anomalyCodes.push('STEEP_HIKE_GT_35PCT')
    return {
      highElasticityRisk,
      riskTag,
      playbookAction: 'Cap Increase',
      anomalyCodes,
      rationaleEn:
        'Price hike triggers volume elasticity compression; cap the increase into two phased steps and test on aggregator menus first.',
      rationaleAr:
        'تؤدي نسبة الزيادة إلى ضغط على الكميات؛ يُوصى بسقف مرحلي للزيادة وتجربتها على قوائم تطبيقات التوصيل أولاً.',
    }
  }

  if (
    abcTier !== 'A' &&
    (diff.sign() <= 0 || (abcTier === 'C' && (!isGt5 || revenueSharePct.compare(ONE) < 0)))
  ) {
    return {
      highElasticityRisk: false,
      riskTag: null,
      playbookAction: 'Bundle / Upsell',
      anomalyCodes,
      rationaleEn:
        'Secondary/long-tail contributor: pair in meal combos or add-on upsells alongside Tier-A heroes to grow average order value without friction.',
      rationaleAr:
        'صنف مساند من الفئة B/C: يُوظف ضمن وجبات كومبو أو إضافات بيع تقاطعي مع أصناف الفئة A لرفع متوسط الفاتورة دون حساسية سعرية.',
    }
  }

  if (baseDelta.sign() > 0 && conservativeDelta.sign() > 0 && stressDelta.sign() > 0 && !highElasticityRisk) {
    return {
      highElasticityRisk: false,
      riskTag: null,
      playbookAction: 'Approve',
      anomalyCodes,
      rationaleEn:
        'Disciplined repricing retains positive net KWD uplift across Base, Conservative, and Stress-Test scenarios without breaching Tier-A elasticity thresholds.',
      rationaleAr:
        'زيادة منضبطة تحقق أثراً إيجابياً في صافي الإيراد عبر السيناريوهات الأساسي والمتحفظ واختبار الضغط دون تجاوز حدود مرونة الفئة A.',
    }
  }

  if (abcTier === 'A') {
    return {
      highElasticityRisk,
      riskTag,
      playbookAction: 'Hold / Protect Traffic',
      anomalyCodes,
      rationaleEn: 'Maintain current Tier-A anchor positioning to safeguard core order frequency.',
      rationaleAr: 'الحفاظ على تسعير الصنف الأساسي من الفئة A لحماية تكرار الطلبات.',
    }
  }

  return {
    highElasticityRisk: false,
    riskTag: null,
    playbookAction: 'Bundle / Upsell',
    anomalyCodes,
    rationaleEn: 'Leverage in combo engineering with Tier-A drivers to expand basket size.',
    rationaleAr: 'دمج الصنف ضمن عروض كومبو مع أصناف الفئة A لرفع قيمة السلة.',
  }
}

/**
 * Deterministic Multi-Scenario Financial Simulator:
 * - Enforces the Human Confirmation Gate (`sourceTag === 'User Input (Confirmed)'`),
 *   throwing `UNCONFIRMED_DRAFT_REJECTED` on any unconfirmed draft.
 * - Evaluates Base (0% vol), Conservative (-5% vol on >10% hikes), and
 *   Stress-Test (-10% vol on Tier-A >15% hikes, -5% on other >10% hikes) using exact `Decimal` math.
 */
export function simulateExecutivePricingOptions(
  input: SimulateExecutivePricingInput,
): ScenarioSimulationResult {
  if (input.sheet != null) {
    const requiresConfirm =
      'requiresHumanConfirmation' in input.sheet && input.sheet.requiresHumanConfirmation === true
    if (input.sheet.sourceTag !== USER_INPUT_CONFIRMED_TAG || requiresConfirm) {
      logger.warn('feryal.executive_advisor', { code: 'unconfirmed_draft_rejected' })
      throw new Error(UNCONFIRMED_DRAFT_REJECTED_ERROR)
    }
  }

  const rawRows: readonly ConfirmedPriceSheetRowInput[] =
    input.sheet != null
      ? input.sheet.rows.filter((row) => !('excluded' in row && row.excluded === true))
      : parseExecutivePromptProposals(input.prompt ?? '')

  if (rawRows.length === 0) {
    return {
      sourceTag: DETERMINISTIC_SIMULATION_TAG,
      inputBasisTag: USER_INPUT_CONFIRMED_TAG,
      hasProposals: false,
      options: [],
      optionComparisons: [],
      recommendedOptionKey: null,
      recommendedOptionLabel: null,
      rankedOptionKeys: [],
      verdictStatus: 'no_proposals',
      rationaleEn: 'No confirmed pricing proposals were supplied; displaying Odoo Pareto/ABC velocity baseline.',
      rationaleAr: 'لم يتم تقديم أسعار مقترحة مؤكدة؛ يتم عرض تحليل باريتو ABC الفعلي من Odoo.',
    }
  }

  const optionOrder: Array<{ optionKey: string; label: string }> = []
  const seenOptionKeys = new Set<string>()
  for (const row of rawRows) {
    for (const opt of row.proposedOptions) {
      const key = opt.optionKey.trim() || normalizeOptionKey(opt.label)
      if (!seenOptionKeys.has(key)) {
        seenOptionKeys.add(key)
        optionOrder.push({ optionKey: key, label: opt.label.trim() || key })
      }
    }
  }

  const skuById = new Map<number, SkuVelocityRow>(input.pack.skus.map((sku) => [sku.productId, sku]))
  const asItemRows: ItemPricingRow[] = input.pack.skus.map((sku) => ({
    productId: sku.productId,
    name: sku.name,
    qty: sku.qty,
    netKwd: sku.netSalesKwd,
    unitPriceKwd: sku.avgRealizedPriceKwd,
    categoryId: null,
    brandId: sku.brandId ?? null,
  }))

  const options: SimulatedOptionResult[] = optionOrder.map(({ optionKey, label }) => {
    const lines: SimulatedSkuLine[] = []
    let matchedSkuCount = 0
    let unmatchedRowCount = 0
    let highElasticityRiskCount = 0
    let fixTypoCount = 0

    let baselineRevSum = ZERO
    let baseDeltaSum = ZERO
    let conservativeDeltaSum = ZERO
    let stressDeltaSum = ZERO
    let stressTierAOnlySum = ZERO

    for (let idx = 0; idx < rawRows.length; idx += 1) {
      const row = rawRows[idx]
      if (!row) continue
      const optEntry = row.proposedOptions.find(
        (candidate) => (candidate.optionKey.trim() || normalizeOptionKey(candidate.label)) === optionKey,
      )
      if (!optEntry) continue

      const rowId = row.rowId ?? `row_${idx + 1}`
      const matchOutcome = evaluateProposalSkuMatch(
        row,
        input.pack.skus,
        asItemRows,
        skuById,
        input.pack.scope.brandId,
      )
      const matchedSku = matchOutcome.matchedSku
      const confirmedCurrentDec = parseDecimal(row.currentPriceKwd ?? row.sheetCurrentPriceKwd ?? null)
      const proposedDec = parseDecimal(optEntry.proposedPriceKwd)

      if (!matchedSku) {
        unmatchedRowCount += 1
        const classification = classifyPlaybookAndRationale({
          matched: false,
          rejectedWrongVariant: matchOutcome.rejectedWrongVariant,
          itemName: row.itemName,
          abcTier: null,
          revenueSharePct: ZERO,
          currentDec: confirmedCurrentDec,
          proposedDec,
          pctChangeExact: null,
          baseDelta: ZERO,
          conservativeDelta: ZERO,
          stressDelta: ZERO,
        })
        fixTypoCount += 1
        lines.push({
          rowId,
          itemName: row.itemName,
          matched: false,
          productId: null,
          matchedOdooName: null,
          abcTier: null,
          rank: null,
          qty: '0',
          odooAvgRealizedPriceKwd: null,
          confirmedCurrentPriceKwd: confirmedCurrentDec ? formatFixed(confirmedCurrentDec, 3) : null,
          baselineUnitPriceKwd: confirmedCurrentDec ? formatFixed(confirmedCurrentDec, 3) : null,
          proposedPriceKwd: proposedDec ? formatFixed(proposedDec, 3) : null,
          unitPriceDeltaKwd: null,
          pctChange: null,
          baselineRevenueKwd: '0.000',
          baseSimQty: '0',
          baseDeltaKwd: '0.000',
          conservativeSimQty: '0',
          conservativeDeltaKwd: '0.000',
          stressSimQty: '0',
          stressTestDeltaKwd: '0.000',
          stressTierAOnlyDeltaKwd: '0.000',
          highElasticityRisk: false,
          riskTag: null,
          playbookAction: classification.playbookAction,
          anomalyCodes: classification.anomalyCodes,
          rationaleEn: classification.rationaleEn,
          rationaleAr: classification.rationaleAr,
        })
        continue
      }

      matchedSkuCount += 1
      const qtyDec = parseDecimal(matchedSku.qty) ?? ZERO
      const odooUnitDec = parseDecimal(matchedSku.avgRealizedPriceKwd)
      const baselineUnitDec = odooUnitDec ?? confirmedCurrentDec
      const shareDec = parseDecimal(matchedSku.revenueSharePct) ?? ZERO

      if (!baselineUnitDec || baselineUnitDec.sign() <= 0 || !proposedDec || proposedDec.sign() <= 0 || qtyDec.sign() <= 0) {
        const classification = classifyPlaybookAndRationale({
          matched: true,
          itemName: row.itemName,
          abcTier: matchedSku.abcTier,
          revenueSharePct: shareDec,
          currentDec: baselineUnitDec,
          proposedDec,
          pctChangeExact: null,
          baseDelta: ZERO,
          conservativeDelta: ZERO,
          stressDelta: ZERO,
        })
        if (classification.playbookAction === 'Fix Typo First') fixTypoCount += 1
        lines.push({
          rowId,
          itemName: row.itemName,
          matched: true,
          productId: matchedSku.productId,
          matchedOdooName: matchedSku.name,
          abcTier: matchedSku.abcTier,
          rank: matchedSku.rank,
          qty: qtyDec.canonical(),
          odooAvgRealizedPriceKwd: odooUnitDec ? formatFixed(odooUnitDec, 3) : null,
          confirmedCurrentPriceKwd: confirmedCurrentDec ? formatFixed(confirmedCurrentDec, 3) : null,
          baselineUnitPriceKwd: baselineUnitDec ? formatFixed(baselineUnitDec, 3) : null,
          proposedPriceKwd: proposedDec ? formatFixed(proposedDec, 3) : null,
          unitPriceDeltaKwd: null,
          pctChange: null,
          baselineRevenueKwd: '0.000',
          baseSimQty: qtyDec.canonical(),
          baseDeltaKwd: '0.000',
          conservativeSimQty: qtyDec.canonical(),
          conservativeDeltaKwd: '0.000',
          stressSimQty: qtyDec.canonical(),
          stressTestDeltaKwd: '0.000',
          stressTierAOnlyDeltaKwd: '0.000',
          highElasticityRisk: false,
          riskTag: null,
          playbookAction: classification.playbookAction,
          anomalyCodes: classification.anomalyCodes,
          rationaleEn: classification.rationaleEn,
          rationaleAr: classification.rationaleAr,
        })
        continue
      }

      const unitDelta = proposedDec.sub(baselineUnitDec)
      const diffTimes100 = unitDelta.mul(HUNDRED)
      const pctChangeDec = diffTimes100.div(baselineUnitDec, 2) ?? ZERO

      const isGt10 = diffTimes100.compare(baselineUnitDec.mul(TEN)) > 0
      const isGt15 = diffTimes100.compare(baselineUnitDec.mul(FIFTEEN)) > 0
      const isTierAGt15 = matchedSku.abcTier === 'A' && isGt15

      const baselineRevExact = qtyDec.mul(baselineUnitDec)
      const baselineRevRounded = baselineRevExact.roundHalfUp(3)

      const baseSimQty = qtyDec
      const baseDeltaRounded = qtyDec.mul(unitDelta).roundHalfUp(3)

      const conservativeSimQty = isGt10 ? qtyDec.mul(FACTOR_95) : qtyDec
      const conservativeDeltaRounded = isGt10
        ? conservativeSimQty.mul(proposedDec).sub(baselineRevExact).roundHalfUp(3)
        : baseDeltaRounded

      const stressSimQty = isTierAGt15
        ? qtyDec.mul(FACTOR_90)
        : isGt10
          ? qtyDec.mul(FACTOR_95)
          : qtyDec
      const stressDeltaRounded = isTierAGt15
        ? stressSimQty.mul(proposedDec).sub(baselineRevExact).roundHalfUp(3)
        : conservativeDeltaRounded

      const pureStressSimQty = isTierAGt15 ? qtyDec.mul(FACTOR_90) : qtyDec
      const stressTierAOnlyRounded = isTierAGt15
        ? pureStressSimQty.mul(proposedDec).sub(baselineRevExact).roundHalfUp(3)
        : baseDeltaRounded

      const classification = classifyPlaybookAndRationale({
        matched: true,
        itemName: row.itemName,
        abcTier: matchedSku.abcTier,
        revenueSharePct: shareDec,
        currentDec: baselineUnitDec,
        proposedDec,
        pctChangeExact: pctChangeDec,
        baseDelta: baseDeltaRounded,
        conservativeDelta: conservativeDeltaRounded,
        stressDelta: stressDeltaRounded,
      })

      if (classification.highElasticityRisk) highElasticityRiskCount += 1
      if (classification.playbookAction === 'Fix Typo First') fixTypoCount += 1

      baselineRevSum = baselineRevSum.add(baselineRevRounded)
      baseDeltaSum = baseDeltaSum.add(baseDeltaRounded)
      conservativeDeltaSum = conservativeDeltaSum.add(conservativeDeltaRounded)
      stressDeltaSum = stressDeltaSum.add(stressDeltaRounded)
      stressTierAOnlySum = stressTierAOnlySum.add(stressTierAOnlyRounded)

      lines.push({
        rowId,
        itemName: row.itemName,
        matched: true,
        productId: matchedSku.productId,
        matchedOdooName: matchedSku.name,
        abcTier: matchedSku.abcTier,
        rank: matchedSku.rank,
        qty: qtyDec.canonical(),
        odooAvgRealizedPriceKwd: odooUnitDec ? formatFixed(odooUnitDec, 3) : null,
        confirmedCurrentPriceKwd: confirmedCurrentDec ? formatFixed(confirmedCurrentDec, 3) : null,
        baselineUnitPriceKwd: formatFixed(baselineUnitDec, 3),
        proposedPriceKwd: formatFixed(proposedDec, 3),
        unitPriceDeltaKwd: formatFixed(unitDelta, 3),
        pctChange: formatFixed(pctChangeDec, 2),
        baselineRevenueKwd: formatFixed(baselineRevRounded, 3),
        baseSimQty: baseSimQty.roundHalfUp(3).canonical(),
        baseDeltaKwd: formatFixed(baseDeltaRounded, 3),
        conservativeSimQty: conservativeSimQty.roundHalfUp(3).canonical(),
        conservativeDeltaKwd: formatFixed(conservativeDeltaRounded, 3),
        stressSimQty: stressSimQty.roundHalfUp(3).canonical(),
        stressTestDeltaKwd: formatFixed(stressDeltaRounded, 3),
        stressTierAOnlyDeltaKwd: formatFixed(stressTierAOnlyRounded, 3),
        highElasticityRisk: classification.highElasticityRisk,
        riskTag: classification.riskTag,
        playbookAction: classification.playbookAction,
        anomalyCodes: classification.anomalyCodes,
        rationaleEn: classification.rationaleEn,
        rationaleAr: classification.rationaleAr,
      })
    }

    lines.sort((a, b) => {
      const aAbs = absDecimal(parseDecimal(a.baseDeltaKwd) ?? ZERO)
      const bAbs = absDecimal(parseDecimal(b.baseDeltaKwd) ?? ZERO)
      const cmp = bAbs.compare(aAbs)
      if (cmp !== 0) return cmp
      return (a.rank ?? 999_999) - (b.rank ?? 999_999)
    })

    const baseProj = baselineRevSum.add(baseDeltaSum)
    const consProj = baselineRevSum.add(conservativeDeltaSum)
    const stressProj = baselineRevSum.add(stressDeltaSum)

    const pctOfBaseline = (delta: Decimal): string => {
      if (baselineRevSum.sign() <= 0) return '0.00'
      const pct = delta.mul(HUNDRED).div(baselineRevSum, 2) ?? ZERO
      return formatFixed(pct, 2)
    }

    const monotonicVerified =
      baseDeltaSum.compare(conservativeDeltaSum) >= 0 &&
      conservativeDeltaSum.compare(stressDeltaSum) >= 0

    const baseDeltaFixed = formatFixed(baseDeltaSum, 3)
    const consDeltaFixed = formatFixed(conservativeDeltaSum, 3)
    const stressDeltaFixed = formatFixed(stressDeltaSum, 3)
    const stressTierAOnlyFixed = formatFixed(stressTierAOnlySum, 3)

    return {
      optionKey,
      label,
      sourceTag: DETERMINISTIC_SIMULATION_TAG,
      matchedSkuCount,
      unmatchedRowCount,
      highElasticityRiskCount,
      fixTypoCount,
      baselineRevenueKwd: formatFixed(baselineRevSum, 3),
      baseCase: {
        label: 'Base Case (0% volume change)',
        projectedRevenueKwd: formatFixed(baseProj, 3),
        deltaKwd: baseDeltaFixed,
        deltaPct: pctOfBaseline(baseDeltaSum),
      },
      conservativeCase: {
        label: 'Conservative Case (-5% volume on >10% increases)',
        projectedRevenueKwd: formatFixed(consProj, 3),
        deltaKwd: consDeltaFixed,
        deltaPct: pctOfBaseline(conservativeDeltaSum),
      },
      stressTestCase: {
        label: 'Stress-Test Case (-10% volume on Tier-A >15% increases)',
        projectedRevenueKwd: formatFixed(stressProj, 3),
        deltaKwd: stressDeltaFixed,
        deltaPct: pctOfBaseline(stressDeltaSum),
        stressTierAOnlyDeltaKwd: stressTierAOnlyFixed,
      },
      baseDeltaKwd: baseDeltaFixed,
      conservativeDeltaKwd: consDeltaFixed,
      stressTestDeltaKwd: stressDeltaFixed,
      stressTierAOnlyDeltaKwd: stressTierAOnlyFixed,
      monotonicVerified,
      lines,
    }
  })

  const ranked = [...options].sort((a, b) => {
    const aClean = a.fixTypoCount === 0 ? 0 : 1
    const bClean = b.fixTypoCount === 0 ? 0 : 1
    if (aClean !== bClean) return aClean - bClean

    const aStress = parseDecimal(a.stressTestDeltaKwd) ?? ZERO
    const bStress = parseDecimal(b.stressTestDeltaKwd) ?? ZERO
    const stressCmp = bStress.compare(aStress)
    if (stressCmp !== 0) return stressCmp

    const aCons = parseDecimal(a.conservativeDeltaKwd) ?? ZERO
    const bCons = parseDecimal(b.conservativeDeltaKwd) ?? ZERO
    const consCmp = bCons.compare(aCons)
    if (consCmp !== 0) return consCmp

    if (a.highElasticityRiskCount !== b.highElasticityRiskCount) {
      return a.highElasticityRiskCount - b.highElasticityRiskCount
    }

    const aBase = parseDecimal(a.baseDeltaKwd) ?? ZERO
    const bBase = parseDecimal(b.baseDeltaKwd) ?? ZERO
    const baseCmp = bBase.compare(aBase)
    if (baseCmp !== 0) return baseCmp

    return a.optionKey.localeCompare(b.optionKey)
  })

  const optionComparisons: OptionComparisonDelta[] = []
  for (let i = 0; i < ranked.length; i += 1) {
    for (let j = i + 1; j < ranked.length; j += 1) {
      const left = ranked[i]
      const right = ranked[j]
      if (!left || !right) continue
      const leftBase = parseDecimal(left.baseDeltaKwd) ?? ZERO
      const rightBase = parseDecimal(right.baseDeltaKwd) ?? ZERO
      const leftCons = parseDecimal(left.conservativeDeltaKwd) ?? ZERO
      const rightCons = parseDecimal(right.conservativeDeltaKwd) ?? ZERO
      const leftStress = parseDecimal(left.stressTestDeltaKwd) ?? ZERO
      const rightStress = parseDecimal(right.stressTestDeltaKwd) ?? ZERO

      optionComparisons.push({
        leftOptionKey: left.optionKey,
        leftOptionLabel: left.label,
        rightOptionKey: right.optionKey,
        rightOptionLabel: right.label,
        baseDiffKwd: formatFixed(leftBase.sub(rightBase), 3),
        conservativeDiffKwd: formatFixed(leftCons.sub(rightCons), 3),
        stressTestDiffKwd: formatFixed(leftStress.sub(rightStress), 3),
      })
    }
  }

  const winner = ranked[0] ?? null
  if (!winner) {
    return {
      sourceTag: DETERMINISTIC_SIMULATION_TAG,
      inputBasisTag: USER_INPUT_CONFIRMED_TAG,
      hasProposals: false,
      options: [],
      optionComparisons: [],
      recommendedOptionKey: null,
      recommendedOptionLabel: null,
      rankedOptionKeys: [],
      verdictStatus: 'no_proposals',
      rationaleEn: 'No valid pricing options were found.',
      rationaleAr: 'لم يتم العثور على خيارات تسعير صالحة.',
    }
  }

  const winnerStress = parseDecimal(winner.stressTestDeltaKwd) ?? ZERO
  let verdictStatus: ScenarioSimulationResult['verdictStatus']
  let rationaleEn: string
  let rationaleAr: string

  if (winner.fixTypoCount > 0 || winnerStress.sign() <= 0) {
    verdictStatus = 'rework_required'
    rationaleEn =
      winner.fixTypoCount > 0
        ? `Option ${winner.label} (${winner.optionKey}) ranks highest on downside protection (${formatGrouped(winner.stressTestDeltaKwd, 3, true)} KWD Stress-Test), but contains ${winner.fixTypoCount} flagged typo/unmatched row(s) that must be corrected before deployment.`
        : `All evaluated options yield non-positive Stress-Test net revenue (${winner.label}: ${formatGrouped(winner.stressTestDeltaKwd, 3, true)} KWD); hold broad repricing and rework SKU-level caps.`
    rationaleAr =
      winner.fixTypoCount > 0
        ? `يتصدر الخيار ${winner.label} (${winner.optionKey}) من حيث حماية الإيراد في اختبار الضغط (${formatGrouped(winner.stressTestDeltaKwd, 3, true)} د.ك)، لكنه يتضمن ${winner.fixTypoCount} صنفاً يتطلب تصحيح الخطأ أو المطابقة قبل الاعتماد.`
        : `تُظهر جميع الخيارات أثراً غير إيجابي في سيناريو اختبار الضغط (${winner.label}: ${formatGrouped(winner.stressTestDeltaKwd, 3, true)} د.ك)؛ يُوصى بتجميد التعميم وإعادة ضبط السقوف السعرية.`
  } else if (winner.highElasticityRiskCount > 0) {
    verdictStatus = 'approve_with_guardrails'
    rationaleEn = `Recommend Option ${winner.label} (${winner.optionKey}) with Tier-A caps: delivers ${formatGrouped(winner.stressTestDeltaKwd, 3, true)} KWD in Stress-Test (${formatGrouped(winner.conservativeDeltaKwd, 3, true)} KWD Conservative, ${formatGrouped(winner.baseDeltaKwd, 3, true)} KWD Base), provided ${winner.highElasticityRiskCount} High Elasticity Risk Tier-A SKU(s) are capped or restricted to aggregator channels.`
    rationaleAr = `يُوصى باعتماد الخيار ${winner.label} (${winner.optionKey}) مع ضوابط الفئة A: يحقق ${formatGrouped(winner.stressTestDeltaKwd, 3, true)} د.ك في اختبار الضغط (${formatGrouped(winner.conservativeDeltaKwd, 3, true)} د.ك متحفظ، ${formatGrouped(winner.baseDeltaKwd, 3, true)} د.ك أساسي)، شريطة وضع سقف لعدد ${winner.highElasticityRiskCount} من أصناف الفئة A ذات مخاطر المرونة العالية.`
  } else {
    verdictStatus = 'approve'
    rationaleEn = `Approve Option ${winner.label} (${winner.optionKey}): captures ${formatGrouped(winner.stressTestDeltaKwd, 3, true)} KWD under Stress-Test (${formatGrouped(winner.conservativeDeltaKwd, 3, true)} KWD Conservative, ${formatGrouped(winner.baseDeltaKwd, 3, true)} KWD Base) with zero Tier-A elasticity breaches.`
    rationaleAr = `يُوصى باعتماد الخيار ${winner.label} (${winner.optionKey}): يحقق ${formatGrouped(winner.stressTestDeltaKwd, 3, true)} د.ك في اختبار الضغط (${formatGrouped(winner.conservativeDeltaKwd, 3, true)} د.ك متحفظ، ${formatGrouped(winner.baseDeltaKwd, 3, true)} د.ك أساسي) دون أي تجاوز لحدود مرونة الفئة A.`
  }

  return {
    sourceTag: DETERMINISTIC_SIMULATION_TAG,
    inputBasisTag: USER_INPUT_CONFIRMED_TAG,
    hasProposals: true,
    options,
    optionComparisons,
    recommendedOptionKey: winner.optionKey,
    recommendedOptionLabel: winner.label,
    rankedOptionKeys: ranked.map((opt) => opt.optionKey),
    verdictStatus,
    rationaleEn,
    rationaleAr,
  }
}

/**
 * Collects every grounded figure from `ExecutiveContextPack` and `ScenarioSimulationResult`,
 * including half-up `0dp`, `1dp`, `2dp`, `3dp` representations (and positive magnitudes for
 * signed deltas) so `number-guard.ts` and `verifyFeryalReplyNumbers` never false-reject
 * legitimate grounded executive analysis while continuing to block fabricated figures.
 */
export function collectExecutiveGroundedNumbers(
  pack: ExecutiveContextPack,
  simulation?: ScenarioSimulationResult | null,
): ExecutiveGroundedNumbers {
  const labeledFacts: ExecutiveLabeledFact[] = []
  const canonicalSet = new Set<string>()
  const toolNumberSet = new Set<number>()
  const entityNameSet = new Set<string>()

  const registerVariants = (dec: Decimal): void => {
    const candidates = [
      dec,
      dec.roundHalfUp(3),
      dec.roundHalfUp(2),
      dec.roundHalfUp(1),
      dec.roundHalfUp(0),
    ]
    if (dec.sign() < 0) {
      const positive = absDecimal(dec)
      candidates.push(
        positive,
        positive.roundHalfUp(3),
        positive.roundHalfUp(2),
        positive.roundHalfUp(1),
        positive.roundHalfUp(0),
      )
    }
    for (const item of candidates) {
      const canon = item.canonical()
      canonicalSet.add(canon)
      const num = Number(canon)
      if (Number.isFinite(num)) toolNumberSet.add(num)
    }
  }

  const addFact = (
    id: string,
    source: ExecutiveSourceTag,
    label: string,
    raw: string | number | null | undefined,
  ): void => {
    const dec = parseDecimal(raw)
    if (!dec) return
    const canon = dec.canonical()
    labeledFacts.push({ id, source, label, value: canon })
    registerVariants(dec)
  }

  if (pack.scope.brandLabelEn) entityNameSet.add(pack.scope.brandLabelEn)
  if (pack.scope.brandLabelAr) entityNameSet.add(pack.scope.brandLabelAr)
  if (pack.scope.branchLabelEn) entityNameSet.add(pack.scope.branchLabelEn)
  if (pack.scope.branchLabelAr) entityNameSet.add(pack.scope.branchLabelAr)

  addFact('odoo_total_net_sales_kwd', ODOO_VERIFIED_ACTUAL_TAG, 'Total Net POS Sales (KWD)', pack.totals.totalNetSalesKwd)
  addFact('odoo_total_qty', ODOO_VERIFIED_ACTUAL_TAG, 'Total Units Sold', pack.totals.totalQty)
  addFact('odoo_sku_count', ODOO_VERIFIED_ACTUAL_TAG, 'Active SKU Count', pack.totals.skuCount)

  for (const sku of pack.skus) {
    entityNameSet.add(sku.name)
    addFact(`sku_${sku.productId}_net_kwd`, ODOO_VERIFIED_ACTUAL_TAG, `${sku.name} Net Sales (KWD)`, sku.netSalesKwd)
    addFact(`sku_${sku.productId}_qty`, ODOO_VERIFIED_ACTUAL_TAG, `${sku.name} Quantity Sold`, sku.qty)
    if (sku.avgRealizedPriceKwd !== null) {
      addFact(
        `sku_${sku.productId}_avg_price_kwd`,
        ODOO_VERIFIED_ACTUAL_TAG,
        `${sku.name} Realized Unit Price (KWD)`,
        sku.avgRealizedPriceKwd,
      )
    }
    addFact(
      `sku_${sku.productId}_share_pct`,
      ODOO_VERIFIED_ACTUAL_TAG,
      `${sku.name} Revenue Share (%)`,
      sku.revenueSharePct,
    )
    addFact(
      `sku_${sku.productId}_cum_share_pct`,
      ODOO_VERIFIED_ACTUAL_TAG,
      `${sku.name} Cumulative Share (%)`,
      sku.cumulativeSharePct,
    )
    addFact(`sku_${sku.productId}_rank`, ODOO_VERIFIED_ACTUAL_TAG, `${sku.name} Velocity Rank`, sku.rank)
  }

  for (const tier of ['A', 'B', 'C'] as const) {
    const summary = pack.tierSummary[tier]
    addFact(`tier_${tier}_sku_count`, ODOO_VERIFIED_ACTUAL_TAG, `Tier ${tier} SKU Count`, summary.skuCount)
    addFact(`tier_${tier}_net_kwd`, ODOO_VERIFIED_ACTUAL_TAG, `Tier ${tier} Net Sales (KWD)`, summary.netSalesKwd)
    addFact(`tier_${tier}_share_pct`, ODOO_VERIFIED_ACTUAL_TAG, `Tier ${tier} Revenue Share (%)`, summary.revenueSharePct)
    addFact(`tier_${tier}_qty`, ODOO_VERIFIED_ACTUAL_TAG, `Tier ${tier} Total Qty`, summary.totalQty)
  }

  if (pack.branchChannelMix?.available) {
    const mix = pack.branchChannelMix
    if (mix.companyNetSalesKwd !== null) {
      addFact('mix_company_net_kwd', ODOO_VERIFIED_ACTUAL_TAG, 'Company Period Net Sales (KWD)', mix.companyNetSalesKwd)
    }
    if (mix.companyOrders !== null) {
      addFact('mix_company_orders', ODOO_VERIFIED_ACTUAL_TAG, 'Company Period Orders', mix.companyOrders)
    }
    if (mix.aovKwd !== null) {
      addFact('mix_company_aov_kwd', ODOO_VERIFIED_ACTUAL_TAG, 'Company Average Order Value (KWD)', mix.aovKwd)
    }
    addFact('mix_direct_net_kwd', ODOO_VERIFIED_ACTUAL_TAG, 'Direct Channels Net Sales (KWD)', mix.directNetSalesKwd)
    addFact('mix_direct_share_pct', ODOO_VERIFIED_ACTUAL_TAG, 'Direct Channels Share (%)', mix.directSharePct)
    if (mix.directOrders !== null) {
      addFact('mix_direct_orders', ODOO_VERIFIED_ACTUAL_TAG, 'Direct Channels Orders', mix.directOrders)
    }
    addFact(
      'mix_aggregator_net_kwd',
      ODOO_VERIFIED_ACTUAL_TAG,
      'Delivery Aggregators Net Sales (KWD)',
      mix.aggregatorNetSalesKwd,
    )
    addFact(
      'mix_aggregator_share_pct',
      ODOO_VERIFIED_ACTUAL_TAG,
      'Delivery Aggregators Share (%)',
      mix.aggregatorSharePct,
    )
    if (mix.aggregatorOrders !== null) {
      addFact('mix_aggregator_orders', ODOO_VERIFIED_ACTUAL_TAG, 'Delivery Aggregators Orders', mix.aggregatorOrders)
    }
    addFact('mix_total_channel_net_kwd', ODOO_VERIFIED_ACTUAL_TAG, 'Total Channel Net Sales (KWD)', mix.totalChannelNetSalesKwd)

    for (const ch of mix.channels) {
      entityNameSet.add(ch.channelKey)
      addFact(`channel_${ch.channelKey}_net_kwd`, ODOO_VERIFIED_ACTUAL_TAG, `Channel ${ch.channelKey} Net (KWD)`, ch.netSalesKwd)
      addFact(`channel_${ch.channelKey}_share_pct`, ODOO_VERIFIED_ACTUAL_TAG, `Channel ${ch.channelKey} Share (%)`, ch.sharePct)
      if (ch.orders !== null) {
        addFact(`channel_${ch.channelKey}_orders`, ODOO_VERIFIED_ACTUAL_TAG, `Channel ${ch.channelKey} Orders`, ch.orders)
      }
    }

    for (const br of mix.topBranches) {
      entityNameSet.add(br.labelEn)
      entityNameSet.add(br.labelAr)
      addFact(`branch_${br.branchId}_net_kwd`, ODOO_VERIFIED_ACTUAL_TAG, `${br.labelEn} Net Sales (KWD)`, br.netSalesKwd)
      addFact(`branch_${br.branchId}_orders`, ODOO_VERIFIED_ACTUAL_TAG, `${br.labelEn} Orders`, br.orders)
      addFact(`branch_${br.branchId}_share_pct`, ODOO_VERIFIED_ACTUAL_TAG, `${br.labelEn} Share (%)`, br.sharePct)
    }
  }

  if (simulation?.hasProposals) {
    addFact('sim_option_count', DETERMINISTIC_SIMULATION_TAG, 'Evaluated Option Count', simulation.options.length)

    for (const opt of simulation.options) {
      entityNameSet.add(opt.label)
      addFact(
        `opt_${opt.optionKey}_matched_count`,
        DETERMINISTIC_SIMULATION_TAG,
        `Option ${opt.label} Matched SKUs`,
        opt.matchedSkuCount,
      )
      addFact(
        `opt_${opt.optionKey}_unmatched_count`,
        DETERMINISTIC_SIMULATION_TAG,
        `Option ${opt.label} Unmatched Rows`,
        opt.unmatchedRowCount,
      )
      addFact(
        `opt_${opt.optionKey}_high_risk_count`,
        DETERMINISTIC_SIMULATION_TAG,
        `Option ${opt.label} High Elasticity Risk Count`,
        opt.highElasticityRiskCount,
      )
      addFact(
        `opt_${opt.optionKey}_typo_count`,
        DETERMINISTIC_SIMULATION_TAG,
        `Option ${opt.label} Typo Flag Count`,
        opt.fixTypoCount,
      )
      addFact(
        `opt_${opt.optionKey}_baseline_rev_kwd`,
        DETERMINISTIC_SIMULATION_TAG,
        `Option ${opt.label} Baseline Revenue (KWD)`,
        opt.baselineRevenueKwd,
      )
      addFact(
        `opt_${opt.optionKey}_base_proj_kwd`,
        DETERMINISTIC_SIMULATION_TAG,
        `Option ${opt.label} Base Projected Revenue (KWD)`,
        opt.baseCase.projectedRevenueKwd,
      )
      addFact(
        `opt_${opt.optionKey}_base_delta_kwd`,
        DETERMINISTIC_SIMULATION_TAG,
        `Option ${opt.label} Base Delta (KWD)`,
        opt.baseDeltaKwd,
      )
      addFact(
        `opt_${opt.optionKey}_base_delta_pct`,
        DETERMINISTIC_SIMULATION_TAG,
        `Option ${opt.label} Base Delta (%)`,
        opt.baseCase.deltaPct,
      )
      addFact(
        `opt_${opt.optionKey}_cons_proj_kwd`,
        DETERMINISTIC_SIMULATION_TAG,
        `Option ${opt.label} Conservative Projected Revenue (KWD)`,
        opt.conservativeCase.projectedRevenueKwd,
      )
      addFact(
        `opt_${opt.optionKey}_cons_delta_kwd`,
        DETERMINISTIC_SIMULATION_TAG,
        `Option ${opt.label} Conservative Delta (KWD)`,
        opt.conservativeDeltaKwd,
      )
      addFact(
        `opt_${opt.optionKey}_cons_delta_pct`,
        DETERMINISTIC_SIMULATION_TAG,
        `Option ${opt.label} Conservative Delta (%)`,
        opt.conservativeCase.deltaPct,
      )
      addFact(
        `opt_${opt.optionKey}_stress_proj_kwd`,
        DETERMINISTIC_SIMULATION_TAG,
        `Option ${opt.label} Stress-Test Projected Revenue (KWD)`,
        opt.stressTestCase.projectedRevenueKwd,
      )
      addFact(
        `opt_${opt.optionKey}_stress_delta_kwd`,
        DETERMINISTIC_SIMULATION_TAG,
        `Option ${opt.label} Stress-Test Delta (KWD)`,
        opt.stressTestDeltaKwd,
      )
      addFact(
        `opt_${opt.optionKey}_stress_delta_pct`,
        DETERMINISTIC_SIMULATION_TAG,
        `Option ${opt.label} Stress-Test Delta (%)`,
        opt.stressTestCase.deltaPct,
      )
      addFact(
        `opt_${opt.optionKey}_stress_tier_a_only_kwd`,
        DETERMINISTIC_SIMULATION_TAG,
        `Option ${opt.label} Pure Tier-A Stress Delta (KWD)`,
        opt.stressTierAOnlyDeltaKwd,
      )

      for (const line of opt.lines) {
        entityNameSet.add(line.itemName)
        if (line.matchedOdooName) entityNameSet.add(line.matchedOdooName)
        if (line.confirmedCurrentPriceKwd !== null) {
          addFact(
            `opt_${opt.optionKey}_${line.rowId}_user_current_kwd`,
            USER_INPUT_CONFIRMED_TAG,
            `${line.itemName} Confirmed Current Price (KWD)`,
            line.confirmedCurrentPriceKwd,
          )
        }
        if (line.proposedPriceKwd !== null) {
          addFact(
            `opt_${opt.optionKey}_${line.rowId}_proposed_kwd`,
            USER_INPUT_CONFIRMED_TAG,
            `${line.itemName} (${opt.label}) Proposed Price (KWD)`,
            line.proposedPriceKwd,
          )
        }
        if (line.baselineUnitPriceKwd !== null) {
          addFact(
            `opt_${opt.optionKey}_${line.rowId}_baseline_unit_kwd`,
            ODOO_VERIFIED_ACTUAL_TAG,
            `${line.itemName} Baseline Unit Price (KWD)`,
            line.baselineUnitPriceKwd,
          )
        }
        if (line.unitPriceDeltaKwd !== null) {
          addFact(
            `opt_${opt.optionKey}_${line.rowId}_unit_delta_kwd`,
            DETERMINISTIC_SIMULATION_TAG,
            `${line.itemName} (${opt.label}) Unit Price Delta (KWD)`,
            line.unitPriceDeltaKwd,
          )
        }
        if (line.pctChange !== null) {
          addFact(
            `opt_${opt.optionKey}_${line.rowId}_pct_change`,
            DETERMINISTIC_SIMULATION_TAG,
            `${line.itemName} (${opt.label}) Price Change (%)`,
            line.pctChange,
          )
        }
        addFact(
          `opt_${opt.optionKey}_${line.rowId}_baseline_rev_kwd`,
          DETERMINISTIC_SIMULATION_TAG,
          `${line.itemName} Baseline Revenue (KWD)`,
          line.baselineRevenueKwd,
        )
        addFact(
          `opt_${opt.optionKey}_${line.rowId}_base_delta_kwd`,
          DETERMINISTIC_SIMULATION_TAG,
          `${line.itemName} (${opt.label}) Base Delta (KWD)`,
          line.baseDeltaKwd,
        )
        addFact(
          `opt_${opt.optionKey}_${line.rowId}_cons_qty`,
          DETERMINISTIC_SIMULATION_TAG,
          `${line.itemName} (${opt.label}) Conservative Simulated Qty`,
          line.conservativeSimQty,
        )
        addFact(
          `opt_${opt.optionKey}_${line.rowId}_cons_delta_kwd`,
          DETERMINISTIC_SIMULATION_TAG,
          `${line.itemName} (${opt.label}) Conservative Delta (KWD)`,
          line.conservativeDeltaKwd,
        )
        addFact(
          `opt_${opt.optionKey}_${line.rowId}_stress_qty`,
          DETERMINISTIC_SIMULATION_TAG,
          `${line.itemName} (${opt.label}) Stress-Test Simulated Qty`,
          line.stressSimQty,
        )
        addFact(
          `opt_${opt.optionKey}_${line.rowId}_stress_delta_kwd`,
          DETERMINISTIC_SIMULATION_TAG,
          `${line.itemName} (${opt.label}) Stress-Test Delta (KWD)`,
          line.stressTestDeltaKwd,
        )
        addFact(
          `opt_${opt.optionKey}_${line.rowId}_stress_tier_a_only_kwd`,
          DETERMINISTIC_SIMULATION_TAG,
          `${line.itemName} (${opt.label}) Pure Tier-A Stress Delta (KWD)`,
          line.stressTierAOnlyDeltaKwd,
        )
      }
    }

    for (const cmp of simulation.optionComparisons) {
      addFact(
        `cmp_${cmp.leftOptionKey}_vs_${cmp.rightOptionKey}_base_kwd`,
        DETERMINISTIC_SIMULATION_TAG,
        `${cmp.leftOptionLabel} vs ${cmp.rightOptionLabel} Base Spread (KWD)`,
        cmp.baseDiffKwd,
      )
      addFact(
        `cmp_${cmp.leftOptionKey}_vs_${cmp.rightOptionKey}_cons_kwd`,
        DETERMINISTIC_SIMULATION_TAG,
        `${cmp.leftOptionLabel} vs ${cmp.rightOptionLabel} Conservative Spread (KWD)`,
        cmp.conservativeDiffKwd,
      )
      addFact(
        `cmp_${cmp.leftOptionKey}_vs_${cmp.rightOptionKey}_stress_kwd`,
        DETERMINISTIC_SIMULATION_TAG,
        `${cmp.leftOptionLabel} vs ${cmp.rightOptionLabel} Stress-Test Spread (KWD)`,
        cmp.stressTestDiffKwd,
      )
    }

    // Register scenario model threshold constants after primary facts so Council prose
    // citing Base (0%), Conservative (-5% on >10%), and Stress-Test (-10% on >15%) passes cleanly.
    addFact('sim_param_base_vol_pct', DETERMINISTIC_SIMULATION_TAG, 'Base Scenario Volume Assumption (%)', '0')
    addFact('sim_param_cons_vol_pct', DETERMINISTIC_SIMULATION_TAG, 'Conservative Scenario Volume Haircut (%)', '-5')
    addFact('sim_param_cons_trigger_pct', DETERMINISTIC_SIMULATION_TAG, 'Conservative Price Hike Trigger (%)', '10')
    addFact('sim_param_stress_vol_pct', DETERMINISTIC_SIMULATION_TAG, 'Stress-Test Tier-A Volume Haircut (%)', '-10')
    addFact('sim_param_stress_trigger_pct', DETERMINISTIC_SIMULATION_TAG, 'Stress-Test Tier-A Hike Trigger (%)', '15')
  }

  // Register Odoo integration boundary user ID (225) and POS register boundary IDs (24, 36)
  // at the tail of labeledFacts so Data Boundaries disclosures are always grounded.
  addFact(
    'odoo_restricted_user_id',
    ODOO_VERIFIED_ACTUAL_TAG,
    'Odoo Integration User Lacking standard_price Access',
    pack.boundary.restrictedOdooUserId,
  )

  return {
    toolNumbers: [...toolNumberSet],
    canonicalDecimals: [...canonicalSet],
    allowedEntityNames: [...entityNameSet],
    labeledFacts,
  }
}

export function detectExecutiveLocale(question: string): 'ar' | 'en' {
  const arabicChars = (question.match(/[\u0600-\u06FF]/g) ?? []).length
  const latinChars = (question.match(/[A-Za-z]/g) ?? []).length
  return arabicChars > latinChars ? 'ar' : 'en'
}

export function isExecutiveAdvisorQuestion(question: string): boolean {
  const text = (question ?? '').trim()
  if (!text) return false
  if (asksMarginOrCogs(text) && isExecutiveKeywordPresent(text)) return true
  return isExecutiveKeywordPresent(text)
}

function isExecutiveKeywordPresent(text: string): boolean {
  return /(pareto|abc\b|tier[- ]?a\b|elasticity|stress[- ]?test|scenario|simulator|repricing|price\s+increase|price\s+change|price\s+sheet|menu\s+engineering|what[- ]if|proposed\s+price|bundle|upsell|cfo|باريتو|تصنيف\s*abc|مرونة|سيناريو|محاكاة|تسعير|رفع\s+الأسعار|تعديل\s+الأسعار|سعر\s+مقترح|جدول\s+الأسعار|هندسة\s+المنيو)/iu.test(
    text,
  )
}

function translatePlaybookActionAr(action: SkuPlaybookAction): string {
  switch (action) {
    case 'Approve':
      return 'اعتماد (Approve)'
    case 'Cap Increase':
      return 'سقف للزيادة (Cap Increase)'
    case 'Hold / Protect Traffic':
      return 'تثبيت وحماية الزيارات (Hold / Protect Traffic)'
    case 'Bundle / Upsell':
      return 'دمج كومبو / بيع إضافي (Bundle / Upsell)'
    case 'Fix Typo First':
      return 'تصحيح الخطأ أولاً (Fix Typo First)'
  }
}

/**
 * Produces a crisp, board-ready 5-section CFO & F&B Operations Strategist brief
 * in English or Arabic where EVERY numeric figure carries its explicit grounding basis
 * (`Odoo Verified Actual`, `User Input (Confirmed)`, `Deterministic Simulation`)
 * and zero excluded entities or fabricated margins ever appear.
 */
export function renderDeterministicExecutiveBrief(
  pack: ExecutiveContextPack,
  simulation: ScenarioSimulationResult | null,
  locale: 'ar' | 'en',
  asksCogs: boolean,
): string {
  if (locale === 'ar') {
    return renderArabicExecutiveBrief(pack, simulation, asksCogs)
  }
  return renderEnglishExecutiveBrief(pack, simulation, asksCogs)
}

function renderEnglishExecutiveBrief(
  pack: ExecutiveContextPack,
  simulation: ScenarioSimulationResult | null,
  asksCogs: boolean,
): string {
  const scopeEn = [
    pack.scope.brandLabelEn ?? 'All Active Venture Foods Brands',
    pack.scope.branchLabelEn ? `— ${pack.scope.branchLabelEn}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const totalNetText = formatGrouped(pack.totals.totalNetSalesKwd, 3)
  const totalQtyText = formatGrouped(pack.totals.totalQty, null)
  const skuCountText = formatGrouped(String(pack.totals.skuCount), null)
  const tierA = pack.tierSummary.A
  const tierB = pack.tierSummary.B
  const tierC = pack.tierSummary.C

  const hasSim = Boolean(simulation?.hasProposals && simulation.options.length > 0)
  const winner = hasSim
    ? (simulation?.options.find((opt) => opt.optionKey === simulation.recommendedOptionKey) ??
      simulation?.options[0] ??
      null)
    : null

  // Section 1: Executive Verdict
  const verdictLines: string[] = ['### Executive Verdict']
  if (winner && simulation) {
    verdictLines.push(
      `- **Scope & Baseline (${ODOO_VERIFIED_ACTUAL_TAG} / ${ODOO_VERIFIED_ACTUALS_LABEL}):** ${scopeEn} (${pack.period.from} to ${pack.period.to}) recorded **${totalNetText} KWD** in net POS revenue across **${totalQtyText}** units and **${skuCountText}** active SKUs. Tier-A core drivers (**${tierA.skuCount}** SKUs) generate **${tierA.revenueSharePct}%** (**${formatGrouped(tierA.netSalesKwd, 3)} KWD**).`,
    )
    verdictLines.push(
      `- **CFO Recommendation (${DETERMINISTIC_SIMULATION_TAG} on ${USER_INPUT_CONFIRMED_TAG} / ${PROPOSED_USER_INPUT_LABEL}):** ${simulation.rationaleEn}`,
    )
    for (const opt of simulation.options) {
      verdictLines.push(
        `- **Option ${opt.label} Three-Scenario KWD Impact (${DETERMINISTIC_SIMULATION_TAG}):** Base Case (**0%** volume shift) **${formatGrouped(opt.baseDeltaKwd, 3, true)} KWD** (**${opt.baseCase.deltaPct}%**) | Conservative (**-5%** volume on hikes above **10%**) **${formatGrouped(opt.conservativeDeltaKwd, 3, true)} KWD** (**${opt.conservativeCase.deltaPct}%**) | Stress-Test (**-10%** volume on Tier-A hikes above **15%**) **${formatGrouped(opt.stressTestDeltaKwd, 3, true)} KWD** (**${opt.stressTestCase.deltaPct}%**) over **${formatGrouped(opt.baselineRevenueKwd, 3)} KWD** matched baseline.`,
      )
    }
    for (const cmp of simulation.optionComparisons) {
      verdictLines.push(
        `- **Head-to-Head Spread (${DETERMINISTIC_SIMULATION_TAG}):** **${cmp.leftOptionLabel}** vs. **${cmp.rightOptionLabel}** delivers **${formatGrouped(cmp.stressTestDiffKwd, 3, true)} KWD** difference in Stress-Test (**${formatGrouped(cmp.conservativeDiffKwd, 3, true)} KWD** Conservative, **${formatGrouped(cmp.baseDiffKwd, 3, true)} KWD** Base).`,
      )
    }
  } else {
    verdictLines.push(
      `- **Pareto Revenue Concentration (${ODOO_VERIFIED_ACTUAL_TAG} / ${ODOO_VERIFIED_ACTUALS_LABEL}):** ${scopeEn} (${pack.period.from} to ${pack.period.to}) generated **${totalNetText} KWD** across **${totalQtyText}** units and **${skuCountText}** SKUs.`,
    )
    verdictLines.push(
      `- **ABC Velocity Split (${ODOO_VERIFIED_ACTUAL_TAG}):** Tier A (**${tierA.skuCount}** SKUs) drives **${tierA.revenueSharePct}%** (**${formatGrouped(tierA.netSalesKwd, 3)} KWD**, **${formatGrouped(tierA.totalQty, null)}** units); Tier B (**${tierB.skuCount}** SKUs) contributes **${tierB.revenueSharePct}%** (**${formatGrouped(tierB.netSalesKwd, 3)} KWD**); Tier C (**${tierC.skuCount}** SKUs) accounts for **${tierC.revenueSharePct}%** (**${formatGrouped(tierC.netSalesKwd, 3)} KWD**).`,
    )
  }

  // Section 2: Critical Anomalies & Risk Flags
  const riskLines: string[] = ['### Critical Anomalies & Risk Flags']
  if (winner && simulation) {
    const typoLines = simulation.options.flatMap((opt) =>
      opt.lines.filter((line) => line.playbookAction === 'Fix Typo First').map((line) => ({ opt, line })),
    )
    const highRiskLines = simulation.options.flatMap((opt) =>
      opt.lines.filter((line) => line.highElasticityRisk).map((line) => ({ opt, line })),
    )

    if (typoLines.length === 0 && highRiskLines.length === 0) {
      riskLines.push(
        `- **Clean Pricing Hygiene (${DETERMINISTIC_SIMULATION_TAG}):** **0** suspicious decimal drops and **0** Tier-A **${HIGH_ELASTICITY_RISK_TAG}** breaches were detected across confirmed inputs.`,
      )
    } else {
      for (const { opt, line } of typoLines.slice(0, 6)) {
        const curText = line.baselineUnitPriceKwd ? `${formatGrouped(line.baselineUnitPriceKwd, 3)} KWD` : 'N/A'
        const propText = line.proposedPriceKwd ? `${formatGrouped(line.proposedPriceKwd, 3)} KWD` : 'invalid'
        const pctText = line.pctChange ? ` (${line.pctChange}%)` : ''
        riskLines.push(
          `- **Data/Typo Alert — ${line.itemName} (${opt.label}):** Proposed **${propText}** (${USER_INPUT_CONFIRMED_TAG}) vs. **${curText}** (${ODOO_VERIFIED_ACTUAL_TAG})${pctText} — Action: **Fix Typo First** (${line.rationaleEn}).`,
        )
      }
      for (const { opt, line } of highRiskLines.slice(0, 6)) {
        riskLines.push(
          `- **${HIGH_ELASTICITY_RISK_TAG} — ${line.matchedOdooName ?? line.itemName} (${opt.label}, Tier ${line.abcTier}):** Proposed **${formatGrouped(line.proposedPriceKwd ?? '0', 3)} KWD** (${USER_INPUT_CONFIRMED_TAG}) vs. **${formatGrouped(line.baselineUnitPriceKwd ?? '0', 3)} KWD** (${ODOO_VERIFIED_ACTUAL_TAG}) is a **+${line.pctChange}%** jump; volume elasticity compresses Base uplift (**${formatGrouped(line.baseDeltaKwd, 3, true)} KWD**) down to **${formatGrouped(line.stressTestDeltaKwd, 3, true)} KWD** in Stress-Test (${DETERMINISTIC_SIMULATION_TAG}).`,
        )
      }
    }
  } else {
    const topSku = pack.skus[0]
    if (topSku) {
      riskLines.push(
        `- **Anchor Concentration (${ODOO_VERIFIED_ACTUAL_TAG}):** Top hero SKU **${topSku.name}** alone represents **${topSku.revenueSharePct}%** of net POS revenue (**${formatGrouped(topSku.netSalesKwd, 3)} KWD**, **${formatGrouped(topSku.qty, null)}** units at **${formatGrouped(topSku.avgRealizedPriceKwd ?? '0', 3)} KWD** realized unit price). Avoid unguarded dine-in price jumps on Tier-A anchors.`,
      )
    }
    if (tierC.skuCount > 0) {
      riskLines.push(
        `- **Long-Tail Menu Complexity (${ODOO_VERIFIED_ACTUAL_TAG}):** **${tierC.skuCount}** Tier-C SKUs generate only **${tierC.revenueSharePct}%** (**${formatGrouped(tierC.netSalesKwd, 3)} KWD**), increasing kitchen prep complexity relative to revenue contribution.`,
      )
    }
  }

  // Section 3: Actionable SKU / Operational Playbook
  const playbookLines: string[] = ['### Actionable SKU / Operational Playbook']
  if (winner) {
    playbookLines.push(
      `Playbook below reflects **Option ${winner.label}** (` +
        `Qty & Current: ${ODOO_VERIFIED_ACTUAL_TAG}; Proposed: ${USER_INPUT_CONFIRMED_TAG}; Scenarios: ${DETERMINISTIC_SIMULATION_TAG}):`,
    )
    playbookLines.push(
      '| SKU | Tier | Qty | Current KWD | Proposed KWD | Change % | Base KWD | Conservative KWD | Stress-Test KWD | Action |',
    )
    playbookLines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    for (const line of winner.lines.slice(0, 12)) {
      const skuTitle = line.matchedOdooName ?? line.itemName
      const tierText = line.abcTier ?? '—'
      const curText = line.baselineUnitPriceKwd ? formatGrouped(line.baselineUnitPriceKwd, 3) : '—'
      const propText = line.proposedPriceKwd ? formatGrouped(line.proposedPriceKwd, 3) : '—'
      const pctText = line.pctChange !== null ? `${line.pctChange}%` : '—'
      const riskBadge = line.highElasticityRisk ? ` (${HIGH_ELASTICITY_RISK_TAG})` : ''
      playbookLines.push(
        `| ${skuTitle} | ${tierText} | ${formatGrouped(line.qty, null)} | ${curText} | ${propText} | ${pctText} | ${formatGrouped(line.baseDeltaKwd, 3, true)} | ${formatGrouped(line.conservativeDeltaKwd, 3, true)} | ${formatGrouped(line.stressTestDeltaKwd, 3, true)} | ${line.playbookAction}${riskBadge} |`,
      )
    }
  } else {
    playbookLines.push(`Top SKUs by POS Net Revenue (${ODOO_VERIFIED_ACTUAL_TAG}):`)
    playbookLines.push(
      '| Rank | SKU | Tier | Qty | Realized Price KWD | Net Sales KWD | Share % | Cumulative % | Operational Role |',
    )
    playbookLines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    for (const sku of pack.skus.slice(0, 12)) {
      const role =
        sku.abcTier === 'A'
          ? 'Protect Traffic & Dine-In Anchor'
          : sku.abcTier === 'B'
            ? 'Selective Uplift & Combo Core'
            : 'Bundle Add-On / Prune Candidate'
      const unitText = sku.avgRealizedPriceKwd ? formatGrouped(sku.avgRealizedPriceKwd, 3) : '—'
      playbookLines.push(
        `| ${sku.rank} | ${sku.name} | ${sku.abcTier} | ${formatGrouped(sku.qty, null)} | ${unitText} | ${formatGrouped(sku.netSalesKwd, 3)} | ${sku.revenueSharePct}% | ${sku.cumulativeSharePct}% | ${role} |`,
      )
    }
  }

  // Section 4: High-Impact Company Recommendations
  const recLines: string[] = ['### High-Impact Company Recommendations']
  if (pack.branchChannelMix?.available) {
    const mix = pack.branchChannelMix
    if (parseDecimal(mix.totalChannelNetSalesKwd)?.sign() === 1) {
      recLines.push(
        `- **Channel-Differentiated Pricing (Kuwait Dine-In vs. Aggregators — ${ODOO_VERIFIED_ACTUAL_TAG}):** Direct channels (dine-in + direct takeaway) contribute **${formatGrouped(mix.directNetSalesKwd, 3)} KWD** (**${mix.directSharePct}%**), while delivery aggregators contribute **${formatGrouped(mix.aggregatorNetSalesKwd, 3)} KWD** (**${mix.aggregatorSharePct}%**). Keep Tier-A dine-in prices sharp to defend mall/restaurant footfall, and deploy approved price increases plus exclusive meal bundles on aggregator menus to offset platform commission drag.`,
      )
    }
    if (mix.topBranches.length > 0) {
      const branchSummary = mix.topBranches
        .slice(0, 3)
        .map((br) => `**${br.labelEn}** (**${formatGrouped(br.netSalesKwd, 3)} KWD**, **${br.sharePct}%**)`)
        .join(', ')
      recLines.push(
        `- **Priority Branch Rollout (${ODOO_VERIFIED_ACTUAL_TAG}):** Anchor POS menu engineering and cashier upsell scripts at top-volume locations ${branchSummary} before chain-wide rollout.`,
      )
    }
  } else {
    recLines.push(
      '- **Channel-Differentiated Execution (Kuwait F&B Playbook):** Separate dine-in menu pricing from delivery aggregator price tiers so Tier-A restaurant traffic stays protected while aggregator menus absorb approved uplifts through structured meal combos.',
    )
  }
  recLines.push(
    `- **Combo & Basket Engineering:** Pair **${tierB.skuCount}** Tier-B (**${tierB.revenueSharePct}%** share) and **${tierC.skuCount}** Tier-C (**${tierC.revenueSharePct}%** share) items (${ODOO_VERIFIED_ACTUAL_TAG}) as high-perceived-value add-ons alongside Tier-A heroes to lift average check without triggering unit volume attrition.`,
  )

  // Section 5: Data Boundaries
  const boundaryLines: string[] = [
    '### Data Boundaries',
    `- **Read-Only POS Scope (${ODOO_VERIFIED_ACTUAL_TAG}):** Derived strictly from posted Odoo \`pos.order.line\` records (\`paid\`, \`done\`, \`invoiced\`; \`price_subtotal\` net of tax) across approved Venture Foods registers.`,
    `- **COGS & Margin Restriction:** ${pack.boundary.cogsBoundaryNoteEn}${asksCogs ? ` ${COGS_UNAVAILABLE_REPLY}` : ''}`,
  ]

  return [
    verdictLines.join('\n'),
    riskLines.join('\n'),
    playbookLines.join('\n'),
    recLines.join('\n'),
    boundaryLines.join('\n'),
  ].join('\n\n')
}

function renderArabicExecutiveBrief(
  pack: ExecutiveContextPack,
  simulation: ScenarioSimulationResult | null,
  asksCogs: boolean,
): string {
  const scopeAr = [
    pack.scope.brandLabelAr ?? 'جميع علامات فينتشر فودز المعتمدة',
    pack.scope.branchLabelAr ? `— ${pack.scope.branchLabelAr}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const totalNetText = formatGrouped(pack.totals.totalNetSalesKwd, 3)
  const totalQtyText = formatGrouped(pack.totals.totalQty, null)
  const skuCountText = formatGrouped(String(pack.totals.skuCount), null)
  const tierA = pack.tierSummary.A
  const tierB = pack.tierSummary.B
  const tierC = pack.tierSummary.C

  const hasSim = Boolean(simulation?.hasProposals && simulation.options.length > 0)
  const winner = hasSim
    ? (simulation?.options.find((opt) => opt.optionKey === simulation.recommendedOptionKey) ??
      simulation?.options[0] ??
      null)
    : null

  // Section 1: Executive Verdict
  const verdictLines: string[] = ['### القرار التنفيذي والملخص المالي']
  if (winner && simulation) {
    verdictLines.push(
      `- **نطاق البيانات وخط الأساس (${ODOO_VERIFIED_ACTUAL_TAG} / ${ODOO_VERIFIED_ACTUALS_LABEL}):** سجلت ${scopeAr} (${pack.period.from} إلى ${pack.period.to}) صافي مبيعات نقاط بيع **${totalNetText} د.ك** بإجمالي **${totalQtyText}** وحدة عبر **${skuCountText}** صنفاً نشطاً، حيث تبلغ نسبة مساهمة أصناف الفئة A (**${tierA.skuCount}** أصناف) **${tierA.revenueSharePct}%** (**${formatGrouped(tierA.netSalesKwd, 3)} د.ك**).`,
    )
    verdictLines.push(
      `- **التوصية التنفيذية (${DETERMINISTIC_SIMULATION_TAG} استناداً إلى ${USER_INPUT_CONFIRMED_TAG} / ${PROPOSED_USER_INPUT_LABEL}):** ${simulation.rationaleAr}`,
    )
    for (const opt of simulation.options) {
      verdictLines.push(
        `- **أثر الخيار ${opt.label} عبر السيناريوهات الثلاثة (${DETERMINISTIC_SIMULATION_TAG}):** السيناريو الأساسي (**0%** تغير بالكمية) **${formatGrouped(opt.baseDeltaKwd, 3, true)} د.ك** (**${opt.baseCase.deltaPct}%**) | المتحفظ (**-5%** على الأصناف المرتفعة بأكثر من **10%**) **${formatGrouped(opt.conservativeDeltaKwd, 3, true)} د.ك** (**${opt.conservativeCase.deltaPct}%**) | اختبار الضغط (**-10%** على أصناف الفئة A المرتفعة بأكثر من **15%**) **${formatGrouped(opt.stressTestDeltaKwd, 3, true)} د.ك** (**${opt.stressTestCase.deltaPct}%**) مقابل خط أساس مطابق قدره **${formatGrouped(opt.baselineRevenueKwd, 3)} د.ك**.`,
      )
    }
    for (const cmp of simulation.optionComparisons) {
      verdictLines.push(
        `- **المقارنة المباشرة بين الخيارات (${DETERMINISTIC_SIMULATION_TAG}):** يحقق **${cmp.leftOptionLabel}** مقابل **${cmp.rightOptionLabel}** فارقاً قدره **${formatGrouped(cmp.stressTestDiffKwd, 3, true)} د.ك** في اختبار الضغط (**${formatGrouped(cmp.conservativeDiffKwd, 3, true)} د.ك** متحفظ، **${formatGrouped(cmp.baseDiffKwd, 3, true)} د.ك** أساسي).`,
      )
    }
  } else {
    verdictLines.push(
      `- **تركز الإيرادات وفق باريتو (${ODOO_VERIFIED_ACTUAL_TAG} / ${ODOO_VERIFIED_ACTUALS_LABEL}):** حققت ${scopeAr} (${pack.period.from} إلى ${pack.period.to}) صافي **${totalNetText} د.ك** عبر **${totalQtyText}** وحدة و**${skuCountText}** صنفاً.`,
    )
    verdictLines.push(
      `- **توزيع الفئات ABC (${ODOO_VERIFIED_ACTUAL_TAG}):** تبلغ نسبة الفئة A (**${tierA.skuCount}** أصناف) **${tierA.revenueSharePct}%** (**${formatGrouped(tierA.netSalesKwd, 3)} د.ك**، **${formatGrouped(tierA.totalQty, null)}** وحدة)؛ الفئة B (**${tierB.skuCount}** أصناف) تساهم بنسبة **${tierB.revenueSharePct}%** (**${formatGrouped(tierB.netSalesKwd, 3)} د.ك**)؛ الفئة C (**${tierC.skuCount}** أصناف) تشكل **${tierC.revenueSharePct}%** (**${formatGrouped(tierC.netSalesKwd, 3)} د.ك**).`,
    )
  }

  // Section 2: Critical Anomalies & Risk Flags
  const riskLines: string[] = ['### التنبيهات الحرجة ومخاطر المرونة السعرية']
  if (winner && simulation) {
    const typoLines = simulation.options.flatMap((opt) =>
      opt.lines.filter((line) => line.playbookAction === 'Fix Typo First').map((line) => ({ opt, line })),
    )
    const highRiskLines = simulation.options.flatMap((opt) =>
      opt.lines.filter((line) => line.highElasticityRisk).map((line) => ({ opt, line })),
    )

    if (typoLines.length === 0 && highRiskLines.length === 0) {
      riskLines.push(
        `- **سلامة البيانات السعرية (${DETERMINISTIC_SIMULATION_TAG}):** تم رصد **0** أخطاء عشرية حرجة و**0** تجاوزات لمخاطر المرونة العالية (**${HIGH_ELASTICITY_RISK_TAG}**) على أصناف الفئة A.`,
      )
    } else {
      for (const { opt, line } of typoLines.slice(0, 6)) {
        const curText = line.baselineUnitPriceKwd ? `${formatGrouped(line.baselineUnitPriceKwd, 3)} د.ك` : 'غير متوفر'
        const propText = line.proposedPriceKwd ? `${formatGrouped(line.proposedPriceKwd, 3)} د.ك` : 'غير صالح'
        const pctText = line.pctChange ? ` (${line.pctChange}%)` : ''
        riskLines.push(
          `- **تنبيه خطأ بيانات — ${line.itemName} (${opt.label}):** السعر المقترح **${propText}** (${USER_INPUT_CONFIRMED_TAG}) مقابل **${curText}** (${ODOO_VERIFIED_ACTUAL_TAG})${pctText} — الإجراء: **${translatePlaybookActionAr('Fix Typo First')}** (${line.rationaleAr}).`,
        )
      }
      for (const { opt, line } of highRiskLines.slice(0, 6)) {
        riskLines.push(
          `- **مخاطر مرونة عالية (${HIGH_ELASTICITY_RISK_TAG}) — ${line.matchedOdooName ?? line.itemName} (${opt.label}، فئة ${line.abcTier}):** السعر المقترح **${formatGrouped(line.proposedPriceKwd ?? '0', 3)} د.ك** (${USER_INPUT_CONFIRMED_TAG}) مقابل **${formatGrouped(line.baselineUnitPriceKwd ?? '0', 3)} د.ك** (${ODOO_VERIFIED_ACTUAL_TAG}) بارتفاع **+${line.pctChange}%** يقلص الأثر من **${formatGrouped(line.baseDeltaKwd, 3, true)} د.ك** في الأساسي إلى **${formatGrouped(line.stressTestDeltaKwd, 3, true)} د.ك** في اختبار الضغط (${DETERMINISTIC_SIMULATION_TAG}).`,
        )
      }
    }
  } else {
    const topSku = pack.skus[0]
    if (topSku) {
      riskLines.push(
        `- **تركز الصنف القائد (${ODOO_VERIFIED_ACTUAL_TAG}):** يستحوذ الصنف الأول **${topSku.name}** وحده على **${topSku.revenueSharePct}%** من صافي المبيعات (**${formatGrouped(topSku.netSalesKwd, 3)} د.ك**، **${formatGrouped(topSku.qty, null)}** وحدة بسعر فعلي **${formatGrouped(topSku.avgRealizedPriceKwd ?? '0', 3)} د.ك**)؛ يجب تجنب أي رفع حاد غير محمي على أسعار الصالة لأصناف الفئة A.`,
      )
    }
    if (tierC.skuCount > 0) {
      riskLines.push(
        `- **تعقيد الذيل الطويل في المنيو (${ODOO_VERIFIED_ACTUAL_TAG}):** يضم المنيو **${tierC.skuCount}** صنفاً ضمن الفئة C لا تتجاوز مساهمتها **${tierC.revenueSharePct}%** (**${formatGrouped(tierC.netSalesKwd, 3)} د.ك**)، مما يستدعي مراجعة الدمج أو التبسيط التشغيلي.`,
      )
    }
  }

  // Section 3: Actionable SKU / Operational Playbook
  const playbookLines: string[] = ['### خطة العمل التنفيذية للأصناف']
  if (winner) {
    playbookLines.push(
      `الجدول التنفيذي لخيار **${winner.label}** (` +
        `الكمية والسعر الحالي: ${ODOO_VERIFIED_ACTUAL_TAG}؛ المقترح: ${USER_INPUT_CONFIRMED_TAG}؛ السيناريوهات: ${DETERMINISTIC_SIMULATION_TAG}):`,
    )
    playbookLines.push(
      '| الصنف | الفئة | الكمية | الحالي د.ك | المقترح د.ك | التغير % | الأساسي د.ك | المتحفظ د.ك | اختبار الضغط د.ك | القرار التنفيذي |',
    )
    playbookLines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    for (const line of winner.lines.slice(0, 12)) {
      const skuTitle = line.matchedOdooName ?? line.itemName
      const tierText = line.abcTier ?? '—'
      const curText = line.baselineUnitPriceKwd ? formatGrouped(line.baselineUnitPriceKwd, 3) : '—'
      const propText = line.proposedPriceKwd ? formatGrouped(line.proposedPriceKwd, 3) : '—'
      const pctText = line.pctChange !== null ? `${line.pctChange}%` : '—'
      playbookLines.push(
        `| ${skuTitle} | ${tierText} | ${formatGrouped(line.qty, null)} | ${curText} | ${propText} | ${pctText} | ${formatGrouped(line.baseDeltaKwd, 3, true)} | ${formatGrouped(line.conservativeDeltaKwd, 3, true)} | ${formatGrouped(line.stressTestDeltaKwd, 3, true)} | ${translatePlaybookActionAr(line.playbookAction)} |`,
      )
    }
  } else {
    playbookLines.push(`أعلى الأصناف مساهمة في صافي مبيعات نقاط البيع (${ODOO_VERIFIED_ACTUAL_TAG}):`)
    playbookLines.push(
      '| الترتيب | الصنف | الفئة | الكمية | السعر الفعلي د.ك | صافي المبيعات د.ك | الحصة % | التراكمي % | الدور التشغيلي |',
    )
    playbookLines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    for (const sku of pack.skus.slice(0, 12)) {
      const role =
        sku.abcTier === 'A'
          ? 'حماية الزيارات وارتكاز الصالة'
          : sku.abcTier === 'B'
            ? 'تحسين انتقائي وعمود الكومبو'
            : 'إضافات بيع تقاطعي / مراجعة التبسيط'
      const unitText = sku.avgRealizedPriceKwd ? formatGrouped(sku.avgRealizedPriceKwd, 3) : '—'
      playbookLines.push(
        `| ${sku.rank} | ${sku.name} | ${sku.abcTier} | ${formatGrouped(sku.qty, null)} | ${unitText} | ${formatGrouped(sku.netSalesKwd, 3)} | ${sku.revenueSharePct}% | ${sku.cumulativeSharePct}% | ${role} |`,
      )
    }
  }

  // Section 4: High-Impact Company Recommendations
  const recLines: string[] = ['### توصيات الشركة عالية الأثر']
  if (pack.branchChannelMix?.available) {
    const mix = pack.branchChannelMix
    if (parseDecimal(mix.totalChannelNetSalesKwd)?.sign() === 1) {
      recLines.push(
        `- **تفريق التسعير بين الصالة ومنصات التوصيل (${ODOO_VERIFIED_ACTUAL_TAG}):** تسجل القنوات المباشرة (الصالة والسفري المباشر) **${formatGrouped(mix.directNetSalesKwd, 3)} د.ك** (**${mix.directSharePct}%**)، مقابل **${formatGrouped(mix.aggregatorNetSalesKwd, 3)} د.ك** (**${mix.aggregatorSharePct}%**) لمنصات التوصيل. يُوصى بحماية أسعار الصالة لأصناف الفئة A للحفاظ على حركة الزوار، وتوجيه الزيادات المعتمدة وعروض الكومبو المخصصة إلى قوائم تطبيقات التوصيل لامتصاص أثر العمولات.`,
      )
    }
    if (mix.topBranches.length > 0) {
      const branchSummary = mix.topBranches
        .slice(0, 3)
        .map((br) => `**${br.labelAr}** (**${formatGrouped(br.netSalesKwd, 3)} د.ك**، **${br.sharePct}%**)`)
        .join('، ')
      recLines.push(
        `- **أولوية التنفيذ على الفروع الأعلى حجماً (${ODOO_VERIFIED_ACTUAL_TAG}):** بدء تطبيق هندسة المنيو وتوجيه الكاشير للبيع الإضافي في ${branchSummary} قبل التعميم على بقية الفروع.`,
      )
    }
  } else {
    recLines.push(
      '- **تفريق التسعير حسب القناة في السوق الكويتي:** فصل تسعير الصالة والسفري المباشر عن قوائم منصات التوصيل لحماية زيارات أصناف الفئة A وتوجيه الزيادات وعروض الكومبو إلى قنوات التوصيل.',
    )
  }
  recLines.push(
    `- **هندسة الكومبو ورفع متوسط الفاتورة:** ربط **${tierB.skuCount}** صنفاً من الفئة B (**${tierB.revenueSharePct}%**) و**${tierC.skuCount}** صنفاً من الفئة C (**${tierC.revenueSharePct}%**) (${ODOO_VERIFIED_ACTUAL_TAG}) كإضافات وعروض وجبات مع أصناف الفئة A لرفع قيمة السلة دون المساس بحجم الطلبات.`,
  )

  // Section 5: Data Boundaries
  const boundaryLines: string[] = [
    '### حدود البيانات والصلاحيات',
    `- **نطاق القراءة فقط من Odoo (${ODOO_VERIFIED_ACTUAL_TAG}):** مستخرج حصرياً من سطور \`pos.order.line\` المرحّلة (\`paid\`, \`done\`, \`invoiced\`؛ صافي \`price_subtotal\` بدون الضريبة) عبر نقاط البيع المعتمدة لشركة فينتشر فودز.`,
    `- **قيود التكلفة والهامش:** ${pack.boundary.cogsBoundaryNoteAr}${asksCogs ? ` ${COGS_UNAVAILABLE_REPLY}` : ''}`,
  ]

  return [
    verdictLines.join('\n'),
    riskLines.join('\n'),
    playbookLines.join('\n'),
    recLines.join('\n'),
    boundaryLines.join('\n'),
  ].join('\n\n')
}

/**
 * Builds the grounded prompt payload + whitelist for the 3-model Council
 * (`anthropic`, `google`, `xai`) so every model acts as a Kuwait F&B CFO & COO
 * strategist without inventing numbers or violating Odoo user 225 boundaries.
 */
export function buildExecutiveCouncilPromptPayload(
  pack: ExecutiveContextPack,
  simulation: ScenarioSimulationResult | null,
  locale: 'ar' | 'en',
  asksCogs: boolean,
): {
  systemPrompt: string
  userFactsPayload: string
  grounded: ExecutiveGroundedNumbers
} {
  const grounded = collectExecutiveGroundedNumbers(pack, simulation)
  const languageDirective =
    locale === 'ar'
      ? 'Respond entirely in crisp, board-ready executive Arabic.'
      : 'Respond entirely in crisp, board-ready executive English.'

  const systemPrompt = [
    'You are the Chief Financial Officer (CFO) and Chief Operating Officer (COO) Strategy Advisor for Venture Foods Kuwait (multi-brand restaurant & delivery operator).',
    languageDirective,
    'STRICT GROUNDING & GOVERNANCE RULES (ZERO TOLERANCE):',
    `- Every single number you write MUST come verbatim (or rounded half-up) from the supplied JSON payload and carry its source tag: "${ODOO_VERIFIED_ACTUAL_TAG}", "${USER_INPUT_CONFIRMED_TAG}", or "${DETERMINISTIC_SIMULATION_TAG}".`,
    '- NEVER perform mental math, extrapolate unprovided percentages, or invent unit costs, COGS, gross margins, or net profit margins. Odoo integration user 225 does not have read access to product.product.standard_price.',
    '- Structure your response into 5 clear markdown sections (do NOT prefix headings with ungrounded section numbers if those integers are absent from the payload; use ### headings directly):',
    '  ### Executive Verdict',
    '  ### Critical Anomalies & Risk Flags',
    '  ### Actionable SKU / Operational Playbook (include a compact markdown pipe table)',
    '  ### High-Impact Company Recommendations (tailored to Kuwait dine-in vs delivery aggregators, hero traffic protection, and combo engineering)',
    '  ### Data Boundaries (explicitly note the Odoo user 225 standard_price restriction)',
  ].join('\n')

  const payloadObject = {
    sourceTags: {
      odooActual: ODOO_VERIFIED_ACTUAL_TAG,
      confirmedUserInput: USER_INPUT_CONFIRMED_TAG,
      deterministicSimulation: DETERMINISTIC_SIMULATION_TAG,
    },
    asksCogs,
    period: pack.period,
    scope: pack.scope,
    totals: pack.totals,
    tierSummary: pack.tierSummary,
    topSkus: pack.skus.slice(0, 25),
    branchChannelMix: pack.branchChannelMix,
    simulation: simulation?.hasProposals
      ? {
          verdictStatus: simulation.verdictStatus,
          recommendedOptionKey: simulation.recommendedOptionKey,
          recommendedOptionLabel: simulation.recommendedOptionLabel,
          rankedOptionKeys: simulation.rankedOptionKeys,
          rationaleEn: simulation.rationaleEn,
          rationaleAr: simulation.rationaleAr,
          optionComparisons: simulation.optionComparisons,
          options: simulation.options.map((opt) => ({
            optionKey: opt.optionKey,
            label: opt.label,
            matchedSkuCount: opt.matchedSkuCount,
            unmatchedRowCount: opt.unmatchedRowCount,
            highElasticityRiskCount: opt.highElasticityRiskCount,
            fixTypoCount: opt.fixTypoCount,
            baselineRevenueKwd: opt.baselineRevenueKwd,
            baseCase: opt.baseCase,
            conservativeCase: opt.conservativeCase,
            stressTestCase: opt.stressTestCase,
            lines: opt.lines.slice(0, 25),
          })),
        }
      : null,
    boundary: {
      restrictedOdooUserId: pack.boundary.restrictedOdooUserId,
      restrictedField: pack.boundary.restrictedField,
      cogsReadable: pack.boundary.cogsReadable,
      noteEn: pack.boundary.cogsBoundaryNoteEn,
      noteAr: pack.boundary.cogsBoundaryNoteAr,
    },
  }

  return {
    systemPrompt,
    userFactsPayload: JSON.stringify(payloadObject, null, 2),
    grounded,
  }
}
