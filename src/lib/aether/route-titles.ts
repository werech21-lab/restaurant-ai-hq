/** Bilingual page titles for the global executive header bar and browser <title> sync. */
export interface RouteTitle {
  en: string
  ar: string
}

const ROUTE_TITLES: { match: string; exact?: boolean; title: RouteTitle }[] = [
  // 1. القيادة والمبيعات (Executive & Sales)
  { match: '/erp', exact: true, title: { en: 'Company Summary', ar: 'ملخص الشركة' } },
  { match: '/erp/cores', title: { en: 'Sales, Marketing & Menu', ar: 'المبيعات والتسويق والمينيو' } },
  { match: '/erp/weekday-comparison', title: { en: 'Weekday Sales Comparison', ar: 'مقارنة أيام الأسبوع' } },
  { match: '/erp/before-after', title: { en: 'Decision Impact (Before & After)', ar: 'أثر القرارات (قبل وبعد)' } },

  // 2. التشغيل وسلسلة الإمداد (Operations & SLA)
  { match: '/erp/warehouse-chain', title: { en: 'Warehouse-to-Branch Chain', ar: 'سلسلة المخزن والفروع' } },
  { match: '/erp/prep-sla', title: { en: 'Kitchen Prep SLA', ar: 'زمن تجهيز المطبخ' } },
  { match: '/erp/delivery-sla', title: { en: 'Rider Delivery SLA', ar: 'زمن توصيل السائق' } },
  { match: '/erp/aggregator-radar', title: { en: 'Aggregator Commissions', ar: 'عمولات منصات التوصيل' } },

  // 3. السمعة والذكاء المرئي (Reputation & Vision AI)
  { match: '/erp/social-reviews', title: { en: 'Social & Aggregator Reviews', ar: 'التقييمات ومنصات التواصل' } },
  { match: '/erp/feryal-ai', title: { en: 'Ask Feryal (Vision & Video)', ar: 'المستشارة فريال (صور وفيديو)' } },
  { match: '/erp/feryal', title: { en: 'Ask Feryal (Vision & Video)', ar: 'المستشارة فريال (صور وفيديو)' } },

  // 4. الحوكمة والتخطيط (Governance & Strategy)
  { match: '/erp/planning', title: { en: 'Strategic Planning & Forecast', ar: 'التخطيط والتوقعات' } },
  { match: '/erp/regulations', title: { en: 'Regulations & Licensing', ar: 'التشريعات والتراخيص' } },
  { match: '/erp/booth-feasibility', title: { en: 'Booth Feasibility Calculator', ar: 'حاسبة جدوى المعارض' } },
  { match: '/erp/events-intelligence', title: { en: 'Booth Feasibility Calculator', ar: 'حاسبة جدوى المعارض' } },

  // Legacy & secondary panel routes
  { match: '/erp/sales-scorecard', title: { en: 'Sales Scorecard', ar: 'سجل المبيعات' } },
  { match: '/erp/sales-analysis', title: { en: 'Sales Analysis', ar: 'تحليل المبيعات' } },
  { match: '/erp/menu-engineering', title: { en: 'Menu Prices', ar: 'أسعار المينيو' } },
  { match: '/erp/delivery-control', title: { en: 'Delivery Control', ar: 'مراقبة التوصيل' } },
  { match: '/erp/alerts', title: { en: 'Automated Financial Alerts', ar: 'التنبيهات المالية الآلية' } },
  { match: '/erp/demand-forecast', title: { en: 'Demand & Prep Forecaster', ar: 'توقع الطلب وتحضير المطبخ' } },
  { match: '/erp/cost-intelligence', title: { en: 'Cost & Supplier Intelligence', ar: 'ذكاء التكلفة وأسعار الموردين' } },
  { match: '/erp/executive-pnl', title: { en: 'Executive P&L & Budget Variance', ar: 'قائمة الدخل وانحراف الموازنة' } },
  { match: '/automations', title: { en: 'Automated Notification Rules', ar: 'قواعد التنبيهات التلقائية' } },
  { match: '/dashboard', title: { en: 'Detailed Financial Report', ar: 'التقرير المالي التفصيلي' } },
  { match: '/erp/hr', title: { en: 'People & HR', ar: 'الموارد البشرية' } },
  { match: '/hr', title: { en: 'People & HR', ar: 'الموارد البشرية' } },
  { match: '/erp/finance', title: { en: 'Finance', ar: 'المالية' } },
  { match: '/accounting', title: { en: 'Accounting', ar: 'المحاسبة' } },
  { match: '/erp/inventory', title: { en: 'Inventory', ar: 'المخزون' } },
  { match: '/inventory', title: { en: 'Inventory', ar: 'المخزون' } },
  { match: '/erp/procurement', title: { en: 'Procurement', ar: 'المشتريات' } },
  { match: '/purchases', title: { en: 'Purchases', ar: 'المشتريات' } },
  { match: '/warehouses', title: { en: 'Warehouses', ar: 'المستودعات' } },
  { match: '/erp/food-safety', title: { en: 'Food Safety', ar: 'سلامة الغذاء' } },
  { match: '/erp/intelligence', title: { en: 'Forensic Intelligence', ar: 'الاستخبارات الجنائية' } },
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
