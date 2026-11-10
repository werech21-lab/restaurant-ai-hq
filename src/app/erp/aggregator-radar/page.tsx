import { requirePageUser } from '@/lib/auth/context'
import { DeliveryRadarV5 } from '@/components/aether/DeliveryRadarV5'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'رادار منصات التوصيل | فنتشر فودز · AetherBI',
  description: 'مراقبة عمولات منصات التوصيل واستنزاف العروض وحسابات المناطق ومطالبات التسوية لشركة فنتشر فودز.',
}

/** Permanent pillar: Delivery & Aggregator Radar (single 3-tab workspace). Never redirected or removed. */
export default async function AggregatorRadarPage() {
  await requirePageUser('/erp/aggregator-radar')
  return (
    <div className="w-full min-w-0" suppressHydrationWarning>
      <DeliveryRadarV5 />
    </div>
  )
}
