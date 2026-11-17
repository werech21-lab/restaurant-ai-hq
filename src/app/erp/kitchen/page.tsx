import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import KitchenWorkspace from '@/modules/kitchen/ui/KitchenWorkspace'

export const dynamic = 'force-dynamic'

export default async function KitchenPage() {
  await requirePageUser('/erp/kitchen')
  const permissions = await readSessionPermissions()
  return (
    <div className="mx-auto w-full max-w-[1920px] min-w-0 overflow-x-hidden px-3 py-4 sm:px-6">
      <KitchenWorkspace permissions={permissions} />
    </div>
  )
}
