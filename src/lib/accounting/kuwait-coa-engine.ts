/**
 * kuwait-coa-engine.ts
 * ==============================================================================
 * VENTURE FOODS RESTAURANTS MANAGEMENT CO. W.L.L. (Lic. 2021/22838)
 * 4D Kuwait F&B Chart of Accounts (COA 1000–8300) & 3-Way Integration Engine
 * Operations ↔ HR ↔ Accounting Organic Integration Matrix
 * ==============================================================================
 */

// ------------------------------------------------------------------------------
// 1. THE 4 MANDATORY ACCOUNTING DIMENSIONS
// ------------------------------------------------------------------------------

export interface DimensionBrand {
  code: string
  nameAr: string
  nameEn: string
  isHq?: boolean
}

export const KUWAIT_DIMENSION_BRANDS: DimensionBrand[] = [
  { code: 'BR-00', nameAr: 'المقر الرئيسي والإدارة (HQ)', nameEn: 'Corporate HQ & Shared Services', isHq: true },
  { code: 'BR-01', nameAr: 'تشاينا جاردن (China Garden)', nameEn: 'China Garden' },
  { code: 'BR-02', nameAr: 'فرانكس (Frank\'s)', nameEn: "Frank's" },
  { code: 'BR-03', nameAr: 'شاورما طحينة (Tahina)', nameEn: 'Tahina' },
  { code: 'BR-04', nameAr: 'فارم براون (Farm Brown)', nameEn: 'Farm Brown' },
  { code: 'BR-05', nameAr: 'ذا نودل بار (The Noodle Bar)', nameEn: 'The Noodle Bar' },
  { code: 'BR-06', nameAr: 'كرك كافتيريا (Karak Cafeteria)', nameEn: 'Karak Cafeteria' },
]

export interface DimensionLocation {
  code: string
  nameAr: string
  nameEn: string
  type: 'HQ' | 'CENTRAL_KITCHEN' | 'STORE' | 'EVENT'
  active: boolean
}

export const KUWAIT_DIMENSION_LOCATIONS: DimensionLocation[] = [
  { code: 'LOC-HQ', nameAr: 'المقر الرئيسي - شرق (HQ)', nameEn: 'Corporate HQ - Sharq', type: 'HQ', active: true },
  { code: 'LOC-CK', nameAr: 'المطبخ المركزي والعارضية', nameEn: 'Central Production Kitchen (Central Kitchen & Ardiya)', type: 'CENTRAL_KITCHEN', active: true },
  { code: 'LOC-SLM', nameAr: 'فرع السالمية', nameEn: 'Salmiya Branch', type: 'STORE', active: true },
  { code: 'LOC-ARD', nameAr: 'فرع العارضية الحرفية', nameEn: 'Ardiya Craft Branch', type: 'STORE', active: true },
  { code: 'LOC-PRM', nameAr: 'فرع بروميناد حولي', nameEn: 'Promenade Mall - Hawally', type: 'STORE', active: true },
  { code: 'LOC-ASM', nameAr: 'فرع العاصمة مول - شرق', nameEn: 'Assima Mall - Sharq', type: 'STORE', active: true },
  { code: 'LOC-360', nameAr: 'فرع 360 مول - الزهراء', nameEn: '360 Mall - Zahra', type: 'STORE', active: true },
  { code: 'LOC-AVN', nameAr: 'فرع الأفنيوز - الري', nameEn: 'The Avenues - Rai', type: 'STORE', active: true },
  { code: 'LOC-KOT', nameAr: 'فرع الكوت مول - الفحيحيل', nameEn: 'Al Kout Mall - Fahaheel', type: 'STORE', active: true },
  { code: 'LOC-FRW', nameAr: 'فرع الفروانية', nameEn: 'Farwaniya Branch', type: 'STORE', active: true },
  { code: 'LOC-EVT-MARINA', nameAr: 'فعالية كشتة المارينا الشتوية', nameEn: 'Marina Kashta Winter Pop-Up', type: 'EVENT', active: true },
  { code: 'LOC-EVT-SAFIR', nameAr: 'مشروع مخيم السفير الموسمي', nameEn: 'Safir Desert Camp Project', type: 'EVENT', active: true },
]

export interface DimensionDepartment {
  code: string
  nameAr: string
  nameEn: string
}

export const KUWAIT_DIMENSION_DEPARTMENTS: DimensionDepartment[] = [
  { code: 'DEP-BOH', nameAr: 'المطبخ والإنتاج (BOH)', nameEn: 'Back of House / Kitchen & Prep' },
  { code: 'DEP-FOH', nameAr: 'الصالة والخدمة والكاشير (FOH)', nameEn: 'Front of House & Cashier' },
  { code: 'DEP-DEL', nameAr: 'التوصيل الداخلي والأسطول (DEL)', nameEn: 'In-House Fleet & Dispatch' },
  { code: 'DEP-ADM', nameAr: 'الإدارة المركزية والدعم (ADM)', nameEn: 'Corporate Administration & Support' },
]

export interface DimensionChannel {
  code: string
  nameAr: string
  nameEn: string
  feePct: number
}

export const KUWAIT_DIMENSION_CHANNELS: DimensionChannel[] = [
  { code: 'CH-DINE', nameAr: 'محلي داخل المطعم (Dine-In)', nameEn: 'Dine-In', feePct: 0.0 },
  { code: 'CH-TAKE', nameAr: 'سفري واستلام من الفرع (Takeaway)', nameEn: 'Takeaway / Pick-Up', feePct: 0.0 },
  { code: 'CH-OWN', nameAr: 'توصيل خاص / تطبيق وموقع فنتشر', nameEn: 'Direct Web / App Delivery', feePct: 0.0 },
  { code: 'CH-TAL-TGO', nameAr: 'طلبات - أسطول المنصة TGO', nameEn: 'Talabat Go (TGO 17%)', feePct: 17.0 },
  { code: 'CH-TAL-TMP', nameAr: 'طلبات - أسطول المطعم TMP', nameEn: 'Talabat Marketplace (TMP 10%)', feePct: 10.0 },
  { code: 'CH-KEETA', nameAr: 'منصة كيتا (Keeta)', nameEn: 'Keeta Delivery Platform', feePct: 15.0 },
  { code: 'CH-DELV', nameAr: 'منصة ديليفرو (Deliveroo)', nameEn: 'Deliveroo Delivery', feePct: 16.5 },
  { code: 'CH-JAH', nameAr: 'منصة جاهز (Jahez)', nameEn: 'Jahez Platform', feePct: 15.0 },
]

// ------------------------------------------------------------------------------
// 2. STANDARD KUWAIT F&B CHART OF ACCOUNTS (1000–8300)
// ------------------------------------------------------------------------------

export type AccountCategory =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'COGS'
  | 'LABOR'
  | 'CONTROLLABLES'
  | 'OCCUPANCY'
  | 'ADMIN'

export interface CoaAccount {
  code: string
  parentCode: string
  nameAr: string
  nameEn: string
  category: AccountCategory
  normalBalance: 'DEBIT' | 'CREDIT'
  balanceKwd: number
  descriptionAr: string
  descriptionEn: string
}

export const KUWAIT_FNB_COA: CoaAccount[] = [
  // 1000 ASSETS
  {
    code: '1110',
    parentCode: '1000',
    nameAr: 'البنوك وحساب مسير الرواتب WPS والعهد النقدية',
    nameEn: 'Banks, WPS Payroll Account & Petty Cash',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 184520.450,
    descriptionAr: 'حسابات بنك الكويت الوطني NBK وحساب WPS المعتمد والعهد النقدية لمديري الفروع',
    descriptionEn: 'NBK Operating Accounts, WPS Salary Pool and branch manager petty cash floats',
  },
  {
    code: '1121',
    parentCode: '1120',
    nameAr: 'حساب تسوية بطاقات كي نت (K-Net Clearing)',
    nameEn: 'K-Net Clearing & Settlement Account',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 12450.800,
    descriptionAr: 'المبيعات المقبوضة عبر بوابات وأجهزة كي نت بانتظار الإيداع في NBK خلال T+1',
    descriptionEn: 'Daily K-Net POS batches awaiting clearing into NBK within T+1 working day',
  },
  {
    code: '1122',
    parentCode: '1120',
    nameAr: 'حساب تسوية بطاقات فيزا / ماستركارد',
    nameEn: 'Visa / Mastercard Gateway Settlement',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 6840.150,
    descriptionAr: 'تسوية البطاقات الائتمانية والدفع عبر أبل باي',
    descriptionEn: 'Credit card and Apple Pay settlements awaiting bank reconciliation',
  },
  {
    code: '1123',
    parentCode: '1120',
    nameAr: 'ذمم منصة طلبات الوسيطة (Talabat Clearing AR)',
    nameEn: 'Talabat Clearing & Receivables',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 34120.650,
    descriptionAr: 'مستحقات مبيعات طلبات TGO و TMP بعد حسم العمولات والإعلانات حتى موعد التحويل نصف الشهري',
    descriptionEn: 'Receivables from Talabat net of commission and promotions awaiting bi-weekly transfer',
  },
  {
    code: '1124',
    parentCode: '1120',
    nameAr: 'ذمم منصة كيتا الوسيطة (Keeta Clearing AR)',
    nameEn: 'Keeta Clearing & Receivables',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 21450.300,
    descriptionAr: 'مبيعات منصة كيتا المعلقة بانتظار التحويل الأسبوعي',
    descriptionEn: 'Keeta platform sales receivable pending weekly settlement cycle',
  },
  {
    code: '1125',
    parentCode: '1120',
    nameAr: 'ذمم ديليفرو وجاهز وسنونو الوسيطة',
    nameEn: 'Deliveroo & Jahez Clearing AR',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 8920.400,
    descriptionAr: 'مستحقات منصات التوصيل الأخرى بموجب الفواتير الأسبوعية',
    descriptionEn: 'Other delivery platforms receivables awaiting bank transfer',
  },
  {
    code: '1131',
    parentCode: '1130',
    nameAr: 'مخزون المواد الخام الغذائية',
    nameEn: 'Raw Food Materials Inventory',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 46250.000,
    descriptionAr: 'اللحوم والدواجن والخضار والصلصات والتوابل بالمستودع المركزي والفروع',
    descriptionEn: 'Proteins, poultry, vegetables, sauces, and dry spices across CK and branches',
  },
  {
    code: '1132',
    parentCode: '1130',
    nameAr: 'مخزون المشروبات والعصائر',
    nameEn: 'Beverages & Soft Drinks Inventory',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 8410.500,
    descriptionAr: 'المشروبات الغازية والعصائر والمياه ومستلزمات الشاي والكرك',
    descriptionEn: 'Carbonated drinks, bottled juices, water, and karak ingredients inventory',
  },
  {
    code: '1133',
    parentCode: '1130',
    nameAr: 'مخزون مواد التعبئة والتغليف (Packaging)',
    nameEn: 'Packaging & Disposables Inventory',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 14890.200,
    descriptionAr: 'علب الكرتون والورق، أكياس التوصيل الحرارية، والملاعق ومواد التغليف المفصولة بدقة',
    descriptionEn: 'Branded food boxes, thermal delivery bags, and disposables rigorously segregated',
  },
  {
    code: '1134',
    parentCode: '1130',
    nameAr: 'مخزون مواد التنظيف والكيماويات ومكافحة العدوى',
    nameEn: 'Cleaning & Sanitizing Chemicals Inventory',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 3950.000,
    descriptionAr: 'منظفات الهاسب وغسيل الصحون ومعقمات الأيدي والمعدات',
    descriptionEn: 'HACCP compliant sanitizers, dishwashing chemicals, and surface disinfectants',
  },
  {
    code: '1135',
    parentCode: '1130',
    nameAr: 'مخزون نصف مصنع قيد التشغيل بالمطبخ المركزي (WIP)',
    nameEn: 'Central Kitchen Work in Progress (WIP)',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 11200.750,
    descriptionAr: 'المتبلات، الصلصات المطبوخة مسبقاً، والخلطات المجهزة للتوزيع على الفروع',
    descriptionEn: 'Pre-marinated meats, cooked base sauces, and batch items prepared at CK',
  },
  {
    code: '1139',
    parentCode: '1130',
    nameAr: 'مخزون بطريق التحويل بين المطبخ المركزي والفروع (In-Transit)',
    nameEn: 'Inventory in Transit (CK to Branches)',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 4620.100,
    descriptionAr: 'إرساليات خرجت من المطبخ المركزي وبانتظار تأكيد استلام مدير الفرع بالوزن',
    descriptionEn: 'Transfers dispatched from Central Kitchen in transit pending branch manager receipt & weight sign-off',
  },
  {
    code: '1141',
    parentCode: '1140',
    nameAr: 'إيجارات فروع وسكن مدفوعة مقدماً',
    nameEn: 'Prepaid Branch & Accommodation Leases',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 52400.000,
    descriptionAr: 'الإيجارات المسددة مقدماً للمجمعات وسكن العمال وتطفأ شهرياً',
    descriptionEn: 'Prepaid mall store and staff housing leases amortized on straight-line monthly basis',
  },
  {
    code: '1142',
    parentCode: '1140',
    nameAr: 'رسوم إقامات وأذونات عمل مدفوعة مقدماً (PAM/MOI)',
    nameEn: 'Prepaid Residencies & Work Permits',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 18760.000,
    descriptionAr: 'رسوم هيئة القوى العاملة والجوازات المدفوعة للموظفين وتطفأ بنسبة 1/12 شهرياً',
    descriptionEn: 'PAM and immigration fees amortized over the 12-month validity period',
  },
  {
    code: '1143',
    parentCode: '1140',
    nameAr: 'تأمين صحي وكروت بلدية مدفوعة مقدماً',
    nameEn: 'Prepaid Health Insurance & Municipality Cards',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 6420.000,
    descriptionAr: 'رسوم كروت الصحة للبلدية والتأمين الصحي الإلزامي',
    descriptionEn: 'Baladiya food handling health card and health insurance prepaid balances',
  },
  {
    code: '1144',
    parentCode: '1140',
    nameAr: 'رسوم تراخيص تجارية وإطفاء مدفوعة مقدماً',
    nameEn: 'Prepaid Commercial & Fire Licenses',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 4180.000,
    descriptionAr: 'تراخيص وزارة التجارة وقوة الإطفاء العام المجددة سنوياً',
    descriptionEn: 'MOCI commercial and KFSD fire prevention licenses amortized monthly',
  },
  {
    code: '1145',
    parentCode: '1140',
    nameAr: 'تأمينات معارض ومخيمات مستردة (Marina Kashta & Events Deposit)',
    nameEn: 'Refundable Event & Pop-Up Deposits',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 1250.000,
    descriptionAr: 'شامل تأمين كشتة المارينا المسترد 250.000 د.ك المستحق للاسترداد في 3 يناير 2027',
    descriptionEn: 'Includes 250.000 KWD refundable deposit for Marina Kashta recoverable on Jan 3, 2027',
  },
  {
    code: '1146',
    parentCode: '1140',
    nameAr: 'عقود صيانة دورية ومكافحة حشرات مدفوعة مقدماً (Prepaid AMC)',
    nameEn: 'Prepaid Annual Maintenance Contracts (AMC)',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 9600.000,
    descriptionAr: 'عقود مكافحة الحشرات والمداخن وغرف التبريد المسددة سنوياً وتطفأ شهرياً',
    descriptionEn: 'Pest control, kitchen hood, and chiller AMC contracts amortized per visit schedule',
  },
  {
    code: '1150',
    parentCode: '1100',
    nameAr: 'سلف الموظفين ومخالفات السائقين المرورية وعجز الكاشير',
    nameEn: 'Staff Advances, Traffic Fines & Cashier Shortages',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 3410.250,
    descriptionAr: 'سلف مستردة ومخالفات مرورية محملة على السائقين تخصم تلقائياً من مسير الرواتب 2121',
    descriptionEn: 'Recoverable staff advances and traffic fines auto-deducted from WPS payroll 2121',
  },
  {
    code: '1250',
    parentCode: '1200',
    nameAr: 'خلوات الفروع والأصول غير الملموسة (Key Money)',
    nameEn: 'Store Key Money & Fit-Out Leasehold',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    balanceKwd: 95000.000,
    descriptionAr: 'خلوات الفروع المؤجرة في المواقع الحيوية تطفأ على مدة عقد الإيجار',
    descriptionEn: 'Key money paid for prime retail locations amortized over lease term',
  },

  // 2000 LIABILITIES
  {
    code: '2110',
    parentCode: '2000',
    nameAr: 'ذمم الموردين التجاريين (Accounts Payable)',
    nameEn: 'Trade Accounts Payable',
    category: 'LIABILITY',
    normalBalance: 'CREDIT',
    balanceKwd: 64280.900,
    descriptionAr: 'مستحقات موردي اللحوم والدواجن والتغليف والخضار',
    descriptionEn: 'Outstanding trade liabilities for food, beverage, and packaging suppliers',
  },
  {
    code: '2121',
    parentCode: '2120',
    nameAr: 'رواتب وأجور مستحقة لمسير البنك (WPS Accrued Wages)',
    nameEn: 'Accrued Wages & WPS Net Payroll',
    category: 'LIABILITY',
    normalBalance: 'CREDIT',
    balanceKwd: 48950.000,
    descriptionAr: 'صافي مستحقات رواتب الـ 166 موظفاً بعد خصم السلف والغياب والمخالفات',
    descriptionEn: 'Net salaries payable to 166 verified employees after automated statutory & advance deductions',
  },
  {
    code: '2122',
    parentCode: '2120',
    nameAr: 'مستحقات المؤسسة العامة للتأمينات الاجتماعية (PIFSS)',
    nameEn: 'PIFSS Social Security Payable',
    category: 'LIABILITY',
    normalBalance: 'CREDIT',
    balanceKwd: 2150.000,
    descriptionAr: 'اشتراكات التأمينات الاجتماعية للموظفين الكويتيين والخليجيين',
    descriptionEn: 'Monthly statutory PIFSS pension contributions payable',
  },
  {
    code: '2123',
    parentCode: '2120',
    nameAr: 'مخصص إجازات سنوية مستحقة (30 يوماً - قانون العمل 6/2010)',
    nameEn: 'Annual Leave Accrual (30 Days Kuwait Labor Law)',
    category: 'LIABILITY',
    normalBalance: 'CREDIT',
    balanceKwd: 29840.000,
    descriptionAr: 'مخصص رصيد الإجازات السنوية المستحق لجميع الموظفين (30 يوماً سنوياً)',
    descriptionEn: 'Accrued 30-day statutory leave liability per Kuwait Labor Law Art. 70',
  },
  {
    code: '2124',
    parentCode: '2120',
    nameAr: 'مخصص تذاكر السفر السنوية للعمالة',
    nameEn: 'Annual Staff Flight Ticket Provision',
    category: 'LIABILITY',
    normalBalance: 'CREDIT',
    balanceKwd: 14250.000,
    descriptionAr: 'مخصص تذاكر السفر السنوية التعاقدية للموظفين',
    descriptionEn: 'Contractual annual ticket accrual built up monthly for overseas staff',
  },
  {
    code: '2125',
    parentCode: '2120',
    nameAr: 'بضاعة مستلمة لم تفوتر (GR/IR Clearing)',
    nameEn: 'Goods Received Not Invoiced (GR/IR)',
    category: 'LIABILITY',
    normalBalance: 'CREDIT',
    balanceKwd: 7630.200,
    descriptionAr: 'تسوية أذونات الاستلام المخزني التي لم تصل فواتيرها الضريبية بعد',
    descriptionEn: 'Inventory receipt matching account for PO delivery notes pending supplier invoice',
  },
  {
    code: '2210',
    parentCode: '2200',
    nameAr: 'مخصص مكافأة نهاية الخدمة للموظفين (IAS 19 / المادة 51)',
    nameEn: 'EOSB Indemnity Provision (IAS 19 / Kuwait Law Art 51)',
    category: 'LIABILITY',
    normalBalance: 'CREDIT',
    balanceKwd: 78450.000,
    descriptionAr: 'التزام مكافأة نهاية الخدمة المتراكم وفقاً للمادة 51 من قانون العمل الكويتي رقم 6 لسنة 2010',
    descriptionEn: 'Actuarial end-of-service indemnity liability for 166 staff under Kuwait Labor Law',
  },

  // 4000 REVENUES
  {
    code: '4110',
    parentCode: '4000',
    nameAr: 'إيرادات مبيعات الأطعمة والوجبات',
    nameEn: 'Food Sales Revenue',
    category: 'REVENUE',
    normalBalance: 'CREDIT',
    balanceKwd: 154210.850,
    descriptionAr: 'مبيعات الأطباق الرئيسية والسندويشات والمقبلات عبر كافة القنوات والبراندات الـ 6',
    descriptionEn: 'Gross food sales across all 6 official brands and 9 active branches',
  },
  {
    code: '4120',
    parentCode: '4000',
    nameAr: 'إيرادات مبيعات المشروبات والكرك والعصائر',
    nameEn: 'Beverage & Karak Sales Revenue',
    category: 'REVENUE',
    normalBalance: 'CREDIT',
    balanceKwd: 12881.310,
    descriptionAr: 'مبيعات شاي الكرك والمشروبات الغازية والمياه المعدنية',
    descriptionEn: 'Gross beverage, Karak cafeteria, and soft drink sales revenue',
  },
  {
    code: '4130',
    parentCode: '4000',
    nameAr: 'رسوم التوصيل الخاص وأجور النقل',
    nameEn: 'Own Delivery Fees Revenue',
    category: 'REVENUE',
    normalBalance: 'CREDIT',
    balanceKwd: 3420.000,
    descriptionAr: 'رسوم التوصيل المحصلة من طلبات الموقع المباشر والطلب الهاتفي',
    descriptionEn: 'Delivery service fees collected on direct web and phone orders',
  },
  {
    code: '4210',
    parentCode: '4200',
    nameAr: 'خصومات كوبونات المنصات والعروض الترويجية',
    nameEn: 'Platform Discounts & Campaign Co-Funding',
    category: 'REVENUE',
    normalBalance: 'DEBIT',
    balanceKwd: 3420.000,
    descriptionAr: 'حصة المطعم من خصومات بروموكود المنصات وعروض التخفيض',
    descriptionEn: 'Merchant funded share of promo vouchers and aggregator promotional discounts',
  },

  // 5000 COGS & DIRECT DELIVERY
  {
    code: '5110',
    parentCode: '5000',
    nameAr: 'تكلفة الأطعمة المباشرة (Food Cost)',
    nameEn: 'Direct Food Cost',
    category: 'COGS',
    normalBalance: 'DEBIT',
    balanceKwd: 38430.000,
    descriptionAr: 'تكلفة اللحوم والدواجن والخضار والمكونات المستهلكة في الأطباق (المستهدف 24%-27%)',
    descriptionEn: 'Direct protein, produce, and recipe ingredients consumed in sold menu items',
  },
  {
    code: '5120',
    parentCode: '5000',
    nameAr: 'تكلفة المشروبات المباشرة (Beverage Cost)',
    nameEn: 'Direct Beverage Cost',
    category: 'COGS',
    normalBalance: 'DEBIT',
    balanceKwd: 2576.260,
    descriptionAr: 'تكلفة علب الكولا والمياه ومواد تحضير الكرك والشاي (المستهدف 15%-20%)',
    descriptionEn: 'Direct unit cost of sodas, juices, and Karak brewing ingredients',
  },
  {
    code: '5130',
    parentCode: '5000',
    nameAr: 'تكلفة مواد التعبئة والتغليف (Packaging Cost - مفصولة بدقة)',
    nameEn: 'Packaging & Disposables Cost (Segregated)',
    category: 'COGS',
    normalBalance: 'DEBIT',
    balanceKwd: 5848.220,
    descriptionAr: 'علب وأكياس وملاعق التوصيل والسفري مفصولة تماماً عن تكلفة الطعام (المستهدف 3%-5%)',
    descriptionEn: 'Strictly segregated packaging and container costs ensuring clean food margin analysis',
  },
  {
    code: '5210',
    parentCode: '5200',
    nameAr: 'تكلفة الهدر والتوالف والمواد منتهية الصلاحية',
    nameEn: 'Waste, Spoilage & Expiry Cost',
    category: 'COGS',
    normalBalance: 'DEBIT',
    balanceKwd: 1120.000,
    descriptionAr: 'الهدر المسجل بمحاضر الإتلاف الرسمية المعتمدة من الشيف ومدير الفرع',
    descriptionEn: 'Recorded prep waste, spoiled ingredients, and expired inventory write-offs',
  },
  {
    code: '5220',
    parentCode: '5200',
    nameAr: 'فروقات الجرد وانحراف الوصفات (Theoretical vs Actual Variance)',
    nameEn: 'Theoretical vs Actual Recipe Variance',
    category: 'COGS',
    normalBalance: 'DEBIT',
    balanceKwd: 1450.800,
    descriptionAr: 'الانحراف بين الاستهلاك المعياري للوصفات والاستهلاك الفعلي بالجرد الأسبوعي (حد التنبيه 1.5%)',
    descriptionEn: 'Variance between POS theoretical ingredient depletion and physical count (1.5% alert)',
  },
  {
    code: '5230',
    parentCode: '5200',
    nameAr: 'تكلفة وجبات الموظفين بسعر التكلفة (Staff Meals at BOM Cost)',
    nameEn: 'Staff Meals at Standard BOM Cost',
    category: 'COGS',
    normalBalance: 'DEBIT',
    balanceKwd: 1840.000,
    descriptionAr: 'الوجبات المستهلكة من موظفي الفروع مسجلة برقم البصمة ومحولة بسعر التكلفة من 5110',
    descriptionEn: 'Employee duty meals registered via biometric badge transferred at recipe BOM cost from 5110',
  },
  {
    code: '5310',
    parentCode: '5300',
    nameAr: 'عمولات منصات التوصيل (Talabat, Keeta, Deliveroo Commissions)',
    nameEn: 'Aggregator Delivery Commissions',
    category: 'COGS',
    normalBalance: 'DEBIT',
    balanceKwd: 18920.400,
    descriptionAr: 'عمولات طلبات TGO 17% و TMP 10% وكيتا 15% وديليفرو 16.5% المحسومة من المبيعات',
    descriptionEn: 'Contractual platform commissions deducted at source by delivery aggregators',
  },
  {
    code: '5320',
    parentCode: '5300',
    nameAr: 'تكلفة أسطول وسائقي شركات التوصيل 3PL والتوصيل الداخلي',
    nameEn: 'Delivery Fleet & 3PL Driver Costs',
    category: 'COGS',
    normalBalance: 'DEBIT',
    balanceKwd: 7420.000,
    descriptionAr: 'سائقي التوصيل الداخلي وشركات اللوجستيات الخارجية لكل طلب',
    descriptionEn: 'Third-party delivery contractor fees and internal fleet per-order variable costs',
  },
  {
    code: '5330',
    parentCode: '5300',
    nameAr: 'عمولات الدفع الإلكتروني وبوابة كي نت (K-Net & Gateway Fees)',
    nameEn: 'K-Net & Payment Gateway Processing Fees',
    category: 'COGS',
    normalBalance: 'DEBIT',
    balanceKwd: 1670.920,
    descriptionAr: 'رسوم بنك الكويت الوطني وشركة كي نت على نقاط البيع وبوابات الدفع (حوالي 1%)',
    descriptionEn: 'Bank and K-Net processing commissions deducted on electronic transactions',
  },

  // 6000 LABOR COSTS
  {
    code: '6110',
    parentCode: '6000',
    nameAr: 'رواتب الموظفين الأساسية والإضافي والحوافز (WPS Wages)',
    nameEn: 'Basic Salaries, Overtime & Performance Incentives',
    category: 'LABOR',
    normalBalance: 'DEBIT',
    balanceKwd: 27450.000,
    descriptionAr: 'الرواتب الأساسية ومكافآت التارغت والإضافي محملة على الفروع حسب البصمة الفعلية',
    descriptionEn: 'Direct wages, branch sales bonuses, and overtime allocated via biometric timesheets',
  },
  {
    code: '6120',
    parentCode: '6000',
    nameAr: 'إيجارات ومرافق سكن الموظفين (Staff Housing Allocation)',
    nameEn: 'Staff Housing & Utilities Allocation',
    category: 'LABOR',
    normalBalance: 'DEBIT',
    balanceKwd: 4650.000,
    descriptionAr: 'إيجارات عمارات سكن الموظفين بالمهبولة وحولي ومرافقها موزعة على الفروع حسب الإشغال',
    descriptionEn: 'Monthly apartment rents, electricity, and water for staff housing pro-rated by branch headcount',
  },
  {
    code: '6130',
    parentCode: '6000',
    nameAr: 'مصروف نهاية الخدمة الشهري المحمل (Monthly EOSB Provision)',
    nameEn: 'Monthly End of Service Expense Accrual',
    category: 'LABOR',
    normalBalance: 'DEBIT',
    balanceKwd: 1980.000,
    descriptionAr: 'المخصص الشهري القانوني لمكافأة نهاية الخدمة محمل على مركز تكلفة كل فرع (حساب 2210)',
    descriptionEn: 'Monthly statutory EOSB liability charge allocated to store cost centers (cr: 2210)',
  },
  {
    code: '6140',
    parentCode: '6000',
    nameAr: 'مصروف إجازات وتذاكر سفر الموظفين الشهري',
    nameEn: 'Monthly Leave & Flight Ticket Amortization',
    category: 'LABOR',
    normalBalance: 'DEBIT',
    balanceKwd: 1650.000,
    descriptionAr: 'الإطفاء الشهري لاستحقاقات الإجازة السنوية والتذاكر (حسابات 2123 / 2124)',
    descriptionEn: 'Monthly accrual charge for 30-day annual vacation and annual repatriation flights',
  },
  {
    code: '6150',
    parentCode: '6000',
    nameAr: 'مصروف إطفاء الإقامات والشؤون وكروت البلدية',
    nameEn: 'Residency, PAM & Baladiya Health Amortization',
    category: 'LABOR',
    normalBalance: 'DEBIT',
    balanceKwd: 1420.000,
    descriptionAr: 'القسط الشهري (1/12) من رسوم تجديد الإقامات وكروت الصحة محمل على فرع الموظف',
    descriptionEn: 'Straight-line 1/12 amortization of work permit renewals and municipality cards (cr: 1142/1143)',
  },
  {
    code: '6160',
    parentCode: '6000',
    nameAr: 'حصة الشركة في التأمينات الاجتماعية (PIFSS Employer Share)',
    nameEn: 'PIFSS Employer Social Security Contribution',
    category: 'LABOR',
    normalBalance: 'DEBIT',
    balanceKwd: 450.000,
    descriptionAr: 'مساهمة صاحب العمل في التأمينات للمواطنين',
    descriptionEn: 'Employer statutory social security pension contribution for Kuwaiti personnel',
  },
  {
    code: '6170',
    parentCode: '6000',
    nameAr: 'الزي الموحد ومهمات السلامة المهنية (Uniforms & PPE)',
    nameEn: 'Staff Uniforms & Safety PPE',
    category: 'LABOR',
    normalBalance: 'DEBIT',
    balanceKwd: 620.000,
    descriptionAr: 'أزياء الطهاة والكاشير وأحذية الأمان وشباك الشعر',
    descriptionEn: 'Kitchen uniforms, non-slip footwear, aprons, and hygienic PPE gear',
  },

  // 7000 CONTROLLABLES & OCCUPANCY
  {
    code: '7110',
    parentCode: '7000',
    nameAr: 'مواد التنظيف والاستهلاك اليومي',
    nameEn: 'Daily Cleaning & Operating Supplies',
    category: 'CONTROLLABLES',
    normalBalance: 'DEBIT',
    balanceKwd: 840.000,
    descriptionAr: 'أدوات التنظيف اليومية والمستهلكات الورقية للفرع',
    descriptionEn: 'Mops, brooms, sanitizing wipes, and paper products for daily store hygiene',
  },
  {
    code: '7111',
    parentCode: '7100',
    nameAr: 'عقود مكافحة الحشرات والقوارض (Pest Control AMC)',
    nameEn: 'Pest Control AMC Contracts',
    category: 'CONTROLLABLES',
    normalBalance: 'DEBIT',
    balanceKwd: 650.000,
    descriptionAr: 'عقود الزيارات الدورية المعتمدة من وزارة الصحة للـ 9 فروع والمطبخ المركزي',
    descriptionEn: 'MOH-certified pest prevention scheduled visits across 9 active stores and Central Kitchen',
  },
  {
    code: '7112',
    parentCode: '7100',
    nameAr: 'عقود تنظيف المداخن والهودات وفلاتر الكربون ومصائد الشحوم (Hood & Duct AMC)',
    nameEn: 'Hood, Duct & Grease Trap Cleaning AMC',
    category: 'CONTROLLABLES',
    normalBalance: 'DEBIT',
    balanceKwd: 1100.000,
    descriptionAr: 'تنظيف المداخن وشهادات الإطفاء المعتمدة ومصائد الشحوم',
    descriptionEn: 'KFSD certified hood degreasing, carbon filter replacements, and grease trap emptying',
  },
  {
    code: '7121',
    parentCode: '7120',
    nameAr: 'عقود صيانة غرف التبريد والفريزرات والتكييف (Chillers & HVAC AMC)',
    nameEn: 'Walk-In Chillers, Freezers & HVAC AMC',
    category: 'CONTROLLABLES',
    normalBalance: 'DEBIT',
    balanceKwd: 980.000,
    descriptionAr: 'الصيانة الوقائية لكمبروسرات التبريد والتكييف لضمان عدم توقف العمل',
    descriptionEn: 'Quarterly HVAC & cold storage refrigeration compressor maintenance and gas refills',
  },
  {
    code: '7122',
    parentCode: '7120',
    nameAr: 'عقود صيانة معدات المطابخ وفلاتر المياه (Kitchen Equipment AMC)',
    nameEn: 'Kitchen Equipment & RO Water Filter AMC',
    category: 'CONTROLLABLES',
    normalBalance: 'DEBIT',
    balanceKwd: 820.000,
    descriptionAr: 'صيانة القلايات والشوايات والووكات وفلاتر المياه التناضحية',
    descriptionEn: 'Preventative maintenance for fryers, induction woks, and reverse osmosis water filters',
  },
  {
    code: '7123',
    parentCode: '7120',
    nameAr: 'عقود صيانة أنظمة الإطفاء والغاز (Fire & Gas Safety AMC)',
    nameEn: 'Fire Suppression & Gas Pipeline AMC',
    category: 'CONTROLLABLES',
    normalBalance: 'DEBIT',
    balanceKwd: 540.000,
    descriptionAr: 'فحص شبكات الغاز المركزي وأنظمة إخماد الحرائق (FM200 / Ansul)',
    descriptionEn: 'Ansul fire suppression testing and central LPG gas pipeline sensor certification',
  },
  {
    code: '7129',
    parentCode: '7120',
    nameAr: 'مصاريف الأعطال والصيانة الطارئة للمطابخ',
    nameEn: 'Emergency Kitchen Repairs & Call-Outs',
    category: 'CONTROLLABLES',
    normalBalance: 'DEBIT',
    balanceKwd: 760.000,
    descriptionAr: 'إصلاح الأعطال الطارئة التي تحدث خارج جداول الصيانة الدورية',
    descriptionEn: 'Unscheduled emergency call-outs for plumbing, electrical or equipment breakdown',
  },
  {
    code: '7130',
    parentCode: '7100',
    nameAr: 'فواتير الغاز والكهرباء والماء',
    nameEn: 'Gas, Electricity & Water Utilities',
    category: 'CONTROLLABLES',
    normalBalance: 'DEBIT',
    balanceKwd: 1350.000,
    descriptionAr: 'استهلاك الغاز المركزي والكهرباء بالمواقع المستقلة والمطبخ المركزي',
    descriptionEn: 'Commercial LPG consumption and electricity meters for stand-alone units and CK',
  },
  {
    code: '7140',
    parentCode: '7100',
    nameAr: 'أدوات المطبخ الصغيرة والصواني والعدد (Kitchen Smallwares)',
    nameEn: 'Kitchen Smallwares & Utensils',
    category: 'CONTROLLABLES',
    normalBalance: 'DEBIT',
    balanceKwd: 420.000,
    descriptionAr: 'السكاكين، الملاعق الكبيرة، المقالي، وموازين الحرارة الرقمية',
    descriptionEn: 'Chefs knives, spatulas, pans, inserts, cutting boards, and digital probe thermometers',
  },
  {
    code: '7150',
    parentCode: '7100',
    nameAr: 'إعلانات ممولة داخل تطبيقات التوصيل (In-App Sponsored Ads)',
    nameEn: 'In-App Aggregator Sponsored Ads',
    category: 'CONTROLLABLES',
    normalBalance: 'DEBIT',
    balanceKwd: 2150.000,
    descriptionAr: 'حملات الظهور المميز Top Listing في طلبات وكيتا وديليفرو',
    descriptionEn: 'Top listing and banner placement ad spend deducted directly from platform payouts',
  },
  {
    code: '7510',
    parentCode: '7500',
    nameAr: 'إيجار الفرع الثابت ونسبة المبيعات (Store Rent & Turnover Rent)',
    nameEn: 'Store Fixed Lease & Turnover Percentage Rent',
    category: 'OCCUPANCY',
    normalBalance: 'DEBIT',
    balanceKwd: 19850.000,
    descriptionAr: 'إيجار فروع المولات والمواقع التجارية (المستهدف 10%-15% من صافي المبيعات)',
    descriptionEn: 'Monthly retail leases across Assima, 360, Avenues, Kout, Promenade, and street locations',
  },
  {
    code: '7520',
    parentCode: '7500',
    nameAr: 'إطفاء خلوات الفروع الشهرية (Key Money Amortization)',
    nameEn: 'Key Money Monthly Amortization',
    category: 'OCCUPANCY',
    normalBalance: 'DEBIT',
    balanceKwd: 1583.330,
    descriptionAr: 'القسط الشهري لإطفاء خلوات المواقع المؤجرة',
    descriptionEn: 'Straight-line monthly amortization of capitalized location key money',
  },
  {
    code: '7530',
    parentCode: '7500',
    nameAr: 'إهلاك الديكورات والمعدات وأجهزة نقاط البيع',
    nameEn: 'Fit-Out & Kitchen Equipment Depreciation',
    category: 'OCCUPANCY',
    normalBalance: 'DEBIT',
    balanceKwd: 3420.000,
    descriptionAr: 'إهلاك الأصول الثابتة وتجهيزات المطابخ على 5-7 سنوات',
    descriptionEn: 'Depreciation charge on stainless steel kitchen fit-outs, POS hardware, and furniture',
  },
  {
    code: '7540',
    parentCode: '7500',
    nameAr: 'رسوم التراخيص والبلدية السنوية للفرع',
    nameEn: 'Branch Baladiya & Signboard License Fees',
    category: 'OCCUPANCY',
    normalBalance: 'DEBIT',
    balanceKwd: 480.000,
    descriptionAr: 'رسوم تراخيص الإعلانات والبلدية المحملة شهرياً على كل فرع',
    descriptionEn: 'Monthly amortized Baladiya signboard and health licensing fees per store',
  },

  // 8000 CORPORATE G&A
  {
    code: '8110',
    parentCode: '8000',
    nameAr: 'رواتب الإدارة المركزية والمديرين التنفيذيين',
    nameEn: 'Executive Management & Shared Services Payroll',
    category: 'ADMIN',
    normalBalance: 'DEBIT',
    balanceKwd: 6850.000,
    descriptionAr: 'رواتب موظفي الإدارة العامة (المالية، الموارد، العمليات، التسويق، السكرتارية التنفيذية)',
    descriptionEn: 'Head office corporate executives and administrative overhead payroll',
  },
  {
    code: '8120',
    parentCode: '8000',
    nameAr: 'إيجار ومرافق المقر الرئيسي بشرق',
    nameEn: 'Corporate HQ Lease & Utilities (Sharq)',
    category: 'ADMIN',
    normalBalance: 'DEBIT',
    balanceKwd: 1850.000,
    descriptionAr: 'إيجار مكاتب الشركة في برج شرق ومصاريف الاتصالات والإنترنت',
    descriptionEn: 'Sharq head office commercial lease, enterprise fiber, and office overhead',
  },
  {
    code: '8210',
    parentCode: '8000',
    nameAr: 'أتعاب المحاسبة والتدقيق القانوني والاستشارات',
    nameEn: 'Statutory Audit & Legal Advisory Fees',
    category: 'ADMIN',
    normalBalance: 'DEBIT',
    balanceKwd: 750.000,
    descriptionAr: 'أتعاب مدقق الحسابات الخارجي المعتمد في الكويت والاستشارات القانونية',
    descriptionEn: 'External auditor fees and Kuwait corporate legal retainer expenses',
  },
]

// ------------------------------------------------------------------------------
// 3. KUWAIT MULTI-BRAND & FOUR-WALL STORE P&L MODEL
// ------------------------------------------------------------------------------

export interface FourWallPlStatement {
  period: string
  scope: string
  grossSales: number
  discounts: number
  netSales: number
  foodCost: number
  beverageCost: number
  packagingCost: number
  totalCogs: number
  grossProfit: number
  laborDirectWages: number
  laborHousing: number
  laborEosbProvision: number
  laborLeaveTickets: number
  laborResidencyAmort: number
  laborMealsCost: number
  totalLabor: number
  primeCost: number
  aggregatorCommissions: number
  deliveryFleetCosts: number
  paymentGatewayFees: number
  totalDeliveryCosts: number
  cleaningSupplies: number
  amcPestControl: number
  amcKitchenHoods: number
  amcChillersHvac: number
  amcEquipmentFire: number
  emergencyRepairs: number
  utilities: number
  smallwares: number
  inAppAds: number
  totalControllables: number
  controllableProfit: number
  storeRent: number
  keyMoneyAmort: number
  depreciation: number
  storeLicenses: number
  totalOccupancy: number
  storeEbitda: number
  corporateOverheadAllocation: number
  netProfit: number
}

export function generateFourWallPl(
  netSalesTotal = 167092.160,
  scopeLabel = 'شركة فنتشر فودز (إجمالي الفروع الـ 9)'
): FourWallPlStatement {
  const grossSales = Number((netSalesTotal * 1.042).toFixed(3))
  const discounts = Number((grossSales - netSalesTotal).toFixed(3))
  const netSales = netSalesTotal

  const foodCost = Number((netSales * 0.245).toFixed(3))
  const beverageCost = Number((netSales * 0.018).toFixed(3))
  const packagingCost = Number((netSales * 0.038).toFixed(3))
  const totalCogs = Number((foodCost + beverageCost + packagingCost).toFixed(3))
  const grossProfit = Number((netSales - totalCogs).toFixed(3))

  const laborDirectWages = Number((netSales * 0.125).toFixed(3))
  const laborHousing = Number((netSales * 0.028).toFixed(3))
  const laborEosbProvision = Number((netSales * 0.012).toFixed(3))
  const laborLeaveTickets = Number((netSales * 0.010).toFixed(3))
  const laborResidencyAmort = Number((netSales * 0.008).toFixed(3))
  const laborMealsCost = Number((netSales * 0.011).toFixed(3))
  const totalLabor = Number((laborDirectWages + laborHousing + laborEosbProvision + laborLeaveTickets + laborResidencyAmort + laborMealsCost).toFixed(3))

  const primeCost = Number((totalCogs + totalLabor).toFixed(3))

  const aggregatorCommissions = Number((netSales * 0.114).toFixed(3))
  const deliveryFleetCosts = Number((netSales * 0.044).toFixed(3))
  const paymentGatewayFees = Number((netSales * 0.010).toFixed(3))
  const totalDeliveryCosts = Number((aggregatorCommissions + deliveryFleetCosts + paymentGatewayFees).toFixed(3))

  const cleaningSupplies = Number((netSales * 0.005).toFixed(3))
  const amcPestControl = Number((netSales * 0.004).toFixed(3))
  const amcKitchenHoods = Number((netSales * 0.007).toFixed(3))
  const amcChillersHvac = Number((netSales * 0.006).toFixed(3))
  const amcEquipmentFire = Number((netSales * 0.008).toFixed(3))
  const emergencyRepairs = Number((netSales * 0.005).toFixed(3))
  const utilities = Number((netSales * 0.008).toFixed(3))
  const smallwares = Number((netSales * 0.003).toFixed(3))
  const inAppAds = Number((netSales * 0.013).toFixed(3))
  const totalControllables = Number(
    (cleaningSupplies + amcPestControl + amcKitchenHoods + amcChillersHvac + amcEquipmentFire + emergencyRepairs + utilities + smallwares + inAppAds).toFixed(3)
  )

  const controllableProfit = Number((netSales - totalCogs - totalLabor - totalDeliveryCosts - totalControllables).toFixed(3))

  const storeRent = Number((netSales * 0.119).toFixed(3))
  const keyMoneyAmort = Number((netSales * 0.009).toFixed(3))
  const depreciation = Number((netSales * 0.020).toFixed(3))
  const storeLicenses = Number((netSales * 0.003).toFixed(3))
  const totalOccupancy = Number((storeRent + keyMoneyAmort + depreciation + storeLicenses).toFixed(3))

  const storeEbitda = Number((controllableProfit - totalOccupancy).toFixed(3))
  const corporateOverheadAllocation = Number((netSales * 0.045).toFixed(3))
  const netProfit = Number((storeEbitda - corporateOverheadAllocation).toFixed(3))

  return {
    period: 'أكتوبر 2026 (الفعلي المعتمد)',
    scope: scopeLabel,
    grossSales,
    discounts,
    netSales,
    foodCost,
    beverageCost,
    packagingCost,
    totalCogs,
    grossProfit,
    laborDirectWages,
    laborHousing,
    laborEosbProvision,
    laborLeaveTickets,
    laborResidencyAmort,
    laborMealsCost,
    totalLabor,
    primeCost,
    aggregatorCommissions,
    deliveryFleetCosts,
    paymentGatewayFees,
    totalDeliveryCosts,
    cleaningSupplies,
    amcPestControl,
    amcKitchenHoods,
    amcChillersHvac,
    amcEquipmentFire,
    emergencyRepairs,
    utilities,
    smallwares,
    inAppAds,
    totalControllables,
    controllableProfit,
    storeRent,
    keyMoneyAmort,
    depreciation,
    storeLicenses,
    totalOccupancy,
    storeEbitda,
    corporateOverheadAllocation,
    netProfit,
  }
}

// ------------------------------------------------------------------------------
// 4. OPERATIONS ↔ ACCOUNTING: AMC CONTRACTS & OPERATIONAL SLA GATE
// ------------------------------------------------------------------------------

export interface AmcContractItem {
  id: string
  contractCode: string
  category: 'PEST_CONTROL' | 'HOOD_DUCT' | 'CHILLERS_HVAC' | 'KITCHEN_EQUIPMENT' | 'FIRE_SAFETY'
  nameAr: string
  nameEn: string
  vendorName: string
  glAccount: string
  prepaidAccount: string
  coveredLocationsCount: number
  totalAnnualKwd: number
  monthlyAllocationKwd: number
  visitFrequencyAr: string
  visitFrequencyEn: string
  lastVisitDate: string
  nextScheduledVisit: string
  healthCertNumber: string
  slaStatus: 'COMPLIANT' | 'OVERDUE_SLA_HOLD' | 'INSPECTION_PENDING'
  slaMessageAr: string
  slaMessageEn: string
  paymentAllowed: boolean
}

export const AMC_CONTRACTS_REGISTRY: AmcContractItem[] = [
  {
    id: 'amc-pest-01',
    contractCode: 'AMC-7111-PEST',
    category: 'PEST_CONTROL',
    nameAr: 'عقد مكافحة القوارض والحشرات الشامل (9 فروع + المطبخ المركزي)',
    nameEn: 'Comprehensive Pest & Rodent Prevention AMC',
    vendorName: 'الشركة الوطنية لمكافحة الحشرات والتعقيم ذ.م.م.',
    glAccount: '7111',
    prepaidAccount: '1146',
    coveredLocationsCount: 10,
    totalAnnualKwd: 7800.000,
    monthlyAllocationKwd: 650.000,
    visitFrequencyAr: 'زيارتان أسبوعياً لكل فرع + طوارئ 24/7',
    visitFrequencyEn: 'Twice weekly per branch + 24/7 emergency response',
    lastVisitDate: '2026-10-29',
    nextScheduledVisit: '2026-11-06',
    healthCertNumber: 'MOH-PEST-2026-9941',
    slaStatus: 'COMPLIANT',
    slaMessageAr: '✅ الزيارات الدورية مكتملة وشهادات البلدية سارية المفعول',
    slaMessageEn: 'Operational SLA fully compliant with verified Baladiya health inspection',
    paymentAllowed: true,
  },
  {
    id: 'amc-hood-02',
    contractCode: 'AMC-7112-HOOD',
    category: 'HOOD_DUCT',
    nameAr: 'عقد تنظيف المداخن ومصائد الشحوم وفلاتر الكربون (قوة الإطفاء)',
    nameEn: 'Kitchen Hoods, Carbon Filters & Grease Traps Degreasing AMC',
    vendorName: 'مؤسسة الشعلة الذهبية لأنظمة الإطفاء والتهوية',
    glAccount: '7112',
    prepaidAccount: '1146',
    coveredLocationsCount: 10,
    totalAnnualKwd: 13200.000,
    monthlyAllocationKwd: 1100.000,
    visitFrequencyAr: 'تنظيف شهري شامل للمداخن + تفريغ أسبوعي لمصائد الشحوم',
    visitFrequencyEn: 'Monthly duct degreasing + weekly grease trap suction',
    lastVisitDate: '2026-10-24',
    nextScheduledVisit: '2026-11-02',
    healthCertNumber: 'KFSD-HOOD-88120',
    slaStatus: 'OVERDUE_SLA_HOLD',
    slaMessageAr: '⛔ إيقاف صرف الدفعة تلقائياً — إخلال بجدول الزيارات وتأخر رفع تقرير فلاتر الكربون (SLA Hold)',
    slaMessageEn: 'Automated SLA Payment Hold — Visit delayed past 10 days and carbon filter report missing',
    paymentAllowed: false,
  },
  {
    id: 'amc-hvac-03',
    contractCode: 'AMC-7121-HVAC',
    category: 'CHILLERS_HVAC',
    nameAr: 'عقد صيانة غرف التبريد والتجميد المركزية ووحدات التكييف',
    nameEn: 'Cold Rooms, Freezers & Rooftop HVAC Preventative AMC',
    vendorName: 'شركة الخليج لحلول التبريد الصناعي ذ.م.م.',
    glAccount: '7121',
    prepaidAccount: '1146',
    coveredLocationsCount: 10,
    totalAnnualKwd: 11760.000,
    monthlyAllocationKwd: 980.000,
    visitFrequencyAr: 'فحص فني نصف شهري ومراقبة حرارة إلكترونية للكمبروسرات',
    visitFrequencyEn: 'Bi-weekly diagnostic inspection and thermal compressor telemetry',
    lastVisitDate: '2026-10-31',
    nextScheduledVisit: '2026-11-14',
    healthCertNumber: 'IND-REF-2026-443',
    slaStatus: 'COMPLIANT',
    slaMessageAr: '✅ حساسات غرف التبريد مستقرة (-18°C للفريزر و +2°C للتبريد)',
    slaMessageEn: 'Cold chain sensors stable at -18C freezer and +2C chillers across all units',
    paymentAllowed: true,
  },
  {
    id: 'amc-equip-04',
    contractCode: 'AMC-7122-EQUIP',
    category: 'KITCHEN_EQUIPMENT',
    nameAr: 'عقد صيانة القلايات والووكات وأفران المطبخ المركزي وفلاتر RO',
    nameEn: 'Heavy Kitchen Equipment, Induction Woks & Water Filtration AMC',
    vendorName: 'الشركة العالمية لمعدات الفنادق والمطابخ (إنترناشيونال)',
    glAccount: '7122',
    prepaidAccount: '1146',
    coveredLocationsCount: 10,
    totalAnnualKwd: 9840.000,
    monthlyAllocationKwd: 820.000,
    visitFrequencyAr: 'زيارة شهرية وقائية واستبدال فلاتر المياه الدورية',
    visitFrequencyEn: 'Monthly preventative overhaul and RO cartridge replacements',
    lastVisitDate: '2026-10-27',
    nextScheduledVisit: '2026-11-10',
    healthCertNumber: 'MOCI-EQ-6192',
    slaStatus: 'COMPLIANT',
    slaMessageAr: '✅ تم استبدال شمعات فلاتر المياه وضغط الزيت بالقلايات سليم',
    slaMessageEn: 'Water filters overhauled and automated fryer oil pumps certified',
    paymentAllowed: true,
  },
  {
    id: 'amc-fire-05',
    contractCode: 'AMC-7123-FIRE',
    category: 'FIRE_SAFETY',
    nameAr: 'عقد صيانة أنظمة إخماد الحرائق (Ansul) وشبكات الغاز المركزي',
    nameEn: 'Ansul Fire Suppression & Central LPG Gas Pipeline Safety AMC',
    vendorName: 'شركة الإطفاء المتطورة للمقاولات الميكانيكية',
    glAccount: '7123',
    prepaidAccount: '1146',
    coveredLocationsCount: 10,
    totalAnnualKwd: 6480.000,
    monthlyAllocationKwd: 540.000,
    visitFrequencyAr: 'فحص ربع سنوي لصمامات الغاز وخراطيم الإطفاء وشهادات الإطفاء',
    visitFrequencyEn: 'Quarterly pressure test, emergency gas cutoff valves and KFSD licensing',
    lastVisitDate: '2026-09-18',
    nextScheduledVisit: '2026-11-18',
    healthCertNumber: 'KFSD-SAFETY-2026-1049',
    slaStatus: 'COMPLIANT',
    slaMessageAr: '✅ شهادة الإطفاء سارية لجميع الفروع وتاريخ التفتيش القادم 18 نوفمبر',
    slaMessageEn: 'KFSD safety certifications active across all 9 locations and central kitchen',
    paymentAllowed: true,
  },
]

// ------------------------------------------------------------------------------
// 5. 90 / 60 / 30 DAYS EXPIRY & DEPOSIT RECOVERY RADAR
// ------------------------------------------------------------------------------

export interface ExpiryRadarItem {
  id: string
  itemType: 'LEASE_STORE' | 'LEASE_HOUSING' | 'LICENSE_BALADIYA' | 'LICENSE_FIRE' | 'AMC_CONTRACT' | 'EVENT_DEPOSIT'
  reference: string
  titleAr: string
  titleEn: string
  costCenter: string
  expiryDate: string
  daysRemaining: number
  urgency: 'URGENT_30' | 'WARNING_60' | 'RADAR_90'
  financialAmountKwd: number
  accountCode: string
  actionRequiredAr: string
  actionRequiredEn: string
}

export const EXPIRY_RADAR_REGISTRY: ExpiryRadarItem[] = [
  {
    id: 'exp-marina-deposit',
    itemType: 'EVENT_DEPOSIT',
    reference: 'KASHTA-MARINA-1976',
    titleAr: 'استرداد تأمين فعالية كشتة المارينا الشتوية المسترد (حساب 1145)',
    titleEn: 'Refundable Security Deposit Recovery - Marina Kashta Pop-Up',
    costCenter: 'LOC-EVT-MARINA',
    expiryDate: '2027-01-03',
    daysRemaining: 60,
    urgency: 'WARNING_60',
    financialAmountKwd: 250.000,
    accountCode: '1145',
    actionRequiredAr: 'تنتهي الفعالية في 2 يناير 2027؛ تقديم طلب استرداد شيك التأمين فوراً لإدارة مارينا مول في 3 يناير 2027 بعد تسليم الموقع وفحص الووك الكهربائي وخلوه من الغاز',
    actionRequiredEn: 'Kashta concludes Jan 2, 2027; lodge official 250.000 KWD deposit recovery claim to Marina Mall management on Jan 3, 2027 after site clearance sign-off',
  },
  {
    id: 'exp-lease-salmiya',
    itemType: 'LEASE_STORE',
    reference: 'LSE-SLM-2024',
    titleAr: 'تجديد عقد إيجار فرع السالمية (شارع سالم المبارك)',
    titleEn: 'Salmiya Main Store Lease Renewal',
    costCenter: 'LOC-SLM',
    expiryDate: '2027-01-31',
    daysRemaining: 88,
    urgency: 'RADAR_90',
    financialAmountKwd: 2800.000,
    accountCode: '7510',
    actionRequiredAr: 'إرسال إخطار رسمي لمالك العقار بالرغبة بالتجديد قبل 90 يوماً وتثبيت القيمة الإيجارية الحالية',
    actionRequiredEn: 'Submit 90-day contractual renewal notice to landlord securing fixed rental cap',
  },
  {
    id: 'exp-lease-housing-mahboula',
    itemType: 'LEASE_HOUSING',
    reference: 'HOU-MHB-FLAT8',
    titleAr: 'عقد إيجار عمارة سكن عمال المهبولة (12 شقة)',
    titleEn: 'Mahboula Staff Housing Lease Agreement (12 Flats)',
    costCenter: 'DEP-ADM',
    expiryDate: '2026-12-31',
    daysRemaining: 57,
    urgency: 'WARNING_60',
    financialAmountKwd: 2400.000,
    accountCode: '6120',
    actionRequiredAr: 'مراجعة المالك لتوقيع التمديد السنوي لسكن موظفي المطبخ المركزي وتشاينا جاردن',
    actionRequiredEn: 'Execute annual lease extension with landlord covering 68 staff residents',
  },
  {
    id: 'exp-baladiya-assima',
    itemType: 'LICENSE_BALADIYA',
    reference: 'BAL-ASM-9921',
    titleAr: 'ترخيص بلدية الكويت وإعلان واجهة فرع العاصمة مول',
    titleEn: 'Assima Mall Baladiya Commercial & Facade License',
    costCenter: 'LOC-ASM',
    expiryDate: '2026-11-28',
    daysRemaining: 24,
    urgency: 'URGENT_30',
    financialAmountKwd: 320.000,
    accountCode: '1144',
    actionRequiredAr: 'تجديد ترخيص البلدية عبر البوابة الإلكترونية قبل الغرامة وإرفاق كرت صحة مدير الفرع',
    actionRequiredEn: 'Renew Baladiya permit online with branch manager valid health credential',
  },
  {
    id: 'exp-fire-ardiya',
    itemType: 'LICENSE_FIRE',
    reference: 'KFSD-ARD-1022',
    titleAr: 'رخصة قوة الإطفاء العام لمستودع ومطبخ العارضية الحرفية',
    titleEn: 'KFSD Fire Safety Certification - Ardiya Craft Kitchen',
    costCenter: 'LOC-ARD',
    expiryDate: '2026-11-20',
    daysRemaining: 16,
    urgency: 'URGENT_30',
    financialAmountKwd: 250.000,
    accountCode: '1144',
    actionRequiredAr: 'إجراء الفحص الميداني لمضخات الحريق وتجديد الشهادة لمنع إيقاف إذن العمل',
    actionRequiredEn: 'Mandatory field inspection for fire pumps and certificate renewal',
  },
]

// ------------------------------------------------------------------------------
// 6. HR ↔ ACCOUNTING ↔ OPERATIONS 7-WAY LIVE INTEGRATION BRIDGE
// ------------------------------------------------------------------------------

export interface HrAccountingBridgeRow {
  bridgeStep: number
  ruleNameAr: string
  ruleNameEn: string
  sourceModule: string
  debitAccount: string
  creditAccount: string
  monthlyImpactKwd: number
  mechanismAr: string
  mechanismEn: string
  auditStatus: 'ACTIVE_AUTOMATED' | 'AUDITED_VERIFIED'
}

export const HR_ACCOUNTING_7WAY_BRIDGE: HrAccountingBridgeRow[] = [
  {
    bridgeStep: 1,
    ruleNameAr: 'تحميل الرواتب والبصمة والإسناد الفعلي (Biometric Labor Allocation)',
    ruleNameEn: 'Biometric Branch Labor & Overtime Allocation',
    sourceModule: 'HR Biometric / Attendance',
    debitAccount: '6110 (Direct Wages & OT by Branch)',
    creditAccount: '2121 (WPS Accrued Wages)',
    monthlyImpactKwd: 27450.000,
    mechanismAr: 'توزيع تكلفة أيام العمل وساعات الإضافي للموظف بدقة على مركز تكلفة الفرع أو الفعالية التي داوم فيها فعلياً بموجب سجل البصمة',
    mechanismEn: 'Directly allocating employee wage days and OT hours to the branch or event cost center where they punched in',
    auditStatus: 'ACTIVE_AUTOMATED',
  },
  {
    bridgeStep: 2,
    ruleNameAr: 'الإطفاء الشهري للإقامات وأذونات العمل وكروت البلدية (1/12 Amortization)',
    ruleNameEn: 'Residency, PAM & Baladiya Monthly Amortization',
    sourceModule: 'HR PAM / Immigration Vault',
    debitAccount: '6150 (Residency & Baladiya Amortization)',
    creditAccount: '1142 / 1143 (Prepaid PAM & Health)',
    monthlyImpactKwd: 1420.000,
    mechanismAr: 'إطفاء آلي شهري بنسبة 1/12 من رسوم الشؤون والإقامات وكروت الصحة وتحميلها على مركز تكلفة فرع الموظف',
    mechanismEn: 'Automated 1/12 monthly straight-line amortization of immigration, PAM and Baladiya health card costs to store cost center',
    auditStatus: 'ACTIVE_AUTOMATED',
  },
  {
    bridgeStep: 3,
    ruleNameAr: 'الاحتساب الشهري الآلي لمخصص نهاية الخدمة (IAS 19 / المادة 51) والإجازات',
    ruleNameEn: 'Monthly EOSB Accrual (Kuwait Law Art. 51) & Leave Reserve',
    sourceModule: 'HR Labor Law Engine',
    debitAccount: '6130 (EOSB Expense) & 6140 (Leave Reserve)',
    creditAccount: '2210 (EOSB Liability) & 2123 (Leave Accrual)',
    monthlyImpactKwd: 3630.000,
    mechanismAr: 'احتساب الاستحقاق الاكتواري الشهري لمكافأة نهاية الخدمة (المادة 51) واحتياطي الـ 30 يوماً إجازة وتذكرة السفر لكل موظف',
    mechanismEn: 'Statutory actuarial monthly accrual for end-of-service indemnity and 30-day leave entitlement under Article 51',
    auditStatus: 'ACTIVE_AUTOMATED',
  },
  {
    bridgeStep: 4,
    ruleNameAr: 'الخصم الآلي للسلف والعهد ومخالفات السائقين وعجز الكاشير',
    ruleNameEn: 'Automated Advances, Fines & Cashier Shortage Deductions',
    sourceModule: 'Accounting ↔ Operations ↔ HR',
    debitAccount: '2121 (WPS Net Payroll)',
    creditAccount: '1150 (Staff Advances & Shortages)',
    monthlyImpactKwd: 1120.000,
    mechanismAr: 'ترحيل أقساط السلف المسجلة والمخالفات المرورية للسائقين وعجز الكاشير اليومي للخصم الآلي من صافي الراتب بمسير WPS',
    mechanismEn: 'Auto-posting registered loan installments, driver traffic fines, and register shortages against monthly net WPS payroll',
    auditStatus: 'ACTIVE_AUTOMATED',
  },
  {
    bridgeStep: 5,
    ruleNameAr: 'توزيع إيجارات ومرافق سكن الموظفين (Staff Housing Allocation)',
    ruleNameEn: 'Staff Accommodation & Utilities Cost Distribution',
    sourceModule: 'Operations Housing Registry',
    debitAccount: '6120 (Staff Housing by Branch Cost Center)',
    creditAccount: '1141 / 2110 (Prepaid Rents / Landlord AP)',
    monthlyImpactKwd: 4650.000,
    mechanismAr: 'توزيع إيجارات شقق العمال في المهبولة وحولي وفواتير الكهرباء والماء على الفروع والمطبخ المركزي بحسب عدد الموظفين الساكنين',
    mechanismEn: 'Pro-rating residential apartment leases and utility bills across stores and central kitchen according to resident headcount',
    auditStatus: 'ACTIVE_AUTOMATED',
  },
  {
    bridgeStep: 6,
    ruleNameAr: 'دورة وجبات الموظفين الرقابية (Staff Meals Bridge at BOM Cost)',
    ruleNameEn: 'Staff Duty Meals Inventory Depletion at BOM Cost',
    sourceModule: 'POS Terminal ↔ HR Badge ID ↔ Inventory',
    debitAccount: '5230 (Staff Meals at Cost)',
    creditAccount: '5110 (Direct Food Cost / Raw Inventory)',
    monthlyImpactKwd: 1840.000,
    mechanismAr: 'خصم مكونات وجبة الموظف المسجلة برقم البصمة من مخزون الفرع بتكلفتها المعيارية فقط وتحويلها من تكلفة الطعام إلى 5230، مع حظر الصرف لمن يستلم بدل طعام نقدي',
    mechanismEn: 'Depleting POS biometric-registered meal recipes at BOM cost from food cost (5110) to 5230, preventing cash allowance duplication',
    auditStatus: 'ACTIVE_AUTOMATED',
  },
  {
    bridgeStep: 7,
    ruleNameAr: 'محرك حوافز تحقيق التارغت للفروع وعمولات طلبات السائقين',
    ruleNameEn: 'Branch Target Bonus & Driver Per-Order Commission Engine',
    sourceModule: 'Sales Engine ↔ Delivery Dispatch',
    debitAccount: '6110 (Branch Target Incentives & Driver Commissions)',
    creditAccount: '2121 (WPS Payroll)',
    monthlyImpactKwd: 2150.000,
    mechanismAr: 'احتساب مكافآت الفروع المحققة للتارغت بسقف Prime Cost (45%-55%)، وعمولة 250 فلس للسائقين عن كل طلب توصيل داخلي أو طلبات TMP',
    mechanismEn: 'Awarding sales bonuses capped by store Prime Cost (45%-55%) and 250 fils per completed delivery driver drop to WPS payroll',
    auditStatus: 'ACTIVE_AUTOMATED',
  },
]
