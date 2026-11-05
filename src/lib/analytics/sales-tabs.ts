/** The eight analysis sections of /erp/sales-scorecard, shared by the sidebar sub-menu and the page tabs. */
export type SalesTabId =
  | 'core-sales'
  | 'customer-channel'
  | 'new-customer'
  | 'products'
  | 'promotions'
  | 'branches'
  | 'peak-hours'
  | 'operation-performance'

export const SALES_BASE_PATH = '/erp/sales-scorecard'
export const DEFAULT_SALES_TAB: SalesTabId = 'core-sales'

export const SALES_TABS: { id: SalesTabId; en: string; ar: string }[] = [
  { id: 'core-sales', en: 'Core sales', ar: 'المبيعات الأساسية' },
  { id: 'customer-channel', en: 'Customer by channel', ar: 'العملاء حسب القناة' },
  { id: 'new-customer', en: 'New Customer', ar: 'العملاء الجدد' },
  { id: 'products', en: 'Products', ar: 'المنتجات والأصناف' },
  { id: 'promotions', en: 'Promotions', ar: 'العروض والخصومات' },
  { id: 'branches', en: 'Branches', ar: 'الفروع' },
  { id: 'peak-hours', en: 'Peak hours – weekly', ar: 'ساعات الذروة – أسبوعياً' },
  { id: 'operation-performance', en: 'Operation performance', ar: 'الأداء التشغيلي' },
]

export const salesTabHref = (id: SalesTabId) => `${SALES_BASE_PATH}?tab=${id}`

export function parseSalesTab(value: string | null | undefined): SalesTabId {
  return SALES_TABS.some((t) => t.id === value) ? (value as SalesTabId) : DEFAULT_SALES_TAB
}

/** Daily trend sample used by /dashboard and the core-sales tab: 11 points, one every 3 days (not the full month). */
export const DAILY_TREND_SAMPLE = [
  { day: '01 Oct', sales: 4920, orders: 895 },
  { day: '04 Oct', sales: 5380, orders: 980 },
  { day: '07 Oct', sales: 5110, orders: 930 },
  { day: '10 Oct', sales: 5890, orders: 1075 },
  { day: '13 Oct', sales: 5240, orders: 960 },
  { day: '16 Oct', sales: 6120, orders: 1120 },
  { day: '19 Oct', sales: 5490, orders: 1005 },
  { day: '22 Oct', sales: 5760, orders: 1050 },
  { day: '25 Oct', sales: 6340, orders: 1165 },
  { day: '28 Oct', sales: 5680, orders: 1040 },
  { day: '31 Oct', sales: 6490, orders: 1190 },
]
