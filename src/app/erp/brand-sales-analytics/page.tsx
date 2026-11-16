import { requirePageUser } from '@/lib/auth/context'
import { BrandSalesAnalyticsDashboard } from '@/modules/brand-sales-analytics/ui/BrandSalesAnalyticsDashboard'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'تحليلات مبيعات البراندات وأداء الفروع | Venture Foods W.L.L. · AetherBI',
  description:
    'لوحة التحليلات المباشرة لمبيعات العلامات التجارية الست وأداء الفروع والقنوات من أودو 17.',
}

export default async function BrandSalesAnalyticsPage() {
  await requirePageUser('/erp/brand-sales-analytics')

  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0">
      <BrandSalesAnalyticsDashboard />
    </div>
  )
}
