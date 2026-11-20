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
    <div className="mx-auto w-full max-w-[1920px] min-w-0 overflow-visible px-4 py-5 sm:px-6">
      <InventoryHub
        permissions={permissions}
        initialTab={tab ?? 'stock'}
        itemId={deepLinkId(query.item)}
      />
    </div>
  )
}
