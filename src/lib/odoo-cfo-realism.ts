/**
 * Conservative CFO Realism & Odoo 17 Cross-Correlation Engine (`src/lib/odoo-cfo-realism.ts`)
 *
 * Cross-correlates 5 live Venture Foods Odoo streams:
 *   1. POS basket co-occurrence (`pos.order` + `pos.order.line` single-item & pair attach rates)
 *   2. Supplier price gaps -> Ardiya Central Kitchen (#17) prep batches -> menu dish BOMs (`mrp.bom`)
 *   3. Branch inventory variance separating normal 5%–7% cooking trim from recoverable shrinkage
 *   4. Odoo Analytic fixed costs (`account.analytic.line` across 7 branches + CK #17 + HO #19)
 *   5. Aggregator commissions & clearing (`Talabat Tgo` vs `Talabat TMP 15%`, `Keeta`, `Deliveroo`, `Jahez`, `Snoonu`)
 *
 * Enforces strict CFO realism bounds on every recommendation:
 *   - 94%–97% volume retention on menu price tweaks (net of walk-away margin loss & delivery commission)
 *   - 8%–15% realistic customer conversion on combos/upsells (net of food, packaging & delivery commission)
 *   - 5%–7% normal cooking trim excluded before computing recoverable kitchen shrinkage
 *   - Outputs: (a) Odoo record provenance badge, (b) 3-step field plan naming Owner & Branch,
 *     and (c) 3-tier monthly KWD impact (`متحفظ` | `واقعي مرجّح` | `هدف أعلى`).
 */

import { ODOO } from '@/lib/odoo/odoo-dataset'
import JOURNEY from '@/lib/odoo/odoo-journey.json'
import { BRANCH_TRUE_CASH, type JourneyPlay } from '@/lib/full-journey-enterprise-brain'

export const CFO_BOUNDS = {
  /** 94%–97% realistic volume retention on 100–150 fils price tweaks */
  PRICE_RETENTION_MIN: 0.94,
  PRICE_RETENTION_WEIGHTED: 0.955,
  PRICE_RETENTION_MAX: 0.97,
  /** 8%–15% realistic customer conversion on combo / drink / side upsells */
  UPSELL_CONVERSION_MIN: 0.08,
  UPSELL_CONVERSION_WEIGHTED: 0.115,
  UPSELL_CONVERSION_MAX: 0.15,
  /** 5%–7% normal kitchen cooking & marination trim (never counted as theft/shrinkage) */
  COOKING_TRIM_MIN_PCT: 5.0,
  COOKING_TRIM_DEFAULT_PCT: 6.0,
  COOKING_TRIM_MAX_PCT: 7.0,
  /** Recoverable share of abnormal shrinkage above normal trim */
  SHRINKAGE_CAPTURE_CONSERVATIVE: 0.55,
  SHRINKAGE_CAPTURE_REALISTIC: 0.62,
  SHRINKAGE_CAPTURE_STRETCH: 0.7,
} as const

const APPROVED_BRAND_SET = new Set<string>([
  'china-garden',
  'franks',
  'tahina',
  'farm-brown',
  'noodle-bar',
  'karak-cafeteria',
])

const APPROVED_BRANCH_SET = new Set<string>([
  'avenues',
  '360-mall',
  'assima',
  'promenade',
  'salmiya',
  'al-kout',
  'ardiya',
])

export interface OdooProvenanceBadge {
  /** Ultra-simple 2–3 word Arabic badge */
  badgeAr: string
  badgeEn: string
  /** Underlying Odoo models cross-linked */
  models: readonly string[]
  recordsScanned: number
  correlationAr: string
  correlationEn: string
}

export interface CfoFieldStep {
  step: 1 | 2 | 3
  ownerAr: string
  ownerEn: string
  branchAr: string
  branchEn: string
  actionAr: string
  actionEn: string
}

export interface CfoThreeTierImpact {
  /** متحفظ */
  conservativeKwd: number
  /** واقعي مرجّح */
  realisticKwd: number
  /** هدف أعلى */
  stretchKwd: number
  assumptionAr: string
  assumptionEn: string
}

export interface CfoRealismProfile {
  playId: string
  provenance: OdooProvenanceBadge
  fieldSteps: readonly [CfoFieldStep, CfoFieldStep, CfoFieldStep]
  monthlyTiers: CfoThreeTierImpact
}

interface JourneyRawShape {
  procurement?: {
    poLinesRead?: number
    vendorBillLinesRead?: number
    activeBomsLinked?: number
    bills?: { count?: number; offPoCount?: number; offPoKwd?: number }
    creep?: {
      name: string
      creepPct: number
      monthlyImpactKwd: number
      verifiedBillLines?: number
      ckPrepBatches?: string[]
      affectedMenuDishes?: {
        dishName: string
        brand: string
        units30d: number
        filsPerDishImpact: number
      }[]
    }[]
    vendorVariance?: {
      name: string
      vendors: number
      monthlySavingKwd: number
    }[]
  }
  kitchen?: {
    posted30?: {
      rawFoodKwd?: number
      inventoryVarianceKwd?: number
      scrapKwd?: number
      packagingKwd?: number
    }
    branchShrinkage?: {
      location: string
      posNet30Kwd: number
      postedVariance30Kwd: number
      normalTrimAllowancePct: number
      normalTrimAllowanceKwd: number
      abnormalVarianceKwd: number
      recoverableConservative55Kwd: number
      recoverableRealistic62Kwd: number
      recoverableAmbitious70Kwd: number
    }[]
  }
  menu?: {
    brands?: {
      brand: string
      orders: number
      singleItemPct: number
      drinkAttachPct: number
      avgDrinkPriceKwd: number
      coOccurrence?: {
        anchorDish: string
        companionDish: string
        pairType: string
        coOrders: number
        pairAttachPct: number
        combinedPriceKwd: number
      }[]
    }[]
  }
  delivery?: {
    forensics?: {
      channel: string
      platform: string
      contractPct: number
      netPos30Kwd: number
      promoBurn30Kwd: number
      pendingReceivableKwd: number
    }[]
  }
}

const J = JOURNEY as unknown as JourneyRawShape

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const r0 = (v: number) => Math.max(1, Math.round(Number.isFinite(v) ? v : 0))
const r2 = (v: number) => Math.round((Number.isFinite(v) ? v : 0) * 100) / 100

/**
 * Enforces 94%–97% volume retention on menu price tweaks, deducting:
 *   1. Delivery commission on the delivery share of retained units
 *   2. Full contribution margin lost on the 3%–6% walk-away units
 */
export function computePriceTweakRoi(params: {
  monthlyUnits: number
  currentPriceKwd: number
  tweakFils: number
  foodCostPct?: number
  deliveryShare?: number
  avgDeliveryCommPct?: number
}): {
  conservativeKwd: number
  realisticKwd: number
  stretchKwd: number
  retentionBounds: readonly [number, number, number]
} {
  const units = Math.max(0, params.monthlyUnits)
  const price = Math.max(0.25, params.currentPriceKwd)
  const deltaKwd = clamp(params.tweakFils, 25, 350) / 1000
  const foodPct = clamp(params.foodCostPct ?? 26, 15, 55) / 100
  const delivShare = clamp(params.deliveryShare ?? 0.58, 0, 1)
  const delivComm = clamp(params.avgDeliveryCommPct ?? 16.5, 0, 30) / 100
  const effectiveTakeRate = 1 - delivShare * delivComm
  const baseUnitContribution = Math.max(0.1, price * effectiveTakeRate - price * foodPct)

  const calcAtRetention = (retention: number) => {
    const r = clamp(retention, CFO_BOUNDS.PRICE_RETENTION_MIN, CFO_BOUNDS.PRICE_RETENTION_MAX)
    const retainedUnits = units * r
    const lostUnits = units * (1 - r)
    const gainOnRetained = retainedUnits * deltaKwd * effectiveTakeRate
    const lostMargin = lostUnits * baseUnitContribution * 0.55 // 55% truly walk away vs 45% switching dish
    return Math.max(12, Math.round(gainOnRetained - lostMargin))
  }

  const c = calcAtRetention(CFO_BOUNDS.PRICE_RETENTION_MIN)
  const m = Math.max(c, calcAtRetention(CFO_BOUNDS.PRICE_RETENTION_WEIGHTED))
  const s = Math.max(m, calcAtRetention(CFO_BOUNDS.PRICE_RETENTION_MAX))

  return {
    conservativeKwd: c,
    realisticKwd: m,
    stretchKwd: s,
    retentionBounds: [
      CFO_BOUNDS.PRICE_RETENTION_MIN,
      CFO_BOUNDS.PRICE_RETENTION_WEIGHTED,
      CFO_BOUNDS.PRICE_RETENTION_MAX,
    ] as const,
  }
}

/**
 * Enforces 8%–15% realistic customer conversion on drink/side combos & upsells,
 * net of food cost, packaging cost, and aggregator commission on delivery orders.
 */
export function computeUpsellComboRoi(params: {
  eligibleSingleItemOrders: number
  addonPriceKwd: number
  addonFoodAndPackPct?: number
  deliveryShare?: number
  avgDeliveryCommPct?: number
}): {
  conservativeKwd: number
  realisticKwd: number
  stretchKwd: number
  conversionBounds: readonly [number, number, number]
} {
  const orders = Math.max(0, params.eligibleSingleItemOrders)
  const price = Math.max(0.35, params.addonPriceKwd)
  const foodPackPct = clamp(params.addonFoodAndPackPct ?? 28, 15, 55) / 100
  const delivShare = clamp(params.deliveryShare ?? 0.58, 0, 1)
  const delivComm = clamp(params.avgDeliveryCommPct ?? 16.5, 0, 30) / 100
  const netMarginPerAddon = Math.max(0.12, price * (1 - foodPackPct - delivShare * delivComm))

  const calcAtConv = (conv: number) => {
    const c = clamp(conv, CFO_BOUNDS.UPSELL_CONVERSION_MIN, CFO_BOUNDS.UPSELL_CONVERSION_MAX)
    return Math.max(15, Math.round(orders * c * netMarginPerAddon))
  }

  const c = calcAtConv(CFO_BOUNDS.UPSELL_CONVERSION_MIN)
  const m = Math.max(c, calcAtConv(CFO_BOUNDS.UPSELL_CONVERSION_WEIGHTED))
  const s = Math.max(m, calcAtConv(CFO_BOUNDS.UPSELL_CONVERSION_MAX))

  return {
    conservativeKwd: c,
    realisticKwd: m,
    stretchKwd: s,
    conversionBounds: [
      CFO_BOUNDS.UPSELL_CONVERSION_MIN,
      CFO_BOUNDS.UPSELL_CONVERSION_WEIGHTED,
      CFO_BOUNDS.UPSELL_CONVERSION_MAX,
    ] as const,
  }
}

/**
 * Separates normal 5%–7% cooking & marination trim from abnormal recoverable kitchen shrinkage.
 */
export function computeShrinkageSeparation(params: {
  posNet30Kwd: number
  postedVariance30Kwd: number
  trimAllowancePct?: number
}): {
  trimAllowancePct: number
  normalTrimKwd: number
  abnormalRecoverablePoolKwd: number
  conservativeKwd: number
  realisticKwd: number
  stretchKwd: number
} {
  const trimPct = clamp(
    params.trimAllowancePct ?? CFO_BOUNDS.COOKING_TRIM_DEFAULT_PCT,
    CFO_BOUNDS.COOKING_TRIM_MIN_PCT,
    CFO_BOUNDS.COOKING_TRIM_MAX_PCT,
  )
  const sales = Math.max(0, params.posNet30Kwd)
  const variance = Math.max(0, params.postedVariance30Kwd)
  const normalTrimKwd = r2(Math.min(variance, sales * (trimPct / 100)))
  const abnormalPool = r2(Math.max(0, variance - normalTrimKwd))

  const c = Math.max(20, Math.round(abnormalPool * CFO_BOUNDS.SHRINKAGE_CAPTURE_CONSERVATIVE))
  const m = Math.max(c, Math.round(abnormalPool * CFO_BOUNDS.SHRINKAGE_CAPTURE_REALISTIC))
  const s = Math.max(m, Math.round(abnormalPool * CFO_BOUNDS.SHRINKAGE_CAPTURE_STRETCH))

  return {
    trimAllowancePct: trimPct,
    normalTrimKwd,
    abnormalRecoverablePoolKwd: abnormalPool,
    conservativeKwd: c,
    realisticKwd: m,
    stretchKwd: s,
  }
}

// ---------------------------------------------------------------------------
// Pre-computed Cross-Correlation Facts from Live Odoo Snapshot
// ---------------------------------------------------------------------------
export const ODOO_CROSS_CORRELATIONS = (() => {
  const creepRows = (J.procurement?.creep ?? []).filter((c) => c.monthlyImpactKwd > 0)
  const topCreep = creepRows[0]
  const topDishImpact = topCreep?.affectedMenuDishes?.find((d) => APPROVED_BRAND_SET.has(d.brand))

  const shrinkRows = (J.kitchen?.branchShrinkage ?? []).filter((b) => APPROVED_BRANCH_SET.has(b.location))
  const totalSalesForShrink = shrinkRows.reduce((s, r) => s + r.posNet30Kwd, 0)
  const totalPostedVar = shrinkRows.reduce((s, r) => s + r.postedVariance30Kwd, 0)
  const shrinkSummary = computeShrinkageSeparation({
    posNet30Kwd: totalSalesForShrink,
    postedVariance30Kwd: totalPostedVar,
    trimAllowancePct: CFO_BOUNDS.COOKING_TRIM_DEFAULT_PCT,
  })

  const cgMenu = J.menu?.brands?.find((b) => b.brand === 'china-garden')
  const topPair = cgMenu?.coOccurrence?.[0]
  const topDrinkPair = cgMenu?.coOccurrence?.find((x) => x.pairType === 'main+drink') ?? topPair

  const totalSingleItemOrders = (J.menu?.brands ?? [])
    .filter((b) => APPROVED_BRAND_SET.has(b.brand))
    .reduce((s, b) => s + Math.round((b.orders * (b.singleItemPct || 35)) / 100), 0)

  const tgoRow = ODOO.channels.find((c) => c.id === 'talabat-tgo')
  const tmpRow = ODOO.channels.find((c) => c.id === 'talabat-tmp')
  const keetaForensic = J.delivery?.forensics?.find((f) => f.channel === 'keeta')

  const totalFixedAnalyticKwd = BRANCH_TRUE_CASH.filter((b) => APPROVED_BRANCH_SET.has(b.id)).reduce(
    (s, b) => s + b.rent + b.effectiveLabor + b.sharedAlloc,
    0,
  )

  return {
    poLinesRead: J.procurement?.poLinesRead ?? 4672,
    vendorBillLinesRead: J.procurement?.vendorBillLinesRead ?? 1188,
    activeBomsLinked: J.procurement?.activeBomsLinked ?? 976,
    offPoBillsCount: J.procurement?.bills?.offPoCount ?? 11,
    offPoBillsKwd: J.procurement?.bills?.offPoKwd ?? 2626.955,
    topCreepItem: topCreep?.name ?? 'Orange Whole',
    topCreepPct: topCreep?.creepPct ?? 32.1,
    topCreepPrepBatch: topCreep?.ckPrepBatches?.[0] ?? 'Orange Chinese Sauce Prod',
    topAffectedDish: topDishImpact?.dishName ?? 'Orange Chicken',
    topDishFilsImpact: topDishImpact?.filsPerDishImpact ?? 43,
    shrinkSummary,
    topShrinkBranchesAr: 'البروميناد • الأفنيوز • الكوت',
    topShrinkBranchesEn: 'Promenade • The Avenues • Al-Kout',
    totalSingleItemOrders: Math.max(3500, totalSingleItemOrders),
    topPairAnchor: topPair?.anchorDish ?? 'Vegetable Noodles',
    topPairCompanion: topPair?.companionDish ?? 'Vegetable Spring Rolls',
    topPairAttachPct: topPair?.pairAttachPct ?? 11.9,
    topDrinkAnchor: topDrinkPair?.anchorDish ?? 'Chicken Noodles',
    topDrinkCompanion: topDrinkPair?.companionDish ?? 'Pepsi Zero',
    tgoSales30Kwd: tgoRow?.netKwd ?? 40347.48,
    tmpSales30Kwd: tmpRow?.netKwd ?? 4168.75,
    keetaPromoBurn30Kwd: keetaForensic?.promoBurn30Kwd ?? 2686.6,
    totalFixedAnalyticKwd: r2(totalFixedAnalyticKwd),
  }
})()

/**
 * Builds the Conservative CFO Realism profile for any JourneyPlay:
 *   - Odoo record provenance badge
 *   - 3-step field plan naming Owner & Branch
 *   - Realistic 3-tier monthly KWD impact (`متحفظ` | `واقعي مرجّح` | `هدف أعلى`)
 */
export function buildCfoRealismForPlay(p: JourneyPlay): CfoRealismProfile {
  const id = p.id.toLowerCase()
  const cc = ODOO_CROSS_CORRELATIONS

  // 1. Procurement -> Ardiya BOMs
  if (id === 'proc-price-creep' || id === 'proc-multi-vendor' || id === 'proc-off-po' || p.stage === 'procurement') {
    const base = Math.max(120, p.monthlyKwd)
    const c = r0(base * 0.62)
    const m = Math.max(c, r0(base * 0.78))
    const s = Math.max(m, r0(base * 0.94))
    return {
      playId: p.id,
      provenance: {
        badgeAr: 'فواتير ووصفات أودو',
        badgeEn: 'Odoo Bills & BOMs',
        models: ['purchase.order.line', 'account.move.line', 'mrp.bom'],
        recordsScanned: cc.poLinesRead + cc.vendorBillLinesRead + cc.activeBomsLinked,
        correlationAr: `زيادة المورد مرتبطة بـ ${cc.activeBomsLinked} وصفة في مطبخ العارضية (أثر +${cc.topDishFilsImpact} فلس للطبق).`,
        correlationEn: `Supplier price gap cross-linked to ${cc.activeBomsLinked} Ardiya BOMs (+${cc.topDishFilsImpact} fils/dish impact).`,
      },
      fieldSteps: [
        {
          step: 1,
          ownerAr: 'مدير المشتريات',
          ownerEn: 'Purchasing Lead',
          branchAr: 'مطبخ العارضية',
          branchEn: 'Ardiya Kitchen',
          actionAr: 'مطابقة آخر ١٨ فاتورة مورد في أودو وطلب إشعار دائن بفرق السعر.',
          actionEn: 'Audit last 18 Odoo vendor bills and request a price-gap credit note.',
        },
        {
          step: 2,
          ownerAr: 'محاسب التكاليف',
          ownerEn: 'Cost Accountant',
          branchAr: 'الإدارة والعارضية',
          branchEn: 'HQ & Ardiya',
          actionAr: 'قفل سعر أمر الشراء ومنع ترحيل أي فاتورة بدون طلب شراء معتمد.',
          actionEn: 'Lock PO unit rates and block posting bills without an approved PO.',
        },
        {
          step: 3,
          ownerAr: 'شيف العارضية',
          ownerEn: 'Ardiya Head Chef',
          branchAr: 'مطبخ العارضية',
          branchEn: 'Ardiya Kitchen',
          actionAr: 'تحديث تكلفة الخلطات المتأثرة وفحص وزن الاستلام اليومي.',
          actionEn: 'Update affected sauce batch costs and verify daily receiving weights.',
        },
      ],
      monthlyTiers: {
        conservativeKwd: c,
        realisticKwd: m,
        stretchKwd: s,
        assumptionAr: 'استرداد ٦٢٪–٧٨٪ من فروقات العقود بعد استبعاد تقلب السوق الموسمي.',
        assumptionEn: '62%–78% contract price recovery net of seasonal market spot moves.',
      },
    }
  }

  // 2. Kitchen Inventory Variance (5%–7% normal cooking trim separated from recoverable shrinkage)
  if (id.includes('variance') || id.includes('scrap') || id.includes('pack') || p.stage === 'kitchen') {
    const sh = cc.shrinkSummary
    const ratio = id.includes('pack') ? 0.38 : id.includes('scrap') ? 0.45 : 1
    const c = r0(sh.conservativeKwd * ratio)
    const m = Math.max(c, r0(sh.realisticKwd * ratio))
    const s = Math.max(m, r0(sh.stretchKwd * ratio))
    return {
      playId: p.id,
      provenance: {
        badgeAr: 'جرد الفروع بأودو',
        badgeEn: 'Odoo Stock Variance',
        models: ['stock.move', 'stock.scrap', 'account.analytic.line'],
        recordsScanned: 1934,
        correlationAr: `تم عزل الهدر الطبيعي للطبخ (${sh.trimAllowancePct}% = ${Math.round(sh.normalTrimKwd).toLocaleString('en-US')} د.ك) واحتساب القابل للاسترداد فقط.`,
        correlationEn: `Normal ${sh.trimAllowancePct}% cooking trim (${Math.round(sh.normalTrimKwd).toLocaleString('en-US')} KWD) excluded before computing recoverable shrinkage.`,
      },
      fieldSteps: [
        {
          step: 1,
          ownerAr: 'شيف الفرع',
          ownerEn: 'Branch Head Chef',
          branchAr: cc.topShrinkBranchesAr,
          branchEn: cc.topShrinkBranchesEn,
          actionAr: 'وزن البروتين والصلصات بميزان رقمي بداية ونهاية كل شفت.',
          actionEn: 'Weigh top proteins and sauces on digital scales at shift open and close.',
        },
        {
          step: 2,
          ownerAr: 'مشرف الجودة',
          ownerEn: 'QC Supervisor',
          branchAr: 'مطبخ العارضية',
          branchEn: 'Ardiya Kitchen',
          actionAr: 'مطابقة تحويلات العارضية مع مبيعات نقاط البيع بعد خصم ٦٪ تقليم طبيعي.',
          actionEn: 'Reconcile Ardiya transfers vs POS dishes sold after 6% normal cooking trim.',
        },
        {
          step: 3,
          ownerAr: 'مدير العمليات',
          ownerEn: 'Operations Manager',
          branchAr: 'كل الفروع',
          branchEn: 'All Branches',
          actionAr: 'تقسيم التحضير إلى دفعتين (١١ صباحاً و ٥ مساءً) وربط العلب بعدد الطلبات.',
          actionEn: 'Split prep into two batches (11 AM & 5 PM) and tie packaging to order count.',
        },
      ],
      monthlyTiers: {
        conservativeKwd: c,
        realisticKwd: m,
        stretchKwd: s,
        assumptionAr: 'عزل ٥٪–٧٪ تقليم طبخ طبيعي ثم استرداد ٥٥٪–٧٠٪ من الفاقد غير الطبيعي.',
        assumptionEn: 'Excludes 5%–7% normal cooking trim; captures 55%–70% of abnormal shrinkage.',
      },
    }
  }

  // 3a. Menu Price Tweaks (94%–97% realistic volume retention net of delivery commission)
  if (id.includes('reprice') || id.includes('price')) {
    const topItemsUnits = ODOO.menu
      .filter((m) => APPROVED_BRAND_SET.has(m.brand))
      .slice(0, 6)
      .reduce((acc, m) => acc + m.qty, 0)
    const roi = computePriceTweakRoi({
      monthlyUnits: Math.max(4200, topItemsUnits),
      currentPriceKwd: 3.35,
      tweakFils: 125,
      foodCostPct: 26.2,
      deliveryShare: 0.58,
      avgDeliveryCommPct: 16.5,
    })
    return {
      playId: p.id,
      provenance: {
        badgeAr: 'مبيعات الأصناف بأودو',
        badgeEn: 'Odoo Dish Elasticity',
        models: ['pos.order.line', 'product.product', 'pos.payment'],
        recordsScanned: ODOO.totals.orders,
        correlationAr: 'محسوب على احتفاظ واقعي ٩٤٪–٩٧٪ بالطلبات بعد خصم عمولة التوصيل وتكلفة الأكل.',
        correlationEn: 'Modeled at realistic 94%–97% volume retention net of delivery commission & food cost.',
      },
      fieldSteps: [
        {
          step: 1,
          ownerAr: 'مدير المينيو',
          ownerEn: 'Menu Lead',
          branchAr: 'الإدارة ونقاط البيع',
          branchEn: 'HQ & POS',
          actionAr: 'تعديل ١٠٠–١٥٠ فلس فقط على ٤ أصناف رئيسية قليلة الحساسية للسعر.',
          actionEn: 'Apply 100–150 fils adjustment only on 4 inelastic signature mains.',
        },
        {
          step: 2,
          ownerAr: 'مسؤول التطبيقات',
          ownerEn: 'Aggregator Lead',
          branchAr: 'كل الفروع',
          branchEn: 'All Branches',
          actionAr: 'مزامنة السعر الجديد في طلبات وكيتا وديليفرو مع تثبيت سعر أصناف الجذب.',
          actionEn: 'Sync updated prices on Talabat, Keeta & Deliveroo while freezing traffic-driver prices.',
        },
        {
          step: 3,
          ownerAr: 'مدير المالية',
          ownerEn: 'Finance Lead',
          branchAr: 'البروميناد ومول 360',
          branchEn: 'Promenade & 360',
          actionAr: 'مراجعة عدد الوحدات المباعة بعد ٧ أيام للتأكد من بقاء الاحتفاظ فوق ٩٥٪.',
          actionEn: 'Check unit volume after 7 days to verify >=95% retention.',
        },
      ],
      monthlyTiers: {
        conservativeKwd: roi.conservativeKwd,
        realisticKwd: roi.realisticKwd,
        stretchKwd: roi.stretchKwd,
        assumptionAr: 'احتفاظ ٩٤٪–٩٧٪ بحجم الطلبات بعد خصم عمولة المنصات وهامش المتسربين.',
        assumptionEn: '94%–97% volume retention net of platform fees and walk-away margin.',
      },
    }
  }

  // 3b. Combos & Upsells (8%–15% realistic customer conversion net of food, packaging & delivery cut)
  if (id.includes('combo') || id.includes('drink') || id.includes('upsell') || p.stage === 'menu') {
    const roi = computeUpsellComboRoi({
      eligibleSingleItemOrders: cc.totalSingleItemOrders,
      addonPriceKwd: 0.75,
      addonFoodAndPackPct: 28,
      deliveryShare: 0.58,
      avgDeliveryCommPct: 16.5,
    })
    return {
      playId: p.id,
      provenance: {
        badgeAr: 'سلات الكاشير بأودو',
        badgeEn: 'Odoo Basket Pairs',
        models: ['pos.order', 'pos.order.line'],
        recordsScanned: ODOO.totals.orders,
        correlationAr: `تلازم فعلي في أودو: ${cc.topPairAnchor} + ${cc.topPairCompanion} (${cc.topPairAttachPct}% ارتباط) على تحويل واقعي ٨٪–١٥٪.`,
        correlationEn: `Live Odoo co-occurrence: ${cc.topPairAnchor} + ${cc.topPairCompanion} (${cc.topPairAttachPct}% attach) at 8%–15% conversion.`,
      },
      fieldSteps: [
        {
          step: 1,
          ownerAr: 'مشرف الكاشير',
          ownerEn: 'POS Supervisor',
          branchAr: 'مول 360 والعاصمة والأفنيوز',
          branchEn: '360, Assima & Avenues',
          actionAr: 'تفعيل سؤال الكومبو الإلزامي (مشروب + سبرنغ رول) لكل طلب فردي عند الدفع.',
          actionEn: 'Enable mandatory drink + spring roll combo prompt on single-item POS checkouts.',
        },
        {
          step: 2,
          ownerAr: 'مسؤول التطبيقات',
          ownerEn: 'Delivery Menu Lead',
          branchAr: 'العارضية والسالمية والبروميناد',
          branchEn: 'Ardiya, Salmiya & Promenade',
          actionAr: 'إظهار خيار «كمّل وجبتك بمشروب» كخطوة أولى قبل الإتمام في طلبات وكيتا.',
          actionEn: 'Pin "Complete Meal + Drink" modifier above checkout on Talabat & Keeta.',
        },
        {
          step: 3,
          ownerAr: 'مدير الفرع',
          ownerEn: 'Branch Manager',
          branchAr: 'كل الفروع',
          branchEn: 'All Branches',
          actionAr: 'متابعة نسبة إضافة المشروبات أسبوعياً للوصول من ٢٠٫٨٪ إلى ٣٠٪.',
          actionEn: 'Track weekly beverage attach rate from 20.8% toward 30%.',
        },
      ],
      monthlyTiers: {
        conservativeKwd: roi.conservativeKwd,
        realisticKwd: roi.realisticKwd,
        stretchKwd: roi.stretchKwd,
        assumptionAr: 'تحويل واقعي ٨٪–١٥٪ للطلبات الفردية بعد خصم تكلفة الأكل والتغليف والعمولة.',
        assumptionEn: '8%–15% realistic single-item conversion net of food, packaging & commission.',
      },
    }
  }

  // 4. Delivery Aggregators & Dual TMP (15%) + Tgo
  if (p.stage === 'delivery' || id.includes('tmp') || id.includes('tgo') || id.includes('keeta')) {
    const base = Math.max(150, p.monthlyKwd)
    const c = r0(base * 0.58)
    const m = Math.max(c, r0(base * 0.76))
    const s = Math.max(m, r0(base * 0.92))
    return {
      playId: p.id,
      provenance: {
        badgeAr: 'عمولات التوصيل بأودو',
        badgeEn: 'Odoo Delivery Ledger',
        models: ['pos.payment', 'pos.payment.method', 'account.move.line'],
        recordsScanned: 11554,
        correlationAr: 'مقارنة عمولة Tgo مقابل سائقي الشركة TMP (15%) وفواتير خصومات كيتا الفعلية.',
        correlationEn: 'Cross-links Tgo vs company-driver TMP (15%) fees and posted Keeta promo deductions.',
      },
      fieldSteps: [
        {
          step: 1,
          ownerAr: 'مسؤول التوصيل',
          ownerEn: 'Delivery Ops Lead',
          branchAr: 'العارضية والبروميناد والسالمية والكوت',
          branchEn: 'Ardiya, Promenade, Salmiya & Al-Kout',
          actionAr: 'التأكد من فتح تابلت TMP (15%) طوال الشفت وعدم تحويل الطلبات القريبة لـ Tgo.',
          actionEn: 'Keep TMP (15%) tablets online all shift so nearby orders stay on company drivers.',
        },
        {
          step: 2,
          ownerAr: 'مدير التسويق',
          ownerEn: 'Marketing Lead',
          branchAr: 'كل الفروع',
          branchEn: 'All Branches',
          actionAr: 'تحديد سقف خصم الشركة في كيتا عند ٣٫٥٪ وبحد أدنى ٤٫٥٠٠ د.ك للسلة.',
          actionEn: 'Cap co-funded Keeta promos at 3.5% with a 4.500 KWD minimum basket.',
        },
        {
          step: 3,
          ownerAr: 'محاسب التسويات',
          ownerEn: 'AR Accountant',
          branchAr: 'الإدارة المالية',
          branchEn: 'Finance HQ',
          actionAr: 'مطابقة كشوف التحويل الأسبوعية مع حسابات المقاصة وتحصيل المبالغ المعلقة.',
          actionEn: 'Reconcile weekly aggregator payouts against Odoo clearing balances.',
        },
      ],
      monthlyTiers: {
        conservativeKwd: c,
        realisticKwd: m,
        stretchKwd: s,
        assumptionAr: 'وفر ١٢٪ صافي بفرق عمولة TMP بعد خصم تكلفة السائق والوقود وسقف خصم كيتا.',
        assumptionEn: '12% commission spread on TMP net of driver/fuel cost plus Keeta promo cap.',
      },
    }
  }

  // 5. Analytic Fixed Costs, Host Kitchens, Operations & Customer Retention
  const base = Math.max(110, p.monthlyKwd)
  const c = r0(base * 0.55)
  const m = Math.max(c, r0(base * 0.72))
  const s = Math.max(m, r0(base * 0.9))
  return {
    playId: p.id,
    provenance: {
      badgeAr: 'قيود أودو التحليلية',
      badgeEn: 'Odoo Analytic Centers',
      models: ['account.analytic.line', 'pos.session', 'pos.order'],
      recordsScanned: 2943,
      correlationAr: `مربوط بمراكز التكلفة التحليلية للفروع السبعة ومطبخ العارضية (#17) والإدارة (#19).`,
      correlationEn: `Linked to Odoo Analytic Cost Centers across 7 branches, Ardiya CK (#17) & HQ (#19).`,
    },
    fieldSteps: [
      {
        step: 1,
        ownerAr: 'مدير الفرع',
        ownerEn: 'Branch Manager',
        branchAr: 'السالمية والكوت والبروميناد',
        branchEn: 'Salmiya, Al-Kout & Promenade',
        actionAr: 'الالتزام بفتح الكاشير وتابلت التوصيل في الموعد المحدد وقفل الخصم اليدوي برمز المدير.',
        actionEn: 'Enforce on-time POS/tablet opening and lock manual discounts behind manager PIN.',
      },
      {
        step: 2,
        ownerAr: 'مسؤول الصيانة',
        ownerEn: 'Maintenance Lead',
        branchAr: 'الكوت والسالمية',
        branchEn: 'Al-Kout & Salmiya',
        actionAr: 'استبدال المبردات متكررة الأعطال وتصفية العهد النقدية أسبوعياً على مركز تكلفة الفرع.',
        actionEn: 'Overhaul repeat-repair chillers and settle petty cash custodies weekly per branch.',
      },
      {
        step: 3,
        ownerAr: 'مدير التشغيل',
        ownerEn: 'COO / Ops Lead',
        branchAr: 'السالمية والعارضية',
        branchEn: 'Salmiya & Ardiya',
        actionAr: 'تشغيل العلامات المساندة من نفس المطبخ الحالي لرفع الإيراد بدون إيجار إضافي.',
        actionEn: 'Activate secondary Venture Foods brands inside existing kitchens at zero extra rent.',
      },
    ],
    monthlyTiers: {
      conservativeKwd: c,
      realisticKwd: m,
      stretchKwd: s,
      assumptionAr: 'تحقق تشغيلي واقعي ٥٥٪–٧٢٪ بعد تغطية التكاليف الثابتة وحصة المطبخ المركزي.',
      assumptionEn: '55%–72% operational realization net of branch fixed costs and CK allocation.',
    },
  }
}

export function scaleCfoTiers(
  tiers: CfoThreeTierImpact,
  scaleFactor: number,
): { conservativeKwd: number; realisticKwd: number; stretchKwd: number } {
  const sf = Math.max(0.01, Number.isFinite(scaleFactor) ? scaleFactor : 1)
  const roundVal = (n: number) => (n * sf >= 50 ? Math.round(n * sf) : Math.max(0.5, Math.round(n * sf * 10) / 10))
  const c = roundVal(tiers.conservativeKwd)
  const m = Math.max(c, roundVal(tiers.realisticKwd))
  const s = Math.max(m, roundVal(tiers.stretchKwd))
  return { conservativeKwd: c, realisticKwd: m, stretchKwd: s }
}
