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
  | 'Direct'
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

export const OCTOBER_BRAND_SCORECARDS: BrandScorecardRow[] = [
  {
    brand: 'China Garden',
    brandAr: 'تشاينا جاردن',
    orders: 25205,
    netSalesKwd: 141662.65,
    sharePercent: 84.8,
    avgOrderValueKwd: 5.62,
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
    orders: 2147,
    netSalesKwd: 16033.97,
    sharePercent: 9.6,
    avgOrderValueKwd: 7.47,
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
    orders: 1944,
    netSalesKwd: 4428.64,
    sharePercent: 2.7,
    avgOrderValueKwd: 2.28,
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
    orders: 847,
    netSalesKwd: 2664.18,
    sharePercent: 1.6,
    avgOrderValueKwd: 3.15,
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
    netSalesKwd: 1678.22,
    sharePercent: 1,
    avgOrderValueKwd: 6.24,
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
    orders: 128,
    netSalesKwd: 624.5,
    sharePercent: 0.4,
    avgOrderValueKwd: 4.88,
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
    orders: 14818,
    netSalesKwd: 58953.09,
    sharePercent: 35.3,
    avgOrderValueKwd: 3.98,
    itemsPerOrder: 2.34,
    discountRatePercent: 0.8,
    drinksPercent: 41.2,
    startersPercent: 14.4,
    dessertsPercent: 1.5,
  },
  {
    channel: 'Talabat Go',
    channelAr: 'طلبات جو (توصيل المنصة 17%)',
    orders: 7163,
    netSalesKwd: 55716.21,
    sharePercent: 33.4,
    avgOrderValueKwd: 7.78,
    itemsPerOrder: 2.91,
    discountRatePercent: 1.6,
    drinksPercent: 12.7,
    startersPercent: 51.9,
    dessertsPercent: 2.8,
  },
  {
    channel: 'Keeta',
    channelAr: 'كيتا (Keeta)',
    orders: 6267,
    netSalesKwd: 35607.98,
    sharePercent: 21.3,
    avgOrderValueKwd: 5.68,
    itemsPerOrder: 2.7,
    discountRatePercent: 6.7,
    drinksPercent: 4.8,
    startersPercent: 39.4,
    dessertsPercent: 3.9,
  },
  {
    channel: 'Talabat MP',
    channelAr: 'طلبات ماركت بليس (أسطول فنتشر فودز 10%)',
    orders: 742,
    netSalesKwd: 6887.25,
    sharePercent: 4.1,
    avgOrderValueKwd: 9.28,
    itemsPerOrder: 4.05,
    discountRatePercent: 1.6,
    drinksPercent: 19.8,
    startersPercent: 76.8,
    dessertsPercent: 6.2,
  },
  {
    channel: 'Deliveroo Core',
    channelAr: 'ديليفرو كور',
    orders: 967,
    netSalesKwd: 5490.68,
    sharePercent: 3.3,
    avgOrderValueKwd: 5.68,
    itemsPerOrder: 2.9,
    discountRatePercent: 0.9,
    drinksPercent: 13,
    startersPercent: 64.1,
    dessertsPercent: 6.4,
  },
  {
    channel: 'Ordable',
    channelAr: 'أوردابل (Ordable)',
    orders: 81,
    netSalesKwd: 1045.21,
    sharePercent: 0.6,
    avgOrderValueKwd: 12.84,
    itemsPerOrder: 5.11,
    discountRatePercent: 0.1,
    drinksPercent: 17.3,
    startersPercent: 109.9,
    dessertsPercent: 7.4,
  },
  {
    channel: 'Snoonu',
    channelAr: 'سنونو (Snoonu)',
    orders: 163,
    netSalesKwd: 1029.26,
    sharePercent: 0.6,
    avgOrderValueKwd: 6.3,
    itemsPerOrder: 2.85,
    discountRatePercent: 5,
    drinksPercent: 13.5,
    startersPercent: 65.6,
    dessertsPercent: 15.3,
  },
  {
    channel: 'Jahez',
    channelAr: 'جاهز (Jahez)',
    orders: 129,
    netSalesKwd: 1021.05,
    sharePercent: 0.6,
    avgOrderValueKwd: 7.92,
    itemsPerOrder: 3.03,
    discountRatePercent: 0,
    drinksPercent: 17.8,
    startersPercent: 67.4,
    dessertsPercent: 0,
  },
  {
    channel: 'Phone',
    channelAr: 'هاتف مركز الاتصال والبدالة',
    orders: 121,
    netSalesKwd: 801.94,
    sharePercent: 0.5,
    avgOrderValueKwd: 6.64,
    itemsPerOrder: 4.55,
    discountRatePercent: 1.3,
    drinksPercent: 9.9,
    startersPercent: 29.8,
    dessertsPercent: 4.1,
  },
  {
    channel: 'Deliveroo MP',
    channelAr: 'ديليفرو ماركتبليس',
    orders: 86,
    netSalesKwd: 506.19,
    sharePercent: 0.3,
    avgOrderValueKwd: 5.88,
    itemsPerOrder: 4.01,
    discountRatePercent: 0,
    drinksPercent: 20.9,
    startersPercent: 55.8,
    dessertsPercent: 0,
  },
  {
    channel: 'Whatsapp',
    channelAr: 'طلبات الواتساب المباشرة',
    orders: 3,
    netSalesKwd: 33.3,
    sharePercent: 0,
    avgOrderValueKwd: 11.1,
    itemsPerOrder: 7,
    discountRatePercent: 9.1,
    drinksPercent: 66.7,
    startersPercent: 133.3,
    dessertsPercent: 0,
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
    classification: 'TopPerformer',
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
    classification: 'TopPerformer',
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
    classification: 'TopPerformer',
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
    classification: 'TopPerformer',
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
    classification: 'TopPerformer',
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
    classification: 'TopPerformer',
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
    classification: 'TopPerformer',
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
    classification: 'TopPerformer',
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
    classification: 'TopPerformer',
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
    classification: 'TopPerformer',
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
    classification: 'HighDemand',
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
    classification: 'HighMargin',
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
    classification: 'HighDemand',
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
    classification: 'TopPerformer',
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
    classification: 'HighMargin',
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

export const OCTOBER_BRANCH_PERFORMANCE: BranchPerformanceRow[] = [
  {
    id: 'br-1',
    nameEn: 'Shuwaikh Industrial Flagship',
    nameAr: 'فرع الشويخ الصناعية (الرئيسي)',
    areaEn: 'Capital Governorate',
    areaAr: 'محافظة العاصمة',
    netSalesKwd: 38420.0,
    orders: 6420,
    avgOrderValueKwd: 5.98,
    topBrandEn: 'China Garden',
    topBrandAr: 'تشاينا جاردن',
    deliveryPercent: 62.0,
    dineInPercent: 38.0,
    peakHourEn: '1:00 PM - 3:00 PM',
    peakHourAr: '1:00 ظهراً - 3:00 عصراً',
    staffCount: 24,
  },
  {
    id: 'br-2',
    nameEn: 'Salmiya Salem Al-Mubarak',
    nameAr: 'فرع السالمية (شارع سالم المبارك)',
    areaEn: 'Hawally Governorate',
    areaAr: 'محافظة حولي',
    netSalesKwd: 26850.0,
    orders: 4910,
    avgOrderValueKwd: 5.47,
    topBrandEn: 'China Garden',
    topBrandAr: 'تشاينا جاردن',
    deliveryPercent: 68.0,
    dineInPercent: 32.0,
    peakHourEn: '8:00 PM - 11:30 PM',
    peakHourAr: '8:00 مساءً - 11:30 مساءً',
    staffCount: 18,
  },
  {
    id: 'br-3',
    nameEn: 'Hawally Tunis Street',
    nameAr: 'فرع حولي (شارع تونس)',
    areaEn: 'Hawally Governorate',
    areaAr: 'محافظة حولي',
    netSalesKwd: 21340.0,
    orders: 3890,
    avgOrderValueKwd: 5.49,
    topBrandEn: 'Tahina',
    topBrandAr: 'شاورما طحينة',
    deliveryPercent: 74.0,
    dineInPercent: 26.0,
    peakHourEn: '7:30 PM - 11:00 PM',
    peakHourAr: '7:30 مساءً - 11:00 مساءً',
    staffCount: 16,
  },
  {
    id: 'br-4',
    nameEn: 'Sharq Tijaria Tower',
    nameAr: 'فرع شرق (برج التجارية)',
    areaEn: 'Capital Governorate',
    areaAr: 'محافظة العاصمة',
    netSalesKwd: 18720.0,
    orders: 3240,
    avgOrderValueKwd: 5.78,
    topBrandEn: "Frank's",
    topBrandAr: 'فرانكس ستيك',
    deliveryPercent: 55.0,
    dineInPercent: 45.0,
    peakHourEn: '12:30 PM - 3:30 PM',
    peakHourAr: '12:30 ظهراً - 3:30 عصراً',
    staffCount: 14,
  },
  {
    id: 'br-5',
    nameEn: 'Ardiya Craft Hub',
    nameAr: 'فرع العارضية الحرفية',
    areaEn: 'Farwaniya Governorate',
    areaAr: 'محافظة الفروانية',
    netSalesKwd: 17940.0,
    orders: 3410,
    avgOrderValueKwd: 5.26,
    topBrandEn: 'China Garden',
    topBrandAr: 'تشاينا جاردن',
    deliveryPercent: 78.0,
    dineInPercent: 22.0,
    peakHourEn: '8:00 PM - 12:00 AM',
    peakHourAr: '8:00 مساءً - 12:00 منتصف الليل',
    staffCount: 15,
  },
  {
    id: 'br-6',
    nameEn: 'Fahaheel Awtad Center',
    nameAr: 'فرع الفحيحيل (مجمع أوتاد)',
    areaEn: 'Ahmadi Governorate',
    areaAr: 'محافظة الأحمدي',
    netSalesKwd: 14210.0,
    orders: 2680,
    avgOrderValueKwd: 5.3,
    topBrandEn: 'China Garden',
    topBrandAr: 'تشاينا جاردن',
    deliveryPercent: 72.0,
    dineInPercent: 28.0,
    peakHourEn: '8:30 PM - 11:30 PM',
    peakHourAr: '8:30 مساءً - 11:30 مساءً',
    staffCount: 13,
  },
  {
    id: 'br-7',
    nameEn: 'Mahboula Coastal Road',
    nameAr: 'فرع المهبولة (الطريق الساحلي)',
    areaEn: 'Ahmadi Governorate',
    areaAr: 'محافظة الأحمدي',
    netSalesKwd: 11850.0,
    orders: 2210,
    avgOrderValueKwd: 5.36,
    topBrandEn: 'Farm Brown',
    topBrandAr: 'فارم براون',
    deliveryPercent: 81.0,
    dineInPercent: 19.0,
    peakHourEn: '9:00 PM - 1:00 AM',
    peakHourAr: '9:00 مساءً - 1:00 فجراً',
    staffCount: 11,
  },
  {
    id: 'br-8',
    nameEn: 'Promenade Mall (Hawalli)',
    nameAr: 'فرع بروميناد مول (حولي)',
    areaEn: 'Hawalli Governorate',
    areaAr: 'محافظة حولي',
    netSalesKwd: 9640.0,
    orders: 1840,
    avgOrderValueKwd: 5.24,
    topBrandEn: 'The Noodle Bar',
    topBrandAr: 'ذا نودل بار',
    deliveryPercent: 83.0,
    dineInPercent: 17.0,
    peakHourEn: '8:00 PM - 11:30 PM',
    peakHourAr: '8:00 مساءً - 11:30 مساءً',
    staffCount: 10,
  },
  {
    id: 'br-9',
    nameEn: 'Mubarak Al-Kabeer Branch',
    nameAr: 'فرع مبارك الكبير',
    areaEn: 'Mubarak Al-Kabeer',
    areaAr: 'محافظة مبارك الكبير',
    netSalesKwd: 6122.0,
    orders: 1380,
    avgOrderValueKwd: 4.44,
    topBrandEn: 'Karak Cafeteria',
    topBrandAr: 'كرك كافيتريا',
    deliveryPercent: 65.0,
    dineInPercent: 35.0,
    peakHourEn: '4:00 PM - 8:00 PM',
    peakHourAr: '4:00 عصراً - 8:00 مساءً',
    staffCount: 8,
  },
  {
    id: 'br-10',
    nameEn: 'Sabhan Central Kitchen & Catering',
    nameAr: 'المطبخ المركزي (صبحان) وتوريد المناسبات',
    areaEn: 'Farwaniya Governorate',
    areaAr: 'محافظة الفروانية',
    netSalesKwd: 2000.0,
    orders: 563,
    avgOrderValueKwd: 3.55,
    topBrandEn: 'China Garden',
    topBrandAr: 'تشاينا جاردن',
    deliveryPercent: 100.0,
    dineInPercent: 0.0,
    peakHourEn: '9:00 AM - 1:00 PM',
    peakHourAr: '9:00 صباحاً - 1:00 ظهراً',
    staffCount: 27,
  },
]

export type HourlyHeatmapSlot = {
  hour: number
  labelEn: string
  labelAr: string
  orders: number
  salesKwd: number
  traffic: 'off-peak' | 'normal' | 'rush' | 'peak'
}

export const OCTOBER_HOURLY_HEATMAP: HourlyHeatmapSlot[] = [
  { hour: 11, labelEn: '11:00 AM', labelAr: '11:00 ص', orders: 980, salesKwd: 4890, traffic: 'normal' },
  { hour: 12, labelEn: '12:00 PM', labelAr: '12:00 م', orders: 2310, salesKwd: 13200, traffic: 'rush' },
  { hour: 13, labelEn: '1:00 PM', labelAr: '1:00 م', orders: 3620, salesKwd: 20450, traffic: 'peak' },
  { hour: 14, labelEn: '2:00 PM', labelAr: '2:00 م', orders: 3150, salesKwd: 17820, traffic: 'peak' },
  { hour: 15, labelEn: '3:00 PM', labelAr: '3:00 م', orders: 1420, salesKwd: 7450, traffic: 'normal' },
  { hour: 16, labelEn: '4:00 PM', labelAr: '4:00 م', orders: 940, salesKwd: 4620, traffic: 'off-peak' },
  { hour: 17, labelEn: '5:00 PM', labelAr: '5:00 م', orders: 1180, salesKwd: 6120, traffic: 'normal' },
  { hour: 18, labelEn: '6:00 PM', labelAr: '6:00 م', orders: 1750, salesKwd: 9850, traffic: 'normal' },
  { hour: 19, labelEn: '7:00 PM', labelAr: '7:00 م', orders: 2890, salesKwd: 16420, traffic: 'rush' },
  { hour: 20, labelEn: '8:00 PM', labelAr: '8:00 م', orders: 3980, salesKwd: 22800, traffic: 'peak' },
  { hour: 21, labelEn: '9:00 PM', labelAr: '9:00 م', orders: 4210, salesKwd: 24150, traffic: 'peak' },
  { hour: 22, labelEn: '10:00 PM', labelAr: '10:00 م', orders: 2540, salesKwd: 14200, traffic: 'rush' },
  { hour: 23, labelEn: '11:00 PM', labelAr: '11:00 م', orders: 1120, salesKwd: 6112, traffic: 'normal' },
  { hour: 0, labelEn: '12:00 AM', labelAr: '12:00 ص', orders: 443, salesKwd: 2810, traffic: 'off-peak' },
]

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

export const STRATEGIC_15_REPORTS: StrategicReportMeta[] = [
  {
    id: 1,
    titleEn: '1. Monthly Brand Performance & P&L Digest',
    titleAr: '1. تقرير أداء مبيعات وأرباح البراندات الشهري',
    categoryEn: 'Executive',
    categoryAr: 'تنفيذي',
    summaryEn: "Comprehensive breakdown of China Garden, Frank's, Tahina, Farm Brown, Noodle Bar, and Karak.",
    summaryAr: 'تفصيل شامل لمبيعات وحصص وتكلفة وهامش ربح البراندات الـ 6 لشركة فنتشر فودز.',
    filename: 'VF-Report-01-Brand-Performance-Oct2026.csv',
  },
  {
    id: 2,
    titleEn: '2. Aggregator Commission & Net Settlement Audit',
    titleAr: '2. تدقيق عمولات منصات التوصيل وصافي التسويات البنكية',
    categoryEn: 'Financial Audit',
    categoryAr: 'تدقيق مالي',
    summaryEn: 'Detailed comparison of Talabat Go (17%), Keeta (18%), Deliveroo (15%) and bank variances.',
    summaryAr: 'مقارنة دقيقة للعمولات التعاقدية وصافي الإيداعات البنكية المستحقة وفروقات التسوية.',
    filename: 'VF-Report-02-Aggregator-Commissions-Oct2026.csv',
  },
  {
    id: 3,
    titleEn: '3. Menu Engineering & Item Profitability Matrix',
    titleAr: '3. مصفوفة ربحية وهندسة أصناف المنيو (Top Performers, High-Demand, High-Margin, Slow-Moving)',
    categoryEn: 'Menu Intelligence',
    categoryAr: 'هندسة منيو',
    summaryEn: 'Classification of all 364 items by gross margin contribution and order popularity.',
    summaryAr: 'تصنيف أصناف المنيو الـ 364 حسب الشعبية ومعدل المساهمة في الهامش الربحي.',
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
    titleEn: '5. 10 Branches Performance & Hourly Peak Analysis',
    titleAr: '5. مقارنة أداء الفروع الـ 10 وساعات الذروة التشغيلية',
    categoryEn: 'Branches',
    categoryAr: 'الفروع',
    summaryEn: 'Shuwaikh, Salmiya, Hawally, Sharq, Ardiya, Fahaheel, Mahboula, Promenade Mall, Mubarak Al-Kabeer, Central Kitchen.',
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
    summaryEn: 'Analysis of Drinks (25.5%), Starters (32.7%), and Desserts (2.2%) per 100 orders.',
    summaryAr: 'تحليل معدل طلب المشروبات والمقبلات والحلويات لكل 100 فاتورة وفرص زيادة متوسط السلة.',
    filename: 'VF-Report-07-Addons-Attach-Rate-Oct2026.csv',
  },
  {
    id: 8,
    titleEn: '8. Discounts, Promotions & Margin Impact Audit',
    titleAr: '8. أثر الخصومات والعروض الترويجية على هامش الربحية',
    categoryEn: 'Commercial',
    categoryAr: 'تجاري',
    summaryEn: 'KWD 4,152 (2.4%) total discounts analyzed by aggregator promo vs in-store vouchers.',
    summaryAr: 'تدقيق الخصومات البالغة 4,152 د.ك وتحليل جدوى الحملات الترويجية.',
    filename: 'VF-Report-08-Discounts-Margin-Impact-Oct2026.csv',
  },
  {
    id: 9,
    titleEn: '9. Pareto 80/20 Rule: Top 52 Revenue Drivers',
    titleAr: '9. قاعدة باريتو 80/20: أعلى 52 صنفاً تولد 80% من الإيرادات',
    categoryEn: 'Menu Intelligence',
    categoryAr: 'هندسة منيو',
    summaryEn: 'Focus report on the 52 essential menu drivers generating KWD 133,673 of total revenue.',
    summaryAr: 'قائمة الأصناف الـ 52 الأساسية التي تشكل عماد مبيعات شركة فنتشر فودز.',
    filename: 'VF-Report-09-Pareto-80-20-Items-Oct2026.csv',
  },
  {
    id: 10,
    titleEn: '10. Central Kitchen Production & Inter-Branch Transfers',
    titleAr: '10. حركة إنتاج المطبخ المركزي (صبحان) وتوزيعات الفروع',
    categoryEn: 'Operations',
    categoryAr: 'تشغيل وجودة',
    summaryEn: 'Volume of semi-prepped proteins, sauces, and dough dispatched from Sabhan.',
    summaryAr: 'كميات الصوصات واللحوم المتبلة وعجائن الشباتي المحولة يومياً من صبحان للفروع.',
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
    summaryEn: 'Analysis of 2.61 items per order baseline across channels and meal periods.',
    summaryAr: 'تحليل مكونات السلة عبر القنوات ومحركات الوصول إلى 3.5 صنف لكل طلب.',
    filename: 'VF-Report-13-Basket-Size-Decomposition-Oct2026.csv',
  },
  {
    id: 14,
    titleEn: '14. Payment Method Split: KNET vs Credit Cards vs Cash',
    titleAr: '14. توزيع طرق الدفع: كي نت، فيزا وماستركارد، والدفع النقدي',
    categoryEn: 'Financial Audit',
    categoryAr: 'تدقيق مالي',
    summaryEn: 'KNET 71.4%, Credit Card 18.2%, Cash 10.4% with transaction fee audit.',
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
