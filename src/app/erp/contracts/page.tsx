import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import ContractsAdvisor from '@/modules/governance/ui/ContractsAdvisor'

export const dynamic = 'force-dynamic'

export default async function ContractsPage() {
  await requirePageUser('/erp/contracts')
  const permissions = await readSessionPermissions()
  return (
    <div className="mx-auto w-full max-w-[1920px] min-w-0 overflow-visible px-4 py-5 sm:px-6">
      <ContractsAdvisor permissions={permissions} />
    </div>
  )
}
