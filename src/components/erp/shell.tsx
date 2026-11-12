/**
 * Unified ERP Shell & Sidebar Navigation Registry (`src/components/erp/shell.tsx`)
 * Owned by Workstation #1 — registers all 5 standalone operational expansion routes:
 *   - `/erp/warehouse-chain` (`سلسلة المخزن والفروع` / `Warehouse-to-Branch Chain`)
 *   - `/erp/prep-sla` (`مدة تجهيز الطلبات` / `Kitchen Prep SLA`)
 *   - `/erp/delivery-sla` (`مدة توصيل الطلبات` / `Rider Delivery SLA`)
 *   - `/erp/social-reviews` (`التقييمات ومنصات التواصل` / `Social & Aggregator Reviews`)
 *   - `/erp/weekday-comparison` (`مقارنة أيام الأسبوع` / `Weekday Sales Comparison`)
 */
export { Shell } from '@/components/shell'
export { Sidebar, SIDEBAR_ITEMS, RAIL_TOGGLE_EVENT } from '@/components/erp-sidebar'
