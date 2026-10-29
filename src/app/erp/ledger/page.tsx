import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import { deepLinkId } from '@/lib/deep-link'
import LedgerWorkspace from '@/modules/finance/ui/LedgerWorkspace'

export const dynamic = 'force-dynamic'

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ entry?: string | string[]; tab?: string | string[] }> }) {
  const query = await searchParams
  const entry = deepLinkId(query.entry)
  const tab = typeof query.tab === 'string' ? query.tab : undefined
  const params = new URLSearchParams()
  if (entry) params.set('entry', entry)
  if (tab) params.set('tab', tab)
  const encoded = params.toString()
  const suffix = encoded ? `?${encoded}` : ''
  await requirePageUser(`/erp/ledger${suffix}`)

  // Used only to hide what this user cannot do. The API and the database still enforce every permission.
  const permissions = await readSessionPermissions()

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <LedgerWorkspace permissions={permissions} initialEntryId={entry} initialTab={tab} />
    </main>
  )
}
