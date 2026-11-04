import { Suspense } from 'react'
import { PageSkeleton } from '@/components/erp-ui'
import { AetherBiExecutiveDashboard } from '@/components/dashboard/AetherBiExecutiveDashboard'

export const metadata = {
  title: 'لوحة القيادة التنفيذية الذكية | شركة فنتشر فودز · AetherBI',
  description: 'لوحة القيادة التنفيذية الذكية لمنظومة AetherBI ERP لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Dashboard" />}>
      <AetherBiExecutiveDashboard locale="ar" />
    </Suspense>
  )
}
