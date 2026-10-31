import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import OdooSync from '@/modules/odoo/ui/OdooSync'

export const dynamic = 'force-dynamic'

export default async function OdooSyncPage() {
  await requirePageUser('/erp/odoo-sync')
  const granted = await readSessionPermissions()
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <OdooSync permissions={granted} />
    </main>
  )
}
