import { panelBridgePermissionSet } from '@/lib/auth/panel-bridge'
import GovernanceDesk from '@/modules/governance/ui/GovernanceDesk'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'الحوكمة والامتثال الرقابي والشؤون القانونية | شركة فنتشر فودز ذ.م.م.',
  description: 'متابعة الامتثال للقرارات الوزارية، عقود الإيجار، التراخيص التجارية والصحية، ومخالفات البلدية لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export default async function GovernancePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const permissions = [...panelBridgePermissionSet()].sort()
  const query = await searchParams
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return (
    <main className="w-full max-w-none px-4 py-8 sm:px-6">
      <GovernanceDesk permissions={permissions} initialTab={tab ?? 'violations'} />
    </main>
  )
}
