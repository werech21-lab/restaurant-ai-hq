import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import IntelligenceWorkspace from '@/modules/governance/ui/IntelligenceWorkspace'

export const dynamic = 'force-dynamic'

export default async function IntelligencePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  await requirePageUser('/erp/intelligence')
  const permissions = await readSessionPermissions()
  const query = await searchParams
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <IntelligenceWorkspace permissions={permissions} initialTab={tab ?? 'radar'} />
    </main>
  )
}
