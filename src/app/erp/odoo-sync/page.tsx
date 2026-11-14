import { AdminPosTerminalMappingPanel } from '@/components/erp/AdminPosTerminalMappingPanel'
import {
  readSessionPermissions,
  requirePageUser,
  resolveServerExecSessionRole,
} from '@/lib/auth/context'
import OdooSync from '@/modules/odoo/ui/OdooSync'

export const dynamic = 'force-dynamic'

export default async function OdooSyncPage() {
  await requirePageUser('/erp/odoo-sync')
  const [granted, sessionRole] = await Promise.all([
    readSessionPermissions(),
    resolveServerExecSessionRole(),
  ])
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {sessionRole === 'admin' ? (
        <AdminPosTerminalMappingPanel role={sessionRole} />
      ) : null}
      <OdooSync permissions={granted} />
    </main>
  )
}
