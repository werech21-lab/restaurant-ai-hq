import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import { deepLinkId } from '@/lib/deep-link'
import InventoryHub from '@/modules/suite/ui/InventoryHub'

export const dynamic = 'force-dynamic'

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string | string[]; tab?: string | string[] }>
}) {
  const query = await searchParams
  await requirePageUser('/erp/inventory')
  const permissions = await readSessionPermissions()
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <InventoryHub permissions={permissions} initialTab={tab ?? 'stock'} itemId={deepLinkId(query.item)} />
    </main>
  )
}
