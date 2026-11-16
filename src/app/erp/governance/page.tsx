import { requirePageUser, resolveServerExecSessionRole } from '@/lib/auth/context'
import { panelBridgePermissionSet } from '@/lib/auth/panel-bridge'
import GovernanceDesk from '@/modules/governance/ui/GovernanceDesk'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'الحوكمة والامتثال الرقابي والشؤون القانونية | شركة فنتشر فودز ذ.م.م.',
  description: 'متابعة الامتثال للقرارات الوزارية، عقود الإيجار، التراخيص التجارية والصحية، ومخالفات البلدية لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export default async function GovernancePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  await requirePageUser('/erp/governance')
  const sessionRole = await resolveServerExecSessionRole()
  const allPermissions = [...panelBridgePermissionSet()].sort()
  const permissions =
    sessionRole === 'auditor'
      ? allPermissions.filter((perm) => !perm.endsWith('.manage') && !perm.endsWith('.dispatch'))
      : allPermissions
  const query = await searchParams
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return (
    <div className="w-full max-w-none min-w-0 overflow-x-hidden px-4 py-6 sm:px-6">
      <GovernanceDesk permissions={permissions} initialTab={tab ?? 'violations'} />
    </div>
  )
}
