/**
 * English -> Arabic dictionary for the analytics pages (/erp/sales-scorecard).
 * English is the source text. makeTr(locale) returns the string unchanged for
 * "en" and for any key that has no entry (menu item names stay as printed in
 * the POS), and the Arabic text for "ar".
 */
export type AnalyticsLocale = 'ar' | 'en'

export const ANALYTICS_AR: Record<string, string> = {
  // ---- filters / header
  'Updated Live · Odoo ERP Verified (2,213 Journal Entries · Venture Foods Co. W.L.L.)':
    'محدّث لحظياً · بيانات أودو موثّقة (2,213 قيد يومية · شركة فنتشر فودز ذ.م.م.)',
  'Odoo P&L Reconciled: KWD 42,441.480 Net Profit (25.4%)': 'مطابقة قائمة الدخل في أودو: صافي الربح KWD 42,441.480 (25.4%)',
  'Reset filters': 'إلغاء التصفية',
  'Brand sales · October 2026': 'مبيعات العلامات التجارية · أكتوبر 2026',
  Brand: 'العلامة التجارية',
  Channel: 'القناة',
  'All brands': 'كل العلامات التجارية',
  'All channels': 'كل القنوات',
  'Both filters apply to every section. You can also click a bar in the brand or channel charts.':
    'التصفيتان تنطبقان على كل الأقسام. يمكنك أيضاً النقر على أي شريط في مخططات العلامات أو القنوات.',

  // ---- KPI cards
  'Net sales · Oct 2026': 'صافي المبيعات · أكتوبر 2026',
  'After discounts, KWD': 'بعد الخصومات، بالدينار الكويتي',
  Orders: 'عدد الطلبات',
  'Distinct orders': 'طلبات فريدة',
  'Average order value': 'متوسط قيمة الطلب',
  'Net sales ÷ orders': 'صافي المبيعات ÷ عدد الطلبات',
  'Items sold': 'الأصناف المباعة',
  'items per order': 'صنف لكل طلب',
  'Discounts given': 'الخصومات الممنوحة',
  '2.4% of gross sales': '2.4% من إجمالي المبيعات',
  'Share of group sales': 'الحصة من إجمالي مبيعات المجموعة',
  'Net profit KWD 42,441 (25.4%)': 'صافي الربح KWD 42,441 (25.4%)',
  KWD: 'KWD',

  // ---- highlights
  Highlights: 'أبرز المؤشرات والاستنتاجات',
  'All brands, all channels': 'كل العلامات التجارية وكل القنوات',
  'Biggest channel': 'أكبر قناة',
  'Best seller': 'الأكثر مبيعاً',
  'Menu concentration': 'تركّز المنيو',
  'Add-ons per order': 'الإضافات لكل طلب',

  // ---- sections / charts
  Brands: 'العلامات التجارية',
  Channels: 'قنوات البيع والتوصيل',
  Menu: 'المنيو',
  'Net sales by brand': 'صافي المبيعات حسب العلامة التجارية',
  'KWD after discounts on the chosen channel. Click a bar to filter to that brand.':
    'بالدينار بعد الخصومات للقناة المختارة. انقر على شريط لتصفية الصفحة على هذه العلامة.',
  'Average order value by brand': 'متوسط قيمة الطلب حسب العلامة التجارية',
  'KWD per order. Brands with fewer than 200 orders on this channel are greyed out.':
    'بالدينار لكل طلب. العلامات التي تقل طلباتها عن 200 على هذه القناة تظهر باللون الرمادي.',
  'Brand scorecard': 'بطاقة أداء العلامات التجارية',
  'Drinks and starters are item lines of that kind per order. Discount rate is discounts ÷ gross sales.':
    'المشروبات والمقبلات هي سطور الأصناف من هذا النوع لكل طلب. نسبة الخصم = الخصومات ÷ إجمالي المبيعات.',
  'Net sales by channel': 'صافي المبيعات حسب القناة',
  'KWD after discounts for the chosen brand. Click a bar to filter to that channel.':
    'بالدينار بعد الخصومات للعلامة المختارة. انقر على شريط لتصفية الصفحة على هذه القناة.',
  'Average order value by channel': 'متوسط قيمة الطلب حسب القناة',
  'KWD per order. Channels with fewer than 200 orders are greyed out because their averages swing easily.':
    'بالدينار لكل طلب. القنوات التي تقل طلباتها عن 200 تظهر باللون الرمادي لأن متوسطاتها تتأرجح بسهولة.',
  'Channel scorecard': 'بطاقة أداء قنوات البيع والتوصيل',
  'For the chosen brand. Add-on rates are item lines of that kind per order.':
    'للعلامة المختارة. نسب الإضافات هي سطور الأصناف من هذا النوع لكل طلب.',
  '· All brands, all channels': '· كل العلامات التجارية وكل القنوات',
  'Sales by category': 'المبيعات حسب الفئة',
  'Gross item sales before order-level discounts, grouped by item category.':
    'إجمالي مبيعات الأصناف قبل خصومات الطلب، مجمّعة حسب فئة الصنف.',
  'Top 15 items': 'أعلى 15 صنفاً مبيعاً',
  'Gross KWD. Hover a bar to see the brand and unit price.': 'بالدينار (إجمالي). مرّر المؤشر على الشريط لعرض العلامة وسعر الوحدة.',

  // ---- table headers
  'Share of group': 'الحصة من المجموعة',
  'Net sales': 'صافي المبيعات',
  'Avg order': 'متوسط الطلب',
  'Items / order': 'الأصناف / الطلب',
  'Discount rate': 'نسبة الخصم',
  'No brand-channel pair in the dataset matches this selection.': 'لا يوجد زوج علامة وقناة في البيانات يطابق هذا التحديد.',
  'No item rows for this brand in the project dataset.': 'لا توجد أصناف لهذه العلامة في بيانات المشروع.',
  Drinks: 'المشروبات',
  Starters: 'المقبلات',
  Desserts: 'الحلويات',
  Share: 'الحصة',
  Item: 'الصنف',
  Category: 'الفئة',
  'Avg price': 'متوسط السعر',
  'Action tag': 'وسم الإجراء',
  'Recommended executive action': 'الإجراء التنفيذي الموصى به',
  'Operational sector': 'القطاع التشغيلي',
  'Odoo account / custody': 'حساب / عهدة أودو',
  'Source module': 'الوحدة المصدر',
  Entries: 'القيود',
  'Amount (KWD)': 'المبلغ (د.ك)',
  Variance: 'الانحراف',
  'Audit status': 'حالة التدقيق',
  'Required Odoo & operational action': 'الإجراء المطلوب في أودو وتشغيلياً',
  'Net KWD': 'الصافي (د.ك)',
  'Est. COGS': 'تكلفة الأغذية التقديرية',
  'Lead item': 'الصنف الرائد',
  'Drinks %': 'نسبة المشروبات',

  // ---- diagnostic matrix
  '· Automated classification of revenue, add-ons, COGS & maintenance': '· تصنيف تلقائي للإيرادات والإضافات وتكلفة الأغذية والصيانة',
  'Revenue & Cost Pool by Diagnostic Action Bucket': 'مجمّع الإيرادات والتكاليف حسب فئة الإجراء التشخيصي',
  'KWD pool impacted per diagnostic rule across Odoo POS, Aggregators & Central Kitchen.':
    'المبلغ بالدينار المتأثر بكل قاعدة تشخيصية عبر نقاط بيع أودو ومنصات التوصيل والمطبخ المركزي.',
  'How items & Odoo cost centers are classified': 'كيف تُصنَّف الأصناف ومراكز التكلفة في أودو',
  'Each row in the action tables below receives a diagnostic badge and concrete recommendation.':
    'كل صف في جداول الإجراءات أدناه يحصل على شارة تشخيص وتوصية محددة.',
  'Item-level commercial diagnostics & pricing actions': 'التشخيص التجاري وإجراءات التسعير على مستوى الصنف',
  'High-impact menu items evaluated by order volume, basket attachment, discount bleed, and kitchen prep.':
    'أصناف المنيو الأعلى أثراً مقيَّمة بحسب حجم الطلبات وإضافات السلة وتسرّب الخصومات وتحضير المطبخ.',
  'Odoo ERP financial, central kitchen & maintenance audit scorecard': 'بطاقة التدقيق المالي والمطبخ المركزي والصيانة في أودو',
  'Direct reconciliation with Odoo general ledger (2,213 entries), Central Kitchen COGS, and Rabih maintenance custody.':
    'مطابقة مباشرة مع دفتر الأستاذ العام في أودو (2,213 قيداً) وتكلفة أغذية المطبخ المركزي وعهدة صيانة ربيع.',
  'Long-tail menu candidates for pruning (Prep & waste reduction)': 'أصناف الذيل الطويل المرشحة للحذف (تقليل التحضير والهدر)',
  '332 of 364 items generate only 20% of sales. Removing low-rotation SKUs reduces Central Kitchen waste.':
    '332 صنفاً من أصل 364 تحقق 20% فقط من المبيعات. حذف الأصناف بطيئة الدوران يقلل هدر المطبخ المركزي.',
  'Brand × Channel combination scorecard': 'بطاقة أداء تركيبات العلامة × القناة',
  'Top brand-channel pairs showing lead item, average basket size, and drink attachment rate.':
    'أعلى أزواج العلامة والقناة مع الصنف الرائد ومتوسط حجم السلة ونسبة إضافة المشروبات.',

  // ---- diagnostic buckets
  'Core revenue drivers (Top 32 items)': 'محركات الإيراد الأساسية (أعلى 32 صنفاً)',
  'Hero core': 'الأساس الرئيسي',
  '32 items generating 80% of menu revenue across Odoo POS & Aggregators. Protect recipe spec & prep availability.':
    '32 صنفاً تحقق 80% من إيرادات المنيو عبر نقاط بيع أودو ومنصات التوصيل. احمِ مواصفات الوصفة وتوفر التحضير.',
  'Aggregator drink & starter upsell gap': 'فجوة بيع المشروبات والمقبلات في منصات التوصيل',
  'Upsell gap': 'فجوة البيع الإضافي',
  'Talabat Go & Keeta orders with <13% drink attachment vs 41.2% in Shop Sales. Add mandatory drink step in combos.':
    'طلبات طلبات جو وكيتا بنسبة مشروبات أقل من 13% مقابل 41.2% في المحل. أضف خطوة اختيار مشروب إلزامية في الكومبو.',
  'Odoo COGS & Central Kitchen variance': 'انحراف تكلفة الأغذية والمطبخ المركزي في أودو',
  'COGS +0.8%': 'تكلفة الأغذية +0.8%',
  'Central Kitchen poultry marination waste pushed COGS to 24.8% (KWD 41,438.856). Enforce batch weight logs.':
    'هدر تتبيل الدجاج في المطبخ المركزي رفع تكلفة الأغذية إلى 24.8% (KWD 41,438.856). فعّل سجلات أوزان الدفعات.',
  'High-margin signature & combo anchors': 'أصناف مميزة وكومبو عالية الهامش',
  'Expand combo': 'وسّع الكومبو',
  "Frank's (69.8% starters) & Talabat MP (KWD 9.28 avg order) prove high bundle elasticity. Replicate across brands.":
    'فرانكس (69.8% مقبلات) وطلبات ماركت (متوسط الطلب KWD 9.28) يثبتان مرونة عالية للحزم. كرّر النموذج في بقية العلامات.',
  'Discount & promo bleed on Keeta/Snoonu': 'تسرّب الخصومات والعروض في كيتا وسنونو',
  'Cap promo': 'ضع سقفاً للعروض',
  'Keeta discount rate hits 6.7% and Snoonu 5.0% vs 2.4% group average (KWD 4,152 total discounts). Shift to meal bundles.':
    'نسبة الخصم في كيتا 6.7% وفي سنونو 5.0% مقابل متوسط المجموعة 2.4% (إجمالي الخصومات KWD 4,152). انتقل إلى حزم الوجبات.',
  'Maintenance & Petty Cash (Rabih Custody)': 'الصيانة والنثرية (عهدة ربيع)',
  'CapEx replace': 'استبدال رأسمالي',
  'KWD 10,707.930 in maintenance & petty cash driven by repeated Al-Kout & Salmiya chiller repairs. Approve unit replacement.':
    'مصروف صيانة ونثرية KWD 10,707.930 سببه تكرار إصلاح ثلاجات الكوت والسالمية. اعتمد استبدال الوحدات.',

  // ---- item diagnostics
  Noodles: 'نودلز',
  'Meals & combos': 'وجبات وكومبو',
  'Sandwiches & steaks': 'ساندويشات وستيك',
  Soups: 'شوربات',
  'Hero anchor': 'الصنف المحوري',
  'Number 1 item company-wide (7.2% of all sales). Test +100 fils add-on upgrade (extra protein/mushroom) without touching base price.':
    'الصنف الأول على مستوى الشركة (7.2% من كل المبيعات). جرّب ترقية بإضافة 100 فلس (بروتين أو مشروم إضافي) دون المساس بالسعر الأساسي.',
  'Combo star': 'نجم الكومبو',
  "Drives beverage & starter attachment on Talabat Go. Feature at top of Keeta menu to lift Keeta's 4.8% drink rate.":
    'يدفع إضافة المشروبات والمقبلات في طلبات جو. اعرضه في أعلى قائمة كيتا لرفع نسبة المشروبات فيها (4.8%).',
  'High AOV driver': 'يرفع متوسط الطلب',
  "69.8% starter attachment in Frank's pushes brand AOV to KWD 7.47. Keep fries + drink combo default on aggregators.":
    'نسبة المقبلات 69.8% في فرانكس ترفع متوسط الطلب إلى KWD 7.47. أبقِ كومبو البطاطس والمشروب افتراضياً في منصات التوصيل.',
  'Upsell target': 'هدف للبيع الإضافي',
  'High order count (2,146) at low ticket (KWD 1.80). Add 1-click KWD 0.950 spring roll or soup pairing prompt.':
    'عدد طلبات مرتفع (2,146) بقيمة منخفضة (KWD 1.80). أضف اقتراحاً بنقرة واحدة لسبرينغ رول أو شوربة بسعر KWD 0.950.',
  'Basket builder': 'يبني السلة',
  'Tahina has 81.2% drink rate but lowest AOV (KWD 2.28). Introduce 3-shawarma + fries family box at KWD 3.450.':
    'طحينة لديها نسبة مشروبات 81.2% لكن أقل متوسط طلب (KWD 2.28). قدّم علبة عائلية 3 شاورما مع بطاطس بسعر KWD 3.450.',
  'High margin add-on': 'إضافة عالية الهامش',
  'Low food cost (16% COGS) and 2,481 orders. Bundle with Beef Mongolian & Chicken Fried Rice as a 2-person meal.':
    'تكلفة أغذية منخفضة (16%) و2,481 طلباً. اجمعها مع بيف منغوليان وأرز مقلي بالدجاج في وجبة لشخصين.',
  'Discount watch': 'مراقبة الخصم',
  'Brand discount rate is 4.9% (double group average). Replace flat percentage discounts with free drink above KWD 6.000.':
    'نسبة الخصم في العلامة 4.9% (ضعف متوسط المجموعة). استبدل الخصم النسبي بمشروب مجاني للطلبات فوق KWD 6.000.',
  'Central kitchen prep watch': 'مراقبة تحضير المطبخ المركزي',
  'Linked to Central Kitchen poultry batching (+0.8% COGS variance). Standardize 140g portioning weight.':
    'مرتبط بتجهيز الدجاج في المطبخ المركزي (انحراف تكلفة +0.8%). وحّد وزن الحصة عند 140 جراماً.',

  // ---- Odoo audit table
  'Central Kitchen': 'المطبخ المركزي',
  'COGS / Raw Poultry & Sauces': 'تكلفة الأغذية / الدواجن النيئة والصلصات',
  'Odoo MRP & Stock': 'التصنيع والمخزون في أودو',
  'Tighten BOM': 'شدّد مواصفات الوصفة',
  'Actual Food Cost is 24.8% vs 24.0% standard (KWD 1,336 variance). Audit chicken marination yield in Central Kitchen.':
    'تكلفة الأغذية الفعلية 24.8% مقابل 24.0% معيارية (انحراف KWD 1,336). دقّق مردود تتبيل الدجاج في المطبخ المركزي.',
  'Maintenance · Al-Kout & Salmiya': 'الصيانة · الكوت والسالمية',
  'Custody & Maintenance (Rabih)': 'العهد والصيانة (ربيع)',
  'Odoo Petty Cash': 'النثرية في أودو',
  'High freq': 'تكرار مرتفع',
  'Replace chillers': 'استبدل الثلاجات',
  'Repeated compressor & thermostat calls in Al-Kout and Salmiya branches. Cap repair petty cash and execute CapEx unit swap.':
    'بلاغات متكررة عن الضاغط والثرموستات في فرعي الكوت والسالمية. ضع سقفاً لنثرية الإصلاح ونفّذ استبدال الوحدات رأسمالياً.',
  'Aggregator Clearing · Keeta': 'تسوية المنصة · كيتا',
  'Keeta Settlement & Discounts': 'تسوية كيتا والخصومات',
  'Odoo Accounting': 'المحاسبة في أودو',
  '6.7% disc': 'خصم 6.7%',
  'Rebalance promo': 'أعد توازن العروض',
  'Keeta accounts for KWD 2,539 of the KWD 4,152 total discounts AND only 4.8% drink attachment. Switch promo to Combo + Drink.':
    'كيتا تستحوذ على KWD 2,539 من إجمالي الخصومات البالغ KWD 4,152 مع نسبة مشروبات 4.8% فقط. حوّل العرض إلى كومبو مع مشروب.',
  'Aggregator Clearing · Talabat Go': 'تسوية المنصة · طلبات جو',
  'Talabat Go Receivables': 'مستحقات طلبات جو',
  '33.4% share': 'حصة 33.4%',
  'Reconciled 100%': 'مطابقة 100%',
  'Matched across 7,163 orders with KWD 7.78 AOV and 51.9% starter rate. Push beverage add-on from 12.7% toward 25.0%.':
    'مطابقة على 7,163 طلباً بمتوسط طلب KWD 7.78 ونسبة مقبلات 51.9%. ارفع إضافة المشروبات من 12.7% نحو 25.0%.',
  'Operating Expenses & Custody': 'المصروفات التشغيلية والعهد',
  'General & Branch OpEx': 'المصروفات العامة ومصروفات الفروع',
  'Odoo Journal (2,213)': 'قيود أودو (2,213)',
  '30.6% rev': '30.6% من الإيراد',
  'Fils verified': 'مدقّق حتى الفلس',
  'All 2,213 journal entries reconciled to the fils in Odoo General Ledger. Net Operating Profit locked at KWD 42,441.480 (25.4%).':
    'كل قيود اليومية الـ 2,213 مطابقة حتى الفلس في دفتر الأستاذ العام بأودو. صافي الربح التشغيلي مثبّت عند KWD 42,441.480 (25.4%).',
  'Menu Tail · All 6 Brands': 'ذيل المنيو · العلامات الست',
  'Bottom 332 Menu SKUs': 'أدنى 332 صنفاً في المنيو',
  'Odoo POS Items': 'أصناف نقاط البيع في أودو',
  '20.0% sales': '20.0% من المبيعات',
  'Prune 45 SKUs': 'احذف 45 صنفاً',
  '332 items generate only 20% of revenue while increasing kitchen prep complexity and expiry risk. Delist bottom 45 slow movers.':
    '332 صنفاً تحقق 20% فقط من الإيراد وتزيد تعقيد التحضير في المطبخ ومخاطر انتهاء الصلاحية. احذف أبطأ 45 صنفاً.',
  '+0.8%': '+0.8%',

  // ---- tabs
  'Net operating profit': 'صافي الربح التشغيلي',
  'Available for the whole group only': 'متاح على مستوى المجموعة فقط',
  '25.4% net margin': 'هامش صافٍ 25.4%',
  'Menu & Odoo Diagnostic Action Matrix': 'مصفوفة تشخيص المنيو وإجراءات أودو',

  // ---- brands / channels
  'China Garden': 'تشاينا جاردن',
  "Frank's": 'فرانكس',
  Tahina: 'طحينة',
  'Farm Brown': 'فارم براون',
  'The Noodle Bar': 'ذا نودل بار',
  'Karak Cafeteria': 'كرك كافتيريا',
  'Shop Sales': 'مبيعات المحل',
  'Talabat Go': 'طلبات جو',
  Keeta: 'كيتا',
  'Talabat MP': 'طلبات ماركت',
  'Deliveroo Core': 'ديليفرو كور',
  Ordable: 'أوردابل',
  Snoonu: 'سنونو',
  Jahez: 'جاهز',
  Phone: 'الطلب الهاتفي',
  'Deliveroo MP': 'ديليفرو ماركت',
  Whatsapp: 'واتساب',
}

export function makeTr(locale: AnalyticsLocale) {
  // In Arabic, currency amounts written as "KWD 1,234" become "1,234 د.ك".
  // "KWD 1 Chicken Shawarma" is a product name and is left untouched.
  const fixCurrency = (s: string) =>
    s.replace(/KWD\s?(\d[\d.,]*\d|\d)(?!\s*Chicken)/g, '$1 د.ك')
  return (text: string): string => (locale === 'ar' ? fixCurrency(ANALYTICS_AR[text] ?? text) : text)
}
