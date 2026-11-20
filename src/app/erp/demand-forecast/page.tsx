import { requirePageUser } from '@/lib/auth/context'
import { getLocale } from '@/lib/i18n/server'
import { DemandForecastPanel } from '@/components/aether/DecisionRoomStudio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'توقع الطلب | فنتشر فودز',
  description: 'توقع مبيعات الأيام السبعة القادمة لكل الفروع من مبيعات أودو اليومية، مع خطأ الاختبار الرجعي والأيام غير المعتادة.',
}

export default async function DemandForecastPage() {
  await requirePageUser('/erp/demand-forecast')
  const locale = await getLocale()
  const isAr = locale !== 'en'
  return (
    <div className="w-full max-w-[1920px] mx-auto px-3 py-5 sm:px-6 min-w-0">
      <h1 className="sr-only">
        {isAr ? 'توقع الطلب والأيام غير المعتادة' : 'Demand Forecast & Unusual Days'}
      </h1>
      <DemandForecastPanel />
    </div>
  )
}
