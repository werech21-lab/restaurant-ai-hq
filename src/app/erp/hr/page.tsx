import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import HrWorkspace from '@/modules/hr/ui/HrWorkspace'

export const dynamic = 'force-dynamic'

export default async function HrPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  await requirePageUser('/erp/hr')
  const permissions = await readSessionPermissions()
  const query = await searchParams
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <HrWorkspace permissions={permissions} initialTab={tab ?? 'employees'} />
    </main>
  )
}
