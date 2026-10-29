import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import ContractsAdvisor from '@/modules/governance/ui/ContractsAdvisor'

export const dynamic = 'force-dynamic'

export default async function ContractsPage() {
  await requirePageUser('/erp/contracts')
  const permissions = await readSessionPermissions()
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <ContractsAdvisor permissions={permissions} />
    </main>
  )
}
