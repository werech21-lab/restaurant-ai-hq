import { ODOO } from '@/lib/odoo/odoo-dataset'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

/** Real Odoo daily totals (Kuwait time) for every day of the period, whitelisted registers only. */
export const DAILY_TREND_SAMPLE: { day: string; sales: number; orders: number }[] = ODOO.timeProfile.daily
  .filter((d) => d.day >= ODOO.meta.period.from && d.day < ODOO.meta.period.to)
  .map((d) => ({ day: `${d.day.slice(8, 10)} ${MONTHS[Number(d.day.slice(5, 7)) - 1]}`, sales: d.netKwd, orders: d.orders }))
