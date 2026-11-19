/** Bilingual page titles for the global executive header bar and browser <title> sync. */
export interface RouteTitle {
  en: string
  ar: string
  mobileEn?: string
  mobileAr?: string
}

const ROUTE_TITLES: { match: string; exact?: boolean; title: RouteTitle }[] = [
  // 1. القيادة والمبيعات (Executive & Sales)
  {
    match: '/erp',
    exact: true,
    title: {
      en: 'Company Summary',
      ar: 'ملخص الشركة',
      mobileEn: 'Overview',
      mobileAr: 'ملخص الشركة',
    },
  },
  {
    match: '/erp/cores',
    title: {
      en: 'Sales, Marketing & Menu',
      ar: 'المبيعات والتسويق والمينيو',
      mobileEn: 'Sales & Menu',
      mobileAr: 'المبيعات والمينيو',
    },
  },
  {
    match: '/erp/weekday-comparison',
    title: {
      en: 'Date & Sales Comparison',
      ar: 'مقارنة التواريخ والمبيعات',
      mobileEn: 'Weekdays',
      mobileAr: 'أيام الأسبوع',
    },
  },
  {
    match: '/erp/before-after',
    title: {
      en: 'Decision Impact (Before & After)',
      ar: 'أثر القرارات (قبل وبعد)',
      mobileEn: 'Before & After',
      mobileAr: 'قبل وبعد',
    },
  },

  // 2. التشغيل وسلسلة الإمداد (Operations & SLA)
  {
    match: '/erp/warehouse-chain',
    title: {
      en: 'Warehouse-to-Branch Chain',
      ar: 'سلسلة المخزن والفروع',
      mobileEn: 'Warehouse',
      mobileAr: 'المخزن والفروع',
    },
  },
  {
    match: '/erp/aggregator-radar',
    title: {
      en: 'Aggregator Commissions',
      ar: 'عمولات منصات التوصيل',
      mobileEn: 'Delivery Fees',
      mobileAr: 'عمولات التوصيل',
    },
  },
  {
    match: '/erp/commissions',
    title: {
      en: 'Aggregator Commissions',
      ar: 'عمولات منصات التوصيل',
      mobileEn: 'Delivery Fees',
      mobileAr: 'عمولات التوصيل',
    },
  },

  // 3. السمعة والذكاء المرئي (Reputation & Vision AI)
  {
    match: '/erp/ai-brief',
    title: {
      en: 'Daily Odoo analysis',
      ar: 'تحليل أودو اليومي',
      mobileEn: 'Daily analysis',
      mobileAr: 'التحليل اليومي',
    },
  },
  {
    match: '/erp/feryal-ai',
    title: {
      en: 'Ask Feryal (Vision & Video)',
      ar: 'المستشارة فريال (صور وفيديو)',
      mobileEn: 'Ask Feryal',
      mobileAr: 'المستشارة فريال',
    },
  },
  {
    match: '/erp/feryal',
    title: {
      en: 'Ask Feryal (Vision & Video)',
      ar: 'المستشارة فريال (صور وفيديو)',
      mobileEn: 'Ask Feryal',
      mobileAr: 'المستشارة فريال',
    },
  },

  // 4. الحوكمة والتخطيط (Governance & Strategy)
  {
    match: '/erp/planning',
    title: {
      en: 'Strategic Planning & Forecast',
      ar: 'التخطيط والتوقعات',
      mobileEn: 'Planning',
      mobileAr: 'التخطيط',
    },
  },
  {
    match: '/erp/decisions',
    title: {
      en: 'Decision Room',
      ar: 'غرفة القرار',
      mobileEn: 'Decisions',
      mobileAr: 'القرار',
    },
  },
  {
    match: '/erp/seasons',
    title: {
      en: 'Seasons & Occasions',
      ar: 'المواسم والمناسبات',
      mobileEn: 'Seasons',
      mobileAr: 'المواسم',
    },
  },
  {
    match: '/erp/booth-feasibility',
    title: {
      en: 'Booth Feasibility Calculator',
      ar: 'حاسبة جدوى المعارض',
      mobileEn: 'Booth ROI',
      mobileAr: 'حاسبة المعارض',
    },
  },
  {
    match: '/erp/booth',
    title: {
      en: 'Booth Feasibility Calculator',
      ar: 'حاسبة جدوى المعارض',
      mobileEn: 'Booth ROI',
      mobileAr: 'حاسبة المعارض',
    },
  },
  {
    match: '/erp/events-intelligence',
    title: {
      en: 'Booth Feasibility Calculator',
      ar: 'حاسبة جدوى المعارض',
      mobileEn: 'Booth ROI',
      mobileAr: 'حاسبة المعارض',
    },
  },

  // Legacy & secondary panel routes
  { match: '/erp/sales-scorecard', title: { en: 'Sales Scorecard', ar: 'سجل المبيعات' } },
  { match: '/erp/sales-analysis', title: { en: 'Sales Analysis', ar: 'تحليل المبيعات' } },
  { match: '/erp/menu-engineering', title: { en: 'Menu Prices', ar: 'أسعار المينيو' } },
  { match: '/erp/alerts', title: { en: 'Automated Financial Alerts', ar: 'التنبيهات المالية الآلية' } },
  { match: '/erp/demand-forecast', title: { en: 'Demand Forecast', ar: 'توقع الطلب' } },
  { match: '/erp/cost-intelligence', title: { en: 'Cost & Supplier Intelligence', ar: 'ذكاء التكلفة وأسعار الموردين' } },
  { match: '/erp/executive-pnl', title: { en: 'Income Statement & POS to GL', ar: 'قائمة الدخل ومطابقة نقاط البيع مع الأستاذ العام' } },
  { match: '/erp/hr', title: { en: 'People & HR', ar: 'الموارد البشرية' } },
  { match: '/hr', title: { en: 'People & HR', ar: 'الموارد البشرية' } },
  {
    match: '/erp/finance',
    title: {
      en: 'Finance & General Ledger',
      ar: 'المركز المالي والمحاسبة',
      mobileEn: 'Finance',
      mobileAr: 'المالية',
    },
  },
  {
    match: '/erp/receivables',
    title: {
      en: 'Open receivables',
      ar: 'الذمم المدينة المفتوحة',
      mobileEn: 'Open AR',
      mobileAr: 'الذمم المدينة',
    },
  },
  { match: '/accounting', title: { en: 'Accounting', ar: 'المحاسبة' } },
  { match: '/erp/inventory', title: { en: 'Inventory', ar: 'المخزون' } },
  { match: '/erp/procurement', title: { en: 'Procurement', ar: 'المشتريات' } },
  { match: '/purchases', title: { en: 'Purchases', ar: 'المشتريات' } },
  { match: '/reports', title: { en: 'Reports', ar: 'التقارير' } },
  { match: '/sales', title: { en: 'Sales', ar: 'المبيعات' } },
  { match: '/crm', title: { en: 'CRM', ar: 'إدارة العملاء' } },
  { match: '/settings', title: { en: 'Settings', ar: 'الإعدادات' } },
]

export const ROOT_TITLE: RouteTitle = { en: 'Aether BI', ar: 'إيثر للتحليلات' }

export function routeTitle(pathname: string | null): RouteTitle | null {
  if (!pathname) return null
  const exact = ROUTE_TITLES.find((r) => r.exact && r.match === pathname)
  if (exact) return exact.title
  const hit = ROUTE_TITLES.filter(
    (r) => !r.exact && (pathname === r.match || pathname.startsWith(`${r.match}/`)),
  ).sort((a, b) => b.match.length - a.match.length)[0]
  return hit?.title ?? null
}
