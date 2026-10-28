import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import { deepLinkId } from '@/lib/deep-link'
import LedgerWorkspace from '@/modules/finance/ui/LedgerWorkspace'

export const dynamic = 'force-dynamic'

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ entry?: string | string[] }> }) {
  const query = await searchParams
  await requirePageUser(`/erp/ledger${deepLinkId(query.entry) ? `?entry=${deepLinkId(query.entry)}` : ''}`)

  // Used only to hide what this user cannot do. The API and the database still enforce every permission.
  const permissions = await readSessionPermissions()

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <LedgerWorkspace permissions={permissions} initialEntryId={deepLinkId(query.entry)} />
    </main>
  )
}
