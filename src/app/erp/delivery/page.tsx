import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import DeliveryWorkspace from '@/modules/delivery/ui/DeliveryWorkspace'

export const dynamic = 'force-dynamic'

export default async function DeliveryPage() {
  await requirePageUser('/erp/delivery')
  const permissions = await readSessionPermissions()
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-6 sm:px-6 sm:py-8">
      <DeliveryWorkspace permissions={permissions} />
    </div>
  )
}
