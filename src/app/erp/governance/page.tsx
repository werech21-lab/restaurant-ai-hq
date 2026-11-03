import { panelBridgePermissionSet } from '@/lib/auth/panel-bridge'
import GovernanceDesk from '@/modules/governance/ui/GovernanceDesk'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'الحوكمة والامتثال الرقابي (Governance & Compliance) | فنتشر فودز · AetherBI',
  description: 'متابعة الامتثال للقرارات الوزارية، عقود الإيجار، التراخيص التجارية والصحية لشركة فنتشر فودز.',
}

export default async function GovernancePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const permissions = [...panelBridgePermissionSet()].sort()
  const query = await searchParams
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <GovernanceDesk permissions={permissions} initialTab={tab ?? 'violations'} />
    </main>
  )
}
