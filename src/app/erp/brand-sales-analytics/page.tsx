import { BrandSalesAnalyticsDashboard } from '@/modules/brand-sales-analytics/ui/BrandSalesAnalyticsDashboard'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'تحليلات مبيعات البراندات وأداء الفروع | Venture Foods W.L.L. · AetherBI',
  description: 'لوحة التحليلات المتقدمة لمبيعات العلامات التجارية وأداء الفروع والقنوات لشهر أكتوبر 2026 لشركة فنتشر فودز.',
}

export default function BrandSalesAnalyticsPage() {
  return (
    <main className="mx-auto w-full max-w-[1600px] px-3 py-6 sm:px-6">
      <BrandSalesAnalyticsDashboard />
    </main>
  )
}
