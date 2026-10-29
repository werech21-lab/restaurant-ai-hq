import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import KitchenWorkspace from '@/modules/kitchen/ui/KitchenWorkspace'

export const dynamic = 'force-dynamic'

export default async function KitchenPage() {
  await requirePageUser('/erp/kitchen')
  const permissions = await readSessionPermissions()
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <KitchenWorkspace permissions={permissions} />
    </main>
  )
}
