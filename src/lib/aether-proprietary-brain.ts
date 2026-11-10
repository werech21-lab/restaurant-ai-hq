/**
 * Aether BI — proprietary background analytical brain.
 *
 * Runs silently over the whitelisted Odoo data (positive pos.config whitelist, approved Venture Foods
 * brands only) and distils it into executive findings: where the fault is, the immediate fix, the best
 * growth proposal and the expected result. Raw tables never leave this module.
 *
 * Inputs
 *   - src/lib/odoo/odoo-dataset.ts  : POS sales, brands, locations, channels, menu, posted P&L (sync-odoo-live)
 *   - src/lib/odoo/odoo-intel.json  : recipes (BOM × purchase price), supplier price creep, POS session
 *                                     discipline, cancellations, rent & maintenance per location (sync-odoo-intel)
 *
 * Engines
 *   1. Menu engineering matrix (Stars / Plowhorses / Puzzles / Dogs) on dual margins:
 *        CM1 = price − food cost, CM2 = CM1 − price × brand delivery-weighted commission.
 *      Food cost = BOM recipe cost (≥80% priced) calibrated to posted Odoo COGS, otherwise group COGS %.
 *      Popularity threshold = 70% of the brand's average item mix (Kasavana–Smith); margin threshold =
 *      the brand's quantity-weighted average CM2.
 *   2. Delivery & channel margin engine: promotion burn vs cap, per-order pocket profit by channel,
 *      Talabat Go vs Talabat Marketplace mix, location channel coverage, expected-payout settlement control.
 *   3. Rent, opex, supplier-cost & operations watchdog: rent / maintenance / opex to sales by location,
 *      location food cost vs restaurant average, supplier unit-price creep, POS late openings and cancellations.
 *
 * Assumptions used in an expected result (a price move, a demand shift, a renegotiation step) are always
 * stated in the finding text itself.
 */
import { ODOO } from '@/lib/odoo/odoo-dataset'
import INTEL from '@/lib/odoo/odoo-intel.json'
import { BRANCHES, BRANDS, CHANNELS, LEDGER } from '@/lib/aether/ledger'

export type FindingDomain = 'branches' | 'menu' | 'operations' | 'delivery'
export type FindingSeverity = 'critical' | 'high' | 'medium'

export interface AetherFinding {
  id: string
  domain: FindingDomain
  severity: FindingSeverity
  titleEn: string
  titleAr: string
  faultEn: string
  faultAr: string
  fixEn: string
  fixAr: string
  growthEn: string
  growthAr: string
  resultEn: string
  resultAr: string
  stepsEn: string[]
  stepsAr: string[]
  /** Expected monthly KWD impact (0 when the result is a control or compliance outcome). */
  monthlyKwd: number
}

export const FINDING_DOMAINS: { id: FindingDomain | 'all'; en: string; ar: string }[] = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'branches', en: 'Locations & rents', ar: 'الأفرع والأجارات' },
  { id: 'menu', en: 'Menu & sales', ar: 'المينيو والمبيعات' },
  { id: 'operations', en: 'Operations', ar: 'العمليات والتشغيل' },
  { id: 'delivery', en: 'Delivery & expenses', ar: 'التوصيل والمصاريف' },
]

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const f0 = (n: number) => Math.round(n).toLocaleString('en-US')
const f1 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const f3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const pctOf = (a: number, b: number) => (b ? (a / b) * 100 : 0)
const sum = <T,>(rows: readonly T[], fn: (r: T) => number) => rows.reduce((s, r) => s + fn(r), 0)
const COGS = LEDGER.cogsPct / 100
const brandOf = (id: string) => BRANDS.find((b) => b.id === id)
const locationOf = (id: string) => BRANCHES.find((b) => b.id === id)
const channelOf = (id: string) => CHANNELS.find((c) => c.id === id)
const codeOf = (name: string) => name.match(/^\[([^\]]+)\]/)?.[1] ?? null
const DELIVERY_PACKAGING_KWD = 0.18
const PROMO_CAP_PCT = LEDGER.keetaCapPct

type Intel = typeof INTEL
const intel: Intel = INTEL

// ---------------------------------------------------------------------------
// 1. Menu engineering matrix (dual margin)
// ---------------------------------------------------------------------------
export type Quadrant = 'star' | 'plowhorse' | 'puzzle' | 'dog'

export interface MatrixItem {
  code: string
  name: string
  brand: string
  qty: number
  sales: number
  price: number
  foodCost: number
  costSource: 'recipe' | 'group'
  cm1: number
  cm2: number
  quadrant: Quadrant
}

const RECIPES = new Map(intel.recipes.filter((r) => r.coverage >= 80).map((r) => [codeOf(r.name) ?? '', r]))
const MENU = ODOO.menu.filter((m) => m.netKwd > 0 && m.qty > 0 && BRANDS.some((b) => b.id === m.brand))

/** Recipe costs carry the relative cost structure; posted Odoo COGS sets the absolute level. */
const RECIPE_CALIBRATION = (() => {
  let revenue = 0
  let recipe = 0
  for (const m of MENU) {
    const r = m.code ? RECIPES.get(m.code) : undefined
    if (!r) continue
    revenue += m.netKwd
    recipe += r.recipeCostKwd * m.qty
  }
  return recipe > 0 ? (COGS * revenue) / recipe : 1
})()

/** Delivery-weighted commission rate per brand (Odoo brand × channel sales × contract rates). */
const BRAND_COMMISSION = new Map(
  BRANDS.map((b) => {
    const rows = ODOO.brandChannel.filter((r) => r.brand === b.id)
    const net = sum(rows, (r) => r.netKwd)
    const comm = sum(rows, (r) => r.netKwd * ((channelOf(r.channel)?.commissionPct ?? 0) / 100))
    return [b.id, net ? comm / net : 0]
  }),
)

export const MENU_MATRIX: MatrixItem[] = (() => {
  const out: MatrixItem[] = []
  for (const b of BRANDS) {
    const items = MENU.filter((m) => m.brand === b.id)
    if (items.length < 4) continue
    const commission = BRAND_COMMISSION.get(b.id) ?? 0
    const rows = items.map((m) => {
      const price = m.netKwd / m.qty
      const r = m.code ? RECIPES.get(m.code) : undefined
      const foodCost = r ? Math.min(price * 0.9, r.recipeCostKwd * RECIPE_CALIBRATION) : price * COGS
      const cm1 = price - foodCost
      const cm2 = cm1 - price * commission
      return { code: m.code ?? '', name: m.name, brand: b.id, qty: m.qty, sales: m.netKwd, price, foodCost, costSource: (r ? 'recipe' : 'group') as MatrixItem['costSource'], cm1, cm2 }
    })
    const totalQty = sum(rows, (r) => r.qty)
    const popThreshold = (totalQty / rows.length) * 0.7
    const cmThreshold = totalQty ? sum(rows, (r) => r.cm2 * r.qty) / totalQty : 0
    for (const r of rows) {
      const popular = r.qty >= popThreshold
      const profitable = r.cm2 >= cmThreshold
      out.push({ ...r, quadrant: popular && profitable ? 'star' : popular ? 'plowhorse' : profitable ? 'puzzle' : 'dog' })
    }
  }
  return out
})()

const byQuadrant = (q: Quadrant) => MENU_MATRIX.filter((m) => m.quadrant === q)

function menuFindings(): AetherFinding[] {
  const out: AetherFinding[] = []
  const stars = byQuadrant('star')
  const dogs = byQuadrant('dog')
  const plowhorses = byQuadrant('plowhorse').sort((a, b) => b.qty - a.qty)
  const starCm2 = sum(stars, (s) => s.cm2 * s.qty) / Math.max(1, sum(stars, (s) => s.qty))

  // Underpriced hits: the most popular low-margin items
  const repriceSet = plowhorses.slice(0, 6)
  if (repriceSet.length) {
    const gain = sum(repriceSet, (p) => p.sales * 0.05)
    const names = repriceSet.slice(0, 3).map((p) => p.name).join(', ')
    out.push({
      id: 'menu-underpriced',
      domain: 'menu',
      severity: gain > 1000 ? 'high' : 'medium',
      titleEn: 'Underpriced best-sellers',
      titleAr: 'أصناف شعبية بسعر أقل من قيمتها',
      faultEn: `${repriceSet.length} high-volume items earn below their brand's average margin after food cost and delivery commission (for example ${names}).`,
      faultAr: `${repriceSet.length} أصناف عالية الطلب تحقق هامشاً أقل من متوسط علامتها بعد تكلفة الأغذية وعمولة التوصيل، مثل ${names}.`,
      fixEn: 'Raise these items by 5% in Odoo POS and on every delivery menu in the same week.',
      fixAr: 'رفع أسعار هذه الأصناف بنسبة 5% في نقاط بيع أودو وفي كل قوائم التوصيل خلال الأسبوع نفسه.',
      growthEn: 'Pair each with a drink or side in a bundle so the price move lands as added value.',
      growthAr: 'ربط كل صنف منها بمشروب أو طبق جانبي في وجبة مجمّعة ليظهر تعديل السعر كقيمة مضافة.',
      resultEn: `About +${f0(gain)} KWD per month at unchanged volume.`,
      resultAr: `نحو ${f0(gain)} د.ك إضافية شهرياً بنفس حجم المبيعات.`,
      stepsEn: ['Approve the 5% list with brand managers.', 'Update Odoo POS and aggregator menus together.', 'Watch item volumes in Odoo for two weeks.'],
      stepsAr: ['اعتماد قائمة رفع الأسعار 5% مع مديري العلامات.', 'تحديث نقاط بيع أودو وقوائم المنصات معاً.', 'مراقبة كميات الأصناف في أودو لمدة أسبوعين.'],
      monthlyKwd: gain,
    })
  }

  // Dogs and slow-mover drag
  const slow = MENU_MATRIX.filter((m) => m.qty < 10)
  if (dogs.length) {
    const dogSales = sum(dogs, (d) => d.sales)
    const dogQty = sum(dogs, (d) => d.qty)
    const dogCm2 = sum(dogs, (d) => d.cm2 * d.qty) / Math.max(1, dogQty)
    const gain = Math.max(0, 0.5 * dogQty * (starCm2 - dogCm2))
    out.push({
      id: 'menu-dogs',
      domain: 'menu',
      severity: 'medium',
      titleEn: 'Low-margin, low-demand items',
      titleAr: 'أصناف ضعيفة الطلب والهامش',
      faultEn: `${dogs.length} items are both below-average sellers and below-average earners (${f0(dogSales)} KWD a month); ${slow.length} items sold fewer than 10 units.`,
      faultAr: `${dogs.length} صنفاً أقل من المتوسط في الطلب والهامش معاً (${f0(dogSales)} د.ك شهرياً)، و${slow.length} صنفاً باعت أقل من 10 وحدات.`,
      fixEn: 'Delist the items that sold fewer than 10 units and move the rest off the main menu screens.',
      fixAr: 'إيقاف الأصناف التي باعت أقل من 10 وحدات ونقل بقية الأصناف الضعيفة من الشاشات الرئيسية.',
      growthEn: 'Give their screen space to Star items and two-item bundles.',
      growthAr: 'تخصيص مساحتها على الشاشات للأصناف النجوم والوجبات المجمّعة.',
      resultEn: `If half of that demand moves to Star items: about +${f0(gain)} KWD contribution per month, plus simpler prep.`,
      resultAr: `إذا انتقل نصف هذا الطلب إلى الأصناف النجوم: نحو ${f0(gain)} د.ك مساهمة إضافية شهرياً مع تبسيط التحضير.`,
      stepsEn: ['Confirm the delist list with each brand.', 'Archive the items in Odoo POS and delivery menus.', 'Re-run this matrix after one month.'],
      stepsAr: ['تأكيد قائمة الإيقاف مع كل علامة.', 'أرشفة الأصناف في نقاط بيع أودو وقوائم التوصيل.', 'إعادة تحليل المصفوفة بعد شهر.'],
      monthlyKwd: gain,
    })
  }

  // Drink & side attachment gap on delivery orders
  const aggregators = CHANNELS.filter((c) => c.group === 'aggregator')
  const aggOrders = sum(aggregators, (c) => c.orders)
  const drinks = MENU.filter((m) => /drink|beverage/i.test(m.category))
  const drinkQty = sum(drinks, (d) => d.qty)
  const drinkPrice = drinkQty ? sum(drinks, (d) => d.netKwd) / drinkQty : 0
  const lead = [...ODOO.brands].filter((b) => b.active).sort((a, b) => b.netKwd - a.netKwd)[0]
  if (drinkPrice > 0 && aggOrders > 0) {
    const gain = aggOrders * 0.1 * drinkPrice * (1 - COGS)
    out.push({
      id: 'menu-attach',
      domain: 'menu',
      severity: 'medium',
      titleEn: 'Drink attachment gap on delivery',
      titleAr: 'ضعف إضافة المشروبات في طلبات التوصيل',
      faultEn: `Drinks are only ${f1(lead?.drinksPct ?? 0)}% of ${lead?.en} item sales while ${f0(aggOrders)} delivery-platform payments ran through Odoo.`,
      faultAr: `المشروبات لا تتجاوز ${f1(lead?.drinksPct ?? 0)}% من مبيعات أصناف ${brandOf(lead?.id ?? '')?.ar ?? ''} بينما سجّل أودو ${f0(aggOrders)} عملية دفع عبر منصات التوصيل.`,
      fixEn: 'Add a mandatory drink choice to every delivery combo on Talabat and Keeta.',
      fixAr: 'إضافة خيار مشروب إلزامي في كل وجبة توصيل مجمّعة على طلبات وكيتا.',
      growthEn: `Build "meal + drink" bundles at the Odoo average drink price of ${f3(drinkPrice)} KWD.`,
      growthAr: `بناء وجبات "طبق + مشروب" بمتوسط سعر المشروب في أودو ${f3(drinkPrice)} د.ك.`,
      resultEn: `Every 10% of delivery orders that add a drink: about +${f0(gain)} KWD gross profit per month.`,
      resultAr: `كل 10% من طلبات التوصيل تضيف مشروباً: نحو ${f0(gain)} د.ك مجمل ربح إضافي شهرياً.`,
      stepsEn: ['Design one drink bundle per brand.', 'Publish on Talabat and Keeta menus.', 'Track the share of orders with a drink weekly in Odoo.'],
      stepsAr: ['تصميم وجبة مجمّعة مع مشروب لكل علامة.', 'نشرها على قوائم طلبات وكيتا.', 'متابعة نسبة الطلبات التي تحتوي مشروباً أسبوعياً في أودو.'],
      monthlyKwd: gain,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// 2. Delivery & channel margin engine
// ---------------------------------------------------------------------------
export interface ChannelEconomics {
  id: string
  en: string
  ar: string
  sales: number
  orders: number
  itemSales: number
  promo: number
  promoPct: number
  commissionPct: number
  commissionKwd: number
  expectedPayout: number
  pocketPerOrder: number
  riderCostPerOrder: number
}

export const CHANNEL_ECONOMICS: ChannelEconomics[] = CHANNELS.filter((c) => c.group === 'aggregator').map((c) => {
  const basket = c.orders ? c.sales / c.orders : 0
  const commissionKwd = c.sales * (c.commissionPct / 100)
  return {
    id: c.id,
    en: c.en,
    ar: c.ar,
    sales: c.sales,
    orders: c.orders,
    itemSales: c.itemSales,
    promo: c.promo,
    promoPct: pctOf(c.promo, c.itemSales),
    commissionPct: c.commissionPct,
    commissionKwd,
    expectedPayout: c.sales - commissionKwd,
    pocketPerOrder: basket * (1 - COGS - c.commissionPct / 100) - DELIVERY_PACKAGING_KWD - c.riderCostPerOrder,
    riderCostPerOrder: c.riderCostPerOrder,
  }
})

function deliveryFindings(): AetherFinding[] {
  const out: AetherFinding[] = []
  const burning = CHANNEL_ECONOMICS.filter((c) => c.promoPct > PROMO_CAP_PCT && c.itemSales > 0).sort((a, b) => b.promo - a.promo)
  if (burning.length) {
    const recovery = sum(burning, (c) => c.promo - c.itemSales * (PROMO_CAP_PCT / 100))
    const top = burning[0]
    out.push({
      id: 'delivery-promo-burn',
      domain: 'delivery',
      severity: recovery > 1000 ? 'critical' : 'high',
      titleEn: 'Promotion burn above the cap',
      titleAr: 'استنزاف العروض فوق السقف المسموح',
      faultEn: `${burning.map((c) => `${c.en} ${f1(c.promoPct)}%`).join(', ')} of item sales go to promotions, above the ${PROMO_CAP_PCT}% cap (${f0(top.promo)} KWD on ${top.en}).`,
      faultAr: `${burning.map((c) => `${c.ar} ${f1(c.promoPct)}%`).join('، ')} من مبيعات الأصناف تذهب للعروض، فوق سقف ${PROMO_CAP_PCT}% (${f0(top.promo)} د.ك على ${top.ar}).`,
      fixEn: `Cap platform-funded promotions at ${PROMO_CAP_PCT}% and stop open percentage discounts.`,
      fixAr: `وضع سقف ${PROMO_CAP_PCT}% للعروض على المنصات وإيقاف الخصومات المفتوحة بالنسبة المئوية.`,
      growthEn: 'Replace discounts with bundles built on Star items, which protect margin while keeping conversion.',
      growthAr: 'استبدال الخصومات بوجبات مجمّعة على الأصناف النجوم للحفاظ على الهامش ومعدل التحويل.',
      resultEn: `About +${f0(recovery)} KWD per month returned to margin.`,
      resultAr: `نحو ${f0(recovery)} د.ك شهرياً تعود إلى الهامش.`,
      stepsEn: ['Agree the cap with each platform account manager.', 'Switch live promotions to bundles.', 'Review promotion spend weekly from Odoo payments.'],
      stepsAr: ['الاتفاق على السقف مع مدير حساب كل منصة.', 'تحويل العروض الحالية إلى وجبات مجمّعة.', 'مراجعة إنفاق العروض أسبوعياً من مدفوعات أودو.'],
      monthlyKwd: recovery,
    })
  }

  const tgo = CHANNEL_ECONOMICS.find((c) => c.id === 'talabat-tgo')
  const tmp = CHANNEL_ECONOMICS.find((c) => c.id === 'talabat-tmp')
  if (tgo && tmp && tgo.orders > 0 && tmp.orders > 0 && tmp.pocketPerOrder > tgo.pocketPerOrder) {
    const gain = 0.1 * tgo.orders * (tmp.pocketPerOrder - tgo.pocketPerOrder)
    out.push({
      id: 'delivery-tgo-tmp',
      domain: 'delivery',
      severity: 'high',
      titleEn: 'Talabat Go vs Marketplace mix',
      titleAr: 'توزيع الطلبات بين طلبات جو وسوق طلبات',
      faultEn: `Talabat Go carries ${f0(tgo.orders)} orders at ${f3(tgo.pocketPerOrder)} KWD pocket profit each, versus ${f3(tmp.pocketPerOrder)} KWD on Talabat Marketplace (${f0(tmp.orders)} orders).`,
      faultAr: `تحمل طلبات جو ${f0(tgo.orders)} طلباً بصافي ربح ${f3(tgo.pocketPerOrder)} د.ك للطلب، مقابل ${f3(tmp.pocketPerOrder)} د.ك على سوق طلبات (${f0(tmp.orders)} طلباً).`,
      fixEn: 'Route nearby areas to the restaurant-fleet Marketplace account during off-peak hours.',
      fixAr: 'توجيه المناطق القريبة إلى حساب سوق طلبات بأسطول المطعم خارج ساعات الذروة.',
      growthEn: 'Expand Marketplace coverage at locations with their own riders.',
      growthAr: 'توسيع تغطية سوق طلبات في المواقع التي تملك سائقين خاصين.',
      resultEn: `Shifting 10% of Talabat Go orders: about +${f0(gain)} KWD per month.`,
      resultAr: `تحويل 10% من طلبات طلبات جو: نحو ${f0(gain)} د.ك إضافية شهرياً.`,
      stepsEn: ['List the areas within 3 km of each location.', 'Assign them to the Marketplace account off-peak.', 'Compare pocket profit per order monthly.'],
      stepsAr: ['حصر المناطق ضمن 3 كم من كل موقع.', 'إسنادها لحساب سوق طلبات خارج الذروة.', 'مقارنة صافي الربح للطلب شهرياً.'],
      monthlyKwd: gain,
    })
  }

  // Location channel coverage (zone account health)
  const aggIds = new Set(CHANNEL_ECONOMICS.map((c) => c.id))
  const shares = ODOO.restaurants.map((l) => {
    const agg = sum(l.channels.filter((c) => aggIds.has(c.channel)), (c) => c.amountKwd)
    return { id: l.id, share: pctOf(agg, l.netKwd), net: l.netKwd, agg }
  })
  const groupShare = pctOf(sum(shares, (s) => s.agg), sum(shares, (s) => s.net))
  const weakest = [...shares].sort((a, b) => a.share - b.share)[0]
  if (weakest && weakest.share < groupShare - 10) {
    const loc = locationOf(weakest.id)
    const peerAvg = sum(shares.filter((s) => s.id !== weakest.id), (s) => s.agg) / Math.max(1, shares.length - 1)
    out.push({
      id: 'delivery-coverage',
      domain: 'delivery',
      severity: 'medium',
      titleEn: 'Weak delivery presence at a location',
      titleAr: 'ضعف حضور التوصيل في أحد المواقع',
      faultEn: `${loc?.en} takes only ${f1(weakest.share)}% of its sales from delivery platforms versus ${f1(groupShare)}% across restaurant locations.`,
      faultAr: `يحقق ${loc?.ar} ${f1(weakest.share)}% فقط من مبيعاته عبر منصات التوصيل مقابل ${f1(groupShare)}% لمواقع المطاعم.`,
      fixEn: 'Check every platform account for this location is online, listed for all brands and covering its full radius.',
      fixAr: 'التأكد من أن حسابات المنصات لهذا الموقع متصلة ومدرجة لكل العلامات وتغطي كامل نطاقه.',
      growthEn: 'Add the location’s best-selling brands to the platforms where it is missing.',
      growthAr: 'إدراج العلامات الأعلى مبيعاً في هذا الموقع على المنصات غير المفعّلة.',
      resultEn: `Peer locations average ${f0(peerAvg)} KWD of delivery sales per month; closing a quarter of the gap adds about +${f0(Math.max(0, (peerAvg - weakest.agg) * 0.25))} KWD.`,
      resultAr: `متوسط مبيعات التوصيل في المواقع الأخرى ${f0(peerAvg)} د.ك شهرياً؛ سد ربع الفجوة يضيف نحو ${f0(Math.max(0, (peerAvg - weakest.agg) * 0.25))} د.ك.`,
      stepsEn: ['Audit the location’s platform accounts.', 'List missing brands on each platform.', 'Review delivery share after four weeks.'],
      stepsAr: ['مراجعة حسابات المنصات للموقع.', 'إدراج العلامات غير المدرجة على كل منصة.', 'مراجعة حصة التوصيل بعد أربعة أسابيع.'],
      monthlyKwd: Math.max(0, (peerAvg - weakest.agg) * 0.25),
    })
  }

  // Settlement control on expected payouts
  const payout = sum(CHANNEL_ECONOMICS, (c) => c.expectedPayout)
  out.push({
    id: 'delivery-settlement',
    domain: 'delivery',
    severity: 'medium',
    titleEn: 'Platform settlement control',
    titleAr: 'رقابة تسويات المنصات',
    faultEn: `${f0(payout)} KWD of platform payouts are expected this month from Odoo payments after contract commissions, with no monthly statement match recorded.`,
    faultAr: `يُتوقع ${f0(payout)} د.ك من تسويات المنصات هذا الشهر حسب مدفوعات أودو بعد العمولات التعاقدية، دون مطابقة شهرية مسجلة للكشوف.`,
    fixEn: 'Match every platform statement to the Odoo expected payout and claim any gap above 1%.',
    fixAr: 'مطابقة كل كشف منصة مع التسوية المتوقعة في أودو والمطالبة بأي فرق يتجاوز 1%.',
    growthEn: 'Use the Delivery Radar dispute claims for cancellations after preparation and over-billed commissions.',
    growthAr: 'استخدام مطالبات رادار التوصيل للإلغاءات بعد التحضير والعمولات المحتسبة بالزيادة.',
    resultEn: `Every 1% recovered on expected payouts is about +${f0(payout * 0.01)} KWD per month.`,
    resultAr: `كل 1% يُسترد من التسويات المتوقعة يعادل نحو ${f0(payout * 0.01)} د.ك شهرياً.`,
    stepsEn: ['Download each platform statement monthly.', 'Compare with the Odoo expected payout per channel.', 'Send claims within 7 days.'],
    stepsAr: ['تنزيل كشف كل منصة شهرياً.', 'مقارنته بالتسوية المتوقعة لكل قناة في أودو.', 'إرسال المطالبات خلال 7 أيام.'],
    monthlyKwd: payout * 0.01,
  })
  return out
}

// ---------------------------------------------------------------------------
// 3. Rent, opex, supplier cost & operations watchdog
// ---------------------------------------------------------------------------
export interface LocationWatch {
  id: string
  en: string
  ar: string
  revenue: number
  rent: number
  rentPct: number
  maintenance: number
  otherOpex: number
  opexPct: number
  cogsPct: number
  marginPct: number
  profit: number
  lateOpenings: number
  sessions: number
  cancelledOrders: number
}

export const LOCATION_WATCH: LocationWatch[] = BRANCHES.map((b) => {
  const c = intel.locationCosts.find((x) => x.location === b.id)
  const s = intel.sessions.find((x) => x.location === b.id)
  const r = intel.refunds.find((x) => x.location === b.id)
  const revenue = b.revenue || b.sales
  return {
    id: b.id,
    en: b.en,
    ar: b.ar,
    revenue,
    rent: c?.rentKwd ?? 0,
    rentPct: pctOf(c?.rentKwd ?? 0, revenue),
    maintenance: c?.maintenanceKwd ?? 0,
    otherOpex: c?.otherOpexKwd ?? 0,
    opexPct: pctOf(b.opex, revenue),
    cogsPct: pctOf(b.cogs, revenue),
    marginPct: b.marginPct,
    profit: b.profit,
    lateOpenings: s?.lateOpenings ?? 0,
    sessions: s?.sessions ?? 0,
    cancelledOrders: r?.cancelledOrders ?? 0,
  }
})

function watchdogFindings(): AetherFinding[] {
  const out: AetherFinding[] = []
  const rev = sum(LOCATION_WATCH, (l) => l.revenue)

  // Rent to sales
  const rentTotal = sum(LOCATION_WATCH, (l) => l.rent)
  if (rentTotal > 0) {
    const avgRent = pctOf(rentTotal, rev)
    const worst = [...LOCATION_WATCH].sort((a, b) => b.rentPct - a.rentPct)[0]
    if (worst && worst.rentPct > avgRent) {
      const neededSales = worst.rent / (avgRent / 100) - worst.revenue
      const saving = worst.rent * 0.1
      out.push({
        id: 'branch-rent',
        domain: 'branches',
        severity: worst.rentPct > avgRent * 1.4 ? 'high' : 'medium',
        titleEn: 'Rent heavy against sales',
        titleAr: 'إيجار مرتفع مقارنة بالمبيعات',
        faultEn: `${worst.en} pays ${f0(worst.rent)} KWD rent a month, ${f1(worst.rentPct)}% of its revenue, versus ${f1(avgRent)}% across restaurant locations.`,
        faultAr: `يدفع ${worst.ar} إيجاراً ${f0(worst.rent)} د.ك شهرياً، أي ${f1(worst.rentPct)}% من إيراده، مقابل ${f1(avgRent)}% لمواقع المطاعم.`,
        fixEn: 'Open a lease review with the landlord for a turnover-linked rent or a step-down at renewal.',
        fixAr: 'فتح مراجعة لعقد الإيجار مع المالك لربط الإيجار بالمبيعات أو تخفيضه عند التجديد.',
        growthEn: 'Lift sales per square metre with longer delivery hours and a second brand on the same kitchen.',
        growthAr: 'رفع المبيعات للمتر المربع بتمديد ساعات التوصيل وتشغيل علامة ثانية من المطبخ نفسه.',
        resultEn: `A 10% rent reduction saves about ${f0(saving)} KWD per month; matching the group rent ratio needs about +${f0(Math.max(0, neededSales))} KWD of monthly sales.`,
        resultAr: `تخفيض الإيجار 10% يوفر نحو ${f0(saving)} د.ك شهرياً؛ والوصول إلى نسبة إيجار المجموعة يحتاج نحو ${f0(Math.max(0, neededSales))} د.ك مبيعات إضافية شهرياً.`,
        stepsEn: ['Prepare the location’s Odoo sales and rent history.', 'Meet the landlord before the renewal window.', 'Launch the second-brand trial in parallel.'],
        stepsAr: ['تجهيز سجل المبيعات والإيجار للموقع من أودو.', 'مقابلة المالك قبل موعد التجديد.', 'إطلاق تجربة العلامة الثانية بالتوازي.'],
        monthlyKwd: saving,
      })
    }
  }

  // Location margin gap
  const restProfit = sum(LOCATION_WATCH, (l) => l.profit)
  const avgMargin = pctOf(restProfit, rev)
  const low = [...LOCATION_WATCH].sort((a, b) => a.marginPct - b.marginPct)[0]
  if (low && low.marginPct < avgMargin) {
    const uplift = low.revenue * ((avgMargin - low.marginPct) / 100)
    out.push({
      id: 'branch-margin',
      domain: 'branches',
      severity: avgMargin - low.marginPct > 10 ? 'high' : 'medium',
      titleEn: 'Lowest-margin location',
      titleAr: 'الموقع الأقل هامشاً',
      faultEn: `${low.en} runs a ${f1(low.marginPct)}% operating margin against the ${f1(avgMargin)}% restaurant average (food cost ${f1(low.cogsPct)}%, opex ${f1(low.opexPct)}% of revenue).`,
      faultAr: `يعمل ${low.ar} بهامش تشغيلي ${f1(low.marginPct)}% مقابل متوسط المطاعم ${f1(avgMargin)}% (تكلفة الأغذية ${f1(low.cogsPct)}%، المصروفات ${f1(low.opexPct)}% من الإيراد).`,
      fixEn: 'Align crew rosters to the location’s real Odoo peak hours and audit its largest expense lines.',
      fixAr: 'مواءمة جدول الطاقم مع ساعات الذروة الفعلية للموقع في أودو ومراجعة أكبر بنود مصروفاته.',
      growthEn: 'Copy the playbook of the most profitable location: menu mix, delivery coverage and staffing.',
      growthAr: 'نقل ممارسات الموقع الأعلى ربحية: مزيج المنيو وتغطية التوصيل وجدولة الطاقم.',
      resultEn: `Reaching the restaurant average margin adds about +${f0(uplift)} KWD per month.`,
      resultAr: `الوصول إلى متوسط هامش المطاعم يضيف نحو ${f0(uplift)} د.ك شهرياً.`,
      stepsEn: ['Compare its expense lines with the top location in Odoo.', 'Rebuild the roster around peak hours.', 'Review the margin monthly.'],
      stepsAr: ['مقارنة بنود مصروفاته مع الموقع الأعلى في أودو.', 'إعادة بناء الجدول حول ساعات الذروة.', 'مراجعة الهامش شهرياً.'],
      monthlyKwd: uplift,
    })
  }

  // Location food cost above average
  const cogsTotal = sum(BRANCHES, (b) => b.cogs)
  const avgCogs = pctOf(cogsTotal, rev)
  const over = LOCATION_WATCH.filter((l) => l.cogsPct > avgCogs).sort((a, b) => b.cogsPct - a.cogsPct)
  if (over.length) {
    const excess = sum(over, (l) => l.revenue * ((l.cogsPct - avgCogs) / 100))
    out.push({
      id: 'ops-food-cost',
      domain: 'operations',
      severity: excess > 1000 ? 'high' : 'medium',
      titleEn: 'Food cost above the restaurant average',
      titleAr: 'تكلفة أغذية أعلى من متوسط المطاعم',
      faultEn: `${over.map((l) => `${l.en} ${f1(l.cogsPct)}%`).join(', ')} run above the ${f1(avgCogs)}% restaurant food-cost average.`,
      faultAr: `${over.map((l) => `${l.ar} ${f1(l.cogsPct)}%`).join('، ')} أعلى من متوسط تكلفة الأغذية للمطاعم ${f1(avgCogs)}%.`,
      fixEn: 'Re-weigh portions against the Odoo bills of materials and calibrate daily prep batches.',
      fixAr: 'إعادة وزن الحصص مقابل قوائم المواد في أودو ومعايرة دفعات التحضير اليومية.',
      growthEn: 'Feature lower-cost Star items in these locations’ delivery menus.',
      growthAr: 'إبراز الأصناف النجوم الأقل تكلفة في قوائم توصيل هذه المواقع.',
      resultEn: `Bringing them to the average saves about ${f0(excess)} KWD per month.`,
      resultAr: `إعادتها إلى المتوسط توفر نحو ${f0(excess)} د.ك شهرياً.`,
      stepsEn: ['Run a portion audit at each listed location.', 'Lock prep batches to forecast sales.', 'Review food cost by location monthly.'],
      stepsAr: ['تدقيق الحصص في كل موقع مذكور.', 'ربط دفعات التحضير بالمبيعات المتوقعة.', 'مراجعة تكلفة الأغذية لكل موقع شهرياً.'],
      monthlyKwd: excess,
    })
  }

  // Supplier unit-price creep (raw materials and kitchen supplies only)
  const creep = intel.purchase.priceCreep.filter((p) => p.monthlyImpactKwd > 0 && !/^\[HO/i.test(p.name))
  if (creep.length) {
    const top = creep.slice(0, 5)
    const impact = sum(top, (p) => p.monthlyImpactKwd)
    const clean = (n: string) => n.replace(/^\[[^\]]+\]\s*/, '')
    out.push({
      id: 'ops-price-creep',
      domain: 'operations',
      severity: impact > 300 ? 'high' : 'medium',
      titleEn: 'Supplier price creep',
      titleAr: 'ارتفاع أسعار الموردين',
      faultEn: `Purchase prices rose over the last 90 days: ${top.slice(0, 3).map((p) => `${clean(p.name)} +${f1(p.creepPct)}%`).join(', ')}.`,
      faultAr: `ارتفعت أسعار الشراء خلال آخر 90 يوماً: ${top.slice(0, 3).map((p) => `${clean(p.name)} +${f1(p.creepPct)}%`).join('، ')}.`,
      fixEn: 'Ask the suppliers of the top five items to return to the earlier price or quote against a second supplier.',
      fixAr: 'مطالبة موردي الأصناف الخمسة الأعلى أثراً بالعودة للسعر السابق أو طلب عرض من مورد ثانٍ.',
      growthEn: 'Lock 90-day price agreements for rice, proteins and packaging.',
      growthAr: 'تثبيت اتفاقيات أسعار لمدة 90 يوماً للأرز والبروتينات ومواد التغليف.',
      resultEn: `Reversing the creep on these five items saves about ${f0(impact)} KWD per month.`,
      resultAr: `إلغاء الارتفاع على هذه الأصناف الخمسة يوفر نحو ${f0(impact)} د.ك شهرياً.`,
      stepsEn: ['Send price-return requests this week.', 'Request a second quotation for each item.', 'Approve 90-day price locks.'],
      stepsAr: ['إرسال طلبات إعادة السعر هذا الأسبوع.', 'طلب عرض سعر ثانٍ لكل صنف.', 'اعتماد تثبيت الأسعار لمدة 90 يوماً.'],
      monthlyKwd: impact,
    })
  }

  // POS discipline: late openings and cancellations
  const late = LOCATION_WATCH.filter((l) => l.lateOpenings > 0).sort((a, b) => b.lateOpenings - a.lateOpenings)
  const cancelled = LOCATION_WATCH.filter((l) => l.cancelledOrders > 0).sort((a, b) => b.cancelledOrders - a.cancelledOrders)
  if (late.length || cancelled.length) {
    const lateTotal = sum(late, (l) => l.lateOpenings)
    const cancelTotal = sum(cancelled, (l) => l.cancelledOrders)
    out.push({
      id: 'ops-pos-discipline',
      domain: 'operations',
      severity: 'medium',
      titleEn: 'POS opening and cancellation discipline',
      titleAr: 'انضباط فتح نقاط البيع والإلغاءات',
      faultEn: `${lateTotal} register sessions opened more than 45 minutes after their usual time${late[0] ? ` (most at ${late[0].en})` : ''}, and ${cancelTotal} orders were cancelled${cancelled[0] ? ` (most at ${cancelled[0].en}: ${cancelled[0].cancelledOrders})` : ''}.`,
      faultAr: `فُتحت ${lateTotal} جلسة نقاط بيع بعد موعدها المعتاد بأكثر من 45 دقيقة${late[0] ? ` (أكثرها في ${late[0].ar})` : ''}، وأُلغي ${cancelTotal} طلباً${cancelled[0] ? ` (أكثرها في ${cancelled[0].ar}: ${cancelled[0].cancelledOrders})` : ''}.`,
      fixEn: 'Require manager approval for every cancellation and an opening checklist signed in Odoo.',
      fixAr: 'اشتراط موافقة المدير على كل إلغاء وقائمة تحقق للفتح موقّعة في أودو.',
      growthEn: 'Open delivery-only ordering 30 minutes earlier at locations with consistent late starts.',
      growthAr: 'فتح طلبات التوصيل قبل 30 دقيقة في المواقع التي تتأخر في الفتح بشكل متكرر.',
      resultEn: 'Target: zero late openings and every cancellation explained, protecting first-hour sales.',
      resultAr: 'المستهدف: صفر تأخير في الفتح وتبرير كل إلغاء، لحماية مبيعات الساعة الأولى.',
      stepsEn: ['Set the opening time per register in Odoo.', 'Enable manager PIN for cancellations.', 'Review the weekly exceptions list.'],
      stepsAr: ['تحديد موعد الفتح لكل جهاز في أودو.', 'تفعيل رمز المدير للإلغاءات.', 'مراجعة قائمة الاستثناءات أسبوعياً.'],
      monthlyKwd: 0,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Distilled outputs
// ---------------------------------------------------------------------------
const SEVERITY_RANK: Record<FindingSeverity, number> = { critical: 0, high: 1, medium: 2 }

export const AETHER_FINDINGS: AetherFinding[] = [...watchdogFindings(), ...menuFindings(), ...deliveryFindings()].sort(
  (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.monthlyKwd - a.monthlyKwd,
)

/** Best finding per domain, ordered by expected monthly value (used by Feryal's proposal panel). */
export const AETHER_TOP_PROPOSALS: AetherFinding[] = (['delivery', 'menu', 'operations', 'branches'] as FindingDomain[])
  .map((d) => AETHER_FINDINGS.filter((f) => f.domain === d).sort((a, b) => b.monthlyKwd - a.monthlyKwd)[0])
  .filter((f): f is AetherFinding => !!f)
  .sort((a, b) => b.monthlyKwd - a.monthlyKwd)

export const AETHER_BRAIN_META = {
  syncedAt: LEDGER.syncedAt,
  intelSyncedAt: intel.syncedAt,
  periodEn: LEDGER.periodLabelEn,
  periodAr: LEDGER.periodLabelAr,
  findings: AETHER_FINDINGS.length,
  totalMonthlyKwd: sum(AETHER_FINDINGS, (f) => f.monthlyKwd),
  recipesCosted: RECIPES.size,
  recipeCalibration: RECIPE_CALIBRATION,
}
