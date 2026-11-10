import { panelBridgePermissionSet } from '@/lib/auth/panel-bridge'
import AggregatorRadar from '@/modules/governance/ui/AggregatorRadar'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'رادار منصات التوصيل ومطابقة العمولات | فنتشر فودز · AetherBI',
  description: 'مراقبة عمولات منصات التوصيل (طلبات، دليفرو، كيتا، جاهز) والمطابقة المالية الدقيقة لشركة فنتشر فودز.',
}

export default function AggregatorRadarPage() {
  const permissions = [...panelBridgePermissionSet()].sort()
  return (
    <main className="w-full min-w-0" suppressHydrationWarning>
      <AggregatorRadar permissions={permissions} />
    </main>
  )
}
