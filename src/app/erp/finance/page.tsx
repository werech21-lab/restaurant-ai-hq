import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import { deepLinkId } from '@/lib/deep-link'
import FinanceHub from '@/modules/suite/ui/FinanceHub'

export const dynamic = 'force-dynamic'

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string | string[]; tab?: string | string[] }>
}) {
  const query = await searchParams
  await requirePageUser('/erp/finance')
  const permissions = await readSessionPermissions()
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <FinanceHub permissions={permissions} initialTab={tab ?? 'invoicing'} invoiceId={deepLinkId(query.invoice)} />
    </main>
  )
}
