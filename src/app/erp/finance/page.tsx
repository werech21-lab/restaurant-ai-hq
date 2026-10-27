import { redirect } from 'next/navigation'
import FinanceDashboard from '@/components/erp/FinanceDashboard'
import { deepLinkId } from '@/lib/deep-link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ invoice?: string | string[] }> }) {
  const query = await searchParams
  const supabase = await createClient()
  if (!supabase) redirect('/login?next=/erp/finance')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/erp/finance')

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <FinanceDashboard initialInvoiceId={deepLinkId(query.invoice)} />
    </main>
  )
}
