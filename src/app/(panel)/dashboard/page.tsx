import { Suspense } from 'react'
import { PageSkeleton } from '@/components/erp-ui'
import { AetherBiExecutiveDashboard } from '@/components/dashboard/AetherBiExecutiveDashboard'

export const metadata = {
  title: 'الملخص المالي والتشغيلي | شركة فنتشر فودز ذ.م.م.',
  description: 'الملخص المالي والتشغيلي المعتمد لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  return (
    <div className="w-full max-w-none">
      <Suspense fallback={<PageSkeleton title="الملخص المالي والتشغيلي" />}>
        <AetherBiExecutiveDashboard locale="ar" />
      </Suspense>
    </div>
  )
}
