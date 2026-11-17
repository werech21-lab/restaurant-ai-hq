import { Suspense } from 'react'
import { StateBlock } from '@/components/ui'
import { AetherBiExecutiveDashboard } from '@/components/dashboard/AetherBiExecutiveDashboard'

export const metadata = {
  title: 'الملخص المالي والتشغيلي | شركة فنتشر فودز ذ.م.م.',
  description: 'الملخص المالي والتشغيلي المعتمد لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  return (
    <div className="w-full max-w-none">
      <Suspense fallback={<StateBlock state="loading" minHeightClass="min-h-[260px]" />}>
        <AetherBiExecutiveDashboard />
      </Suspense>
    </div>
  )
}
