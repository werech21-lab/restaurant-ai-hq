/**
 * Live Odoo + AI Executive Decision Generator (`/erp/decisions` & `Today's Discoveries`).
 *
 * Runtime-neutral (safe for both Next.js Server Route Handlers and client SWR fallback):
 * - 100% read-only Odoo data derivation (`OdooLiveSummary` + `ExecutiveContextPack`).
 * - Respects POS exclusions (`25/39/40`, Jahra, Heisenberg, category `150`, non-company SKUs),
 *   includes Qurain (`24 & 36`), and never estimates or reads `standard_price` / COGS for user 225.
 * - Optional LLM rationale enrichment guarded strictly by `reviewGroundedNumbers` with fast fallback
 *   to deterministic CFO/COO rationale.
 */

import {
  bustErpReadCache,
  fetchWithErpReadCache,
  inspectErpReadCacheEntry,
  writeErpReadCache,
} from '@/lib/erp-read-cache'
import { templateSummary, type ExecutiveSummary } from '@/lib/council/executive-summary'
import { branchLabel } from '@/lib/council/helpers'
import { findingImpactScore, rankDiscoveries } from '@/lib/council/runner'
import type {
  AdvisorId,
  AdvisorReport,
  CouncilDiscovery,
  CouncilEstimate,
  CouncilEvidence,
  CouncilFinding,
  CouncilProposal,
  CouncilSnapshot,
} from '@/lib/council/types'
import type { ExecutiveContextPack } from '@/lib/feryal/executive-advisor'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import {
  customerReceivableFigures,
  type OdooBucketSummary,
  type OdooLiveSummary,
} from '@/lib/odoo/live-sync-core'
import { isNonCompanyCatalogItem } from '@/lib/odoo/non-company-products'
import { reviewGroundedNumbers } from '@/server/ai/number-guard'

export const ODOO_DECISION_ACTUAL_TAG = 'Odoo Verified Actual' as const
export const ODOO_DECISION_SIMULATION_TAG = 'Deterministic Simulation' as const

const RESTAURANT_BRANCH_IDS = new Set([
  'avenues',
  '360-mall',
  'assima',
  'promenade',
  'salmiya',
  'al-kout',
  'ardiya',
])

const CHANNEL_LABELS: Record<string, { ar: string; en: string; direct: boolean }> = {
  'dine-in': { ar: 'الصالة الداخلية', en: 'Dine-In', direct: true },
  'takeaway-direct': { ar: 'سفري ومباشر', en: 'Direct Takeaway', direct: true },
  'talabat-tgo': { ar: 'منصة توصيل طلبات (أسطول المنصة)', en: 'Talabat Go', direct: false },
  'talabat-tmp': { ar: 'منصة توصيل طلبات (أسطولنا المباشر)', en: 'Talabat MP', direct: false },
  deliveroo: { ar: 'ديليفرو', en: 'Deliveroo', direct: false },
  keeta: { ar: 'كيتا', en: 'Keeta', direct: false },
  jahez: { ar: 'جاهز', en: 'Jahez', direct: false },
  snoonu: { ar: 'سنونو', en: 'Snoonu', direct: false },
  cari: { ar: 'كاري', en: 'Cari', direct: false },
}

const DOMAIN_META: Record<AdvisorId, { ar: string; en: string }> = {
  cfo: { ar: 'المالية والذمم', en: 'Finance & Receivables' },
  delivery: { ar: 'مزيج القنوات والمنصات', en: 'Channels & Delivery Platforms' },
  hr: { ar: 'الموارد البشرية', en: 'HR' },
  inventory: { ar: 'المخزون', en: 'Inventory' },
  seasons: { ar: 'المواسم', en: 'Seasons' },
  drivers: { ar: 'محرّكات المبيعات والساعات', en: 'Sales Drivers & Dayparts' },
  menu: { ar: 'هندسة المنيو والتسعير', en: 'Menu Pareto & Pricing' },
  benchmark: { ar: 'أداء الفروع وإعادة التخصيص', en: 'Branch Performance & Reallocation' },
  forecast: { ar: 'التوقع والأيام غير المعتادة', en: 'Forecast & Anomalies' },
}

export type LiveDecisionLlmCall = (input: {
  system: string
  user: string
  timeoutMs: number
}) => Promise<string | null>

export interface LiveDecisionGeneratorInput {
  summary: OdooLiveSummary | null
  contextPack?: ExecutiveContextPack | null
  existingSnapshot?: CouncilSnapshot | null
  callLlm?: LiveDecisionLlmCall
  timeoutMs?: number
}

export interface LiveDecisionGeneratorResult {
  available: boolean
  generatedAt: string | null
  reports: AdvisorReport[]
  discoveries: CouncilDiscovery[]
  summary: ExecutiveSummary | null
  aiEnriched: boolean
}

function r3(value: number): number {
  const clean = Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0
  return Object.is(clean, -0) ? 0 : clean
}

function r1(value: number): number {
  const clean = Number.isFinite(value) ? Math.round(value * 10) / 10 : 0
  return Object.is(clean, -0) ? 0 : clean
}

function fmtKwdText(value: number): string {
  return r3(value).toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
}

function fmtPctText(value: number): string {
  return r1(value).toFixed(1)
}

function resolveActiveMonthBucket(summary: OdooLiveSummary): {
  bucket: OdooBucketSummary | null
  period: { from: string; to: string }
  days: number
  syncAt: string | null
} {
  const bucket = summary.buckets?.month ?? summary.customBucket ?? summary.buckets?.week ?? null
  const from = bucket?.from ?? summary.period?.from ?? summary.dateRange?.from ?? ''
  const to = bucket?.to ?? summary.period?.to ?? summary.dateRange?.to ?? ''
  const rawDays =
    bucket?.days ??
    (from && to
      ? Math.max(
          1,
          Math.round(
            (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
          ) + 1,
        )
      : 30)
  const days = Math.max(1, Number.isFinite(rawDays) ? rawDays : 30)
  const syncAt = summary.lastSyncAt ?? summary.syncedAt ?? null
  return { bucket, period: { from, to }, days, syncAt }
}

function pushValidEvidence(list: CouncilEvidence[], item: CouncilEvidence): void {
  if (!Number.isFinite(item.value)) return
  if (
    (item.unit === 'KWD' || item.unit === 'KWD/order' || item.unit === 'KWD/unit') &&
    Math.abs(item.value) < 0.001
  ) {
    return
  }
  if ((item.unit === 'orders' || item.unit === 'count') && Math.round(item.value) === 0) {
    return
  }
  if (item.unit === 'pct' && Math.abs(item.value) < 0.05) {
    return
  }
  list.push({
    ...item,
    value:
      item.unit === 'KWD' || item.unit === 'KWD/order' || item.unit === 'KWD/unit'
        ? r3(item.value)
        : item.unit === 'pct' || item.unit === 'hours'
          ? r1(item.value)
          : Math.round(item.value),
  })
}

function buildValidEstimate(
  value: number,
  formula: string,
  inputs: Record<string, number>,
): CouncilEstimate | null {
  const rounded = r3(value)
  if (!Number.isFinite(rounded) || Math.abs(rounded) < 0.001) return null
  const cleanInputs: Record<string, number> = {}
  for (const [k, v] of Object.entries(inputs)) {
    if (Number.isFinite(v)) cleanInputs[k] = r3(v)
  }
  return {
    label: 'Estimate',
    value: rounded,
    unit: 'KWD',
    formula,
    inputs: cleanInputs,
  }
}

/**
 * 1) Branch Performance & Reallocation:
 * Top branch vs lowest active branch velocity gap (exact live 30d KWD, orders, AOV & share %).
 */
function buildBranchPerformanceFinding(
  summary: OdooLiveSummary,
  bucket: OdooBucketSummary | null,
  period: { from: string; to: string },
  days: number,
  syncAt: string | null,
): CouncilFinding | null {
  const rawLoc = bucket?.mappedByLocation ?? bucket?.byLocation ?? null
  const branchEntries: {
    id: string
    labelAr: string
    labelEn: string
    netKwd: number
    orders: number
  }[] = []

  if (rawLoc) {
    for (const [id, val] of Object.entries(rawLoc)) {
      if (!RESTAURANT_BRANCH_IDS.has(id) || isExcludedOdooEntity(id)) continue
      const netKwd = r3(val?.netKwd ?? 0)
      const orders = Math.round(val?.orders ?? 0)
      if (netKwd <= 0.001 || orders <= 0) continue
      const lbl = branchLabel(id)
      branchEntries.push({ id, labelAr: lbl.ar, labelEn: lbl.en, netKwd, orders })
    }
  } else if (Array.isArray(summary.branches)) {
    for (const b of summary.branches) {
      if (!RESTAURANT_BRANCH_IDS.has(b.id) || isExcludedOdooEntity(b.id)) continue
      const netKwd = r3(b.netSalesKwd ?? 0)
      const orders = Math.round(b.orders ?? 0)
      if (netKwd <= 0.001 || orders <= 0) continue
      const lbl = branchLabel(b.id)
      branchEntries.push({ id: b.id, labelAr: lbl.ar, labelEn: lbl.en, netKwd, orders })
    }
  }

  if (branchEntries.length < 2) return null
  branchEntries.sort((a, b) => b.netKwd - a.netKwd || a.id.localeCompare(b.id))

  const top = branchEntries[0]!
  const low = branchEntries[branchEntries.length - 1]!
  const gapKwd = r3(top.netKwd - low.netKwd)
  if (gapKwd < 1) return null

  const totalMappedKwd = r3(branchEntries.reduce((s, b) => s + b.netKwd, 0))
  if (totalMappedKwd <= 0.001) return null

  const topSharePct = r1((top.netKwd / totalMappedKwd) * 100)
  const lowSharePct = r1((low.netKwd / totalMappedKwd) * 100)
  const topAovKwd = r3(top.netKwd / top.orders)
  const lowAovKwd = r3(low.netKwd / low.orders)

  const sortedNets = branchEntries.map((b) => b.netKwd).sort((a, b) => a - b)
  const mid = Math.floor(sortedNets.length / 2)
  const peerMedianKwd = r3(
    sortedNets.length % 2 === 1
      ? sortedNets[mid]!
      : (sortedNets[mid - 1]! + sortedNets[mid]!) / 2,
  )
  const medianGapKwd = r3(Math.max(0, peerMedianKwd - low.netKwd))
  const basisGapKwd = medianGapKwd > 1 ? medianGapKwd : gapKwd
  const captureRate = medianGapKwd > 1 ? 0.2 : 0.1
  const weeklyLiftVal = r3(((basisGapKwd * captureRate) / days) * 7)

  const evidence: CouncilEvidence[] = []
  pushValidEvidence(evidence, {
    odooModel: 'pos.order',
    domain: `branch=${top.id}, state in (paid,done,invoiced)`,
    period,
    value: top.netKwd,
    unit: 'KWD',
    syncAt,
    labelAr: `مبيعات ${top.labelAr} (${fmtPctText(topSharePct)}%)`,
    labelEn: `${top.labelEn} net sales (${fmtPctText(topSharePct)}%)`,
  })
  pushValidEvidence(evidence, {
    odooModel: 'pos.order',
    domain: `branch=${top.id}, orders & AOV`,
    period,
    value: topAovKwd,
    unit: 'KWD/order',
    syncAt,
    labelAr: `متوسط فاتورة ${top.labelAr} (${top.orders.toLocaleString('en-US')} طلب)`,
    labelEn: `${top.labelEn} AOV (${top.orders.toLocaleString('en-US')} orders)`,
  })
  pushValidEvidence(evidence, {
    odooModel: 'pos.order',
    domain: `branch=${low.id}, state in (paid,done,invoiced)`,
    period,
    value: low.netKwd,
    unit: 'KWD',
    syncAt,
    labelAr: `مبيعات ${low.labelAr} (${fmtPctText(lowSharePct)}%)`,
    labelEn: `${low.labelEn} net sales (${fmtPctText(lowSharePct)}%)`,
  })
  pushValidEvidence(evidence, {
    odooModel: 'pos.order',
    domain: `branch=${low.id}, orders & AOV`,
    period,
    value: lowAovKwd,
    unit: 'KWD/order',
    syncAt,
    labelAr: `متوسط فاتورة ${low.labelAr} (${low.orders.toLocaleString('en-US')} طلب)`,
    labelEn: `${low.labelEn} AOV (${low.orders.toLocaleString('en-US')} orders)`,
  })
  pushValidEvidence(evidence, {
    odooModel: 'pos.order',
    domain: `velocity_gap(${top.id} - ${low.id})`,
    period,
    value: gapKwd,
    unit: 'KWD',
    syncAt,
    labelAr: 'فجوة المبيعات بين أعلى وأقل فرع نشط',
    labelEn: 'Top-to-lowest active branch velocity gap',
  })
  pushValidEvidence(evidence, {
    odooModel: 'pos.order',
    domain: 'peer_median_restaurant_branches',
    period,
    value: peerMedianKwd,
    unit: 'KWD',
    syncAt,
    labelAr: 'وسيط مبيعات الفروع النشطة',
    labelEn: 'Active branch peer median sales',
  })

  const impact = buildValidEstimate(
    weeklyLiftVal,
    medianGapKwd > 1
      ? `20% × (peer_median_${fmtKwdText(peerMedianKwd)} − ${low.id}_${fmtKwdText(low.netKwd)}) × (7 ÷ ${days}d)`
      : `10% × branch_gap_${fmtKwdText(gapKwd)} × (7 ÷ ${days}d)`,
    {
      top_branch_kwd: top.netKwd,
      lowest_branch_kwd: low.netKwd,
      peer_median_kwd: peerMedianKwd,
      gap_kwd: gapKwd,
      period_days: days,
    },
  )

  const proposals: CouncilProposal[] = [
    {
      who: { ar: 'مدير التشغيل ومدير الفرع', en: 'COO & Branch Manager' },
      what: {
        ar: `نقل نموذج البيع الإضافي وتوزيع تحضيرات الذروة من ${top.labelAr} (متوسط فاتورة ${fmtKwdText(topAovKwd)} د.ك) إلى ${low.labelAr} (متوسط فاتورة ${fmtKwdText(lowAovKwd)} د.ك) لتقليص فجوة الوسيط البالغة ${fmtKwdText(basisGapKwd)} د.ك`,
        en: `Replicate ${top.labelEn} upsell combo prompts (AOV ${fmtKwdText(topAovKwd)} KWD) and rebalance Ardiya peak prep into ${low.labelEn} (AOV ${fmtKwdText(lowAovKwd)} KWD) to close 20% of the ${fmtKwdText(basisGapKwd)} KWD gap`,
      },
      when: { ar: 'خلال 7 أيام', en: 'Within 7 days' },
      expectedImpact: impact,
    },
    {
      who: { ar: 'التسويق وجدولة الورديات', en: 'Marketing & Shift Scheduling' },
      what: {
        ar: `إعادة موازنة ساعات الطاقم في ${low.labelAr} مع تفعيل عروض الاستلام المباشر والصالة في النطاق الجغرافي للفرع`,
        en: `Align ${low.labelEn} crew shift hours to order velocity and activate localized direct-pickup bundles around the branch catchment`,
      },
      when: { ar: 'جدول الأسبوع القادم', en: 'Next weekly roster' },
      expectedImpact: null,
    },
  ]

  return {
    fingerprint: `benchmark:branch-velocity-gap:${top.id}:${low.id}`,
    advisorId: 'benchmark',
    kind: 'branch-velocity-gap',
    entities: { branchId: low.id },
    titleAr: `فجوة سرعة المبيعات بين ${top.labelAr} (${fmtKwdText(top.netKwd)} د.ك) و${low.labelAr} (${fmtKwdText(low.netKwd)} د.ك)`,
    titleEn: `Branch velocity gap: ${top.labelEn} (${fmtKwdText(top.netKwd)} KWD) vs ${low.labelEn} (${fmtKwdText(low.netKwd)} KWD)`,
    evidence,
    rootCause: {
      ar: `يتصدر ${top.labelAr} الفروع النشطة بحصة ${fmtPctText(topSharePct)}% (${top.orders.toLocaleString('en-US')} طلب) مقابل ${fmtPctText(lowSharePct)}% في ${low.labelAr} (${low.orders.toLocaleString('en-US')} طلب) بفارق ${fmtKwdText(gapKwd)} د.ك خلال ${days} يوماً في إيصالات أودو الفعلية.`,
      en: `${top.labelEn} leads active restaurant locations at ${fmtPctText(topSharePct)}% share (${top.orders.toLocaleString('en-US')} orders) vs ${fmtPctText(lowSharePct)}% at ${low.labelEn} (${low.orders.toLocaleString('en-US')} orders), creating a ${fmtKwdText(gapKwd)} KWD ${days}-day velocity spread in verified Odoo POS orders.`,
    },
    severity: gapKwd > 5000 ? 'high' : 'medium',
    novelty: 0.88,
    weeklyImpact: impact,
    proposals,
    thresholds: {
      top_share_pct: topSharePct,
      low_share_pct: lowSharePct,
      top_orders: top.orders,
      low_orders: low.orders,
      period_days: days,
    },
  }
}

/**
 * 2) Channel Mix & Aggregator Exposure:
 * Delivery platform share vs Direct (`dine-in` / `takeaway-direct`) zero-commission opportunity.
 */
function buildChannelMixFinding(
  summary: OdooLiveSummary,
  bucket: OdooBucketSummary | null,
  contextPack: ExecutiveContextPack | null | undefined,
  period: { from: string; to: string },
  days: number,
  syncAt: string | null,
): CouncilFinding | null {
  let directKwd = 0
  let directOrders = 0
  let aggKwd = 0
  let aggOrders = 0
  let topAggLabelAr = 'منصات التوصيل'
  let topAggLabelEn = 'Aggregator Platforms'
  let topAggKwd = 0

  if (bucket?.uiChannels && Object.keys(bucket.uiChannels).length > 0) {
    for (const [chKey, val] of Object.entries(bucket.uiChannels)) {
      const net = r3(val?.netKwd ?? 0)
      const ord = Math.round(val?.orders ?? 0)
      if (net <= 0.001) continue
      const meta = CHANNEL_LABELS[chKey]
      const isDirect = meta ? meta.direct : chKey === 'dine-in' || chKey === 'takeaway-direct'
      if (isDirect) {
        directKwd += net
        directOrders += ord
      } else {
        aggKwd += net
        aggOrders += ord
        if (net > topAggKwd) {
          topAggKwd = net
          topAggLabelAr = meta?.ar ?? chKey
          topAggLabelEn = meta?.en ?? chKey
        }
      }
    }
  } else if (contextPack?.branchChannelMix?.available) {
    directKwd = Number(contextPack.branchChannelMix.directNetSalesKwd) || 0
    directOrders = contextPack.branchChannelMix.directOrders ?? 0
    aggKwd = Number(contextPack.branchChannelMix.aggregatorNetSalesKwd) || 0
    aggOrders = contextPack.branchChannelMix.aggregatorOrders ?? 0
  } else if (Array.isArray(summary.channels)) {
    for (const ch of summary.channels) {
      const net = r3(ch.amountKwd ?? 0)
      if (net <= 0.001) continue
      const isDirect = /shop sales|dine|direct|online payment/i.test(ch.name)
      if (isDirect) directKwd += net
      else {
        aggKwd += net
        if (net > topAggKwd) {
          topAggKwd = net
          topAggLabelEn = ch.name
          topAggLabelAr = ch.name
        }
      }
    }
  }

  directKwd = r3(directKwd)
  aggKwd = r3(aggKwd)
  const totalChannelKwd = r3(directKwd + aggKwd)
  if (aggKwd <= 1 || totalChannelKwd <= 1) return null

  const aggSharePct = r1((aggKwd / totalChannelKwd) * 100)
  const directSharePct = r1((directKwd / totalChannelKwd) * 100)
  const postedCommKwd =
    bucket?.accounting?.available &&
    !bucket.accounting.aggregatorCommissionUnposted &&
    typeof bucket.accounting.deliveryCommissions === 'number' &&
    bucket.accounting.deliveryCommissions > 0.001
      ? r3(bucket.accounting.deliveryCommissions)
      : null

  const weeklyImpactVal =
    postedCommKwd !== null
      ? r3(((postedCommKwd * 0.1) / days) * 7)
      : r3(((aggKwd * 0.05) / days) * 7)

  const evidence: CouncilEvidence[] = []
  pushValidEvidence(evidence, {
    odooModel: 'pos.order',
    domain: 'aggregator_channels',
    period,
    value: aggKwd,
    unit: 'KWD',
    syncAt,
    labelAr: `مبيعات منصات التوصيل (${fmtPctText(aggSharePct)}%)`,
    labelEn: `Delivery platform net sales (${fmtPctText(aggSharePct)}%)`,
  })
  pushValidEvidence(evidence, {
    odooModel: 'pos.order',
    domain: 'direct_channels (dine-in + takeaway-direct)',
    period,
    value: directKwd,
    unit: 'KWD',
    syncAt,
    labelAr: `مبيعات الصالة والمباشر بدون عمولة (${fmtPctText(directSharePct)}%)`,
    labelEn: `Zero-commission Direct & Dine-In (${fmtPctText(directSharePct)}%)`,
  })
  if (aggOrders > 0) {
    pushValidEvidence(evidence, {
      odooModel: 'pos.order',
      domain: 'aggregator_orders',
      period,
      value: aggOrders,
      unit: 'orders',
      syncAt,
      labelAr: 'عدد طلبات منصات التوصيل',
      labelEn: 'Aggregator platform orders',
    })
  }
  if (directOrders > 0) {
    pushValidEvidence(evidence, {
      odooModel: 'pos.order',
      domain: 'direct_orders',
      period,
      value: directOrders,
      unit: 'orders',
      syncAt,
      labelAr: 'عدد طلبات الصالة والمباشر',
      labelEn: 'Direct & Dine-In orders',
    })
  }
  if (postedCommKwd !== null) {
    pushValidEvidence(evidence, {
      odooModel: 'account.move.line',
      domain: 'posted_delivery_commissions',
      period,
      value: postedCommKwd,
      unit: 'KWD',
      syncAt,
      labelAr: 'عمولات المنصات المرحّلة في الأستاذ العام',
      labelEn: 'Posted GL aggregator commissions',
    })
  } else if (topAggKwd > 0.001) {
    pushValidEvidence(evidence, {
      odooModel: 'pos.order',
      domain: `top_platform=${topAggLabelEn}`,
      period,
      value: topAggKwd,
      unit: 'KWD',
      syncAt,
      labelAr: `أعلى منصة تعرضاً (${topAggLabelAr})`,
      labelEn: `Top platform exposure (${topAggLabelEn})`,
    })
  }

  const impact = buildValidEstimate(
    weeklyImpactVal,
    postedCommKwd !== null
      ? `10% × posted_commissions_${fmtKwdText(postedCommKwd)} × (7 ÷ ${days}d)`
      : `5% × aggregator_sales_${fmtKwdText(aggKwd)} × (7 ÷ ${days}d) direct shift volume`,
    {
      aggregator_kwd: aggKwd,
      direct_kwd: directKwd,
      ...(postedCommKwd !== null ? { posted_commissions_kwd: postedCommKwd } : {}),
      period_days: days,
    },
  )

  return {
    fingerprint: 'delivery:channel-aggregator-shift:company',
    advisorId: 'delivery',
    kind: 'channel-aggregator-shift',
    entities: { channel: 'aggregator' },
    titleAr: `التعرض لمنصات التوصيل (${fmtPctText(aggSharePct)}% · ${fmtKwdText(aggKwd)} د.ك) مقابل المباشر بدون عمولة (${fmtPctText(directSharePct)}%)`,
    titleEn: `Aggregator exposure (${fmtPctText(aggSharePct)}% · ${fmtKwdText(aggKwd)} KWD) vs zero-commission Direct (${fmtPctText(directSharePct)}%)`,
    evidence,
    rootCause: {
      ar: `تمثل منصات التوصيل ${fmtPctText(aggSharePct)}% من إجمالي مبيعات القنوات (${fmtKwdText(aggKwd)} د.ك) مقابل ${fmtPctText(directSharePct)}% للقنوات المباشرة والداخلية (${fmtKwdText(directKwd)} د.ك)${postedCommKwd !== null ? ` مع عمولات مرحّلة بقيمة ${fmtKwdText(postedCommKwd)} د.ك في الأستاذ العام` : ''}.`,
      en: `Delivery aggregators account for ${fmtPctText(aggSharePct)}% of channel revenue (${fmtKwdText(aggKwd)} KWD) versus ${fmtPctText(directSharePct)}% in zero-commission Dine-In and Direct Takeaway (${fmtKwdText(directKwd)} KWD)${postedCommKwd !== null ? `, with ${fmtKwdText(postedCommKwd)} KWD in posted GL platform commissions` : ''}.`,
    },
    severity: aggSharePct >= 50 ? 'high' : 'medium',
    novelty: 0.85,
    weeklyImpact: impact,
    proposals: [
      {
        who: { ar: 'التسويق والتشغيل التجاري', en: 'Marketing & Commercial Ops' },
        what: {
          ar: `إرفاق قسيمة طلب مباشر (استلام من الفرع أو صالة) داخل طلبات المنصات لتحويل 5% من حجم المنصات (${fmtKwdText(aggKwd)} د.ك) إلى قنوات صفرية العمولة`,
          en: `Insert QR direct-pickup / dine-in bounce-back cards inside outgoing delivery bags to shift 5% of ${fmtKwdText(aggKwd)} KWD aggregator volume into zero-commission Direct channels`,
        },
        when: { ar: 'ابتداءً من هذا الأسبوع', en: 'Starting this week' },
        expectedImpact: impact,
      },
      {
        who: { ar: 'المالية ومسؤول تسويات المنصات', en: 'Finance & Aggregator Desk' },
        what: {
          ar: `ضبط سقف الخصومات الممولة مشتركاً على ${topAggLabelAr} ومطابقة إشعارات التسوية مع إيصالات نقاط البيع`,
          en: `Cap co-funded promo discounts on ${topAggLabelEn} and reconcile platform payout statements line-by-line against Odoo POS receipts`,
        },
        when: { ar: 'دورة التسوية الأسبوعية', en: 'Weekly settlement cycle' },
        expectedImpact: null,
      },
    ],
    thresholds: {
      aggregator_share_pct: aggSharePct,
      direct_share_pct: directSharePct,
      shift_target_pct: 5,
      period_days: days,
    },
  }
}

/**
 * 3) Quiet Hours (`15:00–18:00` Kuwait) Utilization:
 * Exact live hourly POS share & afternoon bundle/traffic play in KWD.
 */
function buildQuietHoursFinding(
  summary: OdooLiveSummary,
  bucket: OdooBucketSummary | null,
  period: { from: string; to: string },
  days: number,
  syncAt: string | null,
): CouncilFinding | null {
  const hourly = summary.hourlySeries
  if (!Array.isArray(hourly) || hourly.length === 0) return null

  let totalHourlyKwd = 0
  let totalHourlyOrders = 0
  let quietKwd = 0
  let quietOrders = 0
  let peakKwd = 0

  for (const row of hourly) {
    const net = Number.isFinite(row.netKwd) ? row.netKwd : 0
    const ord = Number.isFinite(row.orders) ? row.orders : 0
    if (net > 0) totalHourlyKwd += net
    if (ord > 0) totalHourlyOrders += ord
    if (row.hour >= 15 && row.hour < 18) {
      quietKwd += Math.max(0, net)
      quietOrders += Math.max(0, ord)
    }
    if (row.hour >= 19 && row.hour < 22) {
      peakKwd += Math.max(0, net)
    }
  }

  totalHourlyKwd = r3(totalHourlyKwd)
  quietKwd = r3(quietKwd)
  peakKwd = r3(peakKwd)
  if (totalHourlyKwd <= 0.5 || quietKwd <= 0.005) return null

  const quietSharePct = r1((quietKwd / totalHourlyKwd) * 100)
  const peakSharePct = peakKwd > 0.005 ? r1((peakKwd / totalHourlyKwd) * 100) : 0
  const monthNetKwd = r3(bucket?.totals.netSalesKwd ?? summary.totals.netSalesKwd ?? totalHourlyKwd)
  const projectedQuietWindowKwd = r3(monthNetKwd * (quietKwd / totalHourlyKwd))
  const weeklyLiftVal = r3(((projectedQuietWindowKwd * 0.2) / days) * 7)

  const hourlyWindow = summary.period ?? period
  const evidence: CouncilEvidence[] = []
  pushValidEvidence(evidence, {
    odooModel: 'pos.order',
    domain: 'kuwait_hour in (15,16,17)',
    period: hourlyWindow,
    value: quietKwd,
    unit: 'KWD',
    syncAt,
    labelAr: 'مبيعات الفترة الهادئة (15:00–18:00 بتوقيت الكويت)',
    labelEn: 'Quiet hours net sales (15:00–18:00 Kuwait)',
  })
  pushValidEvidence(evidence, {
    odooModel: 'pos.order',
    domain: 'kuwait_hour in (15,16,17) share',
    period: hourlyWindow,
    value: quietSharePct,
    unit: 'pct',
    syncAt,
    labelAr: 'حصة الفترة الهادئة من التوزيع الساعي',
    labelEn: 'Afternoon 15:00–18:00 share of hourly POS',
  })
  if (quietOrders > 0) {
    pushValidEvidence(evidence, {
      odooModel: 'pos.order',
      domain: 'kuwait_hour in (15,16,17) orders',
      period: hourlyWindow,
      value: quietOrders,
      unit: 'orders',
      syncAt,
      labelAr: 'طلبات الفترة الهادئة (15:00–18:00)',
      labelEn: 'Quiet hours orders (15:00–18:00)',
    })
  }
  if (peakKwd > 0.005) {
    pushValidEvidence(evidence, {
      odooModel: 'pos.order',
      domain: 'kuwait_hour in (19,20,21) peak comparison',
      period: hourlyWindow,
      value: peakKwd,
      unit: 'KWD',
      syncAt,
      labelAr: `مقارنة بذروة المساء 19:00–22:00 (${fmtPctText(peakSharePct)}%)`,
      labelEn: `Evening 19:00–22:00 peak comparison (${fmtPctText(peakSharePct)}%)`,
    })
  }

  const impact = buildValidEstimate(
    weeklyLiftVal,
    `20% × afternoon_30d_pool_${fmtKwdText(projectedQuietWindowKwd)} × (7 ÷ ${days}d)`,
    {
      quiet_hours_kwd: quietKwd,
      total_hourly_kwd: totalHourlyKwd,
      afternoon_30d_pool_kwd: projectedQuietWindowKwd,
      period_days: days,
    },
  )

  return {
    fingerprint: 'drivers:quiet-hours-15-18:company',
    advisorId: 'drivers',
    kind: 'quiet-hours-utilization',
    entities: { hour: 15 },
    titleAr: `استغلال الساعات الهادئة (15:00–18:00 الكويت · حصة ${fmtPctText(quietSharePct)}%) لرفع إشغال بعد الظهر`,
    titleEn: `Quiet hours (15:00–18:00 Kuwait · ${fmtPctText(quietSharePct)}% share) afternoon traffic play`,
    evidence,
    rootCause: {
      ar: `تسجل نافذة ما بعد الظهر (15:00–18:00 بتوقيت الكويت) ${fmtKwdText(quietKwd)} د.ك (${fmtPctText(quietSharePct)}% فقط من التوزيع الساعي${totalHourlyOrders > 0 ? ` عبر ${quietOrders.toLocaleString('en-US')} طلب` : ''}) رغم جاهزية الطواقم والمطابخ قبل ذروة العشاء.`,
      en: `The 15:00–18:00 Kuwait window generates ${fmtKwdText(quietKwd)} KWD (${fmtPctText(quietSharePct)}% of hourly POS volume${totalHourlyOrders > 0 ? ` across ${quietOrders.toLocaleString('en-US')} orders` : ''}) while kitchen and floor teams are already staffed ahead of dinner peak.`,
    },
    severity: quietSharePct < 12 ? 'high' : 'medium',
    novelty: 0.82,
    weeklyImpact: impact,
    proposals: [
      {
        who: { ar: 'إدارة العلامات والمنيو', en: 'Brand & Menu Leads' },
        what: {
          ar: `إطلاق باقة عصر محددة زمنياً (15:00–18:00) في الفروع التجارية وكرك كافتيريا وفرانكس لرفع مبيعات النافذة بنسبة 20% دون المساس بأسعار ذروة المساء`,
          en: `Launch a time-boxed 15:00–18:00 afternoon snack & beverage bundle across mall locations, Karak Cafeteria, and Frank's to lift off-peak throughput by 20% without discounting dinner peak`,
        },
        when: { ar: 'أيام الأسبوع 15:00–18:00', en: 'Weekdays 15:00–18:00' },
        expectedImpact: impact,
      },
      {
        who: { ar: 'مديرو الفروع', en: 'Branch Managers' },
        what: {
          ar: 'توجيه التحضير المسبق وتبديل الورديات بين 15:00 و17:00 لاستيعاب طلبات باقة العصر بنفس تكلفة العمالة الحالية',
          en: 'Schedule prep batching and shift handovers between 15:00 and 17:00 so incremental afternoon orders carry zero extra labor cost',
        },
        when: { ar: 'ابتداءً من الغد', en: 'Starting tomorrow' },
        expectedImpact: null,
      },
    ],
    thresholds: {
      quiet_start_hour: 15,
      quiet_end_hour: 18,
      quiet_share_pct: quietSharePct,
      uplift_target_pct: 20,
    },
  }
}

/**
 * 4) Receivables & Unapplied Credits Clearing (`account.move.line`):
 * Live `>30d`/`>60d` open platform receivables & unapplied customer credits collection/reconciliation action.
 */
function buildReceivablesClearingFinding(
  summary: OdooLiveSummary,
  period: { from: string; to: string },
  syncAt: string | null,
): CouncilFinding | null {
  const ar = summary.aggregatorReceivables
  if (!ar || !ar.readable) return null

  const figures = customerReceivableFigures(ar)
  const openDebitsKwd = r3(figures.openDebitsKwd ?? 0)
  const unappliedCreditsKwd = r3(figures.unappliedCreditsKwd ?? 0)
  const netReceivableKwd = figures.netKwd !== null ? r3(figures.netKwd) : null

  const bucket31to60 = r3(
    ar.agingBuckets?.find((b) => b.key === '31_60')?.positiveDebitKwd ?? 0,
  )
  const bucketOver60 = r3(
    ar.agingBuckets?.find((b) => b.key === 'over_60')?.positiveDebitKwd ?? 0,
  )
  const overdueOver30Kwd = r3(bucket31to60 + bucketOver60)
  const absCreditsKwd = r3(Math.abs(unappliedCreditsKwd))

  if (openDebitsKwd <= 0.001 && absCreditsKwd <= 0.001) return null

  const arPeriod = {
    from: ar.fromDate && /^\d{4}-\d{2}-\d{2}$/.test(ar.fromDate) ? ar.fromDate : period.from,
    to: ar.toDate && /^\d{4}-\d{2}-\d{2}$/.test(ar.toDate) ? ar.toDate : period.to,
  }

  const topPartner = (ar.byPartner ?? []).find(
    (p) => p.residualKwd > 0.001 && !isExcludedOdooEntity(p.partnerName),
  )

  const evidence: CouncilEvidence[] = []
  pushValidEvidence(evidence, {
    odooModel: 'account.move.line',
    domain: 'account_type=asset_receivable, reconciled=false, code!=10552 (debits)',
    period: arPeriod,
    value: openDebitsKwd,
    unit: 'KWD',
    syncAt,
    labelAr: 'إجمالي الذمم المدينة المفتوحة (المنصات والعملاء)',
    labelEn: 'Open platform & customer debits (excl. 10552)',
  })
  if (overdueOver30Kwd > 0.001) {
    pushValidEvidence(evidence, {
      odooModel: 'account.move.line',
      domain: 'due_age > 30d (31_60 + over_60)',
      period: arPeriod,
      value: overdueOver30Kwd,
      unit: 'KWD',
      syncAt,
      labelAr: 'ذمم متأخرة تتجاوز 30 يوماً',
      labelEn: 'Overdue receivables aged >30 days',
    })
  }
  if (bucketOver60 > 0.001) {
    pushValidEvidence(evidence, {
      odooModel: 'account.move.line',
      domain: 'due_age > 60d (over_60)',
      period: arPeriod,
      value: bucketOver60,
      unit: 'KWD',
      syncAt,
      labelAr: 'ذمم حرجة تتجاوز 60 يوماً',
      labelEn: 'Critical receivables aged >60 days',
    })
  }
  if (absCreditsKwd > 0.001) {
    pushValidEvidence(evidence, {
      odooModel: 'account.move.line',
      domain: 'amount_residual < 0, reconciled=false',
      period: arPeriod,
      value: unappliedCreditsKwd,
      unit: 'KWD',
      syncAt,
      labelAr: 'أرصدة دائنة ودفعات غير مطبّقة في أودو',
      labelEn: 'Unapplied customer & platform credits',
    })
  }
  if (netReceivableKwd !== null && Math.abs(netReceivableKwd) > 0.001) {
    pushValidEvidence(evidence, {
      odooModel: 'account.move.line',
      domain: 'net_open_receivable_excl_10552',
      period: arPeriod,
      value: netReceivableKwd,
      unit: 'KWD',
      syncAt,
      labelAr: 'صافي الذمم غير المسوّاة بعد الدائن',
      labelEn: 'Net unreconciled AR balance',
    })
  }

  const targetCollectionPool = overdueOver30Kwd > 0.001 ? overdueOver30Kwd : openDebitsKwd
  const weeklyClearingVal = r3(targetCollectionPool * 0.25 + absCreditsKwd * 0.25)
  const impact = buildValidEstimate(
    weeklyClearingVal,
    `25% × (${overdueOver30Kwd > 0.001 ? `overdue_30d_${fmtKwdText(overdueOver30Kwd)}` : `open_debits_${fmtKwdText(openDebitsKwd)}`}${absCreditsKwd > 0.001 ? ` + abs(unapplied_credits_${fmtKwdText(unappliedCreditsKwd)})` : ''}) weekly clearing pace`,
    {
      open_debits_kwd: openDebitsKwd,
      ...(overdueOver30Kwd > 0.001 ? { overdue_over_30d_kwd: overdueOver30Kwd } : {}),
      ...(absCreditsKwd > 0.001 ? { unapplied_credits_abs_kwd: absCreditsKwd } : {}),
    },
  )

  return {
    fingerprint: 'cfo:receivables-clearing:account-move-line',
    advisorId: 'cfo',
    kind: 'receivables-credits-clearing',
    entities: { channel: 'receivables' },
    titleAr: `تحصيل الذمم المفتوحة (${fmtKwdText(openDebitsKwd)} د.ك)${absCreditsKwd > 0.001 ? ` وتسوية الأرصدة الدائنة غير المطبّقة (${fmtKwdText(unappliedCreditsKwd)} د.ك)` : ''}`,
    titleEn: `Collect open AR (${fmtKwdText(openDebitsKwd)} KWD)${absCreditsKwd > 0.001 ? ` & clear unapplied credits (${fmtKwdText(unappliedCreditsKwd)} KWD)` : ''}`,
    evidence,
    rootCause: {
      ar: `يُظهر حساب الذمم في أودو (account.move.line باستثناء مقاصة الكاشير 10552) ذمماً مدينة مفتوحة بقيمة ${fmtKwdText(openDebitsKwd)} د.ك${overdueOver30Kwd > 0.001 ? ` منها ${fmtKwdText(overdueOver30Kwd)} د.ك متأخرة فوق 30 يوماً` : ''}${absCreditsKwd > 0.001 ? ` مقابل أرصدة دائنة غير مطبّقة بقيمة ${fmtKwdText(unappliedCreditsKwd)} د.ك تحتاج مقاصة محاسبية` : ''}${topPartner ? ` (أكبر رصيد مفتوح: ${topPartner.partnerName} بواقع ${fmtKwdText(topPartner.residualKwd)} د.ك)` : ''}.`,
      en: `Live Odoo account.move.line receivables (excluding POS clearing 10552) carry ${fmtKwdText(openDebitsKwd)} KWD in open debits${overdueOver30Kwd > 0.001 ? ` including ${fmtKwdText(overdueOver30Kwd)} KWD aged over 30 days` : ''}${absCreditsKwd > 0.001 ? ` alongside ${fmtKwdText(unappliedCreditsKwd)} KWD in unapplied credit lines awaiting invoice matching` : ''}${topPartner ? ` (largest open partner: ${topPartner.partnerName} at ${fmtKwdText(topPartner.residualKwd)} KWD)` : ''}.`,
    },
    severity: overdueOver30Kwd > 1000 || absCreditsKwd > 500 ? 'high' : 'medium',
    novelty: 0.9,
    weeklyImpact: impact,
    proposals: [
      {
        who: { ar: 'المدير المالي ومحاسب الذمم', en: 'CFO & AR Accountant' },
        what: {
          ar: absCreditsKwd > 0.001
            ? `مطابقة الأرصدة الدائنة غير المطبّقة (${fmtKwdText(unappliedCreditsKwd)} د.ك) مع الفواتير المفتوحة في أودو 17 لتصفية قيود التسوية المعلقة`
            : `مطابقة دفعات المنصات المستلمة مع قيود الذمم المفتوحة (${fmtKwdText(openDebitsKwd)} د.ك) في أودو 17`,
          en: absCreditsKwd > 0.001
            ? `Match ${fmtKwdText(unappliedCreditsKwd)} KWD of unapplied credit lines against open partner invoices in Odoo 17 so partner statements show exact net collectables`
            : `Reconcile incoming platform bank payouts against ${fmtKwdText(openDebitsKwd)} KWD open receivable lines in Odoo 17`,
        },
        when: { ar: 'خلال 48 ساعة', en: 'Within 48 hours' },
        expectedImpact: impact,
      },
      {
        who: { ar: 'الخزينة ومتابعة المنصات', en: 'Treasury & Platform Settlements' },
        what: {
          ar: overdueOver30Kwd > 0.001
            ? `إرسال مطالبات تحصيل رسمية بالذمم المتجاوزة 30/60 يوماً (${fmtKwdText(overdueOver30Kwd)} د.ك) وجدولة إغلاقها الأسبوعي`
            : `متابعة تحصيل الرصيد المفتوح (${fmtKwdText(openDebitsKwd)} د.ك) وفق تواريخ الاستحقاق`,
          en: overdueOver30Kwd > 0.001
            ? `Issue formal statement-of-account collection notices on ${fmtKwdText(overdueOver30Kwd)} KWD aged >30/60d and track weekly cash settlement`
            : `Follow up scheduled settlement dates across ${fmtKwdText(openDebitsKwd)} KWD open partner balances`,
        },
        when: { ar: 'هذا الأسبوع', en: 'This week' },
        expectedImpact: null,
      },
    ],
    thresholds: {
      aging_days_threshold: 30,
      critical_days_threshold: 60,
    },
  }
}

/**
 * 5) Menu Pareto Tier-A Protection & Long-Tail SKU Rationalization (`pos.order.line`):
 * Live Tier-A top driver concentration vs Tier-C long-tail SKU count & Ferial pricing/bundling action.
 * Strictly respects user 225 `standard_price` boundary (never estimates COGS or gross margin).
 */
function buildMenuParetoFinding(
  contextPack: ExecutiveContextPack | null | undefined,
  days: number,
  syncAt: string | null,
): CouncilFinding | null {
  if (!contextPack || contextPack.totals.skuCount <= 0) return null

  const tierA = contextPack.tierSummary.A
  const tierC = contextPack.tierSummary.C
  const tierANetKwd = r3(Number(tierA.netSalesKwd) || 0)
  const tierASharePct = r1(Number(tierA.revenueSharePct) || 0)
  const tierCNetKwd = r3(Number(tierC.netSalesKwd) || 0)
  const tierCSharePct = r1(Number(tierC.revenueSharePct) || 0)

  if (tierANetKwd <= 0.001 || tierA.skuCount <= 0) return null

  const topCleanSku = contextPack.skus.find(
    (s) => !isExcludedOdooEntity(s.name) && !isNonCompanyCatalogItem(null, s.name),
  )
  const period = {
    from: contextPack.period.from,
    to: contextPack.period.to,
  }

  const evidence: CouncilEvidence[] = []
  pushValidEvidence(evidence, {
    odooModel: 'pos.order.line',
    domain: 'pareto_tier=A (top 80% cumulative revenue)',
    period,
    value: tierANetKwd,
    unit: 'KWD',
    syncAt,
    labelAr: `مبيعات أصناف الفئة A القيادية (${tierA.skuCount} صنف · ${fmtPctText(tierASharePct)}%)`,
    labelEn: `Tier-A core SKU sales (${tierA.skuCount} SKUs · ${fmtPctText(tierASharePct)}%)`,
  })
  pushValidEvidence(evidence, {
    odooModel: 'pos.order.line',
    domain: 'pareto_tier=A sku_count',
    period,
    value: tierA.skuCount,
    unit: 'count',
    syncAt,
    labelAr: 'عدد أصناف الفئة A عالية الدوران',
    labelEn: 'Tier-A core driver SKU count',
  })
  if (tierC.skuCount > 0) {
    pushValidEvidence(evidence, {
      odooModel: 'pos.order.line',
      domain: 'pareto_tier=C sku_count',
      period,
      value: tierC.skuCount,
      unit: 'count',
      syncAt,
      labelAr: `عدد أصناف الذيل الطويل الفئة C (${fmtPctText(tierCSharePct)}%)`,
      labelEn: `Tier-C long-tail SKU count (${fmtPctText(tierCSharePct)}% share)`,
    })
  }
  if (tierCNetKwd > 0.001) {
    pushValidEvidence(evidence, {
      odooModel: 'pos.order.line',
      domain: 'pareto_tier=C net_sales',
      period,
      value: tierCNetKwd,
      unit: 'KWD',
      syncAt,
      labelAr: 'مبيعات أصناف الفئة C منخفضة الدوران',
      labelEn: 'Tier-C long-tail net POS sales',
    })
  }
  if (topCleanSku && Number(topCleanSku.netSalesKwd) > 0.001) {
    pushValidEvidence(evidence, {
      odooModel: 'pos.order.line',
      domain: `product_id=${topCleanSku.productId}`,
      period,
      value: r3(Number(topCleanSku.netSalesKwd)),
      unit: 'KWD',
      syncAt,
      labelAr: `الصنف الأول (${topCleanSku.name})`,
      labelEn: `Top #1 SKU (${topCleanSku.name})`,
    })
  }

  const weeklyLiftVal = r3(((tierANetKwd * 0.02 + tierCNetKwd * 0.15) / days) * 7)
  const impact = buildValidEstimate(
    weeklyLiftVal,
    `(2% × tier_a_${fmtKwdText(tierANetKwd)} + 15% × tier_c_${fmtKwdText(tierCNetKwd)}) × (7 ÷ ${days}d) net revenue simulation`,
    {
      tier_a_kwd: tierANetKwd,
      tier_c_kwd: tierCNetKwd,
      tier_a_skus: tierA.skuCount,
      tier_c_skus: tierC.skuCount,
      period_days: days,
    },
  )

  return {
    fingerprint: 'menu:pareto-tier-a-c:pos-order-line',
    advisorId: 'menu',
    kind: 'menu-pareto-rationalization',
    entities: { brandId: 'company' },
    titleAr: `حماية ${tierA.skuCount} صنف قيادي (الفئة A · ${fmtPctText(tierASharePct)}%) وترشيد ${tierC.skuCount} صنف في الذيل الطويل (الفئة C)`,
    titleEn: `Protect ${tierA.skuCount} Tier-A drivers (${fmtPctText(tierASharePct)}% sales) & rationalize ${tierC.skuCount} Tier-C tail SKUs`,
    evidence,
    rootCause: {
      ar: `تتركز ${fmtPctText(tierASharePct)}% من صافي مبيعات الأصناف (${fmtKwdText(tierANetKwd)} د.ك) في ${tierA.skuCount} صنف فقط من الفئة A${topCleanSku ? ` يتصدرها «${topCleanSku.name}»` : ''}، بينما يتوزع ${tierC.skuCount} صنف في الفئة C على حصة ${fmtPctText(tierCSharePct)}% فقط (${fmtKwdText(tierCNetKwd)} د.ك) — علماً أن الأرقام تمثل صافي إيراد pos.order.line دون تقدير تكلفة المواد لأن حقل standard_price مقيّد لمستخدم التكامل 225.`,
      en: `${tierA.skuCount} Tier-A SKUs generate ${fmtPctText(tierASharePct)}% of POS item revenue (${fmtKwdText(tierANetKwd)} KWD)${topCleanSku ? ` led by "${topCleanSku.name}"` : ''}, while ${tierC.skuCount} Tier-C SKUs contribute only ${fmtPctText(tierCSharePct)}% (${fmtKwdText(tierCNetKwd)} KWD) — measured strictly on net pos.order.line revenue without fabricating COGS (standard_price is restricted for Odoo user 225).`,
    },
    severity: tierC.skuCount > tierA.skuCount ? 'high' : 'medium',
    novelty: 0.86,
    weeklyImpact: impact,
    proposals: [
      {
        who: { ar: 'هندسة المنيو ومديرو العلامات', en: 'Menu Engineering & Brand Leads' },
        what: {
          ar: `تثبيت تنافسية أصناف الفئة A (${tierA.skuCount} صنف) ضد أي زيادة تتجاوز 10%، ودمج بطيئات الدوران من الفئة C (${tierC.skuCount} صنف) كإضافات وجبات لرفع متوسط الفاتورة أو تقليص تعقيد التحضير`,
          en: `Cap price increases on ${tierA.skuCount} Tier-A traffic drivers below 10% and bundle slow-moving Tier-C items (${tierC.skuCount} SKUs) into meal combos or prune low-velocity prep lines`,
        },
        when: { ar: 'قبل تحديث المنيو القادم', en: 'Before next menu cycle' },
        expectedImpact: impact,
      },
      {
        who: { ar: 'الإدارة التنفيذية عبر فريال', en: 'Executive Pricing via Ferial AI' },
        what: {
          ar: 'رفع أي جدول أسعار مقترح في استوديو فريال (/erp/feryal-ai) لاختبار مرونة الطلب على مستوى الصنف قبل تعديل قوائم الأسعار في أودو',
          en: 'Run proposed price-sheet uploads through Ferial AI (/erp/feryal-ai) for SKU-level elasticity stress-testing prior to updating Odoo POS pricelists',
        },
        when: { ar: 'عند أي مراجعة تسعير', en: 'Prior to any pricelist update' },
        expectedImpact: null,
      },
    ],
    thresholds: {
      tier_a_skus: tierA.skuCount,
      tier_c_skus: tierC.skuCount,
      tier_a_cap_pct: 10,
      period_days: days,
    },
  }
}

/**
 * 6) Unattributed POS Terminal Mapping (only when `unattributedSalesKwd > 0`).
 */
function buildUnattributedPosFinding(
  summary: OdooLiveSummary,
  bucket: OdooBucketSummary | null,
  period: { from: string; to: string },
  days: number,
  syncAt: string | null,
): CouncilFinding | null {
  const unattrKwd = r3(bucket?.unattributedSalesKwd ?? summary.unattributedSalesKwd ?? 0)
  if (unattrKwd <= 0.001) return null

  const unattrOrders = Math.round(bucket?.unattributedOrders ?? summary.unattributedOrders ?? 0)
  const totalNetKwd = r3(bucket?.totals.netSalesKwd ?? summary.totals.netSalesKwd ?? unattrKwd)
  const sharePct = totalNetKwd > 0.001 ? r1((unattrKwd / totalNetKwd) * 100) : 0
  const unmappedCount = Array.isArray(summary.unmappedTerminals)
    ? summary.unmappedTerminals.length
    : 0

  const evidence: CouncilEvidence[] = []
  pushValidEvidence(evidence, {
    odooModel: 'pos.order',
    domain: 'unattributed_pos_config',
    period,
    value: unattrKwd,
    unit: 'KWD',
    syncAt,
    labelAr: 'مبيعات نقاط بيع غير منسوبة لفرع محدد',
    labelEn: 'Unattributed POS net sales',
  })
  if (unattrOrders > 0) {
    pushValidEvidence(evidence, {
      odooModel: 'pos.order',
      domain: 'unattributed_pos_orders',
      period,
      value: unattrOrders,
      unit: 'orders',
      syncAt,
      labelAr: 'عدد الطلبات غير المنسوبة',
      labelEn: 'Unattributed POS orders',
    })
  }
  if (sharePct >= 0.1) {
    pushValidEvidence(evidence, {
      odooModel: 'pos.order',
      domain: 'unattributed_share_pct',
      period,
      value: sharePct,
      unit: 'pct',
      syncAt,
      labelAr: 'نسبتها من إجمالي مبيعات الشركة',
      labelEn: 'Share of company POS sales',
    })
  }
  if (unmappedCount > 0) {
    pushValidEvidence(evidence, {
      odooModel: 'pos.config',
      domain: 'unmapped_terminals',
      period,
      value: unmappedCount,
      unit: 'count',
      syncAt,
      labelAr: 'أجهزة نقاط بيع بحاجة لربط الفرع',
      labelEn: 'POS terminals needing branch mapping',
    })
  }

  const weeklyReconciledKwd = r3((unattrKwd / days) * 7)
  const impact = buildValidEstimate(
    weeklyReconciledKwd,
    `unattributed_sales_${fmtKwdText(unattrKwd)} × (7 ÷ ${days}d) attributed to branch P&L`,
    {
      unattributed_kwd: unattrKwd,
      period_days: days,
    },
  )

  return {
    fingerprint: 'cfo:unattributed-pos-terminals:mapping',
    advisorId: 'cfo',
    kind: 'unattributed-pos-mapping',
    entities: { branchId: 'unattributed' },
    titleAr: `ربط أجهزة نقاط البيع غير المنسوبة (${fmtKwdText(unattrKwd)} د.ك${unattrOrders > 0 ? ` · ${unattrOrders.toLocaleString('en-US')} طلب` : ''}) بالفروع`,
    titleEn: `Map unattributed POS terminals (${fmtKwdText(unattrKwd)} KWD${unattrOrders > 0 ? ` · ${unattrOrders.toLocaleString('en-US')} orders` : ''}) to branch P&L`,
    evidence,
    rootCause: {
      ar: `يوجد ${fmtKwdText(unattrKwd)} د.ك من إيصالات نقاط البيع الفعلية في أودو غير مربوطة بفرع تشغيلي محدد، مما يحجب مساهمتها الدقيقة في بطاقات ربحية ومقارنة الفروع.`,
      en: `${fmtKwdText(unattrKwd)} KWD in verified Odoo POS orders originates from terminals without an explicit branch mapping, keeping that volume outside branch-level P&L attribution.`,
    },
    severity: unattrKwd > 1000 ? 'high' : 'low',
    novelty: 0.78,
    weeklyImpact: impact,
    proposals: [
      {
        who: { ar: 'مسؤول النظام وإدارة التشغيل', en: 'System Admin & Operations' },
        what: {
          ar: `اعتماد ربط معرفات أجهزة pos.config بالفرع الفعلي في لوحة الإدارة (/erp/admin) لضمان مطابقة 100% من مبيعات الفروع`,
          en: `Assign unmapped pos.config terminal IDs to their physical branch in Admin (/erp/admin) so 100% of POS revenue reconciles to branch scorecards`,
        },
        when: { ar: 'اليوم', en: 'Today' },
        expectedImpact: impact,
      },
    ],
    thresholds: {
      period_days: days,
    },
  }
}

/**
 * Pure deterministic builder: derives AdvisorReports directly from live read-only Odoo data.
 */
export function buildLiveDecisionReportsFromOdoo(input: {
  summary: OdooLiveSummary | null
  contextPack?: ExecutiveContextPack | null
}): AdvisorReport[] {
  const { summary, contextPack } = input
  if (!summary || summary.connected === false || summary.noData) {
    return []
  }

  const { bucket, period, days, syncAt } = resolveActiveMonthBucket(summary)
  if (!period.from || !period.to) return []

  const findingsByAdvisor = new Map<AdvisorId, CouncilFinding[]>()
  const addFinding = (finding: CouncilFinding | null) => {
    if (!finding || finding.evidence.length === 0) return
    const list = findingsByAdvisor.get(finding.advisorId) ?? []
    list.push(finding)
    findingsByAdvisor.set(finding.advisorId, list)
  }

  addFinding(buildBranchPerformanceFinding(summary, bucket, period, days, syncAt))
  addFinding(buildChannelMixFinding(summary, bucket, contextPack, period, days, syncAt))
  addFinding(buildQuietHoursFinding(summary, bucket, period, days, syncAt))
  addFinding(buildReceivablesClearingFinding(summary, period, syncAt))
  addFinding(buildMenuParetoFinding(contextPack, days, syncAt))
  addFinding(buildUnattributedPosFinding(summary, bucket, period, days, syncAt))

  const reports: AdvisorReport[] = []
  for (const [advisorId, findings] of findingsByAdvisor.entries()) {
    const meta = DOMAIN_META[advisorId]
    reports.push({
      advisorId,
      domainAr: meta.ar,
      domainEn: meta.en,
      period,
      generatedAt: syncAt,
      status: 'ready',
      findings: findings.sort(
        (a, b) => findingImpactScore(b) - findingImpactScore(a) || a.fingerprint.localeCompare(b.fingerprint),
      ),
      dataGaps: [],
    })
  }

  return reports
}

function mergeReports(
  existingReports: readonly AdvisorReport[],
  liveReports: readonly AdvisorReport[],
): AdvisorReport[] {
  if (existingReports.length === 0) return [...liveReports]
  if (liveReports.length === 0) return [...existingReports]

  const seenFingerprints = new Set(
    existingReports.flatMap((r) => r.findings.map((f) => f.fingerprint)),
  )
  const byAdvisor = new Map<AdvisorId, AdvisorReport>()
  for (const r of existingReports) {
    byAdvisor.set(r.advisorId, {
      ...r,
      findings: [...r.findings],
      dataGaps: [...r.dataGaps],
    })
  }

  for (const live of liveReports) {
    const freshFindings = live.findings.filter((f) => !seenFingerprints.has(f.fingerprint))
    if (freshFindings.length === 0) continue
    const cur = byAdvisor.get(live.advisorId)
    if (!cur || cur.status === 'unavailable' || cur.findings.length === 0) {
      byAdvisor.set(live.advisorId, {
        ...live,
        findings: [...(cur?.findings ?? []), ...freshFindings],
        dataGaps: cur?.dataGaps.length ? cur.dataGaps : live.dataGaps,
      })
    } else {
      byAdvisor.set(live.advisorId, {
        ...cur,
        status: 'ready',
        generatedAt: cur.generatedAt ?? live.generatedAt,
        findings: [...cur.findings, ...freshFindings].sort(
          (a, b) =>
            findingImpactScore(b) - findingImpactScore(a) ||
            a.fingerprint.localeCompare(b.fingerprint),
        ),
      })
    }
  }

  return Array.from(byAdvisor.values())
}

/**
 * Synchronous deterministic snapshot builder (safe in browser & server).
 */
export function buildLiveDecisionSnapshotFromSummary(
  summary: OdooLiveSummary | null,
  contextPack?: ExecutiveContextPack | null,
  existingSnapshot?: CouncilSnapshot | null,
): LiveDecisionGeneratorResult {
  const liveReports = buildLiveDecisionReportsFromOdoo({ summary, contextPack })
  const mergedReports = mergeReports(existingSnapshot?.reports ?? [], liveReports)
  const actionableFindings = mergedReports.flatMap((r) => r.findings)

  if (actionableFindings.length === 0) {
    return {
      available: false,
      generatedAt: existingSnapshot?.generatedAt ?? null,
      reports: [],
      discoveries: [],
      summary: null,
      aiEnriched: false,
    }
  }

  const generatedAt =
    existingSnapshot?.generatedAt ??
    summary?.lastSyncAt ??
    summary?.syncedAt ??
    mergedReports.find((r) => r.generatedAt)?.generatedAt ??
    null

  const discoveries =
    existingSnapshot && existingSnapshot.discoveries.length >= 3
      ? existingSnapshot.discoveries
      : rankDiscoveries(mergedReports, new Set(), 3)

  const snapshot: CouncilSnapshot = {
    generatedAt,
    reports: mergedReports,
    discoveries,
  }

  return {
    available: true,
    generatedAt,
    reports: mergedReports,
    discoveries,
    summary: templateSummary(snapshot),
    aiEnriched: false,
  }
}

function buildFactBundleForFinding(finding: CouncilFinding): Record<string, unknown> {
  return {
    fingerprint: finding.fingerprint,
    evidenceValues: finding.evidence.map((e) => ({
      value: e.value,
      from: e.period.from,
      to: e.period.to,
    })),
    weeklyImpactValue: finding.weeklyImpact?.value ?? null,
    weeklyImpactInputs: finding.weeklyImpact?.inputs ?? {},
    thresholds: finding.thresholds ?? {},
    hour: finding.entities.hour ?? null,
  }
}

interface LlmEnrichmentPayload {
  rationales?: Array<{
    fingerprint?: string
    rootCauseAr?: string
    rootCauseEn?: string
  }>
}

function parseJsonObjectSafe(raw: string): LlmEnrichmentPayload | null {
  const trimmed = raw.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as LlmEnrichmentPayload
  } catch {
    return null
  }
}

/**
 * Full async generator: computes deterministic Odoo decision cards and optionally enriches
 * CFO/COO rationales via the Council LLM provider (`callProvider`) guarded by `reviewGroundedNumbers`.
 */
export async function generateLiveOdooDecisionSnapshot(
  input: LiveDecisionGeneratorInput,
): Promise<LiveDecisionGeneratorResult> {
  const base = buildLiveDecisionSnapshotFromSummary(
    input.summary,
    input.contextPack,
    input.existingSnapshot,
  )
  if (!base.available || !input.callLlm) {
    return base
  }

  const targetFindings = base.reports
    .flatMap((r) => r.findings)
    .slice(0, 6)

  if (targetFindings.length === 0) return base

  const system = [
    'You are the CFO & COO Executive Council for Venture Foods Co. W.L.L. (Kuwait).',
    'Rewrite concise, board-ready rootCauseAr and rootCauseEn (1-2 sentences each) for each decision card.',
    'STRICT GROUNDING RULES:',
    '- Use ONLY the exact numbers provided inside each card facts object. NEVER invent, round differently, or introduce new numbers, percentages, or COGS/margins.',
    '- Never mention excluded entities or standard_price estimates.',
    '- Return ONLY valid JSON: {"rationales":[{"fingerprint":"...","rootCauseAr":"...","rootCauseEn":"..."}]}',
  ].join('\n')

  const userFacts = targetFindings.map((f) => ({
    fingerprint: f.fingerprint,
    titleAr: f.titleAr,
    titleEn: f.titleEn,
    baselineRootCauseAr: f.rootCause.ar,
    baselineRootCauseEn: f.rootCause.en,
    evidence: f.evidence.map((e) => ({
      labelAr: e.labelAr,
      labelEn: e.labelEn,
      value: e.value,
      unit: e.unit,
    })),
    weeklyImpactKwd: f.weeklyImpact?.value ?? null,
    thresholds: f.thresholds ?? {},
  }))

  let aiEnriched = false
  try {
    const rawReply = await input.callLlm({
      system,
      user: JSON.stringify({ cards: userFacts }),
      timeoutMs: input.timeoutMs ?? 4_500,
    })
    if (rawReply) {
      const parsed = parseJsonObjectSafe(rawReply)
      if (parsed?.rationales && Array.isArray(parsed.rationales)) {
        const updates = new Map<string, { ar: string; en: string }>()
        for (const item of parsed.rationales) {
          if (!item?.fingerprint) continue
          const original = targetFindings.find((f) => f.fingerprint === item.fingerprint)
          if (!original) continue
          const facts = buildFactBundleForFinding(original)
          const candAr = typeof item.rootCauseAr === 'string' ? item.rootCauseAr.trim() : ''
          const candEn = typeof item.rootCauseEn === 'string' ? item.rootCauseEn.trim() : ''
          const arValid =
            candAr.length >= 25 &&
            !isExcludedOdooEntity(candAr) &&
            !isNonCompanyCatalogItem(null, candAr) &&
            reviewGroundedNumbers(candAr, facts).ok
          const enValid =
            candEn.length >= 25 &&
            !isExcludedOdooEntity(candEn) &&
            !isNonCompanyCatalogItem(null, candEn) &&
            reviewGroundedNumbers(candEn, facts).ok
          if (arValid || enValid) {
            updates.set(original.fingerprint, {
              ar: arValid ? candAr : original.rootCause.ar,
              en: enValid ? candEn : original.rootCause.en,
            })
            aiEnriched = true
          }
        }

        if (updates.size > 0) {
          const enrichedReports = base.reports.map((rep) => ({
            ...rep,
            findings: rep.findings.map((f) => {
              const upd = updates.get(f.fingerprint)
              return upd ? { ...f, rootCause: upd } : f
            }),
          }))
          const enrichedDiscoveries = rankDiscoveries(enrichedReports, new Set(), 3)
          const snap: CouncilSnapshot = {
            generatedAt: base.generatedAt,
            reports: enrichedReports,
            discoveries: enrichedDiscoveries,
          }
          const tmpl = templateSummary(snap)
          return {
            available: true,
            generatedAt: base.generatedAt,
            reports: enrichedReports,
            discoveries: enrichedDiscoveries,
            summary: { ...tmpl, source: 'ai' },
            aiEnriched: true,
          }
        }
      }
    }
  } catch {
    aiEnriched = false
  }

  return { ...base, aiEnriched }
}

/* ------------------------------------------------------------------ Client SWR Read Cache (delegated to shared erp-read-cache) */

const DECISION_KEY_NAMESPACE = 'decisions:'

export function bustDecisionSwrCache(): void {
  bustErpReadCache(DECISION_KEY_NAMESPACE)
}

export function peekDecisionSwrCache<T>(key: string, maxStaleMs = 15 * 60_000): {
  data: T
  isFresh: boolean
} | null {
  const hit = inspectErpReadCacheEntry<T>(`${DECISION_KEY_NAMESPACE}${key}`, {
    ttlMs: 60_000,
    maxStaleMs,
  })
  return hit ? { data: hit.data, isFresh: hit.isFresh } : null
}

export function writeDecisionSwrCache<T>(key: string, data: T): void {
  writeErpReadCache(`${DECISION_KEY_NAMESPACE}${key}`, data)
}

export function fetchDecisionSwr<T>(
  key: string,
  fetcher: () => Promise<T | null>,
): Promise<T | null> {
  return fetchWithErpReadCache<T | null>(`${DECISION_KEY_NAMESPACE}${key}`, fetcher, {
    ttlMs: 60_000,
    maxStaleMs: 15 * 60_000,
    shouldCache: (val) => val !== null && val !== undefined,
  })
}
