import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import DeliveryWorkspace from '@/modules/delivery/ui/DeliveryWorkspace'

export const dynamic = 'force-dynamic'

export default async function DeliveryPage() {
  await requirePageUser('/erp/delivery')
  const permissions = await readSessionPermissions()
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1920px] overflow-visible px-4 py-5 sm:px-6">
      <DeliveryWorkspace permissions={permissions} />
    </div>
  )
}
