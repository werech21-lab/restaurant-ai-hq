import { redirect } from 'next/navigation'
import FinanceDashboard from '@/components/erp/FinanceDashboard'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function FinancePage() {
  const supabase = createClient()
  if (!supabase) redirect('/login?next=/erp/finance')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/erp/finance')

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6">
      <FinanceDashboard />
    </main>
  )
}
