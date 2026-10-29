import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import ProcurementWorkspace from '@/modules/procurement/ui/ProcurementWorkspace'

export const dynamic = 'force-dynamic'

export default async function ProcurementPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const query = await searchParams
  const tab = typeof query.tab === 'string' ? query.tab : undefined
  await requirePageUser(tab ? `/erp/procurement?tab=${encodeURIComponent(tab)}` : '/erp/procurement')

  // Used only to hide what this user cannot do. The API and the database still enforce every permission.
  const permissions = await readSessionPermissions()

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <ProcurementWorkspace permissions={permissions} initialTab={tab} />
    </main>
  )
}
