import { redirect } from 'next/navigation'
import { readSessionPermissions } from '@/lib/auth/context'
import { getCurrentSessionRole } from '@/lib/erp-auth'
import IntelligenceWorkspace from '@/modules/governance/ui/IntelligenceWorkspace'

const IS_DATA_SOURCE_CONNECTED = false

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'مركز التنبيهات والانحرافات الجنائية ومحرك التوصيات في أودو | فنتشر فودز · AetherBI',
  description: 'مرصد وبنك قرارات أودو الجنائي الذكي لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export default async function IntelligencePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  if (!IS_DATA_SOURCE_CONNECTED) redirect('/erp')
  const [permissions, sessionRole] = await Promise.all([
    readSessionPermissions(),
    getCurrentSessionRole(),
  ])
  const query = await searchParams
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return (
    <div className="w-full max-w-none min-w-0 px-3 py-5 sm:px-6 sm:py-6">
      <IntelligenceWorkspace
        permissions={permissions}
        initialTab={tab ?? 'radar'}
        isAuditor={sessionRole === 'auditor'}
      />
    </div>
  )
}
