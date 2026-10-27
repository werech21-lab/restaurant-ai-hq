import { redirect } from 'next/navigation'
import { readSessionPermissions } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/server'
import ProcurementWorkspace from '@/modules/procurement/ui/ProcurementWorkspace'

export const dynamic = 'force-dynamic'

export default async function ProcurementPage() {
  const supabase = await createClient()
  if (!supabase) redirect('/login?next=/erp/procurement')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/erp/procurement')

  // Used only to hide what this user cannot do. The API and the database still enforce every permission.
  const permissions = await readSessionPermissions()

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <ProcurementWorkspace permissions={permissions} />
    </main>
  )
}
