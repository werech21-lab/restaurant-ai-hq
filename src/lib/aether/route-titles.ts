/** Bilingual page titles for the breadcrumb topbar and the browser <title> sync. */
export interface RouteTitle {
  en: string
  ar: string
}

const ROUTE_TITLES: { match: string; exact?: boolean; title: RouteTitle }[] = [
  { match: '/erp', exact: true, title: { en: 'Company Summary & Profit Opportunities', ar: 'ملخص أداء الشركة وفرص زيادة الربح' } },
  { match: '/erp/feryal-ai', title: { en: 'Feryal — Smart Advisor', ar: 'المستشارة الذكية فريال' } },
  { match: '/erp/events-intelligence', title: { en: 'Seasonal Booths Study', ar: 'جدوى المعارض والبوثات الموسمية' } },
  { match: '/erp/sales-scorecard', title: { en: 'Sales & Items Scorecard', ar: 'سجل المبيعات والأصناف' } },
  { match: '/erp/sales-analysis', title: { en: 'Sales & Items Analysis', ar: 'تحليل المبيعات والأصناف' } },
  { match: '/erp/menu-engineering', title: { en: 'Menu Engineering Workbench', ar: 'منصة هندسة المنيو' } },
  { match: '/erp/delivery-control', title: { en: 'Delivery Aggregators Control', ar: 'رقابة منصات التوصيل' } },
  { match: '/erp/aggregator-radar', title: { en: 'Forensic Delivery Radar', ar: 'الرادار الجنائي لمنصات التوصيل' } },
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
  const hit = ROUTE_TITLES.filter((r) => !r.exact && (pathname === r.match || pathname.startsWith(`${r.match}/`))).sort((a, b) => b.match.length - a.match.length)[0]
  return hit?.title ?? null
}
