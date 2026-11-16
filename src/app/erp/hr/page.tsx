import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import HrWorkspace from '@/modules/hr/ui/HrWorkspace'

export const dynamic = 'force-dynamic'

export default async function HrPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  await requirePageUser('/erp/hr')
  const permissions = await readSessionPermissions()
  const query = await searchParams
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return (
    <div
      className="mx-auto w-full max-w-[1920px] min-w-0 overflow-x-hidden px-4 py-5 sm:px-6"
      suppressHydrationWarning
    >
      <HrWorkspace permissions={permissions} initialTab={tab ?? 'employees'} />
    </div>
  )
}
