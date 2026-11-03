import { panelBridgePermissionSet } from '@/lib/auth/panel-bridge'
import IntelligenceWorkspace from '@/modules/governance/ui/IntelligenceWorkspace'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'غرفة القرار الذكي والتحليلات التنبؤية (AI Intelligence) | فنتشر فودز · AetherBI',
  description: 'تحليل الأداء التشغيلي والمالي التنبؤي لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export default async function IntelligencePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const permissions = [...panelBridgePermissionSet()].sort()
  const query = await searchParams
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <IntelligenceWorkspace permissions={permissions} initialTab={tab ?? 'radar'} />
    </main>
  )
}
