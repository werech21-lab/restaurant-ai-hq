import { requirePageUser } from '@/lib/auth/context'
import { DemandForecastV2 } from '@/components/aether/DemandForecastV2'
import { kuwaitTodayISO } from '@/lib/enterprise-giants-engine'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'توقع الطلب والطقس وتحضير المطبخ المركزي | فنتشر فودز',
  description: 'توقع الإيرادات والطلبات لـ 7 و14 يوماً عبر الفروع التسعة مع مستويات تحضير مطبخ العارضية وخطط الطواقم.',
}

export default async function Page() {
  await requirePageUser('/erp/demand-forecast')
  return (
    <div className="w-full">
      <DemandForecastV2 anchor={kuwaitTodayISO()} />
    </div>
  )
}
