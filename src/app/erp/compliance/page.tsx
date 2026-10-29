import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import ComplianceWorkspace from '@/modules/governance/ui/ComplianceWorkspace'

export const dynamic = 'force-dynamic'

export default async function CompliancePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  await requirePageUser('/erp/compliance')
  const permissions = await readSessionPermissions()
  const query = await searchParams
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <ComplianceWorkspace permissions={permissions} initialTab={tab ?? 'laws'} />
    </main>
  )
}
