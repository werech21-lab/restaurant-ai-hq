import { requirePageUser } from '@/lib/auth/context'
import { deepLinkId } from '@/lib/deep-link'
import CrmWorkspace from '@/modules/crm/ui/CrmWorkspace'

export const dynamic = 'force-dynamic'

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ customer?: string | string[] }> }) {
  const query = await searchParams
  await requirePageUser('/erp/crm')

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <CrmWorkspace initialCustomerId={deepLinkId(query.customer)} />
    </main>
  )
}
