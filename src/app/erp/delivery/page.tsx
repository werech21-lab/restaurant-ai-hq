import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import DeliveryWorkspace from '@/modules/delivery/ui/DeliveryWorkspace'

export const dynamic = 'force-dynamic'

export default async function DeliveryPage() {
  await requirePageUser('/erp/delivery')
  const permissions = await readSessionPermissions()
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <DeliveryWorkspace permissions={permissions} />
    </main>
  )
}
