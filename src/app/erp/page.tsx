import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ExecutiveCenter from '@/modules/ai/ui/ExecutiveCenter'

export const dynamic = 'force-dynamic'

export default async function ExecutiveCenterPage() {
  const supabase = createClient()
  if (!supabase) redirect('/login?next=/erp')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/erp')

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <ExecutiveCenter />
    </main>
  )
}