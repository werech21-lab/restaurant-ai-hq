import { requirePageUser } from '@/lib/auth/context'
import { deepLinkId } from '@/lib/deep-link'
import CrmWorkspace from '@/modules/crm/ui/CrmWorkspace'

export const dynamic = 'force-dynamic'

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ customer?: string | string[] }> }) {
  const query = await searchParams
  await requirePageUser('/erp/crm')

  return (
    <div className="w-full max-w-none min-w-0 px-3 py-5 sm:px-6 sm:py-8">
      <CrmWorkspace initialCustomerId={deepLinkId(query.customer)} />
    </div>
  )
}
