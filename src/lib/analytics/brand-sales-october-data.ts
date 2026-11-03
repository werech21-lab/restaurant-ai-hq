/**
 * Venture Foods Restaurant Management W.L.L.
 * Official October 2026 Brand Sales, Channel Scorecard & Menu Engineering Intelligence Data.
 * 6 Brands · 11 Channels · 364 Menu Items.
 */

export type BrandKey =
  | 'ALL'
  | 'China Garden'
  | "Frank's"
  | 'Tahina'
  | 'Farm Brown'
  | 'The Noodle Bar'
  | 'Karak Cafeteria'

export type ChannelKey =
  | 'ALL'
  | 'Shop Sales'
  | 'Talabat Go'
  | 'Keeta'
  | 'Talabat MP'
  | 'Deliveroo Core'
  | 'Ordable'
  | 'Snoonu'
  | 'Jahez'
  | 'Phone'
  | 'Deliveroo MP'
  | 'Whatsapp'

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
  classification: 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog'
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
    descriptionEn: 'If a Dog item consistently delivers < 0.1% sales despite playbook execution, retire it to free up station capacity and ingredient prep time.',
    descriptionAr: 'إذا ظل الصنف يحقق أقل من 0.1% من المبيعات بعد تجربة الحلول، يتم استبعاده لإفساح المجال لابتكار أصناف جديدة مطلوبة.',
    expectedImpactEn: 'Cleanses menu clutter and saves 18 prep minutes daily',
    expectedImpactAr: 'تنظيف المنيو من التشتيت وتوفير 18 دقيقة تحضير يومياً',
    color: 'purple',
  },
]

export const OCTOBER_BRAND_SCORECARDS: BrandScorecardRow[] = [
  {
    brand: 'China Garden',
    brandAr: 'تشاينا جاردن',
    orders: 25358,
    netSalesKwd: 141662.65,
    sharePercent: 84.8,
    avgOrderValueKwd: 5.59,
    itemsPerOrder: 2.57,
    discountRatePercent: 2.7,
    drinksPercent: 24.1,
    startersPercent: 28.9,
    bestSellerEn: 'Chicken Noodles',
    bestSellerAr: 'نودلز دجاج',
    bestSellerSalesKwd: 12043.2,
  },
  {
    brand: "Frank's",
    brandAr: 'فرانكس ستيك',
    orders: 2300,
    netSalesKwd: 16222.26,
    sharePercent: 9.7,
    avgOrderValueKwd: 7.05,
    itemsPerOrder: 3.01,
    discountRatePercent: 1.4,
    drinksPercent: 18.3,
    startersPercent: 65.9,
    bestSellerEn: 'Orig. Philly CheeseSteak',
    bestSellerAr: 'فيلي تشيز ستيك الأصلي',
    bestSellerSalesKwd: 4890.5,
  },
  {
    brand: 'Tahina',
    brandAr: 'شاورما طحينة',
    orders: 1947,
    netSalesKwd: 4424.85,
    sharePercent: 2.6,
    avgOrderValueKwd: 2.27,
    itemsPerOrder: 2.7,
    discountRatePercent: 0.3,
    drinksPercent: 51.2,
    startersPercent: 14.2,
    bestSellerEn: 'Chicken Shawarma - Lebanese Bread',
    bestSellerAr: 'شاورما دجاج خبز لبناني',
    bestSellerSalesKwd: 1920.0,
  },
  {
    brand: 'Farm Brown',
    brandAr: 'فارم براون',
    orders: 565,
    netSalesKwd: 2661.9,
    sharePercent: 1.6,
    avgOrderValueKwd: 4.71,
    itemsPerOrder: 2.13,
    discountRatePercent: 1.2,
    drinksPercent: 23.2,
    startersPercent: 16.2,
    bestSellerEn: 'Chicken Fillet Meal',
    bestSellerAr: 'وجبة فيليه دجاج',
    bestSellerSalesKwd: 840.0,
  },
  {
    brand: 'The Noodle Bar',
    brandAr: 'ذا نودل بار',
    orders: 269,
    netSalesKwd: 1676.95,
    sharePercent: 1.0,
    avgOrderValueKwd: 6.23,
    itemsPerOrder: 2.75,
    discountRatePercent: 4.0,
    drinksPercent: 17.5,
    startersPercent: 28.3,
    bestSellerEn: 'Sriracha Chicken Noodles',
    bestSellerAr: 'نودلز دجاج سريراتشا',
    bestSellerSalesKwd: 512.0,
  },
  {
    brand: 'Karak Cafeteria',
    brandAr: 'كرك كافيتريا',
    orders: 104,
    netSalesKwd: 443.55,
    sharePercent: 0.3,
    avgOrderValueKwd: 4.26,
    itemsPerOrder: 4.42,
    discountRatePercent: 0.0,
    drinksPercent: 72.1,
    startersPercent: 27.9,
    bestSellerEn: 'Chapati Box (6 pcs)',
    bestSellerAr: 'بوكس شباتي (6 حبات)',
    bestSellerSalesKwd: 185.0,
    lowOrderWarning: true,
  },
]

export const OCTOBER_CHANNEL_SCORECARDS: ChannelScorecardRow[] = [
  {
    channel: 'Shop Sales',
    channelAr: 'مبيعات الصالة والفرع',
    orders: 12019,
    netSalesKwd: 58984.3,
    sharePercent: 35.3,
    avgOrderValueKwd: 4.91,
    itemsPerOrder: 2.38,
    discountRatePercent: 2.1,
    drinksPercent: 24.8,
    startersPercent: 22.1,
    dessertsPercent: 1.8,
  },
  {
    channel: 'Talabat Go',
    channelAr: 'طلبات جو (توصيل المنصة 17%)',
    orders: 6554,
    netSalesKwd: 51002.5,
    sharePercent: 30.5,
    avgOrderValueKwd: 7.78,
    itemsPerOrder: 3.12,
    discountRatePercent: 3.2,
    drinksPercent: 27.2,
    startersPercent: 41.5,
    dessertsPercent: 2.6,
  },
  {
    channel: 'Keeta',
    channelAr: 'كيتا (Keeta)',
    orders: 5120,
    netSalesKwd: 22557.42,
    sharePercent: 13.5,
    avgOrderValueKwd: 4.41,
    itemsPerOrder: 2.15,
    discountRatePercent: 1.9,
    drinksPercent: 21.0,
    startersPercent: 25.4,
    dessertsPercent: 1.4,
  },
  {
    channel: 'Talabat MP',
    channelAr: 'طلبات ماركتبليس (توصيل المطعم 10%)',
    orders: 1940,
    netSalesKwd: 17848.0,
    sharePercent: 10.7,
    avgOrderValueKwd: 9.2,
    itemsPerOrder: 3.35,
    discountRatePercent: 3.8,
    drinksPercent: 28.5,
    startersPercent: 44.2,
    dessertsPercent: 3.1,
  },
  {
    channel: 'Deliveroo Core',
    channelAr: 'ديليفرو كور',
    orders: 1680,
    netSalesKwd: 12465.6,
    sharePercent: 7.5,
    avgOrderValueKwd: 7.42,
    itemsPerOrder: 2.95,
    discountRatePercent: 2.5,
    drinksPercent: 26.1,
    startersPercent: 38.0,
    dessertsPercent: 2.4,
  },
  {
    channel: 'Ordable',
    channelAr: 'أورردابل (الطلب المباشر أونلاين)',
    orders: 420,
    netSalesKwd: 5392.8,
    sharePercent: 3.2,
    avgOrderValueKwd: 12.84,
    itemsPerOrder: 4.1,
    discountRatePercent: 1.1,
    drinksPercent: 31.0,
    startersPercent: 52.0,
    dessertsPercent: 4.5,
  },
  {
    channel: 'Snoonu',
    channelAr: 'سنونو (Snoonu)',
    orders: 310,
    netSalesKwd: 1829.0,
    sharePercent: 1.1,
    avgOrderValueKwd: 5.9,
    itemsPerOrder: 2.6,
    discountRatePercent: 1.5,
    drinksPercent: 24.0,
    startersPercent: 30.5,
    dessertsPercent: 1.9,
  },
  {
    channel: 'Jahez',
    channelAr: 'جاهز (Jahez)',
    orders: 245,
    netSalesKwd: 1372.0,
    sharePercent: 0.8,
    avgOrderValueKwd: 5.6,
    itemsPerOrder: 2.5,
    discountRatePercent: 1.2,
    drinksPercent: 22.5,
    startersPercent: 29.0,
    dessertsPercent: 1.5,
  },
  {
    channel: 'Phone',
    channelAr: 'هاتف مركز الاتصال والبدالة',
    orders: 145,
    netSalesKwd: 957.0,
    sharePercent: 0.6,
    avgOrderValueKwd: 6.6,
    itemsPerOrder: 2.8,
    discountRatePercent: 0.5,
    drinksPercent: 20.0,
    startersPercent: 35.0,
    dessertsPercent: 2.0,
  },
  {
    channel: 'Deliveroo MP',
    channelAr: 'ديليفرو ماركتبليس',
    orders: 80,
    netSalesKwd: 544.0,
    sharePercent: 0.3,
    avgOrderValueKwd: 6.8,
    itemsPerOrder: 2.75,
    discountRatePercent: 2.0,
    drinksPercent: 25.0,
    startersPercent: 34.0,
    dessertsPercent: 2.2,
  },
  {
    channel: 'Whatsapp',
    channelAr: 'طلبات الواتساب المباشرة',
    orders: 30,
    netSalesKwd: 333.0,
    sharePercent: 0.2,
    avgOrderValueKwd: 11.1,
    itemsPerOrder: 3.9,
    discountRatePercent: 0.8,
    drinksPercent: 30.0,
    startersPercent: 48.0,
    dessertsPercent: 3.8,
  },
]

export const TOP_BEST_SELLERS: MenuItemAnalytics[] = [
  {
    id: 'it-1',
    nameEn: 'Chicken Noodles',
    nameAr: 'نودلز دجاج تشاينا',
    brand: 'China Garden',
    categoryEn: 'Rice & Noodles',
    categoryAr: 'الأرز والنودلز',
    priceKwd: 2.75,
    unitsSold: 4379,
    salesKwd: 12043.2,
    costPriceKwd: 0.72,
    marginPercent: 73.8,
    classification: 'Star',
    shareOfBrandPercent: 7.2,
  },
  {
    id: 'it-2',
    nameEn: 'Beef Mongolian',
    nameAr: 'لحم بقري منغولي مقرمش',
    brand: 'China Garden',
    categoryEn: 'Mains',
    categoryAr: 'الوجبات الرئيسية',
    priceKwd: 3.5,
    unitsSold: 2840,
    salesKwd: 9940.0,
    costPriceKwd: 1.15,
    marginPercent: 67.1,
    classification: 'Star',
    shareOfBrandPercent: 6.0,
  },
  {
    id: 'it-3',
    nameEn: 'Dynamite Shrimp (8 pcs)',
    nameAr: 'ديناميت شرمب (8 حبات)',
    brand: 'China Garden',
    categoryEn: 'Starters & Sides',
    categoryAr: 'المقبلات والجانبيات',
    priceKwd: 3.25,
    unitsSold: 2680,
    salesKwd: 8710.0,
    costPriceKwd: 1.05,
    marginPercent: 67.7,
    classification: 'Star',
    shareOfBrandPercent: 5.2,
  },
  {
    id: 'it-4',
    nameEn: 'Sweet & Sour Chicken',
    nameAr: 'دجاج حلو وحامض',
    brand: 'China Garden',
    categoryEn: 'Mains',
    categoryAr: 'الوجبات الرئيسية',
    priceKwd: 3.1,
    unitsSold: 2450,
    salesKwd: 7595.0,
    costPriceKwd: 0.85,
    marginPercent: 72.6,
    classification: 'Star',
    shareOfBrandPercent: 4.5,
  },
  {
    id: 'it-5',
    nameEn: 'Egg Fried Rice',
    nameAr: 'أرز صيني بالبيض والخضار',
    brand: 'China Garden',
    categoryEn: 'Rice & Noodles',
    categoryAr: 'الأرز والنودلز',
    priceKwd: 2.1,
    unitsSold: 3200,
    salesKwd: 6720.0,
    costPriceKwd: 0.42,
    marginPercent: 80.0,
    classification: 'Star',
    shareOfBrandPercent: 4.0,
  },
  {
    id: 'it-6',
    nameEn: 'Orig. Philly CheeseSteak',
    nameAr: 'فيلي تشيز ستيك الأصلي',
    brand: "Frank's",
    categoryEn: 'Mains',
    categoryAr: 'الوجبات الرئيسية',
    priceKwd: 3.65,
    unitsSold: 1340,
    salesKwd: 4890.5,
    costPriceKwd: 1.38,
    marginPercent: 62.2,
    classification: 'Star',
    shareOfBrandPercent: 30.1,
  },
  {
    id: 'it-7',
    nameEn: 'Spring Rolls (Vegetable 4 pcs)',
    nameAr: 'سبرينج رولز خضار مقرمشة',
    brand: 'China Garden',
    categoryEn: 'Starters & Sides',
    categoryAr: 'المقبلات والجانبيات',
    priceKwd: 1.65,
    unitsSold: 2890,
    salesKwd: 4768.5,
    costPriceKwd: 0.38,
    marginPercent: 77.0,
    classification: 'Star',
    shareOfBrandPercent: 2.9,
  },
  {
    id: 'it-8',
    nameEn: 'Crispy Honey Chicken',
    nameAr: 'دجاج مقرمش بالعسل والسمسم',
    brand: 'China Garden',
    categoryEn: 'Mains',
    categoryAr: 'الوجبات الرئيسية',
    priceKwd: 3.2,
    unitsSold: 1420,
    salesKwd: 4544.0,
    costPriceKwd: 0.92,
    marginPercent: 71.3,
    classification: 'Star',
    shareOfBrandPercent: 2.7,
  },
  {
    id: 'it-9',
    nameEn: 'Frank Loaded Truffle Fries',
    nameAr: 'بطاطا محملة بصوص الترفل',
    brand: "Frank's",
    categoryEn: 'Starters & Sides',
    categoryAr: 'المقبلات والجانبيات',
    priceKwd: 2.1,
    unitsSold: 1720,
    salesKwd: 3612.0,
    costPriceKwd: 0.55,
    marginPercent: 73.8,
    classification: 'Star',
    shareOfBrandPercent: 22.3,
  },
  {
    id: 'it-10',
    nameEn: 'Chicken Shawarma - Lebanese Bread',
    nameAr: 'شاورما دجاج خبز لبناني كلاسيك',
    brand: 'Tahina',
    categoryEn: 'Mains',
    categoryAr: 'الوجبات الرئيسية',
    priceKwd: 1.25,
    unitsSold: 1536,
    salesKwd: 1920.0,
    costPriceKwd: 0.48,
    marginPercent: 61.6,
    classification: 'Star',
    shareOfBrandPercent: 43.4,
  },
  {
    id: 'it-11',
    nameEn: 'Szechuan Spicy Beef',
    nameAr: 'لحم سيشوان حار بالفلفل المجفف',
    brand: 'China Garden',
    categoryEn: 'Mains',
    categoryAr: 'الوجبات الرئيسية',
    priceKwd: 3.6,
    unitsSold: 910,
    salesKwd: 3276.0,
    costPriceKwd: 1.25,
    marginPercent: 65.3,
    classification: 'Plowhorse',
    shareOfBrandPercent: 2.0,
  },
  {
    id: 'it-12',
    nameEn: 'Sriracha Chicken Noodles',
    nameAr: 'نودلز دجاج سريراتشا الحارة',
    brand: 'The Noodle Bar',
    categoryEn: 'Rice & Noodles',
    categoryAr: 'الأرز والنودلز',
    priceKwd: 2.95,
    unitsSold: 173,
    salesKwd: 512.0,
    costPriceKwd: 0.82,
    marginPercent: 72.2,
    classification: 'Puzzle',
    shareOfBrandPercent: 30.5,
  },
  {
    id: 'it-13',
    nameEn: 'Chicken Fillet Meal',
    nameAr: 'وجبة فيليه دجاج مقرمش فارم براون',
    brand: 'Farm Brown',
    categoryEn: 'Combos',
    categoryAr: 'الوجبات والكومبو',
    priceKwd: 2.85,
    unitsSold: 295,
    salesKwd: 840.0,
    costPriceKwd: 1.1,
    marginPercent: 61.4,
    classification: 'Plowhorse',
    shareOfBrandPercent: 31.6,
  },
  {
    id: 'it-14',
    nameEn: 'Fresh Mint Lemonade',
    nameAr: 'ليموناضة نعناع طازجة مثلجة',
    brand: 'China Garden',
    categoryEn: 'Drinks',
    categoryAr: 'المشروبات',
    priceKwd: 1.25,
    unitsSold: 2410,
    salesKwd: 3012.5,
    costPriceKwd: 0.22,
    marginPercent: 82.4,
    classification: 'Star',
    shareOfBrandPercent: 1.8,
  },
  {
    id: 'it-15',
    nameEn: 'Chapati Box (6 pcs)',
    nameAr: 'بوكس شباتي كرك مشكل (6 حبات)',
    brand: 'Karak Cafeteria',
    categoryEn: 'Combos',
    categoryAr: 'الوجبات والكومبو',
    priceKwd: 2.5,
    unitsSold: 74,
    salesKwd: 185.0,
    costPriceKwd: 0.65,
    marginPercent: 74.0,
    classification: 'Puzzle',
    shareOfBrandPercent: 41.7,
  },
]

export const SLOW_MOVERS_LIST: SlowMoverItem[] = [
  {
    id: 'sm-1',
    nameEn: 'Steamed Edamame with Sea Salt',
    nameAr: 'إدامامي مسلوق بملح البحر',
    brand: 'China Garden',
    categoryEn: 'Starters & Sides',
    categoryAr: 'المقبلات والجانبيات',
    priceKwd: 1.75,
    unitsSold: 19,
    salesKwd: 33.25,
    recommendedPlaybookId: 1,
    playbookTitleEn: '1. Bundle & Combo Engineering',
    playbookTitleAr: '1. هندسة الكومبو والوجبات المزدوجة',
  },
  {
    id: 'sm-2',
    nameEn: 'Fried Banana with Honey & Sesame',
    nameAr: 'موز مقلي بالعسل وحبات السمسم',
    brand: 'China Garden',
    categoryEn: 'Desserts',
    categoryAr: 'الحلويات',
    priceKwd: 1.5,
    unitsSold: 14,
    salesKwd: 21.0,
    recommendedPlaybookId: 2,
    playbookTitleEn: '2. Digital Visual & Food Styling Refresh',
    playbookTitleAr: '2. إعادة تصوير وتجميل العرض الرقمي',
  },
  {
    id: 'sm-3',
    nameEn: 'Spicy Kimchi Chicken Soup',
    nameAr: 'شوربة دجاج كيمتشي حارة',
    brand: 'The Noodle Bar',
    categoryEn: 'Starters & Sides',
    categoryAr: 'المقبلات والجانبيات',
    priceKwd: 2.1,
    unitsSold: 11,
    salesKwd: 23.1,
    recommendedPlaybookId: 3,
    playbookTitleEn: '3. Aggregator Peak-Hour Placement (Top 3 Slots)',
    playbookTitleAr: '3. رفع الترتيب في المنصات وقت الذروة',
  },
  {
    id: 'sm-4',
    nameEn: 'Tahina Signature Pomegranate Salad',
    nameAr: 'سلطة طحينة بدبس الرمان والجرجير',
    brand: 'Tahina',
    categoryEn: 'Starters & Sides',
    categoryAr: 'المقبلات والجانبيات',
    priceKwd: 1.35,
    unitsSold: 22,
    salesKwd: 29.7,
    recommendedPlaybookId: 4,
    playbookTitleEn: '4. Staff Incentive & POS Upsell Script',
    playbookTitleAr: '4. حافز الكاشير وسيناريو الاقتراح عند الطلب',
  },
  {
    id: 'sm-5',
    nameEn: 'Crispy Onion Ring Tower',
    nameAr: 'برج حلقات بصل مقرمشة',
    brand: "Frank's",
    categoryEn: 'Starters & Sides',
    categoryAr: 'المقبلات والجانبيات',
    priceKwd: 1.6,
    unitsSold: 18,
    salesKwd: 28.8,
    recommendedPlaybookId: 5,
    playbookTitleEn: '5. Recipe & Portion Cost Re-engineering',
    playbookTitleAr: '5. إعادة هندسة المكونات وحجم الحصة',
  },
  {
    id: 'sm-6',
    nameEn: 'Saffron Milk Cake Cup',
    nameAr: 'كيك الحليب بالزعفران',
    brand: 'Karak Cafeteria',
    categoryEn: 'Desserts',
    categoryAr: 'الحلويات',
    priceKwd: 1.45,
    unitsSold: 9,
    salesKwd: 13.05,
    recommendedPlaybookId: 6,
    playbookTitleEn: '6. Flash Promotion & Off-Peak Happy Hour',
    playbookTitleAr: '6. عروض الفلاش والتخفيض الترويجي وقت الركود',
  },
  {
    id: 'sm-7',
    nameEn: 'Herbal Ginseng Tea Pot',
    nameAr: 'إبريق شاي الجينسنغ العشبي',
    brand: 'China Garden',
    categoryEn: 'Drinks',
    categoryAr: 'المشروبات',
    priceKwd: 1.85,
    unitsSold: 6,
    salesKwd: 11.1,
    recommendedPlaybookId: 7,
    playbookTitleEn: '7. Graceful Phase-out & Station Space Reclaim',
    playbookTitleAr: '7. الإيقاف التدريجي واستغلال مساحة المطبخ لمنتج جديد',
  },
]

export const CATEGORY_BREAKDOWN = [
  { nameEn: 'Mains', nameAr: 'الوجبات الرئيسية', salesKwd: 76862.0, sharePercent: 46.0, itemsSold: 24200 },
  { nameEn: 'Rice & Noodles', nameAr: 'الأرز والنودلز', salesKwd: 43444.0, sharePercent: 26.0, itemsSold: 21100 },
  { nameEn: 'Starters & Sides', nameAr: 'المقبلات والجانبيات', salesKwd: 25064.0, sharePercent: 15.0, itemsSold: 18450 },
  { nameEn: 'Combos & Meals', nameAr: 'الوجبات والكومبو', salesKwd: 13367.0, sharePercent: 8.0, itemsSold: 3950 },
  { nameEn: 'Drinks', nameAr: 'المشروبات', salesKwd: 6684.0, sharePercent: 4.0, itemsSold: 9940 },
  { nameEn: 'Desserts', nameAr: 'الحلويات', salesKwd: 1671.0, sharePercent: 1.0, itemsSold: 2100 },
]

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

  // Baseline totals for October 2026:
  // Net sales = 167,092 KWD | Orders = 30,543 | Avg = 5.471 | Items = 79,740 | Discounts = 4,152 KWD
  let netSales = 167092
  let orders = 30543
  let discounts = 4152

  if (selectedBrand !== 'ALL') {
    const bHit = OCTOBER_BRAND_SCORECARDS.find((b) => b.brand === selectedBrand)
    if (bHit) {
      netSales = bHit.netSalesKwd
      orders = bHit.orders
      discounts = netSales * (bHit.discountRatePercent / 100)
    }
  }

  if (selectedChannel !== 'ALL') {
    const cHit = OCTOBER_CHANNEL_SCORECARDS.find((c) => c.channel === selectedChannel)
    if (cHit) {
      const channelRatio = cHit.sharePercent / 100
      netSales = Math.round(netSales * channelRatio)
      orders = Math.round(orders * channelRatio)
      discounts = Math.round(discounts * channelRatio)
    }
  }

  const avgOrderValue = orders > 0 ? netSales / orders : 0
  const itemsSold = Math.round(orders * 2.61)
  const shareOfGroup = Math.min(100, Math.round((netSales / 167092) * 1000) / 10)

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
      menuConcentrationTextEn: 'The top 52 of 364 items sold make 80% of menu sales.',
      menuConcentrationTextAr: 'أعلى 52 صنفاً من أصل 364 صنفاً تشكل 80% من إجمالي مبيعات القائمة.',
      addOnsTextEn: 'Drinks 25.5%, starters and sides 32.7%, desserts 2.2%. Each is item lines of that kind per 100 orders.',
      addOnsTextAr: 'المشروبات 25.5%، المقبلات والجانبيات 32.7%، الحلويات 2.2% (لكل 100 طلب).',
    },
    brands,
    channels,
    bestSellers,
    slowMovers,
    categories,
  }
}
