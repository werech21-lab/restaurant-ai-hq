import { requirePageUser } from '@/lib/auth/context'
import { DeliveryRadarV5 } from '@/components/aether/DeliveryRadarV5'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'مراقبة التوصيل | فنتشر فودز',
  description: 'مراقبة تطبيقات التوصيل وحالة الحسابات والعمولات وصافي المبيعات.',
}

/** Permanent pillar: Unified Forensic Delivery Radar (`/erp/aggregator-radar`). Never redirected or removed. */
export default async function AggregatorRadarPage() {
  await requirePageUser('/erp/aggregator-radar')
  return (
    <div className="w-full max-w-[1920px] mx-auto min-w-0" suppressHydrationWarning>
      <DeliveryRadarV5 />
    </div>
  )
}
