import { BrandSalesAnalyticsDashboard } from '@/modules/brand-sales-analytics/ui/BrandSalesAnalyticsDashboard'
import { requirePageUser } from '@/lib/auth/context'

export const dynamic = 'force-dynamic'

export default async function BrandSalesAnalyticsPage() {
  await requirePageUser('/erp/brand-sales-analytics')
  return (
    <main className="mx-auto w-full max-w-[1600px] px-3 py-6 sm:px-6">
      <BrandSalesAnalyticsDashboard />
    </main>
  )
}
