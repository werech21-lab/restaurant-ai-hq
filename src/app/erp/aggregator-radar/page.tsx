import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import AggregatorRadar from '@/modules/governance/ui/AggregatorRadar'

export const dynamic = 'force-dynamic'

export default async function AggregatorRadarPage() {
  await requirePageUser('/erp/aggregator-radar')
  const permissions = await readSessionPermissions()
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <AggregatorRadar permissions={permissions} />
    </main>
  )
}
