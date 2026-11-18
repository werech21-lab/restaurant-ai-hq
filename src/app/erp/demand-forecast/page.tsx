import { requirePageUser } from '@/lib/auth/context'
import { DemandForecastPanel } from '@/components/aether/DecisionRoomStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'توقع الطلب وتحضير المطبخ المركزي | فنتشر فودز · AetherBI',
  description: 'توقع مبيعات الأيام السبعة القادمة لكل الفروع مع خطأ الاختبار الرجعي، والأيام غير المعتادة.',
}

export default async function DemandForecastPage() {
  await requirePageUser('/erp/demand-forecast')
  return (
    <div className="w-full max-w-[1920px] mx-auto px-3 py-5 sm:px-6 min-w-0">
      <h1 className="sr-only">توقع الطلب وتحضير المطبخ المركزي | Demand &amp; Prep Forecaster</h1>
      <DemandForecastPanel />
    </div>
  )
}
