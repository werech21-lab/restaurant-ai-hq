import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import ProcurementWorkspace from '@/modules/procurement/ui/ProcurementWorkspace'

export const dynamic = 'force-dynamic'

export default async function ProcurementPage() {
  await requirePageUser('/erp/procurement')

  // Used only to hide what this user cannot do. The API and the database still enforce every permission.
  const permissions = await readSessionPermissions()

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <ProcurementWorkspace permissions={permissions} />
    </main>
  )
}
