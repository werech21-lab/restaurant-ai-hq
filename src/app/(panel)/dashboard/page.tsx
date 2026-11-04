import { Suspense } from 'react'
import { PageSkeleton } from '@/components/erp-ui'
import { AetherBiExecutiveDashboard } from '@/components/dashboard/AetherBiExecutiveDashboard'

export const metadata = {
  title: 'مركز القيادة والتحكم التنفيذي | شركة فنتشر فودز ذ.م.م.',
  description: 'مركز القيادة والتحكم التنفيذي لمنظومة الإدارة المركزية المتكاملة لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  return (
    <div className="w-full max-w-none">
      <Suspense fallback={<PageSkeleton title="مركز القيادة والتحكم التنفيذي" />}>
        <AetherBiExecutiveDashboard locale="ar" />
      </Suspense>
    </div>
  )
}
