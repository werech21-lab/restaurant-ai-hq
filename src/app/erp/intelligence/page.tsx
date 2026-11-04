import { panelBridgePermissionSet } from '@/lib/auth/panel-bridge'
import IntelligenceWorkspace from '@/modules/governance/ui/IntelligenceWorkspace'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'غرفة القرار الذكي والتحليلات التنبؤية | شركة فنتشر فودز ذ.م.م.',
  description: 'تحليل الأداء التشغيلي والمالي التنبؤي لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export default async function IntelligencePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const permissions = [...panelBridgePermissionSet()].sort()
  const query = await searchParams
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return (
    <main className="w-full max-w-none px-4 py-6 md:px-6">
      <IntelligenceWorkspace permissions={permissions} initialTab={tab ?? 'radar'} />
    </main>
  )
}
