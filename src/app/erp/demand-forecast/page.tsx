import { requirePageUser } from '@/lib/auth/context'
import { getKuwaitTimeContext } from '@/lib/aether/period-delta'
import { DemandForecastV2 } from '@/components/aether/DemandForecastV2'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'توقع الطلب وتحضير المطبخ المركزي | فنتشر فودز · AetherBI',
  description: 'توقعات الطلب لمدة 7 و14 يوماً وجداول تحضير مطبخ العارضية المركزي.',
}

export default async function DemandForecastPage() {
  await requirePageUser('/erp/demand-forecast')
  const { yesterdayIso } = getKuwaitTimeContext()
  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 py-5 sm:px-6 min-w-0">
      <DemandForecastV2 anchor={yesterdayIso} />
    </div>
  )
}
