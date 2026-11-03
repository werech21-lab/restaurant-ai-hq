import { Suspense } from 'react'
import { PageSkeleton } from '@/components/erp-ui'
import { OrdableExecutiveDashboard } from '@/components/dashboard/OrdableExecutiveDashboard'

export const metadata = {
  title: 'لوحة القيادة والمبيعات التنفيذية | فنتشر فودز · AetherBI',
  description: 'لوحة القيادة التنفيذية الذكية بأسلوب Ordable لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Dashboard" />}>
      <OrdableExecutiveDashboard locale="ar" />
    </Suspense>
  )
}
