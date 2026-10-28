import FinanceDashboard from '@/components/erp/FinanceDashboard'
import { requirePageUser } from '@/lib/auth/context'
import { deepLinkId } from '@/lib/deep-link'

export const dynamic = 'force-dynamic'

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ invoice?: string | string[] }> }) {
  const query = await searchParams
  await requirePageUser('/erp/finance')

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <FinanceDashboard initialInvoiceId={deepLinkId(query.invoice)} />
    </main>
  )
}
