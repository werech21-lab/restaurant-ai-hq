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
    <div className="mx-auto w-full max-w-[1920px] min-w-0 overflow-visible space-y-6 px-4 py-5 sm:px-6">
      {sessionRole === 'admin' ? (
        <AdminPosTerminalMappingPanel role={sessionRole} />
      ) : null}
      <OdooSync permissions={granted} />
    </div>
  )
}
