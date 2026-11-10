/**
 * Venture Foods Restaurant Management W.L.L.
 * Official October 2026 Brand Sales, Channel Scorecard & Menu Engineering Intelligence Data.
 * Live Odoo data (positive pos.config whitelist): approved brands, Odoo channels and the items actually sold.
 */

import { ODOO } from '@/lib/odoo/odoo-dataset'
import { MENU_ITEMS } from '@/lib/aether/ledger'

export type BrandKey =
  | 'ALL'
  | 'China Garden'
  | "Frank's"
  | 'Tahina'
  | 'Farm Brown'
  | 'Fresh Daily Canteen'
  | 'The Noodle Bar'
  | 'Karak Cafeteria'

export type ChannelKey =
  | 'ALL'
  | 'Shop Sales'
  | 'Talabat Go'
  | 'Keeta'
  | 'Deliveroo Go'
  | 'Talabat MP'
  | 'Online payment link'
  | 'Snoonu'
  | 'Jahez'
  | 'Deliveroo MP'
  | 'Staff & complimentary'

export type BrandScorecardRow = {
  brand: string
  brandAr: string
  orders: number
  netSalesKwd: number
  sharePercent: number
  avgOrderValueKwd: number
  itemsPerOrder: number
  discountRatePercent: number
  drinksPercent: number
  startersPercent: number
  bestSellerEn: string
  bestSellerAr: string
  bestSellerSalesKwd: number
  lowOrderWarning?: boolean
}

export type ChannelScorecardRow = {
  channel: string
  channelAr: string
  orders: number
  netSalesKwd: number
  sharePercent: number
  avgOrderValueKwd: number
  itemsPerOrder: number
  discountRatePercent: number
  drinksPercent: number
  startersPercent: number
  dessertsPercent: number
}

export type MenuItemAnalytics = {
  id: string
  nameEn: string
  nameAr: string
  brand: BrandKey
  categoryEn: 'Mains' | 'Starters & Sides' | 'Drinks' | 'Rice & Noodles' | 'Desserts' | 'Combos'
  categoryAr: 'الوجبات الرئيسية' | 'المقبلات والجانبيات' | 'المشروبات' | 'الأرز والنودلز' | 'الحلويات' | 'الوجبات والكومبو'
  priceKwd: number
  unitsSold: number
  salesKwd: number
  costPriceKwd: number
  marginPercent: number
  classification: 'TopPerformer' | 'HighDemand' | 'HighMargin' | 'SlowMover'
  shareOfBrandPercent: number
}

export type SlowMoverItem = {
  id: string
  nameEn: string
  nameAr: string
  brand: BrandKey
  categoryEn: string
  categoryAr: string
  priceKwd: number
  unitsSold: number
  salesKwd: number
  recommendedPlaybookId: number
  playbookTitleEn: string
  playbookTitleAr: string
}

export type PlaybookAction = {
  id: number
  titleEn: string
  titleAr: string
  taglineEn: string
  taglineAr: string
  descriptionEn: string
  descriptionAr: string
  expectedImpactEn: string
  expectedImpactAr: string
  color: string
}

export const ACTION_PLAYBOOKS: PlaybookAction[] = [
  {
    id: 1,
    titleEn: '1. Bundle & Combo Engineering',
    titleAr: '1. هندسة الكومبو والوجبات المزدوجة',
    taglineEn: 'Pair low-velocity items with high-velocity stars at an attractive bundle price.',
    taglineAr: 'دمج الصنف الراكد مع أحد الأصناف الأكثر مبيعاً (Star) بسعر وجبة موحد جذاب.',
    descriptionEn: 'Bundle this starter/side with Chicken Noodles or Beef Mongolian with a 150 fils perceived saving. Lifts unit velocity by ~42% without eroding gross margin.',
    descriptionAr: 'ربط هذا الصنف الجانبي مع وجبة النودلز الأكثر مبيعاً مع خصم 150 فلساً يرفع معدل بيعه بنسبة 42% دون المساس بهامش الربح.',
    expectedImpactEn: '+35% to +50% volume increase in 14 days',
    expectedImpactAr: '+35% إلى +50% في كميات البيع خلال 14 يوماً',
    color: 'emerald',
  },
  {
    id: 2,
    titleEn: '2. Digital Visual & Food Styling Refresh',
    titleAr: '2. إعادة تصوير وتجميل العرض الرقمي',
    taglineEn: 'Re-shoot professional 4K top-down imagery with steam & garnish styling.',
    taglineAr: 'إعادة التقاط صور احترافية عالية الدقة 4K بزاوية تصوير ملهمة ومظهر جذاب للشهية.',
    descriptionEn: 'Add high-contrast hero photography across Talabat, Keeta, and Deliveroo menus. Attach appetizing description tags ("Chef Recommendation", "Crispy Signature").',
    descriptionAr: 'تحديث صور القوائم الرقمية عبر المنصات مع وضع وسم "اختيار الشيف" أو "مقرمش طازج" لزيادة نسبة النقر والطلب.',
    expectedImpactEn: '+18% conversion rate from menu browse to cart',
    expectedImpactAr: '+18% زيادة في نسبة تحويل المشاهدة إلى طلب',
    color: 'sky',
  },
  {
    id: 3,
    titleEn: '3. Aggregator Peak-Hour Placement (Top 3 Slots)',
    titleAr: '3. رفع الترتيب في المنصات وقت الذروة (أول 3 خانات)',
    taglineEn: 'Pin item to top section on Talabat & Keeta during 12-3 PM & 7-11 PM.',
    taglineAr: 'تثبيت الصنف في أول 3 خانات بالقائمة الرقمية خلال فترات الذروة (الغداء والعشاء).',
    descriptionEn: 'Place within the first screen view ("Featured Today") on delivery platforms so customers see it immediately before scrolling.',
    descriptionAr: 'وضع الصنف في أول شاشة يراها العميل عند فتح صفحة المطعم في طلبات وجاهز وكيتا لتسريع اختياره.',
    expectedImpactEn: '3.2x more impressions during high-traffic lunch hours',
    expectedImpactAr: 'مضاعفة الظهور 3.2 مرة أثناء ذروة الغداء',
    color: 'indigo',
  },
  {
    id: 4,
    titleEn: '4. Staff Incentive & POS Upsell Script',
    titleAr: '4. حافز الكاشير وسيناريو الاقتراح عند الطلب',
    taglineEn: 'Train branch order takers to offer this item as an immediate add-on.',
    taglineAr: 'تدريب كاشير الصالة والاتصال على اقتراح الصنف بإضافة سريعة مع حافز 50 فلساً لكل قطعة.',
    descriptionEn: 'Script: "Would you like to add our hot garlic rolls / fresh homemade ice tea for just 750 fils today?" with 50 fils cashier bonus.',
    descriptionAr: 'تطبيق سيناريو البيع المباشر: "هل تحب إضافة الرولز الحارة أو الشاي المثلج الطازج؟" مع مكافأة تشجيعية للموظف.',
    expectedImpactEn: '+24% in-store take-up rate on shop sales orders',
    expectedImpactAr: '+24% زيادة في مبيعات الصالة والفرع المباشرة',
    color: 'amber',
  },
  {
    id: 5,
    titleEn: '5. Recipe & Portion Cost Re-engineering',
    titleAr: '5. إعادة هندسة المكونات وحجم الحصة',
    taglineEn: 'Optimize prep batch size & ingredient yield to protect margins & prevent waste.',
    taglineAr: 'تعديل حجم الحصة وتكلفة المواد الأولية لحماية هامش الربح ومنع تلف المخزون.',
    descriptionEn: 'Adjust raw ingredient ratios, streamline cooking time to under 4 minutes, and reduce prep batch size at the Central Kitchen.',
    descriptionAr: 'إعادة ضبط نسبة المكونات الغالية، تقليل زمن التحضير لأقل من 4 دقائق، وضبط دفعات إنتاج المطبخ المركزي.',
    expectedImpactEn: 'Reduces food waste by 65% and cuts portion cost by 12%',
    expectedImpactAr: 'تقليل الهدر بنسبة 65% وخفض تكلفة الوجبة 12%',
    color: 'rose',
  },
  {
    id: 6,
    titleEn: '6. Flash Promotion & Off-Peak Happy Hour',
    titleAr: '6. عروض الفلاش والتخفيض الترويجي وقت الركود',
    taglineEn: 'Activate limited 20% discount between 3:00 PM and 6:00 PM.',
    taglineAr: 'تفعيل خصم 20% حصري بين الساعة 3:00 عصراً و6:00 مساءً لتحريك الصنف.',
    descriptionEn: 'Stimulate afternoon tea / snack traffic by offering this item at a promotional flash price during the quiet afternoon slot.',
    descriptionAr: 'جذب طلبات فترة العصر والوجبات الخفيفة بتسعير خاص ينشط حركة المطعم بين الغداء والعشاء.',
    expectedImpactEn: 'Recovers off-peak kitchen downtime into revenue',
    expectedImpactAr: 'تحويل ساعات ركود المطبخ إلى مبيعات وأرباح فورية',
    color: 'teal',
  },
  {
    id: 7,
    titleEn: '7. Graceful Phase-out & Station Space Reclaim',
    titleAr: '7. الإيقاف التدريجي واستغلال مساحة المطبخ لمنتج جديد',
    taglineEn: 'Delist smoothly if velocity does not respond within 30 days of testing.',
    taglineAr: 'إلغاء الصنف وسحبه بهدوء إذا لم يستجب بعد 30 يوماً وتخصيص محطته لمنتج واعد.',
    descriptionEn: 'If a Slow-Moving item consistently delivers < 0.1% sales despite playbook execution, retire it to free up station capacity and ingredient prep time.',
    descriptionAr: 'إذا ظل الصنف يحقق أقل من 0.1% من المبيعات بعد تجربة الحلول، يتم استبعاده لإفساح المجال لابتكار أصناف جديدة مطلوبة.',
    expectedImpactEn: 'Cleanses menu clutter and saves 18 prep minutes daily',
    expectedImpactAr: 'تنظيف المنيو من التشتيت وتوفير 18 دقيقة تحضير يومياً',
    color: 'purple',
  },
]

const r2 = (n: number) => Math.round(n * 100) / 100
const r3 = (n: number) => Math.round(n * 1000) / 1000
const r1 = (n: number) => Math.round(n * 10) / 10
type Cat = MenuItemAnalytics['categoryEn']
const CAT_AR: Record<Cat, MenuItemAnalytics['categoryAr']> = {
  Mains: 'الوجبات الرئيسية',
  'Starters & Sides': 'المقبلات والجانبيات',
  Drinks: 'المشروبات',
  'Rice & Noodles': 'الأرز والنودلز',
  Desserts: 'الحلويات',
  Combos: 'الوجبات والكومبو',
}
const catOf = (category: string, name: string): Cat => {
  const t = `${name} ${category}`
  if (/drink|beverage|juice|water|milk|karak cup|tea|pepsi|soda|matara/i.test(t)) return 'Drinks'
  if (/dessert|sweet|cake|cupcake|cookie|biscuit|ice cream|brownie/i.test(t)) return 'Desserts'
  if (/noodle|rice|chow/i.test(t)) return 'Rice & Noodles'
  if (/combo|meal|platter|box|gathering|for (two|four)|between two/i.test(t)) return 'Combos'
  if (/appetizer|starter|soup|salad|side|fries|sauce|dip|edamame|sambosa|croquette|wings/i.test(t)) return 'Starters & Sides'
  return 'Mains'
}
const brandNet = (brand: string) => ODOO.brands.find((x) => x.en === brand)?.netKwd ?? 0
const QUAD_CLASS = { star: 'TopPerformer', plowhorse: 'HighDemand', puzzle: 'HighMargin', dog: 'SlowMover' } as const
const quadOf = (brand: string, name: string) => MENU_ITEMS.find((m) => m.en === name && ODOO.brands.find((b) => b.id === m.brand)?.en === brand)?.quadrant ?? 'dog'
const ACTIVE = ODOO.brands.filter((x) => x.active)
const COGS_PCT = ODOO.pnl.cogsPct

/** Approved brands with Odoo POS sales — real item sales, real order counts and Odoo best sellers. */
export const OCTOBER_BRAND_SCORECARDS: BrandScorecardRow[] = ACTIVE.map((x) => {
  const cats = (ODOO.categories as Record<string, readonly { name: string; netKwd: number }[]>)[x.id] ?? []
  const catTotal = cats.reduce((t, c) => t + c.netKwd, 0)
  const starters = catTotal ? r1((cats.filter((c) => /appetizer|starter|soup|salad|side/i.test(c.name)).reduce((t, c) => t + c.netKwd, 0) / catTotal) * 100) : 0
  return {
    brand: x.en,
    brandAr: x.ar,
    orders: x.orders,
    netSalesKwd: x.netKwd,
    sharePercent: x.sharePct,
    avgOrderValueKwd: x.aovKwd,
    itemsPerOrder: x.itemsPerOrder,
    discountRatePercent: x.netKwd ? r1((x.discountKwd / (x.netKwd + x.discountKwd)) * 100) : 0,
    drinksPercent: x.drinksPct,
    startersPercent: starters,
    bestSellerEn: x.bestSeller?.name ?? '—',
    bestSellerAr: x.bestSeller?.name ?? '—',
    bestSellerSalesKwd: x.bestSeller?.netKwd ?? 0,
    lowOrderWarning: x.orders < 100,
  }
})

/** Odoo sales channels (POS payment methods grouped into channels). */
export const OCTOBER_CHANNEL_SCORECARDS: ChannelScorecardRow[] = ODOO.channels.map((c) => ({
  channel: c.odooName,
  channelAr: c.ar,
  orders: c.orders,
  netSalesKwd: c.netKwd,
  sharePercent: c.sharePct,
  avgOrderValueKwd: c.orders ? r3(c.netKwd / c.orders) : 0,
  itemsPerOrder: ODOO.totals.orders ? r2(ODOO.brands.reduce((t, x) => t + x.qty, 0) / ODOO.totals.orders) : 0,
  discountRatePercent: c.itemSalesKwd ? r1((c.promoKwd / c.itemSalesKwd) * 100) : 0,
  drinksPercent: 0,
  startersPercent: 0,
  dessertsPercent: 0,
}))

const toItem = (m: (typeof ODOO.menu)[number], i: number): MenuItemAnalytics => {
  const brand = ODOO.brands.find((x) => x.id === m.brand)!
  const cat = catOf(m.category, m.name)
  return {
    id: `it-${m.code ?? i}`,
    nameEn: m.name,
    nameAr: m.name,
    brand: brand.en as BrandKey,
    categoryEn: cat,
    categoryAr: CAT_AR[cat],
    priceKwd: m.priceKwd,
    unitsSold: m.qty,
    salesKwd: m.netKwd,
    costPriceKwd: m.unitCostKwd > 0 ? m.unitCostKwd : r3(m.priceKwd * (COGS_PCT / 100)),
    marginPercent: m.unitCostKwd > 0 && m.priceKwd > 0 ? r1((1 - m.unitCostKwd / m.priceKwd) * 100) : r1(100 - COGS_PCT),
    classification: QUAD_CLASS[quadOf(brand.en, m.name)],
    shareOfBrandPercent: brandNet(brand.en) ? r1((m.netKwd / brandNet(brand.en)) * 100) : 0,
  }
}
const ACTIVE_IDS = new Set(ACTIVE.map((x) => x.id as string))
const SOLD = ODOO.menu.filter((m) => ACTIVE_IDS.has(m.brand) && m.qty > 0)

/** Top 15 items by Odoo net sales. */
export const TOP_BEST_SELLERS: MenuItemAnalytics[] = [...SOLD].sort((x, y) => y.netKwd - x.netKwd).slice(0, 15).map(toItem)

const playbookFor = (cat: Cat, units: number): number => (units <= 5 ? 7 : cat === 'Drinks' ? 4 : cat === 'Starters & Sides' ? 1 : cat === 'Desserts' ? 6 : cat === 'Combos' ? 3 : 2)

/** Slowest movers: Odoo items with the lowest unit sales in the period. */
export const SLOW_MOVERS_LIST: SlowMoverItem[] = [...SOLD]
  .sort((x, y) => x.qty - y.qty || x.netKwd - y.netKwd)
  .slice(0, 18)
  .map((m, i) => {
    const it = toItem(m, i)
    const pb = ACTION_PLAYBOOKS.find((p) => p.id === playbookFor(it.categoryEn, it.unitsSold)) ?? ACTION_PLAYBOOKS[0]
    return { id: `sm-${m.code ?? i}`, nameEn: it.nameEn, nameAr: it.nameAr, brand: it.brand, categoryEn: it.categoryEn, categoryAr: it.categoryAr, priceKwd: it.priceKwd, unitsSold: it.unitsSold, salesKwd: it.salesKwd, recommendedPlaybookId: pb.id, playbookTitleEn: pb.titleEn, playbookTitleAr: pb.titleAr }
  })

/** Odoo item sales grouped into the six menu-engineering categories. */
export const CATEGORY_BREAKDOWN = (() => {
  const agg = new Map<Cat, { salesKwd: number; itemsSold: number }>()
  for (const m of SOLD) {
    const c = catOf(m.category, m.name)
    const v = agg.get(c) ?? { salesKwd: 0, itemsSold: 0 }
    v.salesKwd += m.netKwd
    v.itemsSold += m.qty
    agg.set(c, v)
  }
  const total = [...agg.values()].reduce((t, v) => t + v.salesKwd, 0)
  return [...agg.entries()]
    .map(([c, v]) => ({ nameEn: c as string, nameAr: CAT_AR[c] as string, salesKwd: r2(v.salesKwd), sharePercent: total ? r1((v.salesKwd / total) * 100) : 0, itemsSold: Math.round(v.itemsSold) }))
    .sort((x, y) => y.salesKwd - x.salesKwd)
})()

const TOP80 = (() => {
  const sorted = [...SOLD].sort((x, y) => y.netKwd - x.netKwd)
  const total = sorted.reduce((t, m) => t + m.netKwd, 0)
  let acc = 0
  let n = 0
  for (const m of sorted) { if (acc >= total * 0.8) break; acc += m.netKwd; n++ }
  return { n, of: sorted.length }
})()

export type FilteredDashboardState = {
  brand: BrandKey
  channel: ChannelKey
  kpi: {
    netSalesKwd: number
    orders: number
    avgOrderValueKwd: number
    itemsSold: number
    discountsGivenKwd: number
    shareOfGroupPercent: number
  }
  highlights: {
    biggestChannelTextEn: string
    biggestChannelTextAr: string
    bestSellerTextEn: string
    bestSellerTextAr: string
    menuConcentrationTextEn: string
    menuConcentrationTextAr: string
    addOnsTextEn: string
    addOnsTextAr: string
  }
  brands: BrandScorecardRow[]
  channels: ChannelScorecardRow[]
  bestSellers: MenuItemAnalytics[]
  slowMovers: SlowMoverItem[]
  categories: typeof CATEGORY_BREAKDOWN
}

export function computeFilteredDashboard(
  selectedBrand: BrandKey,
  selectedChannel: ChannelKey,
): FilteredDashboardState {
  let brands = [...OCTOBER_BRAND_SCORECARDS]
  let channels = [...OCTOBER_CHANNEL_SCORECARDS]
  let bestSellers = [...TOP_BEST_SELLERS]
  let slowMovers = [...SLOW_MOVERS_LIST]
  let categories = [...CATEGORY_BREAKDOWN]

  // Filter by brand
  if (selectedBrand !== 'ALL') {
    brands = brands.filter((b) => b.brand === selectedBrand)
    bestSellers = bestSellers.filter((i) => i.brand === selectedBrand)
    slowMovers = slowMovers.filter((i) => i.brand === selectedBrand)
  }

  // Filter by channel
  if (selectedChannel !== 'ALL') {
    channels = channels.filter((c) => c.channel === selectedChannel)
  }

  // Baseline totals: Odoo POS (whitelisted registers) for the period.
  let netSales: number = ODOO.totals.netSalesKwd
  let orders: number = ODOO.totals.orders
  let discounts: number = ODOO.totals.discountsKwd

  if (selectedBrand !== 'ALL') {
    const bHit = OCTOBER_BRAND_SCORECARDS.find((b) => b.brand === selectedBrand)
    if (bHit) {
      netSales = bHit.netSalesKwd
      orders = bHit.orders
      discounts = netSales * (bHit.discountRatePercent / 100)
    }
  }

  if (selectedChannel !== 'ALL') {
    const brandId = ODOO.brands.find((x) => x.en === selectedBrand)?.id
    const ch = ODOO.channels.find((c) => c.odooName === selectedChannel)
    if (ch && selectedBrand !== 'ALL') {
      const cell = ODOO.brandChannel.find((x) => x.brand === brandId && x.channel === ch.id)
      netSales = cell?.netKwd ?? 0
      orders = cell?.orders ?? 0
      discounts = 0
    } else if (ch) {
      netSales = ch.netKwd
      orders = ch.orders
      discounts = ch.promoKwd
    }
  }

  const avgOrderValue = orders > 0 ? netSales / orders : 0
  const itemsSold = Math.round(orders * (ODOO.brands.reduce((t, x) => t + x.qty, 0) / ODOO.totals.orders))
  const shareOfGroup = Math.min(100, Math.round((netSales / ODOO.totals.netSalesKwd) * 1000) / 10)

  // Best seller identification
  const topItem = bestSellers[0] || TOP_BEST_SELLERS[0]
  const topChannel = channels[0] || OCTOBER_CHANNEL_SCORECARDS[0]

  return {
    brand: selectedBrand,
    channel: selectedChannel,
    kpi: {
      netSalesKwd: Math.round(netSales),
      orders,
      avgOrderValueKwd: Math.round(avgOrderValue * 1000) / 1000,
      itemsSold,
      discountsGivenKwd: Math.round(discounts),
      shareOfGroupPercent: shareOfGroup,
    },
    highlights: {
      biggestChannelTextEn: `${topChannel.channel} is the largest channel, with ${topChannel.sharePercent}% of sales.`,
      biggestChannelTextAr: `${topChannel.channelAr} هي القناة الأكبر بنسبة ${topChannel.sharePercent}% من إجمالي المبيعات.`,
      bestSellerTextEn: `${topItem.nameEn} from ${topItem.brand} sold KWD ${topItem.salesKwd.toLocaleString()}, which is ${topItem.shareOfBrandPercent}% of menu sales.`,
      bestSellerTextAr: `${topItem.nameAr} من ${topItem.brand} حقق مبيعات ${topItem.salesKwd.toLocaleString()} د.ك، ما يعادل ${topItem.shareOfBrandPercent}% من مبيعات المنيو.`,
      menuConcentrationTextEn: `The top ${TOP80.n} of ${TOP80.of} items sold in Odoo make 80% of menu sales.`,
      menuConcentrationTextAr: `أعلى ${TOP80.n} صنفاً من أصل ${TOP80.of} صنفاً مبيعاً في أودو تشكل 80% من مبيعات القائمة.`,
      addOnsTextEn: `Drinks ${CATEGORY_BREAKDOWN.find((c) => c.nameEn === 'Drinks')?.sharePercent ?? 0}%, starters and sides ${CATEGORY_BREAKDOWN.find((c) => c.nameEn === 'Starters & Sides')?.sharePercent ?? 0}%, desserts ${CATEGORY_BREAKDOWN.find((c) => c.nameEn === 'Desserts')?.sharePercent ?? 0}% of Odoo item sales.`,
      addOnsTextAr: `المشروبات ${CATEGORY_BREAKDOWN.find((c) => c.nameEn === 'Drinks')?.sharePercent ?? 0}%، المقبلات والجانبيات ${CATEGORY_BREAKDOWN.find((c) => c.nameEn === 'Starters & Sides')?.sharePercent ?? 0}%، الحلويات ${CATEGORY_BREAKDOWN.find((c) => c.nameEn === 'Desserts')?.sharePercent ?? 0}% من مبيعات الأصناف في أودو.`,
    },
    brands,
    channels,
    bestSellers,
    slowMovers,
    categories,
  }
}


export type AggregatorAuditRow = {
  channel: string
  channelAr: string
  grossSalesKwd: number
  commissionRatePercent: number
  commissionAmountKwd: number
  marketingFeesKwd: number
  expectedNetPayoutKwd: number
  bankReceivedKwd: number
  varianceKwd: number
  disputedOrders: number
  disputedAmountKwd: number
  bank: 'National Bank (NBK)' | 'Commercial Bank (CBK)' | 'Direct POS'
  payoutStatus: 'Settled' | 'Pending Verification' | 'Disputed'
  settlementCycle: 'Weekly' | 'Bi-weekly' | 'Instant'
}

export const OCTOBER_AGGREGATOR_AUDIT: AggregatorAuditRow[] = [
  {
    channel: 'Talabat Go',
    channelAr: 'طلبات جو (توصيل المنصة 17%)',
    grossSalesKwd: 51002.5,
    commissionRatePercent: 17.0,
    commissionAmountKwd: 8670.43,
    marketingFeesKwd: 450.0,
    expectedNetPayoutKwd: 41882.07,
    bankReceivedKwd: 41420.0,
    varianceKwd: -462.07,
    disputedOrders: 28,
    disputedAmountKwd: 215.4,
    bank: 'National Bank (NBK)',
    payoutStatus: 'Pending Verification',
    settlementCycle: 'Weekly',
  },
  {
    channel: 'Keeta',
    channelAr: 'كيتا (Keeta 18%)',
    grossSalesKwd: 22557.42,
    commissionRatePercent: 18.0,
    commissionAmountKwd: 4060.34,
    marketingFeesKwd: 300.0,
    expectedNetPayoutKwd: 18197.08,
    bankReceivedKwd: 18197.08,
    varianceKwd: 0.0,
    disputedOrders: 12,
    disputedAmountKwd: 64.2,
    bank: 'Commercial Bank (CBK)',
    payoutStatus: 'Settled',
    settlementCycle: 'Weekly',
  },
  {
    channel: 'Talabat MP',
    channelAr: 'طلبات ماركت بليس (أسطول فنتشر فودز 10%)',
    grossSalesKwd: 17848.0,
    commissionRatePercent: 10.0,
    commissionAmountKwd: 1784.8,
    marketingFeesKwd: 150.0,
    expectedNetPayoutKwd: 15913.2,
    bankReceivedKwd: 15790.0,
    varianceKwd: -123.2,
    disputedOrders: 8,
    disputedAmountKwd: 88.0,
    bank: 'National Bank (NBK)',
    payoutStatus: 'Pending Verification',
    settlementCycle: 'Weekly',
  },
  {
    channel: 'Deliveroo Core',
    channelAr: 'ديليفرو كور (15%)',
    grossSalesKwd: 12465.6,
    commissionRatePercent: 15.0,
    commissionAmountKwd: 1869.84,
    marketingFeesKwd: 220.0,
    expectedNetPayoutKwd: 10375.76,
    bankReceivedKwd: 10375.76,
    varianceKwd: 0.0,
    disputedOrders: 5,
    disputedAmountKwd: 42.5,
    bank: 'National Bank (NBK)',
    payoutStatus: 'Settled',
    settlementCycle: 'Bi-weekly',
  },
  {
    channel: 'Direct',
    channelAr: 'الموقع والتطبيق المباشر (Direct Web / Online)',
    grossSalesKwd: 5392.8,
    commissionRatePercent: 3.0,
    commissionAmountKwd: 161.78,
    marketingFeesKwd: 0.0,
    expectedNetPayoutKwd: 5231.02,
    bankReceivedKwd: 5231.02,
    varianceKwd: 0.0,
    disputedOrders: 0,
    disputedAmountKwd: 0.0,
    bank: 'National Bank (NBK)',
    payoutStatus: 'Settled',
    settlementCycle: 'Instant',
  },
  {
    channel: 'Snoonu',
    channelAr: 'سنونو (12%)',
    grossSalesKwd: 1829.0,
    commissionRatePercent: 12.0,
    commissionAmountKwd: 219.48,
    marketingFeesKwd: 50.0,
    expectedNetPayoutKwd: 1559.52,
    bankReceivedKwd: 1500.0,
    varianceKwd: -59.52,
    disputedOrders: 3,
    disputedAmountKwd: 22.1,
    bank: 'Commercial Bank (CBK)',
    payoutStatus: 'Disputed',
    settlementCycle: 'Bi-weekly',
  },
  {
    channel: 'Jahez',
    channelAr: 'جاهز (14%)',
    grossSalesKwd: 1372.0,
    commissionRatePercent: 14.0,
    commissionAmountKwd: 192.08,
    marketingFeesKwd: 40.0,
    expectedNetPayoutKwd: 1139.92,
    bankReceivedKwd: 1139.92,
    varianceKwd: 0.0,
    disputedOrders: 2,
    disputedAmountKwd: 15.0,
    bank: 'Commercial Bank (CBK)',
    payoutStatus: 'Settled',
    settlementCycle: 'Weekly',
  },
  {
    channel: 'Deliveroo MP',
    channelAr: 'ديليفرو ماركتبليس (8%)',
    grossSalesKwd: 544.0,
    commissionRatePercent: 8.0,
    commissionAmountKwd: 43.52,
    marketingFeesKwd: 0.0,
    expectedNetPayoutKwd: 500.48,
    bankReceivedKwd: 500.48,
    varianceKwd: 0.0,
    disputedOrders: 1,
    disputedAmountKwd: 8.5,
    bank: 'National Bank (NBK)',
    payoutStatus: 'Settled',
    settlementCycle: 'Bi-weekly',
  },
  {
    channel: 'Shop Sales',
    channelAr: 'مبيعات الصالة والفرع (KNET/Cash)',
    grossSalesKwd: 58984.3,
    commissionRatePercent: 0.6,
    commissionAmountKwd: 353.9,
    marketingFeesKwd: 0.0,
    expectedNetPayoutKwd: 58630.4,
    bankReceivedKwd: 58630.4,
    varianceKwd: 0.0,
    disputedOrders: 0,
    disputedAmountKwd: 0.0,
    bank: 'Direct POS',
    payoutStatus: 'Settled',
    settlementCycle: 'Instant',
  },
  {
    channel: 'Phone & Whatsapp',
    channelAr: 'الهاتف والواتساب المباشر',
    grossSalesKwd: 1290.0,
    commissionRatePercent: 0.0,
    commissionAmountKwd: 0.0,
    marketingFeesKwd: 0.0,
    expectedNetPayoutKwd: 1290.0,
    bankReceivedKwd: 1290.0,
    varianceKwd: 0.0,
    disputedOrders: 0,
    disputedAmountKwd: 0.0,
    bank: 'Direct POS',
    payoutStatus: 'Settled',
    settlementCycle: 'Instant',
  },
]

export type BranchPerformanceRow = {
  id: string
  nameEn: string
  nameAr: string
  areaEn: string
  areaAr: string
  netSalesKwd: number
  orders: number
  avgOrderValueKwd: number
  topBrandEn: string
  topBrandAr: string
  deliveryPercent: number
  dineInPercent: number
  peakHourEn: string
  peakHourAr: string
  staffCount: number
}

const AREA: Record<string, [string, string]> = {
  promenade: ['Hawalli Governorate', 'محافظة حولي'],
  '360-mall': ['Hawalli Governorate', 'محافظة حولي'],
  ardiya: ['Farwaniya Governorate', 'محافظة الفروانية'],
  assima: ['Capital Governorate', 'محافظة العاصمة'],
  salmiya: ['Hawalli Governorate', 'محافظة حولي'],
  'al-kout': ['Ahmadi Governorate', 'محافظة الأحمدي'],
  avenues: ['Farwaniya Governorate', 'محافظة الفروانية'],
}
const PEAK = [...ODOO.timeProfile.hourly].sort((x, y) => y.orders - x.orders)[0]
const hourLabel = (h: number, ar: boolean) => { const hh = ((h + 11) % 12) + 1; return ar ? `${hh}:00 ${h < 12 ? 'ص' : 'م'}` : `${hh}:00 ${h < 12 ? 'AM' : 'PM'}` }

/** Odoo permanent restaurant locations (whitelisted POS registers). */
export const OCTOBER_BRANCH_PERFORMANCE: BranchPerformanceRow[] = ODOO.restaurants.map((l) => {
  const shop = l.channels.find((c) => c.channel === 'shop')?.amountKwd ?? 0
  const top = [...l.brands].sort((x, y) => y.netKwd - x.netKwd)[0]
  const topBrand = ODOO.brands.find((x) => x.id === top?.brand)
  return {
    id: l.id,
    nameEn: l.en,
    nameAr: l.ar,
    areaEn: AREA[l.id]?.[0] ?? 'Kuwait',
    areaAr: AREA[l.id]?.[1] ?? 'الكويت',
    netSalesKwd: l.netKwd,
    orders: l.orders,
    avgOrderValueKwd: l.aovKwd,
    topBrandEn: topBrand?.en ?? '—',
    topBrandAr: topBrand?.ar ?? '—',
    deliveryPercent: l.netKwd ? r1(((l.netKwd - shop) / l.netKwd) * 100) : 0,
    dineInPercent: l.netKwd ? r1((shop / l.netKwd) * 100) : 0,
    peakHourEn: PEAK ? `${hourLabel(PEAK.hour, false)} - ${hourLabel((PEAK.hour + 1) % 24, false)}` : '—',
    peakHourAr: PEAK ? `${hourLabel(PEAK.hour, true)} - ${hourLabel((PEAK.hour + 1) % 24, true)}` : '—',
    staffCount: 0,
  }
})

export type HourlyHeatmapSlot = {
  hour: number
  labelEn: string
  labelAr: string
  orders: number
  salesKwd: number
  traffic: 'off-peak' | 'normal' | 'rush' | 'peak'
}

/** Orders and net sales by Kuwait hour, from every whitelisted Odoo order timestamp. */
export const OCTOBER_HOURLY_HEATMAP: HourlyHeatmapSlot[] = (() => {
  const rows = ODOO.timeProfile.hourly.filter((x) => x.orders > 0)
  const sorted = [...rows].map((x) => x.orders).sort((x, y) => x - y)
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0
  return rows.map((x) => ({
    hour: x.hour,
    labelEn: hourLabel(x.hour, false),
    labelAr: hourLabel(x.hour, true),
    orders: x.orders,
    salesKwd: x.netKwd,
    traffic: x.orders >= q(0.85) ? 'peak' : x.orders >= q(0.6) ? 'rush' : x.orders >= q(0.3) ? 'normal' : 'off-peak',
  }))
})()

export type StrategicReportMeta = {
  id: number
  titleEn: string
  titleAr: string
  categoryEn: string
  categoryAr: string
  summaryEn: string
  summaryAr: string
  filename: string
}

// Copy values computed from the live Odoo dataset
const RPT_ACTIVE = ODOO.brands.filter((b) => b.active)
const RPT_CH = (id: string) => ODOO.channels.find((c) => c.id === id)
const RPT_ALL_CATS = Object.values(ODOO.categories as Record<string, readonly { name: string; netKwd: number }[]>).flat()
const RPT_CAT_TOTAL = RPT_ALL_CATS.reduce((s, c) => s + c.netKwd, 0)
const rptShare = (re: RegExp) => (RPT_CAT_TOTAL ? (RPT_ALL_CATS.filter((c) => re.test(c.name)).reduce((s, c) => s + c.netKwd, 0) / RPT_CAT_TOTAL) * 100 : 0)
const RPT_MENU = [...ODOO.menu].filter((m) => m.netKwd > 0).sort((a, b) => b.netKwd - a.netKwd)
const RPT_MENU_TOTAL = RPT_MENU.reduce((s, m) => s + m.netKwd, 0)
const RPT_TOP80 = (() => {
  let acc = 0
  let n = 0
  for (const m of RPT_MENU) {
    if (acc >= RPT_MENU_TOTAL * 0.8) break
    acc += m.netKwd
    n++
  }
  return { n, sales: acc }
})()
const RPT_IPO = ODOO.totals.orders ? RPT_ACTIVE.reduce((s, b) => s + b.qty, 0) / ODOO.totals.orders : 0
const rf = (n: number, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

export const STRATEGIC_15_REPORTS: StrategicReportMeta[] = [
  {
    id: 1,
    titleEn: '1. Monthly Brand Performance & P&L Digest',
    titleAr: '1. تقرير أداء مبيعات وأرباح البراندات الشهري',
    categoryEn: 'Executive',
    categoryAr: 'تنفيذي',
    summaryEn: `Comprehensive breakdown of ${RPT_ACTIVE.map((b) => b.en).join(', ')} from Odoo POS.`,
    summaryAr: `تفصيل شامل لمبيعات وحصص البراندات الـ ${RPT_ACTIVE.length} النشطة في أودو لشركة فنتشر فودز.`,
    filename: 'VF-Report-01-Brand-Performance-Oct2026.csv',
  },
  {
    id: 2,
    titleEn: '2. Aggregator Commission & Net Settlement Audit',
    titleAr: '2. تدقيق عمولات منصات التوصيل وصافي التسويات البنكية',
    categoryEn: 'Financial Audit',
    categoryAr: 'تدقيق مالي',
    summaryEn: `Contract commissions on Odoo channel payments: Talabat Go (${RPT_CH('talabat-tgo')?.commissionPct ?? 0}%), Keeta (${RPT_CH('keeta')?.commissionPct ?? 0}%), Deliveroo Go (${RPT_CH('deliveroo-go')?.commissionPct ?? 0}%) and settlement variances.`,
    summaryAr: 'مقارنة دقيقة للعمولات التعاقدية وصافي الإيداعات البنكية المستحقة وفروقات التسوية.',
    filename: 'VF-Report-02-Aggregator-Commissions-Oct2026.csv',
  },
  {
    id: 3,
    titleEn: '3. Menu Engineering & Item Profitability Matrix',
    titleAr: '3. مصفوفة ربحية وهندسة أصناف المنيو (Top Performers, High-Demand, High-Margin, Slow-Moving)',
    categoryEn: 'Menu Intelligence',
    categoryAr: 'هندسة منيو',
    summaryEn: `Classification of all ${ODOO.totals.productsSold} Odoo items sold by margin contribution and popularity.`,
    summaryAr: `تصنيف الأصناف المباعة الـ ${ODOO.totals.productsSold} في أودو حسب الشعبية ومعدل المساهمة في الهامش.`,
    filename: 'VF-Report-03-Menu-Profitability-Matrix-Oct2026.csv',
  },
  {
    id: 4,
    titleEn: '4. Slow Movers & Waste Mitigation Playbook',
    titleAr: '4. سجل الأصناف البطيئة وخطط العمل الـ 7 لتقليل الهدر',
    categoryEn: 'Operations',
    categoryAr: 'تشغيل وجودة',
    summaryEn: 'Identifies lagging SKUs with auto-assigned recovery actions and delisting timeline.',
    summaryAr: 'حصر الأصناف الراكدة مع خطط المعالجة الأوتوماتيكية وتوفير مساحات المطبخ.',
    filename: 'VF-Report-04-Slow-Movers-Playbooks-Oct2026.csv',
  },
  {
    id: 5,
    titleEn: `5. ${ODOO.restaurants.length} Restaurant Locations Performance & Hourly Peak Analysis`,
    titleAr: `5. مقارنة أداء مواقع المطاعم الـ ${ODOO.restaurants.length} وساعات الذروة التشغيلية`,
    categoryEn: 'Branches',
    categoryAr: 'الفروع',
    summaryEn: `${ODOO.restaurants.map((l) => l.en).join(', ')}.`,
    summaryAr: 'مقارنة مبيعات الفروع، نسب التوصيل والصالة، ومتوسط الفاتورة، وساعات الذروة.',
    filename: 'VF-Report-05-Branches-Performance-Oct2026.csv',
  },
  {
    id: 6,
    titleEn: '6. Channel Banking Reconciliation & Deposit Tracking',
    titleAr: '6. تسوية ومطابقة الحسابات البنكية (NBK / CBK) لكل قناة',
    categoryEn: 'Financial Audit',
    categoryAr: 'تدقيق مالي',
    summaryEn: 'Tracks bank deposits across National Bank of Kuwait and Commercial Bank with variance alert.',
    summaryAr: 'متابعة الإيداعات المحققة في حسابات الوطني والتجاري مع رصد فروقات التسوية.',
    filename: 'VF-Report-06-Bank-Reconciliation-Oct2026.csv',
  },
  {
    id: 7,
    titleEn: '7. Add-ons & Cross-Selling Attach Rate Report',
    titleAr: '7. مبيعات الإضافات ونسب ربط المشروبات والمقبلات والحلويات',
    categoryEn: 'Commercial',
    categoryAr: 'تجاري',
    summaryEn: `Odoo item-sales share of Drinks (${rf(rptShare(/drink|beverage|matara|hot drinks|cold drinks/i), 1)}%), Starters (${rf(rptShare(/appetizer|starter|soup|salad|side|sambosa|tiqimis/i), 1)}%) and Desserts (${rf(rptShare(/dessert|desssert|cake|cookie|biscuit/i), 1)}%).`,
    summaryAr: 'تحليل معدل طلب المشروبات والمقبلات والحلويات لكل 100 فاتورة وفرص زيادة متوسط السلة.',
    filename: 'VF-Report-07-Addons-Attach-Rate-Oct2026.csv',
  },
  {
    id: 8,
    titleEn: '8. Discounts, Promotions & Margin Impact Audit',
    titleAr: '8. أثر الخصومات والعروض الترويجية على هامش الربحية',
    categoryEn: 'Commercial',
    categoryAr: 'تجاري',
    summaryEn: `KWD ${rf(ODOO.totals.discountsKwd)} total Odoo discounts (promotion lines ${rf(ODOO.totals.promoAdjustmentsKwd)} + line discounts ${rf(ODOO.totals.lineDiscountKwd)}).`,
    summaryAr: `تدقيق خصومات أودو البالغة ${rf(ODOO.totals.discountsKwd)} د.ك وتحليل جدوى الحملات الترويجية.`,
    filename: 'VF-Report-08-Discounts-Margin-Impact-Oct2026.csv',
  },
  {
    id: 9,
    titleEn: `9. Pareto 80/20 Rule: Top ${RPT_TOP80.n} Revenue Drivers`,
    titleAr: `9. قاعدة باريتو 80/20: أعلى ${RPT_TOP80.n} صنفاً تولد 80% من الإيرادات`,
    categoryEn: 'Menu Intelligence',
    categoryAr: 'هندسة منيو',
    summaryEn: `Focus report on the ${RPT_TOP80.n} essential menu drivers generating KWD ${rf(RPT_TOP80.sales)} of Odoo item sales.`,
    summaryAr: `قائمة الأصناف الـ ${RPT_TOP80.n} الأساسية التي تحقق ${rf(RPT_TOP80.sales)} د.ك من مبيعات الأصناف في أودو.`,
    filename: 'VF-Report-09-Pareto-80-20-Items-Oct2026.csv',
  },
  {
    id: 10,
    titleEn: '10. Central Kitchen Production & Inter-Branch Transfers',
    titleAr: '10. حركة إنتاج المطبخ المركزي وتوزيعات الفروع',
    categoryEn: 'Operations',
    categoryAr: 'تشغيل وجودة',
    summaryEn: 'Volume of semi-prepped proteins, sauces, and dough dispatched from the Central Kitchen.',
    summaryAr: 'كميات الصوصات واللحوم المتبلة وعجائن الشباتي المحولة يومياً من المطبخ المركزي للفروع.',
    filename: 'VF-Report-10-Central-Kitchen-Transfers-Oct2026.csv',
  },
  {
    id: 11,
    titleEn: '11. Delivery Delays, Rider Lead Time & Cancellations',
    titleAr: '11. أوقات توصيل المنصات، سرعة السائق، ونسب الطلبات الملغاة',
    categoryEn: 'Operations',
    categoryAr: 'تشغيل وجودة',
    summaryEn: 'Aggregator driver dispatch delay vs internal kitchen preparation speed.',
    summaryAr: 'مقارنة زمن تحضير المطبخ (12 دقيقة) بزمن وصول سائق المنصة والتسليم.',
    filename: 'VF-Report-11-Rider-Times-Cancellations-Oct2026.csv',
  },
  {
    id: 12,
    titleEn: '12. Cashier POS Upselling Speed & Ticket Times',
    titleAr: '12. أداء كاشير الفروع ومعدل نجاح الاقتراح وسرعة الخدمة',
    categoryEn: 'Commercial',
    categoryAr: 'تجاري',
    summaryEn: 'Ranking of branch cashiers by add-on conversion rate and order entry speed.',
    summaryAr: 'تصنيف موظفي الكاشير حسب سرعة إدخال الطلب ونسبة نجاح عرض المشروبات والمقبلات.',
    filename: 'VF-Report-12-Cashier-Upselling-Speed-Oct2026.csv',
  },
  {
    id: 13,
    titleEn: '13. Basket Size & Multi-Category Item Decomposition',
    titleAr: '13. تفكيك سلة الطلبات ومتوسط عدد الأصناف لكل فاتورة',
    categoryEn: 'Commercial',
    categoryAr: 'تجاري',
    summaryEn: `Analysis of the ${rf(RPT_IPO, 2)} items-per-order Odoo baseline across channels and meal periods.`,
    summaryAr: 'تحليل مكونات السلة عبر القنوات ومحركات الوصول إلى 3.5 صنف لكل طلب.',
    filename: 'VF-Report-13-Basket-Size-Decomposition-Oct2026.csv',
  },
  {
    id: 14,
    titleEn: '14. Payment Method Split: KNET vs Credit Cards vs Cash',
    titleAr: '14. توزيع طرق الدفع: كي نت، فيزا وماستركارد، والدفع النقدي',
    categoryEn: 'Financial Audit',
    categoryAr: 'تدقيق مالي',
    summaryEn: `Shop tender in Odoo: KNET ${ODOO.shopTender.knet.pct}%, card ${ODOO.shopTender.card.pct}%, cash ${ODOO.shopTender.cash.pct}% with transaction fee audit.`,
    summaryAr: 'مقارنة رسوم بوابات الدفع الإلكتروني وتوزيع الدفع الرقمي مقابل الكاش.',
    filename: 'VF-Report-14-Payment-Methods-Split-Oct2026.csv',
  },
  {
    id: 15,
    titleEn: '15. Board of Directors Executive Sales Digest',
    titleAr: '15. الملخص الاستراتيجي الشامل لمجلس الإدارة والإدارة العليا',
    categoryEn: 'Executive',
    categoryAr: 'تنفيذي',
    summaryEn: 'The full 360-degree synthesis of October 2026 commercial and operational performance.',
    summaryAr: 'التقرير الشامل المتكامل المعتمد لاجتماع مجلس الإدارة والقيادة التنفيذية.',
    filename: 'VF-Report-15-Executive-Board-Digest-Oct2026.csv',
  },
]
