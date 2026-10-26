import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CrmWorkspace from '@/modules/crm/ui/CrmWorkspace'

export const dynamic = 'force-dynamic'

export default async function CrmPage() {
  const supabase = createClient()
  if (!supabase) redirect('/login?next=/erp/crm')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/erp/crm')

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6">
      <CrmWorkspace />
    </main>
  )
}
