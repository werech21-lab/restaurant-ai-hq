import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import { deepLinkId } from '@/lib/deep-link'
import InventoryWorkspace from '@/modules/inventory/ui/InventoryWorkspace'

export const dynamic = 'force-dynamic'

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ item?: string | string[] }> }) {
  const query = await searchParams
  await requirePageUser('/erp/inventory')
  const permissions = await readSessionPermissions()

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <InventoryWorkspace initialItemId={deepLinkId(query.item)} permissions={permissions} />
    </main>
  )
}
