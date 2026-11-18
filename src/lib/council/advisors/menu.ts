/**
 * Menu & discounts advisor — real POS product lines (pos.order.line grouped by product).
 *
 * Within each brand, dishes are classified (Kasavana–Smith) on popularity × value. Value is the unit
 * contribution margin only when Odoo holds a cost for every dish of that brand; otherwise it is the
 * average selling price, and the report says so (never a mix, never an invented cost).
 *
 * Proposals are tests, not orders: a small price step on the most popular low-value dish (with the
 * elasticity assumption shown), visibility for high-value dishes few people order, a review of dishes
 * that are neither, and the dishes whose sales lean on discounts.
 */
import type { OdooPeriodCube, OdooPeriodCubeProductRow } from '@/lib/odoo-live-connector'
import { engineerMenu, type MenuAnalysis, type MenuItemResult } from '../analytics'
import { brandLabel, clamp01, estimate, evidence, r1 } from '../helpers'
import type { Advisor, AdvisorReport, CouncilDataGap, CouncilFinding } from '../types'

export interface MenuInput {
  cube?: OdooPeriodCube | null
  /** productId → unit cost from Odoo (standard price / valuation layer / purchase), when known. */
  productCosts?: Record<number, { unitCostKwd: number }> | null
}

const LINES = 'pos.order.line'
/** Price-step test: +5% of the average price, rounded to 0.025 KWD, at least 0.050 KWD. */
export const PRICE_STEP_PCT = 5
/** Assumed own-price elasticity for a popular staple dish (volume falls 0.5% per 1% price). */
export const ASSUMED_ELASTICITY = 0.5
export const DISCOUNT_DEPENDENCE = 0.3

export interface BrandMenu {
  brandId: string
  analysis: MenuAnalysis
  /** 'all' when every product line of the period was read; 'top' when only the top 50 were available. */
  coverage: 'all' | 'top'
}

export function menuByBrand(cube: OdooPeriodCube | null | undefined, costs?: MenuInput['productCosts']): BrandMenu[] {
  if (!cube?.connected) return []
  const rows: OdooPeriodCubeProductRow[] = cube.menuProducts ?? cube.topProducts ?? []
  const coverage: BrandMenu['coverage'] = cube.menuProducts ? 'all' : 'top'
  const byBrand = new Map<string, OdooPeriodCubeProductRow[]>()
  for (const r of rows) byBrand.set(r.brandId, [...(byBrand.get(r.brandId) ?? []), r])
  const out: BrandMenu[] = []
  for (const [brandId, list] of [...byBrand.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const analysis = engineerMenu(
      list.map((p) => ({ productId: p.productId, name: p.name, brandId, qty: p.qty, netKwd: p.netKwd, discountKwd: p.discountKwd, unitCostKwd: costs?.[p.productId]?.unitCostKwd ?? null })),
    )
    if (analysis) out.push({ brandId, analysis, coverage })
  }
  return out
}

const round025 = (n: number) => Math.round(n / 0.025) * 0.025

function repriceFinding(m: BrandMenu, it: MenuItemResult, days: number, period: { from: string; to: string }, syncAt: string | null): CouncilFinding {
  const brand = brandLabel(m.brandId)
  const step = Math.max(0.05, round025((it.avgPriceKwd * PRICE_STEP_PCT) / 100))
  const stepPct = (step / it.avgPriceKwd) * 100
  const weeklyQty = (it.qty * 7) / days
  const factor = (1 + stepPct / 100) * (1 - (ASSUMED_ELASTICITY * stepPct) / 100) - 1
  const weeklyGain = weeklyQty * it.avgPriceKwd * factor
  return {
    fingerprint: `menu:reprice:${it.productId}`,
    advisorId: 'menu',
    kind: 'menu-reprice',
    entities: { brandId: m.brandId },
    titleAr: `${it.name} (${brand.ar}) يُطلب بكثرة بسعر أقل من متوسط العلامة — اختبار زيادة ${step.toFixed(3)} د.ك`,
    titleEn: `${it.name} (${brand.en}) sells in volume below the brand's average value — test +${step.toFixed(3)} KWD`,
    evidence: [
      evidence({ odooModel: LINES, domain: `product_id=${it.productId}`, period, value: it.qty, unit: 'count', syncAt, labelAr: 'الكمية المباعة', labelEn: 'Quantity sold' }),
      evidence({ odooModel: LINES, domain: `product_id=${it.productId}`, period, value: it.netKwd, unit: 'KWD', syncAt, labelAr: 'صافي مبيعات الصنف', labelEn: 'Dish net sales' }),
      evidence({ odooModel: LINES, domain: `product_id=${it.productId}`, period, value: r1(it.qtyShare * 100), unit: 'pct', syncAt, labelAr: `نصيبه من كمية ${brand.ar}`, labelEn: `Share of ${brand.en} quantity` }),
      evidence({ odooModel: LINES, domain: `product_id=${it.productId}, net ÷ qty`, period, value: it.avgPriceKwd, unit: 'KWD/unit', syncAt, labelAr: 'متوسط سعر البيع الفعلي', labelEn: 'Actual average selling price' }),
    ],
    thresholds: { priceStepPct: PRICE_STEP_PCT, assumedElasticity: ASSUMED_ELASTICITY },
    rootCause: {
      ar: `صنف "حصان عمل": شعبيته أعلى من الحد (${r1(m.analysis.popularityThreshold * 100).toFixed(1)}% من الكمية) وقيمته للوحدة أقل من متوسط العلامة${m.analysis.basis === 'margin' ? ' (هامش الربح)' : ' (سعر البيع — التكلفة غير مسجلة لكل الأصناف)'}. زيادة صغيرة على صنف مطلوب نادراً ما تُفقد زبائن.`,
      en: `A "plowhorse": popularity above the threshold (${r1(m.analysis.popularityThreshold * 100).toFixed(1)}% of quantity) with unit value below the brand average${m.analysis.basis === 'margin' ? ' (margin)' : ' (selling price — cost is not recorded for every dish)'}. A small step on a dish people already want rarely loses customers.`,
    },
    severity: weeklyGain >= 50 ? 'medium' : 'low',
    novelty: clamp01(it.qtyShare * 4),
    weeklyImpact: estimate(weeklyGain, 'KWD', 'weekly qty × price × ((1 + step%) × (1 − elasticity × step%) − 1)', { weeklyQty: r1(weeklyQty), avgPriceKwd: it.avgPriceKwd, priceStepKwd: step, elasticity: ASSUMED_ELASTICITY }),
    proposals: [
      {
        who: { ar: `مدير علامة ${brand.ar}`, en: `${brand.en} brand manager` },
        what: { ar: `رفع سعر ${it.name} بـ${step.toFixed(3)} د.ك في فرع واحد لمدة أسبوعين ومقارنة الكمية بنفس الأيام قبلها (يقاس تلقائياً في غرفة القرار)`, en: `raise ${it.name} by ${step.toFixed(3)} KWD in one branch for two weeks and compare quantity with the same days before (measured automatically in the Decision Room)` },
        when: { ar: 'بداية الأسبوع القادم', en: 'start of next week' },
        expectedImpact: estimate(weeklyGain, 'KWD', 'weekly qty × price × ((1 + step%) × (1 − elasticity × step%) − 1)', { weeklyQty: r1(weeklyQty), avgPriceKwd: it.avgPriceKwd, priceStepKwd: step, elasticity: ASSUMED_ELASTICITY }),
      },
    ],
  }
}

function puzzleFinding(m: BrandMenu, it: MenuItemResult, days: number, period: { from: string; to: string }, syncAt: string | null): CouncilFinding {
  const brand = brandLabel(m.brandId)
  const totalQty = m.analysis.items.reduce((s, r) => s + r.qty, 0)
  const gapQty = Math.max(0, (m.analysis.popularityThreshold - it.qtyShare) * totalQty)
  const weeklyGain = ((gapQty * 7) / days) * it.avgPriceKwd * 0.5
  return {
    fingerprint: `menu:promote:${it.productId}`,
    advisorId: 'menu',
    kind: 'menu-promote',
    entities: { brandId: m.brandId },
    titleAr: `${it.name} (${brand.ar}) قيمته عالية لكن قليلون يطلبونه — فرصة إبراز`,
    titleEn: `${it.name} (${brand.en}) is high-value but few people order it — a visibility opportunity`,
    evidence: [
      evidence({ odooModel: LINES, domain: `product_id=${it.productId}`, period, value: it.qty, unit: 'count', syncAt, labelAr: 'الكمية المباعة', labelEn: 'Quantity sold' }),
      evidence({ odooModel: LINES, domain: `product_id=${it.productId}, net ÷ qty`, period, value: it.avgPriceKwd, unit: 'KWD/unit', syncAt, labelAr: 'متوسط سعر البيع الفعلي', labelEn: 'Actual average selling price' }),
      evidence({ odooModel: LINES, domain: `product_id=${it.productId}`, period, value: r1(it.qtyShare * 100), unit: 'pct', syncAt, labelAr: `نصيبه من كمية ${brand.ar}`, labelEn: `Share of ${brand.en} quantity` }),
    ],
    thresholds: { popularityThresholdPct: r1(m.analysis.popularityThreshold * 100) },
    rootCause: {
      ar: 'صنف "لغز": قيمة الوحدة أعلى من متوسط العلامة والطلب عليه منخفض — غالباً بسبب ظهوره (موقعه في المنيو/المنصة، الصورة، الاسم) لا بسبب جودته.',
      en: 'A "puzzle": unit value above the brand average with low demand — usually a visibility issue (menu / platform position, photo, name), not quality.',
    },
    severity: 'low',
    novelty: clamp01((m.analysis.popularityThreshold - it.qtyShare) / m.analysis.popularityThreshold),
    weeklyImpact: estimate(weeklyGain, 'KWD', '50% × (threshold share − dish share) × total qty × 7 ÷ days × price', { thresholdSharePct: r1(m.analysis.popularityThreshold * 100), dishSharePct: r1(it.qtyShare * 100), totalQty: r1(totalQty), days, avgPriceKwd: it.avgPriceKwd }),
    proposals: [
      {
        who: { ar: 'مدير التسويق', en: 'Marketing manager' },
        what: { ar: `نقل ${it.name} إلى أعلى القائمة على المنصات مع صورة جديدة واقتراحه من الكاشير لمدة أسبوعين`, en: `move ${it.name} to the top of the platform menu with a new photo and have cashiers suggest it for two weeks` },
        when: { ar: 'هذا الأسبوع', en: 'this week' },
        expectedImpact: null,
      },
    ],
  }
}

function dogsFinding(m: BrandMenu, dogs: MenuItemResult[], period: { from: string; to: string }, syncAt: string | null): CouncilFinding {
  const brand = brandLabel(m.brandId)
  const brandNet = m.analysis.items.reduce((s, r) => s + r.netKwd, 0)
  const dogsNet = dogs.reduce((s, r) => s + r.netKwd, 0)
  const sharePct = brandNet > 0 ? r1((dogsNet / brandNet) * 100) : 0
  const names = dogs.slice(0, 5).map((d) => d.name).join('، ')
  return {
    fingerprint: `menu:simplify:${m.brandId}`,
    advisorId: 'menu',
    kind: 'menu-simplify',
    entities: { brandId: m.brandId },
    titleAr: `${dogs.length} أصناف في ${brand.ar} قليلة الطلب ومنخفضة القيمة معاً (${sharePct.toFixed(1)}% من مبيعاتها)`,
    titleEn: `${dogs.length} ${brand.en} dishes are both low-demand and low-value (${sharePct.toFixed(1)}% of its sales)`,
    evidence: [
      evidence({ odooModel: LINES, domain: `brand=${m.brandId}, class=dog`, period, value: dogs.length, unit: 'count', syncAt, labelAr: 'عدد الأصناف', labelEn: 'Dishes' }),
      evidence({ odooModel: LINES, domain: `brand=${m.brandId}, class=dog`, period, value: dogsNet, unit: 'KWD', syncAt, labelAr: 'صافي مبيعاتها', labelEn: 'Their net sales' }),
      evidence({ odooModel: LINES, domain: `brand=${m.brandId}`, period, value: sharePct, unit: 'pct', syncAt, labelAr: 'نصيبها من مبيعات العلامة', labelEn: 'Share of brand sales' }),
    ],
    thresholds: { maxShareForReviewPct: 5 },
    rootCause: {
      ar: `أصناف مثل: ${names}. كل صنف في المنيو يكلّف مخزوناً وتحضيراً وتدريباً؛ إزالة الضعيف منها تُسرّع المطبخ وتقلل الهدر دون أثر يُذكر على المبيعات.`,
      en: `Dishes such as: ${dogs.slice(0, 5).map((d) => d.name).join(', ')}. Every menu item costs stock, prep and training; removing weak ones speeds the kitchen and cuts waste with little effect on sales.`,
    },
    severity: 'low',
    novelty: clamp01(dogs.length / 15),
    weeklyImpact: null,
    proposals: [
      {
        who: { ar: `مدير علامة ${brand.ar} + الشيف`, en: `${brand.en} brand manager + chef` },
        what: { ar: 'مراجعة القائمة: إزالة أو دمج الأصناف التي لا يحتاجها أحد ولا تكمل طبقاً آخر، وإبقاء ما له دور (أطفال، نباتي)', en: 'review the list: remove or merge dishes nobody needs and that do not complete another dish; keep those with a role (kids, vegetarian)' },
        when: { ar: 'في مراجعة المنيو القادمة', en: 'at the next menu review' },
        expectedImpact: null,
      },
    ],
  }
}

function discountFinding(m: BrandMenu, it: MenuItemResult, days: number, period: { from: string; to: string }, syncAt: string | null): CouncilFinding {
  const brand = brandLabel(m.brandId)
  const weeklyDisc = (it.discountKwd * 7) / days
  const sharePct = r1(it.discountShare * 100)
  return {
    fingerprint: `menu:discount:${it.productId}`,
    advisorId: 'menu',
    kind: 'menu-discount-dependence',
    entities: { brandId: m.brandId },
    titleAr: `${sharePct.toFixed(1)}% من قيمة ${it.name} (${brand.ar}) تُعطى خصماً`,
    titleEn: `${sharePct.toFixed(1)}% of ${it.name}'s (${brand.en}) list value is given away as discount`,
    evidence: [
      evidence({ odooModel: LINES, domain: `product_id=${it.productId}, discount > 0`, period, value: it.discountKwd, unit: 'KWD', syncAt, labelAr: 'قيمة الخصم', labelEn: 'Discount value' }),
      evidence({ odooModel: LINES, domain: `product_id=${it.productId}`, period, value: it.netKwd, unit: 'KWD', syncAt, labelAr: 'صافي مبيعات الصنف', labelEn: 'Dish net sales' }),
      evidence({ odooModel: LINES, domain: `product_id=${it.productId}, discount ÷ (net + discount)`, period, value: sharePct, unit: 'pct', syncAt, labelAr: 'نسبة الخصم من القيمة', labelEn: 'Discount share of value' }),
    ],
    thresholds: { discountDependencePct: DISCOUNT_DEPENDENCE * 100 },
    rootCause: {
      ar: 'مبيعات هذا الصنف تعتمد على الخصم؛ إن لم يجلب الخصم زبائن جدداً أو سلة أكبر فهو تنازل عن الهامش فقط.',
      en: 'This dish leans on discounts; unless the discount brings new customers or a bigger basket, it only gives away margin.',
    },
    severity: weeklyDisc >= 50 ? 'medium' : 'low',
    novelty: clamp01(it.discountShare),
    weeklyImpact: estimate(weeklyDisc * 0.5, 'KWD', '50% × weekly discount on the dish', { weeklyDiscountKwd: Math.round(weeklyDisc * 1000) / 1000, retainedShare: 0.5 }),
    proposals: [
      {
        who: { ar: 'مدير التسويق', en: 'Marketing manager' },
        what: { ar: `إيقاف الخصم على ${it.name} في فرع واحد لمدة أسبوع ومقارنة الكمية والفاتورة مع فرع مماثل أبقى الخصم`, en: `pause the discount on ${it.name} in one branch for a week and compare quantity and basket with a similar branch that kept it` },
        when: { ar: 'الأسبوع القادم', en: 'next week' },
        expectedImpact: estimate(weeklyDisc * 0.5, 'KWD', '50% × weekly discount on the dish', { weeklyDiscountKwd: Math.round(weeklyDisc * 1000) / 1000, retainedShare: 0.5 }),
      },
    ],
  }
}

export const menuAdvisor: Advisor<MenuInput> = {
  id: 'menu',
  domainAr: 'هندسة المنيو والخصومات',
  domainEn: 'Menu engineering & discounts',
  run(input: MenuInput): AdvisorReport {
    const gaps: CouncilDataGap[] = []
    const findings: CouncilFinding[] = []
    const cube = input.cube?.connected ? input.cube : null
    const menus = menuByBrand(cube, input.productCosts)
    if (!cube || menus.length === 0) {
      gaps.push({ odooModel: LINES, missingAr: 'لا توجد سطور مبيعات أصناف (pos.order.line) لفترة مكتملة في هذه البيانات.', missingEn: 'No product sales lines (pos.order.line) for a completed period in this payload.', recordAr: 'قراءة مكعّب الفترة من Odoo (تلقائية عند الاتصال).', recordEn: 'A period-cube read from Odoo (automatic when connected).' })
    } else {
      const period = cube.dateRange
      const syncAt = cube.lastSyncAt ?? null
      const days = Math.max(1, cube.days)
      for (const m of menus) {
        const items = m.analysis.items
        const plow = items.filter((i) => i.cls === 'plowhorse').sort((a, b) => b.qty - a.qty)[0]
        if (plow) findings.push(repriceFinding(m, plow, days, period, syncAt))
        const puzzle = items.filter((i) => i.cls === 'puzzle').sort((a, b) => b.avgPriceKwd * b.qty - a.avgPriceKwd * a.qty)[0]
        if (puzzle) findings.push(puzzleFinding(m, puzzle, days, period, syncAt))
        const dogs = items.filter((i) => i.cls === 'dog').sort((a, b) => a.netKwd - b.netKwd)
        const brandNet = items.reduce((s, r) => s + r.netKwd, 0)
        if (dogs.length >= 3 && dogs.reduce((s, r) => s + r.netKwd, 0) <= brandNet * 0.05) findings.push(dogsFinding(m, dogs, period, syncAt))
        const disc = items.filter((i) => i.discountShare >= DISCOUNT_DEPENDENCE && i.netKwd >= brandNet * 0.01).sort((a, b) => b.discountKwd - a.discountKwd)[0]
        if (disc) findings.push(discountFinding(m, disc, days, period, syncAt))
      }
      const priceBasis = menus.filter((m) => m.analysis.basis === 'price')
      if (priceBasis.length > 0) {
        gaps.push({
          odooModel: 'product.product (standard_price)',
          missingAr: `تكلفة الوحدة غير مسجلة لكل أصناف ${priceBasis.map((m) => brandLabel(m.brandId).ar).join('، ')}؛ التصنيف مبني على سعر البيع لا على هامش الربح.`,
          missingEn: `Unit cost is not recorded for every dish of ${priceBasis.map((m) => brandLabel(m.brandId).en).join(', ')}; the classification uses selling price, not margin.`,
          recordAr: 'تسجيل تكلفة الصنف (Cost) في Odoo أو ربطه بوصفة (BoM) لكل طبق.',
          recordEn: 'Record each dish cost (Cost) in Odoo or link it to a recipe (BoM).',
        })
      }
      if (menus.some((m) => m.coverage === 'top')) {
        gaps.push({ odooModel: LINES, missingAr: 'التحليل على أعلى 50 صنفاً فقط في هذه القراءة؛ الأصناف الأضعف غير مشمولة.', missingEn: 'The analysis covers only the top 50 dishes in this read; weaker dishes are not included.', recordAr: 'قراءة كل سطور الأصناف (تلقائية في تشغيل المجلس الليلي).', recordEn: 'A read of all product lines (automatic in the nightly council run).' })
      }
    }
    // Most valuable first; at most 6 menu findings so one brand does not crowd out the others.
    const ranked = findings.sort((a, b) => (b.weeklyImpact?.value ?? 0) - (a.weeklyImpact?.value ?? 0) || a.fingerprint.localeCompare(b.fingerprint)).slice(0, 6)
    return {
      advisorId: 'menu',
      domainAr: this.domainAr,
      domainEn: this.domainEn,
      period: cube?.dateRange ?? null,
      generatedAt: cube?.lastSyncAt ?? null,
      status: !cube || menus.length === 0 ? 'unavailable' : gaps.length > 0 ? 'partial' : 'ready',
      findings: ranked,
      dataGaps: gaps,
    }
  },
}
