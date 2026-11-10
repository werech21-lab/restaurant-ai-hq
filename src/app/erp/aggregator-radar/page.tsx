import { panelBridgePermissionSet } from '@/lib/auth/panel-bridge'
import AggregatorRadar from '@/modules/governance/ui/AggregatorRadar'
import { DeliveryRadarV5 } from '@/components/aether/DeliveryRadarV5'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'رادار منصات التوصيل | فنتشر فودز · AetherBI',
  description: 'مراقبة عمولات منصات التوصيل واستنزاف العروض وحسابات المناطق ومطالبات التسوية لشركة فنتشر فودز.',
}

/** Permanent pillar: Delivery & Aggregator Radar. Never redirected. */
export default function AggregatorRadarPage() {
  const permissions = [...panelBridgePermissionSet()].sort()
  return (
    <main className="mx-auto w-full min-w-0 max-w-[1400px] space-y-6 px-5 py-6 sm:px-8" suppressHydrationWarning>
      <DeliveryRadarV5 />
      <div className="w-full min-w-0 overflow-x-auto">
        <AggregatorRadar permissions={permissions} />
      </div>
    </main>
  )
}
