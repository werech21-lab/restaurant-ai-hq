import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import MarketingHub from '@/modules/suite/ui/MarketingHub'

export const dynamic = 'force-dynamic'

export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  await requirePageUser('/erp/marketing')
  const permissions = await readSessionPermissions()
  const query = await searchParams
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <MarketingHub permissions={permissions} initialTab={tab ?? 'website'} />
    </main>
  )
}
