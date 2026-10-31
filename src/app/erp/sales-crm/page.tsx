import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import SalesCrmHub from '@/modules/suite/ui/SalesCrmHub'

export const dynamic = 'force-dynamic'

export default async function SalesCrmPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  await requirePageUser('/erp/sales-crm')
  const permissions = await readSessionPermissions()
  const query = await searchParams
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <SalesCrmHub permissions={permissions} initialTab={tab ?? 'crm'} />
    </main>
  )
}
