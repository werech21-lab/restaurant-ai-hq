import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import AdminWorkspace from '@/modules/admin/ui/AdminWorkspace'

export const dynamic = 'force-dynamic'

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  await requirePageUser('/erp/admin')
  const permissions = await readSessionPermissions()
  const query = await searchParams
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-6 sm:px-6 sm:py-8">
      <AdminWorkspace permissions={permissions} initialTab={tab ?? 'accounts'} />
    </div>
  )
}
