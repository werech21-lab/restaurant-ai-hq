import { requirePageUser } from '@/lib/auth/context'
import { DeliveryRadarV5 } from '@/components/aether/DeliveryRadarV5'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'الرادار الجنائي لمنصات التوصيل | فنتشر فودز · AetherBI',
  description: 'الرادار الجنائي الموحد لرصد حسابات طلبات Tgo وTMP وكيتا وديليفرو وجاهز وسنونو عبر براندات وفروع فنتشر فودز.',
}

/** Permanent pillar: Unified Forensic Delivery Radar (`/erp/aggregator-radar`). Never redirected or removed. */
export default async function AggregatorRadarPage() {
  await requirePageUser('/erp/aggregator-radar')
  return (
    <div className="w-full min-w-0" suppressHydrationWarning>
      <DeliveryRadarV5 />
    </div>
  )
}
